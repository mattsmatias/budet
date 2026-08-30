-- ---------------------------------------------------------------------------
-- 0066 — Pöytävaraukset
-- ---------------------------------------------------------------------------
--
-- Ravintola hallitsee pöytiä ja varauksia Katessa. Asiakas varaa
-- ravintolan omalla verkkosivulla upotetun widgetin kautta. Asiakkaan ei
-- tarvitse tietää että taustalla on Kate, eikä hänen tarvitse luoda
-- tunnusta.
--
-- ---------------------------------------------------------------------------
-- 1. VARAUS EI OLE PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Varauksella on henkilömäärä ja aika; pöytä on erillinen liitos.
-- Sama varaus voi käyttää yhtä pöytää tai useaa yhdistettyä, ja
-- vuoropäällikkö voi vaihtaa pöydän illan aikana koskematta varaukseen.
-- Jos pöytä olisi sarake varauksessa, kuuden hengen seurue kahdessa
-- pöydässä ei mahtuisi tietomalliin lainkaan.
--
-- ---------------------------------------------------------------------------
-- 2. PÄÄLLEKKÄISYYS ON KANNAN ESTÄMÄ, EI SOVELLUKSEN
-- ---------------------------------------------------------------------------
--
-- reservation_table_assignments kantaa exclusion-rajoitetta: sama pöytä
-- ei voi olla kahdessa päällekkäisessä varauksessa. Rajoite ei ole
-- optimointi vaan viimeinen sana. Kaksi yhtäaikaista varausyritystä ei
-- voi molempi onnistua, vaikka sovelluskoodissa olisi vika — toinen
-- kaatuu rajoitteeseen.
--
-- Rajoitteen lisäksi varausfunktio ottaa neuvoa-antavan lukon
-- ravintolakohtaisesti. Ilman sitä molemmat yritykset etsisivät vapaan
-- pöydän samaan aikaan, päätyisivät samaan pöytään ja häviäjä saisi
-- rajoitevirheen sen sijaan että löytäisi seuraavan vapaan pöydän.
-- Lukko tekee haun ja kirjoituksen atomiseksi; rajoite varmistaa ettei
-- lukon unohtaminen riko mitään.
--
-- ---------------------------------------------------------------------------
-- 3. PERUTTU VARAUS EI VARAA PÖYTÄÄ MUTTA SÄILYY
-- ---------------------------------------------------------------------------
--
-- Liitosrivillä on blocking-lippu, ja exclusion-rajoite koskee vain
-- lipullisia rivejä. Peruutus laskee lipun eikä poista riviä: pöytä
-- vapautuu heti, mutta tieto siitä kuka oli varannut ja mihin pöytään
-- jää jäljelle. Rivin poistaminen veisi historian mukanaan.
--
-- ---------------------------------------------------------------------------
-- 4. ASIAKAS EI LUE TAULUJA
-- ---------------------------------------------------------------------------
--
-- Sama ratkaisu kuin julkisella lounaslistalla (0016): anon-roolille ei
-- anneta lukuoikeutta yhteenkään tauluun. Julkinen widget kutsuu neljää
-- security definer -funktiota, jotka palauttavat vain sen mitä varaamiseen
-- tarvitaan. Yksi tarkistettava rajapinta on tarkistettavissa; kymmenen
-- käytäntöä eri tauluissa ei.
--
-- Erityisesti: julkinen funktio ei koskaan ota restaurant_id:tä
-- parametrina vaan slugin, ja hakee tunnisteen itse. Clientin lähettämä
-- tunniste on clientin valitsema.
--
-- ---------------------------------------------------------------------------
-- 5. HENKILÖTIEDOT
-- ---------------------------------------------------------------------------
--
-- Kerätään nimi, puhelin ja valinnainen sähköposti — se mitä pöydän
-- varaamiseen tarvitaan, ei enempää. Taulun lukuoikeus on
-- esihenkilötasolla. Työntekijä näkee illan varaukset funktion kautta,
-- ja funktio jättää puhelimen ja sähköpostin pois jos kutsuja ei ole
-- esihenkilö. Sarakekohtaista rajausta ei saa rivikäytännöllä, joten se
-- tehdään siellä missä se on mahdollista.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type reservation_status as enum (
    'pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_source as enum ('widget', 'link', 'admin', 'walk_in');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Salin alueet
-- ---------------------------------------------------------------------------

create table if not exists dining_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists dining_areas_restaurant_idx
  on dining_areas (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Pöydät
-- ---------------------------------------------------------------------------

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Alue on valinnainen: pieni ravintola on yksi tila. */
  area_id uuid references dining_areas (id) on delete set null,

  /* "1", "12", "Ikkuna" — ravintolan oma merkintä, ei juokseva numero. */
  name text not null check (length(trim(name)) > 0),

  /*
   * Vähimmäis- ja enimmäiskapasiteetti.
   *
   * Vähimmäismäärä ei ole saivartelua: kahden hengen seurue neljän
   * hengen pöydässä lauantai-iltana tarkoittaa kahta menetettyä
   * paikkaa. Ravintola saa itse päättää sallitaanko se.
   */
  seats_min int not null default 1 check (seats_min >= 1),
  seats_max int not null check (seats_max >= 1),

  active boolean not null default true,

  /* Pöytäkartan sijainti prosentteina salin leveydestä ja korkeudesta. */
  pos_x numeric(5, 2) check (pos_x is null or (pos_x >= 0 and pos_x <= 100)),
  pos_y numeric(5, 2) check (pos_y is null or (pos_y >= 0 and pos_y <= 100)),

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurant_tables_seats check (seats_max >= seats_min),
  unique (restaurant_id, name)
);

create index if not exists restaurant_tables_restaurant_idx
  on restaurant_tables (restaurant_id, sort_order);
create index if not exists restaurant_tables_area_idx
  on restaurant_tables (area_id);

-- ---------------------------------------------------------------------------
-- Pöytien yhdistelmät
-- ---------------------------------------------------------------------------
--
-- YHDISTELMÄT MÄÄRITELLÄÄN, NIITÄ EI PÄÄTELLÄ.
--
-- Järjestelmä ei tiedä mitkä pöydät ovat vierekkäin, mitkä niistä
-- voi siirtää yhteen ja mitkä ovat eri puolilla salia. Automaattinen
-- yhdistely varaisi kuuden hengen seurueen kahteen pöytään joiden
-- välissä on baaritiski. Ravintola kertoo mitkä yhdistelmät ovat
-- oikeasti mahdollisia.

create table if not exists table_combinations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Vapaaehtoinen nimi. Ilman sitä käyttöliittymä listaa pöytien nimet. */
  name text,

  /*
   * Yhdistelmän kapasiteetti erikseen, ei jäsenten summana.
   *
   * Kaksi kahden hengen pöytää yhteen on neljä paikkaa vain jos
   * päädyt käyvät. Usein yhdistetty pöytä vetää vähemmän kuin osiensa
   * summan, joskus enemmän. Ravintola tietää, laskutoimitus ei.
   */
  seats_min int not null check (seats_min >= 1),
  seats_max int not null check (seats_max >= 1),

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint table_combinations_seats check (seats_max >= seats_min)
);

