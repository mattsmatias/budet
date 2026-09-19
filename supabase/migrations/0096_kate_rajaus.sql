-- Kate rajataan ytimeensä: paljonko rahaa tuli, mihin se meni ja miten
-- se jakautui.
--
-- Poistetaan kokonaan pöytävaraukset, lounaslistat ja some-julkaisut,
-- työvuorot ja leimaukset, poissaolot sekä palkanlaskenta ja verokortit.
-- Palkkakulu kirjataan jatkossa kuluksi Henkilöstö-kategoriaan
-- palkkapalvelun kuukausiyhteenvedosta.
--
-- Säilyvät: myynti, kuitit ja kulut, toimittajat, budjetit, kirjanpito,
-- raportit, tehtävät, Matti, tiedostot ja matkakulut. Käyttäjät (omistaja,
-- esihenkilö, kirjanpitäjä) kutsutaan edelleen kutsukoodilla.
--
-- Järjestys: ensin näkymä ja säilyvät funktiot jotka viittaavat
-- poistuviin sarakkeisiin, sitten taulut, funktiot, sarakkeet, tyypit
-- ja tallennustilojen politiikat.

-- ---------------------------------------------------------------------------
-- 1. Näkymä ensin pois: se viittaa poistuviin sarakkeisiin.
-- ---------------------------------------------------------------------------

drop view if exists public.my_restaurants;

-- ---------------------------------------------------------------------------
-- 2. Säilyvät funktiot uusiksi ilman tehtävänimikettä ja palkkaa
-- ---------------------------------------------------------------------------

drop function if exists public.create_invitation(uuid, app_role, staff_position, integer, text);
drop function if exists public.update_membership(uuid, uuid, app_role, staff_position, integer, boolean);
drop function if exists public.update_restaurant(uuid, text, text, boolean, smallint);
drop function if exists public.preview_invitation(text);

create function public.create_invitation(
  p_restaurant uuid,
  p_role app_role default 'accountant',
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := '';
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi kutsua käyttäjiä';
  end if;

  -- Satunnaisuus gen_random_uuid():sta eikä random():sta: kutsukoodi
  -- antaa pääsyn ravintolan tietoihin, joten arvattavuus on turvakysymys.
  v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');

  -- Aakkostosta puuttuvat I, O, 0 ja 1: ne sekoittuvat luettuna.
  -- 32 merkkiä jakaa 256 tasan, joten jakojäännös ei vinouta jakaumaa.
  for i in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(v_bytes, i - 1) % length(v_alphabet)),
      1
    );
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, label, created_by
  )
  values (
    p_restaurant,
    encode(sha256(v_code::bytea), 'hex'),
    right(v_code, 4),
    p_role,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  return v_code;
end;
$$;

create function public.preview_invitation(p_code text)
returns table (restaurant_name text, role app_role)
language sql
stable
security definer
set search_path = public
as $$
  select r.name, i.role
  from restaurant_invitations i
  join restaurants r on r.id = i.restaurant_id
  where i.code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex')
    and i.accepted_at is null
    and i.expires_at >= now();
$$;

create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv restaurant_invitations;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex');

  if v_inv.id is null then
    raise exception 'Koodia ei löytynyt';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Koodi on jo käytetty';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Koodi on vanhentunut';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  update memberships
  set active = true,
      role = v_inv.role
  where restaurant_id = v_inv.restaurant_id and user_id = v_user;

  if not found then
    insert into memberships (restaurant_id, user_id, role)
    values (v_inv.restaurant_id, v_user, v_inv.role);
  end if;

  update restaurant_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.restaurant_id;
end;
$$;

create function public.update_membership(
  p_restaurant uuid,
  p_user uuid,
  p_role app_role,
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_count int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa jäsenyyksiä';
  end if;

  if p_role is distinct from 'owner' or not p_active then
    select count(*) into v_owner_count from memberships
    where restaurant_id = p_restaurant and role = 'owner' and active;

    if v_owner_count <= 1 and exists (
      select 1 from memberships
      where restaurant_id = p_restaurant and user_id = p_user
        and role = 'owner' and active
    ) then
      raise exception 'Ravintolalla on oltava vähintään yksi omistaja';
    end if;
  end if;

  update memberships
  set role = p_role,
      active = p_active
  where restaurant_id = p_restaurant and user_id = p_user;
end;
$$;

create function public.update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa asetuksia';
  end if;

  -- Nimi saa puuttua (toinen lomake), muttei olla tyhjä.
  if p_name is not null and trim(p_name) = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if p_timezone is not null
     and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  update restaurants
  set name = coalesce(trim(p_name), name),
      timezone = coalesce(p_timezone, timezone),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

create or replace function public.audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'member', new.user_id,
      audit_person_name(new.user_id),
      audit_person_name(new.user_id) || ' lisättiin ravintolaan roolilla ' || new.role::text || '.',
      null, jsonb_build_object('role', new.role), true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'member', old.user_id,
      audit_person_name(old.user_id),
      audit_person_name(old.user_id) || ' poistettiin ravintolasta.',
      jsonb_build_object('role', old.role), null, true
    );
    return old;
  end if;

  v_name := audit_person_name(new.user_id);

  if new.role is distinct from old.role then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': rooli ' || old.role::text || ' → ' || new.role::text || '.',
      jsonb_build_object('role', old.role), jsonb_build_object('role', new.role), true
    );
  end if;

  if new.active is distinct from old.active then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || (case when new.active then ' aktivoitiin.' else ' poistettiin käytöstä.' end),
      jsonb_build_object('active', old.active),
      jsonb_build_object('active', new.active), true
    );
  end if;

  return new;
