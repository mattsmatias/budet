-- ---------------------------------------------------------------------------
-- 0034 — Avoimen vuoron ottaminen
-- ---------------------------------------------------------------------------
--
-- Avoin vuoro on olemassa siksi, että ravintolalta puuttuu tekijä.
-- Tähän asti työntekijä ei nähnyt niitä eikä voinut tehdä niille
-- mitään: esihenkilö sai hälytyksen "vuorolle ei ole tekijää", ja
-- silmukka päättyi siihen.
--
-- Sääntö on nyt: työntekijä ottaa avoimen vuoron itselleen, ja kanta
-- ratkaisee saako hän.
--
-- EI HYVÄKSYNTÄKIERROSTA
--
-- Ilmoittautuminen jonka esihenkilö vahvistaa tuo viiveen juuri siihen
-- kohtaan jossa hälytys sanoi että asia on kiireellinen. Riski ei ole
-- se kuka ottaa vuoron vaan se että vuoro luo päällekkäisyyden — ja se
-- on sääntö, ei harkintaa.
--
-- KILPAJUOKSU RATKAISTAAN PÄIVITYKSESSÄ
--
-- Kaksi työntekijää voi painaa samalla sekunnilla. Tarkistus ennen
-- päivitystä ei riitä: molemmat läpäisisivät sen. Ehto "user_id is
-- null" on siksi itse UPDATE-lauseessa, ja häviäjä saa selkeän
-- virheen sen sijaan että kirjoittaisi voittajan päälle.
--
-- LEPOAIKA EI OLE ESTO
--
-- Työaikalain 11 tunnin lepoaika on merkintä esihenkilölle, ei este.
-- Esto tarkoittaisi että kanta kieltäytyy katteesta jonka esihenkilö
-- olisi hyväksynyt. Päällekkäisyys sen sijaan on aina virhe: ihminen
-- ei voi olla kahdessa paikassa.

-- ---------------------------------------------------------------------------
-- 1. Katkaisin
-- ---------------------------------------------------------------------------
--
-- Ravintolakohtainen, koska käytännöt eroavat. Oletus päällä: se on
-- syy jonka takia ominaisuus on olemassa.

alter table restaurants
  add column if not exists open_shift_claiming boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Ottaminen
-- ---------------------------------------------------------------------------

create or replace function claim_open_shift(p_shift uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shift record;
  v_tz text;
  v_enabled boolean;
  v_position staff_position;
  v_local timestamp;
  v_starts timestamp;
  v_ends timestamp;
  v_overlap boolean;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select id, restaurant_id, user_id, shift_date, start_time, end_time, position
    into v_shift
  from shifts
  where id = p_shift;

  if v_shift.id is null then
    raise exception 'Työvuoroa ei löytynyt';
  end if;

  select timezone, open_shift_claiming
    into v_tz, v_enabled
  from restaurants
  where id = v_shift.restaurant_id;

  if v_tz is null then
    raise exception 'Ravintolaa ei löytynyt';
  end if;

  if not v_enabled then
    raise exception 'Vuorojen ottaminen ei ole käytössä';
  end if;

  select position into v_position
  from memberships
  where user_id = v_user
    and restaurant_id = v_shift.restaurant_id
    and active;

  if not found then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  /*
   * Asema ratkaisee.
   *
   * Käyttöliittymä näyttää vain oman aseman vuorot, joten tämä ei
   * tavallisesti näy kenellekään. Sääntö on silti täällä: piilotettu
   * rivi ei ole este sille joka kutsuu rajapintaa suoraan.
   */
  if v_shift.position is not null and v_shift.position is distinct from v_position then
    raise exception 'Työvuoro on toiselle asemalle';
  end if;

  if v_shift.user_id is not null then
    raise exception 'Työvuorolla on jo tekijä';
  end if;

  /*
   * Vuoron alku ja loppu ravintolan ajassa.
   *
   * Yön yli menevä vuoro tunnistetaan siitä ettei lopetusaika ole
   * aloitusaikaa myöhempi. Sama tunnistus on record_clock_event-
   * funktiossa ja lib/restoflow/shift-window.ts:ssä.
   */
  v_local := now() at time zone v_tz;
  v_starts := v_shift.shift_date + v_shift.start_time;
  v_ends := case
    when v_shift.end_time > v_shift.start_time
      then v_shift.shift_date + v_shift.end_time
    else v_shift.shift_date + v_shift.end_time + interval '1 day'
  end;

  /*
   * Päättynyttä vuoroa ei voi ottaa. Kesken olevan voi: jos joku ei
   * tullut, vuoro on juuri se joka pitää saada tehdyksi.
   */
  if v_ends <= v_local then
    raise exception 'Työvuoro on jo päättynyt';
  end if;

  select exists (
    select 1
    from shifts s
    where s.user_id = v_user
      and s.restaurant_id = v_shift.restaurant_id
      and s.status <> 'declined'
      and s.shift_date between (v_shift.shift_date - 1) and (v_shift.shift_date + 1)
      and (s.shift_date + s.start_time) < v_ends
      and (
        case
          when s.end_time > s.start_time then s.shift_date + s.end_time
          else s.shift_date + s.end_time + interval '1 day'
        end
      ) > v_starts
  ) into v_overlap;

  if v_overlap then
    raise exception 'Sinulla on jo työvuoro samaan aikaan';
  end if;

  /*
   * Ehto on lauseessa eikä sen edessä. Kaksi samanaikaista ottajaa
   * läpäisisivät erillisen tarkistuksen molemmat.
   *
   * Tila on accepted: työntekijä valitsi vuoron itse, joten suostumus
   * on vahvempi kuin esihenkilön merkitsemässä vuorossa.
   */
  update shifts
     set user_id = v_user,
         status = 'accepted',
         updated_at = now()
   where id = p_shift
     and user_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Joku ehti ensin';
  end if;

  return v_id;
end;
$$;

revoke all on function claim_open_shift from public;
grant execute on function claim_open_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Asetus istuntoon
-- ---------------------------------------------------------------------------
--
-- Näkymä kantaa ravintolan asetukset istuntoon, jotta työntekijän
-- näkymä tietää näyttääkö avoimia vuoroja ollenkaan.
--
-- Uusi sarake tulee loppuun. create or replace view ei voi lisätä
-- saraketta keskelle eikä muuttaa järjestystä — se on virhe eikä
-- muutos, ja se huomataan vasta ajossa.
--
-- security_invoker = false säilytetään migraatiosta 0028: kutsujalla ei
-- ole sarakeoikeutta tuntipalkkaan, ja näkymän oma where-ehto rajaa jo
-- omaan riviin.

create or replace view my_restaurants
with (security_invoker = false)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug,
  r.lunch_theme,
  r.clock_in_early_minutes,
  r.open_shift_claiming
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Katkaisin asetuksiin
-- ---------------------------------------------------------------------------
--
-- Uusi parametri vaatii pudotuksen: lisätty parametri ei korvaa vanhaa
-- funktiota vaan luo ylikuormituksen, ja nimetty kutsu jäisi
-- monitulkintaiseksi.

drop function if exists update_restaurant(uuid, text, text);

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text,
  p_timezone text,
  p_open_shift_claiming boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa asetuksia';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  update restaurants
  set name = trim(p_name),
      timezone = p_timezone,
      open_shift_claiming = coalesce(p_open_shift_claiming, open_shift_claiming),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;
