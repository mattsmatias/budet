-- ---------------------------------------------------------------------------
-- 0033 — Päivän myynti
-- ---------------------------------------------------------------------------
--
-- Budet ei ole nähnyt myyntiä, ja siksi se ei ole voinut sanoa mitään
-- kannattavuudesta, työvoiman osuudesta eikä siitä oliko päivä hyvä.
-- Kulut yksin kertovat mihin rahat menivät muttei kannattiko se.
--
-- YKSI LUKU PÄIVÄSSÄ, EI KASSAJÄRJESTELMÄ
--
-- Tämä ei ole kassa eikä tilaustenhallinta. Yksi kenttä johon
-- kirjataan illan päätteeksi kassan päiväraportin summa. Se riittää
-- kaikkeen mitä ohjauspaneeli tarvitsee, eikä vaadi integraatiota
-- joltakin toiselta järjestelmältä.
--
-- VEROTON SUMMA
--
-- Työvoiman osuus myynnistä on ravintola-alan tunnusluku, ja se
-- lasketaan verottomasta myynnistä. Verollisella summalla suhdeluku
-- olisi järjestelmällisesti liian pieni — ruoan ALV on 14 % ja alkoholin
-- 25,5 %, joten virhe vaihtelisi vielä päivittäin myynnin rakenteen
-- mukaan.
--
-- Kassan päiväraportti näyttää verottoman summan, joten kenttä ei vaadi
-- laskutoimitusta. Käyttöliittymä sanoo sen ääneen.
--
-- TAVOITE ON VAPAAEHTOINEN
--
-- Tavoitteeton päivä vertautuu saman viikonpäivän historiaan. Se on
-- parempi vertailukohta kuin keksitty tavoite: maanantai ei ole
-- perjantai, eikä kumpaakaan pidä verrata keskiarvoon.

create table if not exists daily_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  /** Myyntipäivä ravintolan aikavyöhykkeellä. */
  sales_date date not null,

  /** Veroton myynti sentteinä. */
  net_sales_cents integer not null,

  /** Päivän tavoite, jos sellainen on asetettu. */
  target_cents integer,

  note text,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_sales_positive check (net_sales_cents >= 0),
  constraint daily_sales_target_positive check (target_cents is null or target_cents >= 0),

  /*
   * Yksi rivi per päivä.
   *
   * Kaksi riviä samalle päivälle tarkoittaisi että päivän myynti
   * riippuu siitä kumman kysely löytää ensin.
   */
  constraint daily_sales_unique unique (restaurant_id, sales_date)
);

create index if not exists daily_sales_lookup_idx
  on daily_sales (restaurant_id, sales_date desc);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Myynti on liiketoimintatietoa: omistaja, vuoropäällikkö ja
-- kirjanpitäjä näkevät sen, työntekijä ei. Sama rajaus kuin muullakin
-- taloustiedolla, joten käytetään samaa funktiota.
--
-- Kirjaaminen on esihenkilön työ. Kirjanpitäjä lukee muttei kirjaa.

alter table daily_sales enable row level security;

drop policy if exists daily_sales_read on daily_sales;
create policy daily_sales_read on daily_sales
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists daily_sales_write on daily_sales;
create policy daily_sales_write on daily_sales
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists daily_sales_touch on daily_sales;
create trigger daily_sales_touch before update on daily_sales
  for each row execute function touch_updated_at();
