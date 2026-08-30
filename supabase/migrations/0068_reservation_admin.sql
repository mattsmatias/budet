-- ---------------------------------------------------------------------------
-- 0068 — Varausten hallinta
-- ---------------------------------------------------------------------------
--
-- Salinäkymän luku ja muokkaus. Kaikki tämän tiedoston funktiot ovat
-- security definer, joten ne ohittavat rivitason käytännöt. Siksi
-- jokainen tarkistaa jäsenyyden itse ensimmäisellä rivillään. Funktio
-- joka ohittaa RLS:n mutta ei tarkista oikeutta on takaovi.
--
-- ---------------------------------------------------------------------------
-- Miksi työntekijän luku kulkee funktion kautta
-- ---------------------------------------------------------------------------
--
-- Tarjoilija tarvitsee illan varauslistan: kello, nimi, seurueen koko,
-- pöytä. Hän ei tarvitse asiakkaan puhelinnumeroa eikä sähköpostia —
-- niillä soittaa esihenkilö jos ilta muuttuu.
--
-- Rivitason käytäntö ei osaa piilottaa saraketta, ja sarakekohtainen
-- GRANT koskee koko roolia eikä yksittäistä ravintolaa. Ainoa paikka
-- jossa eron voi tehdä on funktio, joten se tehdään siellä:
-- reservations-taulun lukuoikeus on esihenkilöllä, ja työntekijä lukee
-- päivän tästä funktiosta ilman yhteystietoja.

-- ---------------------------------------------------------------------------
-- Päivän varaukset ja salin tila
-- ---------------------------------------------------------------------------

create or replace function reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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

  /*
   * Päivä alkaa ja päättyy ravintolan ajassa, ei palvelimen.
   *
   * Ilta joka jatkuu puolenyön yli kuuluu alkamispäiväänsä: kello
   * 23:30 alkanut varaus on lauantain varaus vaikka se päättyy
   * sunnuntain puolella.
   */
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
        'posY', t.pos_y
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
        /* Yhteystiedot vain esihenkilölle. */
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
$$;

-- ---------------------------------------------------------------------------
-- Vapaat ajat hallintanäkymässä
-- ---------------------------------------------------------------------------
--
-- p_exclude jättää muokattavan varauksen huomiotta. Ilman sitä varaus
-- estäisi itseään: kello 19:00 näyttäisi varatulta koska siinä on juuri
-- se varaus jota ollaan siirtämässä.

create or replace function reservation_admin_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.slot_time)
      from reservation_slots(p_restaurant, p_date, p_party, p_exclude) s
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vapaat pöydät yhdelle varaukselle
-- ---------------------------------------------------------------------------
--
-- Pöydän vaihtoon: mitkä pöydät ovat vapaana juuri tämän varauksen
-- aikana. Varaus itse ei estä itseään.

