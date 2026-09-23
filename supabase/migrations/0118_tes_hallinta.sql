-- ---------------------------------------------------------------------------
-- 0118 — TES-pohjat ja niiden versiot
-- ---------------------------------------------------------------------------
--
-- Tyoehtosopimuksen lisat maaritetaan Katen hallinnassa eika
-- yrityksessa. Yritysasiakas ei tieda oman TES:insa iltalisaa senttina
-- eika sita pida kysya hanelta: vaarin syotetty luku nayttaisi
-- tarkalta ja olisi vaara koko kuukauden ajan.
--
-- TAMA EI OLE TES-MOOTTORI.
--
-- Taulut kantavat yksinkertaisia lisia: euroa tunnilta tai prosenttia
-- tuntipalkasta, valinnaisesti kellonaikavalilla. Ylityo, tyoaikalain
-- tulkinta, sairausajan palkka ja palkkaryhmat eivat ole taalla eika
-- niita teeskennella osattavan.
--
-- VERSIO VALITAAN VUORON PAIVALLA.
--
-- Sopimus uusitaan muutaman vuoden valein, eika vanhaa saa
-- ylikirjoittaa: viime vuoden vuorot on laskettu silloin voimassa
-- olleilla lisilla, ja ylikirjoitus muuttaisi jo raportoidun
-- kustannuksen jalkikateen. Versiot ovat siksi omia riveja, ja ne
-- kuuluvat samaan perheeseen slugin kautta.

create table if not exists tes_agreements (
  id uuid primary key default gen_random_uuid(),

  /*
   * Perheen tunnus.
   *
   * Sama sopimus eri kausina jakaa sluginsa, esimerkiksi 'marava'.
   * Yritys osoittaa yhteen versioon, mutta laskenta etsii perheesta
   * sen version joka oli voimassa vuoron paivana.
   */
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),

  name text not null check (length(trim(name)) > 0),
  industry business_type not null,

  valid_from date not null,
  /** Null = voimassa toistaiseksi. */
  valid_until date,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (valid_until is null or valid_until >= valid_from)
);

create index if not exists tes_agreements_slug_idx
  on tes_agreements (slug, valid_from desc);

create index if not exists tes_agreements_industry_idx
  on tes_agreements (industry, is_active);

-- ---------------------------------------------------------------------------
-- Lisat
-- ---------------------------------------------------------------------------
--
-- EURO JA PROSENTTI OVAT ERI ASIOITA.
--
-- Ravintola-alan iltalisa on euroja tunnilta, sunnuntaikorotus
-- prosentti. Yksikko on siksi rivilla eika oletuksena.

create table if not exists tes_rules (
  id uuid primary key default gen_random_uuid(),
  tes_id uuid not null references tes_agreements (id) on delete cascade,

  /** Mihin lisa kohdistuu. Laskenta tuntee nama nimet. */
  rule_type text not null
    check (rule_type in ('evening', 'night', 'saturday', 'sunday')),

  /** Nakyva nimi, esimerkiksi "Iltalisa". */
  name text not null check (length(trim(name)) > 0),

  unit text not null check (unit in ('eur_per_hour', 'percent')),

  /** Euroina tunnilta sentteina, tai prosenttilukuna. */
  value numeric(10, 2) not null check (value >= 0),

  /** Kellonaikavali paikallista aikaa. Null = koko vuorokausi. */
  start_time time,
  end_time time,

  created_at timestamptz not null default now(),

  /* Yksi lisa lajia kohti versiossa: kaksi iltalisaa olisi lukuvirhe. */
  unique (tes_id, rule_type)
);

create index if not exists tes_rules_tes_idx on tes_rules (tes_id);

-- ---------------------------------------------------------------------------
-- Yrityksen sopimus
-- ---------------------------------------------------------------------------
--
-- Toimiala on jo restaurants.business_type. Se ei ehdota TES:ia
-- itsestaan: toimiala kertoo minka listan kehittaja nakee, mutta
-- lopullisen valinnan tekee ihminen.

alter table restaurants
  add column if not exists tes_id uuid references tes_agreements (id);

comment on column restaurants.tes_id is
  'Yritykselle maaritetty TES-versio. Laskenta etsii saman slugin versiot ja valitsee vuoron paivan mukaan.';

-- ---------------------------------------------------------------------------
-- Paasy
-- ---------------------------------------------------------------------------
--
-- TES-ehdot ovat julkisia asiakirjoja eivatka yrityksen salaisuuksia,
-- joten kirjautunut saa lukea ne. Kirjoitus on Katen hallinnan asia:
-- yritysasiakas ei muokkaa virallisia saantoja.

alter table tes_agreements enable row level security;
alter table tes_rules enable row level security;

drop policy if exists tes_agreements_read on tes_agreements;
create policy tes_agreements_read on tes_agreements
  for select to authenticated using (true);

drop policy if exists tes_agreements_write on tes_agreements;
create policy tes_agreements_write on tes_agreements
  for all to authenticated
  using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

drop policy if exists tes_rules_read on tes_rules;
create policy tes_rules_read on tes_rules
  for select to authenticated using (true);

drop policy if exists tes_rules_write on tes_rules;
create policy tes_rules_write on tes_rules
  for all to authenticated
  using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

-- ---------------------------------------------------------------------------
-- Yrityksen sopimuksen asettaminen
-- ---------------------------------------------------------------------------
--
-- Oma funktionsa eika sa_update_restaurant-kutsun lisakentta: sopimus
-- vaihtuu harvoin ja eri syysta kuin osoite, ja lokiin kuuluu oma
-- rivinsa.

create or replace function sa_set_restaurant_tes(
  p_restaurant uuid,
  p_tes uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name text;
  v_tes text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain Katen hallinta voi maarittaa TES:in.'
      using errcode = '42501';
  end if;

  select name into v_name from restaurants where id = p_restaurant;
  if v_name is null then
    raise exception 'Yritysta ei loydy.' using errcode = 'P0002';
  end if;

  if p_tes is not null then
    select name into v_tes from tes_agreements where id = p_tes;
    if v_tes is null then
      raise exception 'TES:ia ei loydy.' using errcode = 'P0002';
    end if;
  end if;

  update restaurants set tes_id = p_tes where id = p_restaurant;

  perform write_audit(
    p_restaurant,
    'updated',
    'restaurant',
    p_restaurant,
    v_name,
    case
      when p_tes is null then 'TES poistettiin yritykselta'
      else 'TES asetettiin: ' || v_tes
    end,
    null,
    null,
    false
  );
end;
$function$;

revoke all on function sa_set_restaurant_tes from public;
grant execute on function sa_set_restaurant_tes to authenticated;
