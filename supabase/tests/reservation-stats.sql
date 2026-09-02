-- ---------------------------------------------------------------------------
-- Varausanalytiikka
-- ---------------------------------------------------------------------------
--
-- Lohko päättyy tarkoitukselliseen poikkeukseen jonka viesti on
-- tulosrivi:
--
--   ERROR: TULOKSET: OK1 OK2 OK3 …
--
-- Poikkeus peruu transaktion, joten testiaineisto ei jää kantaan.
--
-- ---------------------------------------------------------------------------
-- ASETELMA
-- ---------------------------------------------------------------------------
--
-- Kaksi viikkoa: ma 05.10.2026 – su 18.10.2026. Auki vain perjantaisin
-- ja lauantaisin klo 18–19 (viimeinen istumisaika 19:00). Lauantai
-- 17.10. on poikkeuksena kiinni. Salissa kaksi neljän hengen pöytää,
-- eli kahdeksan paikkaa.
--
-- Kuusi varausta, joista kaksi ei pidä pöytää:
--
--   pe 09.10. 18:00–20:00  4 hlö  confirmed
--   pe 09.10. 18:00–20:00  4 hlö  arrived
--   la 10.10. 19:00–21:00  2 hlö  completed
--   la 17.10. 18:00–20:00  6 hlö  cancelled   <- ei vieras, ei täyttöaste
--   la 17.10. 19:00–20:00  3 hlö  no_show     <- ei vieras, ei täyttöaste
--   ma 05.10. 18:00–20:00  5 hlö  confirmed   <- maanantai on kiinni
--
-- Maanantain varaus on mukana tarkoituksella. Se on varausten
-- lukumäärässä ja vieraissa, mutta ei täyttöasteessa: suljettu päivä
-- ei ole nolla prosenttia täynnä.

