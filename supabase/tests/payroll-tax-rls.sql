-- ---------------------------------------------------------------------------
-- Verokorttien eristys ja palkkakertymä
-- ---------------------------------------------------------------------------
--
-- Kolme lohkoa, kukin päättyy tarkoitukselliseen poikkeukseen jonka
-- viesti on tulosrivi:
--
--   ERROR: TULOKSET: OK1 OK2 OK3 …
--
-- Poikkeus peruu transaktion, joten testiaineisto ei jää kantaan. Aja
-- lohkot erikseen — ensimmäisen poikkeus lopettaa ajon.
--
-- ---------------------------------------------------------------------------
-- OLENNAISTA: KAIKKI VAIHTAVAT ROOLIN
-- ---------------------------------------------------------------------------
--
-- Pääkäyttäjänä ajettuna rivitason käytännöt ohitetaan kokonaan, ja
-- testi menisi läpi vaikka yhtään käytäntöä ei olisi. set local role +
-- request.jwt.claims tekee ajosta sellaisen kuin se on sovelluksesta
-- tultaessa.
--
-- Verokortti on tämän moduulin arkaluontoisin tieto: se kertoo
-- ihmisen henkilökohtaisen veroprosentin. Lohko 1 yrittää päästä
-- toisen ravintolan kortteihin, lohko 2 työkaverin kortteihin.
-- Molempien on estyttävä.

-- ===========================================================================
-- 1. Ravintoloiden eristys
-- ===========================================================================

do $t$
declare
  r text := '';
  v_a uuid; v_b uuid;
  v_ua uuid := gen_random_uuid();  -- omistaja A
  v_ub uuid := gen_random_uuid();  -- omistaja B
  v_card_b uuid;
  v_benefit_b uuid;
  v_n int;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Palkka A', 'zz-palkka-a', 'Europe/Helsinki') returning id into v_a;
  insert into restaurants (name, slug, timezone)
  values ('ZZ Palkka B', 'zz-palkka-b', 'Europe/Helsinki') returning id into v_b;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzpa@x.test', now(), now()),
    (v_ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzpb@x.test', now(), now());

  insert into profiles (id, full_name) values
    (v_ua, 'Omistaja A'), (v_ub, 'Omistaja B')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_ua, 'owner'), (v_b, v_ub, 'owner');

  /* B:n verokortti ja luontoisetu, luotu pääkäyttäjänä. */
  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_b, v_ub, 22.00, 44.00, 2500000, '2026-01-01', '2026-12-31')
  returning id into v_card_b;

  insert into employee_benefits (restaurant_id, user_id, kind, monthly_value_cents, valid_from)
  values (v_b, v_ub, 'phone', 2000, '2026-01-01')
  returning id into v_benefit_b;

  -- ---- Omistaja A yrittää päästä B:n tietoihin ----
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_ua)::text, true);

  select count(*) into v_n from tax_cards where restaurant_id = v_b;
  if v_n = 0 then r := r || 'OK1 '; else r := r || 'FAIL1 '; end if;

  select count(*) into v_n from tax_cards where id = v_card_b;
  if v_n = 0 then r := r || 'OK2 '; else r := r || 'FAIL2 '; end if;

  select count(*) into v_n from employee_benefits where id = v_benefit_b;
  if v_n = 0 then r := r || 'OK3 '; else r := r || 'FAIL3 '; end if;

  /* Kortin luominen toiselle ravintolalle. */
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from)
    values (v_b, v_ub, 5.00, 10.00, 100000, '2026-01-01');
    r := r || 'FAIL4 ';
  exception when others then r := r || 'OK4 ';
  end;

  /* B:n kortin muuttaminen. */
  update tax_cards set base_percent = 1.00 where id = v_card_b;
  if not found then r := r || 'OK5 '; else r := r || 'FAIL5 '; end if;

  /* B:n kortin poistaminen. */
  delete from tax_cards where id = v_card_b;
  if not found then r := r || 'OK6 '; else r := r || 'FAIL6 '; end if;

  /* Funktio ei saa kiertää käytäntöä. */
  if (select id from tax_card_on_pay_date(v_b, v_ub, '2026-06-15')) is null
    then r := r || 'OK7 '; else r := r || 'FAIL7 '; end if;

  select count(*) into v_n from employee_payroll_info(v_b);
  if v_n = 0 then r := r || 'OK8 '; else r := r || 'FAIL8 '; end if;

  begin
    perform save_employment_details(v_b, v_ub, '2026-01-01', null, '1990-01-01');
    r := r || 'FAIL9 ';
  exception when others then r := r || 'OK9 ';
  end;

  /* Oma ravintola toimii normaalisti. */
  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_a, v_ua, 20.00, 42.00, 2500000, '2026-01-01', '2026-12-31');

  select count(*) into v_n from tax_cards where restaurant_id = v_a;
  if v_n = 1 then r := r || 'OK10 '; else r := r || 'FAIL10 '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;

