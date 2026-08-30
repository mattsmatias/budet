-- ---------------------------------------------------------------------------
-- Varausmoottorin testit
-- ---------------------------------------------------------------------------
--
-- Aja tämä tiedosto sellaisenaan. Se päättyy tarkoitukselliseen
-- poikkeukseen, jonka viesti on tulosrivi:
--
--   ERROR: TULOKSET: OK1 OK2 OK3 …
--
-- Poikkeus on testin muoto eikä vika. Se peruu transaktion, joten
-- testiaineisto ei jää kantaan — eikä tämä siksi tarvitse omaa
-- testikantaa eikä siivousta. Yksikin FAIL riittää: tulosrivi kertoo
-- mikä, ja kanta on kuten ennenkin.
--
-- Vitest-puolella (npm test) on salinäkymän johdettu tila. Se mitä
-- tässä testataan — päällekkäisyys, kapasiteetti, yhdistelmät,
-- rivitason käytännöt — ei ole testattavissa muualla kuin kannassa.

-- ===========================================================================
-- 1. Moottori
-- ===========================================================================

do $t$
declare
  r text := '';
  v_res uuid; v_r2 uuid;
  v_p2 uuid; v_p4 uuid; v_p6 uuid; v_comb uuid;
  v_d date := current_date + 7;    -- tavallinen ilta
  v_dc date := current_date + 10;  -- yhdistelmätestit
  v_dw date := current_date + 11;  -- julkinen rajapinta
  v_id1 uuid; v_id2 uuid;
  v_t uuid[];
  v_j json;
  v_n int; v_n2 int;
  v_tok text;
