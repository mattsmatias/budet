-- ---------------------------------------------------------------------------
-- Tiedostokaapin eristys ja toiminnot
-- ---------------------------------------------------------------------------
--
-- Kaksi lohkoa, kumpikin päättyy tarkoitukselliseen poikkeukseen jonka
-- viesti on tulosrivi:
--
--   ERROR: TULOKSET: OK1 OK2 OK3 …
--
-- Poikkeus peruu transaktion, joten testiaineisto ei jää kantaan. Aja
-- lohkot erikseen — ensimmäisen poikkeus lopettaa ajon.
--
-- ---------------------------------------------------------------------------
-- OLENNAISTA: MOLEMMAT VAIHTAVAT ROOLIN
-- ---------------------------------------------------------------------------
--
-- Pääkäyttäjänä ajettuna rivitason käytännöt ohitetaan kokonaan, ja
-- testi menisi läpi vaikka yhtään käytäntöä ei olisi. set local role +
-- request.jwt.claims tekee ajosta sellaisen kuin se on sovelluksesta
-- tultaessa.
--
-- Lohko 1 yrittää tahallisesti käyttää toisen ravintolan kansio- ja
-- tiedostotunnisteita. Jokaisen niistä on estyttävä.

-- ===========================================================================
-- 1. Ravintoloiden eristys
-- ===========================================================================