end;
$$;

create or replace function public.create_restaurant(
  p_name text,
  p_timezone text default 'Europe/Helsinki'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Ravintolan nimi puuttuu';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  for v_attempt in 1..5 loop
    begin
      insert into restaurants (name, timezone, slug)
      values (
        trim(p_name),
        coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'),
        restaurant_slug(p_name)
      )
      returning id into v_id;

      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Ravintolan osoitetunnusta ei voitu muodostaa. Kokeile toista nimeä.';
      end if;
    end;
  end loop;

  insert into memberships (restaurant_id, user_id, role)
  values (v_id, v_user, 'owner');

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  perform seed_default_folders(v_id);

  return v_id;
end;
$$;

create or replace function public.sa_invite_owner(
  p_restaurant uuid,
  p_role app_role default 'owner',
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := '';
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i integer;
  v_name text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select name into v_name from restaurants where id = p_restaurant;
  if v_name is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  -- Sama satunnaisuus kuin create_invitationissa: random() on arvattava.
  v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(v_bytes, i - 1) % length(v_alphabet)),
      1
    );
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, label, created_by
  )
  values (
    p_restaurant,
    encode(sha256(v_code::bytea), 'hex'),
    right(v_code, 4),
    p_role,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  perform sa_log(
    'user.invited',
    'Kutsu luotiin rooliin ' || p_role::text || ': ' || v_name,
    'restaurant', p_restaurant, v_name, null,
    jsonb_build_object('role', p_role), false
  );

  return v_code;
end;
$$;

create or replace function public.sa_restaurant(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select jsonb_build_object(
    'restaurant', to_jsonb(x),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'membershipId', m.id,
        'id', m.user_id,
        'name', p.full_name,
        'email', u.email,
        'role', m.role::text,
        'active', m.active,
        'isSuperAdmin', coalesce(p.is_super_admin, false),
        'lastSignInAt', u.last_sign_in_at,
        'createdAt', m.created_at
      ) order by m.role, p.full_name), '[]'::jsonb)
      from memberships m
      left join profiles p on p.id = m.user_id
      left join auth.users u on u.id = m.user_id
      where m.restaurant_id = p_id
    ),
    'invitations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'role', i.role::text,
        'label', i.label,
        'hint', i.code_hint,
        'createdAt', i.created_at,
        'acceptedAt', i.accepted_at
      ) order by i.created_at desc), '[]'::jsonb)
      from restaurant_invitations i
      where i.restaurant_id = p_id and i.accepted_at is null
    ),
    'usage', jsonb_build_object(
      'receipts',   (select count(*) from receipts    where restaurant_id = p_id),
      'tasks',      (select count(*) from tasks       where restaurant_id = p_id),
      'salesDays',  (select count(*) from daily_sales where restaurant_id = p_id),
      'aiChats',    (select count(*) from ai_conversations where restaurant_id = p_id),
      'activeUsers',(select count(*) from memberships where restaurant_id = p_id and active),
      'lastSignInAt', (select max(u.last_sign_in_at) from memberships m
                        join auth.users u on u.id = m.user_id
                       where m.restaurant_id = p_id and m.active)
    ),
    'flags', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.key, 'label', f.label, 'global', f.enabled,
        'override', o.enabled
      ) order by f.key), '[]'::jsonb)
      from feature_flags f
      left join feature_flag_restaurants o
        on o.flag_key = f.key and o.restaurant_id = p_id
    )
  ) into v
  from (
    select r.id, r.name, r.slug, r.status::text as status, r.plan::text as plan,
           r.legal_name, r.business_id, r.address, r.postal_code, r.city,
           r.phone, r.email, r.website, r.logo_url, r.industry,
           r.timezone, r.currency, r.is_test_account, r.trial_ends_on,
           r.status_note, r.status_changed_at, r.created_at
    from restaurants r where r.id = p_id
  ) x;

  return v;
