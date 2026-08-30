-- ---------------------------------------------------------------------------
-- 0071 — Tiedostot: ravintolan oma dokumenttikaappi
-- ---------------------------------------------------------------------------
--
-- Ravintola säilyttää Katessa sopimukset, kuitit, myyntiraportit,
-- vakuutukset, viranomaisasiakirjat ja työsopimukset — kaiken sen mitä
-- muuten on kolmessa sähköpostilaatikossa ja yhdessä mapissa.
--
-- ---------------------------------------------------------------------------
-- 1. KÄYTTÄJÄ OMISTAA RAKENTEEN
-- ---------------------------------------------------------------------------
--
-- Kate luo lähtökansiot mutta ei omista niitä. Kansiolla ei ole tyyppiä
-- eikä tarkoitusta: se on nimi ja paikka puussa. Tiedostolla ei ole
-- kansiosidonnaista tyyppiä — mikä tahansa tiedosto saa olla missä
-- tahansa kansiossa.
--
-- Tämä on tietoinen rajaus. Jos kansiolla olisi tyyppi, jokainen
-- ravintola joutuisi sovittamaan oman järjestyksensä Katen malliin.
-- Yksi käyttää vuosia, toinen aihepiirejä, kolmas yhtä kansiota
-- kaikelle. Kaikkien on toimittava, eikä yhdenkään tarvitse selittää
-- itseään tietokannalle.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI OMA BUCKET EIKÄ documents
-- ---------------------------------------------------------------------------
--
-- Kannassa on jo documents-bucket, mutta se kuuluu toiseen
-- vuokralaisuusmalliin: sen käytännöt kysyvät
-- current_user_accessible_org_ids(), eli organisaatiota. Kate on
-- ravintolapohjainen ja käyttää my_restaurant_ids()- ja
-- is_manager()-funktioita, kuten receipts ja social.
--
-- Näiden sekoittaminen samaan bucketiin tarkoittaisi kahta rinnakkaista
-- eristyssääntöä samoille objekteille, ja niiden erot löytyisivät vasta
-- kun jompikumpi pettää. Uusi bucket noudattaa Katen omaa mallia
-- sellaisenaan.
--
-- ---------------------------------------------------------------------------
-- 3. KANSIO EI OLE TIEDOSTOPOLUSSA
-- ---------------------------------------------------------------------------
--
-- Polku on {restaurantId}/{fileId}. Kansio on sarake kannassa, ei osa
-- polkua.
--
-- Jos kansio olisi polussa, tiedoston siirto olisi storage-kopio ja
-- -poisto, siis kaksi verkkokutsua jotka voivat epäonnistua erikseen ja
-- jättää kannan ja storagen eri mieltä siitä missä tiedosto on. Nyt
-- siirto on yhden sarakkeen päivitys, joka joko tapahtuu tai ei.
--
-- Ensimmäinen polkuosa on ravintolan tunniste, koska storage-käytännöt
-- lukevat eristyksen juuri siitä — sama kuin receipts- ja
-- social-bucketeissa.
--
-- ---------------------------------------------------------------------------
-- 4. JUURI ON NULL, EI KANSIO
-- ---------------------------------------------------------------------------
--
-- Ylimmällä tasolla olevan kansion parent_folder_id on null, ja
-- kansioimattoman tiedoston folder_id on null. Näkymätön juurikansio
-- rivinä olisi tila jota jokainen kysely joutuisi kiertämään ja jonka
-- käyttäjä voisi vahingossa nimetä uudelleen tai poistaa.