do $t$
declare
  r text := '';
  v_a uuid; v_b uuid;
  v_ua uuid := gen_random_uuid();  -- omistaja A
  v_ub uuid := gen_random_uuid();  -- omistaja B
  v_uc uuid := gen_random_uuid();  -- työntekijä A:ssa
  v_fa uuid; v_fa_sub uuid; v_fb uuid;
  v_file uuid;
  v_n int;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Files A', 'zz-files-a', 'Europe/Helsinki') returning id into v_a;
  insert into restaurants (name, slug, timezone)
  values ('ZZ Files B', 'zz-files-b', 'Europe/Helsinki') returning id into v_b;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzfa@x.test', now(), now()),
    (v_ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzfb@x.test', now(), now()),
    (v_uc, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzfc@x.test', now(), now());

  insert into profiles (id, full_name) values
    (v_ua, 'Omistaja A'), (v_ub, 'Omistaja B'), (v_uc, 'Tyontekija C')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_ua, 'owner'), (v_b, v_ub, 'owner'), (v_a, v_uc, 'employee');

  insert into folders (restaurant_id, name, sort_order)
  values (v_b, 'B-kansio', 0) returning id into v_fb;

  -- ---- Omistaja A ----
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ua)::text, true);

  v_fa := create_folder(v_a, null, 'Talous');
  if v_fa is not null then r := r || 'OK1 '; else r := r || 'FAIL1 '; end if;

  v_fa_sub := create_folder(v_a, v_fa, '2026');
  if (select count(*) from folder_breadcrumb(v_fa_sub)) = 2
    then r := r || 'OK2 '; else r := r || 'FAIL2 '; end if;

  if folder_path_text(v_fa_sub) = 'Talous / 2026'
    then r := r || 'OK3 '; else r := r || 'FAIL3 '; end if;

  v_file := register_file(v_a, v_fa_sub, 'Vuokrasopimus.pdf',
    v_a::text || '/' || gen_random_uuid()::text, 'application/pdf', 12345);
  if v_file is not null then r := r || 'OK4 '; else r := r || 'FAIL4 '; end if;

  /* Polku toisen ravintolan tunnisteella: rivi osoittaisi vieraaseen
     objektiin, ja allekirjoitettu osoite luotaisiin sille. */
  begin
    perform register_file(v_a, v_fa, 'Vaara.pdf',
      v_b::text || '/' || gen_random_uuid()::text, 'application/pdf', 100);
    r := r || 'FAIL5 ';
  exception when others then r := r || 'OK5 ';
  end;

  /* Oma tiedosto toisen ravintolan kansioon. */
  begin
    perform move_file(v_file, v_fb);
    r := r || 'FAIL6 ';
  exception when insufficient_privilege then r := r || 'OK6 ';
  end;

  /* Kansio oman alikansionsa sisään irrottaisi haaran puusta. */
  begin
    perform move_folder(v_fa, v_fa_sub);
    r := r || 'FAIL7 ';
  exception when others then r := r || 'OK7 ';
  end;

  begin
    perform move_folder(v_fa, v_fa);
    r := r || 'FAIL8 ';
  exception when others then r := r || 'OK8 ';
  end;

  begin
    perform move_folder(v_fa, v_fb);
    r := r || 'FAIL9 ';
  exception when insufficient_privilege then r := r || 'OK9 ';
  end;

  select count(*) into v_n from search_files(v_a, 'vuokra', 50);
  if v_n = 1 then r := r || 'OK10 '; else r := r || 'FAIL10 '; end if;

  select count(*) into v_n from folders where restaurant_id = v_b;
  if v_n = 0 then r := r || 'OK11 '; else r := r || 'FAIL11 '; end if;

  -- ---- Omistaja B: ei näe eikä muuta A:n mitään ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_ub)::text, true);

  select count(*) into v_n from files;
  if v_n = 0 then r := r || 'OK12 '; else r := r || 'FAIL12 '; end if;

  begin perform rename_folder(v_fa, 'Kaapattu'); r := r || 'FAIL13 ';
  exception when insufficient_privilege then r := r || 'OK13 '; end;

  begin perform delete_folder(v_fa, 'contents'); r := r || 'FAIL14 ';
  exception when insufficient_privilege then r := r || 'OK14 '; end;

  begin perform rename_file(v_file, 'Kaapattu.pdf'); r := r || 'FAIL15 ';
  exception when insufficient_privilege then r := r || 'OK15 '; end;

  begin perform move_file(v_file, v_fb); r := r || 'FAIL16 ';
  exception when insufficient_privilege then r := r || 'OK16 '; end;

  begin perform delete_file(v_file); r := r || 'FAIL17 ';
  exception when insufficient_privilege then r := r || 'OK17 '; end;

  begin perform set_file_favorite(v_file, true); r := r || 'FAIL18 ';
  exception when insufficient_privilege then r := r || 'OK18 '; end;

  /* A:n tunniste omissa käsissä ei avaa mitään. */
  begin perform create_folder(v_a, null, 'Tunkeutuja'); r := r || 'FAIL19 ';
  exception when insufficient_privilege then r := r || 'OK19 '; end;

  begin perform create_folder(v_b, v_fa, 'Tunkeutuja'); r := r || 'FAIL20 ';
  exception when insufficient_privilege then r := r || 'OK20 '; end;

  begin perform reorder_folders(null, v_a, array[v_fa]); r := r || 'FAIL21 ';
  exception when insufficient_privilege then r := r || 'OK21 '; end;

  select count(*) into v_n from search_files(v_a, 'vuokra', 50);
  if v_n = 0 then r := r || 'OK22 '; else r := r || 'FAIL22 '; end if;

  -- ---- Työntekijä A:ssa: ei näe kaappia lainkaan ----
  --
  -- Kaapissa on työsopimuksia ja palkkalaskelmia. Käyttöliittymä
  -- piilottaa sivun, mutta istunto on voimassa ja rajapintaa voi
  -- kutsua ilman käyttöliittymää — joten rajan on oltava kannassa.
  perform set_config('request.jwt.claims', json_build_object('sub', v_uc)::text, true);

  select count(*) into v_n from files;
  if v_n = 0 then r := r || 'OK23 '; else r := r || 'FAIL23 '; end if;

  begin perform create_folder(v_a, null, 'Tyontekijan'); r := r || 'FAIL24 ';
  exception when insufficient_privilege then r := r || 'OK24 '; end;

  begin perform delete_file(v_file); r := r || 'FAIL25 ';
  exception when insufficient_privilege then r := r || 'OK25 '; end;

  begin
    insert into folders (restaurant_id, name) values (v_a, 'Suoraan');
    r := r || 'FAIL26 ';
  exception when insufficient_privilege then r := r || 'OK26 ';
  end;

  reset role;
  raise exception 'TULOKSET: %', r;
end;
$t$;

-- ===========================================================================
-- 2. Rakenne, rajat ja roolit
-- ===========================================================================

