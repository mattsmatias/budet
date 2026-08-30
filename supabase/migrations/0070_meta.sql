-- ---------------------------------------------------------------------------
-- 0070 — Facebook- ja Instagram-julkaisu
-- ---------------------------------------------------------------------------
--
-- Ravintola yhdistää Facebook-sivunsa Kateen kerran, ja sen jälkeen
-- valmis lounaslista menee molempiin yhdellä painalluksella.
--
-- ---------------------------------------------------------------------------
-- 1. TOKENI ON OMASSA TAULUSSAAN ILMAN YHTÄÄN KÄYTÄNTÖÄ
-- ---------------------------------------------------------------------------
--
-- Facebookin sivutokeni on avain ravintolan Facebook-sivuun. Sillä voi
-- julkaista, muokata ja poistaa — se on arvokkaampi kuin mikään muu
-- rivi tässä kannassa.
--
-- Siksi se ei ole meta_connections-taulussa muiden kenttien seassa.
-- Rivitason käytäntö ei osaa piilottaa saraketta, joten yksi
-- huolimaton `select *` yhdessä kyselyssä riittäisi lähettämään sen
-- selaimeen. Erillisessä taulussa jolla EI OLE YHTÄÄN KÄYTÄNTÖÄ sitä
-- ei voi lukea millään kyselyllä: ainoa tie on security definer
-- -funktio joka tarkistaa esihenkilöyden.
--
-- Lisäksi tokeni on salattu jo ennen kantaan tuloa (AES-256-GCM,
-- avain META_TOKEN_KEY). Kanta ei siis näe sitä selkokielisenä
-- missään vaiheessa, eikä vuotanut varmuuskopio riitä julkaisemaan
-- kenenkään sivulle.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI SIVUTOKENI EIKÄ KÄYTTÄJÄTOKENI
-- ---------------------------------------------------------------------------
--
-- Metan pitkäikäinen käyttäjätokeni vanhenee 60 päivässä. Siitä
-- johdettu sivutokeni ei vanhene lainkaan, ja se on se jolla
-- julkaistaan. Ravintoloitsijan ei siis tarvitse kirjautua uudelleen
-- kahden kuukauden välein — mikä olisi juuri se kohta jossa
-- ominaisuus lakkaisi käytännössä toimimasta.
--
-- token_expires_at on silti olemassa: sivutokeni voi vanhentua
-- ennenaikaisesti jos käyttäjä vaihtaa salasanan tai poistaa
-- sovelluksen oikeudet. Silloin kenttä täytetään ja tila vaihtuu.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type meta_connection_status as enum (
    'connected',
    /* Tokeni ei enää kelpaa: käyttäjä perui oikeudet tai vaihtoi salasanan. */
    'expired',
    /* Käyttäjä katkaisi yhteyden Katesta. Rivi jää historiaa varten. */
    'disconnected',
    /* Yhteys on olemassa muttei julkaisukelpoinen — esim. IG puuttuu. */
    'incomplete'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type meta_publish_status as enum (
    /* Kanavaa ei valittu tähän julkaisuun. */
    'skipped',
    'pending',
    'ok',
    'failed'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Yhteys
-- ---------------------------------------------------------------------------

create table if not exists meta_connections (
  /*
   * Yksi yhteys per ravintola.
   *
   * Ravintolalla on yksi Facebook-sivu ja yksi Instagram-tili. Monta
   * sivua olisi ketju jota kukaan ei pyytänyt, ja se tekisi
   * julkaisunäkymästä valintalistan.
   */
  restaurant_id uuid primary key references restaurants (id) on delete cascade,

  /* Metan sovelluskohtainen käyttäjätunniste. Ei henkilötieto sinänsä. */
  meta_user_id text,

  page_id text not null,
  page_name text not null,

  /* Instagram on valinnainen: Facebook toimii ilmankin. */
  instagram_id text,
  instagram_username text,

  /*
   * Myönnetyt oikeudet sellaisina kuin Meta ne palautti.
   *
   * Käyttäjä voi hyväksyä osan ja kieltää osan. Tallennettuna
   * tiedämme ennen julkaisua mikä puuttuu, eikä virhe tule vasta
   * Metan vastauksessa.
   */
  scopes text[] not null default '{}',

  status meta_connection_status not null default 'connected',
  /* Miksi tila on muu kuin connected. Näytetään käyttäjälle. */
  status_detail text,

  token_expires_at timestamptz,

  connected_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tokeni
-- ---------------------------------------------------------------------------

create table if not exists meta_tokens (
  restaurant_id uuid primary key
    references meta_connections (restaurant_id) on delete cascade,

  /*
   * Salattu sivutokeni: base64(iv | tag | ciphertext), AES-256-GCM.
   *
   * Sovellus salaa ennen kirjoitusta ja purkaa vain julkaistessaan.
   * Avain on ympäristömuuttujassa eikä kannassa, joten kanta ja avain
   * eivät vuoda yhdessä.
   */
  page_token text not null,

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Julkaisut
-- ---------------------------------------------------------------------------

create table if not exists meta_publications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Mikä lounaslista julkaistiin.
   *
   * on delete set null: julkaisu on tapahtunut vaikka viikko
   * poistettaisiin. Historia ei saa kadota kohteensa mukana — sama
   * linja kuin toimintalokilla.
   */
  menu_id uuid references lunch_menus (id) on delete set null,
  week_start date,

  facebook_status meta_publish_status not null default 'skipped',
  facebook_post_id text,
  facebook_error text,

  instagram_status meta_publish_status not null default 'skipped',
  instagram_post_id text,
  instagram_error text,

  /* Julkaistu teksti sellaisenaan. Lounaslista voi muuttua jälkikäteen. */
  message text not null,
  image_path text,

  published_by uuid references profiles (id) on delete set null,
  published_by_name text not null default 'Tuntematon',
  created_at timestamptz not null default now()
);

create index if not exists meta_publications_lookup
  on meta_publications (restaurant_id, created_at desc);
create index if not exists meta_publications_menu
  on meta_publications (menu_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['meta_connections', 'meta_tokens'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function touch_updated_at()', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table meta_connections enable row level security;
alter table meta_tokens enable row level security;
alter table meta_publications enable row level security;

/*
 * Yhteys: esihenkilö lukee ja hallitsee oman ravintolansa.
 *
 * Työntekijä ei näe tätä lainkaan. Sosiaalisen median tili on
 * ravintolan hallintaa eikä salityötä.
 */
drop policy if exists meta_connections_read on meta_connections;
create policy meta_connections_read on meta_connections
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists meta_connections_write on meta_connections;
create policy meta_connections_write on meta_connections
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

/*
 * TOKENITAULULLA EI OLE YHTÄÄN KÄYTÄNTÖÄ.
 *
 * Se ei ole unohdus. RLS on päällä ja käytäntöjä on nolla, joten
 * authenticated ei voi lukea, kirjoittaa eikä poistaa yhtään riviä
 * millään kyselyllä. Ainoa tie sisään on alempana olevat security
 * definer -funktiot, jotka tarkistavat esihenkilöyden itse.
 *
 * Oikeudet viedään lisäksi kokonaan: Supabase myöntää ne
 * oletusarvoisesti jokaiseen uuteen tauluun, ja käytäntö on suodatin
 * siinä missä oikeus on ovi.
 */
revoke all on meta_tokens from anon, authenticated;

/* Julkaisuhistoria: esihenkilö lukee, kirjoitus vain funktion kautta. */
drop policy if exists meta_publications_read on meta_publications;
create policy meta_publications_read on meta_publications
  for select to authenticated
  using (is_manager(restaurant_id));

revoke insert, update, delete on meta_publications from authenticated;

/* Anonille ei mitään näistä. */
revoke all on meta_connections from anon;
revoke all on meta_publications from anon;

-- ---------------------------------------------------------------------------
-- Yhteyden tallennus
-- ---------------------------------------------------------------------------

/**
 * Yhteys ja tokeni yhdessä transaktiossa.
 *
 * Erillisinä kutsuina yhteys voisi jäädä ilman tokenia tai päinvastoin,
 * ja kumpikin puolikas näyttäisi ulospäin toimivalta yhteydeltä.
 */
create or replace function meta_save_connection(
  p_restaurant uuid,
  p_meta_user_id text,
  p_page_id text,
  p_page_name text,
  p_instagram_id text,
  p_instagram_username text,
  p_scopes text[],
  p_token text,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  insert into meta_connections (
    restaurant_id, meta_user_id, page_id, page_name,
    instagram_id, instagram_username, scopes,
    status, status_detail, token_expires_at, connected_by
  )
  values (
    p_restaurant, p_meta_user_id, p_page_id, p_page_name,
    nullif(p_instagram_id, ''), nullif(p_instagram_username, ''), p_scopes,
    /*
     * Ilman Instagramia yhteys on epätäydellinen muttei rikki:
     * Facebook toimii, ja käyttäjälle kerrotaan mikä puuttuu.
     */
    case when nullif(p_instagram_id, '') is null
         then 'incomplete'::meta_connection_status
         else 'connected'::meta_connection_status end,
    null,
    p_expires_at,
    auth.uid()
  )
  on conflict (restaurant_id) do update set
    meta_user_id = excluded.meta_user_id,
    page_id = excluded.page_id,
    page_name = excluded.page_name,
    instagram_id = excluded.instagram_id,
    instagram_username = excluded.instagram_username,
    scopes = excluded.scopes,
    status = excluded.status,
    status_detail = null,
    token_expires_at = excluded.token_expires_at,
    connected_by = excluded.connected_by;

  insert into meta_tokens (restaurant_id, page_token)
  values (p_restaurant, p_token)
  on conflict (restaurant_id) do update set page_token = excluded.page_token;

  perform write_audit(
    p_restaurant, 'meta.connect', 'meta_connection', null, p_page_name,
    'Yhdisti Facebook-sivun: ' || p_page_name
      || coalesce(' · Instagram @' || nullif(p_instagram_username, ''), ''),
    null, jsonb_build_object('page_id', p_page_id), true
  );
end;
$$;

/**
 * Tokeni julkaisua varten.
 *
 * Palauttaa salatun tokenin; purku tapahtuu sovelluksessa. Tämä on
 * ainoa tie meta_tokens-tauluun, ja se tarkistaa esihenkilöyden.
 */
create or replace function meta_page_token(p_restaurant uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select page_token into v_token
  from meta_tokens where restaurant_id = p_restaurant;

  return v_token;
end;
$$;

/**
 * Yhteyden katkaisu.
 *
 * Tokeni poistetaan, yhteysrivi jää tilaan disconnected. Rivin
 * poistaminen veisi mukanaan tiedon siitä että yhteys joskus oli —
 * ja julkaisuhistoria viittaa siihen aikaan.
 */
create or replace function meta_disconnect(p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select page_name into v_page from meta_connections
  where restaurant_id = p_restaurant;

  if v_page is null then return; end if;

  delete from meta_tokens where restaurant_id = p_restaurant;

  update meta_connections
  set status = 'disconnected', status_detail = null
  where restaurant_id = p_restaurant;

  perform write_audit(
    p_restaurant, 'meta.disconnect', 'meta_connection', null, v_page,
    'Katkaisi Facebook-yhteyden: ' || v_page,
    null, null, true
  );
end;
$$;

/**
 * Yhteyden tilan merkintä.
 *
 * Julkaisu huomaa ensimmäisenä kun tokeni ei enää kelpaa. Silloin
 * tila kirjataan, jotta asetusnäkymä kertoo saman eikä käyttäjä
 * ihmettele miksi julkaisu epäonnistuu joka kerta.
 */
create or replace function meta_set_status(
  p_restaurant uuid,
  p_status meta_connection_status,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update meta_connections
  set status = p_status, status_detail = p_detail
  where restaurant_id = p_restaurant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Julkaisun kirjaus
-- ---------------------------------------------------------------------------

/**
 * Julkaisun tulos historiaan.
 *
 * Kirjataan vasta kun Meta on vastannut, ja molempien kanavien tulos
 * samalla rivillä: osittainen onnistuminen on yksi tapahtuma eikä
 * kaksi. Kaksi riviä tekisi historiasta luettelon jossa sama julkaisu
 * esiintyy kahdesti eri tuloksilla.
 */
create or replace function meta_record_publication(
  p_restaurant uuid,
  p_menu uuid,
  p_week_start date,
  p_message text,
  p_image_path text,
  p_facebook_status meta_publish_status,
  p_facebook_post_id text,
  p_facebook_error text,
  p_instagram_status meta_publish_status,
  p_instagram_post_id text,
  p_instagram_error text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name from profiles p where p.id = auth.uid();

  insert into meta_publications (
    restaurant_id, menu_id, week_start, message, image_path,
    facebook_status, facebook_post_id, facebook_error,
    instagram_status, instagram_post_id, instagram_error,
    published_by, published_by_name
  )
  values (
    p_restaurant, p_menu, p_week_start, p_message, p_image_path,
    p_facebook_status, p_facebook_post_id, p_facebook_error,
    p_instagram_status, p_instagram_post_id, p_instagram_error,
    auth.uid(), coalesce(v_name, 'Tuntematon')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function meta_save_connection from public, anon;
revoke all on function meta_page_token from public, anon;
revoke all on function meta_disconnect from public, anon;
revoke all on function meta_set_status from public, anon;
revoke all on function meta_record_publication from public, anon;

grant execute on function meta_save_connection to authenticated;
grant execute on function meta_page_token to authenticated;
grant execute on function meta_disconnect to authenticated;
grant execute on function meta_set_status to authenticated;
grant execute on function meta_record_publication to authenticated;

-- ---------------------------------------------------------------------------
-- Julkaisukuvien tallennus
-- ---------------------------------------------------------------------------
--
-- Oma bucket kuiteista erillään: eri elinkaari ja eri sisältö.
-- Yksityinen niin kuin kuititkin — Meta noutaa kuvan allekirjoitetulla
-- osoitteella, joka on arvaamaton ja vanhenee. Julkinen bucket
-- tarkoittaisi että jokainen luotu kuva jää pysyvästi kenen tahansa
-- arvattavissa olevaan osoitteeseen.
--
-- Vain JPEG: Instagram ei hyväksy muuta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists social_storage_read on storage.objects;
create policy social_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'social'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists social_storage_write on storage.objects;
create policy social_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists social_storage_delete on storage.objects;
create policy social_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- Kehittäjänäkymän diagnostiikka
-- ---------------------------------------------------------------------------
--
-- Ylläpitäjä näkee yhteyden tilan tukea varten. Tokenia ei palauteta
-- edes hänelle: kysymykseen "miksi julkaisu ei toimi" vastaa tieto
-- siitä onko tokeni tallessa, ei tokeni itse.

create or replace function sa_meta_diagnostics(p_restaurant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select jsonb_build_object(
    'pageId', c.page_id,
    'pageName', c.page_name,
    'instagramId', c.instagram_id,
    'instagramUsername', c.instagram_username,
    'status', c.status,
    'statusDetail', c.status_detail,
    'scopes', c.scopes,
    'tokenExpiresAt', c.token_expires_at,
    'connectedAt', c.created_at,
    'updatedAt', c.updated_at,
    'hasToken', exists (
      select 1 from meta_tokens tk where tk.restaurant_id = p_restaurant
    ),
    'lastOk', (
      select max(p.created_at) from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_status = 'ok' or p.instagram_status = 'ok')
    ),
    'lastFailed', (
      select max(p.created_at) from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_status = 'failed' or p.instagram_status = 'failed')
    ),
    'lastError', (
      select coalesce(p.facebook_error, p.instagram_error)
      from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_error is not null or p.instagram_error is not null)
      order by p.created_at desc limit 1
    ),
    'publications', (
      select count(*) from meta_publications p
      where p.restaurant_id = p_restaurant
    )
  )
  into v
  from meta_connections c
  where c.restaurant_id = p_restaurant;

  return v;
end;
$$;

revoke all on function sa_meta_diagnostics from public, anon;
grant execute on function sa_meta_diagnostics to authenticated;
