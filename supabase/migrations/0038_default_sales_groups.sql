-- ---------------------------------------------------------------------------
-- 0038 — Myyntiryhmien oletuspohja
-- ---------------------------------------------------------------------------
--
-- Suomessa ravintolan verokannat ovat samat joka ravintolalle:
-- ravintola- ja ateriapalvelu alennetulla kannalla, alkoholi ja muu
-- myynti yleisellä. Jokaisen ravintolan ei tarvitse keksiä niitä
-- itse — tyhjä verotusnäkymä on este jonka takana koko täsmäytys on.
--
-- POHJA EI OLE KOVAKOODATTU KANTA.
--
-- Ero on olennainen. Kovakoodattu kanta on luku jota ei voi muuttaa;
-- pohja on rivi joka luodaan kerran ja jota ravintola muokkaa vapaasti.
-- Verokanta muuttuu lainsäädännöllä, ja silloin pohja muuttuu UUSILLE
-- ravintoloille — vanhat pitävät omansa, ja vanhat myyntirivit
-- pitävät sen kannan joka niihin kirjattiin.
--
-- POHJA EI KIRJOITA PÄÄLLE.
--
-- Funktio ei tee mitään jos ryhmiä on jo yksikin. Ravintola joka on
-- määrittänyt omat ryhmänsä ei saa löytää niiden joukosta kolmea
-- uutta, eikä muokattu kanta saa palautua alkuperäiseksi.

create or replace function seed_default_sales_groups(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi lisätä myyntiryhmiä';
  end if;

  -- Yksikin olemassa oleva ryhmä tarkoittaa että ravintola on jo
  -- päättänyt jäsennyksensä. Silloin pohja olisi häiriö eikä apu.
  if exists (select 1 from sales_groups where restaurant_id = p_restaurant) then
    return 0;
  end if;

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (p_restaurant, 'Ravintolamyynti', 0.14000, true, 0),
    (p_restaurant, 'Alkoholimyynti', 0.25500, false, 1),
    (p_restaurant, 'Muut myynnit', 0.25500, false, 2);

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function seed_default_sales_groups from public;
grant execute on function seed_default_sales_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa pohjan heti
-- ---------------------------------------------------------------------------
--
-- Rivit kirjoitetaan suoraan eikä seed-funktion kautta: funktio vaatii
-- omistajuuden, ja jäsenyys on juuri kirjoitettu samassa
-- transaktiossa — is_owner voisi lukea vanhaa tilaa riippuen siitä
-- milloin se näkee rivin.

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

  insert into restaurants (name, timezone)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'))
  returning id into v_id;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  /*
   * Myyntiryhmien pohja.
   *
   * Uusi ravintola pystyy täsmäyttämään päiväraportin heti
   * ensimmäisestä päivästä. Ilman pohjaa verotusnäkymä olisi tyhjä, ja
   * tyhjä näkymä on este jota kukaan ei ohita illan päätteeksi.
   *
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.14000, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;
