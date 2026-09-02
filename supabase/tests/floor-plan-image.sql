-- ---------------------------------------------------------------------------
-- Pohjapiirroskuva
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
-- TÄRKEIN TARKISTUS ON POLKU
-- ---------------------------------------------------------------------------
--
-- Rivin luku on rajattu omaan ravintolaan, mutta rivillä on polku
-- tallennustilaan. Jos polun saisi osoittaa mihin tahansa, esihenkilö
-- voisi tallentaa oman ravintolansa riville toisen ravintolan kuvan —
-- ja sovellus tekisi siitä allekirjoitetun linkin kysymättä mitään,
-- koska rivi on hänen omansa.
--
-- Siksi funktio vaatii että polku alkaa oman ravintolan tunnisteella.

do $t$
declare
  r text := '';
  v_a uuid;
  v_b uuid;
  v_omistaja uuid := gen_random_uuid();
  v_tarjoilija uuid := gen_random_uuid();
  v_ulko uuid := gen_random_uuid();
  v_res json;
  v_n int;
  v_teksti text;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Pohja A', 'zz-pohja-a', 'Europe/Helsinki') returning id into v_a;
  insert into restaurants (name, slug, timezone)
  values ('ZZ Pohja B', 'zz-pohja-b', 'Europe/Helsinki') returning id into v_b;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_omistaja, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'zzp1@x.test', now(), now()),
    (v_tarjoilija, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'zzp2@x.test', now(), now()),
    (v_ulko, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'zzp3@x.test', now(), now());

  insert into profiles (id, full_name)
  values (v_omistaja, 'Omistaja'), (v_tarjoilija, 'Tarjoilija'),
         (v_ulko, 'Ulkopuolinen')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role)
  values (v_a, v_omistaja, 'owner'), (v_a, v_tarjoilija, 'employee');

  set local role authenticated;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_omistaja)::text, true);

  -- Tallennus onnistuu ja rivi syntyy
  v_res := save_floor_plan_image(v_a, v_a::text || '/pohja.png', 1600, 900, 0.4);
  if (v_res->>'ok')::boolean then r := r || 'OK1 ';
  else r := r || 'FAIL1 ' || v_res::text || ' '; end if;

  select count(*) into v_n from floor_plan_images where restaurant_id = v_a;
  if v_n = 1 then r := r || 'OK2 '; else r := r || 'FAIL2 ' || v_n || ' '; end if;

  /* Ensimmäisellä kerralla ei ole edellistä tiedostoa poistettavaksi. */
  if v_res->>'previousPath' is null then r := r || 'OK3 ';
  else r := r || 'FAIL3 ' || (v_res->>'previousPath') || ' '; end if;

  -- Vaihto palauttaa vanhan polun poistettavaksi
  v_res := save_floor_plan_image(v_a, v_a::text || '/uusi.png', 1000, 1000, null);
  if v_res->>'previousPath' = v_a::text || '/pohja.png' then r := r || 'OK4 ';
  else r := r || 'FAIL4 ' || coalesce(v_res->>'previousPath', '-') || ' '; end if;

  /* Rivi on yhä yksi: vaihto korvaa eikä kerrytä. */
  select count(*) into v_n from floor_plan_images where restaurant_id = v_a;
  if v_n = 1 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  /* Peittävyys ilman arvoa palautuu oletukseen. */
  select opacity into v_teksti from floor_plan_images where restaurant_id = v_a;
  if v_teksti::numeric = 0.45 then r := r || 'OK6 ';
  else r := r || 'FAIL6 ' || coalesce(v_teksti, '-') || ' '; end if;

  -- Toisen ravintolan polkua ei hyväksytä
  v_res := save_floor_plan_image(v_a, v_b::text || '/varastettu.png', 800, 600, null);
  if (v_res->>'error') = 'path' then r := r || 'OK7 ';
  else r := r || 'FAIL7 ' || v_res::text || ' '; end if;

  /* Eikä polkua ilman ravintolan tunnistetta. */
  v_res := save_floor_plan_image(v_a, 'pohja.png', 800, 600, null);
  if (v_res->>'error') = 'path' then r := r || 'OK8 ';
  else r := r || 'FAIL8 ' || v_res::text || ' '; end if;

  -- Mitattomat kuvat hylätään: nolla jakajana rikkoisi kuvasuhteen
  v_res := save_floor_plan_image(v_a, v_a::text || '/x.png', 0, 600, null);
  if (v_res->>'error') = 'size' then r := r || 'OK9 ';
  else r := r || 'FAIL9 ' || v_res::text || ' '; end if;

  -- Peittävyyden rajat
  v_res := set_floor_plan_opacity(v_a, 0.7);
  if (v_res->>'ok')::boolean then r := r || 'OK10 ';
  else r := r || 'FAIL10 ' || v_res::text || ' '; end if;

  v_res := set_floor_plan_opacity(v_a, 2);
  if (v_res->>'error') = 'opacity' then r := r || 'OK11 ';
  else r := r || 'FAIL11 ' || v_res::text || ' '; end if;

  -- Tarjoilija näkee rivin muttei muuta sitä
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_tarjoilija)::text, true);

  select count(*) into v_n from floor_plan_images where restaurant_id = v_a;
  if v_n = 1 then r := r || 'OK12 '; else r := r || 'FAIL12 ' || v_n || ' '; end if;

  begin
    perform save_floor_plan_image(v_a, v_a::text || '/oma.png', 800, 600, null);
    r := r || 'FAIL13 ';
  exception when insufficient_privilege then r := r || 'OK13 ';
  end;

  begin
    perform delete_floor_plan_image(v_a);
    r := r || 'FAIL14 ';
  exception when insufficient_privilege then r := r || 'OK14 ';
  end;

  -- Ulkopuolinen ei näe eikä muuta
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_ulko)::text, true);

  select count(*) into v_n from floor_plan_images where restaurant_id = v_a;
  if v_n = 0 then r := r || 'OK15 '; else r := r || 'FAIL15 ' || v_n || ' '; end if;

  begin
    perform save_floor_plan_image(v_a, v_a::text || '/oma.png', 800, 600, null);
    r := r || 'FAIL16 ';
  exception when insufficient_privilege then r := r || 'OK16 ';
  end;

  -- Poisto palauttaa polun ja tyhjentää rivin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_omistaja)::text, true);

  v_res := delete_floor_plan_image(v_a);
  if v_res->>'previousPath' = v_a::text || '/uusi.png' then r := r || 'OK17 ';
  else r := r || 'FAIL17 ' || coalesce(v_res->>'previousPath', '-') || ' '; end if;

  select count(*) into v_n from floor_plan_images where restaurant_id = v_a;
  if v_n = 0 then r := r || 'OK18 '; else r := r || 'FAIL18 ' || v_n || ' '; end if;

  /* Poisto tyhjästä on virhe eikä hiljainen onnistuminen. */
  v_res := delete_floor_plan_image(v_a);
  if (v_res->>'error') = 'missing' then r := r || 'OK19 ';
  else r := r || 'FAIL19 ' || v_res::text || ' '; end if;

  -- Muutosloki: lisäys, vaihto ja poisto näkyvät
  reset role;
  select count(*) into v_n from audit_log
  where restaurant_id = v_a and action = 'floorplan.image';
  if v_n = 3 then r := r || 'OK20 '; else r := r || 'FAIL20 ' || v_n || ' '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;
