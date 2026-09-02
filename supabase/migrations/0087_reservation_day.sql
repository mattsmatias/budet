-- 0087 – reservation_day: kalusteet ja aukioloaika mukaan
--
-- Tämä migraatio kirjaa tiedostoon sen mikä kantaan oli jo tehty.
-- Funktio kasvoi kahdessa vaiheessa pohjapiirroksen ja kalenterin
-- mukana, ja välissä sitä muutettiin suoraan kannassa. Ilman tätä
-- tiedostoa kantaa ei voi rakentaa uudelleen migraatioista, ja se on
-- pahempi vika kuin kumpikaan lisätty kenttä.
--
-- Funktio listaa kentät nimeltä, joten uusi sarake ei tule mukaan
-- itsestään — jokainen lisäys on oma rivinsä täällä:
--
--   0082  shape, rotation      pöydän muoto kartalla
--   0084  width, elements      leveys ja kalusteet
--   0085  billRequestedAt      laskua odottava pöytä
--   tämä  hours                aukioloaika kalenterin aikajanalle
--
-- Aukioloaika tulee reservation_windows-funktiosta eikä suoraan
-- taulusta: poikkeuspäivä syrjäyttää viikkorytmin, ja kalenterin
-- pitää piirtää se päivä joka oikeasti on.

create or replace function public.reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  v_from := (p_date + time '00:00') at time zone v_tz;
  v_to := ((p_date + 1) + time '00:00') at time zone v_tz;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'hours', (
      select json_build_object(
        'opens', to_char(w.opens, 'HH24:MI'),
        'lastSeating', to_char(w.last_seating, 'HH24:MI')
      )
      from reservation_windows(p_restaurant, p_date) w
      limit 1
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y,
        'shape', t.shape,
        'rotation', t.rotation,
        'width', t.width
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'elements', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'areaId', e.area_id,
        'kind', e.kind,
        'label', e.label,
        'posX', e.pos_x,
        'posY', e.pos_y,
        'width', e.width,
        'height', e.height,
        'rotation', e.rotation
      ) order by e.sort_order, e.created_at)
      from floor_elements e where e.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'billRequestedAt', r.bill_requested_at,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$fn$;

revoke all on function public.reservation_day(uuid, date) from anon;
