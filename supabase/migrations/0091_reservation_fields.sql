-- ---------------------------------------------------------------------------
-- 0091 — Varausnumero, allergiat, peruutusraja ja keskiyön yli ulottuva ilta
-- ---------------------------------------------------------------------------
--
-- Tämä migraatio on pelkkää rakennetta: sarakkeet, rajoitteet ja kolme
-- pientä apufunktiota. Varausmoottorin funktiot kirjoitetaan seuraavassa
-- migraatiossa kerralla uudelleen, jotta samaa nelisataa riviä plpgsql:ää
-- ei muokata kahdesti peräkkäin — kaksi muokkausta samaan funktioon
-- kahdessa tiedostossa on tapa saada kannan tila ja tiedostot eri linjalle.
--
-- ---------------------------------------------------------------------------
-- 1. MIKSI AUKIOLO SAA YLITTÄÄ KESKIYÖN
-- ---------------------------------------------------------------------------
--
-- Rajoite last_seating > opens tarkoitti, ettei yökahvilaa voinut
-- kirjata: kello 18 avautuva ja 02 sulkeutuva ilta oli kannalle
-- virheellinen. Kierto olisi ollut kaksi riviä (18–24 ja 00–02), mutta
-- silloin ilta olisi kaksi aukioloa eri viikonpäivinä — ja kaikki mitä
-- niistä lasketaan olisi laskettu kahdesti.
--
-- Uusi sääntö: kellonaika joka on avaamista pienempi tarkoittaa
-- seuraavaa päivää. Aukiolon pituus on siis johdettu tieto eikä uusi
-- sarake, ja se johdetaan yhdessä paikassa: reservation_span_minutes.
--
-- Ainoa kielletty tapaus on tyhjä ikkuna: last_seating = opens olisi
-- joko nolla tai kaksikymmentäneljä tuntia, eikä kanta voi tietää kumpi.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI VARAUSNUMERO ON KIRJAIMIA
-- ---------------------------------------------------------------------------
--
-- Numero luetaan puhelimessa ääneen. Juokseva luku (varaus 412) on
-- luettava mutta paljastaa ravintolan varausmäärän kenelle tahansa
-- asiakkaalle, ja se on tieto joka ei kuulu kuittiin. Kuusi merkkiä
-- aakkosista joista puuttuvat 0/O, 1/I ja 8/B on yhtä luettava eikä
-- kerro mitään: 31^6 on 887 miljoonaa vaihtoehtoa.
--
-- Numero syntyy liipaisimessa eikä sovelluksessa. Varaus voi syntyä
-- neljästä paikasta (widget, sali, walk-in, tuonti), ja neljä paikkaa
-- jossa sama arvo pitää muistaa asettaa on kolme paikkaa liikaa.

-- ---------------------------------------------------------------------------
-- Aukiolon pituus
-- ---------------------------------------------------------------------------

create or replace function reservation_span_minutes(
  p_opens time,
  p_last_seating time
)
returns int
language sql
immutable
as $fn$
  select case
    when p_opens is null or p_last_seating is null then null
    when p_last_seating > p_opens then
      (extract(epoch from (p_last_seating - p_opens)) / 60)::int
    else
      (extract(epoch from (p_last_seating - p_opens)) / 60)::int + 1440
  end;
$fn$;

comment on function reservation_span_minutes(time, time) is
  'Minuutit avaamisesta viimeiseen istumisaikaan. Keskiyon ylitys tulkitaan seuraavaksi paivaksi.';

-- ---------------------------------------------------------------------------
-- Aukiolon rajoitteet
-- ---------------------------------------------------------------------------

alter table reservation_hours
  drop constraint if exists reservation_hours_order;

alter table reservation_hours
  drop constraint if exists reservation_hours_span;

alter table reservation_hours
  add constraint reservation_hours_span check (last_seating <> opens);

/*
 * Poikkeuspäivä samoilla säännöillä.
 *
 * Uudenvuodenaatto on juuri se päivä joka jatkuu keskiyön yli, joten
 * poikkeus jossa sitä ei voi kirjata olisi väärässä paikassa tiukka.
 */
alter table reservation_exceptions
  drop constraint if exists reservation_exceptions_hours;

alter table reservation_exceptions
  add constraint reservation_exceptions_hours check (
    closed or (
      opens is not null
      and last_seating is not null
      and last_seating <> opens
    )
  );