-- ===========================================================================
-- 2. Työntekijöiden eristys ja päällekkäisyys
-- ===========================================================================

do $t$
declare
  r text := '';
  v_a uuid;
  v_owner uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();   -- työntekijä C
  v_d uuid := gen_random_uuid();   -- työntekijä D
  v_card_d uuid;
  v_n int;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Palkka C', 'zz-palkka-c', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzpo@x.test', now(), now()),
    (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzpc@x.test', now(), now()),
    (v_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzpd@x.test', now(), now());

  insert into profiles (id, full_name) values
    (v_owner, 'Omistaja'), (v_c, 'Tyontekija C'), (v_d, 'Tyontekija D')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_owner, 'owner'), (v_a, v_c, 'employee'), (v_a, v_d, 'employee');

  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_a, v_c, 18.00, 40.00, 2000000, '2026-01-01', '2026-12-31');

  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_a, v_d, 25.00, 48.00, 3000000, '2026-01-01', '2026-12-31')
  returning id into v_card_d;

  -- ---- Päällekkäisyys estyy kannassa ----
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from, valid_to)
    values (v_a, v_c, 30.00, 50.00, 2000000, '2026-06-01', '2026-08-31');
    r := r || 'FAIL1 ';
  exception when exclusion_violation then r := r || 'OK1 ';
  end;

  /* Peräkkäiset kortit käyvät. */
  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_a, v_c, 30.00, 50.00, 2000000, '2027-01-01', '2027-12-31');
  r := r || 'OK2 ';

  /* Voimassaolo väärinpäin. */
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from, valid_to)
    values (v_a, v_d, 20.00, 40.00, 100000, '2028-12-31', '2028-01-01');
    r := r || 'FAIL3 ';
  exception when check_violation then r := r || 'OK3 ';
  end;

  /* Prosentti yli sadan. */
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from)
    values (v_a, v_d, 120.00, 40.00, 100000, '2029-01-01');
    r := r || 'FAIL4 ';
  exception when check_violation then r := r || 'OK4 ';
  end;

  /* Negatiivinen tuloraja. */
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from)
    values (v_a, v_d, 20.00, 40.00, -1, '2030-01-01');
    r := r || 'FAIL5 ';
  exception when check_violation then r := r || 'OK5 ';
  end;

  -- ---- Työntekijä C ----
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_c)::text, true);

  /* Omat kortit näkyvät. */
  select count(*) into v_n from tax_cards where user_id = v_c;
  if v_n = 2 then r := r || 'OK6 '; else r := r || 'FAIL6 '; end if;

  /* Työkaverin kortti ei näy. */
  select count(*) into v_n from tax_cards where user_id = v_d;
  if v_n = 0 then r := r || 'OK7 '; else r := r || 'FAIL7 '; end if;

  select count(*) into v_n from tax_cards where id = v_card_d;
  if v_n = 0 then r := r || 'OK8 '; else r := r || 'FAIL8 '; end if;

  /* Työntekijä ei saa muuttaa omaa veroprosenttiaan. */
  update tax_cards set base_percent = 0.00 where user_id = v_c;
  if not found then r := r || 'OK9 '; else r := r || 'FAIL9 '; end if;

  /* Eikä lisätä itselleen uutta korttia. */
  begin
    insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                           income_limit_cents, valid_from)
    values (v_a, v_c, 0.00, 0.00, 9999999, '2031-01-01');
    r := r || 'FAIL10 ';
  exception when others then r := r || 'OK10 ';
  end;

  /* Työkaverin palkkatiedot eivät tule funktiosta. */
  select count(*) into v_n from employee_payroll_info(v_a) where user_id = v_d;
  if v_n = 0 then r := r || 'OK11 '; else r := r || 'FAIL11 '; end if;

  select count(*) into v_n from employee_payroll_info(v_a);
  if v_n = 1 then r := r || 'OK12 '; else r := r || 'FAIL12 '; end if;

  /* Työkaverin verokortti ei tule maksupäivähaustakaan. */
  if (select id from tax_card_on_pay_date(v_a, v_d, '2026-06-15')) is null
    then r := r || 'OK13 '; else r := r || 'FAIL13 '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;

-- ===========================================================================
-- 3. Palkkakertymä ja tulorajan seuranta
-- ===========================================================================
--
-- Vain hyväksytty ja maksettu kerryttävät. Luonnos on keskeneräinen
-- arvio, peruttu on virhe jota ei tapahtunut. Jos luonnos kerryttäisi,
-- tuloraja täyttyisi palkoista joita kukaan ei ole maksanut.

