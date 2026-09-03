-- ---------------------------------------------------------------------------
-- 0095 — Pöytien ja varausten tuonti toisesta järjestelmästä
-- ---------------------------------------------------------------------------
--
-- Ravintola joka vaihtaa varausjärjestelmää ei aloita tyhjästä salista.
-- Sillä on pöydät, paikkaluvut ja kalenterillinen varauksia, ja ilman
-- niitä uusi järjestelmä on käyttökelvoton juuri sinä päivänä jona se
-- otetaan käyttöön.
--
-- ---------------------------------------------------------------------------
-- MIKSI TUONTI KULKEE VARAUSMOOTTORIN LÄPI
-- ---------------------------------------------------------------------------
--
-- Suora insert reservations-tauluun olisi nopeampi ja väärä: silloin
-- tuodulla varauksella ei olisi liitosriviä pöytään, eikä se veisi
-- pöytää keneltäkään. Sali näyttäisi tuodut varaukset listassa ja myisi
-- samat pöydät uudelleen verkossa.
--
-- Tuonti kutsuu siis reservation_book:ia kuten jokainen muukin varaus.
-- Siitä seuraa myös, että tuonti kunnioittaa päällekkäisyyttä: rivi joka
-- ei mahdu saliin ei mene läpi, ja sen näkee raportista.
--
-- ---------------------------------------------------------------------------
-- MIKSI RIVIN VIRHE EI KAADA TUONTIA
-- ---------------------------------------------------------------------------
--
-- Tuhannen rivin tiedostossa on aina rivejä joissa on tyhjä nimi tai
-- kahdesti sama pöytä. Jos yksi niistä peruisi koko tuonnin, ravintola
-- korjaisi tiedostoa rivi kerrallaan tietämättä montako muuta odottaa.
--
-- Jokainen rivi on siis oma alitransaktionsa: se joko menee läpi tai
-- palautuu yksin, ja raportti kertoo rivinumeroittain kumpi kävi.
--
-- ---------------------------------------------------------------------------
-- MIKSI SAMAN TIEDOSTON VOI TUODA KAHDESTI
-- ---------------------------------------------------------------------------
--
-- Tuonti keskeytyy: selain sulkeutuu, verkko katkeaa, tiedosto oli
-- puolikas. Ainoa turvallinen tapa jatkaa on ajaa sama tiedosto
-- uudelleen, joten rivi joka on jo kannassa (sama nimi, sama alkuhetki)
-- ohitetaan eikä kahdenneta.

-- ---------------------------------------------------------------------------
-- Pöydät
-- ---------------------------------------------------------------------------

create or replace function reservation_import_tables(
  p_restaurant uuid,
  p_rows jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row jsonb;
  v_index int := 0;
  v_name text;
  v_min int;
  v_max int;
  v_area text;
  v_area_id uuid;
  v_shape text;
  v_id uuid;
  v_added int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Virheellinen aineisto.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Liian monta rivia kerralla.' using errcode = '22003';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;

    begin
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      v_min := coalesce((v_row->>'seatsMin')::int, 1);
      v_max := coalesce((v_row->>'seatsMax')::int, v_min);
      v_area := nullif(trim(coalesce(v_row->>'area', '')), '');
      v_shape := lower(coalesce(nullif(trim(coalesce(v_row->>'shape', '')), ''), 'round'));

      if v_name is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'name');
        continue;
      end if;

      if v_min < 1 or v_max < v_min or v_max > 200 then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'seats');
        continue;
      end if;

      if v_shape not in ('round', 'square', 'rect') then
        v_shape := 'round';
      end if;

      /* Sama nimi kahdesti on tuonnin uusinta eikä uusi pöytä. */
      if exists (
        select 1 from restaurant_tables t
        where t.restaurant_id = p_restaurant
          and lower(t.name) = lower(v_name)
      ) then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', true, 'skipped', true, 'name', v_name);
        continue;
      end if;

      v_area_id := null;
      if v_area is not null then
        select a.id into v_area_id
        from dining_areas a
        where a.restaurant_id = p_restaurant and lower(a.name) = lower(v_area);

        if v_area_id is null then
          insert into dining_areas (restaurant_id, name)
          values (p_restaurant, left(v_area, 60))
          returning id into v_area_id;
        end if;
      end if;

      insert into restaurant_tables
        (restaurant_id, area_id, name, seats_min, seats_max, shape)
      values
        (p_restaurant, v_area_id, left(v_name, 60), v_min, v_max, v_shape::table_shape)
      returning id into v_id;

      v_added := v_added + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_index, 'ok', true, 'id', v_id, 'name', v_name);

    exception
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'failed');
    end;
  end loop;

  return json_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'failed', v_failed,
    'rows', v_results
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Varaukset
-- ---------------------------------------------------------------------------

