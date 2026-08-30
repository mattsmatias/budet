-- ---------------------------------------------------------------------------
-- Varausten rivitason käytännöt
-- ---------------------------------------------------------------------------
--
-- Kaksi lohkoa, kumpikin päättyy tarkoitukselliseen poikkeukseen jonka
-- viesti on tulosrivi. Poikkeus peruu transaktion, joten testiaineisto
-- ei jää kantaan. Aja lohkot erikseen — ensimmäisen poikkeus lopettaa
-- ajon, joten jälkimmäinen tarvitsee oman kutsunsa.
--
-- OLENNAISTA: molemmat vaihtavat roolin. Pääkäyttäjänä ajettuna
-- rivitason käytännöt ohitetaan kokonaan, ja testi menisi läpi vaikka
-- yhtään käytäntöä ei olisi. set local role + request.jwt.claims tekee
-- ajosta sellaisen kuin se on sovelluksesta tultaessa.

-- ===========================================================================
-- 1. Ravintoloiden eristys ja roolit
-- ===========================================================================

do $t$
declare
  r text := '';
  v_a uuid; v_b uuid;
  v_ua uuid := gen_random_uuid();  -- omistaja A
  v_ub uuid := gen_random_uuid();  -- omistaja B
  v_uc uuid := gen_random_uuid();  -- työntekijä A:ssa
  v_d date := current_date + 7;
  v_res uuid;
  v_n int; v_j json;