do $t$
declare
  r text := '';
  v_a uuid;
  v_owner uuid := gen_random_uuid();
  v_e uuid := gen_random_uuid();
  v_period uuid;
  v_n bigint;
begin
  insert into restaurants (name, slug, timezone)
  values ('ZZ Kertyma', 'zz-kertyma', 'Europe/Helsinki') returning id into v_a;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzko@x.test', now(), now()),
    (v_e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zzke@x.test', now(), now());

  insert into profiles (id, full_name) values
    (v_owner, 'Omistaja'), (v_e, 'Tyontekija E')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into memberships (restaurant_id, user_id, role) values
    (v_a, v_owner, 'owner'), (v_a, v_e, 'employee');

  insert into tax_cards (restaurant_id, user_id, base_percent, additional_percent,
                         income_limit_cents, valid_from, valid_to)
  values (v_a, v_e, 20.00, 42.00, 2500000, '2026-01-01', '2026-12-31');

  insert into pay_periods (restaurant_id, starts_on, ends_on, pay_date)
  values (v_a, '2026-03-01', '2026-03-31', '2026-04-15') returning id into v_period;

  -- Hyväksytty: 2 000 € veronalaista
  insert into payslips (restaurant_id, pay_period_id, user_id, status, pay_date,
                        gross_cents, taxable_cents, withholding_cents, net_cents,
                        employee_pension_cents, employee_unemployment_cents,
                        employer_pension_cents, employer_health_cents,
                        employer_unemployment_cents)
  values (v_a, v_period, v_e, 'approved', '2026-04-15',
          200000, 200000, 40000, 143620, 14600, 1780, 34200, 3820, 620);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 200000 then r := r || 'OK1 '; else r := r || 'FAIL1 ' || v_n || ' '; end if;

  select employer_cost_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  /* 200000 + 34200 + 3820 + 620 = 238640 */
  if v_n = 238640 then r := r || 'OK2 '; else r := r || 'FAIL2 ' || v_n || ' '; end if;

  select used_cents into v_n from income_limit_status(v_a, v_e, '2026-04-15');
  if v_n = 200000 then r := r || 'OK3 '; else r := r || 'FAIL3 ' || v_n || ' '; end if;

  select remaining_cents into v_n from income_limit_status(v_a, v_e, '2026-04-15');
  if v_n = 2300000 then r := r || 'OK4 '; else r := r || 'FAIL4 ' || v_n || ' '; end if;

  -- Luonnos ei saa kerryttää
  reset role;
  insert into pay_periods (restaurant_id, starts_on, ends_on, pay_date)
  values (v_a, '2026-04-01', '2026-04-30', '2026-05-15') returning id into v_period;

  insert into payslips (restaurant_id, pay_period_id, user_id, status, pay_date,
                        gross_cents, taxable_cents, net_cents)
  values (v_a, v_period, v_e, 'draft', '2026-05-15', 500000, 500000, 400000);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 200000 then r := r || 'OK5 '; else r := r || 'FAIL5 ' || v_n || ' '; end if;

  -- Hyväksyminen kerryttää
  reset role;
  update payslips set status = 'approved'
  where pay_period_id = v_period and user_id = v_e;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 700000 then r := r || 'OK6 '; else r := r || 'FAIL6 ' || v_n || ' '; end if;

  -- Peruminen poistaa kertymästä
  reset role;
  update payslips set status = 'cancelled', cancelled_at = now()
  where pay_period_id = v_period and user_id = v_e;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 200000 then r := r || 'OK7 '; else r := r || 'FAIL7 ' || v_n || ' '; end if;

  -- Maksettu kerryttää
  reset role;
  update payslips set status = 'paid', paid_at = now()
  where pay_period_id = v_period and user_id = v_e;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);

  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 700000 then r := r || 'OK8 '; else r := r || 'FAIL8 ' || v_n || ' '; end if;

  -- Eri vuosi ei sekoitu
  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2025);
  if v_n = 0 then r := r || 'OK9 '; else r := r || 'FAIL9 ' || v_n || ' '; end if;

  -- Työntekijä näkee oman kertymänsä
  perform set_config('request.jwt.claims', json_build_object('sub', v_e)::text, true);
  select taxable_cents into v_n from payroll_accrual(v_a, v_e, 2026);
  if v_n = 700000 then r := r || 'OK10 '; else r := r || 'FAIL10 ' || v_n || ' '; end if;

  raise exception 'TULOKSET: %', r;
end $t$;
