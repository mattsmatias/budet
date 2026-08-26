-- ---------------------------------------------------------------------------
-- 0054 — Ravintolan elinkaari ja yritystiedot
-- ---------------------------------------------------------------------------
--
-- Developer Console hallitsee ravintoloita järjestelmätasolta. Siihen
-- tarvitaan tietoja joita ravintolan oma Budet ei ole tarvinnut: missä
-- tilassa asiakkuus on, mikä paketti on käytössä ja mitkä ovat yrityksen
-- viralliset tiedot.
--
-- TILA ON OMA SARAKKEENSA, EI PÄÄTELTY.
--
-- "Keskeytetty" ei ole johdettavissa datasta: se on päätös. Samoin
-- "arkistoitu". Jos tila pääteltäisiin esimerkiksi viimeisestä
-- kirjautumisesta, ravintola heräisi henkiin itsestään kun joku avaa
-- sovelluksen — ja keskeytys on nimenomaan sitä varten ettei niin käy.
--
-- ARKISTOINTI EI POISTA MITÄÄN.
--
-- Kaikki kolme päättävää tilaa (suspended, cancelled, archived)
-- säilyttävät rivit. Poisto on erillinen tarkoituksellinen toimenpide
-- eikä tilan sivuvaikutus.

-- ---------------------------------------------------------------------------
-- Tilat ja paketit
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'restaurant_status') then
    create type restaurant_status as enum (
      'trial', 'active', 'suspended', 'cancelled', 'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'restaurant_plan') then
    create type restaurant_plan as enum (
      'free', 'pro', 'business', 'enterprise'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Sarakkeet
-- ---------------------------------------------------------------------------
--
-- Oletus on 'active' eikä 'trial': olemassa olevat ravintolat ovat
-- oikeita asiakkaita, ja trial-oletus merkitsisi ne kaikki kokeiluiksi
-- joilla on päättymispäivä.

alter table restaurants
  add column if not exists status         restaurant_status not null default 'active',
  add column if not exists plan           restaurant_plan   not null default 'free',
  add column if not exists trial_ends_on  date,
  add column if not exists legal_name     text,
  add column if not exists business_id    text,
  add column if not exists address        text,
  add column if not exists postal_code    text,
  add column if not exists city           text,
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists website        text,
  add column if not exists logo_url       text,
  add column if not exists industry       text,
  add column if not exists is_test_account boolean not null default false,
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_note    text,
  add column if not exists created_by     uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Y-tunnuksen muoto
-- ---------------------------------------------------------------------------
--
-- Suomalainen Y-tunnus on seitsemän numeroa, viiva ja tarkiste.
-- Tarkistetta ei lasketa tässä: väärä tarkiste on asiakkaan kirjoitusvirhe
-- jonka ylläpitäjä korjaa, ei syy hylätä koko riviä. Muoto sen sijaan
-- pitää olla, jotta kenttä ei täyty vapaalla tekstillä.
--
-- Tyhjä sallitaan: ravintola voidaan luoda ennen kuin Y-tunnus on tiedossa.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_business_id_muoto'
  ) then
    alter table restaurants add constraint restaurants_business_id_muoto
      check (business_id is null or business_id ~ '^[0-9]{7}-[0-9]$');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Trial vaatii päättymispäivän
-- ---------------------------------------------------------------------------
--
-- Kokeilu ilman päättymispäivää ei ole kokeilu. Ilman rajoitetta
-- ravintola jäisi trial-tilaan ikuisesti eikä kukaan huomaisi.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_trial_paattyy'
  ) then
    alter table restaurants add constraint restaurants_trial_paattyy
      check (status <> 'trial' or trial_ends_on is not null);
  end if;
end
$$;

create index if not exists restaurants_status_idx on restaurants (status);
create index if not exists restaurants_created_at_idx on restaurants (created_at desc);

comment on column restaurants.status is
  'Asiakkuuden tila. Päätös, ei datasta johdettu arvo.';
comment on column restaurants.is_test_account is
  'Testiravintola. Erotetaan tuotantoluvuista Developer Consolen mittareissa.';