-- ---------------------------------------------------------------------------
-- Kansiot
-- ---------------------------------------------------------------------------

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Alikansio katoaa emonsa mukana.
   *
   * Vaihtoehto olisi jättää alikansiot orvoiksi juureen, mutta silloin
   * yhden kansion poisto sirottelisi sen sisällön ylätasolle. Kansion
   * poisto on tarkoituksellinen teko, ja funktio kysyy erikseen mitä
   * tiedostoille tehdään.
   */
  parent_folder_id uuid references folders (id) on delete cascade,

  name text not null,
  sort_order integer not null default 0,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint folders_name_not_empty check (length(btrim(name)) > 0),

  /*
   * Nimen pituus on tekninen raja, ei tyylisääntö.
   *
   * Käyttäjä saa nimetä kansion miten haluaa. Sata kahtakymmentä
   * merkkiä pidempi nimi ei kuitenkaan mahdu mihinkään näkymään, eikä
   * sitä kirjoiteta vahingossa.
   */
  constraint folders_name_length check (length(name) <= 120),

  /* Kansio ei voi olla oma emonsa. Syvemmät silmukat estää funktio. */
  constraint folders_no_self_parent check (parent_folder_id is distinct from id)
);

/*
 * Sama nimi samassa paikassa kahdesti on virhe, ei rakenne.
 *
 * Kaksi "2026"-kansiota vierekkäin ei kerro käyttäjälle mitään, ja
 * tiedosto katoaa väärään. Eri kansioissa sama nimi on tietysti
 * sallittu — juuri siksi kansioita on.
 *
 * Kaksi indeksiä, koska null ei ole yhtä suuri kuin null: yksi
 * indeksi ei estäisi kahta samannimistä juurikansiota.
 */
create unique index if not exists folders_unique_name_in_parent
  on folders (restaurant_id, parent_folder_id, lower(btrim(name)))
  where parent_folder_id is not null;

create unique index if not exists folders_unique_name_in_root
  on folders (restaurant_id, lower(btrim(name)))
  where parent_folder_id is null;

create index if not exists folders_by_parent
  on folders (restaurant_id, parent_folder_id, sort_order, name);

-- ---------------------------------------------------------------------------
-- Tiedostot
-- ---------------------------------------------------------------------------

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Kansion poisto ei hävitä tiedostoa.
   *
   * set null siirtää tiedoston juureen. Tiedoston hävittäminen on
   * erillinen, tarkoituksellinen teko — kansion poisto ei saa olla
   * tapa menettää vuokrasopimusta vahingossa.
   */
  folder_id uuid references folders (id) on delete set null,

  /* Käyttäjälle näkyvä nimi. Storagessa oleva nimi on tunniste. */
  file_name text not null,
  storage_path text not null unique,

  /*
   * Tiedostotyyppi on tieto, ei sääntö.
   *
   * Kenttää käytetään kuvakkeen ja lajittelun valintaan. Se ei rajaa
   * mihin kansioon tiedosto saa mennä — kuitti kelpaa Talous-kansioon
   * ja myyntiraportti Kuitit-kansioon, jos ravintola niin haluaa.
   */
  file_type text not null,
  file_size bigint not null,

  uploaded_by uuid references profiles (id) on delete set null,
  is_favorite boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint files_name_not_empty check (length(btrim(file_name)) > 0),
  constraint files_name_length check (length(file_name) <= 200),
  constraint files_size_positive check (file_size > 0)
);

create index if not exists files_by_folder
  on files (restaurant_id, folder_id, created_at desc);

create index if not exists files_recent
  on files (restaurant_id, created_at desc);

create index if not exists files_favorites
  on files (restaurant_id, created_at desc)
  where is_favorite;

/*
 * Haku nimen osalla.
 *
 * trigram-indeksi vastaa ilike '%osa%' -hakuun, jota tavallinen
 * b-puu ei osaa. Ravintolan tiedostomäärä on pieni, mutta haku on
 * näkymä jota käytetään kirjoittaessa — jokainen näppäily on kysely.
 */
create extension if not exists pg_trgm;