create or replace function reservation_free_tables(p_reservation uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res record;
  v_turnaround int;
  v_range tstzrange;
begin
  select * into v_res from reservations where id = p_reservation;
  if v_res.id is null or not is_manager(v_res.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  v_range := tstzrange(
    v_res.starts_at - make_interval(mins => coalesce(v_turnaround, 0)),
    v_res.ends_at + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  return coalesce((
    select json_agg(json_build_object(
      'id', t.id,
      'name', t.name,
      'seatsMin', t.seats_min,
      'seatsMax', t.seats_max,
      'fits', t.seats_min <= v_res.party_size and t.seats_max >= v_res.party_size
    ) order by t.sort_order, t.name)
    from restaurant_tables t
    where t.restaurant_id = v_res.restaurant_id
      and t.active
      and not exists (
        select 1 from reservation_table_assignments a
        where a.table_id = t.id
          and a.blocking
          and a.during && v_range
          and a.reservation_id <> p_reservation
      )
  ), '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen luonti hallintanäkymästä
-- ---------------------------------------------------------------------------
--
-- Sama funktio kattaa etukäteisvarauksen ja walk-inin. Ero on
-- lähteessä ja tilassa: walk-in on 'walk_in' ja 'arrived', koska
-- seurue istuu jo pöydässä.
--
-- WALK-IN VIE PÖYDÄN VERKKOVARAUKSILTA HETI. Se saa saman liitosrivin
-- kuin verkkovaraus, joten saatavuuslaskenta näkee sen samalla
-- sekunnilla. Erillinen "walk-in-taulu" jättäisi pöydän näyttämään
-- vapaalta ulospäin.

create or replace function reservation_create_admin(
  p_restaurant uuid,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_walk_in boolean default false,
  p_minutes int default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_id uuid;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if p_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_start := (p_date + p_time) at time zone v_tz;

  begin
    v_id := reservation_book(
      p_restaurant, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      case when p_walk_in then 'walk_in'::reservation_source
           else 'admin'::reservation_source end,
      case when p_walk_in then 'arrived'::reservation_status
           else 'confirmed'::reservation_status end,
      p_minutes, p_tables, null
    );
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  perform write_audit(
    p_restaurant,
    case when p_walk_in then 'reservation.walk_in' else 'reservation.create' end,
    'reservation', v_id, trim(p_name),
    case when p_walk_in then 'Lisäsi walk-inin: ' else 'Loi varauksen: ' end
      || trim(p_name) || ', ' || p_party || ' hlö, '
      || to_char(p_date, 'DD.MM.YYYY') || ' klo ' || to_char(p_time, 'HH24:MI'),
    null,
    jsonb_build_object('party_size', p_party, 'starts_at', v_start),
    false
  );

  return json_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen muokkaus
-- ---------------------------------------------------------------------------
--
-- Ajan, henkilömäärän ja pöytien muutos kulkee samasta funktiosta,
-- koska ne riippuvat toisistaan: uusi aika voi viedä pöydän, ja
-- suurempi seurue ei ehkä mahdu vanhaan pöytään.
--
-- Null-parametri tarkoittaa "älä muuta". Muistiinpanon tyhjentäminen
-- tehdään tyhjällä merkkijonolla, koska null olisi kaksiselitteinen:
-- "pyyhi" vai "jätä ennalleen".

create or replace function reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_party int;
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_table uuid;
  v_muutos text[] := array[]::text[];
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  v_party := coalesce(p_party, v_old.party_size);
  if v_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if p_date is not null or p_time is not null then
    v_start := (
      coalesce(p_date, (v_old.starts_at at time zone v_tz)::date)
      + coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    ) at time zone v_tz;
  else
    v_start := v_old.starts_at;
  end if;

  /*
   * Kesto lasketaan uudelleen vain jos seurueen koko muuttui.
   *
   * Muuten esihenkilön käsin pidentämä varaus lyhenisi takaisin
   * oletukseen aina kun muistiinpanoa korjataan.
   */
  if v_party <> v_old.party_size then
    v_minutes := reservation_duration_for(v_old.restaurant_id, v_party);
  else
    v_minutes := (extract(epoch from (v_old.ends_at - v_old.starts_at)) / 60)::int;
  end if;
  v_end := v_start + make_interval(mins => v_minutes);

  /* Pöydät: annetut, entiset jos mikään ei muuttunut, muuten uusi haku. */
  if p_tables is not null then
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = v_old.restaurant_id
      )
    ) then
      return json_build_object('ok', false, 'error', 'table');
    end if;
    v_tables := p_tables;
  elsif v_start <> v_old.starts_at
        or v_end <> v_old.ends_at
        or v_party <> v_old.party_size
  then
    v_tables := reservation_pick_tables(
      v_old.restaurant_id, v_start, v_end, v_party, p_reservation
    );
    if v_tables is null then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set
      starts_at = v_start,
      ends_at = v_end,
      party_size = v_party,
      guest_name = coalesce(nullif(left(trim(p_name), 120), ''), guest_name),
      guest_phone = case when p_phone is null then guest_phone
                         else nullif(left(trim(p_phone), 40), '') end,
      guest_email = case when p_email is null then guest_email
                         else nullif(lower(left(trim(p_email), 160)), '') end,
      note = case when p_note is null then note
                  else nullif(left(trim(p_note), 500), '') end
    where id = p_reservation;

    if v_tables is not null then
      delete from reservation_table_assignments
      where reservation_id = p_reservation
        and table_id <> all (v_tables);

      foreach v_table in array v_tables loop
        insert into reservation_table_assignments
          (reservation_id, table_id, starts_at, ends_at, blocking)
        values (
          p_reservation, v_table, v_start, v_end,
          v_old.status in ('pending', 'confirmed', 'arrived')
        )
        on conflict (reservation_id, table_id) do update
          set starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              blocking = excluded.blocking;
      end loop;
    end if;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  if v_start <> v_old.starts_at then
    v_muutos := v_muutos || (
      'aika ' || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI')
      || ' -> ' || to_char(v_start at time zone v_tz, 'DD.MM. HH24:MI')
    );
  end if;
  if v_party <> v_old.party_size then
    v_muutos := v_muutos || ('koko ' || v_old.party_size || ' -> ' || v_party);
  end if;
  if v_tables is not null then
    v_muutos := v_muutos || 'pöytä';
  end if;

  perform write_audit(
    v_old.restaurant_id, 'reservation.update', 'reservation',
    p_reservation, v_old.guest_name,
    'Muutti varausta: ' || v_old.guest_name
      || case when array_length(v_muutos, 1) is null then ''
              else ' (' || array_to_string(v_muutos, ', ') || ')' end,
    jsonb_build_object('starts_at', v_old.starts_at, 'party_size', v_old.party_size),
    jsonb_build_object('starts_at', v_start, 'party_size', v_party),
    false
  );

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tilan vaihto
-- ---------------------------------------------------------------------------
--
-- Saapui, lähti, ei saapunut, peruttu. Liipaisin hoitaa liitosrivien
-- blocking-lipun, joten pöytä vapautuu tai varautuu automaattisesti.
--
-- EI SAAPUNUT ON VAIN MERKINTÄ. Siitä ei seuraa maksua, veloitusta
-- eikä korttivarmennusta — tila on olemassa jotta ravintola tietää
-- kuinka usein näin käy, ei jotta asiakasta rangaistaisiin.

create or replace function reservation_set_status(
  p_reservation uuid,
  p_status reservation_status
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_tz text;
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if v_old.status = p_status then
    return json_build_object('ok', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  /*
   * Peruttu varaus vapautti pöytänsä. Takaisin aktiiviseksi vain jos
   * pöytä on yhä vapaa — muuten aika on jo myyty toiselle.
   */
  if v_old.status in ('cancelled', 'no_show', 'completed')
     and p_status in ('pending', 'confirmed', 'arrived')
  then
    if exists (
      select 1
      from reservation_table_assignments a
      join reservation_table_assignments b
        on b.table_id = a.table_id
       and b.reservation_id <> a.reservation_id
       and b.blocking
       and b.during && a.during
      where a.reservation_id = p_reservation
    ) then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set status = p_status where id = p_reservation;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  perform write_audit(
    v_old.restaurant_id, 'reservation.status', 'reservation',
    p_reservation, v_old.guest_name,
    'Merkitsi varauksen "' || v_old.guest_name || '" ('
      || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI') || ') tilaan '
      || case p_status
           when 'pending' then 'odottaa'
           when 'confirmed' then 'vahvistettu'
           when 'arrived' then 'saapui'
           when 'completed' then 'lähti'
           when 'cancelled' then 'peruttu'
           when 'no_show' then 'ei saapunut'
         end,
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', p_status),
    false
  );

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_day from public, anon;
revoke all on function reservation_admin_slots from public, anon;
revoke all on function reservation_free_tables from public, anon;
revoke all on function reservation_create_admin from public, anon;
revoke all on function reservation_update from public, anon;
revoke all on function reservation_set_status from public, anon;

grant execute on function reservation_day to authenticated;
grant execute on function reservation_admin_slots to authenticated;
grant execute on function reservation_free_tables to authenticated;
grant execute on function reservation_create_admin to authenticated;
grant execute on function reservation_update to authenticated;
grant execute on function reservation_set_status to authenticated;