do $t$
declare
  r text := '';
  v_a uuid;
  v_u uuid := gen_random_uuid();
  v_muu uuid := gen_random_uuid();
  v_t1 uuid; v_t2 uuid;
  v_res json;
  v_n numeric;
  v_json json;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Analyysi', 'zz-analyysi', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zza@x.test', now(), now()),
         (v_muu, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zzb@x.test', now(), now());

  insert into profiles (id, full_name) values (v_u, 'Omistaja'), (v_muu, 'Ulkopuolinen')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values (v_a, v_u, 'owner');

  insert into reservation_settings (restaurant_id, enabled, turnaround_minutes)
  values (v_a, true, 0)
  on conflict (restaurant_id) do update set turnaround_minutes = 0;

  -- Auki perjantaisin ja lauantaisin klo 18, viimeinen istumisaika 19
  insert into reservation_hours (restaurant_id, weekday, opens, last_seating)
  values (v_a, 5, '18:00', '19:00'), (v_a, 6, '18:00', '19:00');

  -- Lauantai 17.10. kiinni
  insert into reservation_exceptions (restaurant_id, exception_date, closed)
  values (v_a, '2026-10-17', true);

  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, 'P1', 1, 4, 1) returning id into v_t1;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, 'P2', 1, 4, 2) returning id into v_t2;

  insert into reservations (restaurant_id, starts_at, ends_at, party_size,
                            status, source, guest_name)
  values
    (v_a, '2026-10-09 18:00+03', '2026-10-09 20:00+03', 4, 'confirmed', 'admin', 'A'),
    (v_a, '2026-10-09 18:00+03', '2026-10-09 20:00+03', 4, 'arrived',   'admin', 'B'),
    (v_a, '2026-10-10 19:00+03', '2026-10-10 21:00+03', 2, 'completed', 'widget', 'C'),
    (v_a, '2026-10-17 18:00+03', '2026-10-17 20:00+03', 6, 'cancelled', 'widget', 'D'),
    (v_a, '2026-10-17 19:00+03', '2026-10-17 20:00+03', 3, 'no_show',   'admin', 'E'),
    (v_a, '2026-10-05 18:00+03', '2026-10-05 20:00+03', 5, 'confirmed', 'admin', 'F');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  v_res := reservation_stats(v_a, '2026-10-05', '2026-10-18');

  -- Perusluvut
  if (v_res->'totals'->>'reservations')::int = 6 then r := r || 'OK1 ';
  else r := r || 'FAIL1 ' || (v_res->'totals'->>'reservations') || ' '; end if;

  if (v_res->'totals'->>'cancelled')::int = 1 then r := r || 'OK2 ';
  else r := r || 'FAIL2 ' || (v_res->'totals'->>'cancelled') || ' '; end if;

  if (v_res->'totals'->>'noShow')::int = 1 then r := r || 'OK3 ';
  else r := r || 'FAIL3 ' || (v_res->'totals'->>'noShow') || ' '; end if;

  /* Vieraat: peruttu ja saapumatta jäänyt eivät syöneet. 4+4+2+5 */
  if (v_res->'totals'->>'guests')::int = 15 then r := r || 'OK4 ';
  else r := r || 'FAIL4 ' || (v_res->'totals'->>'guests') || ' '; end if;

  /* Keskimääräinen seuruekoko lasketaan sovelluksessa: 15 / 4 */
  if (v_res->'totals'->>'partyCount')::int = 4 then r := r || 'OK5 ';
  else r := r || 'FAIL5 ' || (v_res->'totals'->>'partyCount') || ' '; end if;

  -- Kapasiteetti
  if (v_res->'capacity'->>'seats')::int = 8
     and (v_res->'capacity'->>'tables')::int = 2 then r := r || 'OK6 ';
  else r := r || 'FAIL6 ' || (v_res->'capacity')::text || ' '; end if;

  -- Suosituin aika: klo 18 kolme varausta, klo 19 yksi
  select (x->>'reservations')::int into v_n
  from json_array_elements(v_res->'byHour') x where (x->>'hour')::int = 18;
  if v_n = 3 then r := r || 'OK7 '; else r := r || 'FAIL7 ' || coalesce(v_n::text,'-') || ' '; end if;

  select (x->>'guests')::int into v_n
  from json_array_elements(v_res->'byHour') x where (x->>'hour')::int = 18;
  if v_n = 13 then r := r || 'OK8 '; else r := r || 'FAIL8 ' || coalesce(v_n::text,'-') || ' '; end if;

  /* Peruttu ei ole tunnissa mukana: klo 19 vain lauantain kahden hengen. */
  select (x->>'reservations')::int into v_n
  from json_array_elements(v_res->'byHour') x where (x->>'hour')::int = 19;
  if v_n = 1 then r := r || 'OK9 '; else r := r || 'FAIL9 ' || coalesce(v_n::text,'-') || ' '; end if;

  -- Suosituin päivä: perjantai kaksi varausta, kahdeksan vierasta
  select x into v_json
  from json_array_elements(v_res->'byWeekday') x where (x->>'weekday')::int = 5;
  if (v_json->>'reservations')::int = 2 and (v_json->>'guests')::int = 8
    then r := r || 'OK10 '; else r := r || 'FAIL10 ' || coalesce(v_json::text,'-') || ' '; end if;

  /* Aukiolopäivät erikseen kalenteripäivistä: perjantaita kaksi, molemmat auki. */
  if (v_json->>'days')::int = 2 and (v_json->>'openDays')::int = 2
    then r := r || 'OK11 '; else r := r || 'FAIL11 ' || v_json::text || ' '; end if;

  /* Lauantaita kaksi, mutta 17.10. on kiinni. */
  select x into v_json
  from json_array_elements(v_res->'byWeekday') x where (x->>'weekday')::int = 6;
  if (v_json->>'days')::int = 2 and (v_json->>'openDays')::int = 1
    then r := r || 'OK12 '; else r := r || 'FAIL12 ' || coalesce(v_json::text,'-') || ' '; end if;

  /* Maanantain varaus on luvuissa vaikka maanantai on kiinni. */
  select x into v_json
  from json_array_elements(v_res->'byWeekday') x where (x->>'weekday')::int = 1;
  if (v_json->>'reservations')::int = 1 and (v_json->>'openDays')::int = 0
    then r := r || 'OK13 '; else r := r || 'FAIL13 ' || coalesce(v_json::text,'-') || ' '; end if;

  -- Täyttöaste: perjantai klo 18 = (8 + 0) / 2 päivää = 4 paikkaa
  select (x->>'seats')::numeric into v_n
  from json_array_elements(v_res->'occupancy') x
  where (x->>'weekday')::int = 5 and (x->>'hour')::int = 18;
  if v_n = 4 then r := r || 'OK14 '; else r := r || 'FAIL14 ' || coalesce(v_n::text,'-') || ' '; end if;

  /* Kahden tunnin varaus vie paikat myös toiselta tunnilta. */
  select (x->>'seats')::numeric into v_n
  from json_array_elements(v_res->'occupancy') x
  where (x->>'weekday')::int = 5 and (x->>'hour')::int = 19;
  if v_n = 4 then r := r || 'OK15 '; else r := r || 'FAIL15 ' || coalesce(v_n::text,'-') || ' '; end if;

  /* Kiinni ollut lauantai ei laske keskiarvoa: 2 paikkaa / 1 päivä. */
  select (x->>'seats')::numeric into v_n
  from json_array_elements(v_res->'occupancy') x
  where (x->>'weekday')::int = 6 and (x->>'hour')::int = 19;
  if v_n = 2 then r := r || 'OK16 '; else r := r || 'FAIL16 ' || coalesce(v_n::text,'-') || ' '; end if;

  select (x->>'days')::int into v_n
  from json_array_elements(v_res->'occupancy') x
  where (x->>'weekday')::int = 6 and (x->>'hour')::int = 19;
  if v_n = 1 then r := r || 'OK17 '; else r := r || 'FAIL17 ' || coalesce(v_n::text,'-') || ' '; end if;

  /* Suljettu päivä ei ole rivinä lainkaan. */
  select count(*) into v_n
  from json_array_elements(v_res->'occupancy') x where (x->>'weekday')::int = 1;
  if v_n = 0 then r := r || 'OK18 '; else r := r || 'FAIL18 ' || v_n || ' '; end if;

  /* Viimeisen istumisajan jälkeistä tuntia ei mitata. */
  select count(*) into v_n
  from json_array_elements(v_res->'occupancy') x where (x->>'hour')::int = 20;
  if v_n = 0 then r := r || 'OK19 '; else r := r || 'FAIL19 ' || v_n || ' '; end if;

  -- Lähde: kaksi widgetin kautta, neljä hallinnasta
  select (x->>'count')::int into v_n
  from json_array_elements(v_res->'bySource') x where x->>'source' = 'widget';
  if v_n = 2 then r := r || 'OK20 '; else r := r || 'FAIL20 ' || coalesce(v_n::text,'-') || ' '; end if;

  -- Ulkopuolinen ei näe mitään
  perform set_config('request.jwt.claims', json_build_object('sub', v_muu)::text, true);
  begin
    perform reservation_stats(v_a, '2026-10-05', '2026-10-18');
    r := r || 'FAIL21 ';
  exception when insufficient_privilege then r := r || 'OK21 ';
  end;

  -- Käänteinen aikaväli hylätään
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);
  begin
    perform reservation_stats(v_a, '2026-10-18', '2026-10-05');
    r := r || 'FAIL22 ';
  exception when others then r := r || 'OK22 ';
  end;

  -- Liian pitkä aikaväli hylätään
  begin
    perform reservation_stats(v_a, '2020-01-01', '2026-10-18');
    r := r || 'FAIL23 ';
  exception when others then r := r || 'OK23 ';
  end;

  raise exception 'TULOKSET: %', r;
end $t$;
