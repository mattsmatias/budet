-- ---------------------------------------------------------------------------
-- 0050 — Tehtävät ja määräajat
-- ---------------------------------------------------------------------------
--
-- Ravintoloitsijan päivä on täynnä asioita jotka on pakko muistaa:
-- vuokra, sähkölasku, kirjanpitoaineisto, ensi viikon vuorot. Budet
-- tietää jo myynnistä, kuluista ja työvuoroista — tämä on se osa jota
-- se ei vielä tiennyt.
--
-- TÄMÄ EI OLE TODO-LISTA.
--
-- Tehtävän arvo on määräajassa. Ilman eräpäivää tehtävä on muistilappu
-- jonka voi ohittaa; eräpäivän kanssa Budet voi kertoa etukäteen, sanoa
-- eräpäivänä ja nostaa myöhästyneen esiin kunnes se on hoidettu.
--
-- ---------------------------------------------------------------------------
-- Miksi oma taulu eikä olemassa oleva
-- ---------------------------------------------------------------------------
--
-- Tässä kannassa on jo audit_events ja notifications, mutta ne
-- kuuluvat toiselle sovellukselle: molemmat on sidottu org_id:llä
-- organizations-tauluun vierasavaimella. Budetin vuokralainen on
-- ravintola, eikä ravintolaa voi kirjoittaa sarakkeeseen joka viittaa
-- organisaatioon.
--
-- Budetin ilmoitukset johdetaan tilasta eikä tallenneta riveiksi
-- ("ilmoitus joka ei vastaa todellista tilaa jäisi roikkumaan senkin
-- jälkeen kun asia on hoidettu"). Tehtävien muistutukset noudattavat
-- samaa linjaa: ne lasketaan eräpäivästä ja asetuksista, jolloin
-- kaksoisilmoitus on rakenteellisesti mahdoton.

create type task_priority as enum ('normal', 'important', 'critical');

/*
 * Näkyvyys on tehtävän oma ominaisuus.
 *
 * "Maksa vuokra" ei kuulu tarjoilijalle, "Sulje ravintola" kuuluu.
 * Ilman tätä kenttää tehtävälista olisi joko kaikille avoin tai vain
 * omistajalle — ja kumpikaan ei ole se mitä ravintolassa tarvitaan.
 */
create type task_visibility as enum (
  'owner_only',
  'managers',
  'assigned_user',
  'all_staff'
);

create type task_recurrence as enum (
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  title text not null check (length(trim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),

  /*
   * Eräpäivä ja valinnainen kellonaika erikseen.
   *
   * Sama ratkaisu kuin työvuoroilla: päivä on päivä ravintolan
   * aikavyöhykkeellä, eikä se saa liukua kesäajan mukana. Yhtenä
   * timestamptz-arvona "26.8." tarkoittaisi eri päivää eri
   * vyöhykkeillä.
   *
   * Kellonaika on valinnainen, koska useimmilla tehtävillä sitä ei
   * ole: lasku on maksettava sinä päivänä, ei kello 15.
   */
  due_on date not null,
  due_time time,

  priority task_priority not null default 'normal',
  visibility task_visibility not null default 'managers',

  assigned_to uuid references profiles (id) on delete set null,

  /*
   * Tila johdetaan, sitä ei tallenneta.
   *
   * Myöhässä oleva tehtävä ei muutu myöhässä olevaksi minkään
   * tapahtuman seurauksena vaan siksi että aika kului. Tallennettu
   * status olisi väärässä siitä hetkestä kunnes joku ajaisi
   * päivityksen — ja juuri myöhästymisen pitää olla oikein ilman
   * että kukaan tekee mitään.
   *
   * Tallennetaan siis vain se mitä ihminen teki: milloin merkittiin
   * tehdyksi ja milloin peruttiin.
   */
  completed_at timestamptz,
  completed_by uuid references profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles (id) on delete set null,

  recurrence task_recurrence not null default 'none',

  /*
   * Toistuvan tehtävän ketju.
   *
   * Jokainen esiintymä on oma rivinsä omalla tilallaan: elokuun
   * vuokra voi olla maksettu ja syyskuun myöhässä. Yksi rivi jossa
   * eräpäivä siirtyy hukkaisi historian.
   */
  parent_task_id uuid references tasks (id) on delete set null,

  /*
   * Muistutukset päivinä ennen eräpäivää.
   *
   * Taulukko eikä erillisiä rivejä: muistutus ei ole tapahtuma vaan
   * asetus. Lähetetyt muistutukset eivät tarvitse omaa kirjanpitoa,
   * koska ne johdetaan päivästä — sama päivä tuottaa saman
   * muistutuksen eikä kahta.
   */
  remind_days_before smallint[] not null default '{1}',
  remind_on_due boolean not null default true,
  remind_when_overdue boolean not null default true,

  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* Tehtävä ei voi olla sekä tehty että peruttu. */
  constraint tasks_one_outcome check (
    completed_at is null or cancelled_at is null
  ),

  /* Toistuva tehtävä ei voi olla peruttu ketjun juurena. */
  constraint tasks_recurrence_needs_due check (
    recurrence = 'none' or due_on is not null
  )
);

create index if not exists tasks_restaurant_due on tasks (restaurant_id, due_on);
create index if not exists tasks_assigned on tasks (assigned_to) where assigned_to is not null;
create index if not exists tasks_open
  on tasks (restaurant_id, due_on)
  where completed_at is null and cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Työntekijä näkee omat tehtävänsä ja koko henkilöstölle merkityt.
-- Talous- ja hallintotehtävät eivät kuulu hänelle, eikä suodatus voi
-- olla käyttöliittymässä: osoitteen voi kirjoittaa itse ja rajapinnan
-- voi kutsua suoraan.

alter table tasks enable row level security;

drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select to authenticated
  using (
    restaurant_id in (select my_restaurant_ids())
    and (
      case visibility
        when 'owner_only' then is_owner(restaurant_id)
        when 'managers' then is_manager(restaurant_id)
        when 'assigned_user' then (assigned_to = auth.uid() or is_manager(restaurant_id))
        else true
      end
    )
  );

/*
 * Kirjoitus on esihenkilön oikeus.
 *
 * Työntekijä merkitsee oman tehtävänsä tehdyksi funktion kautta, ei
 * suoralla päivityksellä: muuten hän voisi myös siirtää eräpäivää tai
 * vaihtaa vastuuhenkilön.
 */
drop policy if exists tasks_write on tasks;
create policy tasks_write on tasks
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();
