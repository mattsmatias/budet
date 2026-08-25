-- ---------------------------------------------------------------------------
-- 0043 — Kassaryhmien oletuskohdistukset
-- ---------------------------------------------------------------------------
--
-- Uusi ravintola sai myyntiryhmät (0038) muttei yhtään kohdistusta
-- kassan omista ryhmänimistä niihin. Ensimmäinen päiväraportti meni
-- siis kokonaan oletusryhmään: olut kirjautui alennetulle kannalle ja
-- näytölle tuli varoitus "verokanta on arvattu".
--
-- Suomalaiset kassat käyttävät samoja sanoja. "OLUT" on olut joka
-- ravintolassa, ja sen kohdistaminen käsin joka ravintolassa on työtä
-- joka voidaan tehdä kerran.
--
-- VAIN YKSISELITTEISET NIMET.
--
-- Listalla on nimiä joiden merkityksestä ei voi erehtyä. "JUOMAT" ei
-- ole listalla: se voi tarkoittaa myös anniskelua, ja väärä kohdistus
-- on huonompi kuin puuttuva — puuttuvasta varoitetaan, väärästä ei.
-- Samasta syystä "BAARI" ja "TAKE AWAY" jäävät pois: edellinen voi
-- myydä ruokaa, jälkimmäisen kanta riippuu siitä mitä myydään.
--
-- KOHDISTUS EI OLE VEROKANTA.
--
-- Tämä ei päätä yhdenkään tuotteen verokantaa. Se sanoo mihin
-- ravintolan omaan myyntiryhmään kassan ryhmänimi kuuluu; kanta tulee
-- siitä ryhmästä, ja ravintola muokkaa molempia vapaasti.

create or replace function default_pos_names()
returns table (pos_name text, group_name text)
language sql
immutable
as $$
  /*
   * Ravintolamyynti — ruoka ja alkoholiton tarjoilu.
   *
   * Vedet ja virvoitusjuomat ovat mukana, koska ne ovat osa
   * tarjoilua: myös esimerkkiravintolan kassa verottaa VEDET-ryhmän
   * samalla kannalla kuin ruoan.
   */
  select * from (values
    ('RUOKA', 'Ravintolamyynti'),
    ('RUOAT', 'Ravintolamyynti'),
    ('MUU RUOKA', 'Ravintolamyynti'),
    ('LOUNAS', 'Ravintolamyynti'),
    ('LOUNAAT', 'Ravintolamyynti'),
    ('KEITTIÖ', 'Ravintolamyynti'),
    ('ANNOKSET', 'Ravintolamyynti'),
    ('A LA CARTE', 'Ravintolamyynti'),
    ('ALACARTE', 'Ravintolamyynti'),
    ('PIZZA', 'Ravintolamyynti'),
    ('PIZZAT', 'Ravintolamyynti'),
    ('SALAATTI', 'Ravintolamyynti'),
    ('SALAATIT', 'Ravintolamyynti'),
    ('ALKURUOKA', 'Ravintolamyynti'),
    ('JÄLKIRUOKA', 'Ravintolamyynti'),
    ('JÄLKIRUOAT', 'Ravintolamyynti'),
    ('KAHVI', 'Ravintolamyynti'),
    ('KAHVIT', 'Ravintolamyynti'),
    ('TEE', 'Ravintolamyynti'),
    ('VESI', 'Ravintolamyynti'),
    ('VEDET', 'Ravintolamyynti'),
    ('LIMSA', 'Ravintolamyynti'),
    ('LIMSAT', 'Ravintolamyynti'),
    ('MEHU', 'Ravintolamyynti'),
    ('VIRVOITUSJUOMAT', 'Ravintolamyynti'),
    ('ALKOHOLITTOMAT', 'Ravintolamyynti'),

    /* Alkoholimyynti — anniskelu, yleinen kanta. */
    ('ALKO', 'Alkoholimyynti'),
    ('ALKOHOLI', 'Alkoholimyynti'),
    ('ALKOHOLIT', 'Alkoholimyynti'),
    ('ANNISKELU', 'Alkoholimyynti'),
    ('OLUT', 'Alkoholimyynti'),
    ('OLUET', 'Alkoholimyynti'),
    ('VIINI', 'Alkoholimyynti'),
    ('VIINIT', 'Alkoholimyynti'),
    ('KUOHUVIINI', 'Alkoholimyynti'),
    ('SIIDERI', 'Alkoholimyynti'),
    ('LONKERO', 'Alkoholimyynti'),
    ('DRINKIT', 'Alkoholimyynti'),
    ('VÄKEVÄT', 'Alkoholimyynti'),

    /* Muut myynnit — ei tarjoilua, yleinen kanta. */
    ('TUPAKKA', 'Muut myynnit')
  ) as t(pos_name, group_name);
$$;

-- ---------------------------------------------------------------------------
-- Kohdistusten lisääminen olemassa olevalle ravintolalle
-- ---------------------------------------------------------------------------
--
-- Ei kirjoita päälle. Ravintolan oma kohdistus voittaa aina, myös kun
-- se osoittaa eri ryhmään kuin oletus: se on tietoinen päätös, ja
-- oletuslista on vain lähtökohta.
--
-- Vertailu tehdään pienaakkosin ja välilyönnit siistien, koska
-- sovellus tunnistaa nimet samoin. Muuten "Alko" ja "ALKO" olisivat
-- kannalle kaksi eri riviä mutta sovellukselle sama nimi.

create or replace function seed_default_pos_mappings(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kohdistuksia';
  end if;

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select p_restaurant, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = p_restaurant
   and lower(trim(g.name)) = lower(trim(d.group_name))
  where not exists (
    select 1
    from pos_sales_groups existing
    where existing.restaurant_id = p_restaurant
      and lower(trim(existing.pos_name)) = lower(trim(d.pos_name))
  )
  on conflict (restaurant_id, pos_name) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function seed_default_pos_mappings from public;
grant execute on function seed_default_pos_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa kohdistukset heti
-- ---------------------------------------------------------------------------
--
-- Samassa transaktiossa kuin ryhmät. Kohdistukset kirjoitetaan
-- suoraan eikä seed-funktion kautta: funktio vaatii esihenkilöyden, ja
-- jäsenyys on juuri kirjoitettu — is_manager voisi lukea vanhaa tilaa
-- riippuen siitä milloin se näkee rivin.

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
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen. Vanhat ravintolat pitävät omansa, ja kirjatut
   * myyntirivit kantavat oman kantansa.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  /*
   * Kassaryhmien kohdistukset.
   *
   * Ilman näitä ensimmäinen päiväraportti menisi kokonaan
   * oletusryhmään ja olut kirjautuisi alennetulle kannalle.
   */
  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;