begin
  insert into restaurants (name, slug, timezone)
  values ('RLS A', 'zz-rls-a', 'Europe/Helsinki') returning id into v_a;
  insert into restaurants (name, slug, timezone)
  values ('RLS B', 'zz-rls-b', 'Europe/Helsinki') returning id into v_b;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zza@x.test', now(), now()),
    (v_ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzb@x.test', now(), now()),
    (v_uc, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzc@x.test', now(), now());

  /* Liipaisin auth.users-taulussa luo profiilin, joten tämä täydentää. */
  insert into profiles (id, full_name) values
    (v_ua, 'Omistaja A'), (v_ub, 'Omistaja B'), (v_uc, 'Tarjoilija C')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_ua, 'owner'), (v_b, v_ub, 'owner'), (v_a, v_uc, 'employee');

  insert into reservation_settings (restaurant_id, enabled, lead_minutes)
  values (v_a, true, 0);
  insert into reservation_hours (restaurant_id, weekday, opens, last_seating)
  select v_a, g, time '17:00', time '21:00' from generate_series(1,7) g;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max)
  values (v_a, 'A1', 1, 4);
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max)
  values (v_b, 'B1', 1, 4);

  v_res := reservation_book(v_a, (v_d + time '18:00') at time zone 'Europe/Helsinki',
    2, 'Asiakas', '0401234567', 'asiakas@x.test', null, 'widget');

  -- ---- Omistaja A ----
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ua)::text, true);

  select count(*) into v_n from restaurant_tables;
  if v_n = 1 then r := r || 'OK1 '; else r := r || 'FAIL1(' || v_n || ') '; end if;

  select count(*) into v_n from reservations;
  if v_n = 1 then r := r || 'OK2 '; else r := r || 'FAIL2 '; end if;

  begin
    insert into restaurant_tables (restaurant_id, name, seats_min, seats_max)
    values (v_b, 'Tunkeutuja', 1, 4);
    r := r || 'FAIL3 ';
  exception when insufficient_privilege then r := r || 'OK3 ';
  end;

  /* Toisen ravintolan rivi ei näy, joten päivitys ei osu mihinkään. */
  update reservations set guest_name = 'Kaapattu' where restaurant_id = v_b;
  if not found then r := r || 'OK4 '; else r := r || 'FAIL4 '; end if;

  -- Esihenkilö näkee yhteystiedot.
  v_j := reservation_day(v_a, v_d);
  if v_j->'reservations'->0->>'guestPhone' = '0401234567'
    then r := r || 'OK5 '; else r := r || 'FAIL5 '; end if;
  if (v_j->>'canManage')::boolean then r := r || 'OK6 '; else r := r || 'FAIL6 '; end if;

  begin
    perform reservation_day(v_b, v_d);
    r := r || 'FAIL7 ';
  exception when insufficient_privilege then r := r || 'OK7 ';
  end;

  -- ---- Omistaja B: ei näe eikä muuta A:n mitään ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_ub)::text, true);

  select count(*) into v_n from reservations;
  if v_n = 0 then r := r || 'OK8 '; else r := r || 'FAIL8(' || v_n || ') '; end if;

  select count(*) into v_n from restaurant_tables;
  if v_n = 1 then r := r || 'OK9 '; else r := r || 'FAIL9 '; end if;

  select count(*) into v_n from reservation_table_assignments;
  if v_n = 0 then r := r || 'OK10 '; else r := r || 'FAIL10 '; end if;

  begin
    perform reservation_set_status(v_res, 'cancelled');
    r := r || 'FAIL11 ';
  exception when insufficient_privilege then r := r || 'OK11 ';
  end;

  begin
    perform reservation_update(v_res, null, null, 99);
    r := r || 'FAIL12 ';
  exception when insufficient_privilege then r := r || 'OK12 ';
  end;

  begin
    perform reservation_free_tables(v_res);
    r := r || 'FAIL13 ';
  exception when insufficient_privilege then r := r || 'OK13 ';
  end;

  begin
    perform reservation_create_admin(v_a, v_d, time '19:00', 2, 'Tunkeutuja');
    r := r || 'FAIL14 ';
  exception when insufficient_privilege then r := r || 'OK14 ';
  end;

  -- ---- Työntekijä: näkee illan, ei yhteystietoja, ei muokkaa ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_uc)::text, true);

  select count(*) into v_n from restaurant_tables;
  if v_n = 1 then r := r || 'OK15 '; else r := r || 'FAIL15 '; end if;

  /* Taulun lukuoikeus on esihenkilötasolla. */
  select count(*) into v_n from reservations;
  if v_n = 0 then r := r || 'OK16 '; else r := r || 'FAIL16(' || v_n || ') '; end if;

  /* Funktio antaa illan listan mutta karsii yhteystiedot. */
  v_j := reservation_day(v_a, v_d);
  if json_array_length(v_j->'reservations') = 1 then r := r || 'OK17 '; else r := r || 'FAIL17 '; end if;
  if v_j->'reservations'->0->>'guestName' = 'Asiakas' then r := r || 'OK18 '; else r := r || 'FAIL18 '; end if;
  if v_j->'reservations'->0->>'guestPhone' is null then r := r || 'OK19 '; else r := r || 'FAIL19 '; end if;
  if v_j->'reservations'->0->>'guestEmail' is null then r := r || 'OK20 '; else r := r || 'FAIL20 '; end if;
  if not (v_j->>'canManage')::boolean then r := r || 'OK21 '; else r := r || 'FAIL21 '; end if;

  begin
    insert into restaurant_tables (restaurant_id, name, seats_min, seats_max)
    values (v_a, 'Tarjoilijan poyta', 1, 4);
    r := r || 'FAIL22 ';
  exception when insufficient_privilege then r := r || 'OK22 ';
  end;

  begin
    perform reservation_set_status(v_res, 'arrived');
    r := r || 'FAIL23 ';
  exception when insufficient_privilege then r := r || 'OK23 ';
  end;

  reset role;
  raise exception 'TULOKSET: %', r;
end;
$t$;

-- ===========================================================================
-- 2. Julkinen pinta: anonilla ei ole tauluja
-- ===========================================================================
--
-- Supabase myöntää oletusarvoisesti anon-roolille kaikki oikeudet
-- jokaiseen uuteen public-tauluun. Ne on viety pois migraatiossa 0066,
-- ja tämä varmistaa ettei niitä palaudu vahingossa.

