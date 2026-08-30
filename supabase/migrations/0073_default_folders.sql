-- ---------------------------------------------------------------------------
-- 0073 — Tiedostojen lähtökansiot
-- ---------------------------------------------------------------------------
--
-- Tyhjä tiedostonäkymä on kysymys jota ravintoloitsija ei halua
-- vastata: "mistä minun pitäisi aloittaa?" Yhdeksän kansiota vastaa
-- siihen puolestaan.
--
-- ---------------------------------------------------------------------------
-- KANSIOT OVAT EHDOTUS, EI RAKENNE
-- ---------------------------------------------------------------------------
--
-- Nämä luodaan kerran ravintolan syntyessä ja unohdetaan. Mikään koodi
-- ei etsi niitä nimellä, mikään ei oleta niiden olevan olemassa, eikä
-- mikään luo niitä uudelleen jos ne poistetaan. Kansio on rivi jonka
-- käyttäjä omistaa siitä hetkestä lähtien.
--
-- Jos tässä olisi vaikka "Kuitit"-kansio jota kuittien tallennus
-- etsisi, kansion nimeäminen uudelleen rikkoisi kuitit. Siksi
-- kansioilla ei ole tunnisteita eikä tyyppiä — vain nimi ja järjestys.

create or replace function default_folder_names()
returns table (name text, sort_order integer)
language sql
immutable
set search_path = public
as $
  values
    ('Sopimukset', 0),
    ('Kuitit', 1),
    ('Myyntiraportit', 2),
    ('Laskut', 3),
    ('Talous', 4),
    ('Työntekijät', 5),
    ('Viranomaiset', 6),
    ('Tärkeät tiedostot', 7),
    ('Muut', 8);
$$;

/**
 * Lähtökansiot yhdelle ravintolalle.
 *
 * on conflict do nothing: ajo kahdesti ei kahdenna mitään, eikä
 * käyttäjän poistama kansio palaa vaikka funktio ajettaisiin uudelleen
 * — poistettua ei ole, ja uusi luonti on eri asia kuin paluu.
 */
create or replace function seed_default_folders(p_restaurant uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into folders (restaurant_id, parent_folder_id, name, sort_order)
  select p_restaurant, null, d.name, d.sort_order
  from default_folder_names() d
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa kansiot
-- ---------------------------------------------------------------------------
--
-- create_restaurant kirjoitetaan kokonaan uudelleen, koska se on
-- projektin tapa: 0038, 0039 ja 0044 tekivät saman. Sisältö on 0044:n
-- versio, johon on lisätty yksi kutsu.

create or replace function create_restaurant(
  p_name text,
  p_timezone text default 'Europe/Helsinki'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Ravintolan nimi puuttuu';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  for v_attempt in 1..5 loop
    begin
      insert into restaurants (name, timezone, slug)
      values (
        trim(p_name),
        coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'),
        restaurant_slug(p_name)
      )
      returning id into v_id;

      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Ravintolan osoitetunnusta ei voitu muodostaa. Kokeile toista nimeä.';
      end if;
    end;
  end loop;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  /* Tiedostojen lähtökansiot. Käyttäjä saa muuttaa niitä heti. */
  perform seed_default_folders(v_id);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;

/*
 * Kylvöfunktiot ovat sisäisiä.
 *
 * seed_default_folders on security definer eikä tarkista oikeuksia:
 * sen ainoa kutsuja on create_restaurant, joka on jo tarkistanut
 * kirjautumisen. Ilman tätä peruutusta kuka tahansa — myös
 * kirjautumaton — voisi luoda yhdeksän kansiota mihin tahansa
 * ravintolaan pelkällä tunnisteella.
 *
 * from public ei riitä: Supabase myöntää anonille ja
 * authenticatedille suoran oikeuden, jota PUBLIC-peruutus ei koske.
 */
revoke execute on function seed_default_folders(uuid) from public, anon, authenticated;
revoke execute on function default_folder_names() from public, anon, authenticated;

/*
 * Sama vika projektin vanhoissa kylvöfunktioissa.
 *
 * seed_default_sales_groups ja seed_default_pos_mappings ovat olleet
 * kirjautumattoman kutsuttavissa siitä asti kun ne luotiin. Ne ovat
 * samaa luokkaa: security definer, ei oikeustarkistusta, ravintola
 * parametrina. Korjataan samalla, koska vika on identtinen eikä sen
 * jättäminen paikalleen olisi puolustettavissa.
 */
revoke execute on function seed_default_sales_groups(uuid) from public, anon, authenticated;
revoke execute on function seed_default_pos_mappings(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Olemassa olevat ravintolat
-- ---------------------------------------------------------------------------
--
-- Ilman tätä ominaisuus avautuisi tyhjänä juuri niille ravintoloille
-- jotka ovat jo käytössä — eli kaikille todellisille. Kansiot annetaan
-- vain niille joilla ei ole yhtään: jos ravintola on jo rakentanut
-- omansa jotenkin muuten, sitä ei täydennetä ehdotuksilla.

do $$
declare
  r record;
begin
  for r in
    select id from restaurants
    where not exists (select 1 from folders f where f.restaurant_id = restaurants.id)
  loop
    perform seed_default_folders(r.id);
  end loop;
end;
$$;
