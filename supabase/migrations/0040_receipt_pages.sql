-- ---------------------------------------------------------------------------
-- 0040 — Monisivuinen kuitti
-- ---------------------------------------------------------------------------
--
-- Kuitilla on ollut yksi kuva. Tukkukuitti on kolme sivua, ja
-- ainoa tapa saada se sisään oli skannata sivut yhdeksi PDF:ksi —
-- ylimääräinen työvaihe juuri siinä kohtaa jossa ollaan kiireisiä.
--
-- Nyt sivuja voi olla niin monta kuin kuitissa on.
--
-- SIVUTAULU ON TOTUUS, image_path ON PEILI.
--
-- Vanha sarake jää paikalleen ja osoittaa ensimmäiseen sivuun. Sitä ei
-- pudoteta: pudotettu sarake on peruuttamaton, ja vanhat kyselyt
-- lukevat sitä yhä. Peiliä kirjoittaa vain set_receipt_pages, joten
-- kahta kirjoittajaa ei ole eivätkä ne voi ajautua erilleen.

create table if not exists receipt_pages (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,

  /* Sivujärjestys sellaisena kuin käyttäjä kuvasi ne. 1, 2, 3… */
  page_number integer not null check (page_number >= 1),

  storage_path text not null,

  /*
   * Tiedoston tiiviste.
   *
   * Sama sivu kahdesti ei vie tilaa kahdesti, ja tiiviste on myös
   * ainoa tapa huomata jos sama sivu on kuvattu kahteen kertaan.
   */
  file_hash text,

  created_at timestamptz not null default now(),

  /* Kaksi sivua samalla numerolla tarkoittaisi kahta järjestystä. */
  unique (receipt_id, page_number)
);

create index if not exists receipt_pages_lookup
  on receipt_pages (receipt_id, page_number);

-- ---------------------------------------------------------------------------
-- Vanhat kuitit sivutauluun
-- ---------------------------------------------------------------------------
--
-- Jokainen olemassa oleva kuva on kuitin ensimmäinen sivu. Ilman tätä
-- vanhat kuitit näyttäisivät kuvattomilta heti kun näkymä alkaa lukea
-- sivutaulua.

insert into receipt_pages (receipt_id, page_number, storage_path, file_hash)
select r.id, 1, r.image_path, r.file_hash
from receipts r
where r.image_path is not null
  and not exists (select 1 from receipt_pages p where p.receipt_id = r.id)
on conflict (receipt_id, page_number) do nothing;

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Sivun oikeus tulee kuitista johon se kuuluu, ja on täsmälleen sama
-- kuin kuitin oma sääntö: luku talousoikeudella tai omalla kuitilla,
-- kirjoitus vuoropäälliköllä.
--
-- Sivulla ei ole omaa restaurant_id:tä: kaksi lähdettä samalle
-- totuudelle ajautuisi erilleen, ja väärin päivitetty sivu näkyisi
-- väärälle ravintolalle.

alter table receipt_pages enable row level security;

drop policy if exists receipt_pages_read on receipt_pages;
create policy receipt_pages_read on receipt_pages
  for select to authenticated
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_id
        and (
          can_read_finance(r.restaurant_id)
          or (r.restaurant_id in (select my_restaurant_ids()) and r.added_by = auth.uid())
        )
    )
  );

drop policy if exists receipt_pages_write on receipt_pages;
create policy receipt_pages_write on receipt_pages
  for all to authenticated
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_id and is_manager(r.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_id and is_manager(r.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Sivujen kirjoitus
-- ---------------------------------------------------------------------------
--
-- Yksi funktio joka korvaa kuitin sivut kokonaan. Osittainen päivitys
-- jättäisi poistetun sivun roikkumaan, ja kuitti näyttäisi sivun jota
-- ei enää ole.
--
-- Suljettu kuukausi estää muutoksen samalla säännöllä kuin kuitinkin:
-- kirjanpitoon lähetetyn kuitin sivut eivät saa vaihtua.

create or replace function set_receipt_pages(
  p_receipt uuid,
  p_paths text[],
  p_hashes text[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_date date;
  v_count integer;
begin
  select restaurant_id, receipt_date into v_restaurant, v_date
  from receipts where id = p_receipt;

  if v_restaurant is null then
    raise exception 'Kuittia ei löytynyt';
  end if;

  /*
   * Sivujen liittäminen on osa kuitin lisäämistä.
   *
   * Kuitin saa lisätä myös työntekijä, joten sivujen kirjoitusta ei voi
   * rajata vuoropäälliköihin — muuten oma kuitti jäisi sivuttomaksi.
   * Funktio on security definer ja rajaa itse: omaan kuittiin saa
   * koskea, muiden kuitteihin vain vuoropäällikkö.
   */
  if not (
    is_manager(v_restaurant)
    or exists (select 1 from receipts where id = p_receipt and added_by = auth.uid())
  ) then
    raise exception 'Ei oikeutta tähän kuittiin';
  end if;

  if exists (
    select 1 from closed_months
    where restaurant_id = v_restaurant
      and month = date_trunc('month', v_date)::date
  ) then
    raise exception 'Kuukausi on suljettu kirjanpitoon';
  end if;

  delete from receipt_pages where receipt_id = p_receipt;

  if p_paths is null or array_length(p_paths, 1) is null then
    update receipts set image_path = null where id = p_receipt;
    return 0;
  end if;

  insert into receipt_pages (receipt_id, page_number, storage_path, file_hash)
  select
    p_receipt,
    ordinality::integer,
    path,
    case
      when p_hashes is null then null
      else p_hashes[ordinality]
    end
  from unnest(p_paths) with ordinality as t(path, ordinality)
  where coalesce(trim(path), '') <> '';

  get diagnostics v_count = row_count;

  -- Peili ensimmäiseen sivuun. Ainoa kirjoittaja on tämä funktio.
  update receipts set image_path = p_paths[1] where id = p_receipt;

  return v_count;
end;
$$;

revoke all on function set_receipt_pages from public;
grant execute on function set_receipt_pages to authenticated;