create index if not exists table_combinations_restaurant_idx
  on table_combinations (restaurant_id) where active;

create table if not exists table_combination_members (
  combination_id uuid not null references table_combinations (id) on delete cascade,
  table_id uuid not null references restaurant_tables (id) on delete cascade,
  primary key (combination_id, table_id)
);

create index if not exists table_combination_members_table_idx
  on table_combination_members (table_id);

-- ---------------------------------------------------------------------------
-- Varausasetukset
-- ---------------------------------------------------------------------------

create table if not exists reservation_settings (
  restaurant_id uuid primary key references restaurants (id) on delete cascade,

  /* Otetaanko varauksia vastaan lainkaan. */
  enabled boolean not null default false,

  /* Aikaväli minuutteina: 15 tai 30 on tavallinen. */
  slot_minutes int not null default 30
    check (slot_minutes in (15, 20, 30, 60)),

  /* Oletuskesto kun henkilömäärälle ei ole omaa sääntöä. */
  default_duration_minutes int not null default 90
    check (default_duration_minutes between 15 and 600),

  /*
   * Pöydän tyhjennysväli.
   *
   * Varauksen jälkeen pöytä ei ole heti seuraavan käytettävissä. Sama
   * luku antaa pöytäkartalle "siivottavana"-tilan ilman omaa saraketta:
   * pöytä jonka varaus päättyi äsken on tässä tilassa.
   */
  turnaround_minutes int not null default 0
    check (turnaround_minutes between 0 and 120),

  min_party int not null default 1 check (min_party >= 1),
  max_party int not null default 12 check (max_party >= 1),

  /* Kuinka monta päivää eteenpäin varauksia otetaan. */
  max_days_ahead int not null default 60 check (max_days_ahead between 1 and 365),

  /*
   * Kuinka monta minuuttia ennen alkua varaus on vielä mahdollinen.
   *
   * Nolla tarkoittaisi että asiakas voi varata pöydän kello 19:00
   * kello 18:59, eikä keittiö ehdi tietää siitä.
   */
  lead_minutes int not null default 60 check (lead_minutes between 0 and 10080),

  /* Widgetin ulkoasu. Vain se mitä ravintolan ilme oikeasti vaatii. */
  theme_color text not null default '#1f6f5c'
    check (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  theme_dark boolean not null default false,
  theme_radius int not null default 12 check (theme_radius between 0 and 28),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservation_settings_party check (max_party >= min_party)
);

-- ---------------------------------------------------------------------------
-- Kesto henkilömäärän mukaan
-- ---------------------------------------------------------------------------
--
-- Kahden hengen illallinen ei kestä yhtä kauan kuin kuuden. Sääntöjä
-- voi olla nolla, jolloin oletuskesto pätee kaikkiin.

create table if not exists reservation_durations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  min_party int not null check (min_party >= 1),
  /* Null = ylin porras: "7 tai enemmän". */
  max_party int check (max_party is null or max_party >= 1),
  minutes int not null check (minutes between 15 and 600),
  created_at timestamptz not null default now(),

  constraint reservation_durations_range
    check (max_party is null or max_party >= min_party)
);