create index if not exists files_name_search
  on files using gin (lower(file_name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Muokkausaika
-- ---------------------------------------------------------------------------
--
-- touch_updated_at on 0001:stä. Sama liipaisin on kolmisenkymmenellä
-- taululla, eikä tähän tarvita omaa.

drop trigger if exists folders_touch on folders;
create trigger folders_touch before update on folders
  for each row execute function touch_updated_at();

drop trigger if exists files_touch on files;
create trigger files_touch before update on files
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rivitason käytännöt
-- ---------------------------------------------------------------------------
--
-- Luku omistajalle, esihenkilölle ja kirjanpitäjälle; kirjoitus
-- esihenkilölle.
--
-- Raja EI ole my_restaurant_ids(), vaikka se on Katessa tavallisin.
-- Se kattaa myös työntekijät, ja tässä kaapissa on työsopimuksia ja
-- palkkalaskelmia. Käyttöliittymä piilottaa sivun työntekijältä, mutta
-- se ei ole este: kirjautuneella on voimassa oleva istunto, ja
-- rajapintaa voi kutsua ilman käyttöliittymää.
--
-- can_read_finance() on täsmälleen oikea joukko — omistaja,
-- esihenkilö ja kirjanpitäjä — ja sama joukko kuin files.view
-- sovelluksen puolella. Kannan ja roolitaulukon on oltava samaa
-- mieltä, tai toinen niistä on väärässä eikä kukaan huomaa kumpi.
--
-- Kirjoituskäytännöt ovat olemassa vaikka sovellus kulkee funktioiden
-- kautta. Käytäntö on viimeinen sana; funktio on käyttöliittymä sille.

alter table folders enable row level security;
alter table files enable row level security;

/*
 * Oikeudet pois anonilta.
 *
 * Supabase myöntää anon-roolille kaikki oikeudet jokaiseen uuteen
 * public-skeeman tauluun. RLS on suodatin, mutta oikeuksien
 * peruuttaminen on ovi — ja näissä tauluissa on työsopimuksia ja
 * palkkadokumentteja.
 */
revoke all on table folders from anon;
revoke all on table files from anon;

drop policy if exists folders_read on folders;
create policy folders_read on folders
  for select using (can_read_finance(restaurant_id));

drop policy if exists folders_write on folders;
create policy folders_write on folders
  for all using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists files_read on files;
create policy files_read on files
  for select using (can_read_finance(restaurant_id));

drop policy if exists files_write on files;
create policy files_write on files
  for all using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- Yksityinen bucket. Tiedostot luetaan allekirjoitetuilla osoitteilla,
-- kuten kuitit — julkinen linkki ravintolan vuokrasopimukseen olisi
-- pysyvästi julkinen kenelle tahansa jolle se päätyy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,

  /*
   * 25 megatavua.
   *
   * Kuitit ja documents ovat kahdessakymmenessä, mutta ne ovat kuvia ja
   * PDF:iä. Tänne tulee myös Excel-tiedostoja, joissa on vuoden
   * myyntirivit. Raja on siellä missä se estää vahingon eikä työtä.
   */
  26214400,

  /*
   * Sallitut tyypit.
   *
   * Storage tarkistaa nämä riippumatta siitä mitä sovellus lähettää.
   * Suoritettavat tiedostot puuttuvat tarkoituksella: ravintolan
   * dokumenttikaappi ei ole paikka jakaa ohjelmia.
   */
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

/*
 * Eristys luetaan polun ensimmäisestä osasta.
 *
 * Sama kuvio kuin receipts- ja social-bucketeissa. Polku on
 * {restaurantId}/{fileId}, joten foldername(name)[1] on ravintola.
 */
drop policy if exists files_storage_read on storage.objects;
create policy files_storage_read on storage.objects
  for select using (
    bucket_id = 'files'
    and can_read_finance(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_write on storage.objects;
create policy files_storage_write on storage.objects
  for insert with check (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_update on storage.objects;
create policy files_storage_update on storage.objects
  for update using (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_delete on storage.objects;
create policy files_storage_delete on storage.objects
  for delete using (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );
