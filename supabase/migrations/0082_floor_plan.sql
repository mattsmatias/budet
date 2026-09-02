-- ---------------------------------------------------------------------------
-- 0082 — Pöytäkartta
-- ---------------------------------------------------------------------------
--
-- Pöytälista kertoo että pöytiä on kaksitoista. Se ei kerro kumpi
-- niistä on ikkunan vieressä, mitkä kaksi ovat vierekkäin, tai mihin
-- kuuden hengen seurue mahtuu.
--
-- Salissa se nähdään yhdellä silmäyksellä. Listassa ei nähdä
-- ollenkaan, ja siksi varauksia siirrellään päässä eikä ruudulla.
--
-- ---------------------------------------------------------------------------
-- PAIKKA OLI JO, SITÄ EI VAIN KÄYTETTY
-- ---------------------------------------------------------------------------
--
-- pos_x ja pos_y ovat olleet taulussa alusta asti prosentteina salin
-- leveydestä ja korkeudesta. Prosentti eikä pikseli, koska sama
-- kartta piirretään puhelimen ruudulle ja työpöydän näytölle — ja
-- pikselikoordinaatti tarkoittaisi eri paikkaa kummallakin.
--
-- Tässä lisätään se mitä paikan lisäksi tarvitaan tunnistamiseen.
--
-- ---------------------------------------------------------------------------
-- MUOTO ON TUNNISTAMISTA VARTEN, EI PIIRUSTUS
-- ---------------------------------------------------------------------------
--
-- Pyöreä kuuden hengen pöytä ja pitkä kuuden hengen pöytä ovat salissa
-- eri asioita, ja tarjoilija tunnistaa ne muodosta ennen kuin lukee
-- numeron. Kolme muotoa riittää siihen.
--
-- Kokoa ei kysytä erikseen. Se johdetaan paikkaluvusta: kahden hengen
-- pöytä on pieni ja kymmenen hengen iso, eikä kukaan halua säätää
-- leveyttä ja korkeutta erikseen kahdelletoista pöydälle. Tämä on
-- pöytäkartta eikä pohjapiirustus.

do $$ begin
  create type table_shape as enum ('round', 'square', 'rect');
exception when duplicate_object then null; end $$;

alter table restaurant_tables
  add column if not exists shape table_shape not null default 'round';

/**
 * Kierto asteina.
 *
 * Vain suorakaiteelle merkitsevä: pitkä pöytä seinän vierellä on
 * pystyssä, keskellä salia poikittain. Pyöreä pöytä näyttää
 * samalta joka asennossa, ja sen kiertäminen olisi säädin jolla ei
 * tapahdu mitään.
 */
alter table restaurant_tables
  add column if not exists rotation smallint not null default 0;

alter table restaurant_tables
  drop constraint if exists restaurant_tables_rotation;

alter table restaurant_tables
  add constraint restaurant_tables_rotation
  check (rotation >= 0 and rotation < 360);

-- ---------------------------------------------------------------------------
-- Sijaintien tallennus yhtenä eränä
-- ---------------------------------------------------------------------------
--
-- Kartan järjestely on yksi teko, ei kaksitoista. Käyttäjä siirtää
-- pöytiä kunnes sali näyttää oikealta ja tallentaa kerran.
--
-- Rivi kerrallaan päivittäminen tarkoittaisi kahtatoista kyselyä ja
-- sitä että puolet niistä voi onnistua. Puoliksi siirretty kartta on
-- huonompi kuin siirtämätön: siinä ei ole enää sitä järjestystä joka
-- oli ennen, eikä sitä jota yritettiin.
--
-- Tunniste tulee mukana, muttei ravintola: se luetaan riviltä. Näin
-- kutsuja ei voi kirjoittaa toisen ravintolan pöytiä antamalla väärän
-- tunnisteen — sama sääntö kuin tiedostokaapin toiminnoissa.

create or replace function save_table_positions(
  p_restaurant uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  /*
   * Yli sadan pöydän erä on virhe eikä ravintola.
   *
   * Raja ei suojaa mitään laskennallista; se estää sen että
   * väärinmuodostettu pyyntö kirjoittaisi mielivaltaisen määrän
   * rivejä yhdellä kutsulla.
   */
  if jsonb_array_length(p_positions) > 200 then
    raise exception 'Liian monta poytaa kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_positions)
  loop
    update restaurant_tables t
    set
      pos_x = round((v_row->>'x')::numeric, 2),
      pos_y = round((v_row->>'y')::numeric, 2),
      shape = coalesce((v_row->>'shape')::table_shape, t.shape),
      rotation = coalesce((v_row->>'rotation')::smallint, t.rotation)
    where t.id = (v_row->>'id')::uuid
      /*
       * Ravintola riviltä, ei parametrista.
       *
       * Parametri on jo tarkistettu is_managerilla, mutta rivin oma
       * ravintola on se joka ratkaisee: näin toisen ravintolan
       * pöydän tunniste ei osu mihinkään.
       */
      and t.restaurant_id = p_restaurant;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function save_table_positions(uuid, jsonb) from public, anon;
grant execute on function save_table_positions(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Muoto ja kierto myös päivänäkymään
-- ---------------------------------------------------------------------------
--
-- reservation_day kokoaa illan yhdeksi JSON-vastaukseksi, ja pöytien
-- kohdalla se listaa kentät nimeltä. Uusi sarake ei siis tule mukaan
-- itsestään: ilman tätä salinäkymä piirtäisi jokaisen pöydän
-- oletusmuodolla, ja järjestelty kartta näyttäisi eriltä kuin se jota
-- järjesteltiin.
--
-- Funktio kirjoitetaan kokonaan uusiksi, koska sen runko on yksi
-- json_build_object. Muutos on kaksi riviä 'tables'-osiossa; loppu on
-- sama kuin 0068:ssa.

create or replace function reservation_day(p_restaurant uuid, p_date date)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
        'rotation', t.rotation
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
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
$function$;