-- ---------------------------------------------------------------------------
-- Päivän aukioloikkuna
-- ---------------------------------------------------------------------------
--
-- Palautusarvo kasvaa yhdellä sarakkeella, joten funktio on pudotettava
-- ennen luontia. Kutsujat ovat plpgsql-funktioita jotka sitovat nimen
-- vasta ajossa, joten pudotus ei riko niitä — ne saavat uuden version
-- heti seuraavalla kutsulla.

drop function if exists reservation_windows(uuid, date);

create or replace function reservation_windows(
  p_restaurant uuid,
  p_date date
)
returns table (opens time, last_seating time, span_minutes int)
language sql
stable
security definer
set search_path = public
as $fn$
  with poikkeus as (
    select * from reservation_exceptions e
    where e.restaurant_id = p_restaurant and e.exception_date = p_date
  )
  select e.opens, e.last_seating,
         reservation_span_minutes(e.opens, e.last_seating)
  from poikkeus e
  where not e.closed

  union all

  select h.opens, h.last_seating,
         reservation_span_minutes(h.opens, h.last_seating)
  from reservation_hours h
  where h.restaurant_id = p_restaurant
    and h.weekday = extract(isodow from p_date)::int
    and not exists (select 1 from poikkeus);
$fn$;

-- ---------------------------------------------------------------------------
-- Kellonaika todelliseksi hetkeksi
-- ---------------------------------------------------------------------------
--
-- Kello 00:30 on illan varaus eikä aamun: se kuuluu siihen iltaan joka
-- avautui edellisenä päivänä. Muunnos on yhdessä paikassa, koska sama
-- kysymys esitetään neljästä kohdasta (verkkovaraus, salin varaus,
-- muokkaus, pöytäehdotus) — ja neljä eri vastausta tarkoittaisi, että
-- ehdotus koskee eri aikaväliä kuin tallennus.
--
-- Ilman aukioloaikaa (suljettu päivä, aukioloja ei asetettu) päivä on se
-- joka annettiin. Walk-in kirjataan silloin sellaisenaan, eikä Kate ala
-- arvailla kuuluuko kello kahden merkintä eiliseen.

create or replace function reservation_start_at(
  p_restaurant uuid,
  p_date date,
  p_time time
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_opens time;
  v_offset int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return null; end if;

  /*
   * Se ikkuna johon kellonaika osuu.
   *
   * Etäisyys avaamisesta kierrätetään vuorokauden yli, jolloin 00:30 on
   * 390 minuuttia 18:00:sta ja osuu iltaan jonka viimeinen aika on
   * 02:00. Sama lasku kelpaa myös päivälle joka päättyy ennen keskiyötä:
   * silloin ikkunan ulkopuolinen aika saa pituutta suuremman etäisyyden
   * eikä kelpaa.
   *
   * Päiviä voi olla kaksi (lounas ja illallinen), joten lähin voittaa.
   */
  select w.opens, o.off into v_opens, v_offset
  from reservation_windows(p_restaurant, p_date) w
  cross join lateral (
    select (((extract(epoch from (p_time - w.opens)) / 60)::int % 1440) + 1440) % 1440 as off
  ) o
  where o.off <= coalesce(w.span_minutes, 0)
  order by o.off
  limit 1;

  /*
   * Aukioloajan ulkopuolella päivä on se joka annettiin.
   *
   * Sali kirjaa walk-inin myös kiinni olevana päivänä, eikä Kate ala
   * arvailla kuuluuko kello kahden merkintä eiliseen iltaan.
   */
  if v_opens is null then
    return (p_date + p_time) at time zone v_tz;
  end if;

  return ((p_date + v_opens)::timestamp + make_interval(mins => v_offset))
         at time zone v_tz;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Varausnumero
-- ---------------------------------------------------------------------------

alter table reservations
  add column if not exists reference text;

/*
 * Allergiat omana kenttänään.
 *
 * Ne kulkivat ennen samassa vapaassa toivekentässä kuin pöytätoiveet ja
 * juhlan aihe. Keittiölle allergia on eri asia kuin toive: se on ainoa
 * rivi jonka lukematta jättäminen vie ihmisen sairaalaan. Oma kenttä on
 * se ero jonka takia sen voi näyttää salinäkymässä varoituksena eikä
 * muistiinpanona.
 */
alter table reservations
  add column if not exists allergies text;

alter table reservations
  drop constraint if exists reservations_allergies_length;

alter table reservations
  add constraint reservations_allergies_length
  check (allergies is null or length(allergies) <= 200);

create or replace function reservation_reference_candidate()
returns text
language sql
volatile
set search_path = public
as $fn$
  /*
   * Kuusi merkkiä aakkosista ilman sekoittuvia.
   *
   * 0/O, 1/I ja 8/B luetaan puhelimessa väärin, ja väärin luettu
   * varausnumero on huonompi kuin ei numeroa lainkaan. Satunnaisuus
   * tulee gen_random_uuid():sta, joka on pg_catalogissa — pgcrypton
   * gen_random_bytes asuu Supabasessa eri skeemassa eikä näy
   * search_path = public -funktioille.
   */
  select string_agg(
    substr(
      '23456789ACDEFGHJKLMNPQRSTUVWXYZ',
      1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), g.i) % 31),
      1
    ),
    ''
  )
  from generate_series(0, 5) as g(i);
