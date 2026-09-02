-- ---------------------------------------------------------------------------
-- Pöytäehdotukset
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
-- ASETELMA ON SE JONKA RAVINTOLOITSIJA ANTOI
-- ---------------------------------------------------------------------------
--
-- Neljä neljän hengen pöytää: 12, 13, 18 ja 19. Kaksi yhdistelmää:
-- 12+13 ja 18+19, kumpikin kahdeksalle. Kahdeksan hengen seurueelle
-- pitää tarjota molemmat — ja kun pöytä 12 varataan, vain 18+19.

do $t$
declare
  r text := '';
  v_a uuid;
  v_u uuid := gen_random_uuid();
  v_t12 uuid; v_t13 uuid; v_t18 uuid; v_t19 uuid;
  v_c1 uuid; v_c2 uuid;
  v_res uuid;
  v_start timestamptz := '2026-10-10 18:00:00+03';
  v_end timestamptz := '2026-10-10 20:00:00+03';
  v_n int;
  v_label text;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Kartta', 'zz-kartta', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zzk@x.test', now(), now());

  insert into profiles (id, full_name) values (v_u, 'Omistaja')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values (v_a, v_u, 'owner');

  /* Tyhjennysväli nollaan: se on oma sääntönsä eikä tämän testin aihe. */
  insert into reservation_settings (restaurant_id, enabled, turnaround_minutes)
  values (v_a, true, 0)
  on conflict (restaurant_id) do update set turnaround_minutes = 0;

  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, '12', 1, 4, 1) returning id into v_t12;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, '13', 1, 4, 2) returning id into v_t13;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, '18', 1, 4, 3) returning id into v_t18;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_a, '19', 1, 4, 4) returning id into v_t19;

  insert into table_combinations (restaurant_id, seats_min, seats_max, active)
  values (v_a, 5, 8, true) returning id into v_c1;
  insert into table_combination_members (combination_id, table_id)
  values (v_c1, v_t12), (v_c1, v_t13);

  insert into table_combinations (restaurant_id, seats_min, seats_max, active)
  values (v_a, 5, 8, true) returning id into v_c2;
  insert into table_combination_members (combination_id, table_id)
  values (v_c2, v_t18), (v_c2, v_t19);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- Kahdeksalle: molemmat yhdistelmät, ei yksittäisiä
  select count(*) into v_n from reservation_table_options(v_a, v_start, v_end, 8);
  if v_n = 2 then r := r || 'OK1 '; else r := r || 'FAIL1 ' || v_n || ' '; end if;

  /* Nimi kootaan pöytien nimistä: "12 + 13" on se miten siitä puhutaan. */
  select string_agg(label, ' | ' order by label) into v_label
  from reservation_table_options(v_a, v_start, v_end, 8);
  if v_label = '12 + 13 | 18 + 19'
    then r := r || 'OK2 '; else r := r || 'FAIL2 ' || coalesce(v_label, '-') || ' '; end if;

  -- Neljälle: neljä yksittäistä, yhdistelmät eivät mahdu (seats_min 5)
  select count(*) into v_n from reservation_table_options(v_a, v_start, v_end, 4);
  if v_n = 4 then r := r || 'OK3 '; else r := r || 'FAIL3 ' || v_n || ' '; end if;

  /* Yksittäinen pöytä ennen yhdistelmää kun hukka on sama. */
  select kind into v_label from reservation_table_options(v_a, v_start, v_end, 4) limit 1;
  if v_label = 'table' then r := r || 'OK4 '; else r := r || 'FAIL4 ' || v_label || ' '; end if;

  -- Varataan pöytä 12: yhdistelmä 12+13 ei ole enää kokonaan vapaa
  reset role;
  insert into reservations (restaurant_id, starts_at, ends_at, party_size,
                            status, source, guest_name)
  values (v_a, v_start, v_end, 2, 'confirmed', 'admin', 'Testi') returning id into v_res;
  insert into reservation_table_assignments (reservation_id, table_id, starts_at, ends_at)
  values (v_res, v_t12, v_start, v_end);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  select count(*) into v_n from reservation_table_options(v_a, v_start, v_end, 8);
  if v_n = 1 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  select label into v_label from reservation_table_options(v_a, v_start, v_end, 8) limit 1;
  if v_label = '18 + 19'
    then r := r || 'OK6 '; else r := r || 'FAIL6 ' || coalesce(v_label, '-') || ' '; end if;

  -- Varattu pöytä ei ole enää yksittäisissäkään
  select count(*) into v_n from reservation_table_options(v_a, v_start, v_end, 4);
  if v_n = 3 then r := r || 'OK7 '; else r := r || 'FAIL7 ' || v_n || ' '; end if;

  -- Eri aika: kaikki taas vapaana
  select count(*) into v_n
  from reservation_table_options(v_a, v_start + interval '4 hours',
                                 v_end + interval '4 hours', 8);
  if v_n = 2 then r := r || 'OK8 '; else r := r || 'FAIL8 ' || v_n || ' '; end if;

  -- Toisen ravintolan tunnisteella ei saa mitään
  begin
    perform reservation_table_options(gen_random_uuid(), v_start, v_end, 8);
    r := r || 'FAIL9 ';
  exception when others then r := r || 'OK9 ';
  end;

  raise exception 'TULOKSET: %', r;
end $t$;
