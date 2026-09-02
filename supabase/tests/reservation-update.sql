-- ---------------------------------------------------------------------------
-- Varauksen siirto: aika ja pöytä
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
-- MIKSI TÄMÄ TESTI ON OLEMASSA
-- ---------------------------------------------------------------------------
--
-- reservation_update kaatui poikkeukseen aina kun sille annettiin
-- pöytälista: muutoslokia koottiin rivillä
--
--   v_muutos := v_muutos || 'pöytä';
--
-- jossa v_muutos on text[] ja literaali tyypitön, jolloin Postgres
-- yrittää lukea sanan taulukoksi. Poikkeus nousi vasta onnistuneen
-- päivityksen jälkeen, joten muutos peruuntui hiljaa ja käyttöliittymä
-- näytti vain "Toiminto ei onnistunut".
--
-- Virhe ei näy funktion lukemisesta eikä tyyppitarkistuksesta. Se näkyy
-- vain ajamalla, ja siksi tämä testi ajaa sen.

do $t$
declare
  r text := '';
  v_a uuid;
  v_u uuid := gen_random_uuid();
  v_t1 uuid; v_t2 uuid;
  v_res uuid; v_toinen uuid;
  v_start timestamptz := '2026-10-10 18:00:00+03';
  v_end timestamptz := '2026-10-10 20:00:00+03';
  v_json json;
  v_teksti text;
  v_n int;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Siirto', 'zz-siirto', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zzs@x.test', now(), now());

  insert into profiles (id, full_name) values (v_u, 'Omistaja')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values (v_a, v_u, 'owner');

  insert into reservation_settings (restaurant_id, enabled, turnaround_minutes)
  values (v_a, true, 0)
  on conflict (restaurant_id) do update set turnaround_minutes = 0;

  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, 'Pöytä 1', 1, 4, 1) returning id into v_t1;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, 'Pöytä 2', 1, 4, 2) returning id into v_t2;

  insert into reservations (restaurant_id, starts_at, ends_at, party_size,
                            status, source, guest_name)
  values (v_a, v_start, v_end, 2, 'confirmed', 'admin', 'Virtanen')
  returning id into v_res;
  insert into reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
  values (v_res, v_t1, v_start, v_end);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- Pelkkä pöydän vaihto: tämä oli se joka kaatui
  v_json := reservation_update(v_res, null, null, null, null, null, null, null,
                               array[v_t2]);
  if (v_json->>'ok')::boolean then r := r || 'OK1 ';
  else r := r || 'FAIL1 ' || v_json::text || ' '; end if;

  reset role;
  select string_agg(t.name, '+') into v_teksti
  from reservation_table_assignments a
  join restaurant_tables t on t.id = a.table_id
  where a.reservation_id = v_res;
  if v_teksti = 'Pöytä 2' then r := r || 'OK2 ';
  else r := r || 'FAIL2 ' || coalesce(v_teksti, '-') || ' '; end if;

  -- Aika ja pöytä samalla kutsulla: juuri se mitä kalenterin raahaus tekee
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);
  v_json := reservation_update(v_res, null, '15:15'::time, null, null, null, null,
                               null, array[v_t1]);
  if (v_json->>'ok')::boolean then r := r || 'OK3 ';
  else r := r || 'FAIL3 ' || v_json::text || ' '; end if;

  reset role;
  select to_char(starts_at at time zone 'Europe/Helsinki', 'HH24:MI')
    into v_teksti from reservations where id = v_res;
  if v_teksti = '15:15' then r := r || 'OK4 ';
  else r := r || 'FAIL4 ' || coalesce(v_teksti, '-') || ' '; end if;

  /* Kesto säilyy: kaksi tuntia sisään, kaksi tuntia ulos. */
  select (extract(epoch from (ends_at - starts_at)) / 60)::int
    into v_n from reservations where id = v_res;
  if v_n = 120 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  /* Vanha pöytä ei jää roikkumaan. */
  select count(*) into v_n from reservation_table_assignments
  where reservation_id = v_res;
  if v_n = 1 then r := r || 'OK6 '; else r := r || 'FAIL6 ' || v_n || ' '; end if;

  -- Varattuun pöytään ei pääse
  insert into reservations (restaurant_id, starts_at, ends_at, party_size,
                            status, source, guest_name)
  values (v_a, v_start, v_end, 2, 'confirmed', 'admin', 'Korhonen')
  returning id into v_toinen;
  insert into reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
  values (v_toinen, v_t2, v_start, v_end);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);
  v_json := reservation_update(v_res, null, '18:00'::time, null, null, null, null,
                               null, array[v_t2]);
  if (v_json->>'error') = 'taken' then r := r || 'OK7 ';
  else r := r || 'FAIL7 ' || v_json::text || ' '; end if;

  -- Vieras pöytä hylätään: pöytä on toisen ravintolan
  v_json := reservation_update(v_res, null, null, null, null, null, null, null,
                               array[gen_random_uuid()]);
  if (v_json->>'error') = 'table' then r := r || 'OK8 ';
  else r := r || 'FAIL8 ' || v_json::text || ' '; end if;

  -- Muutosloki kertoo mitä muuttui
  reset role;
  select summary into v_teksti from audit_log
  where entity_id = v_res and action = 'reservation.update'
  order by created_at desc limit 1;
  if v_teksti like '%pöytä%' then r := r || 'OK9 ';
  else r := r || 'FAIL9 ' || coalesce(v_teksti, '-') || ' '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;