create index if not exists reservation_durations_lookup
  on reservation_durations (restaurant_id, min_party);

-- ---------------------------------------------------------------------------
-- Aukioloajat
-- ---------------------------------------------------------------------------
--
-- Viikonpäivä 1 = maanantai, 7 = sunnuntai. Sama numerointi kuin
-- ISO-standardissa ja kannan muissa taulukoissa.
--
-- Päivä jolta rivi puuttuu on kiinni. Rivejä voi olla kaksi samalle
-- päivälle: lounas ja illallinen erikseen.

create table if not exists reservation_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  opens time not null,
  /* Viimeinen aika johon voi varata, ei sulkemisaika. */
  last_seating time not null,
  created_at timestamptz not null default now(),

  constraint reservation_hours_order check (last_seating > opens)
);

create index if not exists reservation_hours_lookup
  on reservation_hours (restaurant_id, weekday);

-- ---------------------------------------------------------------------------
-- Poikkeukset
-- ---------------------------------------------------------------------------

create table if not exists reservation_exceptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  exception_date date not null,

  /* Suljettu kokonaan, tai poikkeavat ajat. */
  closed boolean not null default true,
  opens time,
  last_seating time,

  note text,
  created_at timestamptz not null default now(),

  unique (restaurant_id, exception_date),
  constraint reservation_exceptions_hours check (
    closed or (opens is not null and last_seating is not null and last_seating > opens)
  )
);

-- ---------------------------------------------------------------------------
-- Varaukset
-- ---------------------------------------------------------------------------

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Aika on timestamptz, ei date + time.
   *
   * Päällekkäisyys lasketaan aikaväleinä, ja aikaväli joka ylittää
   * kesäajan vaihdoksen on väärä jos se on tallennettu paikallisena
   * kellonaikana. Näyttö muuntaa takaisin ravintolan vyöhykkeelle.
   */
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  party_size int not null check (party_size >= 1),
  status reservation_status not null default 'confirmed',
  source reservation_source not null default 'admin',

  /*
   * Vain se mitä pöydän varaamiseen tarvitaan.
   *
   * Pituusrajat ovat kannassa eivätkä vain lomakkeessa. Julkinen
   * rajapinta ottaa vastaan mitä tahansa, ja megatavun mittainen
   * "nimi" on hyökkäys eikä kirjoitusvirhe.
   */
  guest_name text not null
    check (length(trim(guest_name)) > 0 and length(guest_name) <= 120),
  guest_phone text check (guest_phone is null or length(guest_phone) <= 40),
  guest_email text check (guest_email is null or length(guest_email) <= 160),
  note text check (note is null or length(note) <= 500),

  /*
   * Peruutuslinkin tunniste tiivisteenä.
   *
   * Sama ratkaisu kuin kutsukoodeissa (0009): kannassa on vain
   * tiiviste, joten vuotanut varmuuskopio ei anna kenellekään oikeutta
   * perua toisen varausta. sha256 on pg_catalogissa eikä vaadi
   * pgcryptoa, joka Supabasessa asuu eri skeemassa.
   */
  cancel_token_hash text,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_times check (ends_at > starts_at)
);

create index if not exists reservations_lookup
  on reservations (restaurant_id, starts_at);
create index if not exists reservations_status_idx
  on reservations (restaurant_id, status, starts_at);
create unique index if not exists reservations_cancel_token
  on reservations (cancel_token_hash) where cancel_token_hash is not null;