create or replace function reservation_import_reservations(
  p_restaurant uuid,
  p_rows jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row jsonb;
  v_index int := 0;
  v_date date;
  v_time time;
  v_party int;
  v_name text;
  v_status reservation_status;
  v_start timestamptz;
  v_tables uuid[];
  v_missing text;
  v_id uuid;
  v_added int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Virheellinen aineisto.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 200 then
    raise exception 'Liian monta rivia kerralla.' using errcode = '22003';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;

    begin
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      v_date := (v_row->>'date')::date;
      v_time := (v_row->>'time')::time;
      v_party := coalesce((v_row->>'partySize')::int, 0);

      if v_name is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'name');
        continue;
      end if;

      if v_date is null or v_time is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'time');
        continue;
      end if;

      if v_party < 1 or v_party > 200 then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'party');
        continue;
      end if;

      v_status := coalesce(
        nullif(trim(coalesce(v_row->>'status', '')), ''), 'confirmed'
      )::reservation_status;

      v_start := reservation_start_at(p_restaurant, v_date, v_time);

      /* Sama nimi samaan hetkeen on jo tuotu. */
      if exists (
        select 1 from reservations r
        where r.restaurant_id = p_restaurant
          and r.starts_at = v_start
          and lower(r.guest_name) = lower(v_name)
      ) then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', true, 'skipped', true, 'name', v_name);
        continue;
      end if;

      /*
       * Pöydät nimeltä, jos tiedosto kertoo ne.
       *
       * Tuntematon pöydän nimi ei ole virhe vaan tieto siitä että
       * salinäkymä on eri: rivi menee läpi ilman pöytää, jolloin
       * moottori valitsee vapaan. Raportti kertoo rivin, jotta
       * ravintola voi tarkistaa sen.
       */
      v_tables := null;
      v_missing := null;

      if jsonb_typeof(v_row->'tables') = 'array'
         and jsonb_array_length(v_row->'tables') > 0 then
        select
          array_agg(t.id),
          string_agg(x.nimi, ', ') filter (where t.id is null)
        into v_tables, v_missing
        from jsonb_array_elements_text(v_row->'tables') as x(nimi)
        left join restaurant_tables t
          on t.restaurant_id = p_restaurant
         and lower(t.name) = lower(trim(x.nimi));

        v_tables := (
          select array_agg(id) from unnest(v_tables) as u(id) where id is not null
        );
      end if;

      v_id := reservation_book(
        p_restaurant,
        v_start,
        v_party,
        left(v_name, 120),
        left(trim(coalesce(v_row->>'phone', '')), 40),
        left(trim(coalesce(v_row->>'email', '')), 160),
        left(trim(coalesce(v_row->>'note', '')), 500),
        'admin'::reservation_source,
        v_status,
        nullif((v_row->>'minutes'), '')::int,
        v_tables,
        null,
        left(trim(coalesce(v_row->>'allergies', '')), 200)
      );

      v_added := v_added + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_index, 'ok', true, 'id', v_id, 'name', v_name,
        'unknownTables', v_missing);

    exception
      when exclusion_violation then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'taken');
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'failed');
    end;
  end loop;

  return json_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'failed', v_failed,
    'rows', v_results
  );
end;
$fn$;

revoke all on function reservation_import_tables(uuid, jsonb) from public, anon;
revoke all on function reservation_import_reservations(uuid, jsonb) from public, anon;

grant execute on function reservation_import_tables(uuid, jsonb) to authenticated;
grant execute on function reservation_import_reservations(uuid, jsonb) to authenticated;
