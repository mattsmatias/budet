-- ---------------------------------------------------------------------------
-- Keittiön kapasiteetti
-- ---------------------------------------------------------------------------
--
-- Lohko päättyy tarkoitukselliseen poikkeukseen jonka viesti on
-- tulosrivi. Poikkeus peruu transaktion, joten testiaineisto ei jää
-- kantaan.
--
-- ---------------------------------------------------------------------------
-- OK4 JA OK5 OVAT SE SYY MIKSI TÄMÄ TIEDOSTO ON OLEMASSA
-- ---------------------------------------------------------------------------
--
-- Ensimmäinen toteutus laski ikkunan puoliavoimena. Silloin klo 18:30
-- mitattuna 18:00 alkanut varaus laskettiin mukaan, mutta klo 18:00
-- mitattuna 18:30 ei — sama pari varauksia oli yhtä aikaa sekä liikaa
-- että sopivasti riippuen siitä kummasta päästä katsoi.
--
-- Silmällä sitä ei olisi huomannut. Kaksi mittausta samasta parista
-- eri suunnista on koko testin ydin.
--
-- Asetelma on tehtävänannon esimerkki: keittiö 40, ja varauksia
-- 18:00 → 24 hlö, 18:30 → 12 hlö.

do $t$
declare
  r text := '';
  v_a uuid;
  v_u uuid := gen_random_uuid();
  v_start timestamptz := '2026-10-15 18:00:00+03';
  v_n int;
  v_json json;
  v_id uuid;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Keittio', 'zz-keittio', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zzkt@x.test', now(), now());

  insert into profiles (id, full_name) values (v_u, 'Omistaja')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values (v_a, v_u, 'owner');

  insert into reservation_settings
    (restaurant_id, enabled, turnaround_minutes, kitchen_capacity, kitchen_window_minutes)
  values (v_a, true, 0, 40, 60)
  on conflict (restaurant_id) do update
    set kitchen_capacity = 40, kitchen_window_minutes = 60, turnaround_minutes = 0;

  /* Isoja pöytiä, jottei pöytäkapasiteetti rajoita tätä testiä. */
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  select v_a, 'P' || g, 1, 30, g from generate_series(1, 12) g;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  select kitchen_load(v_a, v_start) into v_n;
  if v_n = 0 then r := r || 'OK1 '; else r := r || 'FAIL1 ' || v_n || ' '; end if;

  v_json := kitchen_check(v_a, v_start, 10);
  if (v_json->>'ok')::boolean and (v_json->>'remaining')::int = 40
    then r := r || 'OK2 '; else r := r || 'FAIL2 ' || v_json::text || ' '; end if;

  reset role;
  perform reservation_book(v_a, v_start, 24, 'Iso seurue', null, null, null, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  select kitchen_load(v_a, v_start) into v_n;
  if v_n = 24 then r := r || 'OK3 '; else r := r || 'FAIL3 ' || v_n || ' '; end if;

  reset role;
  perform reservation_book(v_a, v_start + interval '30 minutes', 12,
                           'Toinen', null, null, null, 'admin');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- Sama pari, mitattuna myöhemmästä päästä
  select kitchen_load(v_a, v_start + interval '30 minutes') into v_n;
  if v_n = 36 then r := r || 'OK4 '; else r := r || 'FAIL4 ' || v_n || ' '; end if;

  -- Sama pari, mitattuna aiemmasta päästä. Tässä epäsymmetria näkyi.
  select kitchen_load(v_a, v_start) into v_n;
  if v_n = 36 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  v_json := kitchen_check(v_a, v_start + interval '30 minutes', 16);
  if not (v_json->>'ok')::boolean
    then r := r || 'OK6 '; else r := r || 'FAIL6 ' || v_json::text || ' '; end if;

  -- Verkosta ei pääse läpi
  reset role;
  begin
    perform reservation_book(v_a, v_start + interval '30 minutes', 16,
                             'Verkosta', null, null, null, 'widget');
    r := r || 'FAIL7 ';
  exception when exclusion_violation then r := r || 'OK7 ';
  end;

  -- Sali saa silti kirjata sen käsin: esihenkilö tietää enemmän kuin Kate
  begin
    v_id := reservation_book(v_a, v_start + interval '30 minutes', 16,
                             'Salista', null, null, null, 'admin');
    if v_id is not null then r := r || 'OK8 '; else r := r || 'FAIL8 '; end if;
  exception when others then r := r || 'FAIL8b ';
  end;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- Ikkunan ulkopuolella keittiö on taas vapaa
  select kitchen_load(v_a, v_start + interval '3 hours') into v_n;
  if v_n = 0 then r := r || 'OK9 '; else r := r || 'FAIL9 ' || v_n || ' '; end if;

  -- Peruttu ei kuormita ketään
  reset role;
  update reservations set status = 'cancelled'
  where restaurant_id = v_a and party_size = 24;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  select kitchen_load(v_a, v_start) into v_n;
  if v_n = 28 then r := r || 'OK10 '; else r := r || 'FAIL10 ' || v_n || ' '; end if;

  -- Ilman asetettua rajaa mikään ei estä
  reset role;
  update reservation_settings set kitchen_capacity = null where restaurant_id = v_a;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  v_json := kitchen_check(v_a, v_start, 500);
  if (v_json->>'ok')::boolean and not (v_json->>'limited')::boolean
    then r := r || 'OK11 '; else r := r || 'FAIL11 ' || v_json::text || ' '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;