do $t$
declare
  r text := '';
  v_a uuid;
  v_ua uuid := gen_random_uuid();  -- omistaja
  v_ue uuid := gen_random_uuid();  -- työntekijä
  v_uk uuid := gen_random_uuid();  -- kirjanpitäjä
  v_f1 uuid; v_f2 uuid; v_f3 uuid; v_deep uuid;
  v_file uuid; v_root_file uuid;
  v_n int; v_paths text[];
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Files C', 'zz-files-c', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzg1@x.test', now(), now()),
    (v_ue, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzg2@x.test', now(), now()),
    (v_uk, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzg3@x.test', now(), now());

  insert into profiles (id, full_name) values
    (v_ua, 'Omistaja'), (v_ue, 'Tyontekija'), (v_uk, 'Kirjanpitaja')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_ua, 'owner'), (v_a, v_ue, 'employee'), (v_a, v_uk, 'accountant');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ua)::text, true);

  v_f1 := create_folder(v_a, null, 'Talous');
  v_f2 := create_folder(v_a, v_f1, '2026');
  v_f3 := create_folder(v_a, v_f2, 'Elokuu');

  /* Sama nimi samassa paikassa on virhe; eri paikassa se on rakenne. */
  begin
    perform create_folder(v_a, v_f1, '2026');
    r := r || 'FAIL1 ';
  exception when unique_violation then r := r || 'OK1 ';
  end;

  begin
    perform create_folder(v_a, v_f3, '2026');
    r := r || 'OK2 ';
  exception when others then r := r || 'FAIL2 ';
  end;

  v_deep := v_f3;
  for i in 4..10 loop
    v_deep := create_folder(v_a, v_deep, 'taso' || i);
  end loop;

  select count(*) into v_n from folder_breadcrumb(v_deep);
  if v_n = 10 then r := r || 'OK3 '; else r := r || 'FAIL3(' || v_n || ') '; end if;

  begin
    perform create_folder(v_a, v_deep, 'liikaa');
    r := r || 'FAIL4 ';
  exception when others then r := r || 'OK4 ';
  end;

  v_file := register_file(v_a, v_f3, 'Elokuu.xlsx',
    v_a::text || '/' || gen_random_uuid()::text, 'application/vnd.ms-excel', 500);
  v_root_file := register_file(v_a, null, 'Juuressa.pdf',
    v_a::text || '/' || gen_random_uuid()::text, 'application/pdf', 400);

  select count(*) into v_n from folder_counts(v_a) where folder_id = v_f3;
  if v_n = 1 then r := r || 'OK5 '; else r := r || 'FAIL5 '; end if;

  begin
    perform reorder_folders(v_f2, v_a, array[v_f3]);
    r := r || 'OK6 ';
  exception when others then r := r || 'FAIL6 ';
  end;

  /* Kansio ei kuulu tähän paikkaan: järjestys ei ole tapa muuttaa
     mitä tahansa riviä missä tahansa. */
  begin
    perform reorder_folders(null, v_a, array[v_f3]);
    r := r || 'FAIL7 ';
  exception when others then r := r || 'OK7 ';
  end;

  /* Poisto säilyttäen: tiedosto siirtyy juureen, polkuja ei palaudu. */
  select array_agg(x) into v_paths from delete_folder(v_f3, 'keep') x;
  if v_paths is null then r := r || 'OK8 '; else r := r || 'FAIL8 '; end if;

  select count(*) into v_n from files where id = v_file and folder_id is null;
  if v_n = 1 then r := r || 'OK9 '; else r := r || 'FAIL9 '; end if;

  /* Poisto sisältöineen: polut palautuvat kutsujalle storagea varten. */
  perform move_file(v_file, v_f2);
  select array_agg(x) into v_paths from delete_folder(v_f1, 'contents') x;
  if coalesce(array_length(v_paths, 1), 0) = 1
    then r := r || 'OK10 '; else r := r || 'FAIL10 '; end if;

  select count(*) into v_n from files where id = v_file;
  if v_n = 0 then r := r || 'OK11 '; else r := r || 'FAIL11 '; end if;

  /* Koko haara katosi, ei vain ylin taso. */
  select count(*) into v_n from folders where restaurant_id = v_a;
  if v_n = 0 then r := r || 'OK12 '; else r := r || 'FAIL12(' || v_n || ') '; end if;

  /* Juuressa ollut tiedosto ei kuulunut haaraan eikä siihen kosketa. */
  select count(*) into v_n from files where id = v_root_file;
  if v_n = 1 then r := r || 'OK13 '; else r := r || 'FAIL13 '; end if;

  select count(*) into v_n from audit_log
  where restaurant_id = v_a and entity_type in ('folder', 'file');
  if v_n >= 10 then r := r || 'OK14 '; else r := r || 'FAIL14(' || v_n || ') '; end if;

  -- ---- Työntekijä ei näe kaappia ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_ue)::text, true);

  select count(*) into v_n from files;
  if v_n = 0 then r := r || 'OK15 '; else r := r || 'FAIL15(' || v_n || ') '; end if;

  select count(*) into v_n from folders;
  if v_n = 0 then r := r || 'OK16 '; else r := r || 'FAIL16 '; end if;

  -- ---- Kirjanpitäjä lukee muttei kirjoita ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_uk)::text, true);

  select count(*) into v_n from files;
  if v_n = 1 then r := r || 'OK17 '; else r := r || 'FAIL17(' || v_n || ') '; end if;

  begin perform create_folder(v_a, null, 'Kirjanpitajan'); r := r || 'FAIL18 ';
  exception when insufficient_privilege then r := r || 'OK18 '; end;

  begin perform delete_file(v_root_file); r := r || 'FAIL19 ';
  exception when insufficient_privilege then r := r || 'OK19 '; end;

  reset role;
  raise exception 'TULOKSET: %', r;
end;
$t$;