-- ---------------------------------------------------------------------------
-- Pöytien liitos varaukseen
-- ---------------------------------------------------------------------------

create table if not exists reservation_table_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  table_id uuid not null references restaurant_tables (id) on delete cascade,

  /*
   * Aika toistetaan liitosriville.
   *
   * Exclusion-rajoite tarvitsee aikavälin samalta riviltä; se ei voi
   * lukea sitä toisesta taulusta. Kaksoiskappale on tässä tarkoitettu,
   * ja liipaisin pitää sen ajan tasalla kun varauksen aika muuttuu.
   */
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  /*
   * Varaako tämä rivi pöydän juuri nyt?
   *
   * Peruttu ja toteutunut varaus säilyttävät rivinsä mutta laskevat
   * lipun, jolloin pöytä vapautuu. Exclusion-rajoite koskee vain
   * lipullisia rivejä.
   */
  blocking boolean not null default true,

  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  created_at timestamptz not null default now(),

  constraint reservation_assignments_times check (ends_at > starts_at),
  unique (reservation_id, table_id),

  /*
   * SAMA PÖYTÄ EI VOI OLLA KAHDESSA PÄÄLLEKKÄISESSÄ VARAUKSESSA.
   *
   * Tämä on koko ominaisuuden tärkein rivi. Kaikki muu — saatavuuden
   * laskenta, neuvoa-antavat lukot, käyttöliittymän tarkistukset — on
   * käytettävyyttä. Tämä on se joka pitää, vaikka muu pettäisi.
   */
  constraint reservation_assignments_no_overlap
    exclude using gist (table_id with =, during with &&) where (blocking)
);

create index if not exists reservation_assignments_reservation_idx
  on reservation_table_assignments (reservation_id);
create index if not exists reservation_assignments_table_idx
  on reservation_table_assignments (table_id, starts_at);

-- ---------------------------------------------------------------------------
-- Tilahistoria
-- ---------------------------------------------------------------------------

create table if not exists reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  from_status reservation_status,
  to_status reservation_status not null,
  actor_id uuid references profiles (id) on delete set null,
  actor_name text not null default 'Tuntematon',
  created_at timestamptz not null default now()
);

create index if not exists reservation_status_history_idx
  on reservation_status_history (reservation_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'dining_areas', 'restaurant_tables', 'table_combinations',
    'reservation_settings', 'reservations'
  ] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function touch_updated_at()', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Liitosrivin aika seuraa varausta
-- ---------------------------------------------------------------------------
--
-- Kun varauksen aikaa siirretään, liitosrivien on siirryttävä mukana.
-- Ilman tätä exclusion-rajoite vartioisi vanhaa aikaa ja pöytä
-- näyttäisi varatulta väärään aikaan.

create or replace function sync_reservation_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.status is distinct from old.status
  then
    update reservation_table_assignments
    set starts_at = new.starts_at,
        ends_at = new.ends_at,
        blocking = new.status in ('pending', 'confirmed', 'arrived')
    where reservation_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_sync_assignments on reservations;
create trigger reservations_sync_assignments after update on reservations
  for each row execute function sync_reservation_assignments();

-- ---------------------------------------------------------------------------
-- Tilan muutos historiaan
-- ---------------------------------------------------------------------------

create or replace function log_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name from profiles p where p.id = auth.uid();

  insert into reservation_status_history
    (reservation_id, from_status, to_status, actor_id, actor_name)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    auth.uid(),
    coalesce(v_name, 'Asiakas')
  );

  return new;
end;
$$;

drop trigger if exists reservations_status_history on reservations;
create trigger reservations_status_history after insert or update on reservations
  for each row execute function log_reservation_status();

/*
 * Liipaisinfunktioita ei kutsuta käsin.
 *
 * Postgres kieltäytyy suorasta kutsusta joka tapauksessa, mutta
 * suoritusoikeus jota kukaan ei tarvitse on oikeus jota ei pidä
 * antaa. Molemmat ovat security definer, joten oletusoikeuden
 * jättäminen paikalleen olisi turhaa pinta-alaa.
 */
revoke all on function sync_reservation_assignments from public, anon, authenticated;
revoke all on function log_reservation_status from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- Pöydät, alueet ja asetukset: kaikki ravintolan jäsenet lukevat,
-- esihenkilö kirjoittaa. Pöytäkartta on työkalu salissa, ei salaisuus.
--
-- Varaukset: esihenkilö lukee taulusta suoraan. Työntekijä lukee
-- funktion kautta, joka jättää yhteystiedot pois. Kirjanpitäjä ei näe
-- varauksia lainkaan — ne eivät ole taloustietoa.