end;
$$;

create or replace function public.sa_delete_restaurant(p_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_snapshot jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select name into v_name from restaurants where id = p_id;
  if v_name is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  if trim(coalesce(p_confirm, '')) <> v_name then
    raise exception 'Vahvistus ei tasmaa ravintolan nimeen';
  end if;

  select jsonb_build_object(
    'name', v_name,
    'users',    (select count(*) from memberships where restaurant_id = p_id),
    'receipts', (select count(*) from receipts where restaurant_id = p_id),
    'tasks',    (select count(*) from tasks where restaurant_id = p_id)
  ) into v_snapshot;

  -- Loki ensin: rivi ei saa kadota poiston mukana.
  perform sa_log(
    'restaurant.deleted',
    'Ravintola poistettiin pysyvasti: ' || v_name,
    'restaurant', p_id, v_name, v_snapshot, null, true
  );

  delete from restaurants where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Poistuvat taulut. CASCADE vie mukanaan niiden triggerit ja politiikat.
-- ---------------------------------------------------------------------------

drop table if exists
  public.reservation_table_assignments,
  public.reservation_status_history,
  public.reservations,
  public.reservation_settings,
  public.reservation_hours,
  public.reservation_durations,
  public.reservation_exceptions,
  public.table_combination_members,
  public.table_combinations,
  public.restaurant_tables,
  public.floor_elements,
  public.floor_plan_images,
  public.dining_areas,
  public.lunch_item_allergens,
  public.lunch_item_diets,
  public.lunch_items,
  public.lunch_prices,
  public.lunch_days,
  public.lunch_menus,
  public.allergen_types,
  public.diet_types,
  public.meta_publications,
  public.meta_tokens,
  public.meta_connections,
  public.shift_changes,
  public.clock_events,
  public.time_corrections,
  public.absences,
  public.shifts,
  public.payslip_lines,
  public.payslips,
  public.pay_periods,
  public.pay_components,
  public.payroll_settings,
  public.payroll_tax_rules,
  public.payroll_benefit_values,
  public.tax_cards,
  public.employee_benefits
cascade;

-- ---------------------------------------------------------------------------
-- 4. Poistuvat funktiot
-- ---------------------------------------------------------------------------

drop function if exists
  public.audit_employee_benefits(),
  public.audit_payslips(),
  public.audit_shift_label(uuid, date, time, time),
  public.audit_shifts(),
  public.audit_tax_cards(),
  public.bulk_remove_shifts(uuid[]),
  public.cancel_shift(uuid),
  public.claim_open_shift(uuid),
  public.clear_lunch_day_items(uuid),
  public.copy_lunch_day(uuid, uuid),
  public.copy_lunch_week(uuid, date, date),
  public.copy_shifts(uuid, date, date, integer),
  public.create_recurring_shifts(uuid, uuid, integer[], time, time, date, date, integer, staff_position, text, text),
  public.delete_floor_plan_image(uuid),
  public.delete_lunch_item(uuid),
  public.delete_shift(uuid),
  public.employee_payroll_info(uuid),
  public.guard_shift_response(),
  public.income_limit_status(uuid, uuid, date),
  public.kitchen_check(uuid, timestamptz, integer, uuid),
  public.kitchen_load(uuid, timestamptz, uuid),
  public.log_reservation_status(),
  public.lunch_day_restaurant(uuid),
  public.lunch_item_restaurant(uuid),
  public.mark_absence_certificate(uuid, boolean),
  public.meta_disconnect(uuid),
  public.meta_page_token(uuid),
  public.meta_record_publication(uuid, uuid, date, text, text, meta_publish_status, text, text, meta_publish_status, text, text),
  public.meta_save_connection(uuid, text, text, text, text, text, text[], text, timestamptz),
  public.meta_set_status(uuid, meta_connection_status, text),
  public.move_lunch_item(uuid, boolean),
  public.open_lunch_week(uuid, date),
  public.payroll_accrual(uuid, uuid, integer),
  public.payslip_locked_when_period_approved(),
  public.public_cancel_reservation(text),
  public.public_create_reservation(text, date, time, integer, text, text, text, text, text),
  public.public_lunch_week(text, date),
  public.public_reservation_config(text),
  public.public_reservation_lookup(text),
  public.public_reservation_slots(text, date, integer),
  public.publish_lunch_week(uuid),
  public.publish_shifts(uuid, date, date),
  public.record_clock_event(uuid, clock_event_type),
  public.reorder_lunch_items(uuid, uuid[]),
  public.reservation_admin_slots(uuid, date, integer, uuid),
  public.reservation_book(uuid, timestamptz, integer, text, text, text, text, reservation_source, reservation_status, integer, uuid[], text, text),
  public.reservation_create_admin(uuid, date, time, integer, text, text, text, text, boolean, integer, uuid[], text),
  public.reservation_day(uuid, date),
  public.reservation_duration_for(uuid, integer),
  public.reservation_free_tables(uuid),
  public.reservation_import_reservations(uuid, jsonb),
  public.reservation_import_tables(uuid, jsonb),
  public.reservation_night_range(uuid, date),
  public.reservation_pick_tables(uuid, timestamptz, timestamptz, integer, uuid),
  public.reservation_reference_candidate(),
  public.reservation_search(uuid, text, date, text, integer, integer),
  public.reservation_set_bill(uuid, boolean),
  public.reservation_set_reference(),
  public.reservation_set_status(uuid, reservation_status),
  public.reservation_slots(uuid, date, integer, uuid),
  public.reservation_span_minutes(time, time),
  public.reservation_start_at(uuid, date, time),
  public.reservation_stats(uuid, date, date),
  public.reservation_table_options(uuid, timestamptz, timestamptz, integer, uuid, integer),
  public.reservation_totals(uuid, timestamptz, timestamptz),
  public.reservation_update(uuid, date, time, integer, text, text, text, text, uuid[], text),
  public.reservation_window(uuid, date, text),
  public.reservation_windows(uuid, date),
  public.sa_meta_diagnostics(uuid),
  public.save_employment_details(uuid, uuid, date, date, date),
  public.save_floor_elements(uuid, uuid, jsonb),
  public.save_floor_plan_image(uuid, text, integer, integer, numeric),
  public.save_lunch_item(uuid, uuid, text, text, text[], text[]),
  public.save_table_positions(uuid, jsonb),
  public.set_floor_plan_opacity(uuid, numeric),
  public.set_lunch_includes(uuid, boolean, boolean),
  public.set_lunch_price(uuid, text, integer, integer),
  public.set_lunch_theme(uuid, text),
  public.set_lunch_week_status(uuid, lunch_status),
  public.shift_conflicts(uuid, date, time, time),
  public.shift_range(date, time, time),
  public.staff_pay_rates(uuid),
  public.sync_reservation_assignments(),
  public.tax_card_on_pay_date(uuid, uuid, date),
  public.touch_lunch_menu_from_child(),
  public.touch_lunch_menu_from_day(),
  public.touch_lunch_menu_from_item_child(),
  public.touch_lunch_menu_from_price(),
  public.upsert_shift(uuid, uuid, uuid, date, time, time, text, staff_position, integer, text);

-- ---------------------------------------------------------------------------
-- 5. Poistuvat sarakkeet. Ilman CASCADEa: jos jokin vielä riippuu
--    sarakkeesta, migraatio pysähtyy eikä riippuvuus katoa hiljaa.
-- ---------------------------------------------------------------------------

alter table public.memberships
  drop column if exists position,
  drop column if exists hourly_rate_cents,
  drop column if exists pay_type,
  drop column if exists monthly_salary_cents,
  drop column if exists employment_starts_on,
  drop column if exists employment_ends_on,
  drop column if exists birth_date;

alter table public.restaurant_invitations
  drop column if exists position,
  drop column if exists hourly_rate_cents;

alter table public.restaurants
  drop column if exists lunch_theme,
  drop column if exists clock_in_early_minutes,
  drop column if exists open_shift_claiming;

alter table public.profiles
  drop column if exists birth_day,
  drop column if exists birth_month;

-- ---------------------------------------------------------------------------
-- 6. Poistuvat tyypit
-- ---------------------------------------------------------------------------

drop type if exists
  public.absence_kind,
  public.benefit_kind,
  public.clock_event_type,
  public.floor_element_kind,
  public.lunch_status,
  public.meta_connection_status,
  public.meta_publish_status,
  public.pay_component_unit,
  public.pay_period_status,
  public.pay_type,
  public.payslip_line_kind,
  public.payslip_status,
  public.reservation_source,
  public.reservation_status,
  public.shift_status,
  public.staff_position,
  public.table_shape,
  public.tax_card_source;

-- ---------------------------------------------------------------------------
-- 7. Näkymä takaisin ilman poistuneita sarakkeita
-- ---------------------------------------------------------------------------

-- Käyttäjän omilla oikeuksilla (security_invoker): RLS rajaa rivit
-- jo valmiiksi, eikä näkymän tarvitse ohittaa sitä.
create view public.my_restaurants
with (security_invoker = true) as
select r.id, r.name, r.timezone, r.currency, m.role, r.slug
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

revoke all on public.my_restaurants from anon;
grant select on public.my_restaurants to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Oikeudet uusille funktioille
-- ---------------------------------------------------------------------------

revoke all on function public.create_invitation(uuid, app_role, text) from public, anon;
revoke all on function public.update_membership(uuid, uuid, app_role, boolean) from public, anon;
revoke all on function public.update_restaurant(uuid, text, text) from public, anon;
revoke all on function public.preview_invitation(text) from public;
grant execute on function public.create_invitation(uuid, app_role, text) to authenticated;
grant execute on function public.update_membership(uuid, uuid, app_role, boolean) to authenticated;
grant execute on function public.update_restaurant(uuid, text, text) to authenticated;
-- Kutsun esikatselu näytetään ennen kirjautumista (0032): anon saa sen,
-- mutta vain voimassa olevalla koodilla ja vain ravintolan nimen ja roolin.
grant execute on function public.preview_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Tallennustilat ja ominaisuusliput
-- ---------------------------------------------------------------------------

drop policy if exists social_storage_read on storage.objects;
drop policy if exists social_storage_write on storage.objects;
drop policy if exists social_storage_delete on storage.objects;
drop policy if exists floorplans_storage_read on storage.objects;
drop policy if exists floorplans_storage_write on storage.objects;
drop policy if exists floorplans_storage_update on storage.objects;
drop policy if exists floorplans_storage_delete on storage.objects;

-- Tyhjät säiliöt social ja floorplans poistetaan Supabasen hallinnasta:
-- storage estää suoran poiston SQL:llä. Ilman politiikkoja niihin ei
-- pääse kukaan käsiksi.

delete from feature_flag_restaurants
where flag_key in ('lunch_module', 'payroll', 'shift_planning');
delete from feature_flags
where key in ('lunch_module', 'payroll', 'shift_planning');
