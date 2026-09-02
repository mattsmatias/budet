-- ---------------------------------------------------------------------------
-- Salin kalusteet
-- ---------------------------------------------------------------------------
--
-- Lohko päättyy tarkoitukselliseen poikkeukseen jonka viesti on
-- tulosrivi. Poikkeus peruu transaktion, joten testiaineisto ei jää
-- kantaan.
--
-- ---------------------------------------------------------------------------
-- POISTO ON SE JOKA VOI MENNÄ PAHASTI PIELEEN
-- ---------------------------------------------------------------------------
--
-- save_floor_elements poistaa ne kalusteet joita listassa ei ole. Se on
-- ainoa tapa jolla selaimen tila ja kanta päätyvät samaan
-- lopputulokseen yhdellä kutsulla — mutta se on myös se kohta jossa
-- väärä rajaus pyyhkisi toisen alueen kalusteet.
--
-- OK5 ja OK6 vartioivat juuri sitä: terassin tallennus ei saa koskea
-- salin kalusteisiin.

do $t$
declare
  r text := '';
  v_a uuid;
  v_u uuid := gen_random_uuid();
  v_alue uuid;
  v_id uuid;
  v_n int;
  v_label text;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Kalusteet', 'zz-kalusteet', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'zzkal@x.test', now(), now());

  insert into profiles (id, full_name) values (v_u, 'Omistaja')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values (v_a, v_u, 'owner');

  insert into dining_areas (restaurant_id, name)
  values (v_a, 'Terassi') returning id into v_alue;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u)::text, true);

  -- Lisäys nimineen. Tyhjä tunniste tarkoittaa uutta.
  perform save_floor_elements(v_a, null, jsonb_build_array(
    jsonb_build_object('id', '', 'kind', 'bar', 'label', 'Baari',
                       'x', 50, 'y', 20, 'width', 30, 'height', 10, 'rotation', 0),
    jsonb_build_object('id', '', 'kind', 'wall', 'label', '',
                       'x', 10, 'y', 50, 'width', 40, 'height', 3, 'rotation', 90)
  ));

  select count(*) into v_n from floor_elements where restaurant_id = v_a;
  if v_n = 2 then r := r || 'OK1 '; else r := r || 'FAIL1 ' || v_n || ' '; end if;

  select label into v_label from floor_elements where restaurant_id = v_a and kind = 'bar';
  if v_label = 'Baari'
    then r := r || 'OK2 '; else r := r || 'FAIL2 ' || coalesce(v_label, '-') || ' '; end if;

  select id into v_id from floor_elements where restaurant_id = v_a and kind = 'bar';

  -- Päivitys: nimi ja paikka. Seinä puuttuu listalta, joten se poistuu.
  perform save_floor_elements(v_a, null, jsonb_build_array(
    jsonb_build_object('id', v_id::text, 'kind', 'bar', 'label', 'Baaritiski',
                       'x', 60, 'y', 30, 'width', 35, 'height', 12, 'rotation', 0)
  ));

  select label into v_label from floor_elements where id = v_id;
  if v_label = 'Baaritiski'
    then r := r || 'OK3 '; else r := r || 'FAIL3 ' || coalesce(v_label, '-') || ' '; end if;

  select count(*) into v_n from floor_elements where restaurant_id = v_a;
  if v_n = 1 then r := r || 'OK4 '; else r := r || 'FAIL4 ' || v_n || ' '; end if;

  -- Terassin tallennus ei koske salin kalusteita
  perform save_floor_elements(v_a, v_alue, jsonb_build_array(
    jsonb_build_object('id', '', 'kind', 'wc', 'label', 'WC',
                       'x', 80, 'y', 80, 'width', 12, 'height', 14, 'rotation', 0)
  ));

  select count(*) into v_n from floor_elements where restaurant_id = v_a;
  if v_n = 2 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  select count(*) into v_n from floor_elements where restaurant_id = v_a and area_id = v_alue;
  if v_n = 1 then r := r || 'OK6 '; else r := r || 'FAIL6 ' || v_n || ' '; end if;

  -- Mahdoton koko torjutaan kannassa, ei vain lomakkeella
  begin
    perform save_floor_elements(v_a, null, jsonb_build_array(
      jsonb_build_object('id', '', 'kind', 'bar', 'label', '',
                         'x', 50, 'y', 50, 'width', 0.5, 'height', 10, 'rotation', 0)
    ));
    r := r || 'FAIL7 ';
  exception when check_violation then r := r || 'OK7 ';
  end;

  -- Toisen ravintolan tunnisteella ei saa kirjoittaa
  begin
    perform save_floor_elements(gen_random_uuid(), null, '[]'::jsonb);
    r := r || 'FAIL8 ';
  exception when others then r := r || 'OK8 ';
  end;

  raise exception 'TULOKSET: %', r;
end $t$;