begin
  -- ---- Fixtuuri: kaksi ravintolaa, kolme pöytää, yksi yhdistelmä ----
  insert into restaurants (name, slug, timezone)
  values ('Testi A', 'zz-testi-a', 'Europe/Helsinki') returning id into v_res;
  insert into restaurants (name, slug, timezone)
  values ('Testi B', 'zz-testi-b', 'Europe/Helsinki') returning id into v_r2;

  insert into reservation_settings
    (restaurant_id, enabled, slot_minutes, default_duration_minutes,
     turnaround_minutes, min_party, max_party, max_days_ahead, lead_minutes)
  values (v_res, true, 30, 90, 0, 1, 12, 60, 0);

  insert into reservation_hours (restaurant_id, weekday, opens, last_seating)
  select v_res, g, time '17:00', time '21:00' from generate_series(1,7) g;

  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_res, 'P2', 1, 2, 1) returning id into v_p2;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_res, 'P4', 2, 4, 2) returning id into v_p4;
  insert into restaurant_tables (restaurant_id, name, seats_min, seats_max, sort_order)
  values (v_res, 'P6', 4, 6, 3) returning id into v_p6;

  insert into table_combinations (restaurant_id, name, seats_min, seats_max)
  values (v_res, 'P2+P4', 5, 6) returning id into v_comb;
  insert into table_combination_members values (v_comb, v_p2), (v_comb, v_p4);

  -- ---- Kesto ----
  if reservation_duration_for(v_res, 2) = 90 then r := r || 'OK1 '; else r := r || 'FAIL1 '; end if;

  insert into reservation_durations (restaurant_id, min_party, max_party, minutes)
  values (v_res, 5, null, 120);
  if reservation_duration_for(v_res, 6) = 120 and reservation_duration_for(v_res, 2) = 90
    then r := r || 'OK2 '; else r := r || 'FAIL2 '; end if;

  -- ---- Aukiolo ja poikkeus ----
  select count(*) into v_n from reservation_windows(v_res, v_d);
  if v_n = 1 then r := r || 'OK3 '; else r := r || 'FAIL3 '; end if;

  insert into reservation_exceptions (restaurant_id, exception_date, closed)
  values (v_res, v_d + 1, true);
  select count(*) into v_n from reservation_windows(v_res, v_d + 1);
  if v_n = 0 then r := r || 'OK4 '; else r := r || 'FAIL4 '; end if;

  -- ---- Vapaat ajat: 17:00–21:00 puolen tunnin välein ----
  select count(*) into v_n from reservation_slots(v_res, v_d, 2);
  if v_n = 9 then r := r || 'OK5 '; else r := r || 'FAIL5(' || v_n || ') '; end if;

  select count(*) into v_n from reservation_slots(v_res, v_d + 1, 2);
  if v_n = 0 then r := r || 'OK5b '; else r := r || 'FAIL5b '; end if;

  -- ---- Pienin riittävä pöytä ----
  v_t := reservation_pick_tables(v_res, (v_d + time '18:00') at time zone 'Europe/Helsinki',
                                 (v_d + time '19:30') at time zone 'Europe/Helsinki', 2);
  if v_t = array[v_p2] then r := r || 'OK6 '; else r := r || 'FAIL6 '; end if;

  -- ---- Peräkkäiset varaukset samaan aikaan löytävät eri pöydät ----
  v_id1 := reservation_book(v_res, (v_d + time '18:00') at time zone 'Europe/Helsinki',
    2, 'A', '040', null, null, 'widget');
  if exists (select 1 from reservation_table_assignments where reservation_id = v_id1 and table_id = v_p2)
    then r := r || 'OK7 '; else r := r || 'FAIL7 '; end if;

  v_id2 := reservation_book(v_res, (v_d + time '18:00') at time zone 'Europe/Helsinki',
    2, 'B', '040', null, null, 'widget');
  if exists (select 1 from reservation_table_assignments where reservation_id = v_id2 and table_id = v_p4)
    then r := r || 'OK8 '; else r := r || 'FAIL8 '; end if;

  -- ---- Kolmas ei mahdu: P6:n vähimmäismäärä on neljä ----
  begin
    perform reservation_book(v_res, (v_d + time '18:00') at time zone 'Europe/Helsinki',
      2, 'C', '040', null, null, 'widget');
    r := r || 'FAIL9 ';
  exception when exclusion_violation then r := r || 'OK9 ';
  end;

  -- ---- Päällekkäinen aika ei kelpaa ----
  begin
    perform reservation_book(v_res, (v_d + time '18:30') at time zone 'Europe/Helsinki',
      2, 'D', '040', null, null, 'widget');
    r := r || 'FAIL10 ';
  exception when exclusion_violation then r := r || 'OK10 ';
  end;

  -- ---- Heti edellisen päätyttyä kelpaa: aikaväli on puoliavoin ----
  begin
    perform reservation_book(v_res, (v_d + time '19:30') at time zone 'Europe/Helsinki',
      2, 'E', '040', null, null, 'widget');
    r := r || 'OK11 ';
  exception when exclusion_violation then r := r || 'FAIL11 ';
  end;

  -- ---- Hallintafunktio kieltäytyy ilman auth.uid():ta ----
  begin
    perform reservation_set_status(v_id1, 'cancelled');
    r := r || 'FAIL12 ';
  exception when insufficient_privilege then r := r || 'OK12 ';
  end;

  -- ---- Peruutus laskee blocking-lipun ja vapauttaa pöydän ----
  update reservations set status = 'cancelled' where id = v_id1;
  if not exists (select 1 from reservation_table_assignments
                 where reservation_id = v_id1 and blocking)
    then r := r || 'OK12b '; else r := r || 'FAIL12b '; end if;

  begin
    perform reservation_book(v_res, (v_d + time '18:00') at time zone 'Europe/Helsinki',
      2, 'F', '040', null, null, 'widget');
    r := r || 'OK13 ';
  exception when exclusion_violation then r := r || 'FAIL13 ';
  end;

  -- ---- Rajoite pitää myös suoralla kirjoituksella ----
  --
  -- Tämä on koko ominaisuuden tärkein testi. Se ohittaa moottorin ja
  -- kirjoittaa liitostauluun käsin: jos rajoite ei pidä, mikään muu
  -- ei auta.
  begin
    insert into reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, blocking)
    values (v_id2, v_p6,
      (v_d + time '18:00') at time zone 'Europe/Helsinki',
      (v_d + time '19:30') at time zone 'Europe/Helsinki', true);
    insert into reservation_table_assignments (reservation_id, table_id, starts_at, ends_at, blocking)
    values (v_id1, v_p6,
      (v_d + time '18:30') at time zone 'Europe/Helsinki',
      (v_d + time '20:00') at time zone 'Europe/Helsinki', true);
    r := r || 'FAIL14 ';
  exception when exclusion_violation then r := r || 'OK14 ';
  end;

  -- ---- Yksittäinen pöytä ennen yhdistelmää ----
  v_t := reservation_pick_tables(v_res, (v_dc + time '19:00') at time zone 'Europe/Helsinki',
                                 (v_dc + time '21:00') at time zone 'Europe/Helsinki', 6);
  if v_t = array[v_p6] then r := r || 'OK15 '; else r := r || 'FAIL15 '; end if;

  -- ---- P6 varattuna: yhdistelmä otetaan käyttöön ----
  perform reservation_book(v_res, (v_dc + time '19:00') at time zone 'Europe/Helsinki',
    6, 'G', '040', null, null, 'admin');
  v_t := reservation_pick_tables(v_res, (v_dc + time '19:00') at time zone 'Europe/Helsinki',
                                 (v_dc + time '21:00') at time zone 'Europe/Helsinki', 5);
  if v_t @> array[v_p2] and v_t @> array[v_p4] and array_length(v_t,1) = 2
    then r := r || 'OK16 '; else r := r || 'FAIL16 '; end if;

  -- ---- Käytöstä poistettu pöytä kaataa koko yhdistelmän ----
  update restaurant_tables set active = false where id = v_p4;
  v_t := reservation_pick_tables(v_res, (v_dc + time '19:00') at time zone 'Europe/Helsinki',
                                 (v_dc + time '21:00') at time zone 'Europe/Helsinki', 5);
  if v_t is null then r := r || 'OK16b '; else r := r || 'FAIL16b '; end if;
  update restaurant_tables set active = true where id = v_p4;

  -- ---- Neuvoa-antava lukko otetaan oikeasti ----
  --
  -- Lähdekoodissa oleva rivi ei todista mitään; pg_locks todistaa.
  perform reservation_book(v_res, (v_dc + time '17:00') at time zone 'Europe/Helsinki',
    2, 'Lukko', '040', null, null, 'admin');
  if exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid()
  ) then r := r || 'OK16c '; else r := r || 'FAIL16c '; end if;

  -- ---- Julkinen rajapinta ----
  v_j := public_reservation_config('zz-testi-a');
  if (v_j->>'enabled')::boolean and v_j->>'restaurantName' = 'Testi A'
    then r := r || 'OK17 '; else r := r || 'FAIL17 '; end if;

  -- Ravintola ilman asetuksia näyttää suljetulta eikä paljasta olemassaoloaan.
  v_j := public_reservation_config('zz-testi-b');
  if not (v_j->>'enabled')::boolean then r := r || 'OK18 '; else r := r || 'FAIL18 '; end if;

  -- Aikavälin ulkopuolinen kellonaika: selain ei ole ainoa portti.
  v_j := public_create_reservation('zz-testi-a', v_dw, time '19:07', 2, 'X', '040');
  if v_j->>'error' = 'slot' then r := r || 'OK19 '; else r := r || 'FAIL19 '; end if;

  v_j := public_create_reservation('zz-testi-a', v_dw, time '19:00', 99, 'X', '040');
  if v_j->>'error' = 'party' then r := r || 'OK20 '; else r := r || 'FAIL20 '; end if;

  v_j := public_create_reservation('ei-ole', v_dw, time '19:00', 2, 'X', '040');
  if v_j->>'error' = 'not_found' then r := r || 'OK21 '; else r := r || 'FAIL21 '; end if;

  v_j := public_create_reservation('zz-testi-a', v_dw, time '23:00', 2, 'X', '040');
  if v_j->>'error' = 'closed' then r := r || 'OK22 '; else r := r || 'FAIL22 '; end if;

  v_j := public_create_reservation('zz-testi-a', current_date + 400, time '19:00', 2, 'X', '040');
  if v_j->>'error' = 'date' then r := r || 'OK22b '; else r := r || 'FAIL22b '; end if;

  v_j := public_create_reservation('zz-testi-a', v_dw, time '19:00', 2, '', '040');
  if v_j->>'error' = 'name' then r := r || 'OK22c '; else r := r || 'FAIL22c '; end if;

  v_j := public_create_reservation('zz-testi-a', v_dw, time '19:00', 2, 'X', '');
  if v_j->>'error' = 'phone' then r := r || 'OK22d '; else r := r || 'FAIL22d '; end if;

  -- Onnistunut varaus siistii syötteen: välilyönnit pois, sähköposti pieniksi.
  v_j := public_create_reservation('zz-testi-a', v_dw, time '17:00', 2, '  Matti  ', '040123', 'A@B.FI', 'ikkuna');
  if (v_j->>'ok')::boolean then r := r || 'OK23 '; else r := r || 'FAIL23 '; end if;
  v_tok := v_j->>'cancelToken';

  -- Peruutustunnus on kannassa vain tiivisteenä.
  if exists (select 1 from reservations
             where guest_name = 'Matti' and guest_email = 'a@b.fi'
               and source = 'widget'
               and cancel_token_hash = encode(sha256(v_tok::bytea),'hex'))
    then r := r || 'OK24 '; else r := r || 'FAIL24 '; end if;

  if public_reservation_lookup('vaara-token') is null then r := r || 'OK25 '; else r := r || 'FAIL25 '; end if;

  v_j := public_reservation_lookup(v_tok);
  if (v_j->>'cancellable')::boolean and v_j->>'guestName' = 'Matti'
    then r := r || 'OK25b '; else r := r || 'FAIL25b '; end if;

  v_j := public_cancel_reservation(v_tok);
  if (v_j->>'ok')::boolean then r := r || 'OK26 '; else r := r || 'FAIL26 '; end if;

  v_j := public_cancel_reservation(v_tok);
  if v_j->>'error' = 'already' then r := r || 'OK27 '; else r := r || 'FAIL27 '; end if;

  v_j := public_cancel_reservation('ei-ole-token');
  if v_j->>'error' = 'not_found' then r := r || 'OK27b '; else r := r || 'FAIL27b '; end if;

  -- ---- Walk-in vie ajan verkkovarauksilta samalla hetkellä ----
  perform reservation_book(v_res, (v_dw + time '17:00') at time zone 'Europe/Helsinki',
    6, 'Walkin', null, null, null, 'walk_in', 'arrived');

  if exists (
    select 1 from reservation_table_assignments a
    join reservations x on x.id = a.reservation_id
    where x.source = 'walk_in' and a.table_id = v_p6 and a.blocking
  ) then r := r || 'OK28 '; else r := r || 'FAIL28 '; end if;

  -- P6 on mennyt: kuuden hengen seurue saa enää yhdistelmän.
  v_t := reservation_pick_tables(v_res, (v_dw + time '17:00') at time zone 'Europe/Helsinki',
                                 (v_dw + time '19:00') at time zone 'Europe/Helsinki', 6);
  if v_t @> array[v_p2] and v_t @> array[v_p4]
    then r := r || 'OK28b '; else r := r || 'FAIL28b '; end if;

  -- Kun yhdistelmäkin on käytetty, aika katoaa julkisesta listasta.
  perform reservation_book(v_res, (v_dw + time '17:00') at time zone 'Europe/Helsinki',
    6, 'H', '040', null, null, 'widget');
  v_j := public_reservation_slots('zz-testi-a', v_dw, 6);
  if not (v_j->'slots')::jsonb ? '17:00' then r := r || 'OK28c '; else r := r || 'FAIL28c '; end if;
  if (v_j->'slots')::jsonb ? '19:00' then r := r || 'OK28d '; else r := r || 'FAIL28d '; end if;

  -- ---- Toisen ravintolan pöytää ei voi varata tunnisteella ----
  begin
    perform reservation_book(v_r2, (v_d + time '18:00') at time zone 'Europe/Helsinki',
      2, 'Y', '040', null, null, 'admin', 'confirmed', null, array[v_p2]);
    r := r || 'FAIL29 ';
  exception when check_violation then r := r || 'OK29 ';
  end;

  -- ---- Tilahistoria syntyy liipaisimesta ----
  select count(*) into v_n from reservation_status_history h
  join reservations x on x.id = h.reservation_id where x.restaurant_id = v_res;
  if v_n > 0 then r := r || 'OK30 '; else r := r || 'FAIL30 '; end if;

  -- ---- Roskavarausten raja: sama numero, viisi tulevaa ----
  for v_n in 1..7 loop
    perform public_create_reservation(
      'zz-testi-a', v_dw + v_n, time '17:00', 2, 'Roska', '0999');
  end loop;
  select count(*) into v_n2 from reservations
  where restaurant_id = v_res and guest_phone = '0999';
  if v_n2 = 5 then r := r || 'OK31 '; else r := r || 'FAIL31(' || v_n2 || ') '; end if;

  raise exception 'TULOKSET: %', r;
end;
$t$;
