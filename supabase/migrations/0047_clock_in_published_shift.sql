-- ---------------------------------------------------------------------------
-- 0047 — Leimaus vaatii JULKAISTUN vuoron
-- ---------------------------------------------------------------------------
--
-- Migraatio 0029 asetti säännön: ei vuoroa, ei sisäänleimausta. Sääntö
-- tunsi silloin vain vuoron olemassaolon, koska muuta ei ollut.
--
-- Migraatio 0045 toi julkaisun ja peruutuksen, ja sääntöön jäi kaksi
-- aukkoa:
--
--   Luonnokseen sai leimata. Luonnos ei näy työntekijälle lainkaan,
--   joten hän olisi saanut työoikeuden vuorosta jota hän ei tiedä
--   olevan olemassa.
--
--   Peruttuun vuoroon sai leimata. Vuoro on nimenomaan peruttu; se
--   että se yhä avaisi leimauksen tekee peruutuksesta merkinnän vailla
--   vaikutusta.
--
-- Molemmat aukot koskevat vain sisäänleimausta. Uloskirjaus ei vaadi
-- vuoroa eikä sitä muuteta: sisään päässyt on päästävä ulos, ja auki
-- jäänyt työaika kasvaa itsestään.
--
-- POIKKEUS TEHDÄÄN VUORONA, EI OHITUKSENA.
--
-- Kun joku tulee töihin ilman vuoroa, esihenkilö tekee hänelle vuoron
-- ja julkaisee sen — kaksi klikkausta. Erillinen "salli tämä kerta"
-- -oikeus olisi kolmas tapa saada työaikaa kirjatuksi, eikä sitä
-- näkyisi missään suunnitelmassa.

create or replace function record_clock_event(p_restaurant uuid, p_type clock_event_type)
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

  if p_type = 'in' then
    select exists (
      select 1
      from shifts s
      where s.user_id = v_user
        and s.restaurant_id = p_restaurant
        and s.status <> 'declined'
        and s.published_at is not null
        and s.cancelled_at is null
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