$fn$;

create or replace function reservation_set_reference()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_try int := 0;
  v_ref text;
begin
  if new.reference is not null and trim(new.reference) <> '' then
    return new;
  end if;

  /*
   * Kymmenen yritystä ja sitten yksilöivä rajoite.
   *
   * Törmäys on 887 miljoonan vaihtoehdon joukossa niin harvinainen,
   * ettei silmukan tarvitse olla ikuinen. Jos kaikki kymmenen osuvat
   * varattuun, indeksi hylkää rivin — ja se on oikea lopputulos:
   * mieluummin yksi epäonnistunut varaus kuin kaksi samalla numerolla.
   */
  loop
    v_try := v_try + 1;
    v_ref := reservation_reference_candidate();

    exit when not exists (
      select 1 from reservations r
      where r.restaurant_id = new.restaurant_id and r.reference = v_ref
    );

    exit when v_try >= 10;
  end loop;

  new.reference := v_ref;
  return new;
end;
$fn$;

drop trigger if exists reservations_reference on reservations;

create trigger reservations_reference
  before insert on reservations
  for each row execute function reservation_set_reference();

/*
 * Vanhat varaukset saavat numeron takautuvasti.
 *
 * Ilman tätä kannassa olisi kahdenlaisia varauksia, ja jokainen numeroa
 * näyttävä näkymä tarvitsisi haaran tyhjälle. Silmukka rivi kerrallaan,
 * koska yksi update kaikille antaisi saman arvon koko joukolle:
 * volatile-funktio arvioidaan kyselyä kohti eikä riviä kohti.
 */
do $migr$
declare
  v_row record;
begin
  for v_row in
    select id from reservations
    where reference is null or trim(reference) = ''
  loop
    update reservations
    set reference = reservation_reference_candidate()
    where id = v_row.id;
  end loop;
end $migr$;

create unique index if not exists reservations_reference_key
  on reservations (restaurant_id, reference);

-- ---------------------------------------------------------------------------
-- Peruutusraja
-- ---------------------------------------------------------------------------
--
-- Verkossa peruutus onnistui varauksen alkuhetkeen asti. Kello 19:00
-- varatun pöydän peruminen 18:55 on ravintolalle sama kuin saapumatta
-- jättäminen: ruoka on esivalmisteltu eikä aikaa ehdi myydä uudelleen.
--
-- Raja on tunneissa ja asetuksissa, koska se on ravintolan päätös eikä
-- Katen. Nolla tarkoittaa entistä käytöstä: peruutus onnistuu alkuun
-- asti. Oletus on 24 tuntia, joka on alalla tavallinen.
--
-- RAJA EI ESTÄ PERUMISTA VAAN VERKKOPERUUTUSTA. Asiakas soittaa, ja sali
-- peruu varauksen salinäkymästä. Sitä ei rajoiteta: tieto siitä ettei
-- seurue tule on ravintolalle arvokas myös kymmenen minuuttia ennen.

alter table reservation_settings
  add column if not exists cancel_cutoff_hours int not null default 24;

alter table reservation_settings
  drop constraint if exists reservation_settings_cutoff;

alter table reservation_settings
  add constraint reservation_settings_cutoff
  check (cancel_cutoff_hours between 0 and 168);

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_windows(uuid, date) from public, anon;
revoke all on function reservation_start_at(uuid, date, time) from public, anon;
revoke all on function reservation_reference_candidate() from public, anon;

grant execute on function reservation_windows(uuid, date) to authenticated;
grant execute on function reservation_start_at(uuid, date, time) to authenticated;
grant execute on function reservation_span_minutes(time, time) to anon, authenticated;