alter table dining_areas enable row level security;
alter table restaurant_tables enable row level security;
alter table table_combinations enable row level security;
alter table table_combination_members enable row level security;
alter table reservation_settings enable row level security;
alter table reservation_durations enable row level security;
alter table reservation_hours enable row level security;
alter table reservation_exceptions enable row level security;
alter table reservations enable row level security;
alter table reservation_table_assignments enable row level security;
alter table reservation_status_history enable row level security;

-- dining_areas
drop policy if exists dining_areas_read on dining_areas;
create policy dining_areas_read on dining_areas
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists dining_areas_write on dining_areas;
create policy dining_areas_write on dining_areas
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- restaurant_tables
drop policy if exists restaurant_tables_read on restaurant_tables;
create policy restaurant_tables_read on restaurant_tables
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists restaurant_tables_write on restaurant_tables;
create policy restaurant_tables_write on restaurant_tables
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- table_combinations
drop policy if exists table_combinations_read on table_combinations;
create policy table_combinations_read on table_combinations
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists table_combinations_write on table_combinations;
create policy table_combinations_write on table_combinations
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- table_combination_members: oikeus periytyy yhdistelmältä
drop policy if exists table_combination_members_read on table_combination_members;
create policy table_combination_members_read on table_combination_members
  for select to authenticated
  using (exists (
    select 1 from table_combinations c
    where c.id = combination_id
      and c.restaurant_id in (select my_restaurant_ids())
  ));

drop policy if exists table_combination_members_write on table_combination_members;
create policy table_combination_members_write on table_combination_members
  for all to authenticated
  using (exists (
    select 1 from table_combinations c
    where c.id = combination_id and is_manager(c.restaurant_id)
  ))
  with check (exists (
    select 1 from table_combinations c
    where c.id = combination_id and is_manager(c.restaurant_id)
  ));

-- reservation_settings
drop policy if exists reservation_settings_read on reservation_settings;
create policy reservation_settings_read on reservation_settings
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists reservation_settings_write on reservation_settings;
create policy reservation_settings_write on reservation_settings
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- reservation_durations / hours / exceptions: sama linja
do $$
declare t text;
begin
  foreach t in array array[
    'reservation_durations', 'reservation_hours', 'reservation_exceptions'
  ] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format(
      'create policy %I_read on %I for select to authenticated
       using (restaurant_id in (select my_restaurant_ids()))', t, t
    );
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format(
      'create policy %I_write on %I for all to authenticated
       using (is_manager(restaurant_id))
       with check (is_manager(restaurant_id))', t, t
    );
  end loop;
end $$;

-- reservations: esihenkilö
drop policy if exists reservations_read on reservations;
create policy reservations_read on reservations
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists reservations_write on reservations;
create policy reservations_write on reservations
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- reservation_table_assignments: oikeus periytyy varaukselta
drop policy if exists reservation_assignments_read on reservation_table_assignments;
create policy reservation_assignments_read on reservation_table_assignments
  for select to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

drop policy if exists reservation_assignments_write on reservation_table_assignments;
create policy reservation_assignments_write on reservation_table_assignments
  for all to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ))
  with check (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

-- reservation_status_history: vain luku, kirjoitus liipaisimesta
drop policy if exists reservation_status_history_read on reservation_status_history;
create policy reservation_status_history_read on reservation_status_history
  for select to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

revoke insert, update, delete on reservation_status_history from authenticated;

-- ---------------------------------------------------------------------------
-- Anonilta viedään taulut kokonaan
-- ---------------------------------------------------------------------------
--
-- Supabase myöntää oletusarvoisesti anon-roolille kaikki oikeudet
-- jokaiseen uuteen public-skeeman tauluun. Rivitason käytännöt estävät
-- pääsyn, koska anonille ei ole yhtään käytäntöä — mutta se on yhden
-- huolimattoman "for all to public" -käytännön päässä siitä ettei estä.
--
-- Käytäntö on suodatin, oikeus on ovi. Kun ovi on kiinni, suodattimen
-- virhe ei päästä ketään sisään. Julkinen widget ei tarvitse tauluja:
-- se kutsuu public_-funktioita, jotka ovat security definer.
--
-- Sama ratkaisu kuin memberships-taulussa, josta lukuoikeus on
-- viety anonilta jo aiemmin.

do $$
declare t text;
begin
  foreach t in array array[
    'dining_areas', 'restaurant_tables', 'table_combinations',
    'table_combination_members', 'reservation_settings',
    'reservation_durations', 'reservation_hours', 'reservation_exceptions',
    'reservations', 'reservation_table_assignments', 'reservation_status_history'
  ] loop
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;
