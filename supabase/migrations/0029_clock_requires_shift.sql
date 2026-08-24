-- ---------------------------------------------------------------------------
-- 0029 — Leimaus vaatii työvuoron
-- ---------------------------------------------------------------------------
--
-- Työvuoro kertoo milloin työntekijän on tarkoitus olla töissä. Tähän
-- asti leimaus ei tiennyt vuoroista mitään: kuka tahansa jäsen sai
-- kirjata työaikaa mihin aikaan tahansa, myös suoraan rajapinnasta.
--
-- Sääntö on nyt: ei vuoroa, ei sisäänleimausta.
--
-- SÄÄNTÖ ON KANNASSA EIKÄ VAIN NÄKYMÄSSÄ
--
-- Käyttöliittymä piilottaa painikkeen, mutta piilotettu painike ei ole
-- este. Tarkistus tehdään täällä, ja näkymä vain kertoo saman asian
-- ennakolta.
--
-- KOSKEE MYÖS ESIHENKILÖÄ
--
-- Ei poikkeusta roolin perusteella. Omistaja joka tekee vuoron itselleen
-- on kahden klikkauksen päässä, ja poikkeus tarkoittaisi että sääntö
-- pitää muistaa erikseen joka paikassa jossa työaikaa luetaan.
--
-- ULOSLEIMAUS EI VAADI VUOROA
--
-- Sisään päässyt on päästävä ulos. Jos vuoro perutaan kesken työn tai
-- työ venyy yli vuoron lopun, uloskirjauksen estäminen jättäisi
-- työajan auki — ja auki jäänyt työaika kasvaa itsestään.

-- ---------------------------------------------------------------------------
-- 1. Kuinka aikaisin vuoroon saa leimata
-- ---------------------------------------------------------------------------
--
-- Täsmälleen vuoron alkuhetkellä painaminen olisi kohtuuton vaatimus:
-- töihin tullaan hetkeä ennen. Ravintolakohtainen, koska käytännöt
-- eroavat.

alter table restaurants
  add column if not exists clock_in_early_minutes smallint not null default 30;

alter table restaurants
  drop constraint if exists restaurants_early_minutes_range;

alter table restaurants
  add constraint restaurants_early_minutes_range
  check (clock_in_early_minutes >= 0 and clock_in_early_minutes <= 240);

-- ---------------------------------------------------------------------------
-- 2. Leimaus
-- ---------------------------------------------------------------------------

create or replace function record_clock_event(
  p_restaurant uuid,
  p_type clock_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := 'off';
  v_row record;
  v_id uuid;
  v_tz text;
  v_early int;
  v_local timestamp;
  v_day_start timestamptz;
  v_has_shift boolean;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  select timezone, clock_in_early_minutes
    into v_tz, v_early
  from restaurants where id = p_restaurant;

  if v_tz is null then
    raise exception 'Ravintolaa ei löytynyt';
  end if;

  /*
   * Vuorokausi ravintolan ajassa, ei UTC:ssä.
   *
   * Aiemmin tässä luki date_trunc('day', now()), mikä on UTC-keskiyö.
   * Helsingissä klo 01:50 tehty leimaus kuuluu paikalliselle päivälle,
   * mutta edelliselle UTC-päivälle — tila laskettiin väärän päivän
   * tapahtumista, ja yövuorolainen sai "leimaus ei ole mahdollinen".
   */
  v_local := now() at time zone v_tz;
  v_day_start := (date_trunc('day', v_local)) at time zone v_tz;

  for v_row in
    select event_type from clock_events
    where user_id = v_user
      and restaurant_id = p_restaurant
      and occurred_at >= v_day_start
    order by occurred_at
  loop
    v_state := case
      when v_row.event_type = 'in' and v_state = 'off' then 'working'
      when v_row.event_type = 'break_start' and v_state = 'working' then 'on_break'
      when v_row.event_type = 'break_end' and v_state = 'on_break' then 'working'
      when v_row.event_type = 'out' then 'off'
      else v_state
    end;
  end loop;

  if not (
    (p_type = 'in' and v_state = 'off')
    or (p_type = 'break_start' and v_state = 'working')
    or (p_type = 'break_end' and v_state = 'on_break')
    or (p_type = 'out' and v_state in ('working', 'on_break'))
  ) then
    raise exception 'Leimaus ei ole mahdollinen nykyisessä tilassa (%)', v_state;
  end if;

  /*
   * Sisäänleimaus vaatii voimassa olevan vuoron.
   *
   * Ikkuna alkaa clock_in_early_minutes ennen vuoron alkua ja päättyy
   * vuoron loppuun. Yön yli menevä vuoro tunnistetaan siitä että
   * lopetusaika ei ole aloitusaikaa myöhempi, jolloin loppu on
   * seuraavana päivänä — siksi haku kattaa myös eilisen vuoron.
   *
   * Sama sääntö on TypeScriptissä lib/restoflow/shift-window.ts:ssä,
   * joka päättää mitä käyttöliittymä näyttää. Tämä on se joka ratkaisee.
   */
  if p_type = 'in' then
    select exists (
      select 1
      from shifts s
      where s.user_id = v_user
        and s.restaurant_id = p_restaurant
        and s.status <> 'declined'
        and s.shift_date between (v_local::date - 1) and v_local::date
        and v_local >= (s.shift_date + s.start_time) - make_interval(mins => v_early)
        and v_local < (
          case
            when s.end_time > s.start_time then s.shift_date + s.end_time
            else s.shift_date + s.end_time + interval '1 day'
          end
        )
    ) into v_has_shift;

    if not v_has_shift then
      raise exception 'Ei voimassa olevaa työvuoroa';
    end if;
  end if;

  insert into clock_events (restaurant_id, user_id, event_type)
  values (p_restaurant, v_user, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_clock_event from public;
grant execute on function record_clock_event to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Varhaisraja istuntoon
-- ---------------------------------------------------------------------------
--
-- Näkymä kantaa jo ravintolan asetukset istuntoon. Varhaisraja tulee
-- samaa reittiä, jotta etusivu voi kertoa milloin leimaus avautuu ilman
-- omaa kyselyä.
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
  r.clock_in_early_minutes
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;