do $t$
declare
  r text := '';
  v_a uuid; v_n int; v_j json; v_d date := current_date + 7;
begin
  insert into restaurants (name, slug, timezone)
  values ('Anon A', 'zz-anon-a', 'Europe/Helsinki') returning id into v_a;
  insert into reservation_settings (restaurant_id, enabled, lead_minutes)
  values (v_a, true, 0);
  insert into reservation_hours (restaurant_id, weekday, opens, last_seating)
  select v_a, g, time '17:00', time '21:00' from generate_series(1,7) g;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max)
  values (v_a, 'A1', 1, 4);
  perform reservation_book(v_a, (v_d + time '18:00') at time zone 'Europe/Helsinki',
    2, 'Asiakas', '0401234567', 'a@x.test', null, 'widget');

  set local role anon;
  perform set_config('request.jwt.claims', null, true);

  begin
    select count(*) into v_n from reservations; r := r || 'FAIL1 ';
  exception when insufficient_privilege then r := r || 'OK1 '; end;
  begin
    select count(*) into v_n from restaurant_tables; r := r || 'FAIL2 ';
  exception when insufficient_privilege then r := r || 'OK2 '; end;
  begin
    select count(*) into v_n from reservation_settings; r := r || 'FAIL3 ';
  exception when insufficient_privilege then r := r || 'OK3 '; end;
  begin
    select count(*) into v_n from reservation_table_assignments; r := r || 'FAIL4 ';
  exception when insufficient_privilege then r := r || 'OK4 '; end;
  begin
    select count(*) into v_n from reservation_status_history; r := r || 'FAIL5 ';
  exception when insufficient_privilege then r := r || 'OK5 '; end;
  begin
    insert into reservations (restaurant_id, starts_at, ends_at, party_size, guest_name)
    values (v_a, now(), now() + interval '1 hour', 2, 'Tunkeutuja');
    r := r || 'FAIL6 ';
  exception when insufficient_privilege then r := r || 'OK6 '; end;
  begin
    update reservations set guest_name = 'X'; r := r || 'FAIL7 ';
  exception when insufficient_privilege then r := r || 'OK7 '; end;
  begin
    delete from reservations; r := r || 'FAIL8 ';
  exception when insufficient_privilege then r := r || 'OK8 '; end;

  /* Moottorin sisäiset funktiot eivät ole anonin kutsuttavissa. */
  begin
    perform reservation_book(v_a, now() + interval '2 days', 2, 'Z', null, null, null, 'widget');
    r := r || 'FAIL9 ';
  exception when insufficient_privilege then r := r || 'OK9 '; end;
  begin
    perform reservation_day(v_a, v_d); r := r || 'FAIL10 ';
  exception when insufficient_privilege then r := r || 'OK10 '; end;
  begin
    perform reservation_pick_tables(v_a, now(), now() + interval '2 hours', 2);
    r := r || 'FAIL11 ';
  exception when insufficient_privilege then r := r || 'OK11 '; end;

  /* Julkiset funktiot toimivat yhä: varaaminen ei vaadi kirjautumista. */
  v_j := public_reservation_config('zz-anon-a');
  if (v_j->>'enabled')::boolean then r := r || 'OK12 '; else r := r || 'FAIL12 '; end if;

  v_j := public_reservation_slots('zz-anon-a', v_d, 2);
  if json_array_length(v_j->'slots') > 0 then r := r || 'OK13 '; else r := r || 'FAIL13 '; end if;

  v_j := public_create_reservation('zz-anon-a', v_d, time '20:00', 2, 'Anon', '040');
  if (v_j->>'ok')::boolean then r := r || 'OK14 '; else r := r || 'FAIL14 '; end if;

  v_j := public_cancel_reservation(v_j->>'cancelToken');
  if (v_j->>'ok')::boolean then r := r || 'OK15 '; else r := r || 'FAIL15 '; end if;

  reset role;
  raise exception 'TULOKSET: %', r;
end;
$t$;
