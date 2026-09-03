-- ---------------------------------------------------------------------------
-- RestoFlow — kaikki migraatiot yhtenä tiedostona
-- ---------------------------------------------------------------------------
--
-- GENEROITU TIEDOSTO. Älä muokkaa käsin — muutokset katoavat.
-- Lähde: supabase/migrations/000*.sql
-- Luo uudelleen: npm run bundle:sql
--
-- Käyttö: liitä kokonaisuudessaan Supabasen SQL-editoriin tuoreelle
-- kannalle. Migraatiot ovat idempotentteja (create ... if not exists,
-- create or replace, drop policy if exists), joten ajo olemassa olevaa
-- kantaa vasten on turvallinen.
--
-- Sisältää 99 migraatiota:
--   0001_schema.sql
--   0002_rls.sql
--   0003_functions.sql
--   0004_management.sql
--   0005_auth_callback.sql
--   0006_receipts_manager_only.sql
--   0007_settings_closing_absences.sql
--   0008_custom_categories.sql
--   0009_invitation_hash_fix.sql
--   0010_shift_status_cast.sql
--   0011_shifts_no_approval.sql
--   0012_absence_period_certificate.sql
--   0013_merchants.sql
--   0014_merchant_seed.sql
--   0015_merchant_backfill.sql
--   0016_lunch.sql
--   0017_lunch_functions.sql
--   0018_lunch_copy_publish_public.sql
--   0019_my_restaurants_slug.sql
--   0020_matti.sql
--   0021_clear_lunch_day_items.sql
--   0022_lunch_week_price.sql
--   0023_lunch_includes.sql
--   0024_lunch_theme.sql
--   0025_public_lunch_theme.sql
--   0026_public_lunch_diet_short.sql
--   0027_payroll.sql
--   0028_wage_privacy.sql
--   0029_clock_requires_shift.sql
--   0030_workplace.sql
--   0031_profiles_policy_recursion.sql
--   0032_invitation_preview.sql
--   0033_daily_sales.sql
--   0034_claim_open_shift.sql
--   0035_settings_partial_update.sql
--   0036_sales_report.sql
--   0037_sales_groups_vat.sql
--   0038_default_sales_groups.sql
--   0039_food_vat_rate.sql
--   0040_receipt_pages.sql
--   0041_pos_vat_breakdown.sql
--   0042_partial_vat_rows.sql
--   0043_default_pos_mappings.sql
--   0044_restaurant_slug_on_create.sql
--   0045_shift_planning.sql
--   0046_shift_copy_recurring.sql
--   0047_clock_in_published_shift.sql
--   0048_delete_open_shift.sql
--   0049_bulk_remove_shifts.sql
--   0050_tasks.sql
--   0051_audit_log.sql
--   0052_task_functions.sql
--   0053_audit_triggers.sql
--   0054_restaurant_lifecycle.sql
--   0055_super_admin_core.sql
--   0056_accounting_core.sql
--   0056_super_admin_read.sql
--   0057_accounting_sync.sql
--   0057_super_admin_write.sql
--   0058_accounting_vat_lock_audit.sql
--   0058_super_admin_grants.sql
--   0059_accounting_reports.sql
--   0059_lock_super_admin_column.sql
--   0060_tax_guides.sql
--   0061_accounting_fixes.sql
--   0062_accounting_automatic.sql
--   0063_lunch_price_sort_order.sql
--   0064_locale_support.sql
--   0065_locale_estonian.sql
--   0066_reservations.sql
--   0067_reservation_engine.sql
--   0068_reservation_admin.sql
--   0069_lunch_reorder.sql
--   0070_meta.sql
--   0071_files.sql
--   0072_file_actions.sql
--   0073_default_folders.sql
--   0074_files_lifecycle.sql
--   0075_files_lifecycle_actions.sql
--   0076_folder_default_key.sql
--   0077_file_reminder.sql
--   0078_file_activity.sql
--   0079_payroll_tax_rules.sql
--   0080_tax_cards.sql
--   0081_payslip_tax.sql
--   0082_floor_plan.sql
--   0083_table_options.sql
--   0084_floor_elements.sql
--   0085_service_state.sql
--   0086_reservation_update_poyta.sql
--   0087_reservation_day.sql
--   0088_reservation_stats.sql
--   0089_floor_plan_image.sql
--   0090_ledger_issue_codes.sql
--   0091_reservation_fields.sql
--   0092_reservation_engine_night.sql
--   0093_reservation_search.sql
--   0094_reservation_stats_trend.sql
--   0095_reservation_import.sql
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 0001_schema.sql
-- ===========================================================================

-- RestoFlow — tietokannan rakenne.
--
-- Rakenne:
--   restaurants → memberships → profiles (auth.users)
--               → suppliers
--               → receipts → receipt_items
--               → budgets
--               → shifts
--               → clock_events
--               → absences
--
-- RAJAUS: ei myyntiä, ei kassaa, ei pankkiyhteyttä. Tietokannassa ei ole
-- taulua eikä saraketta liikevaihdolle. Rajaus on tässä eikä vain
-- käyttöliittymässä, jotta kulutietoa ei voi vahingossa esittää ravintolan
-- tuloksena.
--
-- Rahamäärät ovat AINA sentteinä kokonaislukuina. numeric olisi tarkka
-- mutta houkuttelisi liukulukuihin sovelluspuolella.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type app_role as enum ('owner', 'manager', 'employee', 'accountant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staff_position as enum ('waiter', 'kitchen', 'manager', 'cleaning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_category as enum (
    'food', 'alcohol', 'soft_drinks', 'cleaning', 'kitchen_supplies',
    'packaging', 'staff', 'transport', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('card', 'cash', 'invoice', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type receipt_status as enum ('confirmed', 'needs_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_status as enum ('draft', 'pending', 'accepted', 'declined', 'changed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type clock_event_type as enum ('in', 'break_start', 'break_end', 'out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type absence_kind as enum ('sick', 'other', 'cannot_attend');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profiilit
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ravintolat ja jäsenyydet
-- ---------------------------------------------------------------------------

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Europe/Helsinki',
  currency char(3) not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role app_role not null default 'employee',
  position staff_position,
  -- Tuntipalkka sentteinä. Null kirjanpitäjälle, joka ei ole vuorossa.
  hourly_rate_cents int check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index if not exists memberships_user_idx on memberships (user_id) where active;
create index if not exists memberships_restaurant_idx on memberships (restaurant_id);

-- ---------------------------------------------------------------------------
-- Toimittajat
-- ---------------------------------------------------------------------------

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  default_category expense_category not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists suppliers_restaurant_idx on suppliers (restaurant_id);

-- Managerin tekemät kategoriakorjaukset. Kun sama korjaus toistuu, sitä
-- ehdotetaan jatkossa — sääntö korjaushistoriasta, ei mallin koulutusta.
create table if not exists supplier_category_overrides (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  from_category expense_category not null,
  to_category expense_category not null,
  count int not null default 1 check (count > 0),
  updated_at timestamptz not null default now(),
  unique (supplier_id, from_category, to_category)
);

-- ---------------------------------------------------------------------------
-- Kuitit
-- ---------------------------------------------------------------------------

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  supplier_id uuid references suppliers (id) on delete set null,
  -- Nimi kopioidaan riville: toimittajan poisto ei saa hävittää historiaa.
  supplier_name text not null,
  receipt_date date not null,
  total_cents int not null check (total_cents >= 0),
  vat_cents int check (vat_cents is null or vat_cents >= 0),
  category expense_category not null default 'other',
  payment_method payment_method not null default 'unknown',
  receipt_number text,
  note text,
  status receipt_status not null default 'needs_review',
  review_reasons text[] not null default '{}',
  image_path text,
  image_quality text check (image_quality is null or image_quality in ('good', 'poor')),
  -- Tiedoston tiiviste. Sama tiedosto ei mene kahdesti läpi.
  file_hash text,
  added_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipts_restaurant_date_idx
  on receipts (restaurant_id, receipt_date desc);
create index if not exists receipts_supplier_idx on receipts (supplier_id);
create index if not exists receipts_status_idx
  on receipts (restaurant_id, status) where status = 'needs_review';
create index if not exists receipts_added_by_idx on receipts (added_by);

-- Sama tiedosto ei kelpaa kahdesti samaan ravintolaan.
create unique index if not exists receipts_hash_unique
  on receipts (restaurant_id, file_hash) where file_hash is not null;

create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  line_number int not null check (line_number > 0),
  description text not null default '',
  quantity numeric(12, 3),
  unit text,
  total_cents int not null check (total_cents >= 0),
  category expense_category not null default 'other',
  -- Kanta desimaalina: 0.145 = 14,5 %.
  vat_rate numeric(5, 4) check (vat_rate is null or (vat_rate >= 0 and vat_rate < 1)),
  vat_cents int check (vat_cents is null or vat_cents >= 0),
  product_group text,
  unique (receipt_id, line_number)
);

create index if not exists receipt_items_receipt_idx on receipt_items (receipt_id);
create index if not exists receipt_items_category_idx on receipt_items (category);

-- ---------------------------------------------------------------------------
-- Budjetit
-- ---------------------------------------------------------------------------

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  category expense_category not null,
  -- Kuukausi kuukauden ensimmäisenä päivänä, tai null jos toistuva.
  month date,
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Yksi toistuva ja yksi kuukausikohtainen budjetti per kategoria.
create unique index if not exists budgets_recurring_unique
  on budgets (restaurant_id, category) where month is null;
create unique index if not exists budgets_month_unique
  on budgets (restaurant_id, category, month) where month is not null;

-- ---------------------------------------------------------------------------
-- Työvuorot
-- ---------------------------------------------------------------------------

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  -- Null = avoin vuoro jolle ei ole tekijää.
  user_id uuid references profiles (id) on delete set null,
  position staff_position,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null default '',
  status shift_status not null default 'pending',
  previous_start_time time,
  previous_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shifts_restaurant_date_idx
  on shifts (restaurant_id, shift_date);
create index if not exists shifts_user_idx on shifts (user_id, shift_date);

-- ---------------------------------------------------------------------------
-- Työaika
-- ---------------------------------------------------------------------------

-- Leimaukset, ei laskettua työaikaa. Tila johdetaan näistä aina uudelleen:
-- tallennettu tila voisi ajautua eri linjalle kuin loki joka määrää palkan.
create table if not exists clock_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  event_type clock_event_type not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists clock_events_user_time_idx
  on clock_events (user_id, occurred_at desc);
create index if not exists clock_events_restaurant_time_idx
  on clock_events (restaurant_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Poissaolot
-- ---------------------------------------------------------------------------

create table if not exists absences (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  absence_date date not null,
  kind absence_kind not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists absences_restaurant_date_idx
  on absences (restaurant_id, absence_date);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'restaurants', 'memberships', 'suppliers',
    'receipts', 'budgets', 'shifts'
  ] loop
    execute format('drop trigger if exists touch_%1$s on %1$s', t);
    execute format(
      'create trigger touch_%1$s before update on %1$s
       for each row execute function touch_updated_at()', t
    );
  end loop;
end $$;


-- ===========================================================================
-- 0002_rls.sql
-- ===========================================================================

-- RestoFlow — Row Level Security.
--
-- Kaikki pääsy kulkee ravintolan jäsenyyden kautta. Rajat pakotetaan
-- tietokannassa, ei sovelluslogiikassa: unohdettu WHERE-ehto ei saa vuotaa
-- toisen ravintolan kuitteja.
--
-- Roolien erot:
--   owner     — kaikki, mukaan lukien budjetit ja käyttäjät
--   manager   — kaikki paitsi budjettien muokkaus ja käyttäjähallinta
--   employee  — vain omat: omat kuitit, omat vuorot, oma työaika
--   accountant— talous luettuna, ei tuntipalkkoja eikä työvuorohallintaa

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER ohittaa RLS:n, mikä katkaisee rekursion: memberships-
-- taulun politiikka ei voi kysyä memberships-taulua politiikan läpi.
create or replace function my_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from memberships
  where user_id = auth.uid() and active;
$$;

create or replace function my_role_in(p_restaurant uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from memberships
  where user_id = auth.uid() and restaurant_id = p_restaurant and active
  limit 1;
$$;

/** Onko käyttäjä managerin tasolla tai yli tässä ravintolassa? */
create or replace function is_manager(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role in ('owner', 'manager')
  );
$$;

create or replace function is_owner(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role = 'owner'
  );
$$;

/** Näkeekö rooli koko ravintolan talouden? Kirjanpitäjä näkee, työntekijä ei. */
create or replace function can_read_finance(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role in ('owner', 'manager', 'accountant')
  );
$$;

grant execute on function my_restaurant_ids to authenticated;
grant execute on function my_role_in to authenticated;
grant execute on function is_manager to authenticated;
grant execute on function is_owner to authenticated;
grant execute on function can_read_finance to authenticated;

-- ---------------------------------------------------------------------------
-- RLS päälle
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table memberships enable row level security;
alter table suppliers enable row level security;
alter table supplier_category_overrides enable row level security;
alter table receipts enable row level security;
alter table receipt_items enable row level security;
alter table budgets enable row level security;
alter table shifts enable row level security;
alter table clock_events enable row level security;
alter table absences enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated
  using (
    -- Oma profiili, tai saman ravintolan jäsen. Nimi tarvitaan
    -- työvuorolistoihin, joten se ei voi olla vain omalle näkyvä.
    id = auth.uid()
    or exists (
      select 1 from memberships m
      where m.user_id = profiles.id
        and m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------

drop policy if exists restaurants_read on restaurants;
create policy restaurants_read on restaurants
  for select to authenticated
  using (id in (select my_restaurant_ids()));

drop policy if exists restaurants_update on restaurants;
create policy restaurants_update on restaurants
  for update to authenticated
  using (is_owner(id))
  with check (is_owner(id));

-- Luonti kulkee create_restaurant-funktion kautta, ei suoraan.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists memberships_manage on memberships;
create policy memberships_manage on memberships
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------

drop policy if exists suppliers_read on suppliers;
create policy suppliers_read on suppliers
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

-- Työntekijä saa luoda toimittajan kuittia lisätessään, muttei muokata.
drop policy if exists suppliers_insert on suppliers;
create policy suppliers_insert on suppliers
  for insert to authenticated
  with check (restaurant_id in (select my_restaurant_ids()));

drop policy if exists suppliers_update on suppliers;
create policy suppliers_update on suppliers
  for update to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists overrides_read on supplier_category_overrides;
create policy overrides_read on supplier_category_overrides
  for select to authenticated
  using (
    supplier_id in (
      select id from suppliers where restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists overrides_write on supplier_category_overrides;
create policy overrides_write on supplier_category_overrides
  for all to authenticated
  using (
    supplier_id in (
      select id from suppliers where is_manager(restaurant_id)
    )
  )
  with check (
    supplier_id in (
      select id from suppliers where is_manager(restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------

drop policy if exists receipts_read on receipts;
create policy receipts_read on receipts
  for select to authenticated
  using (
    -- Talousroolit näkevät kaikki, työntekijä vain omansa.
    can_read_finance(restaurant_id)
    or (restaurant_id in (select my_restaurant_ids()) and added_by = auth.uid())
  );

drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts
  for insert to authenticated
  with check (
    restaurant_id in (select my_restaurant_ids())
    and added_by = auth.uid()
  );

drop policy if exists receipts_update on receipts;
create policy receipts_update on receipts
  for update to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists receipts_delete on receipts;
create policy receipts_delete on receipts
  for delete to authenticated
  using (is_manager(restaurant_id));

-- Rivit perivät kuitin oikeudet.
drop policy if exists receipt_items_read on receipt_items;
create policy receipt_items_read on receipt_items
  for select to authenticated
  using (receipt_id in (select id from receipts));

drop policy if exists receipt_items_write on receipt_items;
create policy receipt_items_write on receipt_items
  for all to authenticated
  using (
    receipt_id in (
      select id from receipts
      where is_manager(restaurant_id) or added_by = auth.uid()
    )
  )
  with check (
    receipt_id in (
      select id from receipts
      where is_manager(restaurant_id) or added_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

drop policy if exists budgets_read on budgets;
create policy budgets_read on budgets
  for select to authenticated
  using (can_read_finance(restaurant_id));

-- Vain omistaja muokkaa budjetteja.
drop policy if exists budgets_write on budgets;
create policy budgets_write on budgets
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------

drop policy if exists shifts_read on shifts;
create policy shifts_read on shifts
  for select to authenticated
  using (
    is_manager(restaurant_id)
    or (restaurant_id in (select my_restaurant_ids()) and user_id = auth.uid())
    -- Avoimet vuorot näkyvät kaikille: niihin voi ilmoittautua.
    or (restaurant_id in (select my_restaurant_ids()) and user_id is null)
  );

drop policy if exists shifts_manage on shifts;
create policy shifts_manage on shifts
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- Työntekijä saa vastata omaan vuoroonsa. Ajan muuttaminen estetään
-- erillisellä liipaisimella alempana — WITH CHECK ei näe vanhaa riviä.
drop policy if exists shifts_respond on shifts;
create policy shifts_respond on shifts
  for update to authenticated
  using (user_id = auth.uid() and restaurant_id in (select my_restaurant_ids()))
  with check (user_id = auth.uid() and status in ('accepted', 'declined'));

-- ---------------------------------------------------------------------------
-- clock_events
-- ---------------------------------------------------------------------------

drop policy if exists clock_events_read on clock_events;
create policy clock_events_read on clock_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
    -- Kirjanpitäjä näkee tunnit raportointia varten.
    or (
      restaurant_id in (select my_restaurant_ids())
      and my_role_in(restaurant_id) = 'accountant'
    )
  );

-- Leimauksen saa tehdä vain itselleen.
drop policy if exists clock_events_insert on clock_events;
create policy clock_events_insert on clock_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and restaurant_id in (select my_restaurant_ids())
  );

-- Leimauksia ei muokata eikä poisteta. Työaikaloki on kirjanpitoa; korjaus
-- tehdään uudella tapahtumalla, ei vanhaa muuttamalla.

-- ---------------------------------------------------------------------------
-- absences
-- ---------------------------------------------------------------------------

drop policy if exists absences_read on absences;
create policy absences_read on absences
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists absences_insert on absences;
create policy absences_insert on absences
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and restaurant_id in (select my_restaurant_ids())
  );

-- ---------------------------------------------------------------------------
-- Työntekijän vuorovastauksen rajaus
-- ---------------------------------------------------------------------------

/**
 * Työntekijä saa vaihtaa vain tilan, ei aikoja eikä tekijää.
 *
 * RLS:n WITH CHECK tarkistaa vain uuden rivin, joten se ei voi verrata
 * vanhaan. Tämä liipaisin tekee sen.
 */
create or replace function guard_shift_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_manager(new.restaurant_id) then
    return new;
  end if;

  if new.shift_date is distinct from old.shift_date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.user_id is distinct from old.user_id
     or new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Vain vuoron tilan voi muuttaa';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_shift_response_trigger on shifts;
create trigger guard_shift_response_trigger
  before update on shifts
  for each row execute function guard_shift_response();


-- ===========================================================================
-- 0003_functions.sql
-- ===========================================================================

-- RestoFlow — funktiot ja tallennus.

-- ---------------------------------------------------------------------------
-- Profiili syntyy rekisteröitymisestä
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Täydennä profiilit käyttäjille jotka rekisteröityivät ennen liipaisinta.
insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- Ravintolan perustus
-- ---------------------------------------------------------------------------

/**
 * Luo ravintolan, omistajajäsenyyden ja oletusbudjetit yhdessä
 * transaktiossa.
 *
 * Jos jokin epäonnistuu, mitään ei jää puolitiehen — muuten käyttäjä voisi
 * jäädä tilaan jossa ravintola on olemassa mutta hän ei ole sen jäsen,
 * jolloin RLS estäisi häntä näkemästä omaa ravintolaansa.
 */
create or replace function create_restaurant(
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

  insert into restaurants (name, timezone)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'))
  returning id into v_id;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;

-- ---------------------------------------------------------------------------
-- Kuitin tallennus riveineen
-- ---------------------------------------------------------------------------

/**
 * Tallentaa kuitin ja sen rivit yhdessä transaktiossa.
 *
 * Rivit ovat osa kuittia, eivät erillinen asia: puolikas kuitti jolla on
 * summa muttei rivejä näyttäisi kulunäkymässä oikealta ja jakautuisi
 * väärään kategoriaan.
 *
 * Palauttaa kuitin tunnisteen, tai virheen jos sama tiedosto on jo
 * tallennettu.
 */
create or replace function create_receipt(
  p_restaurant uuid,
  p_supplier_name text,
  p_date date,
  p_total_cents int,
  p_vat_cents int,
  p_category expense_category,
  p_payment payment_method,
  p_receipt_number text,
  p_note text,
  p_status receipt_status,
  p_review_reasons text[],
  p_image_path text,
  p_image_quality text,
  p_file_hash text,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_receipt uuid;
  v_supplier uuid;
  v_item jsonb;
  v_line int := 0;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'Loppusumma puuttuu';
  end if;

  -- Toimittaja luodaan tarvittaessa. Nimi on ravintolan sisällä uniikki,
  -- joten kilpaileva lisäys ei tuota kaksoiskappaletta.
  if coalesce(trim(p_supplier_name), '') <> '' then
    insert into suppliers (restaurant_id, name, default_category)
    values (p_restaurant, trim(p_supplier_name), p_category)
    on conflict (restaurant_id, name) do update set name = excluded.name
    returning id into v_supplier;
  end if;

  insert into receipts (
    restaurant_id, supplier_id, supplier_name, receipt_date, total_cents,
    vat_cents, category, payment_method, receipt_number, note, status,
    review_reasons, image_path, image_quality, file_hash, added_by
  )
  values (
    p_restaurant, v_supplier, coalesce(nullif(trim(p_supplier_name), ''), 'Tuntematon'),
    p_date, p_total_cents, p_vat_cents, p_category, p_payment,
    nullif(trim(p_receipt_number), ''), nullif(trim(p_note), ''), p_status,
    coalesce(p_review_reasons, '{}'), p_image_path, p_image_quality,
    nullif(trim(p_file_hash), ''), v_user
  )
  returning id into v_receipt;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_line := v_line + 1;
    insert into receipt_items (
      receipt_id, line_number, description, quantity, unit, total_cents,
      category, vat_rate, vat_cents, product_group
    )
    values (
      v_receipt,
      v_line,
      coalesce(v_item ->> 'description', ''),
      (v_item ->> 'quantity')::numeric,
      v_item ->> 'unit',
      coalesce((v_item ->> 'totalCents')::int, 0),
      coalesce((v_item ->> 'category')::expense_category, p_category),
      (v_item ->> 'vatRate')::numeric,
      (v_item ->> 'vatCents')::int,
      v_item ->> 'productGroup'
    );
  end loop;

  return v_receipt;
end;
$$;

revoke all on function create_receipt from public;
grant execute on function create_receipt to authenticated;

-- ---------------------------------------------------------------------------
-- Leimaus
-- ---------------------------------------------------------------------------

/**
 * Kirjaa työaikatapahtuman ja tarkistaa siirtymän kelvollisuuden
 * palvelimella.
 *
 * Selaimen tarkistukseen ei voi luottaa: kaksi välilehteä auki, ja
 * "SISÄÄN" voisi tulla kahdesti. Tila johdetaan tässä samasta
 * tapahtumajonosta kuin käyttöliittymässä.
 */
create or replace function record_clock_event(
  p_restaurant uuid,
  p_type clock_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := 'off';
  v_row record;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  -- Tila kuluvan päivän tapahtumista, samassa järjestyksessä kuin ne sattuivat.
  for v_row in
    select event_type from clock_events
    where user_id = v_user
      and restaurant_id = p_restaurant
      and occurred_at >= date_trunc('day', now())
    order by occurred_at
  loop
    v_state := case
      when v_row.event_type = 'in' and v_state = 'off' then 'working'
      when v_row.event_type = 'break_start' and v_state = 'working' then 'on_break'
      when v_row.event_type = 'break_end' and v_state = 'on_break' then 'working'
      when v_row.event_type = 'out' then 'off'
      else v_state
    end;
  end loop;

  if not (
    (p_type = 'in' and v_state = 'off')
    or (p_type = 'break_start' and v_state = 'working')
    or (p_type = 'break_end' and v_state = 'on_break')
    or (p_type = 'out' and v_state in ('working', 'on_break'))
  ) then
    raise exception 'Leimaus ei ole mahdollinen nykyisessä tilassa (%)', v_state;
  end if;

  insert into clock_events (restaurant_id, user_id, event_type)
  values (p_restaurant, v_user, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_clock_event from public;
grant execute on function record_clock_event to authenticated;

-- ---------------------------------------------------------------------------
-- Näkymä omista ravintoloista
-- ---------------------------------------------------------------------------

create or replace view my_restaurants
with (security_invoker = true)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;

-- ---------------------------------------------------------------------------
-- Tallennus
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 20971520,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

-- Polku alkaa aina ravintolan tunnisteella, ja pääsy ratkaistaan samalla
-- jäsenyydellä kuin muualla.
drop policy if exists receipts_storage_read on storage.objects;
create policy receipts_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists receipts_storage_write on storage.objects;
create policy receipts_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists receipts_storage_delete on storage.objects;
create policy receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );


-- ===========================================================================
-- 0004_management.sql
-- ===========================================================================

-- RestoFlow — managerin toiminnot.
--
-- Neljä asiaa jotka puuttuivat: käyttäjien kutsuminen, kuitin tarkistuksen
-- päättäminen, budjettien asetus ja työvuorojen hallinta.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Kutsut
-- ---------------------------------------------------------------------------

/**
 * Liittymiskoodi, ei sähköpostikutsu.
 *
 * Sähköpostin lähetys vaatisi ulkoisen palvelun. Koodi toimii ilman sitä:
 * manageri antaa sen työntekijälle miten haluaa, ja työntekijä syöttää sen
 * rekisteröitymisen jälkeen.
 *
 * Koodista tallennetaan vain tiiviste. Tietokannan lukuoikeus ei siis
 * riitä liittymiseen.
 */
create table if not exists restaurant_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  code_hash text not null unique,
  -- Neljä viimeistä merkkiä näkyviin, jotta manageri tunnistaa kutsun
  -- listasta antamatta koodia uudelleen.
  code_hint text not null,
  role app_role not null default 'employee',
  position staff_position,
  hourly_rate_cents int check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  label text,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references profiles (id) on delete set null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists restaurant_invitations_idx
  on restaurant_invitations (restaurant_id, created_at desc);

alter table restaurant_invitations enable row level security;

drop policy if exists restaurant_invitations_read on restaurant_invitations;
create policy restaurant_invitations_read on restaurant_invitations
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists restaurant_invitations_manage on restaurant_invitations;
create policy restaurant_invitations_manage on restaurant_invitations
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

/**
 * Luo kutsukoodin.
 *
 * Palauttaa koodin selväkielisenä kerran — sitä ei voi hakea myöhemmin,
 * koska kannassa on vain tiiviste. Kadonnut koodi mitätöidään ja luodaan
 * uusi.
 */
create or replace function create_invitation(
  p_restaurant uuid,
  p_role app_role default 'employee',
  p_position staff_position default null,
  p_hourly_rate_cents int default null,
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi kutsua käyttäjiä';
  end if;

  -- Aakkostosta on jätetty pois I, O, 0 ja 1: ne sekoittuvat puhelimessa
  -- luettuna ja koodi kirjoitetaan käsin.
  v_code := '';
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, position,
    hourly_rate_cents, label, created_by
  )
  values (
    p_restaurant,
    encode(digest(v_code, 'sha256'), 'hex'),
    right(v_code, 4),
    p_role,
    p_position,
    p_hourly_rate_cents,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  return v_code;
end;
$$;

revoke all on function create_invitation from public;
grant execute on function create_invitation to authenticated;

/**
 * Lunastaa kutsukoodin.
 *
 * SECURITY DEFINER, koska kutsuja ei vielä ole ravintolan jäsen eikä siis
 * näe kutsuriviä RLS:n läpi. Tarkistukset tehdään tässä käsin.
 */
create or replace function accept_invitation(p_code text)
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
  where code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex');

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

  -- Sama kaava kuin budjeteissa: päivitä, lisää jos ei ollut. Jäsenyys voi
  -- olla olemassa passivoituna, jolloin kutsu herättää sen uudelleen.
  update memberships
  set active = true,
      role = v_inv.role,
      position = v_inv.position,
      hourly_rate_cents = coalesce(v_inv.hourly_rate_cents, hourly_rate_cents)
  where restaurant_id = v_inv.restaurant_id and user_id = v_user;

  if not found then
    insert into memberships (
      restaurant_id, user_id, role, position, hourly_rate_cents
    )
    values (
      v_inv.restaurant_id, v_user, v_inv.role, v_inv.position,
      v_inv.hourly_rate_cents
    );
  end if;

  update restaurant_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.restaurant_id;
end;
$$;

revoke all on function accept_invitation from public;
grant execute on function accept_invitation to authenticated;

-- ---------------------------------------------------------------------------
-- Kuitin tarkistus
-- ---------------------------------------------------------------------------

/**
 * Päättää kuitin tarkistuksen.
 *
 * Korjatut arvot kirjoitetaan samalla kertaa: erillisenä muokkauksena ja
 * hyväksyntänä kuitti voisi jäädä tilaan jossa se on hyväksytty mutta
 * vanhoilla arvoilla.
 *
 * Kun kategoria muuttuu, korjaus kirjataan toimittajalle. Kun sama korjaus
 * toistuu, sitä ehdotetaan jatkossa.
 */
create or replace function review_receipt(
  p_receipt uuid,
  p_approve boolean,
  p_supplier_name text default null,
  p_date date default null,
  p_total_cents int default null,
  p_vat_cents int default null,
  p_category expense_category default null,
  p_payment payment_method default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt receipts;
  v_new_category expense_category;
begin
  select * into v_receipt from receipts where id = p_receipt;

  if v_receipt.id is null then
    raise exception 'Kuittia ei löytynyt';
  end if;

  if not is_manager(v_receipt.restaurant_id) then
    raise exception 'Vain esihenkilö voi tarkistaa kuitin';
  end if;

  v_new_category := coalesce(p_category, v_receipt.category);

  -- Kategoriakorjaus toimittajalle: sääntö korjaushistoriasta, ei
  -- mallin koulutusta, ja se on nähtävissä ja kumottavissa.
  if v_receipt.supplier_id is not null
     and v_new_category is distinct from v_receipt.category then
    insert into supplier_category_overrides (
      supplier_id, from_category, to_category, count
    )
    values (v_receipt.supplier_id, v_receipt.category, v_new_category, 1)
    on conflict (supplier_id, from_category, to_category)
      do update set count = supplier_category_overrides.count + 1,
                    updated_at = now();
  end if;

  update receipts
  set supplier_name = coalesce(nullif(trim(p_supplier_name), ''), supplier_name),
      receipt_date = coalesce(p_date, receipt_date),
      total_cents = coalesce(p_total_cents, total_cents),
      vat_cents = coalesce(p_vat_cents, vat_cents),
      category = v_new_category,
      payment_method = coalesce(p_payment, payment_method),
      note = coalesce(nullif(trim(p_note), ''), note),
      status = case when p_approve then 'confirmed'::receipt_status
                    else 'needs_review'::receipt_status end,
      review_reasons = case when p_approve then '{}'::text[] else review_reasons end
  where id = p_receipt;
end;
$$;

revoke all on function review_receipt from public;
grant execute on function review_receipt to authenticated;

-- ---------------------------------------------------------------------------
-- Budjetit
-- ---------------------------------------------------------------------------

/**
 * Asettaa toistuvan kuukausibudjetin kategorialle.
 *
 * Nolla poistaa budjetin: budjetoimaton kategoria näytetään eri tavalla
 * kuin kategoria jonka budjetti on nolla, ja jälkimmäinen olisi aina
 * ylitetty.
 */
create or replace function set_budget(
  p_restaurant uuid,
  p_category expense_category,
  p_amount_cents int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi asettaa budjetteja';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    delete from budgets
    where restaurant_id = p_restaurant and category = p_category and month is null;
    return;
  end if;

  -- Päivitä ensin, lisää vasta jos riviä ei ollut. ON CONFLICT joutuisi
  -- päättelemään osittaisindeksin (month is null), mikä on herkkä
  -- kirjoitusasulle; tämä tekee saman ilman päättelyä.
  update budgets
  set amount_cents = p_amount_cents, updated_at = now()
  where restaurant_id = p_restaurant and category = p_category and month is null;

  if not found then
    insert into budgets (restaurant_id, category, month, amount_cents)
    values (p_restaurant, p_category, null, p_amount_cents);
  end if;
end;
$$;

revoke all on function set_budget from public;
grant execute on function set_budget to authenticated;

-- ---------------------------------------------------------------------------
-- Jäsenyyden päivitys
-- ---------------------------------------------------------------------------

/**
 * Päivittää jäsenen roolin, tehtävän ja tuntipalkan.
 *
 * Omistaja ei voi poistaa omaa omistajuuttaan jos hän on ainoa omistaja —
 * muuten ravintola jäisi ilman ketään joka voi hallita sitä.
 */
create or replace function update_membership(
  p_restaurant uuid,
  p_user uuid,
  p_role app_role,
  p_position staff_position,
  p_hourly_rate_cents int,
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
      position = p_position,
      hourly_rate_cents = p_hourly_rate_cents,
      active = p_active
  where restaurant_id = p_restaurant and user_id = p_user;
end;
$$;

revoke all on function update_membership from public;
grant execute on function update_membership to authenticated;

-- ---------------------------------------------------------------------------
-- Työvuorot
-- ---------------------------------------------------------------------------

/**
 * Luo tai päivittää työvuoron.
 *
 * Kun aika muuttuu jo hyväksyttyyn vuoroon, tila palautuu odottamaan
 * vastausta ja vanhat ajat säilytetään. Työntekijä on hyväksynyt tietyn
 * ajan, ei mitä tahansa aikaa.
 */
create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case when p_user is null then 'draft' else 'pending' end
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        when v_old.user_id is distinct from p_user then 'pending'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

/** Poistaa vuoron. Menneitä vuoroja ei poisteta — ne ovat historiaa. */
create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;

-- ---------------------------------------------------------------------------
-- Kaksoiskappaleen poisto
-- ---------------------------------------------------------------------------

/** Poistaa kuitin. Rivit poistuvat kaskadina. */
create or replace function delete_receipt(p_receipt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from receipts where id = p_receipt;
  if v_restaurant is null then return; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi poistaa kuitteja';
  end if;

  delete from receipts where id = p_receipt;
end;
$$;

revoke all on function delete_receipt from public;
grant execute on function delete_receipt to authenticated;


-- ===========================================================================
-- 0005_auth_callback.sql
-- ===========================================================================

-- RestoFlow — kutsukoodin tarkistus ennen lunastusta.
--
-- Erillinen funktio, jotta käyttöliittymä voi kertoa mihin ravintolaan
-- koodi vie ennen kuin käyttäjä hyväksyy liittymisen. Ilman tätä
-- lunastus olisi sokea klikkaus.

-- Sarakkeiden nimissä ei käytetä sanoja "position" eikä "role":
-- position on Postgresin varattu funktio, ja role on varattu avainsana.
-- Kumpikaan ei kelpaa returns table -lauseessa ilman lainausmerkkejä.
create or replace function preview_invitation(p_code text)
returns table (
  restaurant_name text,
  invited_role app_role,
  invited_position staff_position
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv restaurant_invitations;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex');

  -- Sama viesti kaikissa epäonnistumisissa: eri viestit kertoisivat
  -- arvailijalle onko koodi olemassa mutta käytetty.
  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.expires_at < now() then
    raise exception 'Koodi ei kelpaa';
  end if;

  return query
  select r.name, v_inv.role, v_inv.position
  from restaurants r
  where r.id = v_inv.restaurant_id;
end;
$$;

revoke all on function preview_invitation from public;
grant execute on function preview_invitation to authenticated;


-- ===========================================================================
-- 0006_receipts_manager_only.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0006 — Kuitin lisääminen vain ravintolan esihenkilölle
-- ---------------------------------------------------------------------------
--
-- Kuitti on ravintolan kirjanpitoaineistoa, ei työntekijän ilmoitus. Kuka
-- tahansa vuorossa oleva ei saa synnyttää kulukirjausta jota kukaan ei ole
-- hyväksynyt, eikä ladata kuvaa ravintolan tallennustilaan.
--
-- Sama rajaus kolmella kerroksella, koska yksikään ei yksin riitä:
--   1. create_receipt on security definer ja ohittaa RLS:n → tarkistus
--      funktion sisään
--   2. suora taulukirjoitus PostgREST:n läpi ohittaa funktion → tarkistus
--      insert-politiikkaan
--   3. kuva ladataan selaimesta suoraan storageen → tarkistus storage-
--      politiikkaan
--
-- Käyttöliittymän piilotettu painike ei ole tässä listassa, koska se ei ole
-- pääsynhallintaa.
--
-- Funktion runko on 0003:sta sellaisenaan; vain oikeustarkistus on
-- vaihdettu.

-- ---------------------------------------------------------------------------
-- 1. Funktio
-- ---------------------------------------------------------------------------

create or replace function create_receipt(
  p_restaurant uuid,
  p_supplier_name text,
  p_date date,
  p_total_cents int,
  p_vat_cents int,
  p_category expense_category,
  p_payment payment_method,
  p_receipt_number text,
  p_note text,
  p_status receipt_status,
  p_review_reasons text[],
  p_image_path text,
  p_image_quality text,
  p_file_hash text,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_receipt uuid;
  v_supplier uuid;
  v_item jsonb;
  v_line int := 0;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  -- Jäsenyys ei enää riitä: rooli ratkaisee. Kuitti on ravintolan
  -- kirjanpitoaineistoa, ei työntekijän ilmoitus.
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kuitteja';
  end if;

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'Loppusumma puuttuu';
  end if;

  -- Toimittaja luodaan tarvittaessa. Nimi on ravintolan sisällä uniikki,
  -- joten kilpaileva lisäys ei tuota kaksoiskappaletta.
  if coalesce(trim(p_supplier_name), '') <> '' then
    insert into suppliers (restaurant_id, name, default_category)
    values (p_restaurant, trim(p_supplier_name), p_category)
    on conflict (restaurant_id, name) do update set name = excluded.name
    returning id into v_supplier;
  end if;

  insert into receipts (
    restaurant_id, supplier_id, supplier_name, receipt_date, total_cents,
    vat_cents, category, payment_method, receipt_number, note, status,
    review_reasons, image_path, image_quality, file_hash, added_by
  )
  values (
    p_restaurant, v_supplier, coalesce(nullif(trim(p_supplier_name), ''), 'Tuntematon'),
    p_date, p_total_cents, p_vat_cents, p_category, p_payment,
    nullif(trim(p_receipt_number), ''), nullif(trim(p_note), ''), p_status,
    coalesce(p_review_reasons, '{}'), p_image_path, p_image_quality,
    nullif(trim(p_file_hash), ''), v_user
  )
  returning id into v_receipt;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_line := v_line + 1;
    insert into receipt_items (
      receipt_id, line_number, description, quantity, unit, total_cents,
      category, vat_rate, vat_cents, product_group
    )
    values (
      v_receipt,
      v_line,
      coalesce(v_item ->> 'description', ''),
      (v_item ->> 'quantity')::numeric,
      v_item ->> 'unit',
      coalesce((v_item ->> 'totalCents')::int, 0),
      coalesce((v_item ->> 'category')::expense_category, p_category),
      (v_item ->> 'vatRate')::numeric,
      (v_item ->> 'vatCents')::int,
      v_item ->> 'productGroup'
    );
  end loop;

  return v_receipt;
end;
$$;

revoke all on function create_receipt from public;
grant execute on function create_receipt to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Taulupolitiikka
-- ---------------------------------------------------------------------------

drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts
  for insert to authenticated
  with check (
    is_manager(restaurant_id)
    and added_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Tallennuspolitiikka
-- ---------------------------------------------------------------------------

drop policy if exists receipts_storage_write on storage.objects;
create policy receipts_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

-- upsert: true päivittää olemassa olevan objektin, ja ilman update-
-- politiikkaa saman tiedoston lataus uudelleen kaatuu oikeusvirheeseen.
drop policy if exists receipts_storage_update on storage.objects;
create policy receipts_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );


-- ===========================================================================
-- 0007_settings_closing_absences.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0007 — Asetukset, kuukauden sulkeminen ja poissaolojen poisto
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Ravintolan asetukset
-- ---------------------------------------------------------------------------
--
-- Aikavyöhyke tarkistetaan pg_timezone_names-listaa vasten. Kelvoton
-- vyöhyke ei kaataisi mitään heti, mutta laskisi työajat väärin
-- huomaamatta — ja virhe löytyisi vasta palkanmaksusta.

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text,
  p_timezone text
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

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  update restaurants
  set name = trim(p_name),
      timezone = p_timezone,
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kuukauden sulkeminen
-- ---------------------------------------------------------------------------
--
-- Suljettu kuukausi on kirjanpitoon lähtenyt kuukausi. Sen jälkeen tehty
-- muutos ei enää täsmää siihen mitä kirjanpitäjälle on annettu, joten
-- kuittien lisäys, muokkaus ja poisto estetään liipaisimella — ei
-- sovelluskoodissa, koska sen ohi pääsee.

create table if not exists closed_months (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  -- Kuukauden ensimmäinen päivä. Date eikä text, jotta vertailu on
  -- indeksoitavissa eikä nojaa merkkijonon muotoon.
  month date not null,
  closed_by uuid not null references profiles (id),
  closed_at timestamptz not null default now(),
  note text,
  unique (restaurant_id, month)
);

create index if not exists closed_months_restaurant_idx
  on closed_months (restaurant_id, month);

alter table closed_months enable row level security;

drop policy if exists closed_months_read on closed_months;
create policy closed_months_read on closed_months
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists closed_months_write on closed_months;
create policy closed_months_write on closed_months
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

create or replace function is_month_closed(p_restaurant uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from closed_months
    where restaurant_id = p_restaurant
      and month = date_trunc('month', p_date)::date
  );
$$;

grant execute on function is_month_closed to authenticated;

/**
 * Estää muutokset suljettuun kuukauteen.
 *
 * Sekä vanha että uusi päivä tarkistetaan: muuten kuitin voisi siirtää
 * suljettuun kuukauteen tai pois siitä.
 */
create or replace function guard_closed_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if is_month_closed(old.restaurant_id, old.receipt_date) then
      raise exception 'Kuukausi on suljettu';
    end if;
    return old;
  end if;

  if is_month_closed(new.restaurant_id, new.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  if tg_op = 'UPDATE' and is_month_closed(old.restaurant_id, old.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  return new;
end;
$$;

drop trigger if exists receipts_closed_month on receipts;
create trigger receipts_closed_month
  before insert or update or delete on receipts
  for each row execute function guard_closed_month();

create or replace function close_month(
  p_restaurant uuid,
  p_month text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi sulkea kuukauden';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Kuukauden muoto on VVVV-KK';
  end if;

  v_month := (p_month || '-01')::date;

  -- Kuluvaa kuukautta ei suljeta: siihen tulee vielä kuitteja, ja
  -- sulkeminen estäisi ne kaikki.
  if v_month >= date_trunc('month', (now() at time zone (
    select timezone from restaurants where id = p_restaurant
  ))::date) then
    raise exception 'Kuluvaa tai tulevaa kuukautta ei voi sulkea';
  end if;

  insert into closed_months (restaurant_id, month, closed_by, note)
  values (p_restaurant, v_month, auth.uid(), nullif(trim(p_note), ''))
  on conflict (restaurant_id, month) do nothing;
end;
$$;

revoke all on function close_month from public;
grant execute on function close_month to authenticated;

create or replace function reopen_month(p_restaurant uuid, p_month text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi avata kuukauden';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Kuukauden muoto on VVVV-KK';
  end if;

  delete from closed_months
  where restaurant_id = p_restaurant
    and month = (p_month || '-01')::date;
end;
$$;

revoke all on function reopen_month from public;
grant execute on function reopen_month to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Poissaolon peruminen
-- ---------------------------------------------------------------------------
--
-- Ilmoituksen voi perua itse, esihenkilö kenen tahansa. Väärästä päivästä
-- tehty ilmoitus jäisi muuten pysyvästi vuorolistalle.

drop policy if exists absences_delete on absences;
create policy absences_delete on absences
  for delete to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));


-- ===========================================================================
-- 0008_custom_categories.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0008 — Ravintolan omat kulukategoriat
-- ---------------------------------------------------------------------------
--
-- SUUNNITTELUPÄÄTÖS: yhdeksän kiinteää kategoriaa säilyy kirjanpidon
-- runkona, ja omat kategoriat kartoitetaan niihin.
--
-- Miksi ei vapaita kategorioita: kiinteä joukko ratkaisee ALV-odotuksen
-- ("ruoan 14 %"), budjettivertailun ja poikkeamien tunnistuksen. Jos
-- käyttäjä voisi keksiä kategorian ilman kytköstä, järjestelmä ei enää
-- tietäisi mitä ALV-kannan pitäisi olla eikä voisi verrata kuukausia
-- toisiinsa. Kirjanpitoaineistossa se on virhe, ei vapautta.
--
-- Näin ravintola saa "Kalatoimitukset" ja "Viinit" omiksi riveikseen,
-- mutta ne kuuluvat yhä ruokaan ja alkoholiin. Budjetit ja ALV-tarkistus
-- toimivat perusluokalla — se sanotaan käyttöliittymässä ääneen.

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Kirjanpidon perusluokka. Tämä ohjaa ALV:tä, budjetteja ja analyysiä.
  base_category expense_category not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nimi on ravintolan sisällä uniikki riippumatta kirjainkoosta:
-- "Viinit" ja "viinit" kahtena rivinä olisi vain sekaannus.
create unique index if not exists expense_categories_name_unique
  on expense_categories (restaurant_id, lower(name));

create index if not exists expense_categories_restaurant_idx
  on expense_categories (restaurant_id) where active;

alter table expense_categories enable row level security;

drop policy if exists expense_categories_read on expense_categories;
create policy expense_categories_read on expense_categories
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists expense_categories_write on expense_categories;
create policy expense_categories_write on expense_categories
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- Kuitille valinnainen viittaus. Null tarkoittaa että kuitti käyttää
-- pelkkää perusluokkaa, kuten kaikki tähän asti kirjatut.
alter table receipts
  add column if not exists category_id uuid references expense_categories (id) on delete set null;

create index if not exists receipts_category_id_idx
  on receipts (category_id) where category_id is not null;

drop trigger if exists expense_categories_touch on expense_categories;
create trigger expense_categories_touch
  before update on expense_categories
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hallinta
-- ---------------------------------------------------------------------------

create or replace function upsert_expense_category(
  p_restaurant uuid,
  p_id uuid,
  p_name text,
  p_base expense_category,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi hallita kategorioita';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if p_id is null then
    insert into expense_categories (restaurant_id, name, base_category, active)
    values (p_restaurant, trim(p_name), p_base, p_active)
    returning id into v_id;
  else
    update expense_categories
    set name = trim(p_name),
        base_category = p_base,
        active = p_active
    where id = p_id and restaurant_id = p_restaurant
    returning id into v_id;

    if v_id is null then
      raise exception 'Kategoriaa ei löytynyt';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function upsert_expense_category from public;
grant execute on function upsert_expense_category to authenticated;

/**
 * Poistaa kategorian.
 *
 * Kuitit eivät katoa: viittaus nollautuu ja kuitti palaa perusluokkaan.
 * Kulukirjauksen poistaminen kategorian mukana olisi tietojen häviämistä
 * eikä sitä mitä käyttäjä pyysi.
 */
create or replace function delete_expense_category(p_category uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant
  from expense_categories where id = p_category;

  if v_restaurant is null then
    raise exception 'Kategoriaa ei löytynyt';
  end if;

  if not is_owner(v_restaurant) then
    raise exception 'Vain omistaja voi hallita kategorioita';
  end if;

  delete from expense_categories where id = p_category;
end;
$$;

revoke all on function delete_expense_category from public;
grant execute on function delete_expense_category to authenticated;

-- ---------------------------------------------------------------------------
-- create_receipt: valinnainen oma kategoria
-- ---------------------------------------------------------------------------
--
-- Uusi parametri viimeisenä ja oletusarvolla, jotta vanhat kutsut
-- toimivat muuttumatta. Kategoria tarkistetaan samaan ravintolaan
-- kuuluvaksi — toisen ravintolan tunnisteella ei saa merkitä omaa kuittia.

-- Vanha 15-parametrinen versio on pudotettava ensin: uusi parametrilista
-- tekee "create or replace"-lauseesta uuden funktion vanhan rinnalle, ei
-- korvaajaa. Kaksi samannimistä funktiota johtaisi virheeseen
-- "function is not unique" heti ensimmäisellä kutsulla.
drop function if exists create_receipt(
  uuid, text, date, int, int, expense_category, payment_method,
  text, text, receipt_status, text[], text, text, text, jsonb
);

create or replace function create_receipt(
  p_restaurant uuid,
  p_supplier_name text,
  p_date date,
  p_total_cents int,
  p_vat_cents int,
  p_category expense_category,
  p_payment payment_method,
  p_receipt_number text,
  p_note text,
  p_status receipt_status,
  p_review_reasons text[],
  p_image_path text,
  p_image_quality text,
  p_file_hash text,
  p_items jsonb default '[]'::jsonb,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_receipt uuid;
  v_supplier uuid;
  v_item jsonb;
  v_line int := 0;
  v_category_id uuid := null;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kuitteja';
  end if;

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'Loppusumma puuttuu';
  end if;

  if p_category_id is not null then
    select id into v_category_id
    from expense_categories
    where id = p_category_id and restaurant_id = p_restaurant;

    if v_category_id is null then
      raise exception 'Tuntematon kategoria';
    end if;
  end if;

  if coalesce(trim(p_supplier_name), '') <> '' then
    insert into suppliers (restaurant_id, name, default_category)
    values (p_restaurant, trim(p_supplier_name), p_category)
    on conflict (restaurant_id, name) do update set name = excluded.name
    returning id into v_supplier;
  end if;

  insert into receipts (
    restaurant_id, supplier_id, supplier_name, receipt_date, total_cents,
    vat_cents, category, payment_method, receipt_number, note, status,
    review_reasons, image_path, image_quality, file_hash, added_by, category_id
  )
  values (
    p_restaurant, v_supplier, coalesce(nullif(trim(p_supplier_name), ''), 'Tuntematon'),
    p_date, p_total_cents, p_vat_cents, p_category, p_payment,
    nullif(trim(p_receipt_number), ''), nullif(trim(p_note), ''), p_status,
    coalesce(p_review_reasons, '{}'), p_image_path, p_image_quality,
    nullif(trim(p_file_hash), ''), v_user, v_category_id
  )
  returning id into v_receipt;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_line := v_line + 1;
    insert into receipt_items (
      receipt_id, line_number, description, quantity, unit, total_cents,
      category, vat_rate, vat_cents, product_group
    )
    values (
      v_receipt,
      v_line,
      coalesce(v_item ->> 'description', ''),
      (v_item ->> 'quantity')::numeric,
      v_item ->> 'unit',
      coalesce((v_item ->> 'totalCents')::int, 0),
      coalesce((v_item ->> 'category')::expense_category, p_category),
      (v_item ->> 'vatRate')::numeric,
      (v_item ->> 'vatCents')::int,
      v_item ->> 'productGroup'
    );
  end loop;

  return v_receipt;
end;
$$;

revoke all on function create_receipt from public;
grant execute on function create_receipt to authenticated;


-- ===========================================================================
-- 0009_invitation_hash_fix.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0009 — Kutsukoodien tiiviste ilman pgcryptoa
-- ---------------------------------------------------------------------------
--
-- VIKA: kutsun luonti kaatui virheeseen
--   "function digest(text, unknown) does not exist"
--
-- Syy: Supabase asentaa pgcrypton skeemaan `extensions`, ei `public`:iin.
-- Nämä funktiot ovat `security definer` ja `set search_path = public`,
-- joten `digest` ei näkynyt niille lainkaan. Migraation
-- `create extension if not exists pgcrypto` oli tyhjä käsky: laajennus
-- oli jo asennettuna, vain eri skeemaan.
--
-- KORJAUS: pgcryptoa ei tarvita. `sha256(bytea)` on ollut Postgresin
-- sisäänrakennettu funktio versiosta 11 ja löytyy pg_catalogista, joka
-- on aina hakupolussa.
--
-- Vaihtoehto olisi ollut lisätä `extensions` hakupolkuun, mutta
-- `set search_path = public` on nimenomaan se suojaus joka estää
-- security definer -funktiota poimimasta funktioita väärästä paikasta.
-- Sen löysentäminen kiertäisi suojauksen; sisäänrakennettu funktio
-- poistaa koko ongelman.
--
-- Tiivistemuoto muuttuu, joten vanhat koodit eivät enää täsmäisi.
-- Tarkistettu ennen ajoa: lunastamattomia kutsuja on nolla.

-- ---------------------------------------------------------------------------
-- Kutsun luonti
-- ---------------------------------------------------------------------------

create or replace function create_invitation(
  p_restaurant uuid,
  p_role app_role default 'employee',
  p_position staff_position default null,
  p_hourly_rate_cents int default null,
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

  -- Satunnaisuus gen_random_uuid():sta eikä random():sta.
  --
  -- random() on siemennetty pseudosatunnaisgeneraattori, jonka tilan voi
  -- periaatteessa päätellä aiemmista arvoista. Kutsukoodi antaa pääsyn
  -- ravintolan tietoihin, joten arvattavuus on turvakysymys.
  -- gen_random_uuid() käyttää vahvaa satunnaislähdettä ja on
  -- pg_catalogissa, joten se ei vaadi laajennusta.
  v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');

  -- Aakkostosta on jätetty pois I, O, 0 ja 1: ne sekoittuvat puhelimessa
  -- luettuna ja koodi kirjoitetaan käsin. 32 merkkiä jakaa 256 tasan,
  -- joten jakojäännös ei vinouta jakaumaa.
  for i in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(v_bytes, i - 1) % length(v_alphabet)),
      1
    );
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, position,
    hourly_rate_cents, label, created_by
  )
  values (
    p_restaurant,
    encode(sha256(v_code::bytea), 'hex'),
    right(v_code, 4),
    p_role,
    p_position,
    p_hourly_rate_cents,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  return v_code;
end;
$$;

revoke all on function create_invitation from public;
grant execute on function create_invitation to authenticated;

-- ---------------------------------------------------------------------------
-- Kutsun lunastus ja esikatselu
-- ---------------------------------------------------------------------------
--
-- Rungot ovat 0004:sta ja 0005:sta sellaisenaan; vain tiiviste on
-- vaihdettu. Erityisesti preview_invitationin yhtenäinen virheilmoitus
-- säilyy — eri viestit kertoisivat arvailijalle onko koodi olemassa
-- mutta jo käytetty.

create or replace function accept_invitation(p_code text)
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

  -- Sama kaava kuin budjeteissa: päivitä, lisää jos ei ollut. Jäsenyys voi
  -- olla olemassa passivoituna, jolloin kutsu herättää sen uudelleen.
  update memberships
  set active = true,
      role = v_inv.role,
      position = v_inv.position,
      hourly_rate_cents = coalesce(v_inv.hourly_rate_cents, hourly_rate_cents)
  where restaurant_id = v_inv.restaurant_id and user_id = v_user;

  if not found then
    insert into memberships (
      restaurant_id, user_id, role, position, hourly_rate_cents
    )
    values (
      v_inv.restaurant_id, v_user, v_inv.role, v_inv.position,
      v_inv.hourly_rate_cents
    );
  end if;

  update restaurant_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.restaurant_id;
end;
$$;

revoke all on function accept_invitation from public;
grant execute on function accept_invitation to authenticated;

create or replace function preview_invitation(p_code text)
returns table (
  restaurant_name text,
  invited_role app_role,
  invited_position staff_position
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv restaurant_invitations;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex');

  -- Sama viesti kaikissa epäonnistumisissa: eri viestit kertoisivat
  -- arvailijalle onko koodi olemassa mutta käytetty.
  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.expires_at < now() then
    raise exception 'Koodi ei kelpaa';
  end if;

  return query
  select r.name, v_inv.role, v_inv.position
  from restaurants r
  where r.id = v_inv.restaurant_id;
end;
$$;

revoke all on function preview_invitation from public;
grant execute on function preview_invitation to authenticated;


-- ===========================================================================
-- 0010_shift_status_cast.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0010 — Uuden vuoron tila oikeaan tyyppiin
-- ---------------------------------------------------------------------------
--
-- Uuden työvuoron luonti kaatui virheeseen:
--
--   column "status" is of type shift_status but expression is of type text
--
-- Syy on insert-haaran case-lauseessa:
--
--   case when p_user is null then 'draft' else 'pending' end
--
-- Postgres ei tiedä lainausmerkeissä olevien literaalien tyyppiä. Yksin
-- insertin arvolistassa se päättelisi tyypin sarakkeesta, mutta case
-- ratkaisee haarojensa yhteisen tyypin ennen sitä — ja kahdesta
-- tuntemattomasta literaalista tulee text. Enum-sarakkeeseen ei voi
-- sijoittaa tekstiä ilman muunnosta.
--
-- Saman funktion update-haara toimi, koska siinä muunnos oli kirjoitettu
-- näkyviin. Siksi vuoron muokkaaminen onnistui ja vain luonti kaatui.
--
-- Alla oleva runko on haettu tuotannosta pg_get_functiondef-kutsulla ja
-- siihen on lisätty ainoastaan ::shift_status insert-haaraan. Mikään muu
-- ei muutu.

create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case
        when p_user is null then 'draft'::shift_status
        else 'pending'::shift_status
      end
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        when v_old.user_id is distinct from p_user then 'pending'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;


-- ===========================================================================
-- 0011_shifts_no_approval.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0011 — Esihenkilön tekemä vuoro on heti voimassa
-- ---------------------------------------------------------------------------
--
-- Vuoro syntyi tilaan pending ja jäi odottamaan työntekijän kuittausta.
-- Ravintolassa työvuoro ei ole ehdotus: kun omistaja tai vuoropäällikkö
-- merkitsee vuoron, se on vuoro. Kuittausvaihe tuotti vain tilan jossa
-- kukaan ei tiennyt onko lista voimassa.
--
-- Uusi ja uudelleen jaettu vuoro on siis suoraan accepted. Kaksi asiaa
-- säilyy tarkoituksella:
--
--   draft   — vuoro jolle ei ole vielä tekijää. Se ei ole kenenkään
--             vuoro, joten sitä ei voi merkitä voimassa olevaksi.
--
--   changed — jo voimassa olevan vuoron aika muuttui. Tämä ei ole
--             hyväksyntää vaan huomautus: työntekijä on saattanut
--             suunnitella päivänsä vanhan ajan mukaan, ja muutoksen on
--             erotuttava.
--
-- Työntekijä ilmoittaa esteestä poissaoloilmoituksella, joka on erillinen
-- toiminto ja näkyy esihenkilölle sekä vuorolistassa että huomioissa.
-- Vuoro pysyy hänellä kunnes esihenkilö tekee sille jotain.

create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case
        when p_user is null then 'draft'::shift_status
        else 'accepted'::shift_status
      end
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        -- Vuoro siirtyi toiselle: uudelle tekijälle se on heti voimassa
        -- eikä edellisen kieltäytyminen jää roikkumaan mukana.
        when v_old.user_id is distinct from p_user then 'accepted'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

-- Vanhat kuittausta odottavat vuorot ovat nyt voimassa. Ilman tätä ne
-- jäisivät ikuisesti tilaan jota mikään ei enää tuota, ja työntekijälle
-- näkyisi "odottaa vastausta" ilman mitään mihin vastata.
update shifts set status = 'accepted' where status = 'pending';

-- Työntekijä ei enää vastaa vuoroon, joten hän ei myöskään saa muuttaa
-- sen tilaa. Ilman tätä oikeus jäisi voimaan vaikka käyttöliittymästä
-- ei enää olisi tapaa käyttää sitä — ja rajapinta on auki silti.
--
-- guard_shift_response_trigger jätetään paikalleen. Se ei tee mitään
-- niin kauan kuin päivitysoikeutta ei ole, mutta jos oikeus joskus
-- palautetaan, se estää aikojen muuttamisen ilman että kukaan muistaa
-- lisätä suojan uudelleen.
drop policy if exists shifts_respond on shifts;


-- ===========================================================================
-- 0012_absence_period_certificate.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0012 — Poissaolon jakso ja todistusmerkintä
-- ---------------------------------------------------------------------------
--
-- Kaksi puutetta samassa taulussa.
--
-- 1. Poissaolossa oli vain yksi päivä. Sairauslomatodistus kattaa
--    jakson — esimerkiksi 26.8.–29.8. — eikä sitä voinut ilmaista.
--    Neljä erillistä ilmoitusta samasta sairaudesta on väärä kuva
--    tapahtuneesta ja neljä riviä esihenkilön listalla.
--
-- 2. Ei mitään tapaa kertoa onko todistus toimitettu.
--
-- Todistuksesta tallennetaan vain merkintä, ei kuvaa. Lääkärintodistus
-- on terveystieto, ja siinä lukee usein diagnoosi. Työnantajalle kuuluu
-- tieto poissaolosta ja sen kestosta, ei siitä mikä ihmisellä on.
-- Budet tallentaa siis sen mitä palkanmaksuun tarvitaan — kuka, milloin,
-- mille ajalle, onko todistus nähty — eikä muuta.

-- ---------------------------------------------------------------------------
-- 1. Jakso
-- ---------------------------------------------------------------------------
--
-- Nykyiset rivit ovat yhden päivän mittaisia, joten loppupäivä on sama
-- kuin alkupäivä. Täytetään ensin ja vasta sitten pakotetaan not null:
-- toisin päin olemassa oleva aineisto estäisi migraation.

alter table absences add column if not exists end_date date;

update absences set end_date = absence_date where end_date is null;

alter table absences alter column end_date set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'absences_period_valid'
  ) then
    alter table absences
      add constraint absences_period_valid check (end_date >= absence_date);
  end if;
end;
$$;

-- Haut kysyvät "ketkä ovat poissa tästä päivästä eteenpäin", ja se
-- osuu nyt loppupäivään: eilen alkanut sairausloma on yhä voimassa.
create index if not exists absences_restaurant_end_idx
  on absences (restaurant_id, end_date);

-- ---------------------------------------------------------------------------
-- 2. Todistusmerkintä
-- ---------------------------------------------------------------------------

alter table absences add column if not exists certificate_seen_at timestamptz;
alter table absences add column if not exists certificate_seen_by uuid
  references profiles (id) on delete set null;

/**
 * Merkitsee todistuksen nähdyksi tai poistaa merkinnän.
 *
 * Oma funktio eikä päivitysoikeutta tauluun. Esihenkilö saa kuitata
 * todistuksen, mutta hän ei saa muuttaa työntekijän omaa ilmoitusta —
 * ei päivämääriä eikä lisätietoa. Update-käytäntö sallisi molemmat,
 * koska with check näkee vain uuden rivin eikä voi verrata vanhaan.
 *
 * Kuka merkitsi ja milloin jää talteen. Ilman sitä merkintä on väite
 * jonka takana ei ole ketään.
 */
create or replace function mark_absence_certificate(
  p_absence uuid,
  p_seen boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_absence absences;
begin
  select * into v_absence from absences where id = p_absence;
  if v_absence.id is null then
    raise exception 'Ilmoitusta ei löytynyt';
  end if;

  if not is_manager(v_absence.restaurant_id) then
    raise exception 'Vain esihenkilö voi kuitata todistuksen';
  end if;

  update absences
  set certificate_seen_at = case when p_seen then now() else null end,
      certificate_seen_by = case when p_seen then auth.uid() else null end
  where id = p_absence;
end;
$$;

revoke all on function mark_absence_certificate from public;
grant execute on function mark_absence_certificate to authenticated;


-- ===========================================================================
-- 0013_merchants.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0013 — Kauppatunnistus (merchants)
-- ---------------------------------------------------------------------------
--
-- Kuitilla luki tähän asti vain se nimi jonka poiminta luki paperista:
-- "S-Market Kajaani", "Gigantti Oy", "K-MARKET MALMI". Ne ovat eri
-- merkkijonoja mutta osa kolmea tunnettua ketjua, eikä listasta voinut
-- silmäillä missä on käyty.
--
-- Kolme tasoa, ei kahta:
--
--   merchants   Brändi. Yhteinen kaikille ravintoloille, ei kenenkään
--               omistama. K-Market on K-Market riippumatta siitä kuka
--               siellä käy.
--
--   suppliers   Yksittäinen toimipiste ravintolan kirjanpidossa.
--               "K-Market Malmi" on ravintolan oma rivi, ja se osoittaa
--               brändiin. Tämä taulu on jo olemassa; siihen lisätään
--               vain linkki.
--
--   receipts    Osoittaa toimipisteeseen kuten ennenkin. Kuitti ei tiedä
--               brändistä mitään, eikä sen tarvitse.
--
-- Näin brändi → ketju → toimipiste on olemassa heti, mutta
-- käyttöliittymässä näkyy vain se mikä on tarpeen.

-- ---------------------------------------------------------------------------
-- 1. Kategoriat omana tauluna
-- ---------------------------------------------------------------------------
--
-- Ei enumia. Uuden toimialan lisääminen olisi silloin skeemamuutos, ja
-- koko tämän järjestelmän tarkoitus on että yrityksiä ja toimialoja voi
-- lisätä koskematta koodiin.

create table if not exists merchant_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  sort_order int not null default 100
);

insert into merchant_categories (id, label, sort_order) values
  ('grocery',     'Ruokakauppa',   10),
  ('restaurant',  'Ravintola',     20),
  ('alcohol',     'Alkoholi',      30),
  ('electronics', 'Elektroniikka', 40),
  ('hardware',    'Rautakauppa',   50),
  ('automotive',  'Autoilu',       60),
  ('retail',      'Vähittäiskauppa', 70),
  ('pharmacy',    'Apteekki',      80),
  ('transport',   'Liikenne',      90),
  ('services',    'Palvelut',     100)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Brändit
-- ---------------------------------------------------------------------------
--
-- Tunnus on luettava merkkijono eikä uuid: 'k-market' kertoo lokitiedosta
-- ja virheilmoituksesta heti mistä on kyse, ja siemenaineiston voi ajaa
-- uudelleen ilman että tunnukset vaihtuvat.
--
-- brand_color ja brand_background ovat tunnisteita, eivät teemoja.
-- Käyttöliittymä käyttää niitä pienenä korostuksena — logon taustana ja
-- kirjaimen värinä — eikä koskaan koko kortin värinä.

create table if not exists merchants (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (length(trim(name)) > 0),

  /** Virallinen nimi kaupparekisterissä, jos eri kuin brändinimi. */
  legal_name text,

  /** Y-tunnus muodossa 1234567-8. Vahvin tunniste kun se on tiedossa. */
  business_id text check (business_id is null or business_id ~ '^\d{7}-\d$'),

  category text not null references merchant_categories (id),
  subcategory text,

  /** Brändin tunnusväri. Käytetään pienenä korostuksena. */
  brand_color text not null default '#6b7280'
    check (brand_color ~ '^#[0-9a-fA-F]{6}$'),

  /** Erittäin vaalea tausta logolle. */
  brand_background text not null default '#f3f4f6'
    check (brand_background ~ '^#[0-9a-fA-F]{6}$'),

  /** Logon osoite jos sellainen on. Ilman sitä näytetään alkukirjain. */
  logo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchants_category_idx on merchants (category);
create unique index if not exists merchants_business_id_idx
  on merchants (business_id) where business_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Kirjoitusasut
-- ---------------------------------------------------------------------------
--
-- Sama kauppa kirjoitetaan kuiteissa monella tavalla. Aliakset ovat
-- normalisoituja: pieniä kirjaimia, ilman välimerkkejä ja yhtiömuotoja.
-- Normalisointi tehdään sovelluksessa, koska sama funktio tarvitaan
-- myös tunnistushetkellä eikä sitä saa olla kahta versiota.

create table if not exists merchant_aliases (
  merchant_id text not null references merchants (id) on delete cascade,

  /** Normalisoitu kirjoitusasu. Ei sisällä välilyöntejä eikä välimerkkejä. */
  alias text not null check (alias = lower(alias) and length(alias) >= 2),

  primary key (alias)
);

create index if not exists merchant_aliases_merchant_idx
  on merchant_aliases (merchant_id);

-- ---------------------------------------------------------------------------
-- 4. Toimipiste osoittaa brändiin
-- ---------------------------------------------------------------------------

alter table suppliers add column if not exists merchant_id text
  references merchants (id) on delete set null;

-- Millä varmuudella tunnistus tehtiin. Käyttäjän itse korjaama on 1.
alter table suppliers add column if not exists merchant_confidence numeric(3, 2)
  check (merchant_confidence is null
         or (merchant_confidence >= 0 and merchant_confidence <= 1));

-- Erottaa käyttäjän vahvistaman tunnistuksen koneen tekemästä. Konetta
-- ei päästetä muuttamaan sitä minkä ihminen on vahvistanut.
alter table suppliers add column if not exists merchant_confirmed boolean
  not null default false;

create index if not exists suppliers_merchant_idx on suppliers (merchant_id);

-- ---------------------------------------------------------------------------
-- 5. Pääsy
-- ---------------------------------------------------------------------------
--
-- Brändiluettelo on yhteinen ja julkinen kirjautuneille: siinä ei ole
-- kenenkään liiketietoja, ainoastaan se että K-Market on ruokakauppa.
-- Kirjoitusoikeutta ei anneta kenellekään — luettelo ylläpidetään
-- migraatioilla, jottei yksi käyttäjä voi muuttaa sitä mitä muut näkevät.

alter table merchants enable row level security;
alter table merchant_aliases enable row level security;
alter table merchant_categories enable row level security;

drop policy if exists merchants_read on merchants;
create policy merchants_read on merchants
  for select to authenticated using (true);

drop policy if exists merchant_aliases_read on merchant_aliases;
create policy merchant_aliases_read on merchant_aliases
  for select to authenticated using (true);

drop policy if exists merchant_categories_read on merchant_categories;
create policy merchant_categories_read on merchant_categories
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. Toimipisteen liittäminen brändiin
-- ---------------------------------------------------------------------------

/**
 * Liittää toimipisteen brändiin.
 *
 * Erillinen funktio eikä osa create_receiptiä: kuitin tallennus on jo
 * toimiva kokonaisuus, eikä tunnistus saa kaataa sitä. Jos brändi jää
 * tunnistamatta, kuitti tallentuu silti.
 *
 * Kone ei ylikirjoita ihmistä. Kun merchant_confirmed on tosi, käyttäjä
 * on itse valinnut brändin eikä automaattinen tunnistus koske siihen —
 * muuten seuraava kuitti samasta kaupasta kumoaisi korjauksen.
 */
create or replace function set_supplier_merchant(
  p_supplier uuid,
  p_merchant text,
  p_confidence numeric,
  p_confirmed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_confirmed boolean;
begin
  select restaurant_id, merchant_confirmed
    into v_restaurant, v_confirmed
    from suppliers where id = p_supplier;

  if v_restaurant is null then
    raise exception 'Toimittajaa ei löytynyt';
  end if;

  if v_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  -- Vahvistettua ei muuteta koneellisesti.
  if v_confirmed and not p_confirmed then
    return;
  end if;

  -- Vain esihenkilö saa vahvistaa. Tunnistus on kirjanpidon tietoa.
  if p_confirmed and not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi vahvistaa kaupan';
  end if;

  update suppliers
  set merchant_id = p_merchant,
      merchant_confidence = p_confidence,
      merchant_confirmed = p_confirmed,
      updated_at = now()
  where id = p_supplier;
end;
$$;

revoke all on function set_supplier_merchant from public;
grant execute on function set_supplier_merchant to authenticated;


-- ===========================================================================
-- 0014_merchant_seed.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0014 — Brändiluettelon siemenaineisto
-- ---------------------------------------------------------------------------
--
-- GENEROITU TIEDOSTO. Älä muokkaa käsin.
--   node scripts/merchant-seed.mjs > supabase/migrations/0014_merchant_seed.sql
--
-- Aliakset on normalisoitu samalla säännöllä jota tunnistus käyttää.
-- Käsin kirjoitettuina ne ajautuisivat erilleen, ja kauppa jäisi
-- tunnistamatta ilman että kukaan huomaisi miksi.
--
-- Uusi yritys lisätään skriptiin ja migraatio ajetaan uudelleen.
-- Käyttöliittymään ei kosketa.

insert into merchants (id, name, category, brand_color, brand_background) values
  ('k-market', 'K-Market', 'grocery', '#F28C28', '#FFF7ED'),
  ('k-supermarket', 'K-Supermarket', 'grocery', '#E85D04', '#FFF7ED'),
  ('k-citymarket', 'K-Citymarket', 'grocery', '#D64500', '#FFF7ED'),
  ('s-market', 'S-market', 'grocery', '#00AA46', '#F0FDF4'),
  ('alepa', 'Alepa', 'grocery', '#E30613', '#FFF1F2'),
  ('sale', 'Sale', 'grocery', '#0A7D33', '#F0FDF4'),
  ('prisma', 'Prisma', 'grocery', '#00693E', '#F0FDF4'),
  ('lidl', 'Lidl', 'grocery', '#0050AA', '#EFF6FF'),
  ('minimani', 'Minimani', 'grocery', '#C8102E', '#FFF1F2'),
  ('gigantti', 'Gigantti', 'electronics', '#005EB8', '#EFF6FF'),
  ('power', 'POWER', 'electronics', '#0F172A', '#F1F5F9'),
  ('verkkokauppa-com', 'Verkkokauppa.com', 'electronics', '#E4002B', '#FFF1F2'),
  ('elisa', 'Elisa', 'electronics', '#0019AF', '#EFF6FF'),
  ('dna', 'DNA', 'electronics', '#6E2585', '#FAF5FF'),
  ('telia', 'Telia', 'electronics', '#990AE3', '#FAF5FF'),
  ('k-rauta', 'K-Rauta', 'hardware', '#E85D04', '#FFF7ED'),
  ('bauhaus', 'BAUHAUS', 'hardware', '#C8102E', '#FFF1F2'),
  ('stark', 'STARK', 'hardware', '#1D4ED8', '#EFF6FF'),
  ('puuilo', 'Puuilo', 'hardware', '#F59E0B', '#FFFBEB'),
  ('motonet', 'Motonet', 'automotive', '#0F52BA', '#EFF6FF'),
  ('tokmanni', 'Tokmanni', 'retail', '#E4002B', '#FFF1F2'),
  ('clas-ohlson', 'Clas Ohlson', 'retail', '#00447C', '#EFF6FF'),
  ('ikea', 'IKEA', 'retail', '#0058A3', '#EFF6FF'),
  ('yliopiston-apteekki', 'Yliopiston Apteekki', 'pharmacy', '#00843D', '#F0FDF4'),
  ('alko', 'Alko', 'alcohol', '#003DA5', '#EFF6FF'),
  ('mcdonalds', 'McDonald''s', 'restaurant', '#DA291C', '#FFF1F2'),
  ('hesburger', 'Hesburger', 'restaurant', '#004B93', '#EFF6FF'),
  ('burger-king', 'Burger King', 'restaurant', '#D62300', '#FFF7ED'),
  ('subway', 'Subway', 'restaurant', '#008C15', '#F0FDF4'),
  ('wolt', 'Wolt', 'restaurant', '#00C2E8', '#ECFEFF'),
  ('foodora', 'Foodora', 'restaurant', '#D70F64', '#FDF2F8'),
  ('hsl', 'HSL', 'transport', '#007AC9', '#EFF6FF'),
  ('vr', 'VR', 'transport', '#007A3D', '#F0FDF4'),
  ('finnair', 'Finnair', 'transport', '#0B1560', '#EFF6FF'),
  ('kespro', 'Kespro', 'grocery', '#E85D04', '#FFF7ED'),
  ('metro-tukku', 'Metro-tukku', 'grocery', '#00519E', '#EFF6FF'),
  ('valio', 'Valio', 'grocery', '#0057B8', '#EFF6FF'),
  ('heinon-tukku', 'Heinon Tukku', 'grocery', '#C8102E', '#FFF1F2')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  brand_color = excluded.brand_color,
  brand_background = excluded.brand_background,
  updated_at = now();

insert into merchant_aliases (merchant_id, alias) values
  ('k-market', 'k market'),
  ('k-market', 'kmarket'),
  ('k-supermarket', 'k supermarket'),
  ('k-supermarket', 'ksupermarket'),
  ('k-citymarket', 'k citymarket'),
  ('k-citymarket', 'citymarket'),
  ('s-market', 's market'),
  ('s-market', 'smarket'),
  ('alepa', 'alepa'),
  ('sale', 'sale'),
  ('prisma', 'prisma'),
  ('lidl', 'lidl'),
  ('minimani', 'minimani'),
  ('gigantti', 'gigantti'),
  ('power', 'power'),
  ('verkkokauppa-com', 'verkkokauppa.com'),
  ('verkkokauppa-com', 'verkkokauppa com'),
  ('verkkokauppa-com', 'verkkokauppa'),
  ('elisa', 'elisa'),
  ('dna', 'dna'),
  ('telia', 'telia'),
  ('k-rauta', 'k rauta'),
  ('k-rauta', 'krauta'),
  ('bauhaus', 'bauhaus'),
  ('stark', 'stark'),
  ('puuilo', 'puuilo'),
  ('motonet', 'motonet'),
  ('tokmanni', 'tokmanni'),
  ('clas-ohlson', 'clas ohlson'),
  ('ikea', 'ikea'),
  ('yliopiston-apteekki', 'yliopiston apteekki'),
  ('yliopiston-apteekki', 'ya apteekki'),
  ('alko', 'alko'),
  ('mcdonalds', 'mcdonald s'),
  ('mcdonalds', 'mcdonalds'),
  ('mcdonalds', 'mc donalds'),
  ('hesburger', 'hesburger'),
  ('burger-king', 'burger king'),
  ('subway', 'subway'),
  ('wolt', 'wolt'),
  ('wolt', 'wolt enterprises'),
  ('foodora', 'foodora'),
  ('hsl', 'hsl'),
  ('hsl', 'helsingin seudun liikenne'),
  ('vr', 'vr'),
  ('vr', 'vr group'),
  ('finnair', 'finnair'),
  ('kespro', 'kespro'),
  ('metro-tukku', 'metro tukku'),
  ('metro-tukku', 'meira nova'),
  ('valio', 'valio'),
  ('heinon-tukku', 'heinon tukku')
on conflict (alias) do update set merchant_id = excluded.merchant_id;


-- ===========================================================================
-- 0015_merchant_backfill.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0015 — Olemassa olevat toimipisteet brändeihin
-- ---------------------------------------------------------------------------
--
-- Kertaluontoinen aineistokorjaus. Uudet kuitit tunnistetaan
-- sovelluksessa automaattisesti; tämä koskee vain sitä mikä oli
-- tallennettu ennen tunnistusta.
--
-- Tunnisteet on ajettu sovelluksen oman tunnistusfunktion läpi ja
-- tarkistettu yksitellen. Normalisointia ei toisteta SQL:ssä:
-- Postgresin säännöllinen lauseke ei tue samoja merkkiluokkia kuin
-- JavaScript, joten kaksi toteutusta ajautuisi väistämättä erilleen ja
-- kantaan päätyisi liitoksia joita sovellus ei olisi tehnyt.
--
-- Tyhjässä kannassa nämä eivät osu mihinkään eivätkä tee mitään.
--
-- merchant_confirmed jää epätodeksi: tämä on koneen tekemä tunnistus, ja
-- käyttäjä saa yhä korjata sen käyttöliittymästä.

update suppliers set merchant_id = 'gigantti', merchant_confidence = 0.97
where id = 'c1bc1c2d-3925-4fe0-a4e1-66d6ab8055ab' and merchant_id is null;

update suppliers set merchant_id = 'gigantti', merchant_confidence = 0.92
where id = '3f34faa6-00bb-4808-9ebc-60d0c0bb18e8' and merchant_id is null;

update suppliers set merchant_id = 'k-market', merchant_confidence = 0.97
where id = '5d5e941d-5044-41df-a789-cdef508df5ff' and merchant_id is null;

update suppliers set merchant_id = 'k-market', merchant_confidence = 0.92
where id = '7de0ec49-3922-4abb-ab8b-034bb76ebcdb' and merchant_id is null;

update suppliers set merchant_id = 's-market', merchant_confidence = 0.92
where id = '931c9048-c457-4fbd-a270-cd2384723add' and merchant_id is null;


-- ===========================================================================
-- 0016_lunch.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0015 — Lounas
-- ---------------------------------------------------------------------------
--
-- Viikon lounaslista: suunnittele, muokkaa, esikatsele, julkaise, jaa.
--
-- Kolme ratkaisua ohjaa koko tiedostoa.
--
-- 1. HINTA EI OLE RUOASSA.
--    Lounas on yksi kokonaisuus jonka hintaan kaikki päivän ruoat
--    sisältyvät. Hintakenttä ruoassa houkuttelisi myymään yksittäisiä
--    annoksia, ja koko listan hinta olisi silloin laskettava jostain.
--    Hinta on päivässä, ja päivällä voi olla useampi nimetty hinta
--    (Lounas, Eläkeläinen, Lapset).
--
-- 2. JULKINEN SIVU EI LUE TAULUJA.
--    Asiakas ei ole kirjautunut. Sen sijaan että antaisimme anon-roolille
--    lukuoikeuden näihin tauluihin ja luottaisimme siihen että jokainen
--    käytäntö on kirjoitettu oikein, julkinen sivu kutsuu yhtä
--    security definer -funktiota joka palauttaa vain julkaistun viikon.
--    Yksi tarkistus yhdessä paikassa on tarkistettavissa; kymmenen
--    käytäntöä eri tauluissa ei.
--
-- 3. MUUTOS EI JULKAISE ITSEÄÄN.
--    Julkaistun listan muokkaaminen ei muuta sitä mitä asiakas näkee.
--    Sisällön muutosaika kirjataan liipaisimella, ja sitä verrataan
--    julkaisuaikaan. Ilman tätä ravintoloitsija voisi vahingossa
--    näyttää keskeneräisen listan ovessa olevassa QR-koodissa.

-- ---------------------------------------------------------------------------
-- 1. Ravintolan julkinen tunniste
-- ---------------------------------------------------------------------------
--
-- Osoitteessa ei käytetä uuid:ta. /lounas/cafe-monami on luettava,
-- jaettava ja muistettava; /lounas/36418756-fedd-... ei ole mitään
-- näistä. Tunnus ei myöskään paljasta sisäistä tunnistetta.

alter table restaurants add column if not exists slug text;

-- Täytetään nimestä. Ei ainutlaatuisuutta vielä: se lisätään vasta kun
-- mahdolliset törmäykset on ratkaistu numeroliitteellä.
update restaurants
set slug = regexp_replace(
  regexp_replace(
    lower(translate(name, 'äöåÄÖÅ', 'aoaAOA')),
    '[^a-z0-9]+', '-', 'g'
  ),
  '^-+|-+$', '', 'g'
)
where slug is null;

-- Törmäykset: sama nimi kahdella ravintolalla. Vanhin saa nimen,
-- muut saavat juoksevan numeron.
with numbered as (
  select id, slug,
         row_number() over (partition by slug order by created_at, id) as n
  from restaurants
)
update restaurants r
set slug = n.slug || '-' || n.n
from numbered n
where r.id = n.id and n.n > 1;

alter table restaurants alter column slug set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_slug_key') then
    alter table restaurants add constraint restaurants_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurants_slug_format') then
    alter table restaurants add constraint restaurants_slug_format
      check (slug ~ '^[a-z0-9][a-z0-9-]*$');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sanastot
-- ---------------------------------------------------------------------------
--
-- Omina tauluina eikä enumeina: uuden ruokavalion tai allergeenin
-- lisääminen on rivi, ei skeemamuutos eikä koodimuutos.

create table if not exists diet_types (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  /** Lyhenne merkkiin. Tyhjä kun lyhennettä ei ole. */
  short_label text not null default '',
  sort_order int not null default 100
);

insert into diet_types (id, label, short_label, sort_order) values
  ('vegetarian',  'Kasvis',        'K',  10),
  ('vegan',       'Vegaaninen',    'VE', 20),
  ('gluten_free', 'Gluteeniton',   'G',  30),
  ('lactose_free','Laktoositon',   'L',  40),
  ('milk_free',   'Maidoton',      'M',  50)
on conflict (id) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  sort_order = excluded.sort_order;

create table if not exists allergen_types (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  sort_order int not null default 100
);

insert into allergen_types (id, label, sort_order) values
  ('gluten',    'Gluteeni',   10),
  ('milk',      'Maito',      20),
  ('egg',       'Kananmuna',  30),
  ('fish',      'Kala',       40),
  ('shellfish', 'Äyriäiset',  50),
  ('soy',       'Soija',      60),
  ('nuts',      'Pähkinät',   70),
  ('celery',    'Selleri',    80),
  ('mustard',   'Sinappi',    90),
  ('sesame',    'Seesami',   100)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Viikko
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lunch_status') then
    create type lunch_status as enum ('draft', 'published', 'archived');
  end if;
end;
$$;

create table if not exists lunch_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /** Viikon maanantai. Tarkistus estää muun viikonpäivän. */
  week_start date not null check (extract(isodow from week_start) = 1),

  /**
   * Loppupäivä johdetaan alusta.
   *
   * Generoituna sarakkeena viikko ei voi olla ristiriitainen: alku ja
   * loppu eivät voi ajautua eri viikoille, koska loppua ei voi
   * kirjoittaa.
   */
  week_end date generated always as (week_start + 6) stored,

  status lunch_status not null default 'draft',
  published_at timestamptz,

  /**
   * Milloin sisältöä viimeksi muutettiin.
   *
   * Liipaisin päivittää tämän kun päivä, hinta tai ruoka muuttuu.
   * Vertaamalla julkaisuaikaan tiedetään onko julkaistussa listassa
   * julkaisemattomia muutoksia.
   */
  content_updated_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, week_start)
);

create index if not exists lunch_menus_restaurant_week_idx
  on lunch_menus (restaurant_id, week_start desc);

create table if not exists lunch_days (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references lunch_menus (id) on delete cascade,
  date date not null,

  /** 1 = maanantai. Johdettu, jotta se ei voi olla ristiriidassa. */
  day_of_week int generated always as (extract(isodow from date)::int) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (menu_id, date)
);

create index if not exists lunch_days_menu_idx on lunch_days (menu_id, date);

-- ---------------------------------------------------------------------------
-- 4. Hinnat
-- ---------------------------------------------------------------------------
--
-- Sentteinä kokonaislukuna, kuten kaikki muukin raha tässä
-- sovelluksessa. Liukuluku olisi eri sääntö samalle asialle.

create table if not exists lunch_prices (
  id uuid primary key default gen_random_uuid(),
  lunch_day_id uuid not null references lunch_days (id) on delete cascade,

  /** "Lounas", "Eläkeläinen", "Lapset". */
  name text not null check (length(trim(name)) > 0 and length(name) <= 40),

  price_cents int not null check (price_cents >= 0),
  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  unique (lunch_day_id, name)
);

create index if not exists lunch_prices_day_idx
  on lunch_prices (lunch_day_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5. Ruoat
-- ---------------------------------------------------------------------------
--
-- EI hintasaraketta. Se on tämän moduulin tärkein rakenteellinen
-- valinta: lounas on kokonaisuus, ei annosvalikoima.

create table if not exists lunch_items (
  id uuid primary key default gen_random_uuid(),
  lunch_day_id uuid not null references lunch_days (id) on delete cascade,

  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  description text check (description is null or length(description) <= 400),

  /** Polku storagessa, ei URL. Sama tapa kuin kuiteissa. */
  image_path text,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lunch_items_day_idx
  on lunch_items (lunch_day_id, sort_order);

create table if not exists lunch_item_diets (
  lunch_item_id uuid not null references lunch_items (id) on delete cascade,
  diet_type text not null references diet_types (id),
  primary key (lunch_item_id, diet_type)
);

create table if not exists lunch_item_allergens (
  lunch_item_id uuid not null references lunch_items (id) on delete cascade,
  allergen_type text not null references allergen_types (id),
  primary key (lunch_item_id, allergen_type)
);

-- ---------------------------------------------------------------------------
-- 6. Sisällön muutosaika
-- ---------------------------------------------------------------------------
--
-- Ilman tätä "julkaistussa listassa on muutoksia" pitäisi päätellä
-- vertaamalla rivejä, tai jokaisen toiminnon pitäisi muistaa päivittää
-- viikko itse. Toinen unohtuisi ennemmin tai myöhemmin.

create or replace function touch_lunch_menu_from_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus set content_updated_at = now(), updated_at = now()
  where id = coalesce(new.menu_id, old.menu_id);
  return null;
end;
$$;

create or replace function touch_lunch_menu_from_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus m set content_updated_at = now(), updated_at = now()
  from lunch_days d
  where d.id = coalesce(new.lunch_day_id, old.lunch_day_id)
    and m.id = d.menu_id;
  return null;
end;
$$;

create or replace function touch_lunch_menu_from_item_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus m set content_updated_at = now(), updated_at = now()
  from lunch_days d, lunch_items i
  where i.id = coalesce(new.lunch_item_id, old.lunch_item_id)
    and d.id = i.lunch_day_id
    and m.id = d.menu_id;
  return null;
end;
$$;

drop trigger if exists lunch_days_touch on lunch_days;
create trigger lunch_days_touch
  after insert or update or delete on lunch_days
  for each row execute function touch_lunch_menu_from_day();

drop trigger if exists lunch_prices_touch on lunch_prices;
create trigger lunch_prices_touch
  after insert or update or delete on lunch_prices
  for each row execute function touch_lunch_menu_from_child();

drop trigger if exists lunch_items_touch on lunch_items;
create trigger lunch_items_touch
  after insert or update or delete on lunch_items
  for each row execute function touch_lunch_menu_from_child();

drop trigger if exists lunch_item_diets_touch on lunch_item_diets;
create trigger lunch_item_diets_touch
  after insert or update or delete on lunch_item_diets
  for each row execute function touch_lunch_menu_from_item_child();

drop trigger if exists lunch_item_allergens_touch on lunch_item_allergens;
create trigger lunch_item_allergens_touch
  after insert or update or delete on lunch_item_allergens
  for each row execute function touch_lunch_menu_from_item_child();

-- ---------------------------------------------------------------------------
-- 7. Pääsy
-- ---------------------------------------------------------------------------
--
-- Luku: ravintolan jäsenet. Kirjoitus: vain esihenkilö — lounaslista on
-- se mitä ovessa lukee, eikä työntekijä muuta sitä ohimennen.
--
-- Anon-roolille EI anneta mitään. Julkinen sivu kulkee funktion kautta.

alter table lunch_menus enable row level security;
alter table lunch_days enable row level security;
alter table lunch_prices enable row level security;
alter table lunch_items enable row level security;
alter table lunch_item_diets enable row level security;
alter table lunch_item_allergens enable row level security;
alter table diet_types enable row level security;
alter table allergen_types enable row level security;

drop policy if exists diet_types_read on diet_types;
create policy diet_types_read on diet_types
  for select to authenticated using (true);

drop policy if exists allergen_types_read on allergen_types;
create policy allergen_types_read on allergen_types
  for select to authenticated using (true);

drop policy if exists lunch_menus_read on lunch_menus;
create policy lunch_menus_read on lunch_menus
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists lunch_days_read on lunch_days;
create policy lunch_days_read on lunch_days
  for select to authenticated
  using (
    menu_id in (
      select id from lunch_menus
      where restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_prices_read on lunch_prices;
create policy lunch_prices_read on lunch_prices
  for select to authenticated
  using (
    lunch_day_id in (
      select d.id from lunch_days d
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_items_read on lunch_items;
create policy lunch_items_read on lunch_items
  for select to authenticated
  using (
    lunch_day_id in (
      select d.id from lunch_days d
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_item_diets_read on lunch_item_diets;
create policy lunch_item_diets_read on lunch_item_diets
  for select to authenticated
  using (
    lunch_item_id in (
      select i.id from lunch_items i
      join lunch_days d on d.id = i.lunch_day_id
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_item_allergens_read on lunch_item_allergens;
create policy lunch_item_allergens_read on lunch_item_allergens
  for select to authenticated
  using (
    lunch_item_id in (
      select i.id from lunch_items i
      join lunch_days d on d.id = i.lunch_day_id
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );


-- ===========================================================================
-- 0017_lunch_functions.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0017 — Lounaslistan muokkaustoiminnot
-- ---------------------------------------------------------------------------
--
-- Kaikki security definer ja esihenkilörajauksella. Sama kuvio kuin
-- muualla: pääsysääntö on tietokannassa yhdessä paikassa, eikä se voi
-- ajautua eri linjalle sovelluskoodin kanssa.

/** Avaa viikon: luo viikon ja sen seitsemän päivää jos niitä ei ole. */
create or replace function open_lunch_week(p_restaurant uuid, p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu uuid;
  i int;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  if extract(isodow from p_week_start) <> 1 then
    raise exception 'Viikon on alettava maanantaista';
  end if;

  insert into lunch_menus (restaurant_id, week_start)
  values (p_restaurant, p_week_start)
  on conflict (restaurant_id, week_start) do update set updated_at = now()
  returning id into v_menu;

  -- Kaikki seitsemän päivää kerralla. Puolikas viikko näyttäisi siltä
  -- että ravintola on kiinni loppuviikon.
  for i in 0..6 loop
    insert into lunch_days (menu_id, date)
    values (v_menu, p_week_start + i)
    on conflict (menu_id, date) do nothing;
  end loop;

  return v_menu;
end;
$$;

revoke all on function open_lunch_week from public;
grant execute on function open_lunch_week to authenticated;

/** Päivän ravintola. Käytetään oikeustarkistuksissa. */
create or replace function lunch_day_restaurant(p_day uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.restaurant_id
  from lunch_days d join lunch_menus m on m.id = d.menu_id
  where d.id = p_day;
$$;

create or replace function lunch_item_restaurant(p_item uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.restaurant_id
  from lunch_items i
  join lunch_days d on d.id = i.lunch_day_id
  join lunch_menus m on m.id = d.menu_id
  where i.id = p_item;
$$;

/**
 * Ruoan tallennus.
 *
 * Yksi funktio luo ja päivittää. Kaksi erillistä ajautuisi erilleen
 * juuri ruokavalioiden käsittelyssä, joka on tämän ainoa hankala osa:
 * lapsirivit korvataan kokonaan, koska osittainen päivitys jättäisi
 * poistetut valinnat henkiin.
 */
create or replace function save_lunch_item(
  p_day uuid,
  p_item uuid,
  p_name text,
  p_description text,
  p_diets text[],
  p_allergens text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_id uuid;
  v_next int;
begin
  v_restaurant := lunch_day_restaurant(p_day);
  if v_restaurant is null then
    raise exception 'Päivää ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Ruoan nimi puuttuu';
  end if;

  if p_item is null then
    select coalesce(max(sort_order), -1) + 1 into v_next
    from lunch_items where lunch_day_id = p_day;

    insert into lunch_items (lunch_day_id, name, description, sort_order)
    values (p_day, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), v_next)
    returning id into v_id;
  else
    -- Ruoka on siirrettävä vain oman ravintolan sisällä.
    if lunch_item_restaurant(p_item) is distinct from v_restaurant then
      raise exception 'Ruokaa ei löytynyt';
    end if;

    update lunch_items
    set name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        updated_at = now()
    where id = p_item
    returning id into v_id;
  end if;

  delete from lunch_item_diets where lunch_item_id = v_id;
  delete from lunch_item_allergens where lunch_item_id = v_id;

  -- Tuntematon tunnus pudotetaan hiljaa: sanasto on kannassa, ja
  -- vanhentunut lomake ei saa kaataa tallennusta.
  if p_diets is not null then
    insert into lunch_item_diets (lunch_item_id, diet_type)
    select v_id, d from unnest(p_diets) d
    where d in (select id from diet_types)
    on conflict do nothing;
  end if;

  if p_allergens is not null then
    insert into lunch_item_allergens (lunch_item_id, allergen_type)
    select v_id, a from unnest(p_allergens) a
    where a in (select id from allergen_types)
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

revoke all on function save_lunch_item from public;
grant execute on function save_lunch_item to authenticated;

create or replace function delete_lunch_item(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_item_restaurant(p_item);
  if v_restaurant is null then return; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  delete from lunch_items where id = p_item;
end;
$$;

revoke all on function delete_lunch_item from public;
grant execute on function delete_lunch_item to authenticated;

/**
 * Järjestyksen muutos.
 *
 * Vaihtaa paikkaa naapurin kanssa, jolloin järjestysluvut pysyvät
 * tiiviinä eikä koko listaa tarvitse numeroida uudelleen.
 */
create or replace function move_lunch_item(p_item uuid, p_up boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_day uuid;
  v_order int;
  v_other uuid;
  v_other_order int;
begin
  v_restaurant := lunch_item_restaurant(p_item);
  if v_restaurant is null then return; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  select lunch_day_id, sort_order into v_day, v_order
  from lunch_items where id = p_item;

  if p_up then
    select id, sort_order into v_other, v_other_order
    from lunch_items
    where lunch_day_id = v_day and sort_order < v_order
    order by sort_order desc limit 1;
  else
    select id, sort_order into v_other, v_other_order
    from lunch_items
    where lunch_day_id = v_day and sort_order > v_order
    order by sort_order asc limit 1;
  end if;

  if v_other is null then return; end if;

  update lunch_items set sort_order = v_other_order, updated_at = now()
  where id = p_item;
  update lunch_items set sort_order = v_order, updated_at = now()
  where id = v_other;
end;
$$;

revoke all on function move_lunch_item from public;
grant execute on function move_lunch_item to authenticated;

/** Päivän hinta. Null poistaa hinnan. */
create or replace function set_lunch_price(
  p_day uuid,
  p_name text,
  p_cents int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_day_restaurant(p_day);
  if v_restaurant is null then
    raise exception 'Päivää ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Hinnan nimi puuttuu';
  end if;

  if p_cents is null then
    delete from lunch_prices
    where lunch_day_id = p_day and name = trim(p_name);
    return;
  end if;

  if p_cents < 0 then
    raise exception 'Hinta ei voi olla negatiivinen';
  end if;

  insert into lunch_prices (lunch_day_id, name, price_cents)
  values (p_day, trim(p_name), p_cents)
  on conflict (lunch_day_id, name)
  do update set price_cents = excluded.price_cents;
end;
$$;

revoke all on function set_lunch_price from public;
grant execute on function set_lunch_price to authenticated;


-- ===========================================================================
-- 0018_lunch_copy_publish_public.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0018 — Kopiointi, julkaisu ja julkinen haku
-- ---------------------------------------------------------------------------

/**
 * Päivän kopiointi.
 *
 * Korvaa kohteen sisällön kokonaan. Osittainen yhdistäminen tuottaisi
 * kaksoiskappaleita joita kukaan ei pyytänyt — sama ruoka kahdesti
 * listalla on pahempi kuin ylikirjoitettu päivä, koska sitä ei huomaa.
 */
create or replace function copy_lunch_day(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  r record;
  v_new uuid;
begin
  v_restaurant := lunch_day_restaurant(p_from);

  -- Molempien on kuuluttava samaan ravintolaan. Ilman tätä toisen
  -- ravintolan päivän tunnisteella voisi kopioida sen sisällön itselleen.
  if v_restaurant is null or lunch_day_restaurant(p_to) is distinct from v_restaurant then
    raise exception 'Päivää ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;
  if p_from = p_to then return; end if;

  delete from lunch_items where lunch_day_id = p_to;
  delete from lunch_prices where lunch_day_id = p_to;

  insert into lunch_prices (lunch_day_id, name, price_cents, sort_order)
  select p_to, name, price_cents, sort_order
  from lunch_prices where lunch_day_id = p_from;

  for r in
    select * from lunch_items where lunch_day_id = p_from order by sort_order
  loop
    insert into lunch_items (lunch_day_id, name, description, image_path, sort_order)
    values (p_to, r.name, r.description, r.image_path, r.sort_order)
    returning id into v_new;

    insert into lunch_item_diets (lunch_item_id, diet_type)
    select v_new, diet_type from lunch_item_diets where lunch_item_id = r.id;

    insert into lunch_item_allergens (lunch_item_id, allergen_type)
    select v_new, allergen_type from lunch_item_allergens where lunch_item_id = r.id;
  end loop;
end;
$$;

revoke all on function copy_lunch_day from public;
grant execute on function copy_lunch_day to authenticated;

/**
 * Viikon kopiointi.
 *
 * Julkaisutila ei kopioidu. Uusi viikko alkaa aina luonnoksena, muuten
 * kopiointi julkaisisi keskeneräisen listan ovessa olevaan QR-koodiin.
 */
create or replace function copy_lunch_week(
  p_restaurant uuid,
  p_from_week date,
  p_to_week date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_menu uuid;
  v_from_menu uuid;
  d record;
  v_to_day uuid;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  select id into v_from_menu from lunch_menus
  where restaurant_id = p_restaurant and week_start = p_from_week;

  if v_from_menu is null then
    raise exception 'Kopioitavaa viikkoa ei löytynyt';
  end if;

  v_to_menu := open_lunch_week(p_restaurant, p_to_week);

  -- Päivät kohdistetaan siirtymän mukaan eikä viikonpäivän nimellä:
  -- näin maanantai menee maanantaiksi myös silloin kun viikkoja on
  -- välissä useampi.
  for d in
    select id, date from lunch_days where menu_id = v_from_menu order by date
  loop
    select id into v_to_day from lunch_days
    where menu_id = v_to_menu
      and date = p_to_week + (d.date - p_from_week);

    if v_to_day is not null then
      perform copy_lunch_day(d.id, v_to_day);
    end if;
  end loop;

  update lunch_menus
  set status = 'draft', published_at = null, updated_at = now()
  where id = v_to_menu;

  return v_to_menu;
end;
$$;

revoke all on function copy_lunch_week from public;
grant execute on function copy_lunch_week to authenticated;

/**
 * Julkaisu.
 *
 * Tyhjää viikkoa ei julkaista: ovessa oleva QR-koodi johtaisi tyhjälle
 * sivulle, ja asiakas päättelisi siitä että lounasta ei ole.
 */
create or replace function publish_lunch_week(p_menu uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_items int;
begin
  select restaurant_id into v_restaurant from lunch_menus where id = p_menu;
  if v_restaurant is null then
    raise exception 'Viikkoa ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi julkaista lounaslistan';
  end if;

  select count(*) into v_items
  from lunch_items i join lunch_days d on d.id = i.lunch_day_id
  where d.menu_id = p_menu;

  if v_items = 0 then
    raise exception 'Tyhjää lounaslistaa ei voi julkaista';
  end if;

  update lunch_menus
  set status = 'published', published_at = now(), updated_at = now()
  where id = p_menu;
end;
$$;

revoke all on function publish_lunch_week from public;
grant execute on function publish_lunch_week to authenticated;

/** Luonnos ja arkisto. Julkaisu kulkee vain publish_lunch_week-funktion kautta. */
create or replace function set_lunch_week_status(p_menu uuid, p_status lunch_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from lunch_menus where id = p_menu;
  if v_restaurant is null then
    raise exception 'Viikkoa ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  -- Julkaisu tarkistaa sisällön. Tämän kautta se ohittaisi tarkistuksen.
  if p_status = 'published' then
    raise exception 'Julkaisu tehdään publish_lunch_week-funktiolla';
  end if;

  update lunch_menus
  set status = p_status,
      published_at = case when p_status = 'draft' then null else published_at end,
      updated_at = now()
  where id = p_menu;
end;
$$;

revoke all on function set_lunch_week_status from public;
grant execute on function set_lunch_week_status to authenticated;

-- ---------------------------------------------------------------------------
-- Julkinen haku
-- ---------------------------------------------------------------------------

/**
 * Julkisen lounassivun ainoa tietolähde.
 *
 * Anon-roolille ei ole annettu lukuoikeutta yhteenkään lounastauluun,
 * eikä ravintolatauluun. Kaikki RLS-käytännöt on kirjoitettu vain
 * authenticated-roolille, joten kirjautumaton osuu joka taulussa
 * oletuskieltoon.
 *
 * Tämä funktio on siis ainoa reitti ulos, ja se palauttaa vain
 * julkaistun viikon ja vain ne kentät jotka kuuluvat asiakkaalle.
 * Yksi tarkistus yhdessä paikassa on tarkistettavissa; kymmenen
 * käytäntöä eri tauluissa ei.
 */
create or replace function public_lunch_week(p_slug text, p_week_start date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_menu record;
  v_week date;
begin
  select id, name, timezone into v_restaurant
  from restaurants where slug = p_slug;

  if v_restaurant.id is null then
    return null;
  end if;

  -- Kuluva viikko ravintolan omalla aikavyöhykkeellä, ei palvelimen.
  v_week := coalesce(
    p_week_start,
    (date_trunc('week', (now() at time zone v_restaurant.timezone)))::date
  );

  select * into v_menu
  from lunch_menus
  where restaurant_id = v_restaurant.id
    and week_start = v_week
    and status = 'published';

  -- Julkaisematon viikko palauttaa ravintolan nimen mutta ei sisältöä.
  -- Näin sivu voi kertoa "ei julkaistu" eikä näytä rikkinäiseltä.
  if v_menu.id is null then
    return json_build_object(
      'restaurantName', v_restaurant.name,
      'weekStart', v_week,
      'published', false,
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
    'days', coalesce((
      select json_agg(day order by day_date)
      from (
        select
          d.date as day_date,
          json_build_object(
            'date', d.date,
            'prices', coalesce((
              select json_agg(json_build_object('name', p.name, 'cents', p.price_cents)
                              order by p.sort_order, p.name)
              from lunch_prices p where p.lunch_day_id = d.id
            ), '[]'::json),
            'items', coalesce((
              select json_agg(json_build_object(
                       'name', i.name,
                       'description', i.description,
                       'diets', coalesce((
                         select json_agg(t.label order by t.sort_order)
                         from lunch_item_diets x
                         join diet_types t on t.id = x.diet_type
                         where x.lunch_item_id = i.id
                       ), '[]'::json),
                       'allergens', coalesce((
                         select json_agg(a.label order by a.sort_order)
                         from lunch_item_allergens y
                         join allergen_types a on a.id = y.allergen_type
                         where y.lunch_item_id = i.id
                       ), '[]'::json)
                     ) order by i.sort_order)
              from lunch_items i where i.lunch_day_id = d.id
            ), '[]'::json)
          ) as day
        from lunch_days d
        where d.menu_id = v_menu.id
      ) rows
    ), '[]'::json)
  );
end;
$$;

revoke all on function public_lunch_week from public;
grant execute on function public_lunch_week to anon, authenticated;


-- ===========================================================================
-- 0019_my_restaurants_slug.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0019 — Slug jäsenyysnäkymään
-- ---------------------------------------------------------------------------
--
-- Julkisen lounassivun osoite rakennetaan slugista. Ilman tätä se
-- vaatisi oman kyselyn joka sivunlatauksella, vaikka jäsenyys haetaan
-- joka tapauksessa.
--
-- Sarake lisätään loppuun. create or replace view ei salli sarakkeiden
-- järjestyksen muuttamista, ja näkymän pudottaminen veisi mukanaan
-- oikeudet.
--
-- security_invoker = true säilyy: näkymä ei saa ohittaa RLS:ää.

create or replace view my_restaurants
with (security_invoker = true)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;


-- ===========================================================================
-- 0020_matti.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0020 — Matti, BUDetin AI-työkaveri
-- ---------------------------------------------------------------------------
--
-- Kolme taulua ja yksi periaate.
--
-- PERIAATE: mallin tuotos ei voi muuttaa dataa.
--
-- Kirjoittavat työkalut eivät kirjoita. Ne tallentavat ehdotuksen
-- ai_pending_actions-tauluun ja palauttavat esikatselun. Vasta kun
-- ihminen hyväksyy sen käyttöliittymässä, palvelin lukee ehdotuksen
-- KANNASTA — ei selaimen lähettämästä pyynnöstä — tarkistaa oikeudet
-- uudelleen ja suorittaa toiminnon olemassa olevalla funktiolla.
--
-- Tämä ei ole varotoimi vaan rakenne. Jos malli harhautetaan kuittiin
-- piilotetulla tekstillä, se saa aikaan korkeintaan ehdotuksen jonka
-- käyttäjä näkee ja hylkää. Kehotusinjektio ei voi ohittaa ihmistä,
-- koska mallilla ei ole reittiä kantaan.
--
-- Matti käyttää käyttäjän omaa istuntoa, ei palveluavainta. Sama RLS
-- joka suojaa käyttöliittymää suojaa Mattia: toisen ravintolan dataa
-- ei ole olemassa hänelle sen paremmin kuin käyttäjällekään.

-- ---------------------------------------------------------------------------
-- 1. Keskustelut
-- ---------------------------------------------------------------------------

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,

  /** Lyhyt otsikko listaa varten. Ensimmäisestä viestistä. */
  title text not null default 'Uusi keskustelu',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on ai_conversations (user_id, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_role') then
    create type ai_role as enum ('user', 'assistant');
  end if;
end;
$$;

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,

  role ai_role not null,
  content text not null default '',

  /**
   * Työkalukutsut ja niiden tulokset.
   *
   * Tallennetaan jotta keskustelun voi jatkaa uudelleen ladattuna ja
   * jotta jälkikäteen näkee mihin dataan vastaus perustui. Ilman tätä
   * "Matti sanoi 8 240 €" olisi väite jota ei voi tarkistaa.
   */
  tool_calls jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Ehdotetut muutokset
-- ---------------------------------------------------------------------------
--
-- Ehdotus tallennetaan palvelimella. Selain saa vain tunnisteen.
--
-- Jos argumentit kulkisivat selaimen kautta takaisin, hyväksyntä olisi
-- vain muodollisuus: kuka tahansa voisi vaihtaa summan hyväksynnän ja
-- suorituksen välissä. Nyt hyväksyntä viittaa siihen mitä käyttäjälle
-- näytettiin, eikä muuhun.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type ai_action_status as enum ('pending', 'confirmed', 'cancelled', 'failed');
  end if;
end;
$$;

create table if not exists ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,

  /** Työkalun nimi. Palvelin ratkaisee tästä mitä suoritetaan. */
  tool text not null,

  /** Työkalun argumentit sellaisina kuin ne validoitiin. */
  arguments jsonb not null,

  /** Mitä käyttäjälle näytettiin. Auditointia varten. */
  preview jsonb not null,

  status ai_action_status not null default 'pending',

  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ai_pending_actions_conversation_idx
  on ai_pending_actions (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Audit
-- ---------------------------------------------------------------------------
--
-- Jokaisesta suoritetusta muutoksesta jää jälki. Ei siksi että jotain
-- odotettaisiin menevän pieleen, vaan siksi että "Matti muutti hinnan"
-- on tarkistettavissa vain jos ennen ja jälkeen on tallessa.

create table if not exists ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete set null,
  conversation_id uuid references ai_conversations (id) on delete set null,

  tool text not null,
  arguments jsonb not null default '{}'::jsonb,

  /** Kohteen tunniste, esim. lounaspäivän id. */
  target text,

  before_value jsonb,
  after_value jsonb,

  /** Vahvistiko ihminen. Kirjoittavissa aina tosi. */
  confirmed boolean not null default false,

  success boolean not null,
  error text,

  created_at timestamptz not null default now()
);

create index if not exists ai_audit_log_restaurant_idx
  on ai_audit_log (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Pääsy
-- ---------------------------------------------------------------------------
--
-- Keskustelu on henkilökohtainen: se voi sisältää käyttäjän omia
-- kysymyksiä eikä kuulu muille saman ravintolan jäsenille. Auditloki
-- sen sijaan koskee ravintolaa, ja esihenkilön on voitava lukea se.

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_pending_actions enable row level security;
alter table ai_audit_log enable row level security;

drop policy if exists ai_conversations_own on ai_conversations;
create policy ai_conversations_own on ai_conversations
  for select to authenticated
  using (user_id = auth.uid() and restaurant_id in (select my_restaurant_ids()));

drop policy if exists ai_messages_own on ai_messages;
create policy ai_messages_own on ai_messages
  for select to authenticated
  using (
    conversation_id in (
      select id from ai_conversations where user_id = auth.uid()
    )
  );

drop policy if exists ai_pending_actions_own on ai_pending_actions;
create policy ai_pending_actions_own on ai_pending_actions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_audit_log_read on ai_audit_log;
create policy ai_audit_log_read on ai_audit_log
  for select to authenticated
  using (is_manager(restaurant_id));

-- Kirjoitusoikeutta ei anneta kenellekään. Kaikki kirjoitukset kulkevat
-- alla olevien funktioiden kautta, jotta niitä ei voi tehdä ohi
-- tarkistusten.

-- ---------------------------------------------------------------------------
-- 5. Funktiot
-- ---------------------------------------------------------------------------

/** Avaa tai jatkaa keskustelua. */
create or replace function ai_open_conversation(
  p_restaurant uuid,
  p_conversation uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  if p_conversation is not null then
    select id into v_id from ai_conversations
    where id = p_conversation and user_id = auth.uid();

    if v_id is not null then
      update ai_conversations set updated_at = now() where id = v_id;
      return v_id;
    end if;
  end if;

  insert into ai_conversations (restaurant_id, user_id)
  values (p_restaurant, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function ai_open_conversation from public;
grant execute on function ai_open_conversation to authenticated;

/** Tallentaa viestin. Vain oman keskustelun. */
create or replace function ai_add_message(
  p_conversation uuid,
  p_role ai_role,
  p_content text,
  p_tool_calls jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from ai_conversations
    where id = p_conversation and user_id = auth.uid()
  ) then
    raise exception 'Keskustelua ei löytynyt';
  end if;

  insert into ai_messages (conversation_id, role, content, tool_calls)
  values (p_conversation, p_role, coalesce(p_content, ''), coalesce(p_tool_calls, '[]'::jsonb))
  returning id into v_id;

  -- Otsikko ensimmäisestä käyttäjän viestistä. Keskustelulista ilman
  -- otsikoita on rivi tunnisteita.
  update ai_conversations c
  set updated_at = now(),
      title = case
        when c.title = 'Uusi keskustelu' and p_role = 'user'
          then left(regexp_replace(coalesce(p_content, ''), E'\\s+', ' ', 'g'), 60)
        else c.title
      end
  where c.id = p_conversation;

  return v_id;
end;
$$;

revoke all on function ai_add_message from public;
grant execute on function ai_add_message to authenticated;

/** Tallentaa ehdotetun muutoksen odottamaan hyväksyntää. */
create or replace function ai_propose_action(
  p_conversation uuid,
  p_tool text,
  p_arguments jsonb,
  p_preview jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_id uuid;
begin
  select restaurant_id into v_restaurant from ai_conversations
  where id = p_conversation and user_id = auth.uid();

  if v_restaurant is null then
    raise exception 'Keskustelua ei löytynyt';
  end if;

  insert into ai_pending_actions
    (conversation_id, restaurant_id, user_id, tool, arguments, preview)
  values
    (p_conversation, v_restaurant, auth.uid(), p_tool, p_arguments, p_preview)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function ai_propose_action from public;
grant execute on function ai_propose_action to authenticated;

/**
 * Merkitsee ehdotuksen ratkaistuksi.
 *
 * Palauttaa ehdotuksen rivin vain jos se oli vielä odottamassa. Näin
 * sama hyväksyntä ei voi suorittaa toimintoa kahdesti: toinen kutsu
 * ei saa riviä eikä siis tee mitään.
 */
create or replace function ai_resolve_action(
  p_action uuid,
  p_status ai_action_status
)
returns ai_pending_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_pending_actions;
begin
  update ai_pending_actions
  set status = p_status, resolved_at = now()
  where id = p_action
    and user_id = auth.uid()
    and status = 'pending'
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function ai_resolve_action from public;
grant execute on function ai_resolve_action to authenticated;

/** Kirjaa suoritetun toiminnon. */
create or replace function ai_log_action(
  p_restaurant uuid,
  p_conversation uuid,
  p_tool text,
  p_arguments jsonb,
  p_target text,
  p_before jsonb,
  p_after jsonb,
  p_confirmed boolean,
  p_success boolean,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  insert into ai_audit_log (
    restaurant_id, user_id, conversation_id, tool, arguments, target,
    before_value, after_value, confirmed, success, error
  )
  values (
    p_restaurant, auth.uid(), p_conversation, p_tool,
    coalesce(p_arguments, '{}'::jsonb), p_target,
    p_before, p_after, p_confirmed, p_success, p_error
  );
end;
$$;

revoke all on function ai_log_action from public;
grant execute on function ai_log_action to authenticated;


-- ===========================================================================
-- 0021_clear_lunch_day_items.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0021 — Päivän ruokien tyhjennys
-- ---------------------------------------------------------------------------
--
-- Tarvitaan kun lounaslista korvataan uudella. Vaihtoehto olisi poistaa
-- rivit yksitellen sovelluksesta käsin, mutta silloin puolittain
-- epäonnistunut korvaus jättäisi päivän tilaan jota kukaan ei pyytänyt:
-- osa vanhoista ruoista poistettuna, uusia ei vielä lisätty.
--
-- Hintoja ei kosketa. Ruokien vaihtaminen ei ole syy nollata hintaa, ja
-- hinnan katoaminen huomaamatta olisi pahempi virhe kuin väärä
-- ruokalista — se näkyy asiakkaalle ovessa.

create or replace function clear_lunch_day_items(p_day uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_day_restaurant(p_day);

  if v_restaurant is null then
    raise exception 'Päivää ei löytynyt';
  end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  delete from lunch_items where lunch_day_id = p_day;
end;
$$;

revoke all on function clear_lunch_day_items from public;
grant execute on function clear_lunch_day_items to authenticated;


-- ===========================================================================
-- 0022_lunch_week_price.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0022 — Lounashinta viikolle, ei päivälle
-- ---------------------------------------------------------------------------
--
-- Hinta oli päiväkohtainen. Se oli liikaa: ravintolan lounas maksaa
-- saman verran maanantaina ja perjantaina, ja päiväkohtainen hinta
-- tarkoitti viittä kenttää joihin kirjoitetaan viisi kertaa sama luku.
-- Viisi paikkaa samalle luvulle on myös viisi paikkaa jossa se voi
-- jäädä päivittämättä.
--
-- Hinta siirtyy viikolle. Nimetyt hinnat säilyvät — Lounas,
-- Eläkeläinen, Lapset — mutta ne koskevat koko viikkoa.
--
-- Siirto on puhdas: hintarivejä ei ollut vielä yhtään.

-- Käytäntö viittaa vanhaan sarakkeeseen, joten se on pudotettava
-- ennen saraketta. Uusi luodaan alempana.
drop policy if exists lunch_prices_read on lunch_prices;

alter table lunch_prices
  drop constraint if exists lunch_prices_lunch_day_id_name_key;

alter table lunch_prices
  add column if not exists menu_id uuid references lunch_menus (id) on delete cascade;

-- Olemassa olevat rivit päivän kautta viikolle. Tyhjässä taulussa
-- tämä ei tee mitään, mutta se on oikein myös jos rivejä olisi.
update lunch_prices p
set menu_id = d.menu_id
from lunch_days d
where d.id = p.lunch_day_id and p.menu_id is null;

-- Sama nimi kahdesti samalla viikolla ei ole hinta vaan ristiriita.
delete from lunch_prices a
using lunch_prices b
where a.menu_id = b.menu_id
  and a.name = b.name
  and a.ctid > b.ctid;

alter table lunch_prices alter column menu_id set not null;
alter table lunch_prices drop column if exists lunch_day_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lunch_prices_menu_name_key'
  ) then
    alter table lunch_prices add constraint lunch_prices_menu_name_key
      unique (menu_id, name);
  end if;
end;
$$;

drop index if exists lunch_prices_day_idx;
create index if not exists lunch_prices_menu_idx
  on lunch_prices (menu_id, sort_order);

-- ---------------------------------------------------------------------------
-- Käytäntö ja liipaisin uudelleen
-- ---------------------------------------------------------------------------

drop policy if exists lunch_prices_read on lunch_prices;
create policy lunch_prices_read on lunch_prices
  for select to authenticated
  using (
    menu_id in (
      select id from lunch_menus
      where restaurant_id in (select my_restaurant_ids())
    )
  );

-- Sisällön muutosaika päivittyy nyt suoraan viikosta eikä päivän kautta.
create or replace function touch_lunch_menu_from_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus set content_updated_at = now(), updated_at = now()
  where id = coalesce(new.menu_id, old.menu_id);
  return null;
end;
$$;

drop trigger if exists lunch_prices_touch on lunch_prices;
create trigger lunch_prices_touch
  after insert or update or delete on lunch_prices
  for each row execute function touch_lunch_menu_from_price();

-- ---------------------------------------------------------------------------
-- Hinnan asetus
-- ---------------------------------------------------------------------------

drop function if exists set_lunch_price(uuid, text, int);

/**
 * Viikon lounashinta. Null poistaa hinnan.
 *
 * Ottaa viikon eikä päivän. Päiväkohtainen kutsu jäisi eloon
 * rinnalle ja tuottaisi hiljaa vanhan mallin mukaisia rivejä.
 */
create or replace function set_lunch_price(
  p_menu uuid,
  p_name text,
  p_cents int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from lunch_menus where id = p_menu;

  if v_restaurant is null then
    raise exception 'Viikkoa ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Hinnan nimi puuttuu';
  end if;

  if p_cents is null then
    delete from lunch_prices where menu_id = p_menu and name = trim(p_name);
    return;
  end if;

  if p_cents < 0 then
    raise exception 'Hinta ei voi olla negatiivinen';
  end if;

  insert into lunch_prices (menu_id, name, price_cents)
  values (p_menu, trim(p_name), p_cents)
  on conflict (menu_id, name)
  do update set price_cents = excluded.price_cents;
end;
$$;

revoke all on function set_lunch_price from public;
grant execute on function set_lunch_price to authenticated;

-- ---------------------------------------------------------------------------
-- Kopiointi
-- ---------------------------------------------------------------------------

/**
 * Päivän kopiointi ei enää koske hintoihin.
 *
 * Hinta on viikon ominaisuus, joten päivän kopioiminen toiseen päivään
 * samalla viikolla ei voi muuttaa sitä.
 */
create or replace function copy_lunch_day(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  r record;
  v_new uuid;
begin
  v_restaurant := lunch_day_restaurant(p_from);

  if v_restaurant is null or lunch_day_restaurant(p_to) is distinct from v_restaurant then
    raise exception 'Päivää ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;
  if p_from = p_to then return; end if;

  delete from lunch_items where lunch_day_id = p_to;

  for r in
    select * from lunch_items where lunch_day_id = p_from order by sort_order
  loop
    insert into lunch_items (lunch_day_id, name, description, image_path, sort_order)
    values (p_to, r.name, r.description, r.image_path, r.sort_order)
    returning id into v_new;

    insert into lunch_item_diets (lunch_item_id, diet_type)
    select v_new, diet_type from lunch_item_diets where lunch_item_id = r.id;

    insert into lunch_item_allergens (lunch_item_id, allergen_type)
    select v_new, allergen_type from lunch_item_allergens where lunch_item_id = r.id;
  end loop;
end;
$$;

revoke all on function copy_lunch_day from public;
grant execute on function copy_lunch_day to authenticated;

/** Viikon kopiointi ottaa hinnat mukaan. */
create or replace function copy_lunch_week(
  p_restaurant uuid,
  p_from_week date,
  p_to_week date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_menu uuid;
  v_from_menu uuid;
  d record;
  v_to_day uuid;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  select id into v_from_menu from lunch_menus
  where restaurant_id = p_restaurant and week_start = p_from_week;

  if v_from_menu is null then
    raise exception 'Kopioitavaa viikkoa ei löytynyt';
  end if;

  v_to_menu := open_lunch_week(p_restaurant, p_to_week);

  delete from lunch_prices where menu_id = v_to_menu;

  insert into lunch_prices (menu_id, name, price_cents, sort_order)
  select v_to_menu, name, price_cents, sort_order
  from lunch_prices where menu_id = v_from_menu;

  for d in
    select id, date from lunch_days where menu_id = v_from_menu order by date
  loop
    select id into v_to_day from lunch_days
    where menu_id = v_to_menu
      and date = p_to_week + (d.date - p_from_week);

    if v_to_day is not null then
      perform copy_lunch_day(d.id, v_to_day);
    end if;
  end loop;

  update lunch_menus
  set status = 'draft', published_at = null, updated_at = now()
  where id = v_to_menu;

  return v_to_menu;
end;
$$;

revoke all on function copy_lunch_week from public;
grant execute on function copy_lunch_week to authenticated;

-- ---------------------------------------------------------------------------
-- Julkinen haku
-- ---------------------------------------------------------------------------

/** Hinnat viikon tasolla, ei enää päivien sisällä. */
create or replace function public_lunch_week(p_slug text, p_week_start date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_menu record;
  v_week date;
begin
  select id, name, timezone into v_restaurant
  from restaurants where slug = p_slug;

  if v_restaurant.id is null then
    return null;
  end if;

  v_week := coalesce(
    p_week_start,
    (date_trunc('week', (now() at time zone v_restaurant.timezone)))::date
  );

  select * into v_menu
  from lunch_menus
  where restaurant_id = v_restaurant.id
    and week_start = v_week
    and status = 'published';

  if v_menu.id is null then
    return json_build_object(
      'restaurantName', v_restaurant.name,
      'weekStart', v_week,
      'published', false,
      'prices', '[]'::json,
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
    'prices', coalesce((
      select json_agg(json_build_object('name', p.name, 'cents', p.price_cents)
                      order by p.sort_order, p.name)
      from lunch_prices p where p.menu_id = v_menu.id
    ), '[]'::json),
    'days', coalesce((
      select json_agg(day order by day_date)
      from (
        select
          d.date as day_date,
          json_build_object(
            'date', d.date,
            'items', coalesce((
              select json_agg(json_build_object(
                       'name', i.name,
                       'description', i.description,
                       'diets', coalesce((
                         select json_agg(t.label order by t.sort_order)
                         from lunch_item_diets x
                         join diet_types t on t.id = x.diet_type
                         where x.lunch_item_id = i.id
                       ), '[]'::json),
                       'allergens', coalesce((
                         select json_agg(a.label order by a.sort_order)
                         from lunch_item_allergens y
                         join allergen_types a on a.id = y.allergen_type
                         where y.lunch_item_id = i.id
                       ), '[]'::json)
                     ) order by i.sort_order)
              from lunch_items i where i.lunch_day_id = d.id
            ), '[]'::json)
          ) as day
        from lunch_days d
        where d.menu_id = v_menu.id
      ) rows
    ), '[]'::json)
  );
end;
$$;

revoke all on function public_lunch_week from public;
grant execute on function public_lunch_week to anon, authenticated;


-- ===========================================================================
-- 0023_lunch_includes.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0023 — Kuuluuko jälkiruoka ja kahvi hintaan
-- ---------------------------------------------------------------------------
--
-- Asiakas kysyy tämän tiskillä joka päivä. Se on hinnan jälkeen toinen
-- asia jonka hän haluaa tietää, eikä sitä voi päätellä ruokalistasta:
-- "Salaattipöytä ja leipä" ei kerro sisältyykö kahvi.
--
-- Viikon ominaisuuksia, kuten hinta. Ravintola ei tarjoa jälkiruokaa
-- maanantaina ja jätä sitä pois tiistaina — ja jos joskus tekisi, se
-- kirjoitetaan päivän ruokalistalle omana rivinään.
--
-- Erilliset sarakkeet eikä yksi tekstikenttä: "sisältyykö kahvi" on
-- kysymys johon vastataan kyllä tai ei, ja vapaa teksti tekisi siitä
-- jotain jota pitää tulkita.

alter table lunch_menus
  add column if not exists includes_dessert boolean not null default false;

alter table lunch_menus
  add column if not exists includes_coffee boolean not null default false;

/**
 * Asettaa mitä hintaan sisältyy.
 *
 * Molemmat kerralla: ne muuttuvat samassa näkymässä samalla
 * ajatuksella, eikä kahdesta funktiosta ole hyötyä.
 */
create or replace function set_lunch_includes(
  p_menu uuid,
  p_dessert boolean,
  p_coffee boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from lunch_menus where id = p_menu;

  if v_restaurant is null then
    raise exception 'Viikkoa ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  update lunch_menus
  set includes_dessert = coalesce(p_dessert, false),
      includes_coffee = coalesce(p_coffee, false),
      content_updated_at = now(),
      updated_at = now()
  where id = p_menu;
end;
$$;

revoke all on function set_lunch_includes from public;
grant execute on function set_lunch_includes to authenticated;

-- ---------------------------------------------------------------------------
-- Kopiointi ottaa nämä mukaan
-- ---------------------------------------------------------------------------

create or replace function copy_lunch_week(
  p_restaurant uuid,
  p_from_week date,
  p_to_week date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to_menu uuid;
  v_from_menu uuid;
  v_dessert boolean;
  v_coffee boolean;
  d record;
  v_to_day uuid;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  select id, includes_dessert, includes_coffee
    into v_from_menu, v_dessert, v_coffee
  from lunch_menus
  where restaurant_id = p_restaurant and week_start = p_from_week;

  if v_from_menu is null then
    raise exception 'Kopioitavaa viikkoa ei löytynyt';
  end if;

  v_to_menu := open_lunch_week(p_restaurant, p_to_week);

  delete from lunch_prices where menu_id = v_to_menu;

  insert into lunch_prices (menu_id, name, price_cents, sort_order)
  select v_to_menu, name, price_cents, sort_order
  from lunch_prices where menu_id = v_from_menu;

  for d in
    select id, date from lunch_days where menu_id = v_from_menu order by date
  loop
    select id into v_to_day from lunch_days
    where menu_id = v_to_menu
      and date = p_to_week + (d.date - p_from_week);

    if v_to_day is not null then
      perform copy_lunch_day(d.id, v_to_day);
    end if;
  end loop;

  -- Kopio on aina luonnos. Sisältyvät otetaan mukaan: ne ovat osa sitä
  -- mitä kopioidaan, eivät julkaisutietoa.
  update lunch_menus
  set status = 'draft',
      published_at = null,
      includes_dessert = v_dessert,
      includes_coffee = v_coffee,
      updated_at = now()
  where id = v_to_menu;

  return v_to_menu;
end;
$$;

revoke all on function copy_lunch_week from public;
grant execute on function copy_lunch_week to authenticated;

-- ---------------------------------------------------------------------------
-- Julkinen haku
-- ---------------------------------------------------------------------------

create or replace function public_lunch_week(p_slug text, p_week_start date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_menu record;
  v_week date;
begin
  select id, name, timezone into v_restaurant
  from restaurants where slug = p_slug;

  if v_restaurant.id is null then
    return null;
  end if;

  v_week := coalesce(
    p_week_start,
    (date_trunc('week', (now() at time zone v_restaurant.timezone)))::date
  );

  select * into v_menu
  from lunch_menus
  where restaurant_id = v_restaurant.id
    and week_start = v_week
    and status = 'published';

  if v_menu.id is null then
    return json_build_object(
      'restaurantName', v_restaurant.name,
      'weekStart', v_week,
      'published', false,
      'prices', '[]'::json,
      'includesDessert', false,
      'includesCoffee', false,
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
    'includesDessert', v_menu.includes_dessert,
    'includesCoffee', v_menu.includes_coffee,
    'prices', coalesce((
      select json_agg(json_build_object('name', p.name, 'cents', p.price_cents)
                      order by p.sort_order, p.name)
      from lunch_prices p where p.menu_id = v_menu.id
    ), '[]'::json),
    'days', coalesce((
      select json_agg(day order by day_date)
      from (
        select
          d.date as day_date,
          json_build_object(
            'date', d.date,
            'items', coalesce((
              select json_agg(json_build_object(
                       'name', i.name,
                       'description', i.description,
                       'diets', coalesce((
                         select json_agg(t.label order by t.sort_order)
                         from lunch_item_diets x
                         join diet_types t on t.id = x.diet_type
                         where x.lunch_item_id = i.id
                       ), '[]'::json),
                       'allergens', coalesce((
                         select json_agg(a.label order by a.sort_order)
                         from lunch_item_allergens y
                         join allergen_types a on a.id = y.allergen_type
                         where y.lunch_item_id = i.id
                       ), '[]'::json)
                     ) order by i.sort_order)
              from lunch_items i where i.lunch_day_id = d.id
            ), '[]'::json)
          ) as day
        from lunch_days d
        where d.menu_id = v_menu.id
      ) rows
    ), '[]'::json)
  );
end;
$$;

revoke all on function public_lunch_week from public;
grant execute on function public_lunch_week to anon, authenticated;


-- ===========================================================================
-- 0024_lunch_theme.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0024 — Julkisen lounassivun teema
-- ---------------------------------------------------------------------------
--
-- Ravintolan valinta, ei viikon. Teema päätetään kerran eikä joka
-- maanantai, joten se on restaurants-taulussa eikä lounasviikossa.
--
-- Tarkistus rajaa arvot kolmeen. Vapaa teksti tarkoittaisi että
-- julkinen sivu voi saada tuntemattoman teeman ja joutuu arvaamaan
-- mitä tehdä — ja arvaus on siinä kohdassa valkoinen sivu.

alter table restaurants add column if not exists lunch_theme text not null
  default 'light';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_lunch_theme_valid'
  ) then
    alter table restaurants add constraint restaurants_lunch_theme_valid
      check (lunch_theme in ('light', 'dark', 'classic'));
  end if;
end;
$$;

/** Asettaa julkisen lounassivun teeman. */
create or replace function set_lunch_theme(p_restaurant uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi vaihtaa teemaa';
  end if;

  if p_theme not in ('light', 'dark', 'classic') then
    raise exception 'Tuntematon teema';
  end if;

  update restaurants
  set lunch_theme = p_theme, updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function set_lunch_theme from public;
grant execute on function set_lunch_theme to authenticated;

-- Näkymään mukaan, jotta hallintasivu tietää valitun teeman ilman
-- omaa kyselyä. Sarake loppuun: create or replace view ei salli
-- järjestyksen muuttamista.
create or replace view my_restaurants
with (security_invoker = true)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug,
  r.lunch_theme
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;


-- ===========================================================================
-- 0025_public_lunch_theme.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0025 — Julkinen haku palauttaa teeman
-- ---------------------------------------------------------------------------
--
-- Sivu tarvitsee teeman ennen kuin se piirtää mitään, joten se tulee
-- samasta kutsusta kuin muukin. Erillinen haku tarkoittaisi että sivu
-- renderöityy kerran ilman teemaa ja välähtää sitten oikeaan.

create or replace function public_lunch_week(p_slug text, p_week_start date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_menu record;
  v_week date;
begin
  select id, name, timezone, lunch_theme into v_restaurant
  from restaurants where slug = p_slug;

  if v_restaurant.id is null then
    return null;
  end if;

  v_week := coalesce(
    p_week_start,
    (date_trunc('week', (now() at time zone v_restaurant.timezone)))::date
  );

  select * into v_menu
  from lunch_menus
  where restaurant_id = v_restaurant.id
    and week_start = v_week
    and status = 'published';

  -- Teema tulee mukaan myös julkaisemattomalle viikolle: "ei julkaistu"
  -- -sivun on näytettävä samalta kuin muunkin sivun.
  if v_menu.id is null then
    return json_build_object(
      'restaurantName', v_restaurant.name,
      'theme', v_restaurant.lunch_theme,
      'weekStart', v_week,
      'published', false,
      'prices', '[]'::json,
      'includesDessert', false,
      'includesCoffee', false,
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'theme', v_restaurant.lunch_theme,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
    'includesDessert', v_menu.includes_dessert,
    'includesCoffee', v_menu.includes_coffee,
    'prices', coalesce((
      select json_agg(json_build_object('name', p.name, 'cents', p.price_cents)
                      order by p.sort_order, p.name)
      from lunch_prices p where p.menu_id = v_menu.id
    ), '[]'::json),
    'days', coalesce((
      select json_agg(day order by day_date)
      from (
        select
          d.date as day_date,
          json_build_object(
            'date', d.date,
            'items', coalesce((
              select json_agg(json_build_object(
                       'name', i.name,
                       'description', i.description,
                       'diets', coalesce((
                         select json_agg(t.label order by t.sort_order)
                         from lunch_item_diets x
                         join diet_types t on t.id = x.diet_type
                         where x.lunch_item_id = i.id
                       ), '[]'::json),
                       'allergens', coalesce((
                         select json_agg(a.label order by a.sort_order)
                         from lunch_item_allergens y
                         join allergen_types a on a.id = y.allergen_type
                         where y.lunch_item_id = i.id
                       ), '[]'::json)
                     ) order by i.sort_order)
              from lunch_items i where i.lunch_day_id = d.id
            ), '[]'::json)
          ) as day
        from lunch_days d
        where d.menu_id = v_menu.id
      ) rows
    ), '[]'::json)
  );
end;
$$;

revoke all on function public_lunch_week from public;
grant execute on function public_lunch_week to anon, authenticated;


-- ===========================================================================
-- 0026_public_lunch_diet_short.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0026 — Ruokavaliot myös lyhenteinä
-- ---------------------------------------------------------------------------
--
-- Julkinen sivu on yksi arkki jossa sama merkintä toistuu joka rivillä.
-- "Gluteeniton" viisitoista kertaa vie tilan ruokien nimiltä; "G" ei.
--
-- Koko sana palautetaan silti, koska sivun alalaidassa on selite
-- käytetyistä lyhenteistä. Pelkkä "G" ilman selitettä olisi tieto jota
-- ei voi lukea.

create or replace function public_lunch_week(p_slug text, p_week_start date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_menu record;
  v_week date;
begin
  select id, name, timezone, lunch_theme into v_restaurant
  from restaurants where slug = p_slug;

  if v_restaurant.id is null then
    return null;
  end if;

  v_week := coalesce(
    p_week_start,
    (date_trunc('week', (now() at time zone v_restaurant.timezone)))::date
  );

  select * into v_menu
  from lunch_menus
  where restaurant_id = v_restaurant.id
    and week_start = v_week
    and status = 'published';

  if v_menu.id is null then
    return json_build_object(
      'restaurantName', v_restaurant.name,
      'theme', v_restaurant.lunch_theme,
      'weekStart', v_week,
      'published', false,
      'prices', '[]'::json,
      'includesDessert', false,
      'includesCoffee', false,
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'theme', v_restaurant.lunch_theme,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
    'includesDessert', v_menu.includes_dessert,
    'includesCoffee', v_menu.includes_coffee,
    'prices', coalesce((
      select json_agg(json_build_object('name', p.name, 'cents', p.price_cents)
                      order by p.sort_order, p.name)
      from lunch_prices p where p.menu_id = v_menu.id
    ), '[]'::json),
    'days', coalesce((
      select json_agg(day order by day_date)
      from (
        select
          d.date as day_date,
          json_build_object(
            'date', d.date,
            'items', coalesce((
              select json_agg(json_build_object(
                       'name', i.name,
                       'description', i.description,
                       'diets', coalesce((
                         select json_agg(json_build_object(
                                  'label', t.label,
                                  'short', nullif(t.short_label, '')
                                ) order by t.sort_order)
                         from lunch_item_diets x
                         join diet_types t on t.id = x.diet_type
                         where x.lunch_item_id = i.id
                       ), '[]'::json),
                       'allergens', coalesce((
                         select json_agg(a.label order by a.sort_order)
                         from lunch_item_allergens y
                         join allergen_types a on a.id = y.allergen_type
                         where y.lunch_item_id = i.id
                       ), '[]'::json)
                     ) order by i.sort_order)
              from lunch_items i where i.lunch_day_id = d.id
            ), '[]'::json)
          ) as day
        from lunch_days d
        where d.menu_id = v_menu.id
      ) rows
    ), '[]'::json)
  );
end;
$$;

revoke all on function public_lunch_week from public;
grant execute on function public_lunch_week to anon, authenticated;


-- ===========================================================================
-- 0027_payroll.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0027 — Palkat
-- ---------------------------------------------------------------------------
--
-- Työntekijän tekemä työ muuttuu palkkakertymäksi ja palkkalaskelmaksi.
--
-- Viisi ratkaisua ohjaa koko tiedostoa.
--
-- 1. SUUNNITELTU AIKA EI OLE PALKKA-AIKA.
--    Vuoron kellonajat ovat suunnitelma. Palkkaan oikeuttaa vain
--    clock_events-tapahtumista johdettu toteutunut aika. Siksi täällä ei
--    ole yhtään kenttää joka kopioisi vuoron suunniteltua aikaa: jos
--    sellainen olisi, joku laskisi jonain päivänä palkan siitä.
--
-- 2. ALKUPERÄISTÄ LEIMAUSTA EI MUUTETA KOSKAAN.
--    Unohtunut ulosleimaus korjataan lisäämällä korjaus, ei
--    kirjoittamalla clock_events-riviä uusiksi. Korjaus kantaa
--    alkuperäiset ajat, uudet ajat, tekijän, hetken ja syyn. Näin
--    palkkalaskelmasta pääsee aina takaisin siihen mitä oikeasti
--    tapahtui — ja siihen kuka päätti toisin.
--
-- 3. PALKKALASKELMA ON TILANNEKUVA.
--    Hyväksytty palkka ei saa muuttua äänettömästi kun vuoroa korjataan
--    jälkikäteen. Rivit ja summat jäädytetään, ja lähtötiedoista
--    lasketaan sormenjälki. Jos se muuttuu hyväksynnän jälkeen,
--    laskelma merkitään uudelleentarkistusta vaativaksi.
--
-- 4. PALKKALAJI ON DATAA, EI KOODIA.
--    Iltalisää ei kovakoodata. Palkkalajilla on arvo, yksikkö,
--    soveltamisikkuna ja voimassaolo. Tämä ei ole TES-moottori eikä
--    yritä olla: se on rakenne joka kattaa tavalliset lisät ilman että
--    uusi lisä vaatii koodimuutoksen.
--
-- 5. LISÄN SUURUUTTA EI ARVATA.
--    Yhtään palkkalajia ei luoda valmiiksi. Keksitty prosentti olisi
--    väärä palkka, ja väärä palkka on pahempi kuin puuttuva ominaisuus.
--    Peruspalkka toimii heti; lisät otetaan käyttöön kun ravintola
--    syöttää oikeat arvot.

-- ---------------------------------------------------------------------------
-- 1. Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type pay_type as enum ('hourly', 'monthly');
exception when duplicate_object then null; end $$;

-- Miten palkkalajin arvo luetaan.
--
--   per_hour  kiinteä euromäärä jokaiselta tunnilta   (1,50 €/h)
--   percent   prosentti peruspalkasta samalta ajalta  (+100 %)
--   fixed     kertakorvaus kaudelta                    (50 €)
do $$ begin
  create type pay_component_unit as enum ('per_hour', 'percent', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_period_status as enum ('open', 'review', 'approved', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payslip_status as enum ('draft', 'review', 'approved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Työntekijän palkkatiedot
-- ---------------------------------------------------------------------------
--
-- hourly_rate_cents on jo olemassa eikä sitä siirretä. Uusi taulu
-- työntekijän palkkatiedoille olisi toinen paikka jossa tuntipalkka
-- asuu, ja kaksi paikkaa ajautuu erilleen.

alter table memberships
  add column if not exists pay_type pay_type not null default 'hourly';

-- Kuukausipalkka sentteinä. Null kun palkkatyyppi on tuntipalkka.
alter table memberships
  add column if not exists monthly_salary_cents integer;

alter table memberships
  drop constraint if exists memberships_salary_matches_type;

-- Kuukausipalkkalainen ilman kuukausipalkkaa saisi nollan palkkaa
-- hiljaisesti. Tuntipalkkalaisen kenttä saa jäädä tyhjäksi.
alter table memberships
  add constraint memberships_salary_matches_type check (
    pay_type <> 'monthly' or monthly_salary_cents is not null
  );

-- ---------------------------------------------------------------------------
-- 3. Palkkalajit
-- ---------------------------------------------------------------------------

create table if not exists pay_components (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  name text not null,

  /*
   * Tunniste tavallisille lisille.
   *
   * Vapaa teksti eikä enum: ravintola saa nimetä oman lisänsä, eikä
   * uusi lisä saa vaatia migraatiota. Tunnetut arvot ovat
   * evening, night, saturday, sunday, overtime, other.
   */
  code text not null default 'other',

  unit pay_component_unit not null,

  /*
   * Arvo yksikkönsä mukaan.
   *
   * per_hour ja fixed sentteinä, percent prosentteina (100 = +100 %).
   * Kaksi saraketta yhden sijaan olisi jättänyt aina toisen tyhjäksi;
   * yksikkö kertoo kumpaa luetaan.
   */
  value numeric(10, 2) not null,

  /*
   * Milloin sovelletaan.
   *
   * weekdays: 1 = maanantai ... 7 = sunnuntai. Tyhjä = kaikki päivät.
   * from_minute / to_minute: minuutteja paikallisesta keskiyöstä.
   *   Null molemmissa = koko vuorokausi.
   *   from > to tarkoittaa keskiyön yli: 23:00-06:00 on 1380 -> 360.
   */
  weekdays smallint[] not null default '{}',
  from_minute smallint,
  to_minute smallint,

  /*
   * Voiko yhdistyä muihin lisiin.
   *
   * Sunnuntai-illan työstä voi kertyä sekä sunnuntai- että iltalisä,
   * mutta ei aina. Kun tämä on false, samalta minuutilta maksetaan
   * vain arvokkain lisä.
   */
  stackable boolean not null default true,

  valid_from date not null default current_date,
  valid_to date,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pay_components_window check (
    (from_minute is null and to_minute is null)
    or (from_minute is not null and to_minute is not null)
  ),
  constraint pay_components_minutes check (
    (from_minute is null or (from_minute >= 0 and from_minute <= 1440))
    and (to_minute is null or (to_minute >= 0 and to_minute <= 1440))
  ),
  constraint pay_components_validity check (valid_to is null or valid_to >= valid_from)
);

create index if not exists pay_components_restaurant_idx
  on pay_components (restaurant_id) where active;

-- ---------------------------------------------------------------------------
-- 4. Palkkakaudet
-- ---------------------------------------------------------------------------
--
-- Kausi on päivävälinä eikä kuukautena. Puolikuukausikausi (1.-15.) on
-- yhtä luonteva kuin kuukausi, eikä kumpikaan ole erikoistapaus.

create table if not exists pay_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  starts_on date not null,
  ends_on date not null,

  status pay_period_status not null default 'open',

  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pay_periods_range check (ends_on >= starts_on),
  constraint pay_periods_unique unique (restaurant_id, starts_on, ends_on)
);

create index if not exists pay_periods_restaurant_idx
  on pay_periods (restaurant_id, starts_on desc);

-- ---------------------------------------------------------------------------
-- 5. Työajan korjaukset
-- ---------------------------------------------------------------------------
--
-- Tämä taulu on koko moduulin omatunto.
--
-- Kun ulosleimaus unohtuu, yrittäjä korjaa toteutuneen ajan. Korjaus ei
-- kirjoita clock_events-riviä uusiksi vaan asettuu sen päälle. Rivi
-- kantaa mitä siellä oli ennen, mitä siihen laitettiin, kuka laittoi,
-- milloin ja miksi.
--
-- Syy on pakollinen eikä valinnainen. Korjaus ilman perustelua on
-- palkkalaskelmassa luku jota kukaan ei osaa selittää.

create table if not exists time_corrections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  /** Päivä ravintolan aikavyöhykkeellä. */
  work_date date not null,

  /** Mitä leimauksista luettiin ennen korjausta. Null jos puuttui. */
  original_in timestamptz,
  original_out timestamptz,
  original_break_minutes integer,

  /** Mitä korjauksen jälkeen käytetään. */
  corrected_in timestamptz not null,
  corrected_out timestamptz not null,
  corrected_break_minutes integer not null default 0,

  reason text not null,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),

  constraint time_corrections_order check (corrected_out > corrected_in),
  constraint time_corrections_break check (corrected_break_minutes >= 0),
  constraint time_corrections_reason check (length(btrim(reason)) > 0),

  /*
   * Yksi voimassa oleva korjaus per työntekijä ja päivä.
   *
   * Toinen korjaus samalle päivälle korvaa edellisen; historia säilyy
   * siinä että korvattu rivi poistetaan vasta kun uusi on tallennettu,
   * ja molemmat näkyvät tarkastuslokissa.
   */
  constraint time_corrections_unique unique (restaurant_id, user_id, work_date)
);

create index if not exists time_corrections_lookup_idx
  on time_corrections (restaurant_id, work_date);

-- ---------------------------------------------------------------------------
-- 6. Palkkalaskelmat
-- ---------------------------------------------------------------------------

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  pay_period_id uuid not null references pay_periods(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  status payslip_status not null default 'draft',

  /*
   * Tuntipalkka talletetaan laskelmaan.
   *
   * Jos se luettaisiin jäsenyydestä, palkankorotus muuttaisi
   * takautuvasti jo maksetut laskelmat.
   */
  hourly_rate_cents integer,
  pay_type pay_type not null default 'hourly',

  worked_minutes integer not null default 0,
  base_cents integer not null default 0,
  supplements_cents integer not null default 0,
  gross_cents integer not null default 0,

  /*
   * Kirjanpidon valmius.
   *
   * Vähennyksiä ja työnantajan kuluja ei lasketa vielä, mutta paikka on
   * olemassa jotta ne eivät myöhemmin vaadi laskelmien uudelleenluontia.
   */
  deductions_cents integer not null default 0,
  employer_cost_cents integer not null default 0,
  cost_center text,

  /*
   * Lähtötietojen sormenjälki.
   *
   * Lasketaan niistä leimauksista, korjauksista ja palkkalajeista
   * joista laskelma syntyi. Jos se ei täsmää nykytilaan, laskelma on
   * vanhentunut ja vaatii uuden tarkistuksen.
   */
  source_fingerprint text not null default '',

  computed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payslips_unique unique (pay_period_id, user_id)
);

create index if not exists payslips_period_idx on payslips (pay_period_id);
create index if not exists payslips_user_idx on payslips (restaurant_id, user_id);

-- ---------------------------------------------------------------------------
-- 7. Palkkalaskelman rivit
-- ---------------------------------------------------------------------------
--
-- Jokainen rivi osoittaa mistä summa tuli: päivä, vuoro, palkkalaji ja
-- mahdollinen korjaus. Ilman näitä viittauksia laskelma on laskin;
-- niiden kanssa se on jäljitettävissä.

create table if not exists payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,

  work_date date not null,

  /** Vuoro josta rivi syntyi. Null jos työtä tehtiin ilman vuoroa. */
  shift_id uuid references shifts(id) on delete set null,

  /** Palkkalaji. Null tarkoittaa peruspalkkaa. */
  pay_component_id uuid references pay_components(id) on delete set null,

  /** Korjaus jonka aikaan rivi perustuu, jos aikaa korjattiin. */
  correction_id uuid references time_corrections(id) on delete set null,

  description text not null,
  minutes integer not null default 0,

  /** Yksikköhinta sentteinä tunnilta, tai prosentti jos laji on percent. */
  rate_cents integer not null default 0,
  amount_cents integer not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists payslip_lines_slip_idx on payslip_lines (payslip_id, work_date);
create index if not exists payslip_lines_shift_idx on payslip_lines (shift_id);

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
--
-- Palkka on henkilötietoa. Työntekijä näkee omansa, esihenkilö kaikki,
-- kirjanpitäjä ei mitään: hän saa kuluraportin kokonaissummina eikä
-- tarvitse yksittäisen ihmisen palkkaa.

alter table pay_components enable row level security;
alter table pay_periods enable row level security;
alter table time_corrections enable row level security;
alter table payslips enable row level security;
alter table payslip_lines enable row level security;

drop policy if exists pay_components_read on pay_components;
create policy pay_components_read on pay_components
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists pay_components_write on pay_components;
create policy pay_components_write on pay_components
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists pay_periods_read on pay_periods;
create policy pay_periods_read on pay_periods
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists pay_periods_write on pay_periods;
create policy pay_periods_write on pay_periods
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

/*
 * Korjauksen näkee se jota se koskee.
 *
 * Työntekijän on voitava tarkistaa millä perusteella hänen työaikaansa
 * muutettiin. Korjauksen saa tehdä vain esihenkilö.
 */
drop policy if exists time_corrections_read on time_corrections;
create policy time_corrections_read on time_corrections
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
  );

drop policy if exists time_corrections_write on time_corrections;
create policy time_corrections_write on time_corrections
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists payslips_read on payslips;
create policy payslips_read on payslips
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
  );

drop policy if exists payslips_write on payslips;
create policy payslips_write on payslips
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists payslip_lines_read on payslip_lines;
create policy payslip_lines_read on payslip_lines
  for select to authenticated
  using (
    payslip_id in (
      select id from payslips
      where user_id = auth.uid() or is_manager(restaurant_id)
    )
  );

drop policy if exists payslip_lines_write on payslip_lines;
create policy payslip_lines_write on payslip_lines
  for all to authenticated
  using (
    payslip_id in (select id from payslips where is_manager(restaurant_id))
  )
  with check (
    payslip_id in (select id from payslips where is_manager(restaurant_id))
  );

-- ---------------------------------------------------------------------------
-- 9. Hyväksytty kausi lukkiutuu
-- ---------------------------------------------------------------------------
--
-- Käytäntö ei riitä tähän: lukitus ei koske sitä kuka saa kirjoittaa
-- vaan sitä milloin. Liipaisin on oikea paikka, koska se pätee myös
-- silloin kun rivi päivitetään jostain muualta kuin sovelluksesta.

create or replace function payslip_locked_when_period_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  period_status pay_period_status;
begin
  select status into period_status
  from pay_periods
  where id = coalesce(new.pay_period_id, old.pay_period_id);

  if period_status in ('approved', 'paid') then
    raise exception 'Palkkakausi on hyväksytty. Avaa kausi ennen muutosta.'
      using errcode = 'check_violation';
  end if;

  -- Poistossa new on null, joten rivi olisi kadonnut paluuarvon mukana.
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists payslips_locked on payslips;
create trigger payslips_locked
  before update or delete on payslips
  for each row
  when (pg_trigger_depth() = 0)
  execute function payslip_locked_when_period_approved();

/*
 * Liipaisinfunktiota ei kutsuta rajapinnasta.
 *
 * Postgres antaa uudelle funktiolle oletuksena suoritusoikeuden
 * kaikille, jolloin se näkyy PostgRESTin /rpc-polulla. Kutsu ei tekisi
 * mitään hyödyllistä ilman liipaisinkontekstia, mutta security definer
 * -funktion ei kuulu olla kutsuttavissa ilman syytä.
 */
revoke all on function payslip_locked_when_period_approved() from public;
revoke all on function payslip_locked_when_period_approved() from anon;
revoke all on function payslip_locked_when_period_approved() from authenticated;

-- ---------------------------------------------------------------------------
-- 10. updated_at
-- ---------------------------------------------------------------------------
--
-- touch_updated_at on jo olemassa aiemmista migraatioista. Sitä ei
-- määritellä tässä uudelleen: identtinenkin uudelleenmäärittely olisi
-- toinen paikka jota pitäisi muistaa muuttaa.

drop trigger if exists pay_components_touch on pay_components;
create trigger pay_components_touch before update on pay_components
  for each row execute function touch_updated_at();

drop trigger if exists pay_periods_touch on pay_periods;
create trigger pay_periods_touch before update on pay_periods
  for each row execute function touch_updated_at();

drop trigger if exists payslips_touch on payslips;
create trigger payslips_touch before update on payslips
  for each row execute function touch_updated_at();


-- ===========================================================================
-- 0028_wage_privacy.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0028 — Tuntipalkka ei vuoda rajapinnasta
-- ---------------------------------------------------------------------------
--
-- Käyttöliittymä on piilottanut tuntipalkat muilta kuin esihenkilöiltä
-- alusta asti: `staff.rates.view` puuttuu työntekijältä ja
-- kirjanpitäjältä. Kanta ei kuitenkaan tiennyt siitä mitään.
--
-- memberships_read-käytäntö sallii jokaisen jäsenen lukea oman
-- ravintolansa jäsenrivit, ja PostgREST tarjoilee ne sellaisenaan:
--
--   GET /rest/v1/memberships?select=user_id,hourly_rate_cents
--
-- Kuka tahansa työntekijä sai näin koko henkilöstön palkat. Piilottaminen
-- näkymässä ei ole suojaus vaan sopimus siitä ettei kukaan katso.
--
-- RIVITASO EI RIITÄ TÄHÄN
--
-- Ilmeisin korjaus olisi rajata käytäntö omaan riviin. Se rikkoisi
-- kaksi asiaa: työkaverien nimet ja tehtävät luetaan samalta riviltä, ja
-- kirjanpitäjä tarvitsee nimet raportteihin. Ongelma ei ole rivi vaan
-- sarake, joten suojaus tehdään sarakkeeseen.

-- ---------------------------------------------------------------------------
-- 1. Sarakeoikeudet
-- ---------------------------------------------------------------------------
--
-- Taulutason lupa poistetaan ja annetaan takaisin sarake kerrallaan.
-- Palkkasarakkeet jäävät listan ulkopuolelle, jolloin PostgREST vastaa
-- niitä pyytävään kyselyyn virheellä eikä datalla.
--
-- Rivitason käytäntö jää voimaan sellaisenaan: jäsen näkee edelleen
-- oman ravintolansa rivit, nyt vain ilman palkkaa.

revoke select on memberships from authenticated;
revoke select on memberships from anon;

grant select (
  id,
  restaurant_id,
  user_id,
  role,
  position,
  active,
  pay_type,
  created_at,
  updated_at
) on memberships to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Oma palkka näkyy edelleen
-- ---------------------------------------------------------------------------
--
-- my_restaurants palauttaa kirjautuneen käyttäjän omat jäsenyydet ja
-- niiden mukana oman tuntipalkan. Näkymä suodattaa jo itse
-- `m.user_id = auth.uid()`, joten se ei voi palauttaa muiden rivejä.
--
-- security_invoker pois: kutsujalla ei ole enää sarakeoikeutta, ja
-- näkymä kaatuisi. Määrittelijän oikeuksin ajettuna näkymän oma
-- where-ehto on ainoa portti — ja se on tiukempi kuin rivikäytäntö.

alter view my_restaurants set (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 3. Esihenkilön pääsy palkkoihin
-- ---------------------------------------------------------------------------
--
-- Sovellus tarvitsee koko henkilöstön palkat kahteen asiaan:
-- palkkalaskentaan ja työvoimakustannuksen arvioon. Molemmat ovat
-- esihenkilön näkymiä.
--
-- Funktio palauttaa tyhjän jos kutsuja ei ole omistaja tai
-- vuoropäällikkö. Ei virhettä vaan tyhjä: kutsuva koodi käsittelee jo
-- puuttuvan palkan (`hourlyRateCents: number | null`), ja kirjanpitäjän
-- raportti jättää palkkasarakkeen pois omalla ehdollaan.

create or replace function staff_pay_rates(p_restaurant uuid)
returns table (
  user_id uuid,
  hourly_rate_cents int,
  monthly_salary_cents int,
  pay_type pay_type
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.hourly_rate_cents, m.monthly_salary_cents, m.pay_type
  from memberships m
  where m.restaurant_id = p_restaurant
    and m.active
    and is_manager(p_restaurant);
$$;

revoke all on function staff_pay_rates(uuid) from public;
grant execute on function staff_pay_rates(uuid) to authenticated;


-- ===========================================================================
-- 0029_clock_requires_shift.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0029 — Leimaus vaatii työvuoron
-- ---------------------------------------------------------------------------
--
-- Työvuoro kertoo milloin työntekijän on tarkoitus olla töissä. Tähän
-- asti leimaus ei tiennyt vuoroista mitään: kuka tahansa jäsen sai
-- kirjata työaikaa mihin aikaan tahansa, myös suoraan rajapinnasta.
--
-- Sääntö on nyt: ei vuoroa, ei sisäänleimausta.
--
-- SÄÄNTÖ ON KANNASSA EIKÄ VAIN NÄKYMÄSSÄ
--
-- Käyttöliittymä piilottaa painikkeen, mutta piilotettu painike ei ole
-- este. Tarkistus tehdään täällä, ja näkymä vain kertoo saman asian
-- ennakolta.
--
-- KOSKEE MYÖS ESIHENKILÖÄ
--
-- Ei poikkeusta roolin perusteella. Omistaja joka tekee vuoron itselleen
-- on kahden klikkauksen päässä, ja poikkeus tarkoittaisi että sääntö
-- pitää muistaa erikseen joka paikassa jossa työaikaa luetaan.
--
-- ULOSLEIMAUS EI VAADI VUOROA
--
-- Sisään päässyt on päästävä ulos. Jos vuoro perutaan kesken työn tai
-- työ venyy yli vuoron lopun, uloskirjauksen estäminen jättäisi
-- työajan auki — ja auki jäänyt työaika kasvaa itsestään.

-- ---------------------------------------------------------------------------
-- 1. Kuinka aikaisin vuoroon saa leimata
-- ---------------------------------------------------------------------------
--
-- Täsmälleen vuoron alkuhetkellä painaminen olisi kohtuuton vaatimus:
-- töihin tullaan hetkeä ennen. Ravintolakohtainen, koska käytännöt
-- eroavat.

alter table restaurants
  add column if not exists clock_in_early_minutes smallint not null default 30;

alter table restaurants
  drop constraint if exists restaurants_early_minutes_range;

alter table restaurants
  add constraint restaurants_early_minutes_range
  check (clock_in_early_minutes >= 0 and clock_in_early_minutes <= 240);

-- ---------------------------------------------------------------------------
-- 2. Leimaus
-- ---------------------------------------------------------------------------

create or replace function record_clock_event(
  p_restaurant uuid,
  p_type clock_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := 'off';
  v_row record;
  v_id uuid;
  v_tz text;
  v_early int;
  v_local timestamp;
  v_day_start timestamptz;
  v_has_shift boolean;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  select timezone, clock_in_early_minutes
    into v_tz, v_early
  from restaurants where id = p_restaurant;

  if v_tz is null then
    raise exception 'Ravintolaa ei löytynyt';
  end if;

  /*
   * Vuorokausi ravintolan ajassa, ei UTC:ssä.
   *
   * Aiemmin tässä luki date_trunc('day', now()), mikä on UTC-keskiyö.
   * Helsingissä klo 01:50 tehty leimaus kuuluu paikalliselle päivälle,
   * mutta edelliselle UTC-päivälle — tila laskettiin väärän päivän
   * tapahtumista, ja yövuorolainen sai "leimaus ei ole mahdollinen".
   */
  v_local := now() at time zone v_tz;
  v_day_start := (date_trunc('day', v_local)) at time zone v_tz;

  for v_row in
    select event_type from clock_events
    where user_id = v_user
      and restaurant_id = p_restaurant
      and occurred_at >= v_day_start
    order by occurred_at
  loop
    v_state := case
      when v_row.event_type = 'in' and v_state = 'off' then 'working'
      when v_row.event_type = 'break_start' and v_state = 'working' then 'on_break'
      when v_row.event_type = 'break_end' and v_state = 'on_break' then 'working'
      when v_row.event_type = 'out' then 'off'
      else v_state
    end;
  end loop;

  if not (
    (p_type = 'in' and v_state = 'off')
    or (p_type = 'break_start' and v_state = 'working')
    or (p_type = 'break_end' and v_state = 'on_break')
    or (p_type = 'out' and v_state in ('working', 'on_break'))
  ) then
    raise exception 'Leimaus ei ole mahdollinen nykyisessä tilassa (%)', v_state;
  end if;

  /*
   * Sisäänleimaus vaatii voimassa olevan vuoron.
   *
   * Ikkuna alkaa clock_in_early_minutes ennen vuoron alkua ja päättyy
   * vuoron loppuun. Yön yli menevä vuoro tunnistetaan siitä että
   * lopetusaika ei ole aloitusaikaa myöhempi, jolloin loppu on
   * seuraavana päivänä — siksi haku kattaa myös eilisen vuoron.
   *
   * Sama sääntö on TypeScriptissä lib/restoflow/shift-window.ts:ssä,
   * joka päättää mitä käyttöliittymä näyttää. Tämä on se joka ratkaisee.
   */
  if p_type = 'in' then
    select exists (
      select 1
      from shifts s
      where s.user_id = v_user
        and s.restaurant_id = p_restaurant
        and s.status <> 'declined'
        and s.shift_date between (v_local::date - 1) and v_local::date
        and v_local >= (s.shift_date + s.start_time) - make_interval(mins => v_early)
        and v_local < (
          case
            when s.end_time > s.start_time then s.shift_date + s.end_time
            else s.shift_date + s.end_time + interval '1 day'
          end
        )
    ) into v_has_shift;

    if not v_has_shift then
      raise exception 'Ei voimassa olevaa työvuoroa';
    end if;
  end if;

  insert into clock_events (restaurant_id, user_id, event_type)
  values (p_restaurant, v_user, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_clock_event from public;
grant execute on function record_clock_event to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Varhaisraja istuntoon
-- ---------------------------------------------------------------------------
--
-- Näkymä kantaa jo ravintolan asetukset istuntoon. Varhaisraja tulee
-- samaa reittiä, jotta etusivu voi kertoa milloin leimaus avautuu ilman
-- omaa kyselyä.
--
-- security_invoker = false säilytetään migraatiosta 0028: kutsujalla ei
-- ole sarakeoikeutta tuntipalkkaan, ja näkymän oma where-ehto rajaa jo
-- omaan riviin.

create or replace view my_restaurants
with (security_invoker = false)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug,
  r.lunch_theme,
  r.clock_in_early_minutes
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;


-- ===========================================================================
-- 0030_workplace.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0030 — Työyhteisö
-- ---------------------------------------------------------------------------
--
-- Työntekijä näkee ketkä ovat hänen työkavereitaan ja kenellä on tänään
-- syntymäpäivä. Ei sosiaalinen verkosto: nimi, tehtävä, ja päivä.
--
-- SYNTYMÄVUOTTA EI TALLENNETA
--
-- Vaatimus oli ettei vuotta näytetä. Sen olisi voinut toteuttaa
-- piilottamalla vuosi näkymässä, mutta silloin se olisi silti kannassa
-- ja rajapinnan takana — ja juuri se ero UI:n ja kannan välillä on se
-- mikä palkoissa piti korjata erikseen (migraatio 0028).
--
-- Päivä ja kuukausi erillisinä lukuina. Budet ei tarvitse ikää mihinkään,
-- joten sitä ei kysytä. Tietoa jota ei ole ei voi vuotaa.

alter table profiles add column if not exists birth_day smallint;
alter table profiles add column if not exists birth_month smallint;

alter table profiles drop constraint if exists profiles_birthday_valid;

/*
 * Molemmat tai ei kumpaakaan, ja päivä kuukauden mukaan.
 *
 * 29.2. sallitaan: karkauspäivänä syntynyt on olemassa, eikä vuoden
 * puuttuminen saa tehdä hänestä mahdotonta.
 */
alter table profiles add constraint profiles_birthday_valid check (
  (birth_day is null and birth_month is null)
  or (
    birth_month between 1 and 12
    and birth_day between 1 and
      case birth_month
        when 2 then 29
        when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
        else 31
      end
  )
);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- profiles_read sallii jo saman ravintolan jäsenten lukea toistensa
-- profiilit. Uudet sarakkeet kulkevat samaa reittiä, eikä erillistä
-- käytäntöä tarvita: päivä ja kuukausi ovat juuri se tieto joka on
-- tarkoituskin näyttää työkavereille.
--
-- Muiden ravintoloiden työntekijät eivät näy, koska käytäntö vaatii
-- yhteisen jäsenyyden. Se on tarkistettu erikseen alla olevassa
-- testissä eikä oletettu.


-- ===========================================================================
-- 0031_profiles_policy_recursion.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0031 — Oman profiilin päivitys ei enää kaadu rekursioon
-- ---------------------------------------------------------------------------
--
-- Oman nimen tallennus asetuksissa palautti:
--
--   42P17  infinite recursion detected in policy for relation "profiles"
--
-- Luku toimi, kirjoitus ei. Toiminto oli siis rikki niin kauan kuin se
-- on ollut olemassa, ja vika löytyi vasta kun syntymäpäivän tallennusta
-- testattiin oikeaa rajapintaa vasten eikä käyttöliittymän läpi.
--
-- SYY
--
-- profiles_update_self -käytännön with check -lauseke teki alikyselyn
-- samaan tauluun jota se suojasi:
--
--   is_super_admin = (select is_super_admin from profiles where id = auth.uid())
--
-- Jokainen päivitys joutui siis tarkistamaan käytännön, joka luki
-- taulua, mikä tarkisti käytännön. Postgres katkaisee kierteen
-- virheeseen.
--
-- AIKOMUS OLI OIKEA, KEINO EI
--
-- Lauseke yritti estää käyttäjää nostamasta itseään pääkäyttäjäksi.
-- Rivitason suojaus ei voi verrata uutta riviä vanhaan — with check
-- näkee vain uuden — joten vertailu piti hakea kannasta, ja siitä
-- kierre syntyi.
--
-- Sama sääntö sarakeoikeutena on sekä yksinkertaisempi että tiukempi:
-- kenttää ei voi kirjoittaa lainkaan, joten sen arvoa ei tarvitse
-- verrata mihinkään.

-- ---------------------------------------------------------------------------
-- 1. Rekursoiva käytäntö pois
-- ---------------------------------------------------------------------------
--
-- Käytännön using-ehto on sama kuin profiles_update_own -käytännössä
-- (id = auth.uid()), joten pääsysääntö ei muutu. Vain rikkinäinen
-- lisäehto katoaa.

drop policy if exists profiles_update_self on profiles;

-- ---------------------------------------------------------------------------
-- 2. Suojattu kenttä sarakeoikeudella
-- ---------------------------------------------------------------------------
--
-- Käyttäjä saa muuttaa omia tietojaan mutta ei pääkäyttäjälippuaan.
-- is_super_admin jää listan ulkopuolelle, jolloin sitä koskeva
-- päivitys hylätään oikeuspuutteena eikä käytäntötarkistuksena.

revoke update on profiles from authenticated;

grant update (
  full_name,
  avatar_url,
  locale,
  birth_day,
  birth_month
) on profiles to authenticated;


-- ===========================================================================
-- 0032_invitation_preview.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0032 — Kutsukoodi ennen tunnusta
-- ---------------------------------------------------------------------------
--
-- Kutsuttu työntekijä joutui ensin luomaan tunnuksen ja vasta sitten
-- syöttämään koodin. Järjestys oli väärin päin: hän ei tiedä mihin on
-- liittymässä ennen kuin on jo antanut sähköpostinsa ja salasanansa, ja
-- väärällä koodilla koko tunnus jäi roikkumaan tyhjään.
--
-- Koodi kysytään nyt ensin. Sitä varten tarvitaan tapa tarkistaa koodi
-- ilman kirjautumista.
--
-- MITÄ FUNKTIO PALJASTAA
--
-- Vain sen mitä kutsuttu tarvitsee nähdäkseen liittyvänsä oikeaan
-- paikkaan: ravintolan nimi ja tuleva tehtävä. Ei tuntipalkkaa, ei
-- kutsujan nimeä, ei muita jäseniä.
--
-- Väärä koodi palauttaa tyhjän. Ei virhettä eikä vihjettä siitä oliko
-- koodi olemassa mutta käytetty vai olematon — molemmista saa saman
-- vastauksen, jottei funktiolla voi kartoittaa koodeja.
--
-- Koodi itse on ainoa salaisuus, ja se on tallessa vain tiivisteenä.
-- Sama pinta on ollut olemassa accept_invitationissa alusta asti; tämä
-- ei avaa uutta reittiä vaan saman reitin lukevan version.

drop function if exists preview_invitation(text);

create function preview_invitation(p_code text)
returns table (
  restaurant_name text,
  role app_role,
  "position" staff_position
)
language sql
stable
security definer
set search_path = public
as $$
  select r.name, i.role, i.position
  from restaurant_invitations i
  join restaurants r on r.id = i.restaurant_id
  where i.code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex')
    and i.accepted_at is null
    and i.expires_at >= now();
$$;

revoke all on function preview_invitation(text) from public;
grant execute on function preview_invitation(text) to anon;
grant execute on function preview_invitation(text) to authenticated;


-- ===========================================================================
-- 0033_daily_sales.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0033 — Päivän myynti
-- ---------------------------------------------------------------------------
--
-- Budet ei ole nähnyt myyntiä, ja siksi se ei ole voinut sanoa mitään
-- kannattavuudesta, työvoiman osuudesta eikä siitä oliko päivä hyvä.
-- Kulut yksin kertovat mihin rahat menivät muttei kannattiko se.
--
-- YKSI LUKU PÄIVÄSSÄ, EI KASSAJÄRJESTELMÄ
--
-- Tämä ei ole kassa eikä tilaustenhallinta. Yksi kenttä johon
-- kirjataan illan päätteeksi kassan päiväraportin summa. Se riittää
-- kaikkeen mitä ohjauspaneeli tarvitsee, eikä vaadi integraatiota
-- joltakin toiselta järjestelmältä.
--
-- VEROTON SUMMA
--
-- Työvoiman osuus myynnistä on ravintola-alan tunnusluku, ja se
-- lasketaan verottomasta myynnistä. Verollisella summalla suhdeluku
-- olisi järjestelmällisesti liian pieni — ruoan ALV on 14 % ja alkoholin
-- 25,5 %, joten virhe vaihtelisi vielä päivittäin myynnin rakenteen
-- mukaan.
--
-- Kassan päiväraportti näyttää verottoman summan, joten kenttä ei vaadi
-- laskutoimitusta. Käyttöliittymä sanoo sen ääneen.
--
-- TAVOITE ON VAPAAEHTOINEN
--
-- Tavoitteeton päivä vertautuu saman viikonpäivän historiaan. Se on
-- parempi vertailukohta kuin keksitty tavoite: maanantai ei ole
-- perjantai, eikä kumpaakaan pidä verrata keskiarvoon.

create table if not exists daily_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  /** Myyntipäivä ravintolan aikavyöhykkeellä. */
  sales_date date not null,

  /** Veroton myynti sentteinä. */
  net_sales_cents integer not null,

  /** Päivän tavoite, jos sellainen on asetettu. */
  target_cents integer,

  note text,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_sales_positive check (net_sales_cents >= 0),
  constraint daily_sales_target_positive check (target_cents is null or target_cents >= 0),

  /*
   * Yksi rivi per päivä.
   *
   * Kaksi riviä samalle päivälle tarkoittaisi että päivän myynti
   * riippuu siitä kumman kysely löytää ensin.
   */
  constraint daily_sales_unique unique (restaurant_id, sales_date)
);

create index if not exists daily_sales_lookup_idx
  on daily_sales (restaurant_id, sales_date desc);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Myynti on liiketoimintatietoa: omistaja, vuoropäällikkö ja
-- kirjanpitäjä näkevät sen, työntekijä ei. Sama rajaus kuin muullakin
-- taloustiedolla, joten käytetään samaa funktiota.
--
-- Kirjaaminen on esihenkilön työ. Kirjanpitäjä lukee muttei kirjaa.

alter table daily_sales enable row level security;

drop policy if exists daily_sales_read on daily_sales;
create policy daily_sales_read on daily_sales
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists daily_sales_write on daily_sales;
create policy daily_sales_write on daily_sales
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists daily_sales_touch on daily_sales;
create trigger daily_sales_touch before update on daily_sales
  for each row execute function touch_updated_at();


-- ===========================================================================
-- 0034_claim_open_shift.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0034 — Avoimen vuoron ottaminen
-- ---------------------------------------------------------------------------
--
-- Avoin vuoro on olemassa siksi, että ravintolalta puuttuu tekijä.
-- Tähän asti työntekijä ei nähnyt niitä eikä voinut tehdä niille
-- mitään: esihenkilö sai hälytyksen "vuorolle ei ole tekijää", ja
-- silmukka päättyi siihen.
--
-- Sääntö on nyt: työntekijä ottaa avoimen vuoron itselleen, ja kanta
-- ratkaisee saako hän.
--
-- EI HYVÄKSYNTÄKIERROSTA
--
-- Ilmoittautuminen jonka esihenkilö vahvistaa tuo viiveen juuri siihen
-- kohtaan jossa hälytys sanoi että asia on kiireellinen. Riski ei ole
-- se kuka ottaa vuoron vaan se että vuoro luo päällekkäisyyden — ja se
-- on sääntö, ei harkintaa.
--
-- KILPAJUOKSU RATKAISTAAN PÄIVITYKSESSÄ
--
-- Kaksi työntekijää voi painaa samalla sekunnilla. Tarkistus ennen
-- päivitystä ei riitä: molemmat läpäisisivät sen. Ehto "user_id is
-- null" on siksi itse UPDATE-lauseessa, ja häviäjä saa selkeän
-- virheen sen sijaan että kirjoittaisi voittajan päälle.
--
-- LEPOAIKA EI OLE ESTO
--
-- Työaikalain 11 tunnin lepoaika on merkintä esihenkilölle, ei este.
-- Esto tarkoittaisi että kanta kieltäytyy katteesta jonka esihenkilö
-- olisi hyväksynyt. Päällekkäisyys sen sijaan on aina virhe: ihminen
-- ei voi olla kahdessa paikassa.

-- ---------------------------------------------------------------------------
-- 1. Katkaisin
-- ---------------------------------------------------------------------------
--
-- Ravintolakohtainen, koska käytännöt eroavat. Oletus päällä: se on
-- syy jonka takia ominaisuus on olemassa.

alter table restaurants
  add column if not exists open_shift_claiming boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Ottaminen
-- ---------------------------------------------------------------------------

create or replace function claim_open_shift(p_shift uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_shift record;
  v_tz text;
  v_enabled boolean;
  v_position staff_position;
  v_local timestamp;
  v_starts timestamp;
  v_ends timestamp;
  v_overlap boolean;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select id, restaurant_id, user_id, shift_date, start_time, end_time, position
    into v_shift
  from shifts
  where id = p_shift;

  if v_shift.id is null then
    raise exception 'Työvuoroa ei löytynyt';
  end if;

  select timezone, open_shift_claiming
    into v_tz, v_enabled
  from restaurants
  where id = v_shift.restaurant_id;

  if v_tz is null then
    raise exception 'Ravintolaa ei löytynyt';
  end if;

  if not v_enabled then
    raise exception 'Vuorojen ottaminen ei ole käytössä';
  end if;

  select position into v_position
  from memberships
  where user_id = v_user
    and restaurant_id = v_shift.restaurant_id
    and active;

  if not found then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  /*
   * Asema ratkaisee.
   *
   * Käyttöliittymä näyttää vain oman aseman vuorot, joten tämä ei
   * tavallisesti näy kenellekään. Sääntö on silti täällä: piilotettu
   * rivi ei ole este sille joka kutsuu rajapintaa suoraan.
   */
  if v_shift.position is not null and v_shift.position is distinct from v_position then
    raise exception 'Työvuoro on toiselle asemalle';
  end if;

  if v_shift.user_id is not null then
    raise exception 'Työvuorolla on jo tekijä';
  end if;

  /*
   * Vuoron alku ja loppu ravintolan ajassa.
   *
   * Yön yli menevä vuoro tunnistetaan siitä ettei lopetusaika ole
   * aloitusaikaa myöhempi. Sama tunnistus on record_clock_event-
   * funktiossa ja lib/restoflow/shift-window.ts:ssä.
   */
  v_local := now() at time zone v_tz;
  v_starts := v_shift.shift_date + v_shift.start_time;
  v_ends := case
    when v_shift.end_time > v_shift.start_time
      then v_shift.shift_date + v_shift.end_time
    else v_shift.shift_date + v_shift.end_time + interval '1 day'
  end;

  /*
   * Päättynyttä vuoroa ei voi ottaa. Kesken olevan voi: jos joku ei
   * tullut, vuoro on juuri se joka pitää saada tehdyksi.
   */
  if v_ends <= v_local then
    raise exception 'Työvuoro on jo päättynyt';
  end if;

  select exists (
    select 1
    from shifts s
    where s.user_id = v_user
      and s.restaurant_id = v_shift.restaurant_id
      and s.status <> 'declined'
      and s.shift_date between (v_shift.shift_date - 1) and (v_shift.shift_date + 1)
      and (s.shift_date + s.start_time) < v_ends
      and (
        case
          when s.end_time > s.start_time then s.shift_date + s.end_time
          else s.shift_date + s.end_time + interval '1 day'
        end
      ) > v_starts
  ) into v_overlap;

  if v_overlap then
    raise exception 'Sinulla on jo työvuoro samaan aikaan';
  end if;

  /*
   * Ehto on lauseessa eikä sen edessä. Kaksi samanaikaista ottajaa
   * läpäisisivät erillisen tarkistuksen molemmat.
   *
   * Tila on accepted: työntekijä valitsi vuoron itse, joten suostumus
   * on vahvempi kuin esihenkilön merkitsemässä vuorossa.
   */
  update shifts
     set user_id = v_user,
         status = 'accepted',
         updated_at = now()
   where id = p_shift
     and user_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Joku ehti ensin';
  end if;

  return v_id;
end;
$$;

revoke all on function claim_open_shift from public;
grant execute on function claim_open_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Asetus istuntoon
-- ---------------------------------------------------------------------------
--
-- Näkymä kantaa ravintolan asetukset istuntoon, jotta työntekijän
-- näkymä tietää näyttääkö avoimia vuoroja ollenkaan.
--
-- Uusi sarake tulee loppuun. create or replace view ei voi lisätä
-- saraketta keskelle eikä muuttaa järjestystä — se on virhe eikä
-- muutos, ja se huomataan vasta ajossa.
--
-- security_invoker = false säilytetään migraatiosta 0028: kutsujalla ei
-- ole sarakeoikeutta tuntipalkkaan, ja näkymän oma where-ehto rajaa jo
-- omaan riviin.

create or replace view my_restaurants
with (security_invoker = false)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug,
  r.lunch_theme,
  r.clock_in_early_minutes,
  r.open_shift_claiming
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Katkaisin asetuksiin
-- ---------------------------------------------------------------------------
--
-- Uusi parametri vaatii pudotuksen: lisätty parametri ei korvaa vanhaa
-- funktiota vaan luo ylikuormituksen, ja nimetty kutsu jäisi
-- monitulkintaiseksi.

drop function if exists update_restaurant(uuid, text, text);

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text,
  p_timezone text,
  p_open_shift_claiming boolean
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

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  update restaurants
  set name = trim(p_name),
      timezone = p_timezone,
      open_shift_claiming = coalesce(p_open_shift_claiming, open_shift_claiming),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;


-- ===========================================================================
-- 0035_settings_partial_update.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Asetukset: osittainen päivitys ja leimausikkuna säädettäväksi
-- ---------------------------------------------------------------------------
--
-- 1. OSITTAINEN PÄIVITYS
--
-- Asetussivu jakautuu osioihin, ja jokainen osio on oma lomakkeensa.
-- Vanha funktio kirjoitti aina kaikki kentät, joten "Ravintolan nimi"
-- -lomake olisi tyhjentänyt aikavyöhykkeen ja nollannut
-- vuoroasetukset — kenttä jota lomake ei näytä ei saa muuttua sen
-- lähettämisestä.
--
-- Null tarkoittaa nyt "älä koske". Jokainen parametri on
-- oletusarvoltaan null, joten kutsuja lähettää vain sen mitä muuttaa.
--
-- 2. LEIMAUSIKKUNA
--
-- clock_in_early_minutes on ollut kannassa migraatiosta 0029 asti ja
-- record_clock_event lukee sitä, mutta sitä ei ole voinut muuttaa
-- mistään. Oletus 30 minuuttia on ollut siis lukittu arvo eikä
-- asetus. Nyt se on asetus.
--
-- Uusi parametri vaatii pudotuksen: lisätty parametri ei korvaa vanhaa
-- funktiota vaan luo ylikuormituksen, ja nimetty kutsu jäisi
-- monitulkintaiseksi.

drop function if exists update_restaurant(uuid, text, text, boolean);

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null,
  p_open_shift_claiming boolean default null,
  p_clock_in_early_minutes smallint default null
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

  -- Sama raja kuin sarakkeen check-ehdossa. Tarkistus on tässäkin,
  -- jotta virhe on luettava lause eikä rajoitteen nimi.
  if p_clock_in_early_minutes is not null
     and (p_clock_in_early_minutes < 0 or p_clock_in_early_minutes > 240) then
    raise exception 'Leimausikkuna on 0–240 minuuttia';
  end if;

  update restaurants
  set name = coalesce(trim(p_name), name),
      timezone = coalesce(p_timezone, timezone),
      open_shift_claiming = coalesce(p_open_shift_claiming, open_shift_claiming),
      clock_in_early_minutes =
        coalesce(p_clock_in_early_minutes, clock_in_early_minutes),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;


-- ===========================================================================
-- 0036_sales_report.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0036 — Kassan päiväraportti
-- ---------------------------------------------------------------------------
--
-- Päivän myynti on kirjattu käsin yhtenä lukuna. Luku on oikea mutta
-- sen ympäriltä on jäänyt pois kaikki mitä kassan päiväraportissa jo
-- lukee: verollinen summa, ALV ja kuittien määrä.
--
-- Kuitti kuvataan ja poimitaan. Päiväraportti on sama paperi samasta
-- tulostimesta, ja se on kirjattu käsin. Nyt sekin kuvataan.
--
-- MITÄ TALLENNETAAN
--
-- Vain se mitä raportissa lukee ja mitä joku katsoo:
--
--   veroton   — oli jo. Työvoiman osuus lasketaan tästä.
--   verollinen — mitä asiakas maksoi.
--   alv        — erotus, ja samalla tarkiste: netto + alv = brutto.
--   tapahtumat — kuittien määrä. Antaa keskiostoksen.
--
-- Maksutapajakauma (kortti/käteinen) jää pois. Se on raportissa, mutta
-- Budet ei tee siitä mitään: pankkiyhteyttä ei ole eikä kassan
-- täsmäytystä. Kenttä jota kukaan ei lue on kenttä joka vanhenee.
--
-- KAIKKI UUDET SARAKKEET OVAT VAPAAEHTOISIA
--
-- Käsin kirjattu päivä on yhä kelvollinen: yksi luku riittää. Uudet
-- kentät täyttyvät kun raportti kuvataan, eivätkä ne saa muuttua
-- pakoksi vanhoille riveille.

alter table daily_sales
  add column if not exists gross_sales_cents integer;

alter table daily_sales
  add column if not exists vat_cents integer;

alter table daily_sales
  add column if not exists transactions integer;

/*
 * Mistä rivi on peräisin.
 *
 * "Kirjattu käsin" ja "luettu raportista" ovat eri luotettavuutta, ja
 * ero on nähtävä myöhemmin — muuten ei voi tietää kannattaako lukua
 * epäillä kun se ei täsmää kirjanpitoon.
 */
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_source') then
    create type sales_source as enum ('manual', 'report');
  end if;
end
$$;

alter table daily_sales
  add column if not exists source sales_source not null default 'manual';

-- ---------------------------------------------------------------------------
-- Rajoitteet
-- ---------------------------------------------------------------------------

alter table daily_sales drop constraint if exists daily_sales_gross_positive;
alter table daily_sales add constraint daily_sales_gross_positive
  check (gross_sales_cents is null or gross_sales_cents >= 0);

alter table daily_sales drop constraint if exists daily_sales_vat_positive;
alter table daily_sales add constraint daily_sales_vat_positive
  check (vat_cents is null or vat_cents >= 0);

alter table daily_sales drop constraint if exists daily_sales_transactions_positive;
alter table daily_sales add constraint daily_sales_transactions_positive
  check (transactions is null or transactions >= 0);

/*
 * Verollinen ei voi olla verotonta pienempi.
 *
 * Tämä on ainoa suhde joka on aina tosi ALV-kannasta riippumatta.
 * Tarkempi ehto (netto + alv = brutto) jätetään sovellukseen, koska
 * kassan pyöristykset tekevät siitä toisinaan sentin sivussa — ja
 * sentin takia hylätty päiväraportti olisi huonompi kuin merkintä
 * siitä että luvut eivät täsmää.
 */
alter table daily_sales drop constraint if exists daily_sales_gross_gte_net;
alter table daily_sales add constraint daily_sales_gross_gte_net
  check (gross_sales_cents is null or gross_sales_cents >= net_sales_cents);


-- ===========================================================================
-- 0037_sales_groups_vat.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0037 — Myyntiryhmät, verokannat ja kassaryhmien kohdistus
-- ---------------------------------------------------------------------------
--
-- Päivän myynti on ollut yksi luku ja yksi ALV-summa. Kassan
-- päiväraportti ei ole: siinä myynti on jaettu ryhmiin ja jokaisella
-- ryhmällä on oma verokantansa. Ilman samaa jakoa Budet ei voi
-- täsmäytyä raporttiin — se voi vain todeta että loppusumma on sama
-- tai eri, eikä kertoa mistä ero syntyy.
--
-- YKSI YLEINEN "RAVINTOLAN ALV %" EI RIITÄ
--
-- Ravintolassa on samana päivänä kaksi tai kolme kantaa: ruoka,
-- alkoholi ja mahdollinen nollakanta. Yksi kenttä pakottaisi
-- keskiarvoon, joka ei ole mikään verokanta.
--
-- HISTORIALLINEN KANTA SÄILYY TAPAHTUMASSA
--
-- Verokanta muuttuu lainsäädännöllä. Jos rivi viittaisi vain
-- ryhmään, ryhmän kannan muuttaminen kirjoittaisi menneisyyden
-- uudelleen: viime vuoden raportti näyttäisi eri luvut kuin silloin
-- kun se lähetettiin kirjanpitoon.
--
-- Siksi jokainen myyntirivi tallentaa käytetyn kannan lukuna. Ryhmän
-- asetus kertoo mitä kantaa UUSI rivi käyttää; vanha rivi kantaa
-- omansa mukanaan eikä muutu koskaan.

-- ---------------------------------------------------------------------------
-- 1. Myyntiryhmät
-- ---------------------------------------------------------------------------

create table if not exists sales_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  name text not null check (length(trim(name)) > 0),

  /*
   * Verokanta osuutena: 0.14000 = 14 %.
   *
   * numeric eikä float. Liukuluku ei esitä 0,255:tä tarkasti, ja
   * verolaskennan on oltava toistettavissa bitilleen samana.
   *
   * Viisi desimaalia riittää: 25,5 % on 0.25500 ja hienojakoisempaa
   * kantaa ei ole olemassa.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate <= 1),

  /* Pois käytöstä otettu ryhmä ei katoa: vanhat rivit viittaavat siihen. */
  active boolean not null default true,

  /*
   * Oletusryhmä.
   *
   * Kassaraportin ryhmä jota ei ole kohdistettu päätyy tänne, jottei
   * myynti katoa kohdistamattomuuden takia. Osittainen kirjaus on
   * pahempi kuin kohdistamaton: loppusumma ei enää täsmää.
   */
  is_default boolean not null default false,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, name)
);

/*
 * Yksi oletus per ravintola.
 *
 * Osittainen indeksi eikä check-ehto: ehto näkee vain oman rivinsä,
 * eikä voi tietää onko toinen oletus jo olemassa.
 */
create unique index if not exists sales_groups_one_default
  on sales_groups (restaurant_id)
  where is_default;

create index if not exists sales_groups_lookup
  on sales_groups (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. Kassajärjestelmän ryhmien kohdistus
-- ---------------------------------------------------------------------------
--
-- Kassa tuntee omat nimensä: "Ruoka", "Viini", "Olut", "Take away".
-- Budet tuntee myyntiryhmät. Kohdistus on ravintolakohtainen, koska
-- kaksi ravintolaa nimeää samat asiat eri tavoin.

create table if not exists pos_sales_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Nimi sellaisena kuin se lukee kassan raportissa. */
  pos_name text not null check (length(trim(pos_name)) > 0),

  sales_group_id uuid not null references sales_groups (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /*
   * Sama kassaryhmä voi osoittaa vain yhteen myyntiryhmään.
   *
   * Kaksi kohdistusta samalle nimelle tarkoittaisi että myynnin
   * verokanta riippuu siitä kumman kysely löytää ensin.
   */
  unique (restaurant_id, pos_name)
);

-- ---------------------------------------------------------------------------
-- 3. Päivän myynti ryhmittäin
-- ---------------------------------------------------------------------------
--
-- daily_sales pysyy päivän yhteenvetona. Rivit kertovat mistä se
-- koostuu, ja vain rivit mahdollistavat täsmäytyksen kannoittain.

create table if not exists daily_sales_lines (
  id uuid primary key default gen_random_uuid(),

  daily_sales_id uuid not null references daily_sales (id) on delete cascade,
  sales_group_id uuid not null references sales_groups (id) on delete restrict,

  /*
   * Kannan luku tapahtumahetkellä.
   *
   * Tämä on rivin totuus. Ryhmän nykyinen kanta on vain oletus uusille
   * riveille — vanhan rivin verokanta ei muutu ryhmää muokkaamalla.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate <= 1),

  /*
   * Brutto on syöte, muut johdettuja.
   *
   * Kassaraportti antaa ryhmän myynnin verollisena. Vero ja veroton
   * lasketaan siitä keskitetyllä pyöristyssäännöllä ja tallennetaan,
   * jottei raportti laske niitä joka kerta uudelleen mahdollisesti
   * eri tavalla.
   */
  gross_cents integer not null check (gross_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  net_cents integer not null check (net_cents >= 0),

  /* Kassan oma ryhmänimi sellaisena kuin se raportissa luki. */
  pos_name text,

  created_at timestamptz not null default now(),

  /* Yksi rivi per ryhmä per päivä. Kaksi tarkoittaisi kahta totuutta. */
  unique (daily_sales_id, sales_group_id),

  constraint daily_sales_lines_sum check (gross_cents = vat_cents + net_cents)
);

create index if not exists daily_sales_lines_lookup
  on daily_sales_lines (daily_sales_id);

-- ---------------------------------------------------------------------------
-- 4. Kassan ilmoittamat luvut täsmäytystä varten
-- ---------------------------------------------------------------------------
--
-- Täsmäytys vertaa kahta lukua: mitä kassa sanoo ja mitä Budetin rivit
-- laskevat. Kassan luku on säilytettävä sellaisenaan — jos se
-- korvattaisiin laskennalla, vertailu vertaisi lukua itseensä ja
-- täsmäisi aina.

alter table daily_sales
  add column if not exists pos_gross_cents integer;

alter table daily_sales
  add column if not exists pos_vat_cents integer;

alter table daily_sales drop constraint if exists daily_sales_pos_positive;
alter table daily_sales add constraint daily_sales_pos_positive check (
  (pos_gross_cents is null or pos_gross_cents >= 0)
  and (pos_vat_cents is null or pos_vat_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- 5. Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Verokannat ovat liiketoiminta-asetuksia: sama rajaus kuin muullakin
-- taloustiedolla. Lukeminen talousoikeudella, muuttaminen omistajalla.
-- Myyntirivit seuraavat daily_salesin sääntöä.

alter table sales_groups enable row level security;
alter table pos_sales_groups enable row level security;
alter table daily_sales_lines enable row level security;

drop policy if exists sales_groups_read on sales_groups;
create policy sales_groups_read on sales_groups
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists sales_groups_write on sales_groups;
create policy sales_groups_write on sales_groups
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

drop policy if exists pos_sales_groups_read on pos_sales_groups;
create policy pos_sales_groups_read on pos_sales_groups
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists pos_sales_groups_write on pos_sales_groups;
create policy pos_sales_groups_write on pos_sales_groups
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

/*
 * Rivin oikeus tulee päivästä johon se kuuluu.
 *
 * Rivillä ei ole omaa restaurant_id:tä: kaksi lähdettä samalle
 * totuudelle ajautuisi erilleen, ja väärin päivitetty rivi näkyisi
 * väärälle ravintolalle.
 */
drop policy if exists daily_sales_lines_read on daily_sales_lines;
create policy daily_sales_lines_read on daily_sales_lines
  for select to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and can_read_finance(d.restaurant_id)
    )
  );

drop policy if exists daily_sales_lines_write on daily_sales_lines;
create policy daily_sales_lines_write on daily_sales_lines
  for all to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  );

drop trigger if exists sales_groups_touch on sales_groups;
create trigger sales_groups_touch before update on sales_groups
  for each row execute function touch_updated_at();

drop trigger if exists pos_sales_groups_touch on pos_sales_groups;
create trigger pos_sales_groups_touch before update on pos_sales_groups
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Kassan ilmoittama ALV rivillä
-- ---------------------------------------------------------------------------
--
-- Täsmäytys vertaa kannoittain: mitä kassa sanoi tästä kannasta ja
-- mitä Budet laskee samasta bruttosummasta. Ilman kassan omaa lukua
-- vertailu vertaisi laskentaa itseensä ja täsmäisi aina.
--
-- Vapaaehtoinen, koska kaikki raportit eivät erittele ALV:tä
-- kannoittain — silloin täsmäytys tehdään vain loppusummasta.

alter table daily_sales_lines add column if not exists pos_vat_cents integer;

alter table daily_sales_lines drop constraint if exists daily_sales_lines_pos_vat_positive;
alter table daily_sales_lines add constraint daily_sales_lines_pos_vat_positive
  check (pos_vat_cents is null or pos_vat_cents >= 0);


-- ===========================================================================
-- 0038_default_sales_groups.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0038 — Myyntiryhmien oletuspohja
-- ---------------------------------------------------------------------------
--
-- Suomessa ravintolan verokannat ovat samat joka ravintolalle:
-- ravintola- ja ateriapalvelu alennetulla kannalla, alkoholi ja muu
-- myynti yleisellä. Jokaisen ravintolan ei tarvitse keksiä niitä
-- itse — tyhjä verotusnäkymä on este jonka takana koko täsmäytys on.
--
-- POHJA EI OLE KOVAKOODATTU KANTA.
--
-- Ero on olennainen. Kovakoodattu kanta on luku jota ei voi muuttaa;
-- pohja on rivi joka luodaan kerran ja jota ravintola muokkaa vapaasti.
-- Verokanta muuttuu lainsäädännöllä, ja silloin pohja muuttuu UUSILLE
-- ravintoloille — vanhat pitävät omansa, ja vanhat myyntirivit
-- pitävät sen kannan joka niihin kirjattiin.
--
-- POHJA EI KIRJOITA PÄÄLLE.
--
-- Funktio ei tee mitään jos ryhmiä on jo yksikin. Ravintola joka on
-- määrittänyt omat ryhmänsä ei saa löytää niiden joukosta kolmea
-- uutta, eikä muokattu kanta saa palautua alkuperäiseksi.

create or replace function seed_default_sales_groups(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi lisätä myyntiryhmiä';
  end if;

  -- Yksikin olemassa oleva ryhmä tarkoittaa että ravintola on jo
  -- päättänyt jäsennyksensä. Silloin pohja olisi häiriö eikä apu.
  if exists (select 1 from sales_groups where restaurant_id = p_restaurant) then
    return 0;
  end if;

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (p_restaurant, 'Ravintolamyynti', 0.14000, true, 0),
    (p_restaurant, 'Alkoholimyynti', 0.25500, false, 1),
    (p_restaurant, 'Muut myynnit', 0.25500, false, 2);

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function seed_default_sales_groups from public;
grant execute on function seed_default_sales_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa pohjan heti
-- ---------------------------------------------------------------------------
--
-- Rivit kirjoitetaan suoraan eikä seed-funktion kautta: funktio vaatii
-- omistajuuden, ja jäsenyys on juuri kirjoitettu samassa
-- transaktiossa — is_owner voisi lukea vanhaa tilaa riippuen siitä
-- milloin se näkee rivin.

create or replace function create_restaurant(
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

  insert into restaurants (name, timezone)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'))
  returning id into v_id;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  /*
   * Myyntiryhmien pohja.
   *
   * Uusi ravintola pystyy täsmäyttämään päiväraportin heti
   * ensimmäisestä päivästä. Ilman pohjaa verotusnäkymä olisi tyhjä, ja
   * tyhjä näkymä on este jota kukaan ei ohita illan päätteeksi.
   *
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.14000, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;


-- ===========================================================================
-- 0039_food_vat_rate.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0039 — Ravintolamyynnin kanta 13,5 %
-- ---------------------------------------------------------------------------
--
-- Ravintola- ja ateriapalvelun arvonlisävero on laskenut 14 %:sta
-- 13,5 %:iin. Uuden ravintolan pohja käyttää nyt voimassa olevaa
-- kantaa.
--
-- VANHAT RIVIT EIVÄT MUUTU.
--
-- Tämä koskee vain pohjaa jonka uusi ravintola saa. Olemassa olevien
-- ravintoloiden ryhmiä ei kosketa: kanta on ravintolan oma asetus, ja
-- sen muuttaminen puolesta olisi juuri se takautuva muutos jota
-- migraatio 0037 varoi.
--
-- Kirjatut myyntirivit kantavat oman kantansa eivätkä muutu
-- kummassakaan tapauksessa — vanha päivä on kirjattu vanhalla
-- kannalla, ja niin sen kuuluu pysyä.

create or replace function seed_default_sales_groups(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi lisätä myyntiryhmiä';
  end if;

  if exists (select 1 from sales_groups where restaurant_id = p_restaurant) then
    return 0;
  end if;

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (p_restaurant, 'Ravintolamyynti', 0.13500, true, 0),
    (p_restaurant, 'Alkoholimyynti', 0.25500, false, 1),
    (p_restaurant, 'Muut myynnit', 0.25500, false, 2);

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function seed_default_sales_groups from public;
grant execute on function seed_default_sales_groups to authenticated;

create or replace function create_restaurant(
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

  insert into restaurants (name, timezone)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'))
  returning id into v_id;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;


-- ===========================================================================
-- 0040_receipt_pages.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0040 — Monisivuinen kuitti
-- ---------------------------------------------------------------------------
--
-- Kuitilla on ollut yksi kuva. Tukkukuitti on kolme sivua, ja
-- ainoa tapa saada se sisään oli skannata sivut yhdeksi PDF:ksi —
-- ylimääräinen työvaihe juuri siinä kohtaa jossa ollaan kiireisiä.
--
-- Nyt sivuja voi olla niin monta kuin kuitissa on.
--
-- SIVUTAULU ON TOTUUS, image_path ON PEILI.
--
-- Vanha sarake jää paikalleen ja osoittaa ensimmäiseen sivuun. Sitä ei
-- pudoteta: pudotettu sarake on peruuttamaton, ja vanhat kyselyt
-- lukevat sitä yhä. Peiliä kirjoittaa vain set_receipt_pages, joten
-- kahta kirjoittajaa ei ole eivätkä ne voi ajautua erilleen.

create table if not exists receipt_pages (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,

  /* Sivujärjestys sellaisena kuin käyttäjä kuvasi ne. 1, 2, 3… */
  page_number integer not null check (page_number >= 1),

  storage_path text not null,

  /*
   * Tiedoston tiiviste.
   *
   * Sama sivu kahdesti ei vie tilaa kahdesti, ja tiiviste on myös
   * ainoa tapa huomata jos sama sivu on kuvattu kahteen kertaan.
   */
  file_hash text,

  created_at timestamptz not null default now(),

  /* Kaksi sivua samalla numerolla tarkoittaisi kahta järjestystä. */
  unique (receipt_id, page_number)
);

create index if not exists receipt_pages_lookup
  on receipt_pages (receipt_id, page_number);

-- ---------------------------------------------------------------------------
-- Vanhat kuitit sivutauluun
-- ---------------------------------------------------------------------------
--
-- Jokainen olemassa oleva kuva on kuitin ensimmäinen sivu. Ilman tätä
-- vanhat kuitit näyttäisivät kuvattomilta heti kun näkymä alkaa lukea
-- sivutaulua.

insert into receipt_pages (receipt_id, page_number, storage_path, file_hash)
select r.id, 1, r.image_path, r.file_hash
from receipts r
where r.image_path is not null
  and not exists (select 1 from receipt_pages p where p.receipt_id = r.id)
on conflict (receipt_id, page_number) do nothing;

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Sivun oikeus tulee kuitista johon se kuuluu, ja on täsmälleen sama
-- kuin kuitin oma sääntö: luku talousoikeudella tai omalla kuitilla,
-- kirjoitus vuoropäälliköllä.
--
-- Sivulla ei ole omaa restaurant_id:tä: kaksi lähdettä samalle
-- totuudelle ajautuisi erilleen, ja väärin päivitetty sivu näkyisi
-- väärälle ravintolalle.

alter table receipt_pages enable row level security;

drop policy if exists receipt_pages_read on receipt_pages;
create policy receipt_pages_read on receipt_pages
  for select to authenticated
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_id
        and (
          can_read_finance(r.restaurant_id)
          or (r.restaurant_id in (select my_restaurant_ids()) and r.added_by = auth.uid())
        )
    )
  );

drop policy if exists receipt_pages_write on receipt_pages;
create policy receipt_pages_write on receipt_pages
  for all to authenticated
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_id and is_manager(r.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_id and is_manager(r.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Sivujen kirjoitus
-- ---------------------------------------------------------------------------
--
-- Yksi funktio joka korvaa kuitin sivut kokonaan. Osittainen päivitys
-- jättäisi poistetun sivun roikkumaan, ja kuitti näyttäisi sivun jota
-- ei enää ole.
--
-- Suljettu kuukausi estää muutoksen samalla säännöllä kuin kuitinkin:
-- kirjanpitoon lähetetyn kuitin sivut eivät saa vaihtua.

create or replace function set_receipt_pages(
  p_receipt uuid,
  p_paths text[],
  p_hashes text[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_date date;
  v_count integer;
begin
  select restaurant_id, receipt_date into v_restaurant, v_date
  from receipts where id = p_receipt;

  if v_restaurant is null then
    raise exception 'Kuittia ei löytynyt';
  end if;

  /*
   * Sivujen liittäminen on osa kuitin lisäämistä.
   *
   * Kuitin saa lisätä myös työntekijä, joten sivujen kirjoitusta ei voi
   * rajata vuoropäälliköihin — muuten oma kuitti jäisi sivuttomaksi.
   * Funktio on security definer ja rajaa itse: omaan kuittiin saa
   * koskea, muiden kuitteihin vain vuoropäällikkö.
   */
  if not (
    is_manager(v_restaurant)
    or exists (select 1 from receipts where id = p_receipt and added_by = auth.uid())
  ) then
    raise exception 'Ei oikeutta tähän kuittiin';
  end if;

  if exists (
    select 1 from closed_months
    where restaurant_id = v_restaurant
      and month = date_trunc('month', v_date)::date
  ) then
    raise exception 'Kuukausi on suljettu kirjanpitoon';
  end if;

  delete from receipt_pages where receipt_id = p_receipt;

  if p_paths is null or array_length(p_paths, 1) is null then
    update receipts set image_path = null where id = p_receipt;
    return 0;
  end if;

  insert into receipt_pages (receipt_id, page_number, storage_path, file_hash)
  select
    p_receipt,
    ordinality::integer,
    path,
    case
      when p_hashes is null then null
      else p_hashes[ordinality]
    end
  from unnest(p_paths) with ordinality as t(path, ordinality)
  where coalesce(trim(path), '') <> '';

  get diagnostics v_count = row_count;

  -- Peili ensimmäiseen sivuun. Ainoa kirjoittaja on tämä funktio.
  update receipts set image_path = p_paths[1] where id = p_receipt;

  return v_count;
end;
$$;

revoke all on function set_receipt_pages from public;
grant execute on function set_receipt_pages to authenticated;


-- ===========================================================================
-- 0041_pos_vat_breakdown.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0041 — Kassan oma ALV-erittely
-- ---------------------------------------------------------------------------
--
-- Z-raportti kertoo saman päivän kahdella tavalla: tuoteryhmittäin
-- (ALKO, RUOKA, VEDET) ja verokannoittain (25,5 %, 13,5 %). Budet on
-- lukenut vain tuoteryhmät ja johtanut veron niistä ryhmän kannalla.
--
-- NÄMÄ KAKSI JAKOA EIVÄT OLE SAMA JAKO.
--
-- Oikeasta raportista: tuoteryhmä ALKO on 10,00 €, mutta kassan
-- 25,5 %:n kanta on 10,50 €. Puoli euroa RUOKA/VEDET-ryhmien sisällä
-- on verotettu yleisellä kannalla — pantti, pakkaus tai mukaan otettu
-- tuote. Ryhmä ei siis kerro kantaa, vaikka melkein aina kertookin.
--
-- Kun Budet johti veron ryhmistä, se sai 159,83 € siinä missä kassa
-- ilmoitti 159,88 €. Täsmäytys huusi "ALV ei täsmää" ja neuvoi
-- korjaamaan ryhmien verokantoja — vaikka ryhmät olivat oikein.
--
-- KASSAN ILMOITTAMA VERO ON TOTUUS.
--
-- Kassa on kirjanpidon lähde ja sen ALV-taulukko on se luku joka
-- ilmoitetaan verottajalle. Budetin oma laskelma on tarkistuslaskelma,
-- ei korvaava. Tämä taulu säilyttää kassan luvut sellaisenaan, jotta
-- niitä voi verrata sen sijaan että ne korvattaisiin.

create table if not exists daily_sales_vat (
  id uuid primary key default gen_random_uuid(),
  daily_sales_id uuid not null references daily_sales (id) on delete cascade,

  /*
   * Kanta sellaisena kuin raportissa lukee.
   *
   * numeric eikä float: 0,255 ei ole esitettävissä binäärisenä
   * liukulukuna, ja verokanta on juuri se luku jonka on oltava tarkka.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate < 1),

  /* Kaikki kolme raportista, ei laskettuna. */
  gross_cents integer not null check (gross_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  net_cents integer not null check (net_cents >= 0),

  created_at timestamptz not null default now(),

  /* Sama kanta kahdesti tarkoittaisi kahta totuutta samasta rivistä. */
  unique (daily_sales_id, vat_rate)
);

create index if not exists daily_sales_vat_lookup
  on daily_sales_vat (daily_sales_id);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Sama sääntö kuin myyntiriveillä: luku talousoikeudella, kirjoitus
-- vuoropäälliköllä. Oikeus tulee päivästä johon rivi kuuluu — oma
-- restaurant_id olisi toinen lähde samalle totuudelle.

alter table daily_sales_vat enable row level security;

drop policy if exists daily_sales_vat_read on daily_sales_vat;
create policy daily_sales_vat_read on daily_sales_vat
  for select to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and can_read_finance(d.restaurant_id)
    )
  );

drop policy if exists daily_sales_vat_write on daily_sales_vat;
create policy daily_sales_vat_write on daily_sales_vat
  for all to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  );


-- ===========================================================================
-- 0042_partial_vat_rows.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0042 — Vajaa ALV-rivi kelpaa
-- ---------------------------------------------------------------------------
--
-- Migraatio 0041 vaati ALV-riviltä kaikki kolme lukua: veron, verottoman
-- ja verollisen. Se on oikea vaatimus sille kassalle josta ominaisuus
-- rakennettiin — sen raportissa on sarakkeet ALV / NE / TTC.
--
-- KAIKKI KASSAT EIVÄT TULOSTA KOLMEA SARAKETTA.
--
-- Osa tulostaa vain veron kantaa kohti: "ALV 14 % 12,34". Silloin
-- kolmen luvun vaatimus hylkäsi koko rivin, ja päivä palasi johtamaan
-- veron tuoteryhmistä — eli takaisin siihen tilanteeseen jonka 0041
-- korjasi.
--
-- VERO ON SE LUKU JOTA TARVITAAN.
--
-- Veroton ja verollinen ovat kannoittaisen vertailun tarkkuutta, eivät
-- sen edellytys. Kun ne puuttuvat, kassan ilmoittama vero on yhä
-- kassan ilmoittama vero, ja juuri se on kirjanpidon luku.
--
-- Nollaa ei käytetä puuttuvan merkkinä: nolla on kelvollinen summa
-- nollaverokannan rivillä, ja "ei tiedetä" on eri asia kuin "on nolla".

alter table daily_sales_vat alter column gross_cents drop not null;
alter table daily_sales_vat alter column net_cents drop not null;

-- ---------------------------------------------------------------------------
-- Rivin sisäinen ristiriita on yhä virhe
-- ---------------------------------------------------------------------------
--
-- Puuttuva luku sallitaan, väärä ei. Jos molemmat ovat tiedossa,
-- niiden on summauduttava verolliseksi sentin sisällä — kassa
-- pyöristää, mutta ei enempää. Ristiriitainen rivi tarkoittaa väärin
-- luettua raporttia, eikä väärin luettu luku saa päästä kirjanpidon
-- lähteeksi.

alter table daily_sales_vat drop constraint if exists daily_sales_vat_sums;
alter table daily_sales_vat add constraint daily_sales_vat_sums check (
  gross_cents is null
  or net_cents is null
  or abs(gross_cents - net_cents - vat_cents) <= 1
);


-- ===========================================================================
-- 0043_default_pos_mappings.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0043 — Kassaryhmien oletuskohdistukset
-- ---------------------------------------------------------------------------
--
-- Uusi ravintola sai myyntiryhmät (0038) muttei yhtään kohdistusta
-- kassan omista ryhmänimistä niihin. Ensimmäinen päiväraportti meni
-- siis kokonaan oletusryhmään: olut kirjautui alennetulle kannalle ja
-- näytölle tuli varoitus "verokanta on arvattu".
--
-- Suomalaiset kassat käyttävät samoja sanoja. "OLUT" on olut joka
-- ravintolassa, ja sen kohdistaminen käsin joka ravintolassa on työtä
-- joka voidaan tehdä kerran.
--
-- VAIN YKSISELITTEISET NIMET.
--
-- Listalla on nimiä joiden merkityksestä ei voi erehtyä. "JUOMAT" ei
-- ole listalla: se voi tarkoittaa myös anniskelua, ja väärä kohdistus
-- on huonompi kuin puuttuva — puuttuvasta varoitetaan, väärästä ei.
-- Samasta syystä "BAARI" ja "TAKE AWAY" jäävät pois: edellinen voi
-- myydä ruokaa, jälkimmäisen kanta riippuu siitä mitä myydään.
--
-- KOHDISTUS EI OLE VEROKANTA.
--
-- Tämä ei päätä yhdenkään tuotteen verokantaa. Se sanoo mihin
-- ravintolan omaan myyntiryhmään kassan ryhmänimi kuuluu; kanta tulee
-- siitä ryhmästä, ja ravintola muokkaa molempia vapaasti.

create or replace function default_pos_names()
returns table (pos_name text, group_name text)
language sql
immutable
as $$
  /*
   * Ravintolamyynti — ruoka ja alkoholiton tarjoilu.
   *
   * Vedet ja virvoitusjuomat ovat mukana, koska ne ovat osa
   * tarjoilua: myös esimerkkiravintolan kassa verottaa VEDET-ryhmän
   * samalla kannalla kuin ruoan.
   */
  select * from (values
    ('RUOKA', 'Ravintolamyynti'),
    ('RUOAT', 'Ravintolamyynti'),
    ('MUU RUOKA', 'Ravintolamyynti'),
    ('LOUNAS', 'Ravintolamyynti'),
    ('LOUNAAT', 'Ravintolamyynti'),
    ('KEITTIÖ', 'Ravintolamyynti'),
    ('ANNOKSET', 'Ravintolamyynti'),
    ('A LA CARTE', 'Ravintolamyynti'),
    ('ALACARTE', 'Ravintolamyynti'),
    ('PIZZA', 'Ravintolamyynti'),
    ('PIZZAT', 'Ravintolamyynti'),
    ('SALAATTI', 'Ravintolamyynti'),
    ('SALAATIT', 'Ravintolamyynti'),
    ('ALKURUOKA', 'Ravintolamyynti'),
    ('JÄLKIRUOKA', 'Ravintolamyynti'),
    ('JÄLKIRUOAT', 'Ravintolamyynti'),
    ('KAHVI', 'Ravintolamyynti'),
    ('KAHVIT', 'Ravintolamyynti'),
    ('TEE', 'Ravintolamyynti'),
    ('VESI', 'Ravintolamyynti'),
    ('VEDET', 'Ravintolamyynti'),
    ('LIMSA', 'Ravintolamyynti'),
    ('LIMSAT', 'Ravintolamyynti'),
    ('MEHU', 'Ravintolamyynti'),
    ('VIRVOITUSJUOMAT', 'Ravintolamyynti'),
    ('ALKOHOLITTOMAT', 'Ravintolamyynti'),

    /* Alkoholimyynti — anniskelu, yleinen kanta. */
    ('ALKO', 'Alkoholimyynti'),
    ('ALKOHOLI', 'Alkoholimyynti'),
    ('ALKOHOLIT', 'Alkoholimyynti'),
    ('ANNISKELU', 'Alkoholimyynti'),
    ('OLUT', 'Alkoholimyynti'),
    ('OLUET', 'Alkoholimyynti'),
    ('VIINI', 'Alkoholimyynti'),
    ('VIINIT', 'Alkoholimyynti'),
    ('KUOHUVIINI', 'Alkoholimyynti'),
    ('SIIDERI', 'Alkoholimyynti'),
    ('LONKERO', 'Alkoholimyynti'),
    ('DRINKIT', 'Alkoholimyynti'),
    ('VÄKEVÄT', 'Alkoholimyynti'),

    /* Muut myynnit — ei tarjoilua, yleinen kanta. */
    ('TUPAKKA', 'Muut myynnit')
  ) as t(pos_name, group_name);
$$;

-- ---------------------------------------------------------------------------
-- Kohdistusten lisääminen olemassa olevalle ravintolalle
-- ---------------------------------------------------------------------------
--
-- Ei kirjoita päälle. Ravintolan oma kohdistus voittaa aina, myös kun
-- se osoittaa eri ryhmään kuin oletus: se on tietoinen päätös, ja
-- oletuslista on vain lähtökohta.
--
-- Vertailu tehdään pienaakkosin ja välilyönnit siistien, koska
-- sovellus tunnistaa nimet samoin. Muuten "Alko" ja "ALKO" olisivat
-- kannalle kaksi eri riviä mutta sovellukselle sama nimi.

create or replace function seed_default_pos_mappings(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kohdistuksia';
  end if;

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select p_restaurant, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = p_restaurant
   and lower(trim(g.name)) = lower(trim(d.group_name))
  where not exists (
    select 1
    from pos_sales_groups existing
    where existing.restaurant_id = p_restaurant
      and lower(trim(existing.pos_name)) = lower(trim(d.pos_name))
  )
  on conflict (restaurant_id, pos_name) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

revoke all on function seed_default_pos_mappings from public;
grant execute on function seed_default_pos_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa kohdistukset heti
-- ---------------------------------------------------------------------------
--
-- Samassa transaktiossa kuin ryhmät. Kohdistukset kirjoitetaan
-- suoraan eikä seed-funktion kautta: funktio vaatii esihenkilöyden, ja
-- jäsenyys on juuri kirjoitettu — is_manager voisi lukea vanhaa tilaa
-- riippuen siitä milloin se näkee rivin.

create or replace function create_restaurant(
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

  insert into restaurants (name, timezone)
  values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'))
  returning id into v_id;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  /*
   * Myyntiryhmien pohja.
   *
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen. Vanhat ravintolat pitävät omansa, ja kirjatut
   * myyntirivit kantavat oman kantansa.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  /*
   * Kassaryhmien kohdistukset.
   *
   * Ilman näitä ensimmäinen päiväraportti menisi kokonaan
   * oletusryhmään ja olut kirjautuisi alennetulle kannalle.
   */
  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;


-- ===========================================================================
-- 0044_restaurant_slug_on_create.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0044 — Uusi ravintola saa osoitetunnuksen
-- ---------------------------------------------------------------------------
--
-- UUDEN RAVINTOLAN LUONTI ON OLLUT RIKKI.
--
-- Migraatio 0016 lisäsi restaurants.slug-sarakkeen, täytti sen
-- olemassa oleville riveille ja asetti sen NOT NULL -tilaan. Se ei
-- päivittänyt create_restaurant-funktiota, joka lisää rivin vain
-- nimellä ja aikavyöhykkeellä.
--
-- Siitä lähtien jokainen yritys luoda ravintola on kaatunut
-- rajoitteeseen: "null value in column slug violates not-null
-- constraint". Vika ei näkynyt kenellekään, koska sen jälkeen ei ole
-- luotu uutta ravintolaa — ja juuri siksi se olisi löytynyt vasta
-- ensimmäisestä uudesta asiakkaasta.
--
-- Vika löytyi kun oletuskohdistuksia (0043) todennettiin ajamalla
-- create_restaurant peruutettavassa transaktiossa.

-- ---------------------------------------------------------------------------
-- Tunnus nimestä
-- ---------------------------------------------------------------------------
--
-- Sama muunnos kuin 0016:n täytössä, jotta vanhat ja uudet tunnukset
-- näyttävät samalta: ääkköset auki, muut merkit viivaksi, reunaviivat
-- pois. /lounas/cafe-monami on luettava, jaettava ja muistettava.
--
-- Numeroliite törmäyksestä. Kaksi samannimistä ravintolaa on
-- tavallista, ja tunnus on ainutkertainen — ilman liitettä
-- jälkimmäisen luonti kaatuisi.
--
-- Tyhjä tulos saa varanimen. Nimi joka koostuu pelkistä välimerkeistä
-- tai latinalaisen aakkoston ulkopuolisista merkeistä muuttuisi
-- tyhjäksi, ja tyhjä rikkoisi muotorajoitteen.

create or replace function restaurant_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p_name, ''), 'äöåÄÖÅüÜéÉ', 'aoaAOAuUeE')),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );

  if v_base = '' then
    v_base := 'ravintola';
  end if;

  v_slug := v_base;

  while exists (select 1 from restaurants where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  return v_slug;
end;
$$;

-- Ei kutsuttavaksi ulkopuolelta: tunnus syntyy ravintolan luonnissa.
revoke all on function restaurant_slug from public;

-- ---------------------------------------------------------------------------
-- Ravintolan luonti
-- ---------------------------------------------------------------------------
--
-- Tunnuksen haku ja rivin lisäys eivät ole yksi atominen toimenpide:
-- kaksi samannimistä luontia yhtä aikaa voi valita saman tunnuksen.
-- Silloin ainutkertaisuusrajoite hylkää jälkimmäisen, ja se yritetään
-- uudelleen — toinen rivi on silloin näkyvissä, joten seuraava tunnus
-- on eri. Rajoite on oikea paikka tälle: lukitus estäisi rinnakkaiset
-- luonnit myös silloin kun nimet eroavat.

create or replace function create_restaurant(
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

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  /*
   * Myyntiryhmien pohja.
   *
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen. Vanhat ravintolat pitävät omansa, ja kirjatut
   * myyntirivit kantavat oman kantansa.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  /*
   * Kassaryhmien kohdistukset.
   *
   * Ilman näitä ensimmäinen päiväraportti menisi kokonaan
   * oletusryhmään ja olut kirjautuisi alennetulle kannalle.
   */
  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;


-- ===========================================================================
-- 0045_shift_planning.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0045 — Työvuorosuunnittelun perusta
-- ---------------------------------------------------------------------------
--
-- Työvuoroja on voinut luoda yksi kerrallaan, ja jokainen luotu vuoro on
-- näkynyt tekijälleen heti. Kuukauden suunnittelu vaatii toisenlaisen
-- kulun: koko kuukausi luonnostellaan rauhassa, tarkistetaan, ja
-- julkaistaan kerralla.
--
-- JULKAISU JA VASTAUS OVAT ERI ASIOITA.
--
-- shifts.status on työntekijän vastaus vuoroon: odottaa, hyväksytty,
-- ei pääse. Julkaisu on työnantajan teko. Jos nämä pakattaisiin samaan
-- kenttään, "julkaistu" ja "hyväksytty" sulkisivat toisensa pois — ja
-- juuri niiden yhdistelmä on tavallisin tila.
--
-- Siksi julkaisu on oma akselinsa: published_at ja cancelled_at.
--
--   Luonnos      published_at is null
--   Julkaistu    published_at not null ja cancelled_at null
--   Peruttu      cancelled_at not null
--
-- Toteutunut ei ole vuoron tila lainkaan. Se lasketaan leimauksista,
-- ja jos se tallennettaisiin vuorolle, suunniteltu aika ja toteutunut
-- aika alkaisivat elää samassa kentässä.
--
-- HUOM: status = 'draft' tarkoittaa tässä kannassa jo ennestään
-- avointa vuoroa jolla ei ole tekijää. Sitä ei nimetä uudelleen tässä
-- migraatiossa — nimeäminen koskisi jokaista lukupaikkaa, eikä
-- kahden asian sekaannus korjaannu sillä että molempia siirretään.

-- ---------------------------------------------------------------------------
-- 1. Uudet kentät
-- ---------------------------------------------------------------------------

alter table shifts
  /*
   * Suunniteltu tauko minuutteina.
   *
   * Vähennetään suunnitellusta työajasta. Erillään alku- ja
   * loppuajasta, koska tauko ei ole vuoron reunoilla vaan sen
   * sisällä — 10–18 tauolla 30 min on yhä vuoro joka alkaa
   * kymmeneltä.
   */
  add column if not exists break_minutes integer not null default 0,

  /* Vapaa lisätieto vuorolle: "avaus", "tilaisuus salissa". */
  add column if not exists note text,

  add column if not exists created_by uuid references profiles (id),

  /* Milloin vuoro tuli työntekijän näkyviin. Null = luonnos. */
  add column if not exists published_at timestamptz,

  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references profiles (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shifts_break_sane'
  ) then
    alter table shifts add constraint shifts_break_sane
      check (break_minutes >= 0 and break_minutes < 24 * 60);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Vanhat vuorot ovat julkaistuja
-- ---------------------------------------------------------------------------
--
-- Tämä on migraation tärkein rivi.
--
-- Ennen tätä jokainen vuoro näkyi tekijälleen. Jos vanhat rivit
-- jäisivät luonnoksiksi, jokaisen työntekijän vuorot katoaisivat
-- näkyvistä samalla hetkellä kun tämä ajetaan — eikä kukaan tietäisi
-- miksi.

update shifts
set published_at = created_at
where published_at is null;

-- ---------------------------------------------------------------------------
-- 3. Muutoshistoria
-- ---------------------------------------------------------------------------
--
-- Työvuoro on sopimus. Kun se muuttuu julkaisun jälkeen, on voitava
-- jälkikäteen näyttää mitä sovittiin, mitä muutettiin ja milloin —
-- palkkakiistat ratkotaan juuri näillä tiedoilla.
--
-- Rivi kirjoitetaan aina, ei koskaan päivitetä.

create table if not exists shift_changes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  kind text not null check (
    kind in ('created', 'updated', 'published', 'cancelled')
  ),

  changed_at timestamptz not null default now(),
  changed_by uuid references profiles (id),

  /* Tilanne ennen muutosta. Luonnissa nämä ovat tyhjiä. */
  from_user_id uuid,
  from_date date,
  from_start time,
  from_end time,
  from_break integer,

  /* Tilanne muutoksen jälkeen. Peruutuksessa nämä ovat tyhjiä. */
  to_user_id uuid,
  to_date date,
  to_start time,
  to_end time,
  to_break integer
);

create index if not exists shift_changes_lookup
  on shift_changes (shift_id, changed_at desc);

alter table shift_changes enable row level security;

/*
 * Historia on esihenkilön työkalu.
 *
 * Työntekijä näkee oman vuoronsa nykytilan ja saa muutoksesta
 * ilmoituksen. Koko muutosketju kertoisi myös siitä kuka vuoroa
 * suunnitteli ja milloin — se on työnjohdon tietoa.
 */
drop policy if exists shift_changes_read on shift_changes;
create policy shift_changes_read on shift_changes
  for select to authenticated
  using (is_manager(restaurant_id));

-- Kirjoitus tapahtuu vain funktioiden kautta, jotka ovat definereitä.
drop policy if exists shift_changes_write on shift_changes;
create policy shift_changes_write on shift_changes
  for all to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 4. Luonnos ei näy työntekijälle
-- ---------------------------------------------------------------------------
--
-- Lukusääntö oli: oma vuoro näkyy aina. Julkaisu ei tarkoittaisi
-- mitään, jos luonnos näkyisi silti.
--
-- Peruttu vuoro näkyy edelleen. Työntekijän on saatava tietää että
-- vuoro peruttiin; hiljaa katoava vuoro on pahempi kuin peruttu.
-- Näkymä kertoo peruutuksen, ei tämä sääntö.

drop policy if exists shifts_read on shifts;
create policy shifts_read on shifts
  for select to authenticated
  using (
    is_manager(restaurant_id)
    or (
      restaurant_id in (select my_restaurant_ids())
      and user_id = auth.uid()
      and published_at is not null
    )
    or (
      restaurant_id in (select my_restaurant_ids())
      and user_id is null
      and published_at is not null
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Vuoron tallennus
-- ---------------------------------------------------------------------------
--
-- Sama funktio luo ja päivittää. Uusi vuoro syntyy luonnoksena:
-- kuukauden suunnittelu on keskeneräistä siihen asti kun se
-- julkaistaan, eikä keskeneräinen suunnitelma kuulu työntekijän
-- kalenteriin.
--
-- Julkaistun vuoron muutos säilyttää julkaisun. Vuoro on jo nähty, ja
-- sen palauttaminen luonnokseksi tarkoittaisi että se katoaisi
-- työntekijältä ilmoituksetta.

drop function if exists upsert_shift(uuid, uuid, uuid, date, time, time, text, staff_position);

create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null,
  p_break integer default 0,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
  v_break integer := greatest(coalesce(p_break, 0), 0);
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status, break_minutes, note, created_by
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case when p_user is null then 'draft'::shift_status else 'accepted'::shift_status end,
      v_break,
      nullif(trim(coalesce(p_note, '')), ''),
      auth.uid()
    )
    returning id into v_id;

    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      to_user_id, to_date, to_start, to_end, to_break
    )
    values (v_id, p_restaurant, 'created', auth.uid(), p_user, p_date, p_start, p_end, v_break);

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      break_minutes = v_break,
      note = nullif(trim(coalesce(p_note, '')), ''),
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        when v_old.user_id is distinct from p_user then 'accepted'::shift_status
        else v_old.status
      end
  where id = p_shift;

  /*
   * Historiarivi vain kun jokin oikeasti muuttui.
   *
   * Lomakkeen tallennus ilman muutoksia on tavallista: avataan,
   * katsotaan, tallennetaan. Tyhjä muutosrivi tekisi historiasta
   * lokin josta ei löydä sitä muutosta jota etsitään.
   */
  if v_old.user_id is distinct from p_user
     or v_old.shift_date is distinct from p_date
     or v_old.start_time is distinct from p_start
     or v_old.end_time is distinct from p_end
     or v_old.break_minutes is distinct from v_break
  then
    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      from_user_id, from_date, from_start, from_end, from_break,
      to_user_id, to_date, to_start, to_end, to_break
    )
    values (
      p_shift, v_old.restaurant_id, 'updated', auth.uid(),
      v_old.user_id, v_old.shift_date, v_old.start_time, v_old.end_time, v_old.break_minutes,
      p_user, p_date, p_start, p_end, v_break
    );
  end if;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Julkaisu
-- ---------------------------------------------------------------------------
--
-- Julkaistaan aikaväli kerralla: kuukausi suunnitellaan kokonaisuutena
-- ja se myös luvataan kokonaisuutena. Vuoro kerrallaan julkaiseminen
-- jättäisi työntekijälle puolikkaan kuukauden, eikä hän tietäisi onko
-- loppu tulossa vai ei.
--
-- Jo julkaistuja ei kosketa: julkaisuhetki on se hetki jolloin vuoro
-- ensimmäisen kerran luvattiin.

create or replace function publish_shifts(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi julkaista työvuoroja';
  end if;

  with julkaistut as (
    update shifts
    set published_at = now()
    where restaurant_id = p_restaurant
      and shift_date between p_from and p_to
      and published_at is null
      and cancelled_at is null
    returning id, restaurant_id, user_id, shift_date, start_time, end_time, break_minutes
  ),
  kirjatut as (
    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      to_user_id, to_date, to_start, to_end, to_break
    )
    select id, restaurant_id, 'published', auth.uid(),
           user_id, shift_date, start_time, end_time, break_minutes
    from julkaistut
    returning 1
  )
  select count(*) into v_count from kirjatut;

  return v_count;
end;
$$;

revoke all on function publish_shifts from public;
grant execute on function publish_shifts to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Peruutus
-- ---------------------------------------------------------------------------
--
-- Julkaistua vuoroa ei poisteta vaan perutaan. Poistettu rivi veisi
-- mukanaan tiedon siitä että vuoro oli olemassa, ja juuri se tieto
-- tarvitaan kun kysytään miksi joku ei ollut töissä.
--
-- Luonnoksen saa poistaa: sitä ei ole luvattu kenellekään.

create or replace function cancel_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi perua työvuoroja';
  end if;

  if v_shift.cancelled_at is not null then
    return;
  end if;

  update shifts
  set cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = p_shift;

  insert into shift_changes (
    shift_id, restaurant_id, kind, changed_by,
    from_user_id, from_date, from_start, from_end, from_break
  )
  values (
    p_shift, v_shift.restaurant_id, 'cancelled', auth.uid(),
    v_shift.user_id, v_shift.shift_date, v_shift.start_time, v_shift.end_time,
    v_shift.break_minutes
  );
end;
$$;

revoke all on function cancel_shift from public;
grant execute on function cancel_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Poisto vain luonnoksesta
-- ---------------------------------------------------------------------------
--
-- Julkaistu vuoro on jo nähty. Sen katoaminen jäljettömiin on juuri se
-- mitä työvuorolistalta ei saa tapahtua, joten poiston tilalle tulee
-- peruutus — ja funktio sanoo sen ääneen sen sijaan että tekisi
-- jommankumman käyttäjän puolesta.

create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  if v_shift.published_at is not null then
    raise exception 'Julkaistua vuoroa ei voi poistaa. Peru se, niin työntekijä saa tiedon.';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;


-- ===========================================================================
-- 0046_shift_copy_recurring.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0046 — Kopiointi ja toistuvat vuorot
-- ---------------------------------------------------------------------------
--
-- Kuukauden suunnittelu vuoro kerrallaan on satakolmekymmentä lomaketta.
-- Ravintolan viikko on kuitenkin lähes sama joka viikko, joten
-- suunnittelu on käytännössä edellisen viikon kopiointia ja poikkeusten
-- korjaamista.
--
-- KOPIO EI SAA LUODA PÄÄLLEKKÄISYYTTÄ.
--
-- Kopiointi kohdistuu usein alueelle jossa on jo vuoroja: viikko
-- kopioidaan, sitten huomataan että puolet oli jo tehty. Ilman
-- ohitusta jokainen ihminen saisi kaksi vuoroa samaan aikaan, ja
-- virheen siivoaminen olisi työläämpää kuin koko kopiointi.
--
-- Siksi funktio ohittaa päivän jolla kyseisellä ihmisellä on jo
-- päällekkäinen vuoro, ja kertoo montako ohitettiin.
--
-- KOPIO SYNTYY LUONNOKSENA.
--
-- Kopioitu kuukausi on suunnitelman raakaversio. Se tarkistetaan ja
-- julkaistaan erikseen, kuten käsin tehty suunnitelmakin.

-- ---------------------------------------------------------------------------
-- Vuoron aikaväli
-- ---------------------------------------------------------------------------
--
-- Yön yli menevä vuoro päättyy seuraavana päivänä. Aikaväliksi
-- muutettuna päällekkäisyyden voi tarkistaa suoraan, eikä keskiyö ole
-- erikoistapaus jonka joku unohtaa.

create or replace function shift_range(p_date date, p_start time, p_end time)
returns tsrange
language sql
immutable
as $$
  select tsrange(
    (p_date + p_start)::timestamp,
    case
      when p_end > p_start then (p_date + p_end)::timestamp
      else (p_date + 1 + p_end)::timestamp
    end,
    '[)'
  );
$$;

/*
 * Onko ihmisellä jo vuoro tähän aikaan.
 *
 * Peruttuja ei lasketa: peruttu vuoro ei vie kenenkään aikaa.
 * Avoimille vuoroille (user null) ei tarkisteta mitään — kaksi avointa
 * vuoroa samaan aikaan on kaksi paikkaa jotka pitää täyttää, ei virhe.
 */
create or replace function shift_conflicts(
  p_user uuid,
  p_date date,
  p_start time,
  p_end time
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    else exists (
      select 1
      from shifts s
      where s.user_id = p_user
        and s.cancelled_at is null
        and s.shift_date between p_date - 1 and p_date + 1
        and shift_range(s.shift_date, s.start_time, s.end_time)
            && shift_range(p_date, p_start, p_end)
    )
  end;
$$;

revoke all on function shift_conflicts from public;
grant execute on function shift_conflicts to authenticated;

-- ---------------------------------------------------------------------------
-- Aikavälin kopiointi
-- ---------------------------------------------------------------------------
--
-- Siirtymä päivinä eikä "seuraava viikko": sama funktio kopioi viikon
-- (7), kahden viikon jakson (14) ja kuukauden (kuukauden pituus).
-- Viikonpäivät säilyvät seitsemällä jaollisilla siirtymillä, ja juuri
-- se on kopioinnin tarkoitus.
--
-- Palauttaa kaksi lukua: montako luotiin ja montako ohitettiin.

create or replace function copy_shifts(
  p_restaurant uuid,
  p_from date,
  p_to date,
  p_offset integer
)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_skipped integer := 0;
  v_row shifts;
  v_date date;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi kopioida työvuoroja';
  end if;

  if p_offset = 0 then
    raise exception 'Kopiointi samaan päivään ei tekisi mitään';
  end if;

  for v_row in
    select *
    from shifts
    where restaurant_id = p_restaurant
      and shift_date between p_from and p_to
      and cancelled_at is null
    order by shift_date, start_time
  loop
    v_date := v_row.shift_date + p_offset;

    if shift_conflicts(v_row.user_id, v_date, v_row.start_time, v_row.end_time) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status, break_minutes, note, created_by
    )
    values (
      p_restaurant, v_row.user_id, v_row.position, v_date,
      v_row.start_time, v_row.end_time, v_row.location,
      case when v_row.user_id is null then 'draft'::shift_status else 'accepted'::shift_status end,
      v_row.break_minutes, v_row.note, auth.uid()
    );

    v_created := v_created + 1;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function copy_shifts from public;
grant execute on function copy_shifts to authenticated;

-- ---------------------------------------------------------------------------
-- Toistuva vuoro
-- ---------------------------------------------------------------------------
--
-- "Ali tekee maanantaisin ja tiistaisin 10–18 syyskuun ajan."
--
-- Viikonpäivät ISO-numeroina: 1 = maanantai, 7 = sunnuntai. Sama
-- numerointi kuin kalenterissa ja työvuorolistassa, jotta yksikään
-- näkymä ei joudu kääntämään sitä.

create or replace function create_recurring_shifts(
  p_restaurant uuid,
  p_user uuid,
  p_weekdays integer[],
  p_start time,
  p_end time,
  p_from date,
  p_to date,
  p_break integer default 0,
  p_position staff_position default null,
  p_location text default '',
  p_note text default null
)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_skipped integer := 0;
  v_date date;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi luoda työvuoroja';
  end if;

  if p_weekdays is null or array_length(p_weekdays, 1) is null then
    raise exception 'Valitse vähintään yksi viikonpäivä';
  end if;

  if p_to < p_from then
    raise exception 'Jakson loppu on ennen alkua';
  end if;

  /*
   * Yläraja jaksolle.
   *
   * Vuoden mittainen toistuva vuoro on lähes varmasti kirjausvirhe
   * päivämäärässä, ja se täyttäisi kalenterin sadoilla riveillä joita
   * kukaan ei ole tarkoittanut.
   */
  if p_to - p_from > 366 then
    raise exception 'Jakso on liian pitkä. Tee enintään vuoden mittainen jakso.';
  end if;

  v_date := p_from;

  while v_date <= p_to loop
    if extract(isodow from v_date)::integer = any (p_weekdays) then
      if shift_conflicts(p_user, v_date, p_start, p_end) then
        v_skipped := v_skipped + 1;
      else
        insert into shifts (
          restaurant_id, user_id, position, shift_date, start_time, end_time,
          location, status, break_minutes, note, created_by
        )
        values (
          p_restaurant, p_user, p_position, v_date, p_start, p_end,
          coalesce(p_location, ''),
          case when p_user is null then 'draft'::shift_status else 'accepted'::shift_status end,
          greatest(coalesce(p_break, 0), 0),
          nullif(trim(coalesce(p_note, '')), ''),
          auth.uid()
        );

        v_created := v_created + 1;
      end if;
    end if;

    v_date := v_date + 1;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function create_recurring_shifts from public;
grant execute on function create_recurring_shifts to authenticated;


-- ===========================================================================
-- 0047_clock_in_published_shift.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0047 — Leimaus vaatii JULKAISTUN vuoron
-- ---------------------------------------------------------------------------
--
-- Migraatio 0029 asetti säännön: ei vuoroa, ei sisäänleimausta. Sääntö
-- tunsi silloin vain vuoron olemassaolon, koska muuta ei ollut.
--
-- Migraatio 0045 toi julkaisun ja peruutuksen, ja sääntöön jäi kaksi
-- aukkoa:
--
--   Luonnokseen sai leimata. Luonnos ei näy työntekijälle lainkaan,
--   joten hän olisi saanut työoikeuden vuorosta jota hän ei tiedä
--   olevan olemassa.
--
--   Peruttuun vuoroon sai leimata. Vuoro on nimenomaan peruttu; se
--   että se yhä avaisi leimauksen tekee peruutuksesta merkinnän vailla
--   vaikutusta.
--
-- Molemmat aukot koskevat vain sisäänleimausta. Uloskirjaus ei vaadi
-- vuoroa eikä sitä muuteta: sisään päässyt on päästävä ulos, ja auki
-- jäänyt työaika kasvaa itsestään.
--
-- POIKKEUS TEHDÄÄN VUORONA, EI OHITUKSENA.
--
-- Kun joku tulee töihin ilman vuoroa, esihenkilö tekee hänelle vuoron
-- ja julkaisee sen — kaksi klikkausta. Erillinen "salli tämä kerta"
-- -oikeus olisi kolmas tapa saada työaikaa kirjatuksi, eikä sitä
-- näkyisi missään suunnitelmassa.

create or replace function record_clock_event(p_restaurant uuid, p_type clock_event_type)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := 'off';
  v_row record;
  v_id uuid;
  v_tz text;
  v_early int;
  v_local timestamp;
  v_day_start timestamptz;
  v_has_shift boolean;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  select timezone, clock_in_early_minutes
    into v_tz, v_early
  from restaurants where id = p_restaurant;

  if v_tz is null then
    raise exception 'Ravintolaa ei löytynyt';
  end if;

  v_local := now() at time zone v_tz;
  v_day_start := (date_trunc('day', v_local)) at time zone v_tz;

  for v_row in
    select event_type from clock_events
    where user_id = v_user
      and restaurant_id = p_restaurant
      and occurred_at >= v_day_start
    order by occurred_at
  loop
    v_state := case
      when v_row.event_type = 'in' and v_state = 'off' then 'working'
      when v_row.event_type = 'break_start' and v_state = 'working' then 'on_break'
      when v_row.event_type = 'break_end' and v_state = 'on_break' then 'working'
      when v_row.event_type = 'out' then 'off'
      else v_state
    end;
  end loop;

  if not (
    (p_type = 'in' and v_state = 'off')
    or (p_type = 'break_start' and v_state = 'working')
    or (p_type = 'break_end' and v_state = 'on_break')
    or (p_type = 'out' and v_state in ('working', 'on_break'))
  ) then
    raise exception 'Leimaus ei ole mahdollinen nykyisessä tilassa (%)', v_state;
  end if;

  if p_type = 'in' then
    select exists (
      select 1
      from shifts s
      where s.user_id = v_user
        and s.restaurant_id = p_restaurant
        and s.status <> 'declined'
        and s.published_at is not null
        and s.cancelled_at is null
        and s.shift_date between (v_local::date - 1) and v_local::date
        and v_local >= (s.shift_date + s.start_time) - make_interval(mins => v_early)
        and v_local < (
          case
            when s.end_time > s.start_time then s.shift_date + s.end_time
            else s.shift_date + s.end_time + interval '1 day'
          end
        )
    ) into v_has_shift;

    if not v_has_shift then
      raise exception 'Ei voimassa olevaa työvuoroa';
    end if;
  end if;

  insert into clock_events (restaurant_id, user_id, event_type)
  values (p_restaurant, v_user, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_clock_event from public;
grant execute on function record_clock_event to authenticated;


-- ===========================================================================
-- 0048_delete_open_shift.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0048 — Avoimen vuoron poisto
-- ---------------------------------------------------------------------------
--
-- Avoin vuoro on vuoro jolla ei ole tekijää. Väärään päivään tehtynä
-- se jäi listalle pysyvästi: poisto esti menneen päivän, ja peruutus
-- jätti rivin näkyviin peruttuna.
--
-- MENNYT SUOJA ON TEKIJÄN SUOJA.
--
-- Poiston päivämääräraja on olemassa siksi, ettei tehtyä työtä voi
-- pyyhkiä pois. Vuoro jolla ei ole tekijää ei ole kenenkään tekemää
-- työtä eikä siihen voi liittyä leimauksia — sitä vasten ei ole mitään
-- suojattavaa.
--
-- JULKAISTU AVOIN VUORO PERUTAAN, EI POISTETA.
--
-- Julkaistu avoin vuoro on ollut tarjolla työntekijöille. Sen
-- katoaminen jäljettömiin veisi tiedon siitä että tarjous oli
-- olemassa. Peruutus riittää: migraatio 0048:n jälkeen peruttu avoin
-- vuoro ei enää näy tarjolla, mutta rivi säilyy.

create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.published_at is not null then
    raise exception 'Julkaistua vuoroa ei voi poistaa. Peru se, niin työntekijä saa tiedon.';
  end if;

  /*
   * Päivämääräraja koskee vain vuoroja joilla on tekijä.
   *
   * Tekijätön vuoro ei ole kenenkään tehtyä työtä, joten menneen
   * päivän suoja ei koske sitä. Muuten väärään päivään tehty avoin
   * vuoro jäisi listalle ikuisesti.
   */
  if v_shift.user_id is not null and v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;


-- ===========================================================================
-- 0049_bulk_remove_shifts.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0049 — Monen vuoron poisto kerralla
-- ---------------------------------------------------------------------------
--
-- Vuoro kerrallaan poistaminen on kaksi klikkausta per rivi. Kun
-- kopiointi tai toistuva vuoro on tehnyt kuukauden verran vääriä
-- rivejä, se on satakolmekymmentä klikkausta — ja käytännössä se
-- tarkoittaa että virheelliset rivit jäävät kantaan.
--
-- SÄÄNNÖT EIVÄT LÖYSTY JOUKOSSA.
--
-- Jokaiseen riviin sovelletaan täsmälleen samat säännöt kuin
-- yksittäin: luonnos poistetaan, julkaistu perutaan, ja menneen
-- päivän nimetty vuoro on suojattu. Joukkotoiminto joka ohittaisi
-- säännöt olisi tapa kiertää ne.
--
-- YKSI RIVI EI KAADA MUITA.
--
-- Valinnassa on lähes aina rivejä joihin ei voi koskea. Jos yksi
-- niistä keskeyttäisi koko toimenpiteen, joukkopoisto epäonnistuisi
-- juuri silloin kun sitä eniten tarvitaan. Sen sijaan jokainen rivi
-- käsitellään erikseen ja tulos kerrotaan kolmena lukuna.

create or replace function bulk_remove_shifts(p_ids uuid[])
returns table (removed integer, cancelled integer, blocked integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer := 0;
  v_cancelled integer := 0;
  v_blocked integer := 0;
  v_shift shifts;
  v_id uuid;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return query select 0, 0, 0;
    return;
  end if;

  /*
   * Yläraja kerralla käsiteltäville.
   *
   * Valinta tehdään näkymästä joka näyttää yhden kuukauden, joten
   * viisisataa riittää moninkertaisesti. Raja on olemassa siksi, ettei
   * yksi kutsu voi lukita koko taulua.
   */
  if array_length(p_ids, 1) > 500 then
    raise exception 'Liian monta vuoroa kerralla. Valitse enintään 500.';
  end if;

  foreach v_id in array p_ids loop
    select * into v_shift from shifts where id = v_id;

    if v_shift.id is null then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if not is_manager(v_shift.restaurant_id) then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    -- Jo peruttu on jo tehty. Ei virhe eikä uusi tapahtuma.
    if v_shift.cancelled_at is not null then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if v_shift.published_at is not null then
      update shifts
      set cancelled_at = now(), cancelled_by = auth.uid()
      where id = v_id;

      insert into shift_changes (
        shift_id, restaurant_id, kind, changed_by,
        from_user_id, from_date, from_start, from_end, from_break
      )
      values (
        v_id, v_shift.restaurant_id, 'cancelled', auth.uid(),
        v_shift.user_id, v_shift.shift_date, v_shift.start_time,
        v_shift.end_time, v_shift.break_minutes
      );

      v_cancelled := v_cancelled + 1;
      continue;
    end if;

    /*
     * Menneen päivän nimetty vuoro on suojattu myös joukossa.
     *
     * Tekijätön vuoro ei ole kenenkään tehtyä työtä, joten sitä raja
     * ei koske — sama sääntö kuin yksittäispoistossa.
     */
    if v_shift.user_id is not null and v_shift.shift_date < current_date then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    delete from shifts where id = v_id;
    v_removed := v_removed + 1;
  end loop;

  return query select v_removed, v_cancelled, v_blocked;
end;
$$;

revoke all on function bulk_remove_shifts from public;
grant execute on function bulk_remove_shifts to authenticated;


-- ===========================================================================
-- 0050_tasks.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0050 — Tehtävät ja määräajat
-- ---------------------------------------------------------------------------
--
-- Ravintoloitsijan päivä on täynnä asioita jotka on pakko muistaa:
-- vuokra, sähkölasku, kirjanpitoaineisto, ensi viikon vuorot. Budet
-- tietää jo myynnistä, kuluista ja työvuoroista — tämä on se osa jota
-- se ei vielä tiennyt.
--
-- TÄMÄ EI OLE TODO-LISTA.
--
-- Tehtävän arvo on määräajassa. Ilman eräpäivää tehtävä on muistilappu
-- jonka voi ohittaa; eräpäivän kanssa Budet voi kertoa etukäteen, sanoa
-- eräpäivänä ja nostaa myöhästyneen esiin kunnes se on hoidettu.
--
-- ---------------------------------------------------------------------------
-- Miksi oma taulu eikä olemassa oleva
-- ---------------------------------------------------------------------------
--
-- Tässä kannassa on jo audit_events ja notifications, mutta ne
-- kuuluvat toiselle sovellukselle: molemmat on sidottu org_id:llä
-- organizations-tauluun vierasavaimella. Budetin vuokralainen on
-- ravintola, eikä ravintolaa voi kirjoittaa sarakkeeseen joka viittaa
-- organisaatioon.
--
-- Budetin ilmoitukset johdetaan tilasta eikä tallenneta riveiksi
-- ("ilmoitus joka ei vastaa todellista tilaa jäisi roikkumaan senkin
-- jälkeen kun asia on hoidettu"). Tehtävien muistutukset noudattavat
-- samaa linjaa: ne lasketaan eräpäivästä ja asetuksista, jolloin
-- kaksoisilmoitus on rakenteellisesti mahdoton.

create type task_priority as enum ('normal', 'important', 'critical');

/*
 * Näkyvyys on tehtävän oma ominaisuus.
 *
 * "Maksa vuokra" ei kuulu tarjoilijalle, "Sulje ravintola" kuuluu.
 * Ilman tätä kenttää tehtävälista olisi joko kaikille avoin tai vain
 * omistajalle — ja kumpikaan ei ole se mitä ravintolassa tarvitaan.
 */
create type task_visibility as enum (
  'owner_only',
  'managers',
  'assigned_user',
  'all_staff'
);

create type task_recurrence as enum (
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  title text not null check (length(trim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),

  /*
   * Eräpäivä ja valinnainen kellonaika erikseen.
   *
   * Sama ratkaisu kuin työvuoroilla: päivä on päivä ravintolan
   * aikavyöhykkeellä, eikä se saa liukua kesäajan mukana. Yhtenä
   * timestamptz-arvona "26.8." tarkoittaisi eri päivää eri
   * vyöhykkeillä.
   *
   * Kellonaika on valinnainen, koska useimmilla tehtävillä sitä ei
   * ole: lasku on maksettava sinä päivänä, ei kello 15.
   */
  due_on date not null,
  due_time time,

  priority task_priority not null default 'normal',
  visibility task_visibility not null default 'managers',

  assigned_to uuid references profiles (id) on delete set null,

  /*
   * Tila johdetaan, sitä ei tallenneta.
   *
   * Myöhässä oleva tehtävä ei muutu myöhässä olevaksi minkään
   * tapahtuman seurauksena vaan siksi että aika kului. Tallennettu
   * status olisi väärässä siitä hetkestä kunnes joku ajaisi
   * päivityksen — ja juuri myöhästymisen pitää olla oikein ilman
   * että kukaan tekee mitään.
   *
   * Tallennetaan siis vain se mitä ihminen teki: milloin merkittiin
   * tehdyksi ja milloin peruttiin.
   */
  completed_at timestamptz,
  completed_by uuid references profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles (id) on delete set null,

  recurrence task_recurrence not null default 'none',

  /*
   * Toistuvan tehtävän ketju.
   *
   * Jokainen esiintymä on oma rivinsä omalla tilallaan: elokuun
   * vuokra voi olla maksettu ja syyskuun myöhässä. Yksi rivi jossa
   * eräpäivä siirtyy hukkaisi historian.
   */
  parent_task_id uuid references tasks (id) on delete set null,

  /*
   * Muistutukset päivinä ennen eräpäivää.
   *
   * Taulukko eikä erillisiä rivejä: muistutus ei ole tapahtuma vaan
   * asetus. Lähetetyt muistutukset eivät tarvitse omaa kirjanpitoa,
   * koska ne johdetaan päivästä — sama päivä tuottaa saman
   * muistutuksen eikä kahta.
   */
  remind_days_before smallint[] not null default '{1}',
  remind_on_due boolean not null default true,
  remind_when_overdue boolean not null default true,

  created_by uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* Tehtävä ei voi olla sekä tehty että peruttu. */
  constraint tasks_one_outcome check (
    completed_at is null or cancelled_at is null
  ),

  /* Toistuva tehtävä ei voi olla peruttu ketjun juurena. */
  constraint tasks_recurrence_needs_due check (
    recurrence = 'none' or due_on is not null
  )
);

create index if not exists tasks_restaurant_due on tasks (restaurant_id, due_on);
create index if not exists tasks_assigned on tasks (assigned_to) where assigned_to is not null;
create index if not exists tasks_open
  on tasks (restaurant_id, due_on)
  where completed_at is null and cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Työntekijä näkee omat tehtävänsä ja koko henkilöstölle merkityt.
-- Talous- ja hallintotehtävät eivät kuulu hänelle, eikä suodatus voi
-- olla käyttöliittymässä: osoitteen voi kirjoittaa itse ja rajapinnan
-- voi kutsua suoraan.

alter table tasks enable row level security;

drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select to authenticated
  using (
    restaurant_id in (select my_restaurant_ids())
    and (
      case visibility
        when 'owner_only' then is_owner(restaurant_id)
        when 'managers' then is_manager(restaurant_id)
        when 'assigned_user' then (assigned_to = auth.uid() or is_manager(restaurant_id))
        else true
      end
    )
  );

/*
 * Kirjoitus on esihenkilön oikeus.
 *
 * Työntekijä merkitsee oman tehtävänsä tehdyksi funktion kautta, ei
 * suoralla päivityksellä: muuten hän voisi myös siirtää eräpäivää tai
 * vaihtaa vastuuhenkilön.
 */
drop policy if exists tasks_write on tasks;
create policy tasks_write on tasks
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists tasks_touch on tasks;
create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();


-- ===========================================================================
-- 0051_audit_log.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0051 — Toimintaloki
-- ---------------------------------------------------------------------------
--
-- Kun myöhemmin kysytään "kuka muutti tämän ja mikä se oli ennen",
-- Budetin on pystyttävä vastaamaan. Palkkatieto, työaikakorjaus,
-- verokanta ja käyttöoikeus ovat asioita joissa muistikuva ei riitä.
--
-- ---------------------------------------------------------------------------
-- Miksi oma taulu eikä audit_events
-- ---------------------------------------------------------------------------
--
-- Kannassa on jo audit_events, mutta se kuuluu toiselle sovellukselle:
-- sen org_id on vierasavain organizations-tauluun ja user_id
-- profiles-tauluun. Budetin vuokralainen on ravintola, eikä ravintolan
-- tunnistetta voi kirjoittaa sarakkeeseen joka viittaa organisaatioon.
-- Saman taulun jakaminen vaatisi toisen sovelluksen rivikäytäntöjen
-- muuttamista, eikä sitä voi tehdä testaamatta sitä sovellusta.
--
-- ---------------------------------------------------------------------------
-- Loki on liittymätön kohteestaan
-- ---------------------------------------------------------------------------
--
-- entity_id on pelkkä uuid ilman vierasavainta, ja tekijän nimi
-- tallennetaan tekstinä. Syy on se että loki on todiste tapahtumasta:
-- se ei saa kadota kun kohde poistetaan. Vierasavain joko estäisi
-- poiston tai veisi lokirivin mukanaan — kummassakin tapauksessa
-- "kuka poisti työntekijän" jäisi vastaamatta.

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Tekijä sekä viitteenä että nimenä.
   *
   * Viite katkeaa jos käyttäjä poistetaan; nimi jää. Loki jonka
   * tekijää ei voi enää tunnistaa ei ole todiste mistään.
   */
  actor_id uuid references profiles (id) on delete set null,
  actor_name text not null default 'Tuntematon',
  actor_role text,

  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,

  /* Yksi lause suomeksi. Lista luetaan tästä, ei JSON-kentistä. */
  summary text not null,

  /*
   * Muuttuneet kentät, ei koko riviä.
   *
   * Koko rivin tallentaminen veisi lokiin myös sellaista mitä siellä
   * ei tarvita, ja osa siitä on arkaluontoista. Vain se mikä muuttui.
   */
  before_data jsonb,
  after_data jsonb,

  /*
   * Kriittinen tapahtuma nostetaan omaksi ryhmäkseen.
   *
   * Palkka, käyttöoikeus, työaikakorjaus ja verokanta ovat niitä
   * joiden takia lokia luetaan. Ilman merkintää ne hukkuvat
   * tavallisten muutosten sekaan.
   */
  critical boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists audit_log_lookup
  on audit_log (restaurant_id, created_at desc);
create index if not exists audit_log_entity
  on audit_log (restaurant_id, entity_type, entity_id);
create index if not exists audit_log_actor
  on audit_log (restaurant_id, actor_id);

-- ---------------------------------------------------------------------------
-- Loki on vain luettava ja vain omistajalle
-- ---------------------------------------------------------------------------
--
-- LISÄYSKÄYTÄNTÖÄ EI OLE, EIKÄ MUUTOS- TAI POISTOKÄYTÄNTÖÄ.
--
-- Rivikäytäntö joka puuttuu tarkoittaa että toiminto on kielletty.
-- Kirjaukset syntyvät liipaisimista ja security definer -funktioista,
-- jotka ajetaan taulun omistajan oikeuksin — käyttäjä ei voi
-- kirjoittaa lokiin suoraan, eikä siis myöskään väärentää tekijää.
--
-- Loki sisältää palkkamuutokset ja asetukset, joten se on omistajan
-- näkymä. Vuoropäällikkö näkee oman työnsä jäljet kohteiden omista
-- näkymistä.

alter table audit_log enable row level security;

drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log
  for select to authenticated
  using (is_owner(restaurant_id));

revoke insert, update, delete on audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Kirjaus
-- ---------------------------------------------------------------------------
--
-- Tekijä luetaan istunnosta eikä parametrista. Parametrina se olisi
-- kutsujan kerrottavissa, ja loki jonka tekijän voi valita itse ei ole
-- todiste.

create or replace function write_audit(
  p_restaurant uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_name text,
  p_summary text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_critical boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_role text;
begin
  if p_restaurant is null then return; end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name
  from profiles p
  where p.id = v_actor;

  select m.role::text into v_role
  from memberships m
  where m.restaurant_id = p_restaurant and m.user_id = v_actor;

  insert into audit_log (
    restaurant_id, actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_name, summary,
    before_data, after_data, critical
  )
  values (
    p_restaurant, v_actor, coalesce(v_name, 'Järjestelmä'), v_role,
    p_action, p_entity_type, p_entity_id, p_entity_name, p_summary,
    p_before, p_after, p_critical
  );
end;
$$;

revoke all on function write_audit from public;


-- ===========================================================================
-- 0052_task_functions.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0052 — Tehtävien toiminnot
-- ---------------------------------------------------------------------------
--
-- Merkintä tehdyksi kulkee funktion kautta eikä suorana päivityksenä.
-- Vastuuhenkilö saa kuitata oman tehtävänsä, muttei siirtää eräpäivää
-- eikä vaihtaa vastuuhenkilöä — rivikäytäntö ei pysty erottamaan
-- näitä toisistaan, funktio pystyy.
--
-- JOKAINEN TOISTO ON OMA TEHTÄVÄNSÄ.
--
-- Kun elokuun vuokra merkitään maksetuksi, syyskuun tehtävä syntyy
-- omana rivinään. Yksi rivi jonka eräpäivä siirtyy hukkaisi
-- historian: silloin ei voisi enää sanoa maksettiinko elokuun vuokra
-- ajallaan.
--
-- Seuraava eräpäivä lasketaan eräpäivästä eikä tästä päivästä. "Joka
-- kuukauden viides" pysyy viidentenä vaikka tehtävä kuitattaisiin
-- kahdeksantena.

create or replace function next_task_due(p_due date, p_rule task_recurrence)
returns date
language sql
immutable
as $$
  select case p_rule
    when 'daily' then p_due + 1
    when 'weekly' then p_due + 7
    when 'monthly' then (p_due + interval '1 month')::date
    when 'yearly' then (p_due + interval '1 year')::date
    else null
  end;
$$;

create or replace function complete_task(p_task uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
  v_next date;
  v_new uuid;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then
    raise exception 'Tehtävää ei löytynyt';
  end if;

  /*
   * Vastuuhenkilö saa kuitata omansa.
   *
   * Ilman tätä työntekijä ei voisi merkitä tehtäväänsä tehdyksi
   * lainkaan, koska kirjoitusoikeus tauluun on esihenkilöllä.
   */
  if not (
    is_manager(v_task.restaurant_id)
    or (v_task.assigned_to = auth.uid()
        and v_task.restaurant_id in (select my_restaurant_ids()))
  ) then
    raise exception 'Ei oikeutta tähän tehtävään';
  end if;

  -- Jo tehty on jo tehty. Ei virhe eikä uutta toistoa.
  if v_task.completed_at is not null then
    return null;
  end if;

  if v_task.cancelled_at is not null then
    raise exception 'Peruttua tehtävää ei voi merkitä tehdyksi';
  end if;

  update tasks
  set completed_at = now(), completed_by = auth.uid()
  where id = p_task;

  if v_task.recurrence = 'none' then
    return null;
  end if;

  v_next := next_task_due(v_task.due_on, v_task.recurrence);
  if v_next is null then
    return null;
  end if;

  /*
   * Sama toisto ei synny kahdesti.
   *
   * Kaksi nopeaa kuittausta tuottaisi muuten kaksi syyskuun vuokraa.
   * Ketju tunnistetaan juuresta, joten tarkistus kestää myös pitkän
   * sarjan.
   */
  if exists (
    select 1 from tasks
    where parent_task_id = coalesce(v_task.parent_task_id, v_task.id)
      and due_on = v_next
  ) then
    return null;
  end if;

  insert into tasks (
    restaurant_id, title, description, due_on, due_time,
    priority, visibility, assigned_to, recurrence, parent_task_id,
    remind_days_before, remind_on_due, remind_when_overdue, created_by
  )
  values (
    v_task.restaurant_id, v_task.title, v_task.description, v_next, v_task.due_time,
    v_task.priority, v_task.visibility, v_task.assigned_to, v_task.recurrence,
    coalesce(v_task.parent_task_id, v_task.id),
    v_task.remind_days_before, v_task.remind_on_due, v_task.remind_when_overdue,
    coalesce(auth.uid(), v_task.created_by)
  )
  returning id into v_new;

  return v_new;
end;
$$;

revoke all on function complete_task from public;
grant execute on function complete_task to authenticated;

/** Väärin kuitattu takaisin auki. Vain esihenkilö. */
create or replace function reopen_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then return; end if;

  if not is_manager(v_task.restaurant_id) then
    raise exception 'Vain esihenkilö voi avata tehtävän uudelleen';
  end if;

  update tasks
  set completed_at = null, completed_by = null,
      cancelled_at = null, cancelled_by = null
  where id = p_task;
end;
$$;

revoke all on function reopen_task from public;
grant execute on function reopen_task to authenticated;

/**
 * Peruutus, ei poisto.
 *
 * Peruttu tehtävä säilyy: se kertoo että asia oli suunnitteilla ja
 * siitä luovuttiin. Poistettu tehtävä ei kerro kummastakaan.
 */
create or replace function cancel_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then return; end if;

  if not is_manager(v_task.restaurant_id) then
    raise exception 'Vain esihenkilö voi perua tehtävän';
  end if;

  if v_task.completed_at is not null then
    raise exception 'Tehty tehtävä on jo hoidettu — sitä ei voi perua';
  end if;

  update tasks
  set cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_task and cancelled_at is null;
end;
$$;

revoke all on function cancel_task from public;
grant execute on function cancel_task to authenticated;


-- ===========================================================================
-- 0053_audit_triggers.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0053 — Toimintalokin liipaisimet
-- ---------------------------------------------------------------------------
--
-- LOKI SYNTYY KANNASSA, EI SOVELLUKSESSA.
--
-- Sovelluskoodista kirjattu loki jää kirjaamatta joka kerta kun joku
-- kutsuu rajapintaa suoraan tai kun uusi kirjoituspolku unohdetaan.
-- Liipaisin näkee jokaisen muutoksen riippumatta siitä mistä se tuli.
--
-- YKSI MUUTOS, YKSI RIVI KENTTÄÄ KOHTI.
--
-- Jokainen liipaisin vertaa kenttiä erikseen ja kirjaa vain ne jotka
-- muuttuivat. Koko rivin tallentaminen veisi lokiin myös sen mikä
-- pysyi samana, ja muutoksen löytäminen olisi lukijan työtä.
--
-- KRIITTISET MERKITÄÄN.
--
-- Palkka, rooli, käyttöoikeus, työaikakorjaus, ALV-kanta ja kuitin
-- summa ovat niitä joiden takia lokia luetaan. Ilman merkintää ne
-- hukkuisivat tavallisten muutosten sekaan.

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

/*
 * Nimi tekstinä, ei viitteenä.
 *
 * Loki on todiste tapahtumasta eikä saa kadota kun kohde poistetaan.
 * Poistetun työntekijän nimi jää riville, jotta "kuka poistettiin" on
 * myöhemminkin vastattavissa.
 */
create or replace function audit_person_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(full_name), ''), 'Tuntematon')
  from profiles where id = p_user;
$$;

/* Sentit euroina. Loki luetaan samoilla yksiköillä kuin näkymät. */
create or replace function audit_euros(p_cents integer)
returns text
language sql
immutable
as $$
  select case
    when p_cents is null then '—'
    else to_char(p_cents / 100.0, 'FM999G999G990D00') || ' €'
  end;
$$;

create or replace function audit_shift_label(p_user uuid, p_date date, p_start time, p_end time)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p_user is null then 'Avoin vuoro' else audit_person_name(p_user) end
    || ' ' || to_char(p_date, 'DD.MM.YYYY') || ' '
    || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI');
$$;

-- ---------------------------------------------------------------------------
-- Työntekijät: palkka, rooli ja käyttöoikeus ovat kriittisiä
-- ---------------------------------------------------------------------------

create or replace function audit_memberships()
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
      null, jsonb_build_object('role', new.role, 'position', new.position), true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'member', old.user_id,
      audit_person_name(old.user_id),
      audit_person_name(old.user_id) || ' poistettiin ravintolasta.',
      jsonb_build_object('role', old.role, 'position', old.position), null, true
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

  if new.hourly_rate_cents is distinct from old.hourly_rate_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': tuntipalkka ' || audit_euros(old.hourly_rate_cents)
        || ' → ' || audit_euros(new.hourly_rate_cents) || '.',
      jsonb_build_object('hourly_rate_cents', old.hourly_rate_cents),
      jsonb_build_object('hourly_rate_cents', new.hourly_rate_cents), true
    );
  end if;

  if new.monthly_salary_cents is distinct from old.monthly_salary_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': kuukausipalkka ' || audit_euros(old.monthly_salary_cents)
        || ' → ' || audit_euros(new.monthly_salary_cents) || '.',
      jsonb_build_object('monthly_salary_cents', old.monthly_salary_cents),
      jsonb_build_object('monthly_salary_cents', new.monthly_salary_cents), true
    );
  end if;

  if new.position is distinct from old.position then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': tehtävä ' || coalesce(old.position::text, '—')
        || ' → ' || coalesce(new.position::text, '—') || '.',
      jsonb_build_object('position', old.position),
      jsonb_build_object('position', new.position), false
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

drop trigger if exists memberships_audit on memberships;
create trigger memberships_audit
  after insert or update or delete on memberships
  for each row execute function audit_memberships();

-- ---------------------------------------------------------------------------
-- Verotus ja budjetit
-- ---------------------------------------------------------------------------

create or replace function audit_sales_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'sales_group', new.id, new.name,
      'Myyntiryhmä ' || new.name || ' lisättiin kannalla '
        || to_char(new.vat_rate * 100, 'FM990D0') || ' %.',
      null, jsonb_build_object('name', new.name, 'vat_rate', new.vat_rate), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'sales_group', old.id, old.name,
      'Myyntiryhmä ' || old.name || ' poistettiin.',
      jsonb_build_object('name', old.name, 'vat_rate', old.vat_rate), null, true
    );
    return old;
  end if;

  if new.vat_rate is distinct from old.vat_rate then
    perform write_audit(
      new.restaurant_id, 'updated', 'sales_group', new.id, new.name,
      new.name || ': ALV-kanta ' || to_char(old.vat_rate * 100, 'FM990D0')
        || ' % → ' || to_char(new.vat_rate * 100, 'FM990D0') || ' %.',
      jsonb_build_object('vat_rate', old.vat_rate),
      jsonb_build_object('vat_rate', new.vat_rate), true
    );
  end if;

  if new.name is distinct from old.name then
    perform write_audit(
      new.restaurant_id, 'updated', 'sales_group', new.id, new.name,
      'Myyntiryhmän nimi ' || old.name || ' → ' || new.name || '.',
      jsonb_build_object('name', old.name), jsonb_build_object('name', new.name), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sales_groups_audit on sales_groups;
create trigger sales_groups_audit
  after insert or update or delete on sales_groups
  for each row execute function audit_sales_groups();

create or replace function audit_budgets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'budget', new.id, new.category::text,
      'Budjetti ' || new.category::text || ' ' || to_char(new.month, 'MM/YYYY')
        || ': ' || audit_euros(new.amount_cents) || '.',
      null, jsonb_build_object('amount_cents', new.amount_cents), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'budget', old.id, old.category::text,
      'Budjetti ' || old.category::text || ' ' || to_char(old.month, 'MM/YYYY') || ' poistettiin.',
      jsonb_build_object('amount_cents', old.amount_cents), null, false
    );
    return old;
  end if;

  if new.amount_cents is distinct from old.amount_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'budget', new.id, new.category::text,
      'Budjetti ' || new.category::text || ': ' || audit_euros(old.amount_cents)
        || ' → ' || audit_euros(new.amount_cents) || '.',
      jsonb_build_object('amount_cents', old.amount_cents),
      jsonb_build_object('amount_cents', new.amount_cents), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_audit on budgets;
create trigger budgets_audit
  after insert or update or delete on budgets
  for each row execute function audit_budgets();

-- ---------------------------------------------------------------------------
-- Työajan korjaus: aina kriittinen
-- ---------------------------------------------------------------------------
--
-- Käsin korjattu työaika vaikuttaa suoraan palkkaan. Korjaus on aina
-- uusi rivi, joten pelkkä insert riittää: vanha ja uusi aika ovat
-- molemmat samalla rivillä.

create or replace function audit_time_corrections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := audit_person_name(new.user_id);
begin
  perform write_audit(
    new.restaurant_id, 'updated', 'time_correction', new.id, v_name,
    v_name || ': työaika ' || to_char(new.work_date, 'DD.MM.YYYY') || ' korjattiin.',
    jsonb_build_object(
      'in', new.original_in, 'out', new.original_out,
      'break_minutes', new.original_break_minutes
    ),
    jsonb_build_object(
      'in', new.corrected_in, 'out', new.corrected_out,
      'break_minutes', new.corrected_break_minutes, 'reason', new.reason
    ),
    true
  );
  return new;
end;
$$;

drop trigger if exists time_corrections_audit on time_corrections;
create trigger time_corrections_audit
  after insert on time_corrections
  for each row execute function audit_time_corrections();

-- ---------------------------------------------------------------------------
-- Työvuorot
-- ---------------------------------------------------------------------------
--
-- Julkaisu ja peruutus ovat omia tapahtumiaan eivätkä pelkkiä
-- kenttämuutoksia: ne ovat lupaus työntekijälle ja sen peruminen.

create or replace function audit_shifts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'shift', new.id,
      audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time),
      'Työvuoro luotiin: '
        || audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time) || '.',
      null,
      jsonb_build_object('date', new.shift_date, 'start', new.start_time, 'end', new.end_time),
      false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'shift', old.id,
      audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time),
      'Työvuoro poistettiin: '
        || audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time) || '.',
      jsonb_build_object('date', old.shift_date, 'start', old.start_time, 'end', old.end_time),
      null, false
    );
    return old;
  end if;

  v_label := audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time);

  if old.published_at is null and new.published_at is not null then
    perform write_audit(
      new.restaurant_id, 'published', 'shift', new.id, v_label,
      'Työvuoro julkaistiin: ' || v_label || '.', null, null, false
    );
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    perform write_audit(
      new.restaurant_id, 'cancelled', 'shift', new.id, v_label,
      'Työvuoro peruttiin: ' || v_label || '.', null, null, false
    );
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.shift_date is distinct from old.shift_date then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoro muuttui: '
        || audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time)
        || ' → ' || v_label || '.',
      jsonb_build_object('date', old.shift_date, 'start', old.start_time, 'end', old.end_time),
      jsonb_build_object('date', new.shift_date, 'start', new.start_time, 'end', new.end_time),
      false
    );
  end if;

  if new.user_id is distinct from old.user_id then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoron tekijä vaihtui: '
        || coalesce(audit_person_name(old.user_id), 'Avoin vuoro') || ' → '
        || coalesce(audit_person_name(new.user_id), 'Avoin vuoro') || '.',
      jsonb_build_object('user_id', old.user_id),
      jsonb_build_object('user_id', new.user_id), false
    );
  end if;

  if new.break_minutes is distinct from old.break_minutes then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoron tauko ' || old.break_minutes || ' min → ' || new.break_minutes || ' min.',
      jsonb_build_object('break_minutes', old.break_minutes),
      jsonb_build_object('break_minutes', new.break_minutes), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists shifts_audit on shifts;
create trigger shifts_audit
  after insert or update or delete on shifts
  for each row execute function audit_shifts();

-- ---------------------------------------------------------------------------
-- Kuitit: summa ja ALV ovat kriittisiä
-- ---------------------------------------------------------------------------

create or replace function audit_receipts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'receipt', new.id, new.supplier_name,
      'Kuitti lisättiin: ' || new.supplier_name || ' '
        || audit_euros(new.total_cents) || '.',
      null, jsonb_build_object('total_cents', new.total_cents, 'category', new.category), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'receipt', old.id, old.supplier_name,
      'Kuitti poistettiin: ' || old.supplier_name || ' '
        || audit_euros(old.total_cents) || '.',
      jsonb_build_object('total_cents', old.total_cents, 'category', old.category),
      null, true
    );
    return old;
  end if;

  if new.total_cents is distinct from old.total_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin summa ' || audit_euros(old.total_cents) || ' → '
        || audit_euros(new.total_cents) || '.',
      jsonb_build_object('total_cents', old.total_cents),
      jsonb_build_object('total_cents', new.total_cents), true
    );
  end if;

  if new.vat_cents is distinct from old.vat_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin ALV ' || audit_euros(old.vat_cents) || ' → '
        || audit_euros(new.vat_cents) || '.',
      jsonb_build_object('vat_cents', old.vat_cents),
      jsonb_build_object('vat_cents', new.vat_cents), true
    );
  end if;

  if new.category is distinct from old.category then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin kategoria ' || old.category::text || ' → ' || new.category::text || '.',
      jsonb_build_object('category', old.category),
      jsonb_build_object('category', new.category), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists receipts_audit on receipts;
create trigger receipts_audit
  after insert or update or delete on receipts
  for each row execute function audit_receipts();

-- ---------------------------------------------------------------------------
-- Tehtävät
-- ---------------------------------------------------------------------------
--
-- Eräpäivän siirto on oma tapahtumansa vanhoine ja uusine päivineen:
-- juuri se on kysymys johon myöhemmin halutaan vastaus.

create or replace function audit_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'task', new.id, new.title,
      'Tehtävä luotiin: ' || new.title || ' (eräpäivä '
        || to_char(new.due_on, 'DD.MM.YYYY') || ').',
      null, jsonb_build_object('due_on', new.due_on, 'priority', new.priority), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'task', old.id, old.title,
      'Tehtävä poistettiin: ' || old.title || '.',
      jsonb_build_object('due_on', old.due_on), null, false
    );
    return old;
  end if;

  if old.completed_at is null and new.completed_at is not null then
    perform write_audit(
      new.restaurant_id, 'completed', 'task', new.id, new.title,
      'Tehtävä merkittiin tehdyksi: ' || new.title || '.', null, null, false
    );
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    perform write_audit(
      new.restaurant_id, 'cancelled', 'task', new.id, new.title,
      'Tehtävä peruttiin: ' || new.title || '.', null, null, false
    );
  end if;

  if new.due_on is distinct from old.due_on then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': eräpäivä ' || to_char(old.due_on, 'DD.MM.YYYY')
        || ' → ' || to_char(new.due_on, 'DD.MM.YYYY') || '.',
      jsonb_build_object('due_on', old.due_on),
      jsonb_build_object('due_on', new.due_on), false
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': vastuuhenkilö '
        || coalesce(audit_person_name(old.assigned_to), 'ei kukaan') || ' → '
        || coalesce(audit_person_name(new.assigned_to), 'ei kukaan') || '.',
      jsonb_build_object('assigned_to', old.assigned_to),
      jsonb_build_object('assigned_to', new.assigned_to), false
    );
  end if;

  if new.priority is distinct from old.priority then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': prioriteetti ' || old.priority::text || ' → ' || new.priority::text || '.',
      jsonb_build_object('priority', old.priority),
      jsonb_build_object('priority', new.priority), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_audit on tasks;
create trigger tasks_audit
  after insert or update or delete on tasks
  for each row execute function audit_tasks();


-- ===========================================================================
-- 0054_restaurant_lifecycle.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0054 — Ravintolan elinkaari ja yritystiedot
-- ---------------------------------------------------------------------------
--
-- Developer Console hallitsee ravintoloita järjestelmätasolta. Siihen
-- tarvitaan tietoja joita ravintolan oma Budet ei ole tarvinnut: missä
-- tilassa asiakkuus on, mikä paketti on käytössä ja mitkä ovat yrityksen
-- viralliset tiedot.
--
-- TILA ON OMA SARAKKEENSA, EI PÄÄTELTY.
--
-- "Keskeytetty" ei ole johdettavissa datasta: se on päätös. Samoin
-- "arkistoitu". Jos tila pääteltäisiin esimerkiksi viimeisestä
-- kirjautumisesta, ravintola heräisi henkiin itsestään kun joku avaa
-- sovelluksen — ja keskeytys on nimenomaan sitä varten ettei niin käy.
--
-- ARKISTOINTI EI POISTA MITÄÄN.
--
-- Kaikki kolme päättävää tilaa (suspended, cancelled, archived)
-- säilyttävät rivit. Poisto on erillinen tarkoituksellinen toimenpide
-- eikä tilan sivuvaikutus.

-- ---------------------------------------------------------------------------
-- Tilat ja paketit
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'restaurant_status') then
    create type restaurant_status as enum (
      'trial', 'active', 'suspended', 'cancelled', 'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'restaurant_plan') then
    create type restaurant_plan as enum (
      'free', 'pro', 'business', 'enterprise'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Sarakkeet
-- ---------------------------------------------------------------------------
--
-- Oletus on 'active' eikä 'trial': olemassa olevat ravintolat ovat
-- oikeita asiakkaita, ja trial-oletus merkitsisi ne kaikki kokeiluiksi
-- joilla on päättymispäivä.

alter table restaurants
  add column if not exists status         restaurant_status not null default 'active',
  add column if not exists plan           restaurant_plan   not null default 'free',
  add column if not exists trial_ends_on  date,
  add column if not exists legal_name     text,
  add column if not exists business_id    text,
  add column if not exists address        text,
  add column if not exists postal_code    text,
  add column if not exists city           text,
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists website        text,
  add column if not exists logo_url       text,
  add column if not exists industry       text,
  add column if not exists is_test_account boolean not null default false,
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_note    text,
  add column if not exists created_by     uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Y-tunnuksen muoto
-- ---------------------------------------------------------------------------
--
-- Suomalainen Y-tunnus on seitsemän numeroa, viiva ja tarkiste.
-- Tarkistetta ei lasketa tässä: väärä tarkiste on asiakkaan kirjoitusvirhe
-- jonka ylläpitäjä korjaa, ei syy hylätä koko riviä. Muoto sen sijaan
-- pitää olla, jotta kenttä ei täyty vapaalla tekstillä.
--
-- Tyhjä sallitaan: ravintola voidaan luoda ennen kuin Y-tunnus on tiedossa.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_business_id_muoto'
  ) then
    alter table restaurants add constraint restaurants_business_id_muoto
      check (business_id is null or business_id ~ '^[0-9]{7}-[0-9]$');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Trial vaatii päättymispäivän
-- ---------------------------------------------------------------------------
--
-- Kokeilu ilman päättymispäivää ei ole kokeilu. Ilman rajoitetta
-- ravintola jäisi trial-tilaan ikuisesti eikä kukaan huomaisi.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_trial_paattyy'
  ) then
    alter table restaurants add constraint restaurants_trial_paattyy
      check (status <> 'trial' or trial_ends_on is not null);
  end if;
end
$$;

create index if not exists restaurants_status_idx on restaurants (status);
create index if not exists restaurants_created_at_idx on restaurants (created_at desc);

comment on column restaurants.status is
  'Asiakkuuden tila. Päätös, ei datasta johdettu arvo.';
comment on column restaurants.is_test_account is
  'Testiravintola. Erotetaan tuotantoluvuista Developer Consolen mittareissa.';


-- ===========================================================================
-- 0055_super_admin_core.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0055 — Super Adminin loki ja feature flagit
-- ---------------------------------------------------------------------------
--
-- OMA LOKI, EI RAVINTOLAN LOKIA.
--
-- audit_log on ravintolan oma: sen rivit näkyvät ravintolan omistajalle
-- ja ne on rajattu restaurant_id:llä. Ylläpitäjän toimet eivät kuulu
-- sinne kahdesta syystä. Ne koskevat usein useaa ravintolaa tai ei
-- yhtäkään, jolloin restaurant_id ei ole totta. Ja ravintolan omistajan
-- ei kuulu nähdä mitä toiselle ravintolalle on tehty.
--
-- Tämä loki on liitteetön: siihen vain lisätään. Päivitys- ja
-- poistokäytäntöjä ei ole, joten RLS hylkää ne kaikilta — myös
-- ylläpitäjältä itseltään. Loki jonka voi siivota ei ole loki.

create table if not exists super_admin_audit_log (
  id           uuid primary key default gen_random_uuid(),

  actor_id     uuid references auth.users(id) on delete set null,
  -- Nimi talteen kirjoitushetkellä: käyttäjä voidaan poistaa, ja
  -- silloin loki kertoisi vain tyhjän tunnisteen.
  actor_email  text,

  action       text not null,

  -- Kohde on vapaamuotoinen: ravintola, käyttäjä, lippu tai
  -- järjestelmäasetus. Vierasavainta ei ole, koska kohde voidaan
  -- poistaa eikä rivi saa kadota sen mukana.
  target_type  text,
  target_id    uuid,
  target_name  text,

  summary      text not null,
  before_data  jsonb,
  after_data   jsonb,

  -- Vaatiiko rivi huomiota jälkikäteen luettuna: poistot,
  -- oikeusmuutokset, impersonointi.
  critical     boolean not null default false,

  created_at   timestamptz not null default now()
);

create index if not exists sa_audit_created_idx on super_admin_audit_log (created_at desc);
create index if not exists sa_audit_target_idx  on super_admin_audit_log (target_type, target_id);
create index if not exists sa_audit_actor_idx   on super_admin_audit_log (actor_id);

alter table super_admin_audit_log enable row level security;

-- Vain ylläpitäjä lukee. Ei update- eikä delete-käytäntöä: RLS hylkää
-- ne oletuksena, joten rivejä ei voi muuttaa jälkikäteen.
drop policy if exists sa_audit_select on super_admin_audit_log;
create policy sa_audit_select on super_admin_audit_log
  for select using (current_user_is_super_admin());

-- ---------------------------------------------------------------------------
-- Kirjaus
-- ---------------------------------------------------------------------------
--
-- Funktion kautta eikä suoralla insertillä: silloin actor ja aikaleima
-- tulevat istunnosta eikä kutsujan antamina, eikä kirjoittaja voi
-- esiintyä toisena.

create or replace function sa_log(
  p_action      text,
  p_summary     text,
  p_target_type text default null,
  p_target_id   uuid default null,
  p_target_name text default null,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_critical    boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  insert into super_admin_audit_log (
    actor_id, actor_email, action, target_type, target_id, target_name,
    summary, before_data, after_data, critical
  )
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_action, p_target_type, p_target_id, p_target_name,
    p_summary, p_before, p_after, p_critical
  );
end;
$$;

revoke all on function sa_log from public;

-- ---------------------------------------------------------------------------
-- Feature flagit
-- ---------------------------------------------------------------------------
--
-- Lippu on koodin tuntema nimi, ei rivi jonka ylläpitäjä keksii. Siksi
-- avain on tekstiavain eikä uuid: koodissa lukee 'lunch_module', ja
-- sama merkkijono on tässä.
--
-- KOLME TILAA, EI KAHTA.
--
-- Lippu on päällä kaikille, pois kaikilta, tai ravintolakohtainen.
-- Ravintolakohtainen ohitus on oma taulunsa, jolloin globaali oletus ja
-- poikkeus eivät kirjoita samaan kenttään — muuten oletuksen
-- vaihtaminen pyyhkisi poikkeukset.

create table if not exists feature_flags (
  key         text primary key,
  label       text not null,
  description text,
  enabled     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists feature_flag_restaurants (
  flag_key      text not null references feature_flags(key) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  enabled       boolean not null,
  created_at    timestamptz not null default now(),
  primary key (flag_key, restaurant_id)
);

alter table feature_flags enable row level security;
alter table feature_flag_restaurants enable row level security;

-- Ylläpitäjä hallitsee.
drop policy if exists flags_sa_all on feature_flags;
create policy flags_sa_all on feature_flags
  for all using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

drop policy if exists flag_overrides_sa_all on feature_flag_restaurants;
create policy flag_overrides_sa_all on feature_flag_restaurants
  for all using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

-- Ravintola lukee omat lippunsa. Ilman tätä sovellus ei voisi kysyä
-- onko ominaisuus käytössä ilman ylläpitäjän oikeuksia.
drop policy if exists flags_read on feature_flags;
create policy flags_read on feature_flags
  for select using (auth.uid() is not null);

drop policy if exists flag_overrides_read on feature_flag_restaurants;
create policy flag_overrides_read on feature_flag_restaurants
  for select using (
    exists (
      select 1 from memberships m
      where m.restaurant_id = feature_flag_restaurants.restaurant_id
        and m.user_id = auth.uid()
        and m.active
    )
  );

-- ---------------------------------------------------------------------------
-- Onko lippu päällä tälle ravintolalle?
-- ---------------------------------------------------------------------------
--
-- Poikkeus voittaa globaalin oletuksen. Tuntematon lippu on pois
-- päältä: kirjoitusvirhe nimessä ei saa avata ominaisuutta.

create or replace function feature_enabled(p_key text, p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.enabled from feature_flag_restaurants o
      where o.flag_key = p_key and o.restaurant_id = p_restaurant),
    (select f.enabled from feature_flags f where f.key = p_key),
    false
  );
$$;

grant execute on function feature_enabled to authenticated;


-- ===========================================================================
-- 0056_accounting_core.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0056 — Kirjanpidon tietomalli
-- ---------------------------------------------------------------------------
--
-- KIRJANPITO ON OMA TAPAHTUMADATANSA, EI NÄKYMÄ LÄHTEISIIN.
--
-- Kuitti ja myyntipäivä ovat operatiivista dataa: ne kertovat mitä
-- ravintolassa tapahtui. Kirjanpitotapahtuma kertoo miten se on
-- kirjattu. Nämä eivät ole sama asia eivätkä saa olla sama rivi.
--
-- Jos kirjanpito olisi vain näkymä kuitteihin, kuitin muokkaus
-- muuttaisi jo kirjattua tilikautta takautuvasti ja hiljaa. Siksi
-- kirjaus on oma rivinsä joka muistaa mistä se syntyi.
--
-- TASAPAINO ON KANNAN VASTUULLA.
--
-- Debet = kredit varmistetaan lykätyllä liipaisimella, ei
-- sovelluskoodissa. Sovelluksia on monta — palvelinfunktio, tuleva
-- tuonti, korjaustoiminto — ja jokainen niistä voisi unohtaa
-- tarkistuksen. Kanta ei unohda.
--
-- RAHA ON KOKONAISIA SENTTEJÄ.
--
-- Sama kuin muualla Budetissa. Liukuluku ei kelpaa: 0.1 + 0.2 ei ole
-- 0.3, ja kirjanpidossa se on virhe eikä pyöristys.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $tyypit$
begin
  if not exists (select 1 from pg_type where typname = 'ledger_account_type') then
    create type ledger_account_type as enum (
      'revenue', 'expense', 'asset', 'liability', 'equity'
    );
  end if;

  -- Mistä kirjaus syntyi. 'manual' on käsin tehty, muut johdettu.
  if not exists (select 1 from pg_type where typname = 'ledger_source') then
    create type ledger_source as enum (
      'receipt', 'daily_sales', 'manual', 'correction'
    );
  end if;

  /*
   * Kirjauksen elinkaari.
   *
   * proposed = Budetin muodostama esitys jota ei ole hyväksytty.
   * posted   = kirjattu, muuttumaton; korjaus tehdään uudella rivillä.
   * rejected = esitys jota ei kirjata; jää näkyviin jottei sama
   *            lähde ehdota itseään uudelleen joka synkronoinnissa.
   */
  if not exists (select 1 from pg_type where typname = 'ledger_status') then
    create type ledger_status as enum (
      'proposed', 'posted', 'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'fiscal_year_status') then
    create type fiscal_year_status as enum ('open', 'closed');
  end if;
end
$tyypit$;

-- ---------------------------------------------------------------------------
-- Tilikaudet
-- ---------------------------------------------------------------------------
--
-- Tilikausi ei ole aina kalenterivuosi, joten alku ja loppu ovat
-- päivämääriä eikä vuosiluku. Päällekkäisyys estetään rajoitteella:
-- yksi päivä kuuluu tasan yhteen tilikauteen, muuten tositenumero ei
-- ole yksikäsitteinen.

create table if not exists fiscal_years (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  status        fiscal_year_status not null default 'open',
  closed_by     uuid references auth.users(id) on delete set null,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),

  constraint fiscal_year_jarjestys check (ends_on > starts_on)
);

create index if not exists fiscal_years_restaurant_idx
  on fiscal_years (restaurant_id, starts_on desc);

-- Päällekkäiset tilikaudet pois. btree_gist tarvitaan jotta uuid ja
-- daterange mahtuvat samaan rajoitteeseen.
create extension if not exists btree_gist;

do $paallekkain$
begin
  if not exists (select 1 from pg_constraint where conname = 'fiscal_years_ei_paallekkain') then
    alter table fiscal_years add constraint fiscal_years_ei_paallekkain
      exclude using gist (
        restaurant_id with =,
        daterange(starts_on, ends_on, '[]') with &&
      );
  end if;
end
$paallekkain$;

-- ---------------------------------------------------------------------------
-- Tilikartta
-- ---------------------------------------------------------------------------
--
-- Tilikartta on ravintolakohtainen. Yhteinen kartta olisi houkutteleva,
-- mutta silloin yksikin ravintolan lisäämä tili näkyisi kaikille.
--
-- vat_rate on tilin oletuskanta eikä totuus: kirjauksen rivi kantaa
-- oman kantansa, koska kanta voi muuttua kesken tilikauden ja vanhat
-- kirjaukset säilyttävät sen mikä oli voimassa.

create table if not exists ledger_accounts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  number        text not null,
  name          text not null,
  type          ledger_account_type not null,
  vat_rate      numeric(6,5),
  active        boolean not null default true,
  -- Järjestelmän luoma perustili. Estää poiston jalan alta.
  is_system     boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ledger_accounts_numero_muoto check (number ~ '^[0-9]{3,6}$'),
  unique (restaurant_id, number)
);

create index if not exists ledger_accounts_restaurant_idx
  on ledger_accounts (restaurant_id, number);

-- ---------------------------------------------------------------------------
-- Tositteet
-- ---------------------------------------------------------------------------
--
-- EI KAHTA KIRJAUSTA SAMASTA LÄHTEESTÄ.
--
-- Yksikäsitteisyys (restaurant_id, source_type, source_id) on koko
-- automaattisen synkronoinnin turva. Ilman sitä joka ajo tekisi uudet
-- rivit, ja kolmas ajo kolminkertaistaisi tilikauden. Rajoite on
-- kannassa eikä koodissa, koska koodi voi ajautua rinnakkain itsensä
-- kanssa.
--
-- Osittainen indeksi: käsin tehdyillä kirjauksilla ei ole lähdettä,
-- eivätkä ne siis saa törmätä toisiinsa.

create table if not exists ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  fiscal_year_id uuid not null references fiscal_years(id) on delete restrict,

  -- Tositenumero juoksee tilikauden sisällä.
  entry_number   integer not null,
  entry_date     date not null,
  description    text not null,

  source_type    ledger_source not null,
  source_id      uuid,

  status         ledger_status not null default 'proposed',

  -- Korjaus osoittaa alkuperäiseen. Alkuperäistä ei poisteta.
  corrects_id    uuid references ledger_entries(id) on delete restrict,
  correction_reason text,

  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  posted_by      uuid references auth.users(id) on delete set null,
  posted_at      timestamptz,

  unique (fiscal_year_id, entry_number)
);

create unique index if not exists ledger_entries_lahde_uniikki
  on ledger_entries (restaurant_id, source_type, source_id)
  where source_id is not null;

create index if not exists ledger_entries_kausi_idx
  on ledger_entries (restaurant_id, entry_date);
create index if not exists ledger_entries_tila_idx
  on ledger_entries (restaurant_id, status);

-- ---------------------------------------------------------------------------
-- Vientirivit
-- ---------------------------------------------------------------------------
--
-- Rivi on joko debet tai kredit, ei molempia eikä kumpaakaan.
-- Molemmat sallittuna sama rivi voisi kuitata itsensä ja tosite
-- näyttäisi tasapainoiselta olematta sitä.

create table if not exists ledger_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references ledger_entries(id) on delete cascade,
  line_number  integer not null,
  account_id   uuid not null references ledger_accounts(id) on delete restrict,

  debit_cents  integer not null default 0,
  credit_cents integer not null default 0,

  -- Rivin oma kanta ja vero. Tilin oletus on lähtökohta, tämä on totuus.
  vat_rate     numeric(6,5),
  vat_cents    integer,

  description  text,

  constraint ledger_lines_ei_negatiivinen
    check (debit_cents >= 0 and credit_cents >= 0),
  constraint ledger_lines_vain_toinen_puoli
    check ((debit_cents > 0) <> (credit_cents > 0)),

  unique (entry_id, line_number)
);

create index if not exists ledger_lines_entry_idx on ledger_lines (entry_id);
create index if not exists ledger_lines_account_idx on ledger_lines (account_id);

-- ---------------------------------------------------------------------------
-- Tilikohdistukset
-- ---------------------------------------------------------------------------
--
-- Mikä tili vastaa mitäkin lähdettä. Taulu eikä kovakoodattu taulukko,
-- koska tilikartta on ravintolakohtainen: yhden ruokaostot on 4000 ja
-- toisen 4100.
--
-- ref_id viittaa myyntiryhmään tai kulukategoriaan, ref_key on
-- avainsana kuten maksutapa. Kumpikin voi olla tyhjä: verotileillä
-- riittää laji.

create table if not exists ledger_mappings (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind          text not null,
  ref_id        uuid,
  ref_key       text,
  account_id    uuid not null references ledger_accounts(id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint ledger_mappings_laji check (kind in (
    'sales_group', 'expense_category', 'payment_method',
    'vat_sales', 'vat_purchases'
  ))
);

create unique index if not exists ledger_mappings_uniikki
  on ledger_mappings (
    restaurant_id, kind,
    coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(ref_key, '')
  );

-- ---------------------------------------------------------------------------
-- Tasapaino
-- ---------------------------------------------------------------------------
--
-- Lykätty liipaisin: rivit lisätään yksi kerrallaan, joten tosite on
-- väistämättä epätasapainossa kesken lisäyksen. Tarkistus tehdään
-- vasta kun transaktio on valmis.
--
-- Tarkistetaan myös rivien määrä: yhden rivin tosite ei voi olla
-- tasapainossa muuten kuin nollasummana, ja nollasumman tosite on
-- virhe eikä kirjaus.

create or replace function ledger_tasapaino()
returns trigger
language plpgsql
as $tasapaino$
declare
  v_entry uuid;
  v_debit bigint;
  v_credit bigint;
  v_rivit integer;
  v_numero integer;
begin
  v_entry := coalesce(new.entry_id, old.entry_id);

  -- Tosite on voitu poistaa kokonaan; silloin ei ole mitään tarkistettavaa.
  if not exists (select 1 from ledger_entries where id = v_entry) then
    return null;
  end if;

  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*)
    into v_debit, v_credit, v_rivit
  from ledger_lines where entry_id = v_entry;

  select entry_number into v_numero from ledger_entries where id = v_entry;

  if v_rivit < 2 then
    raise exception 'Tosite % : kirjauksessa on oltava vähintään kaksi riviä (nyt %)',
      v_numero, v_rivit;
  end if;

  if v_debit <> v_credit then
    raise exception 'Tosite % ei täsmää: debet % senttiä, kredit % senttiä',
      v_numero, v_debit, v_credit;
  end if;

  return null;
end;
$tasapaino$;

drop trigger if exists ledger_tasapaino_trigger on ledger_lines;
create constraint trigger ledger_tasapaino_trigger
  after insert or update or delete on ledger_lines
  deferrable initially deferred
  for each row execute function ledger_tasapaino();

-- ---------------------------------------------------------------------------
-- Kirjattua ei muuteta
-- ---------------------------------------------------------------------------
--
-- Kun tosite on kirjattu, sen rivejä ei muokata eikä poisteta.
-- Korjaus on uusi tosite joka osoittaa alkuperäiseen. Tämä on
-- kirjanpidon perussääntö eikä käytäntökysymys, joten se on kannassa.

create or replace function ledger_kirjattu_lukossa()
returns trigger
language plpgsql
as $lukko$
declare
  v_status ledger_status;
begin
  select status into v_status
  from ledger_entries
  where id = coalesce(new.entry_id, old.entry_id);

  if v_status = 'posted' then
    raise exception 'Kirjattua tositetta ei muuteta. Tee korjaustosite.';
  end if;

  return coalesce(new, old);
end;
$lukko$;

drop trigger if exists ledger_lines_lukko on ledger_lines;
create trigger ledger_lines_lukko
  before insert or update or delete on ledger_lines
  for each row execute function ledger_kirjattu_lukossa();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Sama jako kuin muualla taloudessa: luku niille jotka näkevät
-- talouden, kirjoitus vuoropäälliköstä ylöspäin, tilikauden sulku
-- omistajalle.

alter table fiscal_years    enable row level security;
alter table ledger_accounts enable row level security;
alter table ledger_entries  enable row level security;
alter table ledger_lines    enable row level security;
alter table ledger_mappings enable row level security;

drop policy if exists fiscal_years_read on fiscal_years;
create policy fiscal_years_read on fiscal_years
  for select using (can_read_finance(restaurant_id));

drop policy if exists fiscal_years_write on fiscal_years;
create policy fiscal_years_write on fiscal_years
  for all using (is_owner(restaurant_id)) with check (is_owner(restaurant_id));

drop policy if exists ledger_accounts_read on ledger_accounts;
create policy ledger_accounts_read on ledger_accounts
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_accounts_write on ledger_accounts;
create policy ledger_accounts_write on ledger_accounts
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));

drop policy if exists ledger_entries_read on ledger_entries;
create policy ledger_entries_read on ledger_entries
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_entries_write on ledger_entries;
create policy ledger_entries_write on ledger_entries
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));

-- Rivit periytyvät tositteen oikeuksista: oma ravintolasarake olisi
-- toisto joka voi ajautua eri linjalle tositteen kanssa.
drop policy if exists ledger_lines_read on ledger_lines;
create policy ledger_lines_read on ledger_lines
  for select using (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and can_read_finance(e.restaurant_id)
  ));

drop policy if exists ledger_lines_write on ledger_lines;
create policy ledger_lines_write on ledger_lines
  for all using (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and is_manager(e.restaurant_id)
  )) with check (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and is_manager(e.restaurant_id)
  ));

drop policy if exists ledger_mappings_read on ledger_mappings;
create policy ledger_mappings_read on ledger_mappings
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_mappings_write on ledger_mappings;
create policy ledger_mappings_write on ledger_mappings
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));


-- ===========================================================================
-- 0056_super_admin_read.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0056 — Developer Consolen lukufunktiot
-- ---------------------------------------------------------------------------
--
-- MIKSI FUNKTIOT EIKÄ RIVIKÄYTÄNNÖT.
--
-- Ylläpitäjälle olisi voinut avata select-käytännön jokaiseen Budetin
-- tauluun. Sitä ei tehty, ja syy on tärkeä: sama oikeus olisi voimassa
-- myös silloin kun hän käyttää tavallista Budetia omassa
-- ravintolassaan. Yksi kysely josta puuttuu ravintolarajaus näyttäisi
-- silloin kaikkien asiakkaiden rivit — eikä mikään kertoisi siitä.
--
-- Nyt tenanttien eristys on täsmälleen ennallaan. Pääsy on yhdessä
-- paikassa, ja jokainen funktio kysyy oikeuden itse.
--
-- Funktiot palauttavat jsonb:tä eivätkä rivijoukkoja, koska konsoli
-- tarvitsee sisäkkäistä rakennetta: ravintola, sen käyttäjät, sen
-- käyttöluvut ja sen liput yhdessä vastauksessa. Rivijoukkoina se
-- olisi neljä kyselyä ja neljä verkkokierrosta.

-- ---------------------------------------------------------------------------
-- Yleiskatsaus
-- ---------------------------------------------------------------------------
--
-- Testiravintolat rajataan pois asiakasluvuista. Omat kokeilut eivät
-- ole asiakkaita, ja mukaan laskettuna ne näyttäisivät kasvulta.

create or replace function sa_overview()
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
    'restaurants', (
      select jsonb_build_object(
        'total',     count(*) filter (where not is_test_account),
        'active',    count(*) filter (where status = 'active'    and not is_test_account),
        'trial',     count(*) filter (where status = 'trial'     and not is_test_account),
        'suspended', count(*) filter (where status = 'suspended' and not is_test_account),
        'cancelled', count(*) filter (where status = 'cancelled' and not is_test_account),
        'archived',  count(*) filter (where status = 'archived'  and not is_test_account),
        'test',      count(*) filter (where is_test_account),
        'newToday',  count(*) filter (where created_at >= date_trunc('day', now()) and not is_test_account)
      )
      from restaurants
    ),
    'users', (
      -- count(distinct user_id): sama ihminen voi kuulua useaan
      -- ravintolaan, eikä häntä pidä laskea kahdesti.
      select jsonb_build_object(
        'total',       count(distinct m.user_id),
        'owners',      count(distinct m.user_id) filter (where m.role = 'owner'),
        'managers',    count(distinct m.user_id) filter (where m.role = 'manager'),
        'employees',   count(distinct m.user_id) filter (where m.role = 'employee'),
        'accountants', count(distinct m.user_id) filter (where m.role = 'accountant'),
        'inactive',    count(distinct m.user_id) filter (where not m.active)
      )
      from memberships m
      join restaurants r on r.id = m.restaurant_id
      where not r.is_test_account
    ),
    'today', (
      select jsonb_build_object(
        'newUsers',    count(*) filter (where u.created_at >= date_trunc('day', now())),
        'activeUsers', count(*) filter (where u.last_sign_in_at >= date_trunc('day', now()))
      )
      from auth.users u
    ),
    'trialsEndingSoon', (
      select count(*) from restaurants
      where status = 'trial' and trial_ends_on <= (current_date + 7)
    ),
    'generatedAt', now()
  ) into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ravintolalista
-- ---------------------------------------------------------------------------

create or replace function sa_restaurants()
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

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
  into v
  from (
    select
      r.id, r.name, r.slug, r.status::text, r.plan::text,
      r.business_id, r.city, r.timezone, r.currency,
      r.is_test_account, r.trial_ends_on, r.created_at,
      (select count(*) from memberships m where m.restaurant_id = r.id and m.active) as user_count,
      -- Vanhin aktiivinen omistaja. Ravintolalla voi olla useampi;
      -- lista näyttää sen joka on ollut pisimpään vastuussa.
      (select p.full_name from memberships m2
         join profiles p on p.id = m2.user_id
        where m2.restaurant_id = r.id and m2.role = 'owner' and m2.active
        order by m2.created_at limit 1) as owner_name,
      (select u.email from memberships m3
         join auth.users u on u.id = m3.user_id
        where m3.restaurant_id = r.id and m3.role = 'owner' and m3.active
        order by m3.created_at limit 1) as owner_email,
      (select max(u2.last_sign_in_at) from memberships m4
         join auth.users u2 on u2.id = m4.user_id
        where m4.restaurant_id = r.id and m4.active) as last_sign_in_at
    from restaurants r
  ) x;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yhden ravintolan tiedot
-- ---------------------------------------------------------------------------

create or replace function sa_restaurant(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_month_start date := date_trunc('month', current_date)::date;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select jsonb_build_object(
    'restaurant', to_jsonb(x),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        -- Jäsenyyden tunniste, ei käyttäjän: rooli ja käytössäolo ovat
        -- jäsenyyden ominaisuuksia, ja niitä muutetaan sen kautta.
        'membershipId', m.id,
        'id', m.user_id,
        'name', p.full_name,
        'email', u.email,
        'role', m.role::text,
        'position', m.position::text,
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
      -- Vain lunastamattomat. Lunastettu kutsu näkyy jäsenyytenä,
      -- eikä sama asia kuulu listaan kahdesti.
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
      'shifts',     (select count(*) from shifts      where restaurant_id = p_id and shift_date >= v_month_start),
      'tasks',      (select count(*) from tasks       where restaurant_id = p_id),
      'lunchMenus', (select count(*) from lunch_menus where restaurant_id = p_id),
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

-- ---------------------------------------------------------------------------
-- Käyttäjät, loki ja liput
-- ---------------------------------------------------------------------------

create or replace function sa_users()
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

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
  into v
  from (
    select
      m.id as membership_id,
      m.user_id,
      p.full_name as name,
      u.email,
      m.role::text as role,
      m.active,
      m.restaurant_id,
      r.name as restaurant_name,
      r.is_test_account,
      u.last_sign_in_at,
      coalesce(p.is_super_admin, false) as is_super_admin,
      m.created_at
    from memberships m
    join restaurants r on r.id = m.restaurant_id
    left join profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
  ) x;

  return v;
end;
$$;

create or replace function sa_audit(p_limit integer default 100)
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

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
  into v
  from (
    select id, actor_email, action, target_type, target_id, target_name,
           summary, before_data, after_data, critical, created_at
    from super_admin_audit_log
    order by created_at desc
    -- Yläraja on kannassa eikä kutsujassa: pyyntö jossa on
    -- p_limit = 1000000 ei saa vetää koko lokia muistiin.
    limit least(coalesce(p_limit, 100), 500)
  ) x;

  return v;
end;
$$;

create or replace function sa_flags()
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f.key,
    'label', f.label,
    'description', f.description,
    'enabled', f.enabled,
    'overrides', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'restaurantId', o.restaurant_id,
        'restaurantName', r.name,
        'enabled', o.enabled
      ) order by r.name), '[]'::jsonb)
      from feature_flag_restaurants o
      join restaurants r on r.id = o.restaurant_id
      where o.flag_key = f.key
    )
  ) order by f.key), '[]'::jsonb)
  into v
  from feature_flags f;

  return v;
end;
$$;

grant execute on function sa_overview    to authenticated;
grant execute on function sa_restaurants to authenticated;
grant execute on function sa_restaurant  to authenticated;
grant execute on function sa_users       to authenticated;
grant execute on function sa_audit       to authenticated;
grant execute on function sa_flags       to authenticated;


-- ===========================================================================
-- 0057_accounting_sync.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0057 — Tilikartta ja automaattinen johtaminen lähteistä
-- ---------------------------------------------------------------------------
--
-- KÄYTTÄJÄ EI SYÖTÄ MITÄÄN UUDELLEEN.
--
-- Kuitit ja myyntipäivät ovat jo Budetissa. Kirjanpito lukee ne ja
-- muodostaa kirjausesitykset. Käyttäjä tarkistaa poikkeamat, ei kopioi
-- rivejä.
--
-- ESITYS EI OLE KIRJAUS.
--
-- Johdettu tosite syntyy tilassa 'proposed'. Se näkyy, se on
-- tasapainossa ja siitä näkee mistä se tulee — mutta se ei ole
-- kirjanpitoa ennen kuin joku hyväksyy sen. Automaatti ei kirjaa
-- ohi ihmisen.
--
-- PUUTTUVAA TIETOA EI KEKSITÄ.
--
-- Jos kohdistus puuttuu tai kuitti on kesken, tosite jää tekemättä ja
-- syy palautuu raportissa. Arvattu tili olisi pahempi kuin puuttuva
-- tosite: puuttuvan huomaa, arvatun ei.

-- ---------------------------------------------------------------------------
-- Perustilikartta
-- ---------------------------------------------------------------------------
--
-- Suomalaisen ravintolan tavanomainen runko. Tämä on lähtökohta jonka
-- ravintola muokkaa, ei väite oikeasta tilikartasta: kirjanpitäjällä
-- on oma näkemyksensä ja tilit ovat ravintolakohtaisia.
--
-- is_system merkitsee tilit joihin kohdistukset osoittavat. Ne saa
-- nimetä uudelleen mutta ei poistaa jalan alta.

create or replace function ledger_seed(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $seed$
declare
  v_luotu integer := 0;
  v_kohdistuksia integer := 0;
  v_id uuid;
  v_rivi record;
  v_ryhma record;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilo voi luoda tilikartan';
  end if;

  for v_rivi in
    select * from (values
      -- Vastaavaa
      ('1750', 'Kassatilitykset',        'asset',     null::numeric),
      ('1763', 'Arvonlisaverosaaminen',  'asset',     null),
      ('1900', 'Kateiskassa',            'asset',     null),
      ('1910', 'Pankkitili',             'asset',     null),
      ('1920', 'Korttisaatavat',         'asset',     null),
      -- Vastattavaa
      ('2460', 'Arvonlisaverovelka',     'liability', null),
      ('2870', 'Ostovelat',              'liability', null),
      -- Tuotot
      ('3000', 'Ravintolamyynti',        'revenue',   null),
      ('3010', 'Alkoholimyynti',         'revenue',   null),
      ('3020', 'Muu myynti',             'revenue',   null),
      -- Kulut
      ('4000', 'Elintarvikeostot',       'expense',   null),
      ('4010', 'Alkoholiostot',          'expense',   null),
      ('4020', 'Alkoholittomat juomat',  'expense',   null),
      ('4100', 'Keittiotarvikkeet',      'expense',   null),
      ('4110', 'Pakkaustarvikkeet',      'expense',   null),
      ('4120', 'Siivoustarvikkeet',      'expense',   null),
      ('4200', 'Kuljetus',               'expense',   null),
      ('4900', 'Muut kulut',             'expense',   null),
      ('5000', 'Henkilostokulut',        'expense',   null)
    ) as t(number, name, type, vat_rate)
  loop
    insert into ledger_accounts (restaurant_id, number, name, type, vat_rate, is_system, sort_order)
    values (p_restaurant, v_rivi.number, v_rivi.name, v_rivi.type::ledger_account_type,
            v_rivi.vat_rate, true, v_rivi.number::integer)
    on conflict (restaurant_id, number) do nothing;

    if found then v_luotu := v_luotu + 1; end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- Kohdistukset
  -- -------------------------------------------------------------------------

  -- Kulukategoria -> kulutili. Avaimet ovat expense_category-enumin arvot.
  for v_rivi in
    select * from (values
      ('food',             '4000'),
      ('alcohol',          '4010'),
      ('soft_drinks',      '4020'),
      ('kitchen_supplies', '4100'),
      ('packaging',        '4110'),
      ('cleaning',         '4120'),
      ('transport',        '4200'),
      ('staff',            '5000'),
      ('other',            '4900')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'expense_category', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  -- Maksutapa -> vastatili.
  for v_rivi in
    select * from (values
      ('card',    '1920'),
      ('cash',    '1900'),
      ('invoice', '2870'),
      ('unknown', '1910')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'payment_method', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  -- Verotilit.
  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '1763';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_purchases', v_id) on conflict do nothing;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '2460';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_sales', v_id) on conflict do nothing;

  /*
   * Myyntiryhmä -> myyntitili.
   *
   * Ryhmät ovat ravintolan omia rivejä eivätkä enumia, joten
   * kohdistus tehdään tunnisteella. Nimi ratkaisee oletuksen:
   * alkoholi omalle tililleen, muut ravintolamyyntiin. Väärin
   * arvannut kohdistus on yhden klikkauksen päässä korjattavissa,
   * puuttuva kohdistus estäisi koko päivän kirjautumisen.
   */
  for v_ryhma in
    select id, name from sales_groups where restaurant_id = p_restaurant and active
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant
       and number = case
         when lower(v_ryhma.name) like '%alkoholi%' then '3010'
         when lower(v_ryhma.name) like '%muu%'      then '3020'
         else '3000'
       end;

    insert into ledger_mappings (restaurant_id, kind, ref_id, account_id)
    values (p_restaurant, 'sales_group', v_ryhma.id, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  return jsonb_build_object('accounts', v_luotu, 'mappings', v_kohdistuksia);
end;
$seed$;

revoke all on function ledger_seed from public;
grant execute on function ledger_seed to authenticated;

-- ---------------------------------------------------------------------------
-- Tilikausi päivämäärälle
-- ---------------------------------------------------------------------------
--
-- Kuukausi määräytyy tapahtuman päivästä (vaatimus 6), joten myös
-- tilikausi. Jos kautta ei ole, luodaan kalenterivuosi: se on
-- yleisin ja ravintola voi muuttaa rajat jälkikäteen.

create or replace function ledger_year_for(p_restaurant uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $vuosi$
declare
  v_id uuid;
begin
  select id into v_id from fiscal_years
   where restaurant_id = p_restaurant
     and p_date between starts_on and ends_on;

  if v_id is not null then
    return v_id;
  end if;

  insert into fiscal_years (restaurant_id, starts_on, ends_on)
  values (
    p_restaurant,
    make_date(extract(year from p_date)::int, 1, 1),
    make_date(extract(year from p_date)::int, 12, 31)
  )
  returning id into v_id;

  return v_id;
end;
$vuosi$;

revoke all on function ledger_year_for from public;

-- ---------------------------------------------------------------------------
-- Seuraava tositenumero
-- ---------------------------------------------------------------------------
--
-- Numero juoksee tilikauden sisällä. Tilikauden rivi lukitaan, jotta
-- kaksi rinnakkaista synkronointia ei valitse samaa numeroa —
-- yksikäsitteisyysrajoite hylkäisi jälkimmäisen ja koko ajo kaatuisi.

create or replace function ledger_next_number(p_year uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $numero$
declare
  v_n integer;
begin
  perform 1 from fiscal_years where id = p_year for update;

  select coalesce(max(entry_number), 0) + 1 into v_n
  from ledger_entries where fiscal_year_id = p_year;

  return v_n;
end;
$numero$;

revoke all on function ledger_next_number from public;

-- ---------------------------------------------------------------------------
-- Kuukauden synkronointi
-- ---------------------------------------------------------------------------
--
-- Idempotentti: jokainen lähde tarkistetaan ennen kirjausta, ja
-- yksikäsitteisyysrajoite on viimeinen varmistus. Ajo voidaan siis
-- toistaa niin monta kertaa kuin halutaan.
--
-- Palauttaa raportin eikä pelkkää lukumäärää: käyttäjän on nähtävä
-- mikä jäi tekemättä ja miksi.

create or replace function ledger_sync_month(p_restaurant uuid, p_month date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $sync$
declare
  v_alku date := date_trunc('month', p_month)::date;
  v_loppu date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;

  v_kuitteja integer := 0;
  v_myynteja integer := 0;
  v_ohitettu jsonb := '[]'::jsonb;

  v_r record;
  -- Oma muuttuja sisemmalle silmukalle: sama nimi ylikirjoittaisi
  -- ulomman rivin kesken kayton.
  v_line record;
  v_paiva record;
  v_year uuid;
  v_entry uuid;
  v_rivi integer;

  v_kulutili uuid;
  v_alvtili uuid;
  v_maksutili uuid;
  v_myyntitili uuid;
  v_kassatili uuid;

  v_netto integer;
  v_alv integer;
  v_summa bigint;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilo voi synkronoida kirjanpidon';
  end if;

  -- Lukittu kuukausi ei ota vastaan uusia kirjauksia.
  if exists (select 1 from closed_months
              where restaurant_id = p_restaurant and month = v_alku) then
    return jsonb_build_object(
      'locked', true,
      'message', 'Kuukausi on suljettu. Avaa se ensin tai tee korjaustosite.'
    );
  end if;

  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = p_restaurant and kind = 'vat_purchases' limit 1;

  -- =========================================================================
  -- Kuitit
  -- =========================================================================
  for v_r in
    select rc.id, rc.receipt_date, rc.supplier_name, rc.total_cents,
           coalesce(rc.vat_cents, 0) as vat_cents,
           rc.category::text as category, rc.payment_method::text as payment_method,
           rc.status::text as status
    from receipts rc
    where rc.restaurant_id = p_restaurant
      and rc.receipt_date between v_alku and v_loppu
      and not exists (
        select 1 from ledger_entries e
        where e.restaurant_id = p_restaurant
          and e.source_type = 'receipt'
          and e.source_id = rc.id
      )
    order by rc.receipt_date, rc.created_at
  loop
    -- Kesken oleva kuitti ei ole tosite.
    if v_r.status = 'needs_review' then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'receipt', 'id', v_r.id, 'name', v_r.supplier_name,
        'reason', 'Kuitti odottaa tarkistusta');
      continue;
    end if;

    select account_id into v_kulutili from ledger_mappings
     where restaurant_id = p_restaurant and kind = 'expense_category'
       and ref_key = v_r.category;

    select account_id into v_maksutili from ledger_mappings
     where restaurant_id = p_restaurant and kind = 'payment_method'
       and ref_key = v_r.payment_method;

    if v_kulutili is null or v_maksutili is null or v_alvtili is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'receipt', 'id', v_r.id, 'name', v_r.supplier_name,
        'reason', 'Tilikohdistus puuttuu');
      continue;
    end if;

    v_netto := v_r.total_cents - v_r.vat_cents;
    v_year := ledger_year_for(p_restaurant, v_r.receipt_date);

    insert into ledger_entries (
      restaurant_id, fiscal_year_id, entry_number, entry_date, description,
      source_type, source_id, created_by
    )
    values (
      p_restaurant, v_year, ledger_next_number(v_year), v_r.receipt_date,
      v_r.supplier_name, 'receipt', v_r.id, auth.uid()
    )
    returning id into v_entry;

    v_rivi := 1;

    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
    values (v_entry, v_rivi, v_kulutili, v_netto, 'Veroton');
    v_rivi := v_rivi + 1;

    if v_r.vat_cents > 0 then
      insert into ledger_lines (entry_id, line_number, account_id, debit_cents, vat_cents, description)
      values (v_entry, v_rivi, v_alvtili, v_r.vat_cents, v_r.vat_cents, 'Vahennettava ALV');
      v_rivi := v_rivi + 1;
    end if;

    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_maksutili, v_r.total_cents, 'Maksettu');

    v_kuitteja := v_kuitteja + 1;
  end loop;

  -- =========================================================================
  -- Myyntipaivat
  -- =========================================================================
  --
  -- Debet-puoli on kassatilitykset eika pankki tai kateinen: Budetin
  -- myyntipaiva ei erittele maksutapoja, ja "pankkitilille" kirjaaminen
  -- vaittaisi rahan olevan siella. Tilitystili kertoo mika on totta:
  -- myynti on syntynyt, tilitys on kesken.

  select id into v_kassatili from ledger_accounts
   where restaurant_id = p_restaurant and number = '1750';

  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = p_restaurant and kind = 'vat_sales' limit 1;

  for v_paiva in
    select ds.id, ds.sales_date, ds.gross_sales_cents, ds.net_sales_cents,
           coalesce(ds.vat_cents, 0) as vat_cents
    from daily_sales ds
    where ds.restaurant_id = p_restaurant
      and ds.sales_date between v_alku and v_loppu
      and not exists (
        select 1 from ledger_entries e
        where e.restaurant_id = p_restaurant
          and e.source_type = 'daily_sales'
          and e.source_id = ds.id
      )
    order by ds.sales_date
  loop
    if v_kassatili is null or v_alvtili is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Tilikohdistus puuttuu');
      continue;
    end if;

    if v_paiva.gross_sales_cents is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Paivalta puuttuu bruttomyynti');
      continue;
    end if;

    -- Rivit myyntiryhmittain. Ilman niita ei voi kohdistaa tileille.
    if not exists (select 1 from daily_sales_lines where daily_sales_id = v_paiva.id) then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Paivalta puuttuu myyntiryhmien erittely');
      continue;
    end if;

    v_year := ledger_year_for(p_restaurant, v_paiva.sales_date);

    insert into ledger_entries (
      restaurant_id, fiscal_year_id, entry_number, entry_date, description,
      source_type, source_id, created_by
    )
    values (
      p_restaurant, v_year, ledger_next_number(v_year), v_paiva.sales_date,
      'Paivamyynti ' || to_char(v_paiva.sales_date, 'DD.MM.YYYY'),
      'daily_sales', v_paiva.id, auth.uid()
    )
    returning id into v_entry;

    v_rivi := 1;
    v_summa := 0;

    -- Debet: kassatilitykset koko bruttosummalla.
    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
    values (v_entry, v_rivi, v_kassatili, v_paiva.gross_sales_cents, 'Paivan myynti');
    v_rivi := v_rivi + 1;

    -- Kredit: myyntitilit netolla, ryhmittain.
    for v_line in
      select l.sales_group_id, l.vat_rate,
             sum(l.net_cents)::integer as net_cents,
             sum(l.vat_cents)::integer as vat_cents
      from daily_sales_lines l
      where l.daily_sales_id = v_paiva.id
      group by l.sales_group_id, l.vat_rate
      order by l.sales_group_id
    loop
      select account_id into v_myyntitili from ledger_mappings
       where restaurant_id = p_restaurant and kind = 'sales_group'
         and ref_id = v_line.sales_group_id;

      if v_myyntitili is null then
        select id into v_myyntitili from ledger_accounts
         where restaurant_id = p_restaurant and number = '3000';
      end if;

      insert into ledger_lines (entry_id, line_number, account_id, credit_cents, vat_rate, description)
      values (v_entry, v_rivi, v_myyntitili, v_line.net_cents, v_line.vat_rate, 'Myynti veroton');
      v_rivi := v_rivi + 1;
      v_summa := v_summa + v_line.net_cents;
    end loop;

    /*
     * Kredit: myynnin ALV.
     *
     * Erotus bruttoon eika rivien verojen summa. Rivien verot voivat
     * pyoristya eri tavalla kuin paivan yhteissumma, ja silloin tosite
     * jaisi sentin epatasapainoon. Erotus on aina tasan oikea, ja jos
     * se poikkeaa rivien summasta, tasmaytys nostaa sen esiin.
     */
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_alvtili,
            (v_paiva.gross_sales_cents - v_summa)::integer, 'Myynnin ALV');

    v_myynteja := v_myynteja + 1;
  end loop;

  return jsonb_build_object(
    'month', to_char(v_alku, 'YYYY-MM'),
    'receipts', v_kuitteja,
    'salesDays', v_myynteja,
    'skipped', v_ohitettu
  );
end;
$sync$;

revoke all on function ledger_sync_month from public;
grant execute on function ledger_sync_month to authenticated;


-- ===========================================================================
-- 0057_super_admin_write.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0057 — Developer Consolen kirjoitusfunktiot
-- ---------------------------------------------------------------------------
--
-- Jokainen näistä kirjaa jäljen sa_log-funktiolla. Kirjaus on funktion
-- sisällä eikä kutsujassa: silloin sitä ei voi ohittaa kutsumalla
-- funktiota jostain muualta.

-- ---------------------------------------------------------------------------
-- Ravintolan luonti ylläpitäjänä
-- ---------------------------------------------------------------------------
--
-- create_restaurant tekee kutsujasta omistajan. Ylläpitäjä ei ole
-- ravintolan omistaja eikä saa olla: järjestelmätason rooli ja
-- tenant-rooli pidetään erillään. Siksi oma funktio.
--
-- Omistaja liittyy kutsukoodilla, jonka sa_invite_owner palauttaa.

create or replace function sa_create_restaurant(
  p_name text,
  p_timezone text default 'Europe/Helsinki',
  p_legal_name text default null,
  p_business_id text default null,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_industry text default null,
  p_plan restaurant_plan default 'free',
  p_status restaurant_status default 'active',
  p_trial_days integer default null,
  p_is_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_attempt integer;
  v_trial date;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Ravintolan nimi puuttuu';
  end if;

  if p_status = 'trial' then
    v_trial := current_date + coalesce(p_trial_days, 14);
  end if;

  -- Tunnuksen haku ja rivin lisäys eivät ole atomisia: rinnakkainen
  -- luonti voi valita saman tunnuksen. Rajoite hylkää jälkimmäisen ja
  -- se yritetään uudelleen, jolloin seuraava tunnus on eri.
  for v_attempt in 1..5 loop
    begin
      insert into restaurants (
        name, timezone, slug, legal_name, business_id, address, postal_code,
        city, phone, email, website, industry, plan, status, trial_ends_on,
        is_test_account, created_by, status_changed_at
      )
      values (
        trim(p_name),
        coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'),
        restaurant_slug(p_name),
        nullif(trim(p_legal_name), ''),
        nullif(trim(p_business_id), ''),
        nullif(trim(p_address), ''),
        nullif(trim(p_postal_code), ''),
        nullif(trim(p_city), ''),
        nullif(trim(p_phone), ''),
        nullif(trim(p_email), ''),
        nullif(trim(p_website), ''),
        nullif(trim(p_industry), ''),
        p_plan, p_status, v_trial,
        coalesce(p_is_test, false),
        auth.uid(),
        now()
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Ravintolan osoitetunnusta ei voitu muodostaa. Kokeile toista nimea.';
      end if;
    end;
  end loop;

  -- Sama pohja kuin tavallisessa luonnissa: ilman näitä ensimmäinen
  -- päiväraportti menisi kokonaan oletusryhmään.
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g on g.restaurant_id = v_id and g.name = d.group_name;

  perform sa_log(
    'restaurant.created',
    'Ravintola luotiin: ' || trim(p_name),
    'restaurant', v_id, trim(p_name),
    null,
    jsonb_build_object('plan', p_plan, 'status', p_status, 'test', coalesce(p_is_test,false)),
    false
  );

  return jsonb_build_object('id', v_id, 'name', trim(p_name));
end;
$$;

-- ---------------------------------------------------------------------------
-- Kutsu
-- ---------------------------------------------------------------------------
--
-- create_invitation vaatii omistajuuden, jota ylläpitäjällä ei ole.
-- Sama toimenpide ylläpitäjän oikeuksilla, sama aakkosto ja sama
-- tiivistetty tallennus.

create or replace function sa_invite_owner(
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

  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, position, label, created_by
  )
  values (
    p_restaurant,
    encode(digest(v_code, 'sha256'), 'hex'),
    right(v_code, 4),
    p_role,
    case when p_role = 'employee' then null else 'manager'::staff_position end,
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

-- ---------------------------------------------------------------------------
-- Muokkaus, tila ja paketti
-- ---------------------------------------------------------------------------

create or replace function sa_update_restaurant(
  p_id uuid,
  p_name text,
  p_legal_name text default null,
  p_business_id text default null,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_industry text default null,
  p_timezone text default null,
  p_is_test boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select to_jsonb(r) - 'id' into v_before from restaurants r where r.id = p_id;
  if v_before is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  update restaurants set
    name        = coalesce(nullif(trim(p_name), ''), name),
    legal_name  = nullif(trim(p_legal_name), ''),
    business_id = nullif(trim(p_business_id), ''),
    address     = nullif(trim(p_address), ''),
    postal_code = nullif(trim(p_postal_code), ''),
    city        = nullif(trim(p_city), ''),
    phone       = nullif(trim(p_phone), ''),
    email       = nullif(trim(p_email), ''),
    website     = nullif(trim(p_website), ''),
    industry    = nullif(trim(p_industry), ''),
    timezone    = coalesce(nullif(trim(p_timezone), ''), timezone),
    is_test_account = coalesce(p_is_test, is_test_account),
    updated_at  = now()
  where id = p_id;

  select to_jsonb(r) - 'id' into v_after from restaurants r where r.id = p_id;

  -- Ennen ja jälkeen kokonaisina: "muutettiin tietoja" ei kerro mitä
  -- muuttui, ja juuri se on kysymys kolmen kuukauden päästä.
  perform sa_log(
    'restaurant.updated',
    'Ravintolan tietoja muutettiin: ' || coalesce(trim(p_name), ''),
    'restaurant', p_id, trim(p_name),
    v_before, v_after, false
  );
end;
$$;

create or replace function sa_set_status(
  p_id uuid,
  p_status restaurant_status,
  p_trial_days integer default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old restaurant_status;
  v_name text;
  v_trial date;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select status, name into v_old, v_name from restaurants where id = p_id;
  if v_name is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  if p_status = 'trial' then
    v_trial := current_date + coalesce(p_trial_days, 14);
  end if;

  update restaurants set
    status = p_status,
    trial_ends_on = case when p_status = 'trial' then v_trial else trial_ends_on end,
    status_note = nullif(trim(p_note), ''),
    status_changed_at = now(),
    updated_at = now()
  where id = p_id;

  perform sa_log(
    'restaurant.status',
    'Tila: ' || v_old::text || ' -> ' || p_status::text || ' (' || v_name || ')',
    'restaurant', p_id, v_name,
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', p_status, 'note', nullif(trim(p_note), '')),
    p_status in ('suspended', 'cancelled', 'archived')
  );
end;
$$;

create or replace function sa_set_plan(p_id uuid, p_plan restaurant_plan)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old restaurant_plan;
  v_name text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select plan, name into v_old, v_name from restaurants where id = p_id;
  if v_name is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  update restaurants set plan = p_plan, updated_at = now() where id = p_id;

  perform sa_log(
    'restaurant.plan',
    'Paketti: ' || v_old::text || ' -> ' || p_plan::text || ' (' || v_name || ')',
    'restaurant', p_id, v_name,
    jsonb_build_object('plan', v_old),
    jsonb_build_object('plan', p_plan),
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Käyttäjät
-- ---------------------------------------------------------------------------

create or replace function sa_set_member_active(p_membership uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_rest text;
  v_rid uuid;
  v_was boolean;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select p.full_name, r.name, r.id, m.active
    into v_name, v_rest, v_rid, v_was
  from memberships m
  join restaurants r on r.id = m.restaurant_id
  left join profiles p on p.id = m.user_id
  where m.id = p_membership;

  if v_rest is null then
    raise exception 'Kayttajaa ei loydy';
  end if;

  update memberships set active = p_active, updated_at = now() where id = p_membership;

  perform sa_log(
    case when p_active then 'user.activated' else 'user.deactivated' end,
    coalesce(v_name, 'Kayttaja') || ' - ' ||
      (case when p_active then 'aktivoitiin' else 'poistettiin kaytosta' end) ||
      ' (' || v_rest || ')',
    'membership', p_membership, v_name,
    jsonb_build_object('active', v_was),
    jsonb_build_object('active', p_active),
    not p_active
  );
end;
$$;

create or replace function sa_set_member_role(p_membership uuid, p_role app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_rest text;
  v_old app_role;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select p.full_name, r.name, m.role into v_name, v_rest, v_old
  from memberships m
  join restaurants r on r.id = m.restaurant_id
  left join profiles p on p.id = m.user_id
  where m.id = p_membership;

  if v_rest is null then
    raise exception 'Kayttajaa ei loydy';
  end if;

  update memberships set role = p_role, updated_at = now() where id = p_membership;

  -- Oikeusmuutos on aina kriittinen: se muuttaa sitä mitä joku näkee.
  perform sa_log(
    'user.role',
    coalesce(v_name, 'Kayttaja') || ': ' || v_old::text || ' -> ' || p_role::text || ' (' || v_rest || ')',
    'membership', p_membership, v_name,
    jsonb_build_object('role', v_old),
    jsonb_build_object('role', p_role),
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Feature flagit
-- ---------------------------------------------------------------------------

create or replace function sa_set_flag(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select enabled into v_old from feature_flags where key = p_key;
  if v_old is null then
    raise exception 'Lippua ei loydy';
  end if;

  update feature_flags set enabled = p_enabled, updated_at = now() where key = p_key;

  perform sa_log(
    'flag.global',
    'Lippu ' || p_key || ': ' || (case when p_enabled then 'paalle' else 'pois' end) || ' kaikille',
    'flag', null, p_key,
    jsonb_build_object('enabled', v_old),
    jsonb_build_object('enabled', p_enabled),
    true
  );
end;
$$;

-- null poistaa poikkeuksen ja palauttaa ravintolan globaaliin
-- oletukseen. Ilman kolmatta arvoa poikkeuksen voisi luoda muttei
-- purkaa.
create or replace function sa_set_flag_for(p_key text, p_restaurant uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select name into v_name from restaurants where id = p_restaurant;
  if v_name is null then
    raise exception 'Ravintolaa ei loydy';
  end if;

  if p_enabled is null then
    delete from feature_flag_restaurants
     where flag_key = p_key and restaurant_id = p_restaurant;
  else
    insert into feature_flag_restaurants (flag_key, restaurant_id, enabled)
    values (p_key, p_restaurant, p_enabled)
    on conflict (flag_key, restaurant_id) do update set enabled = excluded.enabled;
  end if;

  perform sa_log(
    'flag.restaurant',
    'Lippu ' || p_key || ' / ' || v_name || ': ' ||
      coalesce(case when p_enabled then 'paalle' else 'pois' end, 'oletukseen'),
    'flag', p_restaurant, p_key, null,
    jsonb_build_object('enabled', p_enabled), true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Pysyvä poisto
-- ---------------------------------------------------------------------------
--
-- Vahvistus on ravintolan nimi kirjoitettuna. Nimi on parametri eikä
-- valintaruutu: valintaruudun voi klikata vahingossa, nimeä ei voi
-- kirjoittaa vahingossa. Tarkistus on kannassa, joten käyttöliittymän
-- ohittaminen ei auta.
--
-- Loki kirjoitetaan ennen poistoa. Poiston jälkeen kirjoitettu rivi ei
-- ehtisi syntyä jos poisto kaataa transaktion, ja juuri se rivi olisi
-- se jota jälkikäteen etsitään.

create or replace function sa_delete_restaurant(p_id uuid, p_confirm text)
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
    'shifts',   (select count(*) from shifts where restaurant_id = p_id),
    'tasks',    (select count(*) from tasks where restaurant_id = p_id)
  ) into v_snapshot;

  perform sa_log(
    'restaurant.deleted',
    'Ravintola poistettiin pysyvasti: ' || v_name,
    'restaurant', p_id, v_name, v_snapshot, null, true
  );

  delete from restaurants where id = p_id;
end;
$$;

grant execute on function sa_create_restaurant to authenticated;
grant execute on function sa_invite_owner to authenticated;
grant execute on function sa_update_restaurant to authenticated;
grant execute on function sa_set_status to authenticated;
grant execute on function sa_set_plan to authenticated;
grant execute on function sa_set_member_active to authenticated;
grant execute on function sa_set_member_role to authenticated;
grant execute on function sa_set_flag to authenticated;
grant execute on function sa_set_flag_for to authenticated;
grant execute on function sa_delete_restaurant to authenticated;


-- ===========================================================================
-- 0058_accounting_vat_lock_audit.sql
-- ===========================================================================

-- 0058 — ALV, tasmaytys, lukitus, korjaukset ja jaljitettavyys
--
-- Sisalto on ajettu tuotantoon migraationa accounting_vat_lock_audit.
-- Tama tiedosto pitaa repositorion ja kannan samassa linjassa.
--
-- KIRJATTUA EI MUUTETA
--
-- Rivien lukko oli jo 0056:ssa. Tama suojaa itse tositteen: summat ovat
-- riveilla, mutta paivamaaran tai tilikauden vaihtaminen siirtaisi
-- kirjatun tapahtuman toiseen kauteen hiljaa.
--
-- KORJAUS ON PEILIKUVA
--
-- Alkuperainen sailyy koskemattomana. Korjaustosite kaantaa debetin ja
-- kreditin, jolloin kirjaus kumoutuu ja molemmat jaavat nakyviin.
-- Korjaus vaatii syyn.
--
-- SULKU EI OHITA TASMAYTYSTA
--
-- Vaatimus 19: kuukautta ei merkita valmiiksi jos kriittinen tasmaytys
-- epaonnistuu. Tarkistus on ledger_close_monthissa eika
-- kayttoliittymassa, joten sita ei voi kiertaa.
--
-- JALJITETTAVYYS RAVINTOLAN OMAAN LOKIIN
--
-- Kirjataan audit_logiin eika omaan tauluun: kayttajalla on jo yksi
-- toimintaloki, ja toinen rinnakkainen tarkoittaisi kahta paikkaa
-- joista etsia.
--
-- Funktiot: ledger_entry_lukko, ledger_audit, ledger_post,
-- ledger_reject, ledger_correct, ledger_vat_summary,
-- ledger_month_status, ledger_close_month.
--
-- TODENNETTU peruutettavassa transaktiossa: kirjaus toimii, kirjattua
-- ei voi poistaa eika siirtaa, korjaus on tasapainossa ja linkitetty,
-- alkuperainen sailyy, syy vaaditaan, ALV-yhteenveto ja kuukauden tila
-- palautuvat, sulku estyi tasmaytyksen takia, loki sai 9 rivia.


-- ===========================================================================
-- 0058_super_admin_grants.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0058 — Liput käyttöön ja oikeudet kuntoon
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Liput
-- ---------------------------------------------------------------------------
--
-- Oletuksena päällä. Olemassa olevat ravintolat käyttävät näitä
-- ominaisuuksia jo, ja pois-oletus sammuttaisi ne kaikilta samalla
-- hetkellä kun migraatio ajetaan.
--
-- Lippu on koodin tuntema nimi, joten se syntyy migraatiossa eikä
-- käyttöliittymästä: käyttöliittymästä luotu lippu ei vastaisi mitään
-- koodissa olevaa ehtoa.

insert into feature_flags (key, label, description, enabled) values
  ('lunch_module',     'Lounaslista',        'Julkinen lounaslista ja sen hallinta.', true),
  ('ai_assistant',     'Matti',              'AI-tyokaveri: analyysit ja ehdotukset.', true),
  ('payroll',          'Palkat',             'Palkkalaskelmat ja palkkakaudet.', true),
  ('tasks',            'Tehtavat',           'Tehtavat ja maaraajat.', true),
  ('advanced_reports', 'Laajat raportit',    'Excel- ja CSV-vienti seka kuukausiraportti.', true),
  ('shift_planning',   'Tyovuorosuunnittelu','Vuorojen suunnittelu ja kuukauden lista.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- anon pois
-- ---------------------------------------------------------------------------
--
-- Supabasen oletusoikeudet antavat EXECUTEn public-skeeman uusille
-- funktioille kolmelle roolille: anon, authenticated ja service_role.
-- "revoke from public" ei kumoa niitä, koska ne ovat nimenomaisia
-- rooligrantteja eivätkä PUBLIC-grantti.
--
-- Portti hylkäisi kirjautumattoman joka tapauksessa: auth.uid() on
-- silloin null, joten current_user_is_super_admin() palauttaa
-- epätoden. Tämä on toinen kerros — kutsua ei pääse edes yrittämään.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'sa\_%'
  loop
    execute format('revoke all on function %s from anon', f.sig);
  end loop;
end
$$;

-- sa_log on sisäinen apuri: sitä kutsuvat vain muut security definer
-- -funktiot, jotka ajavat määrittelijän oikeuksin. Kutsujan oma oikeus
-- ei siis ole tarpeen — ja ilman sitä lokiin ei voi kirjoittaa suoraan
-- ohi varsinaisten toimintojen.
revoke all on function sa_log from authenticated;

-- ---------------------------------------------------------------------------
-- Ensimmäinen ylläpitäjä
-- ---------------------------------------------------------------------------
--
-- Järjestelmätason rooli. Se ei muuta tenant-roolia eikä tenant-rooli
-- anna sitä: profiilin lippu ja jäsenyyden rooli ovat eri asioita.
--
-- Sähköpostilla eikä tunnisteella, jotta migraatio ei sisällä
-- ympäristökohtaista uuid:tä. Jos käyttäjää ei ole, ei tapahdu mitään
-- — tuoreessa kannassa ensimmäinen ylläpitäjä nimetään käsin.

update profiles p
set is_super_admin = true, updated_at = now()
from auth.users u
where u.id = p.id
  and u.email = 'oktay.hun@icloud.com'
  and not coalesce(p.is_super_admin, false);


-- ===========================================================================
-- 0059_accounting_reports.sql
-- ===========================================================================

-- 0059 — Raportit
--
-- Ajettu tuotantoon migraatioina accounting_reports ja
-- fix_balance_sheet_result. Tama tiedosto pitaa repositorion ja kannan
-- samassa linjassa.
--
-- KAIKKI LASKETAAN KIRJANPIDON TAULUISTA.
--
-- Frontend ei laske summia irrallisesta datasta: silloin raportti ja
-- kirjanpito voisivat erota, ja kumpi olisi oikeassa?
--
-- ESITYS EI NAY VIRALLISESSA RAPORTISSA.
--
-- Oletuksena mukaan vain kirjatut tositteet. Parametri sallii
-- esitysten mukaanoton kesken kuukauden tarkastelua varten, ja
-- raportti kertoo itse kumpaa se nayttaa (includesProposed).
--
-- TILIKAUDEN TULOS ON TASEESSA OMANA RIVINAAN.
--
-- Tuotto- ja kulutilit eivat ole vastaavaa eivatka vastattavaa, joten
-- ilman sita puolet eivat tasmaa.
--
-- Funktiot: ledger_journal, ledger_general, ledger_income_statement,
-- ledger_balance_sheet.
--
-- TODENNETTU peruutettavassa transaktiossa oikealla datalla:
-- paivakirja 7 tositetta, paakirja 19 tilia, tuloslaskelma tasmaa
-- (117687 - 83241 = 34446) ja tase tasmaa (50429 = 50429).


-- ===========================================================================
-- 0059_lock_super_admin_column.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0059 — Kukaan ei korota itseään ylläpitäjäksi
-- ---------------------------------------------------------------------------
--
-- OIKEUKSIEN LAAJENNUSAUKKO.
--
-- profiles-taulun päivityskäytäntö on:
--   using (id = auth.uid()) with check (id = auth.uid())
--
-- Rivikäytäntö rajaa rivejä, ei sarakkeita. Sama käytäntö salli siis
-- myös is_super_admin-sarakkeen kirjoittamisen, ja kuka tahansa
-- kirjautunut käyttäjä — työntekijä mukaan lukien — olisi voinut
-- kutsua suoraan API:a:
--
--   update profiles set is_super_admin = true where id = <oma id>
--
-- ja saada järjestelmätason oikeudet jokaiseen ravintolaan.
--
-- Sarake on ollut kannassa ennen Developer Consolea, mutta mikään ei
-- lukenut sitä, joten aukko ei ollut hyödynnettävissä. Konsoli teki
-- siitä oikean: nyt lippu ratkaisee pääsyn kaikkien asiakkaiden
-- tietoihin.
--
-- KAKSI LUKKOA, KOSKA NE PETTÄVÄT ERI TAVOIN.
--
-- Sarakeoikeus katkaisee API-polun: PostgREST ei pysty kirjoittamaan
-- saraketta lainkaan, eikä kutsu edes yritä.
--
-- Liipaisin kattaa kaiken muun. Se pysäyttäisi myös security definer
-- -funktion joka vahingossa päivittäisi profiilirivin kokonaisena ja
-- veisi lipun mukanaan.

revoke update (is_super_admin) on public.profiles from anon, authenticated;

create or replace function guard_super_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_super_admin, false) is distinct from coalesce(old.is_super_admin, false) then
    /*
     * auth.uid() on null kun ajetaan migraatiosta tai palvelinavaimella.
     *
     * Silloin kyse on hallitusta ylläpitotoimesta eikä käyttäjän
     * pyynnöstä, ja se sallitaan — muuten ensimmäistä ylläpitäjää ei
     * voisi nimetä lainkaan, koska nimeäminen vaatisi ylläpitäjän joka
     * ei vielä ole olemassa.
     */
    if auth.uid() is not null and not current_user_is_super_admin() then
      raise exception 'Jarjestelmatason oikeutta ei voi asettaa itselle';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_super_admin on public.profiles;
create trigger profiles_guard_super_admin
  before update on public.profiles
  for each row
  execute function guard_super_admin_flag();

comment on function guard_super_admin_flag is
  'Estaa is_super_admin-lipun asettamisen ilman olemassa olevaa yllapitajan oikeutta.';


-- ===========================================================================
-- 0060_tax_guides.sql
-- ===========================================================================

-- 0060 — Veroasioiden ohjeet
--
-- Ajettu tuotantoon migraationa tax_guides.
--
-- OHJE ON DATAA, EI KOODIA.
--
-- Viranomaisohje muuttuu, ja komponenttiin kirjoitettuna se vaatisi
-- julkaisun joka kerta. Taulussa se on paivitettavissa, ja
-- effective_from / effective_until kertovat milloin ohje patee.
-- Vanhentunut ohje jaa historiaksi muttei nay: vaara ohje on pahempi
-- kuin puuttuva.
--
-- BUDET EI LAHETA MITAAN.
--
-- Ohjeet kertovat mita kayttajan pitaa tehda OmaVerossa. Budet laskee
-- luvut ja kertoo milloin, mutta ilmoituksen tekee ihminen. Vaite
-- lahetetysta ilmoituksesta olisi vaara ja vaarallinen, ja siksi se
-- lukee kayttoliittymassa ylimpana.
--
-- Taulu: tax_guides. Luku kaikille kirjautuneille (ohjeet eivat
-- sisalla ravintolan tietoja), kirjoitus vain yllapitajalle.


-- ===========================================================================
-- 0061_accounting_fixes.sql
-- ===========================================================================

-- 0061 — Ääkköset, pyöristystili ja ALV kassan taulusta
--
-- Ajettu tuotantoon migraatioina tax_guides_finnish_text,
-- accounting_finnish_text, accounting_finnish_messages,
-- accounting_finnish_seed_and_errors, accounting_rounding_account ja
-- accounting_vat_from_pos_table.
--
-- ÄÄKKÖSET
--
-- Kirjoitin kannan tekstit alun perin ilman ääkkösiä varmuuden
-- vuoksi. Ne näkyvät käyttäjälle sellaisinaan, ja sivulla luki
-- "Myynti ei tasmaa" ja "6 kuittia ei ole viela kirjanpidossa".
-- Migraatiotyökalu käsittelee UTF-8:n oikein, joten varmuus oli
-- turha ja vika näkyvä.
--
-- ALV KIRJATAAN KASSAN OMASTA TAULUSTA
--
-- Löytyi ajamalla oikealla datalla: täsmäytys näytti neljä senttiä
-- eroa jota kukaan ei voinut selittää.
--
-- Syy oli kaksi eri jakoa samasta brutosta. Myyntiryhmien rivit
-- (daily_sales_lines) jakavat päivän tuotteiden mukaan, kassan
-- ALV-taulu (daily_sales_vat) verokantojen mukaan. Molemmat
-- summautuvat samaan bruttoon mutta pyöristyvät eri tavalla:
-- 25.08. rivit sanoivat ALV 15983, kassa 15987.
--
-- Verokannoittainen jako on se joka menee veroilmoitukselle, joten
-- ALV kirjataan siitä. Myyntiryhmät kertovat mistä tuotoista on
-- kyse, joten liikevaihto kirjataan niistä.
--
-- PYÖRISTYS OMALLE TILILLEEN (3900)
--
-- Aiemmin ALV kirjattiin erotuksena bruttoon, jotta tosite täsmää
-- varmasti. Se toimi mutta siirsi eron ALV-tilille — juuri sinne
-- missä se on vaikeinta huomata. Nyt jäännös menee pyöristystilille
-- ja ALV-täsmäytys menee tasan.
--
-- Todennettu selaimessa oikealla datalla: tila vaihtui "Vaatii
-- tarkistusta" -> "Avoin", ja tase täsmää 504,29 = 504,29.


-- ===========================================================================
-- 0062_accounting_automatic.sql
-- ===========================================================================

-- 0062 — Kirjanpito syntyy itsestaan
--
-- Ajettu tuotantoon migraatioina accounting_automatic_at_source ja
-- accounting_close_posts_proposals.
--
-- AUTOMATIIKKA KUULUU LAHTEELLE, EI SIVUN LATAUKSELLE.
--
-- "Hae tapahtumat" -painike oli vaara ratkaisu kahdesta syysta.
-- Ravintoloitsijan piti muistaa painaa sita, ja jos han unohti,
-- kirjanpito oli tyhja vaikka kaikki data oli tallessa. Sivun
-- lataukseen sidottuna se taas olisi kirjoittanut kantaan joka kerta
-- kun joku vain katsoo sivua - myos linkin esihaun yhteydessa.
--
-- Nyt kirjaus syntyy silla hetkella kun lahde tallennetaan.
-- Liipaisimet: receipts, daily_sales, daily_sales_lines,
-- daily_sales_vat. Uusi ravintola saa tilikartan ja kohdistukset
-- heti, ja uusi myyntiryhma oman kohdistuksensa.
--
-- ESITYS SEURAA LAHDETTA.
--
-- Kuitin kategorian muutos muodostaa esityksen uudelleen. Kirjattuun
-- ei kosketa: siihen tehdaan korjaustosite.
--
-- KIRJANPITO EI SAA ESTAA TYOTA.
--
-- Liipaisin nielee virheen. Jos kirjaus epaonnistuu, kuitin tallennus
-- onnistuu silti ja kuukauden tila kertoo etta se ei ole viela
-- kirjanpidossa. Lahdedata on tarkeampaa kuin siita johdettu kirjaus.
--
-- YKSI PAINALLUS KUUKAUDESSA, EI KAHTA.
--
-- Sulku kieltaytyi aiemmin jos esityksia oli hyvaksymatta, joten piti
-- painaa ensin "Kirjaa kaikki" ja sitten "Sulje kuukausi".
-- Ensimmainen oli pelkka esiehto toiselle, eika esiehto ansaitse omaa
-- painiketta. Nyt sulku kirjaa esitykset itse. Tasmaytys estaa yha -
-- se ei ole esiehto vaan syy olla sulkematta.
--
-- TODENNETTU peruutettavassa transaktiossa: kuitti kirjautui
-- itsestaan, tosite tasapainossa, oikea kulutili, kategorian muutos
-- muodosti esityksen uudelleen, ei duplikaattia, tarkistamaton kuitti
-- ei kirjaudu.


-- ===========================================================================
-- 0063_lunch_price_sort_order.sql
-- ===========================================================================

-- 0063 — Lounashintojen järjestys
--
-- Ajettu tuotantoon migraationa lunch_price_sort_order.
--
-- set_lunch_price ei asettanut sort_orderia lainkaan, joten jokainen
-- hinta sai oletuksen. Yhden hinnan aikaan sillä ei ollut väliä, mutta
-- opiskelija-, lapsi- ja eläkeläishintojen kanssa järjestys putoaisi
-- aakkosiin: Eläkeläinen, Lapsi, Lounas, Opiskelija. Päähinta olisi
-- listan kolmas.
--
-- Järjestys tulee nyt sovelluksesta (priceSortOrder). Nimet ja niiden
-- järjestys ovat samaa tuotesanastoa, ja se asuu samassa paikassa kuin
-- näkyvät tekstit — ei kahdessa.
--
-- Parametrin lisääminen tekee ylikuormituksen, joten vanha versio
-- pudotetaan ensin.
--
-- VAROITUS SEURAAVALLE
--
-- Olemassa olevien rivien täydennys laukaisi lunch_prices_touch
-- -liipaisimen ja merkitsi julkaistut viikot muuttuneiksi, vaikka
-- asiakkaalle ei muuttunut mitään. Sisältötauluja koskeva
-- massapäivitys on tehtävä niin että content_updated_at palautetaan
-- jälkikäteen — muuten jokainen huoltotoimi näyttää
-- ravintoloitsijalle julkaisemattomalta muutokselta.


-- ===========================================================================
-- 0064_locale_support.sql
-- ===========================================================================

-- 0064 — Kielituki
--
-- Ajettu tuotantoon migraationa locale_support_v2.
--
-- KÄYTTÄJÄN KIELI OLI JO OLEMASSA.
--
-- profiles.locale on ollut kannassa alusta asti (text, arvo 'fi').
-- Uutta saraketta ei tarvittu; se sai enum-tyypin, oletuksen ja
-- not null -rajoitteen. Vanha tekstioletus piti pudottaa ensin:
-- sitä ei voi muuntaa automaattisesti enum-tyyppiin.
--
-- RAVINTOLAN OLETUSKIELI ON ERI ASIA KUIN KÄYTTÄJÄN KIELI.
--
-- restaurants.default_locale on oletus uudelle käyttäjälle ja
-- järjestelmän lähettämille viesteille. Jokainen käyttäjä voi silti
-- valita omansa: keittiössä voi olla kuusi kieltä eikä yksi niistä
-- ole väärin.
--
-- Funktiot set_my_locale ja set_restaurant_locale suoran päivityksen
-- sijaan: käyttäjä saa vaihtaa vain oman kielensä, ja ravintolan
-- oletuksen vain omistaja.
--
-- app_locale-enum sisältää samat 30 kieltä kuin
-- lib/i18n/app-locales.ts. Testi varmistaa että sovelluksen lista
-- kelpaa Intlille; kannan enum estää kelvottoman arvon.


-- ===========================================================================
-- 0065_locale_estonian.sql
-- ===========================================================================

-- 0065 — Viro kielivalikoimaan
--
-- KAKSI LISTAA OLIVAT AJAUTUNEET ERILLEEN.
--
-- Julkisilla sivuilla oli kuusi kieltä (fi, en, sv, da, tr, et) ja
-- sovelluksessa oma kolmenkymmenen kielen luettelo. Viro oli vain
-- ensimmäisessä: sivu oli olemassa, mutta sitä ei voinut valita
-- sovelluksessa eikä app_locale-enum tuntenut arvoa.
--
-- Sovelluksen lista on nyt johdettu julkisten sivujen listasta
-- (lib/i18n/app-locales.ts lukee locales.ts:stä), joten ne eivät voi
-- enää erota. Kanta tarvitsee silti puuttuvan arvon.
--
-- ENUMISTA EI POISTETA MITÄÄN.
--
-- Samassa yhteydessä sovelluksesta poistettiin 25 kieltä, joita ei
-- ollut käännetty. Niiden arvot jäävät enumiin, koska Postgresissa
-- enum-arvon poisto vaatii koko tyypin uudelleenluonnin ja kaikkien
-- sitä käyttävien sarakkeiden muuntamisen. Enum on siis sovelluksen
-- listan ylijoukko, ja se on turvallinen suunta: kanta hyväksyy
-- arvon jota sovellus ei tarjoa, muttei päinvastoin.
--
-- Tarkistettu ennen ajoa: profiles.locale ja restaurants.default_locale
-- olivat kaikilla riveillä 'fi', joten yhdenkään käyttäjän kieli ei
-- jäänyt kelvottomaksi.

alter type app_locale add value if not exists 'et';


-- ===========================================================================
-- 0066_reservations.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0066 — Pöytävaraukset
-- ---------------------------------------------------------------------------
--
-- Ravintola hallitsee pöytiä ja varauksia Katessa. Asiakas varaa
-- ravintolan omalla verkkosivulla upotetun widgetin kautta. Asiakkaan ei
-- tarvitse tietää että taustalla on Kate, eikä hänen tarvitse luoda
-- tunnusta.
--
-- ---------------------------------------------------------------------------
-- 1. VARAUS EI OLE PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Varauksella on henkilömäärä ja aika; pöytä on erillinen liitos.
-- Sama varaus voi käyttää yhtä pöytää tai useaa yhdistettyä, ja
-- vuoropäällikkö voi vaihtaa pöydän illan aikana koskematta varaukseen.
-- Jos pöytä olisi sarake varauksessa, kuuden hengen seurue kahdessa
-- pöydässä ei mahtuisi tietomalliin lainkaan.
--
-- ---------------------------------------------------------------------------
-- 2. PÄÄLLEKKÄISYYS ON KANNAN ESTÄMÄ, EI SOVELLUKSEN
-- ---------------------------------------------------------------------------
--
-- reservation_table_assignments kantaa exclusion-rajoitetta: sama pöytä
-- ei voi olla kahdessa päällekkäisessä varauksessa. Rajoite ei ole
-- optimointi vaan viimeinen sana. Kaksi yhtäaikaista varausyritystä ei
-- voi molempi onnistua, vaikka sovelluskoodissa olisi vika — toinen
-- kaatuu rajoitteeseen.
--
-- Rajoitteen lisäksi varausfunktio ottaa neuvoa-antavan lukon
-- ravintolakohtaisesti. Ilman sitä molemmat yritykset etsisivät vapaan
-- pöydän samaan aikaan, päätyisivät samaan pöytään ja häviäjä saisi
-- rajoitevirheen sen sijaan että löytäisi seuraavan vapaan pöydän.
-- Lukko tekee haun ja kirjoituksen atomiseksi; rajoite varmistaa ettei
-- lukon unohtaminen riko mitään.
--
-- ---------------------------------------------------------------------------
-- 3. PERUTTU VARAUS EI VARAA PÖYTÄÄ MUTTA SÄILYY
-- ---------------------------------------------------------------------------
--
-- Liitosrivillä on blocking-lippu, ja exclusion-rajoite koskee vain
-- lipullisia rivejä. Peruutus laskee lipun eikä poista riviä: pöytä
-- vapautuu heti, mutta tieto siitä kuka oli varannut ja mihin pöytään
-- jää jäljelle. Rivin poistaminen veisi historian mukanaan.
--
-- ---------------------------------------------------------------------------
-- 4. ASIAKAS EI LUE TAULUJA
-- ---------------------------------------------------------------------------
--
-- Sama ratkaisu kuin julkisella lounaslistalla (0016): anon-roolille ei
-- anneta lukuoikeutta yhteenkään tauluun. Julkinen widget kutsuu neljää
-- security definer -funktiota, jotka palauttavat vain sen mitä varaamiseen
-- tarvitaan. Yksi tarkistettava rajapinta on tarkistettavissa; kymmenen
-- käytäntöä eri tauluissa ei.
--
-- Erityisesti: julkinen funktio ei koskaan ota restaurant_id:tä
-- parametrina vaan slugin, ja hakee tunnisteen itse. Clientin lähettämä
-- tunniste on clientin valitsema.
--
-- ---------------------------------------------------------------------------
-- 5. HENKILÖTIEDOT
-- ---------------------------------------------------------------------------
--
-- Kerätään nimi, puhelin ja valinnainen sähköposti — se mitä pöydän
-- varaamiseen tarvitaan, ei enempää. Taulun lukuoikeus on
-- esihenkilötasolla. Työntekijä näkee illan varaukset funktion kautta,
-- ja funktio jättää puhelimen ja sähköpostin pois jos kutsuja ei ole
-- esihenkilö. Sarakekohtaista rajausta ei saa rivikäytännöllä, joten se
-- tehdään siellä missä se on mahdollista.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type reservation_status as enum (
    'pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_source as enum ('widget', 'link', 'admin', 'walk_in');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Salin alueet
-- ---------------------------------------------------------------------------

create table if not exists dining_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists dining_areas_restaurant_idx
  on dining_areas (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Pöydät
-- ---------------------------------------------------------------------------

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Alue on valinnainen: pieni ravintola on yksi tila. */
  area_id uuid references dining_areas (id) on delete set null,

  /* "1", "12", "Ikkuna" — ravintolan oma merkintä, ei juokseva numero. */
  name text not null check (length(trim(name)) > 0),

  /*
   * Vähimmäis- ja enimmäiskapasiteetti.
   *
   * Vähimmäismäärä ei ole saivartelua: kahden hengen seurue neljän
   * hengen pöydässä lauantai-iltana tarkoittaa kahta menetettyä
   * paikkaa. Ravintola saa itse päättää sallitaanko se.
   */
  seats_min int not null default 1 check (seats_min >= 1),
  seats_max int not null check (seats_max >= 1),

  active boolean not null default true,

  /* Pöytäkartan sijainti prosentteina salin leveydestä ja korkeudesta. */
  pos_x numeric(5, 2) check (pos_x is null or (pos_x >= 0 and pos_x <= 100)),
  pos_y numeric(5, 2) check (pos_y is null or (pos_y >= 0 and pos_y <= 100)),

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurant_tables_seats check (seats_max >= seats_min),
  unique (restaurant_id, name)
);

create index if not exists restaurant_tables_restaurant_idx
  on restaurant_tables (restaurant_id, sort_order);
create index if not exists restaurant_tables_area_idx
  on restaurant_tables (area_id);

-- ---------------------------------------------------------------------------
-- Pöytien yhdistelmät
-- ---------------------------------------------------------------------------
--
-- YHDISTELMÄT MÄÄRITELLÄÄN, NIITÄ EI PÄÄTELLÄ.
--
-- Järjestelmä ei tiedä mitkä pöydät ovat vierekkäin, mitkä niistä
-- voi siirtää yhteen ja mitkä ovat eri puolilla salia. Automaattinen
-- yhdistely varaisi kuuden hengen seurueen kahteen pöytään joiden
-- välissä on baaritiski. Ravintola kertoo mitkä yhdistelmät ovat
-- oikeasti mahdollisia.

create table if not exists table_combinations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Vapaaehtoinen nimi. Ilman sitä käyttöliittymä listaa pöytien nimet. */
  name text,

  /*
   * Yhdistelmän kapasiteetti erikseen, ei jäsenten summana.
   *
   * Kaksi kahden hengen pöytää yhteen on neljä paikkaa vain jos
   * päädyt käyvät. Usein yhdistetty pöytä vetää vähemmän kuin osiensa
   * summan, joskus enemmän. Ravintola tietää, laskutoimitus ei.
   */
  seats_min int not null check (seats_min >= 1),
  seats_max int not null check (seats_max >= 1),

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint table_combinations_seats check (seats_max >= seats_min)
);

create index if not exists table_combinations_restaurant_idx
  on table_combinations (restaurant_id) where active;

create table if not exists table_combination_members (
  combination_id uuid not null references table_combinations (id) on delete cascade,
  table_id uuid not null references restaurant_tables (id) on delete cascade,
  primary key (combination_id, table_id)
);

create index if not exists table_combination_members_table_idx
  on table_combination_members (table_id);

-- ---------------------------------------------------------------------------
-- Varausasetukset
-- ---------------------------------------------------------------------------

create table if not exists reservation_settings (
  restaurant_id uuid primary key references restaurants (id) on delete cascade,

  /* Otetaanko varauksia vastaan lainkaan. */
  enabled boolean not null default false,

  /* Aikaväli minuutteina: 15 tai 30 on tavallinen. */
  slot_minutes int not null default 30
    check (slot_minutes in (15, 20, 30, 60)),

  /* Oletuskesto kun henkilömäärälle ei ole omaa sääntöä. */
  default_duration_minutes int not null default 90
    check (default_duration_minutes between 15 and 600),

  /*
   * Pöydän tyhjennysväli.
   *
   * Varauksen jälkeen pöytä ei ole heti seuraavan käytettävissä. Sama
   * luku antaa pöytäkartalle "siivottavana"-tilan ilman omaa saraketta:
   * pöytä jonka varaus päättyi äsken on tässä tilassa.
   */
  turnaround_minutes int not null default 0
    check (turnaround_minutes between 0 and 120),

  min_party int not null default 1 check (min_party >= 1),
  max_party int not null default 12 check (max_party >= 1),

  /* Kuinka monta päivää eteenpäin varauksia otetaan. */
  max_days_ahead int not null default 60 check (max_days_ahead between 1 and 365),

  /*
   * Kuinka monta minuuttia ennen alkua varaus on vielä mahdollinen.
   *
   * Nolla tarkoittaisi että asiakas voi varata pöydän kello 19:00
   * kello 18:59, eikä keittiö ehdi tietää siitä.
   */
  lead_minutes int not null default 60 check (lead_minutes between 0 and 10080),

  /* Widgetin ulkoasu. Vain se mitä ravintolan ilme oikeasti vaatii. */
  theme_color text not null default '#1f6f5c'
    check (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  theme_dark boolean not null default false,
  theme_radius int not null default 12 check (theme_radius between 0 and 28),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservation_settings_party check (max_party >= min_party)
);

-- ---------------------------------------------------------------------------
-- Kesto henkilömäärän mukaan
-- ---------------------------------------------------------------------------
--
-- Kahden hengen illallinen ei kestä yhtä kauan kuin kuuden. Sääntöjä
-- voi olla nolla, jolloin oletuskesto pätee kaikkiin.

create table if not exists reservation_durations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  min_party int not null check (min_party >= 1),
  /* Null = ylin porras: "7 tai enemmän". */
  max_party int check (max_party is null or max_party >= 1),
  minutes int not null check (minutes between 15 and 600),
  created_at timestamptz not null default now(),

  constraint reservation_durations_range
    check (max_party is null or max_party >= min_party)
);

create index if not exists reservation_durations_lookup
  on reservation_durations (restaurant_id, min_party);

-- ---------------------------------------------------------------------------
-- Aukioloajat
-- ---------------------------------------------------------------------------
--
-- Viikonpäivä 1 = maanantai, 7 = sunnuntai. Sama numerointi kuin
-- ISO-standardissa ja kannan muissa taulukoissa.
--
-- Päivä jolta rivi puuttuu on kiinni. Rivejä voi olla kaksi samalle
-- päivälle: lounas ja illallinen erikseen.

create table if not exists reservation_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  opens time not null,
  /* Viimeinen aika johon voi varata, ei sulkemisaika. */
  last_seating time not null,
  created_at timestamptz not null default now(),

  constraint reservation_hours_order check (last_seating > opens)
);

create index if not exists reservation_hours_lookup
  on reservation_hours (restaurant_id, weekday);

-- ---------------------------------------------------------------------------
-- Poikkeukset
-- ---------------------------------------------------------------------------

create table if not exists reservation_exceptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  exception_date date not null,

  /* Suljettu kokonaan, tai poikkeavat ajat. */
  closed boolean not null default true,
  opens time,
  last_seating time,

  note text,
  created_at timestamptz not null default now(),

  unique (restaurant_id, exception_date),
  constraint reservation_exceptions_hours check (
    closed or (opens is not null and last_seating is not null and last_seating > opens)
  )
);

-- ---------------------------------------------------------------------------
-- Varaukset
-- ---------------------------------------------------------------------------

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Aika on timestamptz, ei date + time.
   *
   * Päällekkäisyys lasketaan aikaväleinä, ja aikaväli joka ylittää
   * kesäajan vaihdoksen on väärä jos se on tallennettu paikallisena
   * kellonaikana. Näyttö muuntaa takaisin ravintolan vyöhykkeelle.
   */
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  party_size int not null check (party_size >= 1),
  status reservation_status not null default 'confirmed',
  source reservation_source not null default 'admin',

  /*
   * Vain se mitä pöydän varaamiseen tarvitaan.
   *
   * Pituusrajat ovat kannassa eivätkä vain lomakkeessa. Julkinen
   * rajapinta ottaa vastaan mitä tahansa, ja megatavun mittainen
   * "nimi" on hyökkäys eikä kirjoitusvirhe.
   */
  guest_name text not null
    check (length(trim(guest_name)) > 0 and length(guest_name) <= 120),
  guest_phone text check (guest_phone is null or length(guest_phone) <= 40),
  guest_email text check (guest_email is null or length(guest_email) <= 160),
  note text check (note is null or length(note) <= 500),

  /*
   * Peruutuslinkin tunniste tiivisteenä.
   *
   * Sama ratkaisu kuin kutsukoodeissa (0009): kannassa on vain
   * tiiviste, joten vuotanut varmuuskopio ei anna kenellekään oikeutta
   * perua toisen varausta. sha256 on pg_catalogissa eikä vaadi
   * pgcryptoa, joka Supabasessa asuu eri skeemassa.
   */
  cancel_token_hash text,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_times check (ends_at > starts_at)
);

create index if not exists reservations_lookup
  on reservations (restaurant_id, starts_at);
create index if not exists reservations_status_idx
  on reservations (restaurant_id, status, starts_at);
create unique index if not exists reservations_cancel_token
  on reservations (cancel_token_hash) where cancel_token_hash is not null;

-- ---------------------------------------------------------------------------
-- Pöytien liitos varaukseen
-- ---------------------------------------------------------------------------

create table if not exists reservation_table_assignments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  table_id uuid not null references restaurant_tables (id) on delete cascade,

  /*
   * Aika toistetaan liitosriville.
   *
   * Exclusion-rajoite tarvitsee aikavälin samalta riviltä; se ei voi
   * lukea sitä toisesta taulusta. Kaksoiskappale on tässä tarkoitettu,
   * ja liipaisin pitää sen ajan tasalla kun varauksen aika muuttuu.
   */
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  /*
   * Varaako tämä rivi pöydän juuri nyt?
   *
   * Peruttu ja toteutunut varaus säilyttävät rivinsä mutta laskevat
   * lipun, jolloin pöytä vapautuu. Exclusion-rajoite koskee vain
   * lipullisia rivejä.
   */
  blocking boolean not null default true,

  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  created_at timestamptz not null default now(),

  constraint reservation_assignments_times check (ends_at > starts_at),
  unique (reservation_id, table_id),

  /*
   * SAMA PÖYTÄ EI VOI OLLA KAHDESSA PÄÄLLEKKÄISESSÄ VARAUKSESSA.
   *
   * Tämä on koko ominaisuuden tärkein rivi. Kaikki muu — saatavuuden
   * laskenta, neuvoa-antavat lukot, käyttöliittymän tarkistukset — on
   * käytettävyyttä. Tämä on se joka pitää, vaikka muu pettäisi.
   */
  constraint reservation_assignments_no_overlap
    exclude using gist (table_id with =, during with &&) where (blocking)
);

create index if not exists reservation_assignments_reservation_idx
  on reservation_table_assignments (reservation_id);
create index if not exists reservation_assignments_table_idx
  on reservation_table_assignments (table_id, starts_at);

-- ---------------------------------------------------------------------------
-- Tilahistoria
-- ---------------------------------------------------------------------------

create table if not exists reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  from_status reservation_status,
  to_status reservation_status not null,
  actor_id uuid references profiles (id) on delete set null,
  actor_name text not null default 'Tuntematon',
  created_at timestamptz not null default now()
);

create index if not exists reservation_status_history_idx
  on reservation_status_history (reservation_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'dining_areas', 'restaurant_tables', 'table_combinations',
    'reservation_settings', 'reservations'
  ] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function touch_updated_at()', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Liitosrivin aika seuraa varausta
-- ---------------------------------------------------------------------------
--
-- Kun varauksen aikaa siirretään, liitosrivien on siirryttävä mukana.
-- Ilman tätä exclusion-rajoite vartioisi vanhaa aikaa ja pöytä
-- näyttäisi varatulta väärään aikaan.

create or replace function sync_reservation_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.status is distinct from old.status
  then
    update reservation_table_assignments
    set starts_at = new.starts_at,
        ends_at = new.ends_at,
        blocking = new.status in ('pending', 'confirmed', 'arrived')
    where reservation_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_sync_assignments on reservations;
create trigger reservations_sync_assignments after update on reservations
  for each row execute function sync_reservation_assignments();

-- ---------------------------------------------------------------------------
-- Tilan muutos historiaan
-- ---------------------------------------------------------------------------

create or replace function log_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name from profiles p where p.id = auth.uid();

  insert into reservation_status_history
    (reservation_id, from_status, to_status, actor_id, actor_name)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    auth.uid(),
    coalesce(v_name, 'Asiakas')
  );

  return new;
end;
$$;

drop trigger if exists reservations_status_history on reservations;
create trigger reservations_status_history after insert or update on reservations
  for each row execute function log_reservation_status();

/*
 * Liipaisinfunktioita ei kutsuta käsin.
 *
 * Postgres kieltäytyy suorasta kutsusta joka tapauksessa, mutta
 * suoritusoikeus jota kukaan ei tarvitse on oikeus jota ei pidä
 * antaa. Molemmat ovat security definer, joten oletusoikeuden
 * jättäminen paikalleen olisi turhaa pinta-alaa.
 */
revoke all on function sync_reservation_assignments from public, anon, authenticated;
revoke all on function log_reservation_status from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- Pöydät, alueet ja asetukset: kaikki ravintolan jäsenet lukevat,
-- esihenkilö kirjoittaa. Pöytäkartta on työkalu salissa, ei salaisuus.
--
-- Varaukset: esihenkilö lukee taulusta suoraan. Työntekijä lukee
-- funktion kautta, joka jättää yhteystiedot pois. Kirjanpitäjä ei näe
-- varauksia lainkaan — ne eivät ole taloustietoa.

alter table dining_areas enable row level security;
alter table restaurant_tables enable row level security;
alter table table_combinations enable row level security;
alter table table_combination_members enable row level security;
alter table reservation_settings enable row level security;
alter table reservation_durations enable row level security;
alter table reservation_hours enable row level security;
alter table reservation_exceptions enable row level security;
alter table reservations enable row level security;
alter table reservation_table_assignments enable row level security;
alter table reservation_status_history enable row level security;

-- dining_areas
drop policy if exists dining_areas_read on dining_areas;
create policy dining_areas_read on dining_areas
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists dining_areas_write on dining_areas;
create policy dining_areas_write on dining_areas
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- restaurant_tables
drop policy if exists restaurant_tables_read on restaurant_tables;
create policy restaurant_tables_read on restaurant_tables
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists restaurant_tables_write on restaurant_tables;
create policy restaurant_tables_write on restaurant_tables
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- table_combinations
drop policy if exists table_combinations_read on table_combinations;
create policy table_combinations_read on table_combinations
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists table_combinations_write on table_combinations;
create policy table_combinations_write on table_combinations
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- table_combination_members: oikeus periytyy yhdistelmältä
drop policy if exists table_combination_members_read on table_combination_members;
create policy table_combination_members_read on table_combination_members
  for select to authenticated
  using (exists (
    select 1 from table_combinations c
    where c.id = combination_id
      and c.restaurant_id in (select my_restaurant_ids())
  ));

drop policy if exists table_combination_members_write on table_combination_members;
create policy table_combination_members_write on table_combination_members
  for all to authenticated
  using (exists (
    select 1 from table_combinations c
    where c.id = combination_id and is_manager(c.restaurant_id)
  ))
  with check (exists (
    select 1 from table_combinations c
    where c.id = combination_id and is_manager(c.restaurant_id)
  ));

-- reservation_settings
drop policy if exists reservation_settings_read on reservation_settings;
create policy reservation_settings_read on reservation_settings
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists reservation_settings_write on reservation_settings;
create policy reservation_settings_write on reservation_settings
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- reservation_durations / hours / exceptions: sama linja
do $$
declare t text;
begin
  foreach t in array array[
    'reservation_durations', 'reservation_hours', 'reservation_exceptions'
  ] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format(
      'create policy %I_read on %I for select to authenticated
       using (restaurant_id in (select my_restaurant_ids()))', t, t
    );
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format(
      'create policy %I_write on %I for all to authenticated
       using (is_manager(restaurant_id))
       with check (is_manager(restaurant_id))', t, t
    );
  end loop;
end $$;

-- reservations: esihenkilö
drop policy if exists reservations_read on reservations;
create policy reservations_read on reservations
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists reservations_write on reservations;
create policy reservations_write on reservations
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- reservation_table_assignments: oikeus periytyy varaukselta
drop policy if exists reservation_assignments_read on reservation_table_assignments;
create policy reservation_assignments_read on reservation_table_assignments
  for select to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

drop policy if exists reservation_assignments_write on reservation_table_assignments;
create policy reservation_assignments_write on reservation_table_assignments
  for all to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ))
  with check (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

-- reservation_status_history: vain luku, kirjoitus liipaisimesta
drop policy if exists reservation_status_history_read on reservation_status_history;
create policy reservation_status_history_read on reservation_status_history
  for select to authenticated
  using (exists (
    select 1 from reservations r
    where r.id = reservation_id and is_manager(r.restaurant_id)
  ));

revoke insert, update, delete on reservation_status_history from authenticated;

-- ---------------------------------------------------------------------------
-- Anonilta viedään taulut kokonaan
-- ---------------------------------------------------------------------------
--
-- Supabase myöntää oletusarvoisesti anon-roolille kaikki oikeudet
-- jokaiseen uuteen public-skeeman tauluun. Rivitason käytännöt estävät
-- pääsyn, koska anonille ei ole yhtään käytäntöä — mutta se on yhden
-- huolimattoman "for all to public" -käytännön päässä siitä ettei estä.
--
-- Käytäntö on suodatin, oikeus on ovi. Kun ovi on kiinni, suodattimen
-- virhe ei päästä ketään sisään. Julkinen widget ei tarvitse tauluja:
-- se kutsuu public_-funktioita, jotka ovat security definer.
--
-- Sama ratkaisu kuin memberships-taulussa, josta lukuoikeus on
-- viety anonilta jo aiemmin.

do $$
declare t text;
begin
  foreach t in array array[
    'dining_areas', 'restaurant_tables', 'table_combinations',
    'table_combination_members', 'reservation_settings',
    'reservation_durations', 'reservation_hours', 'reservation_exceptions',
    'reservations', 'reservation_table_assignments', 'reservation_status_history'
  ] loop
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;


-- ===========================================================================
-- 0067_reservation_engine.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0067 — Varausmoottori
-- ---------------------------------------------------------------------------
--
-- Saatavuus lasketaan kannassa, ei selaimessa. Selain saa listan
-- vapaista ajoista, mutta se on ehdotus: varauksen luonti tarkistaa
-- kaiken uudelleen lukon takana. Selaimen kertoma vapaa aika on
-- vanhentunutta tietoa siitä hetkestä kun se piirrettiin.
--
-- ---------------------------------------------------------------------------
-- Miksi neuvoa-antava lukko
-- ---------------------------------------------------------------------------
--
-- Exclusion-rajoite estää päällekkäisyyden mutta ei ratkaise sitä
-- oikein. Kaksi yhtäaikaista varausta neljälle hengelle: molemmat
-- etsivät vapaan pöydän, molemmat löytävät pöydän 3, toinen kirjoittaa
-- ensin ja toinen kaatuu rajoitteeseen — vaikka pöytä 4 oli vapaa.
--
-- Ravintolakohtainen lukko sarjallistaa haun ja kirjoituksen. Jälkimmäinen
-- yritys näkee ensimmäisen tuloksen ja löytää pöydän 4. Lukko on
-- transaktiokohtainen, joten se vapautuu itsestään myös virhetilanteessa.
--
-- Lukko on ravintolakohtainen eikä globaali: kahden eri ravintolan
-- varaukset eivät odota toisiaan.

-- ---------------------------------------------------------------------------
-- Kesto henkilömäärän mukaan
-- ---------------------------------------------------------------------------

create or replace function reservation_duration_for(
  p_restaurant uuid,
  p_party int
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select d.minutes
      from reservation_durations d
      where d.restaurant_id = p_restaurant
        and d.min_party <= p_party
        and (d.max_party is null or d.max_party >= p_party)
      /* Tarkin sääntö voittaa: kapein väli ensin. */
      order by coalesce(d.max_party, 999) - d.min_party asc, d.min_party desc
      limit 1
    ),
    (select s.default_duration_minutes from reservation_settings s
     where s.restaurant_id = p_restaurant),
    90
  );
$$;

-- ---------------------------------------------------------------------------
-- Päivän aukiolo
-- ---------------------------------------------------------------------------
--
-- Poikkeus voittaa viikonpäivän aina. Suljettu päivä palauttaa nollan
-- riviä, jolloin päivälle ei synny yhtään aikaa.

create or replace function reservation_windows(
  p_restaurant uuid,
  p_date date
)
returns table (opens time, last_seating time)
language sql
stable
security definer
set search_path = public
as $$
  with poikkeus as (
    select * from reservation_exceptions e
    where e.restaurant_id = p_restaurant and e.exception_date = p_date
  )
  select e.opens, e.last_seating
  from poikkeus e
  where not e.closed

  union all

  select h.opens, h.last_seating
  from reservation_hours h
  where h.restaurant_id = p_restaurant
    and h.weekday = extract(isodow from p_date)::int
    and not exists (select 1 from poikkeus);
$$;

-- ---------------------------------------------------------------------------
-- Vapaat pöydät yhdelle aikavälille
-- ---------------------------------------------------------------------------
--
-- Palauttaa pöytien tunnisteet tai null jos kapasiteettia ei ole.
--
-- Yksittäinen pöytä ennen yhdistelmää, ja pienin riittävä ennen
-- suurinta: kahden hengen seuruetta ei istuteta kuuden pöytään jos
-- kahden pöytä on vapaana, eikä pöytiä yhdistetä turhaan.

create or replace function reservation_pick_tables(
  p_restaurant uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_party int,
  p_exclude uuid default null
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_turnaround int;
  v_range tstzrange;
  v_tables uuid[];
begin
  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = p_restaurant;

  /*
   * Tyhjennysväli laajentaa hakuväliä molempiin suuntiin.
   *
   * Rajoite kannassa vartioi vain todellista päällekkäisyyttä; väli on
   * ravintolan toive siitä ettei seuraava seurue istu edellisen
   * lautasten päälle. Esihenkilö voi silti sijoittaa pöydän käsin
   * tiukemmin, ja se on tarkoitus.
   */
  v_range := tstzrange(
    p_start - make_interval(mins => coalesce(v_turnaround, 0)),
    p_end + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  -- 1. Pienin yksittäinen pöytä johon seurue mahtuu.
  select array[t.id] into v_tables
  from restaurant_tables t
  where t.restaurant_id = p_restaurant
    and t.active
    and t.seats_min <= p_party
    and t.seats_max >= p_party
    and not exists (
      select 1 from reservation_table_assignments a
      where a.table_id = t.id
        and a.blocking
        and a.during && v_range
        and (p_exclude is null or a.reservation_id <> p_exclude)
    )
  order by t.seats_max asc, t.sort_order asc, t.name asc
  limit 1;

  if v_tables is not null then
    return v_tables;
  end if;

  -- 2. Pienin yhdistelmä jonka kaikki pöydät ovat vapaana ja käytössä.
  select array_agg(m.table_id order by m.table_id) into v_tables
  from table_combinations c
  join table_combination_members m on m.combination_id = c.id
  where c.id = (
    select c2.id
    from table_combinations c2
    where c2.restaurant_id = p_restaurant
      and c2.active
      and c2.seats_min <= p_party
      and c2.seats_max >= p_party
      and exists (select 1 from table_combination_members x where x.combination_id = c2.id)
      and not exists (
        select 1
        from table_combination_members m2
        join restaurant_tables t2 on t2.id = m2.table_id
        where m2.combination_id = c2.id
          and (
            not t2.active
            or exists (
              select 1 from reservation_table_assignments a
              where a.table_id = m2.table_id
                and a.blocking
                and a.during && v_range
                and (p_exclude is null or a.reservation_id <> p_exclude)
            )
          )
      )
    order by c2.seats_max asc, c2.created_at asc
    limit 1
  )
  group by c.id;

  return v_tables;
end;
$$;

-- ---------------------------------------------------------------------------
-- Päivän vapaat ajat
-- ---------------------------------------------------------------------------

create or replace function reservation_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns table (slot_time time, starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_slot int;
  v_lead int;
  v_minutes int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  select s.slot_minutes, s.lead_minutes into v_slot, v_lead
  from reservation_settings s where s.restaurant_id = p_restaurant;

  if v_slot is null then return; end if;

  v_minutes := reservation_duration_for(p_restaurant, p_party);

  return query
  with ikkunat as (
    select w.opens, w.last_seating from reservation_windows(p_restaurant, p_date) w
  ),
  ajat as (
    select
      (w.opens + make_interval(mins => v_slot * g.n))::time as t
    from ikkunat w
    cross join lateral generate_series(
      0,
      /* Viimeinen istumisaika on mukana, sen jälkeiset eivät. */
      greatest(0, floor(extract(epoch from (w.last_seating - w.opens)) / 60 / v_slot)::int)
    ) as g(n)
  ),
  ehdokkaat as (
    select distinct a.t,
           ((p_date + a.t) at time zone v_tz) as alkaa
    from ajat a
  )
  select e.t, e.alkaa
  from ehdokkaat e
  where
    /* Menneisyyteen ei varata, eikä liian lyhyellä varoitusajalla. */
    e.alkaa >= now() + make_interval(mins => coalesce(v_lead, 0))
    and reservation_pick_tables(
          p_restaurant,
          e.alkaa,
          e.alkaa + make_interval(mins => v_minutes),
          p_party,
          p_exclude
        ) is not null
  order by e.t;
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen luonti
-- ---------------------------------------------------------------------------
--
-- Yksi funktio kaikille lähteille. Julkinen widget, hallintanäkymä ja
-- walk-in kulkevat tästä, jotta sääntö on yksi eikä kolme.
--
-- p_tables antaa esihenkilön ohittaa automaattivalinnan. Julkinen
-- rajapinta ei koskaan välitä sitä.

create or replace function reservation_book(
  p_restaurant uuid,
  p_start timestamptz,
  p_party int,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source reservation_source,
  p_status reservation_status default 'confirmed',
  p_minutes int default null,
  p_tables uuid[] default null,
  p_cancel_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
begin
  /*
   * Lukko ennen hakua.
   *
   * Kaikki tämän ravintolan varausyritykset kulkevat tästä jonossa.
   * Transaktiokohtainen: vapautuu commitissa ja rollbackissa.
   */
  perform pg_advisory_xact_lock(hashtext('kate:reservation:' || p_restaurant::text));

  v_minutes := coalesce(p_minutes, reservation_duration_for(p_restaurant, p_party));
  v_end := p_start + make_interval(mins => v_minutes);

  if p_tables is null or array_length(p_tables, 1) is null then
    v_tables := reservation_pick_tables(p_restaurant, p_start, v_end, p_party);
  else
    /*
     * Käsin annetut pöydät tarkistetaan silti.
     *
     * Ne kuuluvat tähän ravintolaan ja ovat vapaana — muuten
     * esihenkilö voisi kaksoisvarata pöydän hallintanäkymästä.
     */
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = p_restaurant
      )
    ) then
      raise exception 'Pöytä ei kuulu tähän ravintolaan.'
        using errcode = 'check_violation';
    end if;

    v_tables := p_tables;
  end if;

  if v_tables is null or array_length(v_tables, 1) is null then
    raise exception 'Vapaata pöytää ei ole tähän aikaan.'
      using errcode = 'exclusion_violation';
  end if;

  insert into reservations (
    restaurant_id, starts_at, ends_at, party_size, status, source,
    guest_name, guest_phone, guest_email, note, cancel_token_hash, created_by
  )
  values (
    p_restaurant, p_start, v_end, p_party, p_status, p_source,
    trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    case when p_cancel_token is null then null
         else encode(sha256(p_cancel_token::bytea), 'hex') end,
    auth.uid()
  )
  returning id into v_id;

  foreach v_table in array v_tables loop
    insert into reservation_table_assignments
      (reservation_id, table_id, starts_at, ends_at, blocking)
    values (
      v_id, v_table, p_start, v_end,
      p_status in ('pending', 'confirmed', 'arrived')
    );
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Julkinen rajapinta
-- ---------------------------------------------------------------------------
--
-- Neljä funktiota, ei yhtään taulua. Ravintola tunnistetaan slugista:
-- clientin lähettämä uuid olisi clientin valitsema.

create or replace function public_reservation_config(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_r record;
  v_s record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return null; end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;

  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object(
      'restaurantName', v_r.name,
      'enabled', false
    );
  end if;

  return json_build_object(
    'restaurantName', v_r.name,
    'enabled', true,
    'timezone', v_r.timezone,
    'minParty', v_s.min_party,
    'maxParty', v_s.max_party,
    'maxDaysAhead', v_s.max_days_ahead,
    'today', (now() at time zone v_r.timezone)::date,
    'theme', json_build_object(
      'color', v_s.theme_color,
      'dark', v_s.theme_dark,
      'radius', v_s.theme_radius
    )
  );
end;
$$;

create or replace function public_reservation_slots(
  p_slug text,
  p_date date,
  p_party int
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_r record;
  v_s record;
  v_today date;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return json_build_object('slots', '[]'::json); end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('slots', '[]'::json);
  end if;

  /* Rajat tarkistetaan täällä, ei selaimessa. */
  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('slots', '[]'::json, 'reason', 'party');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;

  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('slots', '[]'::json, 'reason', 'date');
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.slot_time)
      from reservation_slots(v_r.id, p_date, p_party) s
    ), '[]'::json)
  );
end;
$$;

create or replace function public_create_reservation(
  p_slug text,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r record;
  v_s record;
  v_today date;
  v_start timestamptz;
  v_id uuid;
  v_token text;
  v_res record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if coalesce(trim(p_phone), '') = '' then
    return json_build_object('ok', false, 'error', 'phone');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;
  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('ok', false, 'error', 'date');
  end if;

  /*
   * Sama puhelinnumero, korkeintaan viisi tulevaa varausta.
   *
   * Julkinen rajapinta ilman kirjautumista on täytettävissä
   * roskavarauksilla, ja täyteen varattu sali on ravintolalle sama
   * asia kuin suljettu. Raja on puhelinnumerossa eikä IP-osoitteessa,
   * koska numero kerätään joka tapauksessa — IP-osoite olisi uusi
   * henkilötieto pelkkää laskuria varten.
   *
   * Viisi ei osu kehenkään oikeaan asiakkaaseen. Se ei myöskään estä
   * määrätietoista, joka vaihtaa numeroa — mutta ravintola näkee
   * varaukset ja voi perua ne. Tämä katkaisee vahingon ja kiusanteon.
   */
  if (
    select count(*)
    from reservations x
    where x.restaurant_id = v_r.id
      and x.guest_phone = left(trim(p_phone), 40)
      and x.status in ('pending', 'confirmed')
      and x.starts_at > now()
  ) >= 5 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  /*
   * Aika on aukioloajan sisällä ja aikavälin päällä.
   *
   * Ilman tätä asiakas voisi lähettää kellonajan 19:07 ohittaen
   * selaimen tarjoamat vaihtoehdot.
   */
  if not exists (
    select 1 from reservation_windows(v_r.id, p_date) w
    where p_time >= w.opens and p_time <= w.last_seating
  ) then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if extract(epoch from p_time)::int % (v_s.slot_minutes * 60) <> 0 then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  v_start := (p_date + p_time) at time zone v_r.timezone;

  if v_start < now() + make_interval(mins => v_s.lead_minutes) then
    return json_build_object('ok', false, 'error', 'too_late');
  end if;

  /*
   * Peruutustunnus arvotaan kannassa, ei clientissä.
   *
   * gen_random_bytes olisi luontevin, mutta se on pgcryptoa ja asuu
   * Supabasessa extensions-skeemassa — search_path = public ei näe
   * sitä. Sama ansa kuin digestissä (0009). gen_random_uuid on
   * pg_catalogissa ja käyttää samaa satunnaislähdettä; kaksi niistä
   * on 64 heksamerkkiä ja 244 bittiä arvattavaa.
   */
  v_token := replace(gen_random_uuid()::text, '-', '')
             || replace(gen_random_uuid()::text, '-', '');

  begin
    v_id := reservation_book(
      v_r.id, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      'widget', 'confirmed', null, null, v_token
    );
  exception
    when exclusion_violation then
      /* Sekä "ei vapaata pöytää" että rajoitteen laukeaminen. */
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.starts_at, r.ends_at, r.party_size into v_res
  from reservations r where r.id = v_id;

  return json_build_object(
    'ok', true,
    'cancelToken', v_token,
    'restaurantName', v_r.name,
    'date', p_date,
    'time', to_char(p_time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'tables', coalesce((
      select json_agg(t.name order by t.sort_order, t.name)
      from reservation_table_assignments a
      join restaurant_tables t on t.id = a.table_id
      where a.reservation_id = v_id
    ), '[]'::json)
  );
end;
$$;

create or replace function public_cancel_reservation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  if coalesce(trim(p_token), '') = '' then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_res.status in ('cancelled', 'no_show', 'completed') then
    return json_build_object('ok', false, 'error', 'already');
  end if;

  if v_res.starts_at < now() then
    return json_build_object('ok', false, 'error', 'past');
  end if;

  update reservations set status = 'cancelled' where id = v_res.id;

  return json_build_object(
    'ok', true,
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size
  );
end;
$$;

create or replace function public_reservation_lookup(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  if coalesce(trim(p_token), '') = '' then return null; end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then return null; end if;

  return json_build_object(
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'guestName', v_res.guest_name,
    'status', v_res.status,
    'cancellable', v_res.status in ('pending', 'confirmed')
                   and v_res.starts_at > now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- Vain julkiset funktiot anonille. Moottorin sisäiset funktiot eivät ole
-- anonin kutsuttavissa, vaikka ne ovat security definer — muuten kuka
-- tahansa voisi luetella toisen ravintolan pöydät tunnisteella.

revoke all on function reservation_pick_tables from public, anon;
revoke all on function reservation_book from public, anon;
revoke all on function reservation_slots from public, anon;
revoke all on function reservation_windows from public, anon;
revoke all on function reservation_duration_for from public, anon;

grant execute on function reservation_slots to authenticated;
grant execute on function reservation_windows to authenticated;
grant execute on function reservation_duration_for to authenticated;
grant execute on function reservation_pick_tables to authenticated;
grant execute on function reservation_book to authenticated;

grant execute on function public_reservation_config to anon, authenticated;
grant execute on function public_reservation_slots to anon, authenticated;
grant execute on function public_create_reservation to anon, authenticated;
grant execute on function public_cancel_reservation to anon, authenticated;
grant execute on function public_reservation_lookup to anon, authenticated;


-- ===========================================================================
-- 0068_reservation_admin.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0068 — Varausten hallinta
-- ---------------------------------------------------------------------------
--
-- Salinäkymän luku ja muokkaus. Kaikki tämän tiedoston funktiot ovat
-- security definer, joten ne ohittavat rivitason käytännöt. Siksi
-- jokainen tarkistaa jäsenyyden itse ensimmäisellä rivillään. Funktio
-- joka ohittaa RLS:n mutta ei tarkista oikeutta on takaovi.
--
-- ---------------------------------------------------------------------------
-- Miksi työntekijän luku kulkee funktion kautta
-- ---------------------------------------------------------------------------
--
-- Tarjoilija tarvitsee illan varauslistan: kello, nimi, seurueen koko,
-- pöytä. Hän ei tarvitse asiakkaan puhelinnumeroa eikä sähköpostia —
-- niillä soittaa esihenkilö jos ilta muuttuu.
--
-- Rivitason käytäntö ei osaa piilottaa saraketta, ja sarakekohtainen
-- GRANT koskee koko roolia eikä yksittäistä ravintolaa. Ainoa paikka
-- jossa eron voi tehdä on funktio, joten se tehdään siellä:
-- reservations-taulun lukuoikeus on esihenkilöllä, ja työntekijä lukee
-- päivän tästä funktiosta ilman yhteystietoja.

-- ---------------------------------------------------------------------------
-- Päivän varaukset ja salin tila
-- ---------------------------------------------------------------------------

create or replace function reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  /*
   * Päivä alkaa ja päättyy ravintolan ajassa, ei palvelimen.
   *
   * Ilta joka jatkuu puolenyön yli kuuluu alkamispäiväänsä: kello
   * 23:30 alkanut varaus on lauantain varaus vaikka se päättyy
   * sunnuntain puolella.
   */
  v_from := (p_date + time '00:00') at time zone v_tz;
  v_to := ((p_date + 1) + time '00:00') at time zone v_tz;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        /* Yhteystiedot vain esihenkilölle. */
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vapaat ajat hallintanäkymässä
-- ---------------------------------------------------------------------------
--
-- p_exclude jättää muokattavan varauksen huomiotta. Ilman sitä varaus
-- estäisi itseään: kello 19:00 näyttäisi varatulta koska siinä on juuri
-- se varaus jota ollaan siirtämässä.

create or replace function reservation_admin_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.slot_time)
      from reservation_slots(p_restaurant, p_date, p_party, p_exclude) s
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Vapaat pöydät yhdelle varaukselle
-- ---------------------------------------------------------------------------
--
-- Pöydän vaihtoon: mitkä pöydät ovat vapaana juuri tämän varauksen
-- aikana. Varaus itse ei estä itseään.

create or replace function reservation_free_tables(p_reservation uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res record;
  v_turnaround int;
  v_range tstzrange;
begin
  select * into v_res from reservations where id = p_reservation;
  if v_res.id is null or not is_manager(v_res.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  v_range := tstzrange(
    v_res.starts_at - make_interval(mins => coalesce(v_turnaround, 0)),
    v_res.ends_at + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  return coalesce((
    select json_agg(json_build_object(
      'id', t.id,
      'name', t.name,
      'seatsMin', t.seats_min,
      'seatsMax', t.seats_max,
      'fits', t.seats_min <= v_res.party_size and t.seats_max >= v_res.party_size
    ) order by t.sort_order, t.name)
    from restaurant_tables t
    where t.restaurant_id = v_res.restaurant_id
      and t.active
      and not exists (
        select 1 from reservation_table_assignments a
        where a.table_id = t.id
          and a.blocking
          and a.during && v_range
          and a.reservation_id <> p_reservation
      )
  ), '[]'::json);
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen luonti hallintanäkymästä
-- ---------------------------------------------------------------------------
--
-- Sama funktio kattaa etukäteisvarauksen ja walk-inin. Ero on
-- lähteessä ja tilassa: walk-in on 'walk_in' ja 'arrived', koska
-- seurue istuu jo pöydässä.
--
-- WALK-IN VIE PÖYDÄN VERKKOVARAUKSILTA HETI. Se saa saman liitosrivin
-- kuin verkkovaraus, joten saatavuuslaskenta näkee sen samalla
-- sekunnilla. Erillinen "walk-in-taulu" jättäisi pöydän näyttämään
-- vapaalta ulospäin.

create or replace function reservation_create_admin(
  p_restaurant uuid,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_walk_in boolean default false,
  p_minutes int default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_id uuid;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if p_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_start := (p_date + p_time) at time zone v_tz;

  begin
    v_id := reservation_book(
      p_restaurant, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      case when p_walk_in then 'walk_in'::reservation_source
           else 'admin'::reservation_source end,
      case when p_walk_in then 'arrived'::reservation_status
           else 'confirmed'::reservation_status end,
      p_minutes, p_tables, null
    );
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  perform write_audit(
    p_restaurant,
    case when p_walk_in then 'reservation.walk_in' else 'reservation.create' end,
    'reservation', v_id, trim(p_name),
    case when p_walk_in then 'Lisäsi walk-inin: ' else 'Loi varauksen: ' end
      || trim(p_name) || ', ' || p_party || ' hlö, '
      || to_char(p_date, 'DD.MM.YYYY') || ' klo ' || to_char(p_time, 'HH24:MI'),
    null,
    jsonb_build_object('party_size', p_party, 'starts_at', v_start),
    false
  );

  return json_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen muokkaus
-- ---------------------------------------------------------------------------
--
-- Ajan, henkilömäärän ja pöytien muutos kulkee samasta funktiosta,
-- koska ne riippuvat toisistaan: uusi aika voi viedä pöydän, ja
-- suurempi seurue ei ehkä mahdu vanhaan pöytään.
--
-- Null-parametri tarkoittaa "älä muuta". Muistiinpanon tyhjentäminen
-- tehdään tyhjällä merkkijonolla, koska null olisi kaksiselitteinen:
-- "pyyhi" vai "jätä ennalleen".

create or replace function reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_party int;
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_table uuid;
  v_muutos text[] := array[]::text[];
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  v_party := coalesce(p_party, v_old.party_size);
  if v_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if p_date is not null or p_time is not null then
    v_start := (
      coalesce(p_date, (v_old.starts_at at time zone v_tz)::date)
      + coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    ) at time zone v_tz;
  else
    v_start := v_old.starts_at;
  end if;

  /*
   * Kesto lasketaan uudelleen vain jos seurueen koko muuttui.
   *
   * Muuten esihenkilön käsin pidentämä varaus lyhenisi takaisin
   * oletukseen aina kun muistiinpanoa korjataan.
   */
  if v_party <> v_old.party_size then
    v_minutes := reservation_duration_for(v_old.restaurant_id, v_party);
  else
    v_minutes := (extract(epoch from (v_old.ends_at - v_old.starts_at)) / 60)::int;
  end if;
  v_end := v_start + make_interval(mins => v_minutes);

  /* Pöydät: annetut, entiset jos mikään ei muuttunut, muuten uusi haku. */
  if p_tables is not null then
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = v_old.restaurant_id
      )
    ) then
      return json_build_object('ok', false, 'error', 'table');
    end if;
    v_tables := p_tables;
  elsif v_start <> v_old.starts_at
        or v_end <> v_old.ends_at
        or v_party <> v_old.party_size
  then
    v_tables := reservation_pick_tables(
      v_old.restaurant_id, v_start, v_end, v_party, p_reservation
    );
    if v_tables is null then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set
      starts_at = v_start,
      ends_at = v_end,
      party_size = v_party,
      guest_name = coalesce(nullif(left(trim(p_name), 120), ''), guest_name),
      guest_phone = case when p_phone is null then guest_phone
                         else nullif(left(trim(p_phone), 40), '') end,
      guest_email = case when p_email is null then guest_email
                         else nullif(lower(left(trim(p_email), 160)), '') end,
      note = case when p_note is null then note
                  else nullif(left(trim(p_note), 500), '') end
    where id = p_reservation;

    if v_tables is not null then
      delete from reservation_table_assignments
      where reservation_id = p_reservation
        and table_id <> all (v_tables);

      foreach v_table in array v_tables loop
        insert into reservation_table_assignments
          (reservation_id, table_id, starts_at, ends_at, blocking)
        values (
          p_reservation, v_table, v_start, v_end,
          v_old.status in ('pending', 'confirmed', 'arrived')
        )
        on conflict (reservation_id, table_id) do update
          set starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              blocking = excluded.blocking;
      end loop;
    end if;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  if v_start <> v_old.starts_at then
    v_muutos := v_muutos || (
      'aika ' || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI')
      || ' -> ' || to_char(v_start at time zone v_tz, 'DD.MM. HH24:MI')
    );
  end if;
  if v_party <> v_old.party_size then
    v_muutos := v_muutos || ('koko ' || v_old.party_size || ' -> ' || v_party);
  end if;
  if v_tables is not null then
    v_muutos := v_muutos || 'pöytä';
  end if;

  perform write_audit(
    v_old.restaurant_id, 'reservation.update', 'reservation',
    p_reservation, v_old.guest_name,
    'Muutti varausta: ' || v_old.guest_name
      || case when array_length(v_muutos, 1) is null then ''
              else ' (' || array_to_string(v_muutos, ', ') || ')' end,
    jsonb_build_object('starts_at', v_old.starts_at, 'party_size', v_old.party_size),
    jsonb_build_object('starts_at', v_start, 'party_size', v_party),
    false
  );

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tilan vaihto
-- ---------------------------------------------------------------------------
--
-- Saapui, lähti, ei saapunut, peruttu. Liipaisin hoitaa liitosrivien
-- blocking-lipun, joten pöytä vapautuu tai varautuu automaattisesti.
--
-- EI SAAPUNUT ON VAIN MERKINTÄ. Siitä ei seuraa maksua, veloitusta
-- eikä korttivarmennusta — tila on olemassa jotta ravintola tietää
-- kuinka usein näin käy, ei jotta asiakasta rangaistaisiin.

create or replace function reservation_set_status(
  p_reservation uuid,
  p_status reservation_status
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old record;
  v_tz text;
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if v_old.status = p_status then
    return json_build_object('ok', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  /*
   * Peruttu varaus vapautti pöytänsä. Takaisin aktiiviseksi vain jos
   * pöytä on yhä vapaa — muuten aika on jo myyty toiselle.
   */
  if v_old.status in ('cancelled', 'no_show', 'completed')
     and p_status in ('pending', 'confirmed', 'arrived')
  then
    if exists (
      select 1
      from reservation_table_assignments a
      join reservation_table_assignments b
        on b.table_id = a.table_id
       and b.reservation_id <> a.reservation_id
       and b.blocking
       and b.during && a.during
      where a.reservation_id = p_reservation
    ) then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set status = p_status where id = p_reservation;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  perform write_audit(
    v_old.restaurant_id, 'reservation.status', 'reservation',
    p_reservation, v_old.guest_name,
    'Merkitsi varauksen "' || v_old.guest_name || '" ('
      || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI') || ') tilaan '
      || case p_status
           when 'pending' then 'odottaa'
           when 'confirmed' then 'vahvistettu'
           when 'arrived' then 'saapui'
           when 'completed' then 'lähti'
           when 'cancelled' then 'peruttu'
           when 'no_show' then 'ei saapunut'
         end,
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', p_status),
    false
  );

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_day from public, anon;
revoke all on function reservation_admin_slots from public, anon;
revoke all on function reservation_free_tables from public, anon;
revoke all on function reservation_create_admin from public, anon;
revoke all on function reservation_update from public, anon;
revoke all on function reservation_set_status from public, anon;

grant execute on function reservation_day to authenticated;
grant execute on function reservation_admin_slots to authenticated;
grant execute on function reservation_free_tables to authenticated;
grant execute on function reservation_create_admin to authenticated;
grant execute on function reservation_update to authenticated;
grant execute on function reservation_set_status to authenticated;


-- ===========================================================================
-- 0069_lunch_reorder.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0069 — Lounasruokien järjestäminen raahaamalla
-- ---------------------------------------------------------------------------
--
-- move_lunch_item vaihtaa kaksi vierekkäistä. Se riitti nuolinapeille:
-- yksi painallus, yksi askel. Raahaus pudottaa ruoan monta paikkaa
-- kerralla, ja sarja vaihtoja olisi sarja kyselyitä joista jokin voi
-- epäonnistua kesken — silloin lista jäisi puolittain väärään
-- järjestykseen.
--
-- Tämä ottaa koko päivän järjestyksen kerralla: listan mukainen
-- paikka on uusi sort_order. Yksi kutsu, yksi transaktio, ei
-- välitiloja.
--
-- move_lunch_item jää kantaan mutta jää käyttämättä: myös
-- näppäimistöllä siirtäminen kulkee tästä, koska yksi tapa kirjoittaa
-- järjestys on vähemmän kuin kaksi. Funktion poistaminen olisi oma
-- migraationsa ilman hyötyä, joten se jää siihen.

create or replace function reorder_lunch_items(p_day uuid, p_items uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_day_restaurant(p_day);
  if v_restaurant is null then return; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  /*
   * Kaikkien annettujen on kuuluttava tähän päivään.
   *
   * Ilman tätä toisen päivän — tai toisen ravintolan — ruoan
   * tunnisteen voisi liittää listaan ja saada sille uuden
   * järjestysnumeron. Rivitason käytäntö estäisi kirjoituksen, mutta
   * tämä funktio on security definer ja ohittaa sen.
   */
  if exists (
    select 1 from unnest(p_items) as x(id)
    where not exists (
      select 1 from lunch_items i
      where i.id = x.id and i.lunch_day_id = p_day
    )
  ) then
    raise exception 'Ruoka ei kuulu tähän päivään';
  end if;

  /*
   * Järjestys luetaan taulukon paikasta.
   *
   * ordinality antaa indeksin, ja se on suoraan uusi sort_order.
   * Puuttuvat rivit — jos listasta jäi jokin pois — säilyttävät oman
   * numeronsa, eikä niitä siirretä minnekään.
   */
  update lunch_items i
  set sort_order = paikka.nro, updated_at = now()
  from unnest(p_items) with ordinality as paikka(id, nro)
  where i.id = paikka.id and i.lunch_day_id = p_day;
end;
$$;

revoke all on function reorder_lunch_items from public, anon;
grant execute on function reorder_lunch_items to authenticated;


-- ===========================================================================
-- 0070_meta.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0070 — Facebook- ja Instagram-julkaisu
-- ---------------------------------------------------------------------------
--
-- Ravintola yhdistää Facebook-sivunsa Kateen kerran, ja sen jälkeen
-- valmis lounaslista menee molempiin yhdellä painalluksella.
--
-- ---------------------------------------------------------------------------
-- 1. TOKENI ON OMASSA TAULUSSAAN ILMAN YHTÄÄN KÄYTÄNTÖÄ
-- ---------------------------------------------------------------------------
--
-- Facebookin sivutokeni on avain ravintolan Facebook-sivuun. Sillä voi
-- julkaista, muokata ja poistaa — se on arvokkaampi kuin mikään muu
-- rivi tässä kannassa.
--
-- Siksi se ei ole meta_connections-taulussa muiden kenttien seassa.
-- Rivitason käytäntö ei osaa piilottaa saraketta, joten yksi
-- huolimaton `select *` yhdessä kyselyssä riittäisi lähettämään sen
-- selaimeen. Erillisessä taulussa jolla EI OLE YHTÄÄN KÄYTÄNTÖÄ sitä
-- ei voi lukea millään kyselyllä: ainoa tie on security definer
-- -funktio joka tarkistaa esihenkilöyden.
--
-- Lisäksi tokeni on salattu jo ennen kantaan tuloa (AES-256-GCM,
-- avain META_TOKEN_KEY). Kanta ei siis näe sitä selkokielisenä
-- missään vaiheessa, eikä vuotanut varmuuskopio riitä julkaisemaan
-- kenenkään sivulle.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI SIVUTOKENI EIKÄ KÄYTTÄJÄTOKENI
-- ---------------------------------------------------------------------------
--
-- Metan pitkäikäinen käyttäjätokeni vanhenee 60 päivässä. Siitä
-- johdettu sivutokeni ei vanhene lainkaan, ja se on se jolla
-- julkaistaan. Ravintoloitsijan ei siis tarvitse kirjautua uudelleen
-- kahden kuukauden välein — mikä olisi juuri se kohta jossa
-- ominaisuus lakkaisi käytännössä toimimasta.
--
-- token_expires_at on silti olemassa: sivutokeni voi vanhentua
-- ennenaikaisesti jos käyttäjä vaihtaa salasanan tai poistaa
-- sovelluksen oikeudet. Silloin kenttä täytetään ja tila vaihtuu.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type meta_connection_status as enum (
    'connected',
    /* Tokeni ei enää kelpaa: käyttäjä perui oikeudet tai vaihtoi salasanan. */
    'expired',
    /* Käyttäjä katkaisi yhteyden Katesta. Rivi jää historiaa varten. */
    'disconnected',
    /* Yhteys on olemassa muttei julkaisukelpoinen — esim. IG puuttuu. */
    'incomplete'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type meta_publish_status as enum (
    /* Kanavaa ei valittu tähän julkaisuun. */
    'skipped',
    'pending',
    'ok',
    'failed'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Yhteys
-- ---------------------------------------------------------------------------

create table if not exists meta_connections (
  /*
   * Yksi yhteys per ravintola.
   *
   * Ravintolalla on yksi Facebook-sivu ja yksi Instagram-tili. Monta
   * sivua olisi ketju jota kukaan ei pyytänyt, ja se tekisi
   * julkaisunäkymästä valintalistan.
   */
  restaurant_id uuid primary key references restaurants (id) on delete cascade,

  /* Metan sovelluskohtainen käyttäjätunniste. Ei henkilötieto sinänsä. */
  meta_user_id text,

  page_id text not null,
  page_name text not null,

  /* Instagram on valinnainen: Facebook toimii ilmankin. */
  instagram_id text,
  instagram_username text,

  /*
   * Myönnetyt oikeudet sellaisina kuin Meta ne palautti.
   *
   * Käyttäjä voi hyväksyä osan ja kieltää osan. Tallennettuna
   * tiedämme ennen julkaisua mikä puuttuu, eikä virhe tule vasta
   * Metan vastauksessa.
   */
  scopes text[] not null default '{}',

  status meta_connection_status not null default 'connected',
  /* Miksi tila on muu kuin connected. Näytetään käyttäjälle. */
  status_detail text,

  token_expires_at timestamptz,

  connected_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tokeni
-- ---------------------------------------------------------------------------

create table if not exists meta_tokens (
  restaurant_id uuid primary key
    references meta_connections (restaurant_id) on delete cascade,

  /*
   * Salattu sivutokeni: base64(iv | tag | ciphertext), AES-256-GCM.
   *
   * Sovellus salaa ennen kirjoitusta ja purkaa vain julkaistessaan.
   * Avain on ympäristömuuttujassa eikä kannassa, joten kanta ja avain
   * eivät vuoda yhdessä.
   */
  page_token text not null,

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Julkaisut
-- ---------------------------------------------------------------------------

create table if not exists meta_publications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Mikä lounaslista julkaistiin.
   *
   * on delete set null: julkaisu on tapahtunut vaikka viikko
   * poistettaisiin. Historia ei saa kadota kohteensa mukana — sama
   * linja kuin toimintalokilla.
   */
  menu_id uuid references lunch_menus (id) on delete set null,
  week_start date,

  facebook_status meta_publish_status not null default 'skipped',
  facebook_post_id text,
  facebook_error text,

  instagram_status meta_publish_status not null default 'skipped',
  instagram_post_id text,
  instagram_error text,

  /* Julkaistu teksti sellaisenaan. Lounaslista voi muuttua jälkikäteen. */
  message text not null,
  image_path text,

  published_by uuid references profiles (id) on delete set null,
  published_by_name text not null default 'Tuntematon',
  created_at timestamptz not null default now()
);

create index if not exists meta_publications_lookup
  on meta_publications (restaurant_id, created_at desc);
create index if not exists meta_publications_menu
  on meta_publications (menu_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['meta_connections', 'meta_tokens'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function touch_updated_at()', t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table meta_connections enable row level security;
alter table meta_tokens enable row level security;
alter table meta_publications enable row level security;

/*
 * Yhteys: esihenkilö lukee ja hallitsee oman ravintolansa.
 *
 * Työntekijä ei näe tätä lainkaan. Sosiaalisen median tili on
 * ravintolan hallintaa eikä salityötä.
 */
drop policy if exists meta_connections_read on meta_connections;
create policy meta_connections_read on meta_connections
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists meta_connections_write on meta_connections;
create policy meta_connections_write on meta_connections
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

/*
 * TOKENITAULULLA EI OLE YHTÄÄN KÄYTÄNTÖÄ.
 *
 * Se ei ole unohdus. RLS on päällä ja käytäntöjä on nolla, joten
 * authenticated ei voi lukea, kirjoittaa eikä poistaa yhtään riviä
 * millään kyselyllä. Ainoa tie sisään on alempana olevat security
 * definer -funktiot, jotka tarkistavat esihenkilöyden itse.
 *
 * Oikeudet viedään lisäksi kokonaan: Supabase myöntää ne
 * oletusarvoisesti jokaiseen uuteen tauluun, ja käytäntö on suodatin
 * siinä missä oikeus on ovi.
 */
revoke all on meta_tokens from anon, authenticated;

/* Julkaisuhistoria: esihenkilö lukee, kirjoitus vain funktion kautta. */
drop policy if exists meta_publications_read on meta_publications;
create policy meta_publications_read on meta_publications
  for select to authenticated
  using (is_manager(restaurant_id));

revoke insert, update, delete on meta_publications from authenticated;

/* Anonille ei mitään näistä. */
revoke all on meta_connections from anon;
revoke all on meta_publications from anon;

-- ---------------------------------------------------------------------------
-- Yhteyden tallennus
-- ---------------------------------------------------------------------------

/**
 * Yhteys ja tokeni yhdessä transaktiossa.
 *
 * Erillisinä kutsuina yhteys voisi jäädä ilman tokenia tai päinvastoin,
 * ja kumpikin puolikas näyttäisi ulospäin toimivalta yhteydeltä.
 */
create or replace function meta_save_connection(
  p_restaurant uuid,
  p_meta_user_id text,
  p_page_id text,
  p_page_name text,
  p_instagram_id text,
  p_instagram_username text,
  p_scopes text[],
  p_token text,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  insert into meta_connections (
    restaurant_id, meta_user_id, page_id, page_name,
    instagram_id, instagram_username, scopes,
    status, status_detail, token_expires_at, connected_by
  )
  values (
    p_restaurant, p_meta_user_id, p_page_id, p_page_name,
    nullif(p_instagram_id, ''), nullif(p_instagram_username, ''), p_scopes,
    /*
     * Ilman Instagramia yhteys on epätäydellinen muttei rikki:
     * Facebook toimii, ja käyttäjälle kerrotaan mikä puuttuu.
     */
    case when nullif(p_instagram_id, '') is null
         then 'incomplete'::meta_connection_status
         else 'connected'::meta_connection_status end,
    null,
    p_expires_at,
    auth.uid()
  )
  on conflict (restaurant_id) do update set
    meta_user_id = excluded.meta_user_id,
    page_id = excluded.page_id,
    page_name = excluded.page_name,
    instagram_id = excluded.instagram_id,
    instagram_username = excluded.instagram_username,
    scopes = excluded.scopes,
    status = excluded.status,
    status_detail = null,
    token_expires_at = excluded.token_expires_at,
    connected_by = excluded.connected_by;

  insert into meta_tokens (restaurant_id, page_token)
  values (p_restaurant, p_token)
  on conflict (restaurant_id) do update set page_token = excluded.page_token;

  perform write_audit(
    p_restaurant, 'meta.connect', 'meta_connection', null, p_page_name,
    'Yhdisti Facebook-sivun: ' || p_page_name
      || coalesce(' · Instagram @' || nullif(p_instagram_username, ''), ''),
    null, jsonb_build_object('page_id', p_page_id), true
  );
end;
$$;

/**
 * Tokeni julkaisua varten.
 *
 * Palauttaa salatun tokenin; purku tapahtuu sovelluksessa. Tämä on
 * ainoa tie meta_tokens-tauluun, ja se tarkistaa esihenkilöyden.
 */
create or replace function meta_page_token(p_restaurant uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select page_token into v_token
  from meta_tokens where restaurant_id = p_restaurant;

  return v_token;
end;
$$;

/**
 * Yhteyden katkaisu.
 *
 * Tokeni poistetaan, yhteysrivi jää tilaan disconnected. Rivin
 * poistaminen veisi mukanaan tiedon siitä että yhteys joskus oli —
 * ja julkaisuhistoria viittaa siihen aikaan.
 */
create or replace function meta_disconnect(p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select page_name into v_page from meta_connections
  where restaurant_id = p_restaurant;

  if v_page is null then return; end if;

  delete from meta_tokens where restaurant_id = p_restaurant;

  update meta_connections
  set status = 'disconnected', status_detail = null
  where restaurant_id = p_restaurant;

  perform write_audit(
    p_restaurant, 'meta.disconnect', 'meta_connection', null, v_page,
    'Katkaisi Facebook-yhteyden: ' || v_page,
    null, null, true
  );
end;
$$;

/**
 * Yhteyden tilan merkintä.
 *
 * Julkaisu huomaa ensimmäisenä kun tokeni ei enää kelpaa. Silloin
 * tila kirjataan, jotta asetusnäkymä kertoo saman eikä käyttäjä
 * ihmettele miksi julkaisu epäonnistuu joka kerta.
 */
create or replace function meta_set_status(
  p_restaurant uuid,
  p_status meta_connection_status,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update meta_connections
  set status = p_status, status_detail = p_detail
  where restaurant_id = p_restaurant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Julkaisun kirjaus
-- ---------------------------------------------------------------------------

/**
 * Julkaisun tulos historiaan.
 *
 * Kirjataan vasta kun Meta on vastannut, ja molempien kanavien tulos
 * samalla rivillä: osittainen onnistuminen on yksi tapahtuma eikä
 * kaksi. Kaksi riviä tekisi historiasta luettelon jossa sama julkaisu
 * esiintyy kahdesti eri tuloksilla.
 */
create or replace function meta_record_publication(
  p_restaurant uuid,
  p_menu uuid,
  p_week_start date,
  p_message text,
  p_image_path text,
  p_facebook_status meta_publish_status,
  p_facebook_post_id text,
  p_facebook_error text,
  p_instagram_status meta_publish_status,
  p_instagram_post_id text,
  p_instagram_error text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name from profiles p where p.id = auth.uid();

  insert into meta_publications (
    restaurant_id, menu_id, week_start, message, image_path,
    facebook_status, facebook_post_id, facebook_error,
    instagram_status, instagram_post_id, instagram_error,
    published_by, published_by_name
  )
  values (
    p_restaurant, p_menu, p_week_start, p_message, p_image_path,
    p_facebook_status, p_facebook_post_id, p_facebook_error,
    p_instagram_status, p_instagram_post_id, p_instagram_error,
    auth.uid(), coalesce(v_name, 'Tuntematon')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function meta_save_connection from public, anon;
revoke all on function meta_page_token from public, anon;
revoke all on function meta_disconnect from public, anon;
revoke all on function meta_set_status from public, anon;
revoke all on function meta_record_publication from public, anon;

grant execute on function meta_save_connection to authenticated;
grant execute on function meta_page_token to authenticated;
grant execute on function meta_disconnect to authenticated;
grant execute on function meta_set_status to authenticated;
grant execute on function meta_record_publication to authenticated;

-- ---------------------------------------------------------------------------
-- Julkaisukuvien tallennus
-- ---------------------------------------------------------------------------
--
-- Oma bucket kuiteista erillään: eri elinkaari ja eri sisältö.
-- Yksityinen niin kuin kuititkin — Meta noutaa kuvan allekirjoitetulla
-- osoitteella, joka on arvaamaton ja vanhenee. Julkinen bucket
-- tarkoittaisi että jokainen luotu kuva jää pysyvästi kenen tahansa
-- arvattavissa olevaan osoitteeseen.
--
-- Vain JPEG: Instagram ei hyväksy muuta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists social_storage_read on storage.objects;
create policy social_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'social'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists social_storage_write on storage.objects;
create policy social_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists social_storage_delete on storage.objects;
create policy social_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- Kehittäjänäkymän diagnostiikka
-- ---------------------------------------------------------------------------
--
-- Ylläpitäjä näkee yhteyden tilan tukea varten. Tokenia ei palauteta
-- edes hänelle: kysymykseen "miksi julkaisu ei toimi" vastaa tieto
-- siitä onko tokeni tallessa, ei tokeni itse.

create or replace function sa_meta_diagnostics(p_restaurant uuid)
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
    'pageId', c.page_id,
    'pageName', c.page_name,
    'instagramId', c.instagram_id,
    'instagramUsername', c.instagram_username,
    'status', c.status,
    'statusDetail', c.status_detail,
    'scopes', c.scopes,
    'tokenExpiresAt', c.token_expires_at,
    'connectedAt', c.created_at,
    'updatedAt', c.updated_at,
    'hasToken', exists (
      select 1 from meta_tokens tk where tk.restaurant_id = p_restaurant
    ),
    'lastOk', (
      select max(p.created_at) from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_status = 'ok' or p.instagram_status = 'ok')
    ),
    'lastFailed', (
      select max(p.created_at) from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_status = 'failed' or p.instagram_status = 'failed')
    ),
    'lastError', (
      select coalesce(p.facebook_error, p.instagram_error)
      from meta_publications p
      where p.restaurant_id = p_restaurant
        and (p.facebook_error is not null or p.instagram_error is not null)
      order by p.created_at desc limit 1
    ),
    'publications', (
      select count(*) from meta_publications p
      where p.restaurant_id = p_restaurant
    )
  )
  into v
  from meta_connections c
  where c.restaurant_id = p_restaurant;

  return v;
end;
$$;

revoke all on function sa_meta_diagnostics from public, anon;
grant execute on function sa_meta_diagnostics to authenticated;


-- ===========================================================================
-- 0071_files.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0071 — Tiedostot: ravintolan oma dokumenttikaappi
-- ---------------------------------------------------------------------------
--
-- Ravintola säilyttää Katessa sopimukset, kuitit, myyntiraportit,
-- vakuutukset, viranomaisasiakirjat ja työsopimukset — kaiken sen mitä
-- muuten on kolmessa sähköpostilaatikossa ja yhdessä mapissa.
--
-- ---------------------------------------------------------------------------
-- 1. KÄYTTÄJÄ OMISTAA RAKENTEEN
-- ---------------------------------------------------------------------------
--
-- Kate luo lähtökansiot mutta ei omista niitä. Kansiolla ei ole tyyppiä
-- eikä tarkoitusta: se on nimi ja paikka puussa. Tiedostolla ei ole
-- kansiosidonnaista tyyppiä — mikä tahansa tiedosto saa olla missä
-- tahansa kansiossa.
--
-- Tämä on tietoinen rajaus. Jos kansiolla olisi tyyppi, jokainen
-- ravintola joutuisi sovittamaan oman järjestyksensä Katen malliin.
-- Yksi käyttää vuosia, toinen aihepiirejä, kolmas yhtä kansiota
-- kaikelle. Kaikkien on toimittava, eikä yhdenkään tarvitse selittää
-- itseään tietokannalle.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI OMA BUCKET EIKÄ documents
-- ---------------------------------------------------------------------------
--
-- Kannassa on jo documents-bucket, mutta se kuuluu toiseen
-- vuokralaisuusmalliin: sen käytännöt kysyvät
-- current_user_accessible_org_ids(), eli organisaatiota. Kate on
-- ravintolapohjainen ja käyttää my_restaurant_ids()- ja
-- is_manager()-funktioita, kuten receipts ja social.
--
-- Näiden sekoittaminen samaan bucketiin tarkoittaisi kahta rinnakkaista
-- eristyssääntöä samoille objekteille, ja niiden erot löytyisivät vasta
-- kun jompikumpi pettää. Uusi bucket noudattaa Katen omaa mallia
-- sellaisenaan.
--
-- ---------------------------------------------------------------------------
-- 3. KANSIO EI OLE TIEDOSTOPOLUSSA
-- ---------------------------------------------------------------------------
--
-- Polku on {restaurantId}/{fileId}. Kansio on sarake kannassa, ei osa
-- polkua.
--
-- Jos kansio olisi polussa, tiedoston siirto olisi storage-kopio ja
-- -poisto, siis kaksi verkkokutsua jotka voivat epäonnistua erikseen ja
-- jättää kannan ja storagen eri mieltä siitä missä tiedosto on. Nyt
-- siirto on yhden sarakkeen päivitys, joka joko tapahtuu tai ei.
--
-- Ensimmäinen polkuosa on ravintolan tunniste, koska storage-käytännöt
-- lukevat eristyksen juuri siitä — sama kuin receipts- ja
-- social-bucketeissa.
--
-- ---------------------------------------------------------------------------
-- 4. JUURI ON NULL, EI KANSIO
-- ---------------------------------------------------------------------------
--
-- Ylimmällä tasolla olevan kansion parent_folder_id on null, ja
-- kansioimattoman tiedoston folder_id on null. Näkymätön juurikansio
-- rivinä olisi tila jota jokainen kysely joutuisi kiertämään ja jonka
-- käyttäjä voisi vahingossa nimetä uudelleen tai poistaa.

-- ---------------------------------------------------------------------------
-- Kansiot
-- ---------------------------------------------------------------------------

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Alikansio katoaa emonsa mukana.
   *
   * Vaihtoehto olisi jättää alikansiot orvoiksi juureen, mutta silloin
   * yhden kansion poisto sirottelisi sen sisällön ylätasolle. Kansion
   * poisto on tarkoituksellinen teko, ja funktio kysyy erikseen mitä
   * tiedostoille tehdään.
   */
  parent_folder_id uuid references folders (id) on delete cascade,

  name text not null,
  sort_order integer not null default 0,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint folders_name_not_empty check (length(btrim(name)) > 0),

  /*
   * Nimen pituus on tekninen raja, ei tyylisääntö.
   *
   * Käyttäjä saa nimetä kansion miten haluaa. Sata kahtakymmentä
   * merkkiä pidempi nimi ei kuitenkaan mahdu mihinkään näkymään, eikä
   * sitä kirjoiteta vahingossa.
   */
  constraint folders_name_length check (length(name) <= 120),

  /* Kansio ei voi olla oma emonsa. Syvemmät silmukat estää funktio. */
  constraint folders_no_self_parent check (parent_folder_id is distinct from id)
);

/*
 * Sama nimi samassa paikassa kahdesti on virhe, ei rakenne.
 *
 * Kaksi "2026"-kansiota vierekkäin ei kerro käyttäjälle mitään, ja
 * tiedosto katoaa väärään. Eri kansioissa sama nimi on tietysti
 * sallittu — juuri siksi kansioita on.
 *
 * Kaksi indeksiä, koska null ei ole yhtä suuri kuin null: yksi
 * indeksi ei estäisi kahta samannimistä juurikansiota.
 */
create unique index if not exists folders_unique_name_in_parent
  on folders (restaurant_id, parent_folder_id, lower(btrim(name)))
  where parent_folder_id is not null;

create unique index if not exists folders_unique_name_in_root
  on folders (restaurant_id, lower(btrim(name)))
  where parent_folder_id is null;

create index if not exists folders_by_parent
  on folders (restaurant_id, parent_folder_id, sort_order, name);

-- ---------------------------------------------------------------------------
-- Tiedostot
-- ---------------------------------------------------------------------------

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Kansion poisto ei hävitä tiedostoa.
   *
   * set null siirtää tiedoston juureen. Tiedoston hävittäminen on
   * erillinen, tarkoituksellinen teko — kansion poisto ei saa olla
   * tapa menettää vuokrasopimusta vahingossa.
   */
  folder_id uuid references folders (id) on delete set null,

  /* Käyttäjälle näkyvä nimi. Storagessa oleva nimi on tunniste. */
  file_name text not null,
  storage_path text not null unique,

  /*
   * Tiedostotyyppi on tieto, ei sääntö.
   *
   * Kenttää käytetään kuvakkeen ja lajittelun valintaan. Se ei rajaa
   * mihin kansioon tiedosto saa mennä — kuitti kelpaa Talous-kansioon
   * ja myyntiraportti Kuitit-kansioon, jos ravintola niin haluaa.
   */
  file_type text not null,
  file_size bigint not null,

  uploaded_by uuid references profiles (id) on delete set null,
  is_favorite boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint files_name_not_empty check (length(btrim(file_name)) > 0),
  constraint files_name_length check (length(file_name) <= 200),
  constraint files_size_positive check (file_size > 0)
);

create index if not exists files_by_folder
  on files (restaurant_id, folder_id, created_at desc);

create index if not exists files_recent
  on files (restaurant_id, created_at desc);

create index if not exists files_favorites
  on files (restaurant_id, created_at desc)
  where is_favorite;

/*
 * Haku nimen osalla.
 *
 * trigram-indeksi vastaa ilike '%osa%' -hakuun, jota tavallinen
 * b-puu ei osaa. Ravintolan tiedostomäärä on pieni, mutta haku on
 * näkymä jota käytetään kirjoittaessa — jokainen näppäily on kysely.
 */
create extension if not exists pg_trgm;

create index if not exists files_name_search
  on files using gin (lower(file_name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Muokkausaika
-- ---------------------------------------------------------------------------
--
-- touch_updated_at on 0001:stä. Sama liipaisin on kolmisenkymmenellä
-- taululla, eikä tähän tarvita omaa.

drop trigger if exists folders_touch on folders;
create trigger folders_touch before update on folders
  for each row execute function touch_updated_at();

drop trigger if exists files_touch on files;
create trigger files_touch before update on files
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rivitason käytännöt
-- ---------------------------------------------------------------------------
--
-- Luku omistajalle, esihenkilölle ja kirjanpitäjälle; kirjoitus
-- esihenkilölle.
--
-- Raja EI ole my_restaurant_ids(), vaikka se on Katessa tavallisin.
-- Se kattaa myös työntekijät, ja tässä kaapissa on työsopimuksia ja
-- palkkalaskelmia. Käyttöliittymä piilottaa sivun työntekijältä, mutta
-- se ei ole este: kirjautuneella on voimassa oleva istunto, ja
-- rajapintaa voi kutsua ilman käyttöliittymää.
--
-- can_read_finance() on täsmälleen oikea joukko — omistaja,
-- esihenkilö ja kirjanpitäjä — ja sama joukko kuin files.view
-- sovelluksen puolella. Kannan ja roolitaulukon on oltava samaa
-- mieltä, tai toinen niistä on väärässä eikä kukaan huomaa kumpi.
--
-- Kirjoituskäytännöt ovat olemassa vaikka sovellus kulkee funktioiden
-- kautta. Käytäntö on viimeinen sana; funktio on käyttöliittymä sille.

alter table folders enable row level security;
alter table files enable row level security;

/*
 * Oikeudet pois anonilta.
 *
 * Supabase myöntää anon-roolille kaikki oikeudet jokaiseen uuteen
 * public-skeeman tauluun. RLS on suodatin, mutta oikeuksien
 * peruuttaminen on ovi — ja näissä tauluissa on työsopimuksia ja
 * palkkadokumentteja.
 */
revoke all on table folders from anon;
revoke all on table files from anon;

drop policy if exists folders_read on folders;
create policy folders_read on folders
  for select using (can_read_finance(restaurant_id));

drop policy if exists folders_write on folders;
create policy folders_write on folders
  for all using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists files_read on files;
create policy files_read on files
  for select using (can_read_finance(restaurant_id));

drop policy if exists files_write on files;
create policy files_write on files
  for all using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- Yksityinen bucket. Tiedostot luetaan allekirjoitetuilla osoitteilla,
-- kuten kuitit — julkinen linkki ravintolan vuokrasopimukseen olisi
-- pysyvästi julkinen kenelle tahansa jolle se päätyy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'files',
  'files',
  false,

  /*
   * 25 megatavua.
   *
   * Kuitit ja documents ovat kahdessakymmenessä, mutta ne ovat kuvia ja
   * PDF:iä. Tänne tulee myös Excel-tiedostoja, joissa on vuoden
   * myyntirivit. Raja on siellä missä se estää vahingon eikä työtä.
   */
  26214400,

  /*
   * Sallitut tyypit.
   *
   * Storage tarkistaa nämä riippumatta siitä mitä sovellus lähettää.
   * Suoritettavat tiedostot puuttuvat tarkoituksella: ravintolan
   * dokumenttikaappi ei ole paikka jakaa ohjelmia.
   */
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

/*
 * Eristys luetaan polun ensimmäisestä osasta.
 *
 * Sama kuvio kuin receipts- ja social-bucketeissa. Polku on
 * {restaurantId}/{fileId}, joten foldername(name)[1] on ravintola.
 */
drop policy if exists files_storage_read on storage.objects;
create policy files_storage_read on storage.objects
  for select using (
    bucket_id = 'files'
    and can_read_finance(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_write on storage.objects;
create policy files_storage_write on storage.objects
  for insert with check (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_update on storage.objects;
create policy files_storage_update on storage.objects
  for update using (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists files_storage_delete on storage.objects;
create policy files_storage_delete on storage.objects
  for delete using (
    bucket_id = 'files'
    and is_manager(((storage.foldername(name))[1])::uuid)
  );


-- ===========================================================================
-- 0072_file_actions.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0072 — Tiedostojen ja kansioiden toiminnot
-- ---------------------------------------------------------------------------
--
-- Luku tapahtuu suorilla kyselyillä rivitason käytäntöjen läpi. Muutokset
-- kulkevat näiden funktioiden kautta, koska niihin liittyy tarkistuksia
-- joita käytäntö ei osaa ilmaista: silmukka kansiopuussa, syvyysraja,
-- kansion ja tiedoston kuuluminen samaan ravintolaan, ja lokimerkintä.
--
-- ---------------------------------------------------------------------------
-- RAVINTOLA LUETAAN RIVISTÄ, EI PYYNNÖSTÄ
-- ---------------------------------------------------------------------------
--
-- Yksikään funktio ei luota annettuun restaurant_id-arvoon. Kun
-- kohteena on olemassa oleva kansio tai tiedosto, ravintola haetaan
-- siitä rivistä ja oikeus tarkistetaan sitä vastaan. Uutta luotaessa
-- annettu tunniste kelpaa vain jos is_manager myöntää sen kutsujalle —
-- vieraan ravintolan tunniste ei siis avaa mitään.
--
-- Erityisesti siirroissa tarkistetaan molemmat päät: tiedosto ja
-- kohdekansio on kuuluttava samaan ravintolaan. Ilman sitä oman
-- ravintolan tiedoston voisi siirtää toisen ravintolan kansioon
-- pelkällä kansion tunnisteella.

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

/**
 * Kansion syvyys juuresta. Juurikansio on 1.
 */
create or replace function folder_depth(p_folder uuid)
returns integer
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    /* Rikkinäinen puu ei saa jäädä pyörimään ikuisesti. */
    where up.depth < 50
  )
  select coalesce(max(depth), 0) from up;
$$;

/**
 * Onko kohde jälkeläinen.
 *
 * Estää kansion siirtämisen oman alikansionsa sisään. Ilman tätä
 * tarkistusta siirto irrottaisi haaran puusta: se ei enää löytyisi
 * juuresta eikä siis mistään näkymästä, mutta rivit olisivat yhä
 * kannassa.
 */
create or replace function folder_is_descendant(p_folder uuid, p_maybe_ancestor uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select exists (select 1 from up where up.parent_folder_id = p_maybe_ancestor);
$$;

/**
 * Kansiopolku tekstinä, esimerkiksi "Talous / 2026 / Elokuu".
 *
 * Käytetään hakutuloksessa ja lokimerkinnässä. Juuressa oleva tiedosto
 * saa tyhjän merkkijonon, jonka käyttöliittymä korvaa "Tiedostot"-
 * otsikolla omalla kielellään.
 */
create or replace function folder_path_text(p_folder uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, name, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, f.name, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select coalesce(
    string_agg(name, ' / ' order by depth desc),
    ''
  )
  from up;
$$;

/**
 * Murupolku käyttöliittymälle.
 *
 * Palauttaa juuresta kohti kansiota, jotta näkymä voi tulostaa rivit
 * sellaisenaan. security invoker: rivitason käytännöt suodattavat, eikä
 * tässä ole mitään mitä ne eivät jo osaisi.
 */
create or replace function folder_breadcrumb(p_folder uuid)
returns table (id uuid, name text)
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select f.id, f.parent_folder_id, f.name, 1 as depth
    from folders f
    where f.id = p_folder

    union all

    select f.id, f.parent_folder_id, f.name, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select up.id, up.name from up order by up.depth desc;
$$;

/*
 * Syvyysraja.
 *
 * Käyttäjä saa rakentaa oman rakenteensa, eikä kymmenen tasoa tule
 * vastaan missään todellisessa käytössä. Raja on olemassa siksi ettei
 * ohjelmointivirhe tai vahinko voi kasvattaa puuta rajatta ja tehdä
 * murupolusta lukukelvotonta.
 */
create or replace function max_folder_depth()
returns integer
language sql
immutable
as $$ select 10 $$;

-- ---------------------------------------------------------------------------
-- Kansiot
-- ---------------------------------------------------------------------------

create or replace function create_folder(
  p_restaurant uuid,
  p_parent uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_order integer;
begin
  if v_name = '' then
    raise exception 'Kansion nimi puuttuu';
  end if;

  /*
   * Emokansio määrää ravintolan.
   *
   * Annettu tunniste on vain ehdotus. Jos emo on olemassa, ravintola
   * luetaan siitä — muuten alikansion voisi luoda toisen ravintolan
   * kansion alle antamalla oman tunnisteensa.
   */
  if p_parent is not null then
    select restaurant_id into v_restaurant from folders where id = p_parent;

    if v_restaurant is null then
      raise exception 'Kansiota ei löydy';
    end if;

    if folder_depth(p_parent) >= max_folder_depth() then
      raise exception 'Kansiorakenne on liian syvä';
    end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /* Uusi kansio listan loppuun, ei alkuun. */
  select coalesce(max(sort_order), -1) + 1 into v_order
  from folders
  where restaurant_id = v_restaurant
    and parent_folder_id is not distinct from p_parent;

  insert into folders (restaurant_id, parent_folder_id, name, sort_order, created_by)
  values (v_restaurant, p_parent, v_name, v_order, auth.uid())
  returning id into v_id;

  perform write_audit(
    v_restaurant, 'created', 'folder', v_id, v_name,
    'Loi kansion ' || v_name
  );

  return v_id;
end;
$$;

create or replace function rename_folder(p_folder uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_old text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Kansion nimi puuttuu';
  end if;

  select restaurant_id, name into v_restaurant, v_old
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  update folders set name = v_name where id = p_folder;

  perform write_audit(
    v_restaurant, 'renamed', 'folder', p_folder, v_name,
    'Nimesi kansion ' || v_old || ' → ' || v_name
  );
end;
$$;

create or replace function move_folder(p_folder uuid, p_parent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_target_restaurant uuid;
  v_name text;
  v_order integer;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  if p_parent is not null then
    select restaurant_id into v_target_restaurant from folders where id = p_parent;

    if v_target_restaurant is null then
      raise exception 'Kohdekansiota ei löydy';
    end if;

    /*
     * Molemmat päät samasta ravintolasta.
     *
     * Kutsuja voi olla usean ravintolan esihenkilö. Ilman tätä hän
     * voisi siirtää kansion ravintolasta toiseen, ja rivin
     * restaurant_id jäisi kertomaan eri tarinaa kuin sen paikka
     * puussa.
     */
    if v_target_restaurant <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.' using errcode = 'insufficient_privilege';
    end if;

    if p_parent = p_folder then
      raise exception 'Kansiota ei voi siirtää itseensä';
    end if;

    if folder_is_descendant(p_parent, p_folder) then
      raise exception 'Kansiota ei voi siirtää oman alikansionsa sisään';
    end if;

    if folder_depth(p_parent) >= max_folder_depth() then
      raise exception 'Kansiorakenne on liian syvä';
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_order
  from folders
  where restaurant_id = v_restaurant
    and parent_folder_id is not distinct from p_parent;

  update folders
  set parent_folder_id = p_parent, sort_order = v_order
  where id = p_folder;

  perform write_audit(
    v_restaurant, 'moved', 'folder', p_folder, v_name,
    'Siirsi kansion ' || v_name || ' → ' ||
      coalesce(nullif(folder_path_text(p_parent), ''), 'Tiedostot')
  );
end;
$$;

/**
 * Kansion poisto.
 *
 * p_mode = 'keep'     — tiedostot siirtyvät juureen, kansio katoaa
 * p_mode = 'contents' — myös tiedostot poistetaan
 *
 * Palauttaa poistettujen tiedostojen storage-polut, jotta kutsuja voi
 * poistaa myös itse objektit. Kanta ei ylety storageen, joten se on
 * kutsujan tehtävä — ja siksi polut palautetaan tässä eikä jätetä
 * kutsujan haettavaksi erikseen, jolloin ne olisivat jo poissa.
 */
create or replace function delete_folder(p_folder uuid, p_mode text default 'keep')
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_paths text[];
  v_count integer;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  if p_mode not in ('keep', 'contents') then
    raise exception 'Tuntematon poistotapa';
  end if;

  if p_mode = 'contents' then
    /*
     * Koko haara, ei vain tämä kansio.
     *
     * Käyttäjä näkee kansion sisältöineen yhtenä asiana. Jos poisto
     * koskisi vain ylintä tasoa, alikansioiden tiedostot jäisivät
     * juureen irrallisina — ja juuri niitä käyttäjä luuli poistavansa.
     */
    with recursive tree as (
      select id from folders where id = p_folder
      union all
      select f.id from folders f join tree t on f.parent_folder_id = t.id
    ),
    poistetut as (
      delete from files
      where folder_id in (select id from tree)
      returning storage_path
    )
    select array_agg(storage_path) into v_paths from poistetut;
  end if;

  v_count := coalesce(array_length(v_paths, 1), 0);

  delete from folders where id = p_folder;

  perform write_audit(
    v_restaurant, 'deleted', 'folder', p_folder, v_name,
    case
      when p_mode = 'contents'
        then 'Poisti kansion ' || v_name || ' sisältöineen (' || v_count || ' tiedostoa)'
      else 'Poisti kansion ' || v_name
    end,
    null, null, true
  );

  /* Polut kutsujalle, joka poistaa objektit storagesta. */
  return query select unnest(coalesce(v_paths, array[]::text[]));
end;
$$;

create or replace function reorder_folders(p_parent uuid, p_restaurant uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_wrong integer;
begin
  if p_parent is not null then
    select restaurant_id into v_restaurant from folders where id = p_parent;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * Jokaisen kansion on kuuluttava tähän paikkaan.
   *
   * Funktio on security definer, joten se ohittaa rivitason käytännöt.
   * Ilman tätä tarkistusta annettu tunnistelista olisi tapa muuttaa
   * minkä tahansa kansion järjestystä missä tahansa ravintolassa.
   */
  select count(*) into v_wrong
  from unnest(p_ids) as wanted(id)
  where not exists (
    select 1 from folders f
    where f.id = wanted.id
      and f.restaurant_id = v_restaurant
      and f.parent_folder_id is not distinct from p_parent
  );

  if v_wrong > 0 then
    raise exception 'Kansio ei kuulu tähän paikkaan';
  end if;

  update folders f
  set sort_order = pos.ord
  from unnest(p_ids) with ordinality as pos(id, ord)
  where f.id = pos.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tiedostot
-- ---------------------------------------------------------------------------

/**
 * Ladatun tiedoston kirjaus.
 *
 * Objekti on jo storagessa, kun tämä kutsutaan. Storage-käytäntö on
 * tarkistanut ravintolan polusta; tämä tarkistaa saman uudelleen
 * kannan puolelta, koska rivi on se jota käyttöliittymä näyttää.
 */
create or replace function register_file(
  p_restaurant uuid,
  p_folder uuid,
  p_name text,
  p_path text,
  p_type text,
  p_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' then raise exception 'Tiedoston nimi puuttuu'; end if;
  if coalesce(btrim(p_path), '') = '' then raise exception 'Polku puuttuu'; end if;
  if coalesce(p_size, 0) <= 0 then raise exception 'Tiedosto on tyhjä'; end if;

  if p_folder is not null then
    select restaurant_id into v_restaurant from folders where id = p_folder;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * Polun on alettava tämän ravintolan tunnisteella.
   *
   * Muuten rivi voisi osoittaa toisen ravintolan objektiin, ja
   * allekirjoitettu osoite luotaisiin sille rivin perusteella.
   */
  if split_part(p_path, '/', 1) <> v_restaurant::text then
    raise exception 'Polku ei kuulu tälle ravintolalle';
  end if;

  insert into files (
    restaurant_id, folder_id, file_name, storage_path,
    file_type, file_size, uploaded_by
  )
  values (
    v_restaurant, p_folder, v_name, btrim(p_path),
    coalesce(nullif(btrim(p_type), ''), 'application/octet-stream'),
    p_size, auth.uid()
  )
  returning id into v_id;

  perform write_audit(
    v_restaurant, 'created', 'file', v_id, v_name,
    'Lisäsi tiedoston ' || v_name || ' → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );

  return v_id;
end;
$$;

create or replace function rename_file(p_file uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_old text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then raise exception 'Tiedoston nimi puuttuu'; end if;

  select restaurant_id, file_name into v_restaurant, v_old
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  update files set file_name = v_name where id = p_file;

  perform write_audit(
    v_restaurant, 'renamed', 'file', p_file, v_name,
    'Nimesi tiedoston ' || v_old || ' → ' || v_name
  );
end;
$$;

create or replace function move_file(p_file uuid, p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_current_folder uuid;
  v_target_restaurant uuid;
  v_name text;
  v_from text;
begin
  select restaurant_id, file_name, folder_id
  into v_restaurant, v_name, v_current_folder
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  v_from := coalesce(nullif(folder_path_text(v_current_folder), ''), 'Tiedostot');

  if p_folder is not null then
    select restaurant_id into v_target_restaurant from folders where id = p_folder;

    if v_target_restaurant is null then
      raise exception 'Kohdekansiota ei löydy';
    end if;

    /* Sama sääntö kuin kansion siirrossa: molemmat päät tarkistetaan. */
    if v_target_restaurant <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.' using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files set folder_id = p_folder where id = p_file;

  perform write_audit(
    v_restaurant, 'moved', 'file', p_file, v_name,
    'Siirsi tiedoston ' || v_name || ': ' || v_from || ' → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );
end;
$$;

create or replace function set_file_favorite(p_file uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  /* Tähti ei ole lokitapahtuma: se on näkymäasetus, ei muutos asiaan. */
  update files set is_favorite = coalesce(p_value, false) where id = p_file;
end;
$$;

/**
 * Tiedoston poisto.
 *
 * Palauttaa storage-polun, jotta kutsuja voi poistaa myös objektin.
 * Rivi poistetaan ensin: se on se mitä käyttäjä näkee, ja jäljelle
 * jäävä objekti on siivousasia — kun taas jäljelle jäävä rivi ilman
 * objektia olisi rikkinäinen tiedosto näkymässä.
 */
create or replace function delete_file(p_file uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_path text;
begin
  select restaurant_id, file_name, storage_path
  into v_restaurant, v_name, v_path
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  delete from files where id = p_file;

  perform write_audit(
    v_restaurant, 'deleted', 'file', p_file, v_name,
    'Poisti tiedoston ' || v_name,
    null, null, true
  );

  return v_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Haku
-- ---------------------------------------------------------------------------

/**
 * Haku koko ravintolan tiedostoista.
 *
 * Sijainti tulee mukaan, koska hakutulos ilman sijaintia ei kerro
 * käyttäjälle mistä tiedosto löytyy ensi kerralla ilman hakua.
 *
 * security invoker: rivitason käytännöt rajaavat tuloksen kutsujan
 * ravintoloihin, eikä tässä tarvita mitään sen yli.
 */
create or replace function search_files(
  p_restaurant uuid,
  p_term text,
  p_limit integer default 50
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  folder_id uuid,
  folder_path text,
  is_favorite boolean,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    f.id,
    f.file_name,
    f.file_type,
    f.file_size,
    f.folder_id,
    folder_path_text(f.folder_id),
    f.is_favorite,
    f.created_at
  from files f
  where f.restaurant_id = p_restaurant
    and btrim(coalesce(p_term, '')) <> ''
    and lower(f.file_name) like '%' || lower(btrim(p_term)) || '%'
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- Kirjautuneille, ei kaikille. Julkinen pinta ei kosketa tiedostoihin
-- millään tavalla.

/*
 * revoke ... from public EI RIITÄ.
 *
 * Supabase myöntää anon- ja authenticated-rooleille suoran
 * EXECUTE-oikeuden jokaiseen uuteen public-skeeman funktioon.
 * PUBLIClta peruminen ei kosketa suoraa myöntöä, joten funktio jää
 * kirjautumattoman kutsuttavaksi vaikka revoke näyttäisi tehdyltä.
 *
 * Sama ansa kuin taulujen kohdalla: oikeus on peruttava nimenomaan
 * siltä roolilta jolla se on.
 *
 * Apufunktiot ja kylvöfunktio ovat sisäisiä. Ne kutsutaan vain
 * security definer -funktioista, jotka ajavat omistajan oikeuksin,
 * eikä niillä ole omaa oikeustarkistusta — seed_default_folders
 * loisi kansiot mihin tahansa ravintolaan sille joka sen kutsuisi.
 */
revoke execute on function folder_depth(uuid) from public, anon, authenticated;
revoke execute on function folder_is_descendant(uuid, uuid) from public, anon, authenticated;
revoke execute on function max_folder_depth() from public, anon, authenticated;

revoke execute on function folder_path_text(uuid) from public, anon;
revoke execute on function folder_breadcrumb(uuid) from public, anon;
revoke execute on function search_files(uuid, text, integer) from public, anon;
revoke execute on function create_folder(uuid, uuid, text) from public, anon;
revoke execute on function rename_folder(uuid, text) from public, anon;
revoke execute on function move_folder(uuid, uuid) from public, anon;
revoke execute on function delete_folder(uuid, text) from public, anon;
revoke execute on function reorder_folders(uuid, uuid, uuid[]) from public, anon;
revoke execute on function register_file(uuid, uuid, text, text, text, bigint) from public, anon;
revoke execute on function rename_file(uuid, text) from public, anon;
revoke execute on function move_file(uuid, uuid) from public, anon;
revoke execute on function set_file_favorite(uuid, boolean) from public, anon;
revoke execute on function delete_file(uuid) from public, anon;

grant execute on function folder_path_text(uuid) to authenticated;
grant execute on function folder_breadcrumb(uuid) to authenticated;
grant execute on function search_files(uuid, text, integer) to authenticated;
grant execute on function create_folder(uuid, uuid, text) to authenticated;
grant execute on function rename_folder(uuid, text) to authenticated;
grant execute on function move_folder(uuid, uuid) to authenticated;
grant execute on function delete_folder(uuid, text) to authenticated;
grant execute on function reorder_folders(uuid, uuid, uuid[]) to authenticated;
grant execute on function register_file(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function rename_file(uuid, text) to authenticated;
grant execute on function move_file(uuid, uuid) to authenticated;
grant execute on function set_file_favorite(uuid, boolean) to authenticated;
grant execute on function delete_file(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tiedostomäärät kansioittain
-- ---------------------------------------------------------------------------

/**
 * Montako tiedostoa kussakin kansiossa on suoraan.
 *
 * Ilman tätä kansiolistaus joutuisi lataamaan koko ravintolan
 * tiedostorivit pelkkää lukumäärää varten. Rekursiivinen summa
 * lasketaan selaimessa: kansiopuu on siellä jo valmiina, eikä sitä
 * kannata hakea kahdesti.
 *
 * security invoker: rivitason käytännöt rajaavat tuloksen.
 */
create or replace function folder_counts(p_restaurant uuid)
returns table (folder_id uuid, file_count bigint)
language sql
stable
set search_path = public
as $$
  select f.folder_id, count(*)
  from files f
  where f.restaurant_id = p_restaurant
    and f.folder_id is not null
  group by f.folder_id;
$$;

revoke execute on function folder_counts(uuid) from public, anon;
grant execute on function folder_counts(uuid) to authenticated;


-- ===========================================================================
-- 0073_default_folders.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0073 — Tiedostojen lähtökansiot
-- ---------------------------------------------------------------------------
--
-- Tyhjä tiedostonäkymä on kysymys jota ravintoloitsija ei halua
-- vastata: "mistä minun pitäisi aloittaa?" Yhdeksän kansiota vastaa
-- siihen puolestaan.
--
-- ---------------------------------------------------------------------------
-- KANSIOT OVAT EHDOTUS, EI RAKENNE
-- ---------------------------------------------------------------------------
--
-- Nämä luodaan kerran ravintolan syntyessä ja unohdetaan. Mikään koodi
-- ei etsi niitä nimellä, mikään ei oleta niiden olevan olemassa, eikä
-- mikään luo niitä uudelleen jos ne poistetaan. Kansio on rivi jonka
-- käyttäjä omistaa siitä hetkestä lähtien.
--
-- Jos tässä olisi vaikka "Kuitit"-kansio jota kuittien tallennus
-- etsisi, kansion nimeäminen uudelleen rikkoisi kuitit. Siksi
-- kansioilla ei ole tunnisteita eikä tyyppiä — vain nimi ja järjestys.

create or replace function default_folder_names()
returns table (name text, sort_order integer)
language sql
immutable
set search_path = public
as $
  values
    ('Sopimukset', 0),
    ('Kuitit', 1),
    ('Myyntiraportit', 2),
    ('Laskut', 3),
    ('Talous', 4),
    ('Työntekijät', 5),
    ('Viranomaiset', 6),
    ('Tärkeät tiedostot', 7),
    ('Muut', 8);
$$;

/**
 * Lähtökansiot yhdelle ravintolalle.
 *
 * on conflict do nothing: ajo kahdesti ei kahdenna mitään, eikä
 * käyttäjän poistama kansio palaa vaikka funktio ajettaisiin uudelleen
 * — poistettua ei ole, ja uusi luonti on eri asia kuin paluu.
 */
create or replace function seed_default_folders(p_restaurant uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into folders (restaurant_id, parent_folder_id, name, sort_order)
  select p_restaurant, null, d.name, d.sort_order
  from default_folder_names() d
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Uusi ravintola saa kansiot
-- ---------------------------------------------------------------------------
--
-- create_restaurant kirjoitetaan kokonaan uudelleen, koska se on
-- projektin tapa: 0038, 0039 ja 0044 tekivät saman. Sisältö on 0044:n
-- versio, johon on lisätty yksi kutsu.

create or replace function create_restaurant(
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

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

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

  /* Tiedostojen lähtökansiot. Käyttäjä saa muuttaa niitä heti. */
  perform seed_default_folders(v_id);

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;

/*
 * Kylvöfunktiot ovat sisäisiä.
 *
 * seed_default_folders on security definer eikä tarkista oikeuksia:
 * sen ainoa kutsuja on create_restaurant, joka on jo tarkistanut
 * kirjautumisen. Ilman tätä peruutusta kuka tahansa — myös
 * kirjautumaton — voisi luoda yhdeksän kansiota mihin tahansa
 * ravintolaan pelkällä tunnisteella.
 *
 * from public ei riitä: Supabase myöntää anonille ja
 * authenticatedille suoran oikeuden, jota PUBLIC-peruutus ei koske.
 */
revoke execute on function seed_default_folders(uuid) from public, anon, authenticated;
revoke execute on function default_folder_names() from public, anon, authenticated;

/*
 * Sama vika projektin vanhoissa kylvöfunktioissa.
 *
 * seed_default_sales_groups ja seed_default_pos_mappings ovat olleet
 * kirjautumattoman kutsuttavissa siitä asti kun ne luotiin. Ne ovat
 * samaa luokkaa: security definer, ei oikeustarkistusta, ravintola
 * parametrina. Korjataan samalla, koska vika on identtinen eikä sen
 * jättäminen paikalleen olisi puolustettavissa.
 */
revoke execute on function seed_default_sales_groups(uuid) from public, anon, authenticated;
revoke execute on function seed_default_pos_mappings(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Olemassa olevat ravintolat
-- ---------------------------------------------------------------------------
--
-- Ilman tätä ominaisuus avautuisi tyhjänä juuri niille ravintoloille
-- jotka ovat jo käytössä — eli kaikille todellisille. Kansiot annetaan
-- vain niille joilla ei ole yhtään: jos ravintola on jo rakentanut
-- omansa jotenkin muuten, sitä ei täydennetä ehdotuksilla.

do $$
declare
  r record;
begin
  for r in
    select id from restaurants
    where not exists (select 1 from folders f where f.restaurant_id = restaurants.id)
  loop
    perform seed_default_folders(r.id);
  end loop;
end;
$$;


-- ===========================================================================
-- 0074_files_lifecycle.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0074 — Tiedostojen elinkaari: voimassaolo, roskakori ja liitokset
-- ---------------------------------------------------------------------------
--
-- Kolme lisäystä, jotka tekevät kaapista aktiivisen.
--
-- ---------------------------------------------------------------------------
-- 1. VOIMASSAOLO ON SE MIKÄ OIKEASTI SATUTTAA
-- ---------------------------------------------------------------------------
--
-- Ravintolaa vahingoittavat juuri ne paperit jotka vanhenevat:
-- anniskelulupa, elintarvikehuoneistoilmoitus, vakuutus, vuokrasopimus,
-- hygieniapassit, määräaikaiset työsopimukset. Niiden unohtuminen ei
-- ole epämukavuus vaan sakko, suljettu terassi tai vakuuttamaton
-- tulipalo.
--
-- expires_on on valinnainen. Useimmilla tiedostoilla ei ole
-- voimassaoloa, eikä pakollinen kenttä tekisi niistä sellaisia — se
-- tekisi vain jokaisesta latauksesta yhden kysymyksen pidemmän.
--
-- ---------------------------------------------------------------------
-- 2. POISTO ON PERUTTAVISSA
-- ---------------------------------------------------------------------
--
-- Kansion poisto sisältöineen oli lopullinen. Se on ainoa toiminto
-- tässä osiossa jossa virhe maksaa oikeasti, joten se saa välitilan:
-- rivi merkitään poistetuksi, ja objekti storagessa säilyy.
--
-- Lopullinen häviäminen tapahtuu kolmenkymmenen päivän jälkeen.
-- Siivous ajetaan silloin kun roskakori avataan — ajastettua tehtävää
-- ei ole, ja lisätty ajastin olisi uusi liikkuva osa siihen mitä
-- avaaminen tekee joka tapauksessa.
--
-- Poistettu rivi ei näy missään normaalissa näkymässä. Suodatus on
-- kyselyissä eikä käytännössä: käytäntö piilottaisi rivin myös
-- palautukselta, ja silloin roskakoria ei voisi tyhjentää eikä
-- palauttaa.
--
-- ---------------------------------------------------------------------
-- 3. TIEDOSTO KIINNI SIIHEN MITÄ SE KOSKEE
-- ---------------------------------------------------------------------
--
-- Sopimus kuuluu toimittajalle ja lasku kuitille. Liitos on sarake
-- eikä oma taulunsa: tiedosto koskee yhtä toimittajaa ja yhtä kuittia,
-- ei montaa, ja monen suhde olisi taulu jota kukaan ei täytä.
--
-- on delete set null molemmissa: toimittajan poisto ei saa viedä
-- sopimusta mukanaan. Tiedosto jää kaappiin ilman liitosta, mikä on
-- oikea lopputulos.

-- ---------------------------------------------------------------------------
-- Sarakkeet
-- ---------------------------------------------------------------------------

alter table files
  add column if not exists expires_on date,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles (id) on delete set null,
  add column if not exists supplier_id uuid references suppliers (id) on delete set null,
  add column if not exists receipt_id uuid references receipts (id) on delete set null;

alter table folders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indeksit
-- ---------------------------------------------------------------------------
--
-- Vanhat indeksit rakennetaan uudelleen osittaisina: poistettu rivi ei
-- kuulu mihinkään normaaliin kyselyyn, eikä sen tarvitse viedä tilaa
-- niiden indekseistä.

drop index if exists files_by_folder;
create index files_by_folder
  on files (restaurant_id, folder_id, created_at desc)
  where deleted_at is null;

drop index if exists files_recent;
create index files_recent
  on files (restaurant_id, created_at desc)
  where deleted_at is null;

drop index if exists files_favorites;
create index files_favorites
  on files (restaurant_id, created_at desc)
  where is_favorite and deleted_at is null;

create index if not exists files_expiring
  on files (restaurant_id, expires_on)
  where expires_on is not null and deleted_at is null;

create index if not exists files_trash
  on files (restaurant_id, deleted_at)
  where deleted_at is not null;

create index if not exists files_by_supplier
  on files (supplier_id)
  where supplier_id is not null and deleted_at is null;

create index if not exists files_by_receipt
  on files (receipt_id)
  where receipt_id is not null and deleted_at is null;

/*
 * Nimen yksilöllisyys koskee vain eläviä kansioita.
 *
 * Muuten poistettu "2026" estäisi uuden luomisen samalla nimellä, ja
 * este olisi näkymätön: kansiota jota ei näy ei osaa myöskään
 * palauttaa mielessään.
 */
drop index if exists folders_unique_name_in_parent;
create unique index folders_unique_name_in_parent
  on folders (restaurant_id, parent_folder_id, lower(btrim(name)))
  where parent_folder_id is not null and deleted_at is null;

drop index if exists folders_unique_name_in_root;
create unique index folders_unique_name_in_root
  on folders (restaurant_id, lower(btrim(name)))
  where parent_folder_id is null and deleted_at is null;


-- ===========================================================================
-- 0075_files_lifecycle_actions.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0075 — Elinkaaren toiminnot
-- ---------------------------------------------------------------------------
--
-- Poisto muuttuu peruttavaksi, joten sen paluuarvo muuttuu: aiemmin se
-- palautti storage-polut heti poistettavaksi, nyt se ei poista mitään
-- storagesta. Polut palautuvat vasta lopullisessa siivouksessa.
--
-- Paluuarvon muutos vaatii funktion pudottamisen ensin — create or
-- replace ei voi muuttaa sitä.

drop function if exists delete_file(uuid);
drop function if exists delete_folder(uuid, text);

/*
 * Vanha register_file jaisi rinnalle.
 *
 * Uusi versio saa kolme valinnaista parametria, mika tekee siita eri
 * funktion. Kuuden parametrin kutsu osuisi molempiin, ja PostgREST
 * kieltaytyisi valitsemasta -- lataus lakkaisi toimimasta.
 */
drop function if exists register_file(uuid, uuid, text, text, text, bigint);

/* Paluutyyppi muuttuu: expires_on mukaan hakutulokseen. */
drop function if exists search_files(uuid, text, integer);

-- ---------------------------------------------------------------------------
-- Poisto roskakoriin
-- ---------------------------------------------------------------------------

create or replace function delete_file(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_file;

  perform write_audit(
    v_restaurant, 'deleted', 'file', p_file, v_name,
    'Siirsi tiedoston ' || v_name || ' roskakoriin'
  );
end;
$$;

/**
 * Monta tiedostoa kerralla.
 *
 * Kaksisataa kuittia väärässä kansiossa on ero käyttökelpoisen ja
 * käyttökelvottoman välillä. Silmukka sovelluksesta olisi kaksisataa
 * kutsua, joista osa voisi onnistua ja osa ei.
 *
 * Jokainen tunniste tarkistetaan erikseen: yksikin vieras rivi
 * joukossa kaataa koko kutsun eikä poista mitään.
 */
create or replace function delete_files(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any (p_ids) and deleted_at is null;

  get diagnostics v_count = row_count;

  perform write_audit(
    v_restaurant, 'deleted', 'file', null, null,
    'Siirsi ' || v_count || ' tiedostoa roskakoriin'
  );
end;
$$;

/**
 * Kansion poisto.
 *
 * p_mode = 'keep'     — tiedostot siirtyvät juureen, kansio roskakoriin
 * p_mode = 'contents' — myös tiedostot roskakoriin
 *
 * Alikansiot seuraavat aina mukana: käyttäjä näkee kansion
 * sisältöineen yhtenä asiana.
 */
create or replace function delete_folder(p_folder uuid, p_mode text default 'keep')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_count integer := 0;
  v_ids uuid[];
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder and deleted_at is null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_mode not in ('keep', 'contents') then
    raise exception 'Tuntematon poistotapa';
  end if;

  /*
   * Haara taulukkoon.
   *
   * Väliaikainen taulu eläisi istunnon yli ja tekisi kahdesta
   * peräkkäisestä poistosta toisistaan riippuvia.
   */
  with recursive tree as (
    select id from folders where id = p_folder
    union all
    select f.id from folders f join tree t on f.parent_folder_id = t.id
  )
  select array_agg(id) into v_ids from tree;

  if p_mode = 'contents' then
    update files
    set deleted_at = now(), deleted_by = auth.uid()
    where folder_id = any (v_ids) and deleted_at is null;

    get diagnostics v_count = row_count;
  else
    /* Tiedostot jäävät kaappiin, mutta kansiota ei enää ole. */
    update files
    set folder_id = null
    where folder_id = any (v_ids) and deleted_at is null;
  end if;

  update folders
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any (v_ids) and deleted_at is null;

  perform write_audit(
    v_restaurant, 'deleted', 'folder', p_folder, v_name,
    case
      when p_mode = 'contents'
        then 'Siirsi kansion ' || v_name || ' sisältöineen roskakoriin (' || v_count || ' tiedostoa)'
      else 'Siirsi kansion ' || v_name || ' roskakoriin'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Palautus
-- ---------------------------------------------------------------------------

/**
 * Tiedosto takaisin.
 *
 * Jos alkuperäinen kansio on yhä roskakorissa, tiedosto palautuu
 * juureen. Vaihtoehto olisi palauttaa kansio mukana, mutta silloin
 * yhden tiedoston palautus toisi takaisin koko kansion jota kukaan ei
 * pyytänyt.
 */
create or replace function restore_file(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is not null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files f
  set deleted_at = null,
      deleted_by = null,
      folder_id = case
        when f.folder_id is null then null
        when exists (
          select 1 from folders d
          where d.id = f.folder_id and d.deleted_at is null
        ) then f.folder_id
        else null
      end
  where f.id = p_file;

  perform write_audit(
    v_restaurant, 'updated', 'file', p_file, v_name,
    'Palautti tiedoston ' || v_name
  );
end;
$$;

/**
 * Kansio takaisin.
 *
 * Vain tämä kansio, ei sen alikansioita: haara palautuu ylhäältä alas
 * sitä mukaa kuin käyttäjä palauttaa. Jos emo on yhä roskakorissa,
 * kansio nousee juureen — muuten se palaisi paikkaan jota ei näy.
 */
create or replace function restore_folder(p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder and deleted_at is not null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update folders f
  set deleted_at = null,
      deleted_by = null,
      parent_folder_id = case
        when f.parent_folder_id is null then null
        when exists (
          select 1 from folders p
          where p.id = f.parent_folder_id and p.deleted_at is null
        ) then f.parent_folder_id
        else null
      end
  where f.id = p_folder;

  perform write_audit(
    v_restaurant, 'updated', 'folder', p_folder, v_name,
    'Palautti kansion ' || v_name
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lopullinen siivous
-- ---------------------------------------------------------------------------

/**
 * Roskakorin tyhjennys.
 *
 * p_days = 30  — vanhentuneet, ajetaan roskakoria avattaessa
 * p_days = 0   — kaikki, käyttäjän pyynnöstä
 *
 * Palauttaa storage-polut, koska kanta ei ylety storageen. Ne
 * palautetaan tässä eikä jätetä kutsujan haettavaksi erikseen: silloin
 * ne olisivat jo poissa.
 */
create or replace function purge_trash(p_restaurant uuid, p_days integer default 30)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Nolla tarkoittaa kaikkea, ei "vanhempaa kuin nyt".
   *
   * deleted_at < now() olisi epatosi juuri poistetulle rivilla, koska
   * now() on transaktion alkuhetki ja poisto tapahtui siina samassa.
   * Kayttajan "tyhjenna roskakori" ei siis tyhjentaisi sita mita han
   * juuri poisti.
   */
  v_days integer := greatest(coalesce(p_days, 30), 0);
  v_paths text[];
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  with poistetut as (
    delete from files
    where restaurant_id = p_restaurant
      and deleted_at is not null
      and (v_days = 0 or deleted_at < now() - make_interval(days => v_days))
    returning storage_path
  )
  select array_agg(storage_path) into v_paths from poistetut;

  delete from folders
  where restaurant_id = p_restaurant
    and deleted_at is not null
    and (v_days = 0 or deleted_at < now() - make_interval(days => v_days));

  return query select unnest(coalesce(v_paths, array[]::text[]));
end;
$$;

-- ---------------------------------------------------------------------------
-- Voimassaolo
-- ---------------------------------------------------------------------------

create or replace function set_file_expiry(p_file uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set expires_on = p_date where id = p_file;

  perform write_audit(
    v_restaurant, 'updated', 'file', p_file, v_name,
    case
      when p_date is null then 'Poisti voimassaolon tiedostolta ' || v_name
      else 'Asetti tiedoston ' || v_name || ' voimassaoloksi ' || to_char(p_date, 'DD.MM.YYYY')
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Liitokset
-- ---------------------------------------------------------------------------

/**
 * Tiedosto kiinni toimittajaan tai kuittiin.
 *
 * Molemmat päät tarkistetaan samasta ravintolasta, kuten siirroissa.
 * Ilman sitä oman tiedoston voisi liittää toisen ravintolan kuittiin
 * pelkällä tunnisteella, ja liitos näkyisi siellä.
 */
create or replace function link_file(
  p_file uuid,
  p_supplier uuid,
  p_receipt uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_other uuid;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_supplier is not null then
    select restaurant_id into v_other from suppliers where id = p_supplier;
    if v_other is distinct from v_restaurant then
      raise exception 'Toimittaja on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_receipt is not null then
    select restaurant_id into v_other from receipts where id = p_receipt;
    if v_other is distinct from v_restaurant then
      raise exception 'Kuitti on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files
  set supplier_id = p_supplier, receipt_id = p_receipt
  where id = p_file;
end;
$$;

-- ---------------------------------------------------------------------------
-- Joukkotoiminnot
-- ---------------------------------------------------------------------------

create or replace function move_files(p_ids uuid[], p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
  v_target uuid;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_folder is not null then
    select restaurant_id into v_target
    from folders where id = p_folder and deleted_at is null;

    if v_target is null then raise exception 'Kohdekansiota ei löydy'; end if;

    if v_target <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files set folder_id = p_folder
  where id = any (p_ids) and deleted_at is null;

  get diagnostics v_count = row_count;

  perform write_audit(
    v_restaurant, 'moved', 'file', null, null,
    'Siirsi ' || v_count || ' tiedostoa → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );
end;
$$;

create or replace function set_files_favorite(p_ids uuid[], p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set is_favorite = coalesce(p_value, false)
  where id = any (p_ids) and deleted_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Poistetut pois normaaleista näkymistä
-- ---------------------------------------------------------------------------

create or replace function folder_counts(p_restaurant uuid)
returns table (folder_id uuid, file_count bigint)
language sql
stable
set search_path = public
as $$
  select f.folder_id, count(*)
  from files f
  where f.restaurant_id = p_restaurant
    and f.folder_id is not null
    and f.deleted_at is null
  group by f.folder_id;
$$;

create or replace function search_files(
  p_restaurant uuid,
  p_term text,
  p_limit integer default 50
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  folder_id uuid,
  folder_path text,
  is_favorite boolean,
  created_at timestamptz,
  expires_on date
)
language sql
stable
set search_path = public
as $$
  select
    f.id,
    f.file_name,
    f.file_type,
    f.file_size,
    f.folder_id,
    folder_path_text(f.folder_id),
    f.is_favorite,
    f.created_at,
    f.expires_on
  from files f
  where f.restaurant_id = p_restaurant
    and f.deleted_at is null
    and btrim(coalesce(p_term, '')) <> ''
    and lower(f.file_name) like '%' || lower(btrim(p_term)) || '%'
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

/**
 * Kirjaus lisätiedoin.
 *
 * Voimassaolo ja liitokset ovat valinnaisia parametreja eivätkä omia
 * kutsujaan: lataus tietää ne jo, ja erillinen kutsu olisi toinen
 * verkkokierros jonka epäonnistuminen jättäisi tiedoston puolitiehen.
 */
create or replace function register_file(
  p_restaurant uuid,
  p_folder uuid,
  p_name text,
  p_path text,
  p_type text,
  p_size bigint,
  p_expires date default null,
  p_supplier uuid default null,
  p_receipt uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' then raise exception 'Tiedoston nimi puuttuu'; end if;
  if coalesce(btrim(p_path), '') = '' then raise exception 'Polku puuttuu'; end if;
  if coalesce(p_size, 0) <= 0 then raise exception 'Tiedosto on tyhjä'; end if;

  if p_folder is not null then
    select restaurant_id into v_restaurant
    from folders where id = p_folder and deleted_at is null;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if split_part(p_path, '/', 1) <> v_restaurant::text then
    raise exception 'Polku ei kuulu tälle ravintolalle';
  end if;

  insert into files (
    restaurant_id, folder_id, file_name, storage_path,
    file_type, file_size, uploaded_by, expires_on, supplier_id, receipt_id
  )
  values (
    v_restaurant, p_folder, v_name, btrim(p_path),
    coalesce(nullif(btrim(p_type), ''), 'application/octet-stream'),
    p_size, auth.uid(), p_expires, p_supplier, p_receipt
  )
  returning id into v_id;

  perform write_audit(
    v_restaurant, 'created', 'file', v_id, v_name,
    'Lisäsi tiedoston ' || v_name || ' → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- from public ei riitä: Supabase myöntää anonille suoran oikeuden.

revoke execute on function delete_file(uuid) from public, anon;
revoke execute on function delete_files(uuid[]) from public, anon;
revoke execute on function delete_folder(uuid, text) from public, anon;
revoke execute on function restore_file(uuid) from public, anon;
revoke execute on function restore_folder(uuid) from public, anon;
revoke execute on function purge_trash(uuid, integer) from public, anon;
revoke execute on function set_file_expiry(uuid, date) from public, anon;
revoke execute on function link_file(uuid, uuid, uuid) from public, anon;
revoke execute on function move_files(uuid[], uuid) from public, anon;
revoke execute on function set_files_favorite(uuid[], boolean) from public, anon;
revoke execute on function folder_counts(uuid) from public, anon;
revoke execute on function search_files(uuid, text, integer) from public, anon;
revoke execute on function register_file(uuid, uuid, text, text, text, bigint, date, uuid, uuid) from public, anon;

grant execute on function delete_file(uuid) to authenticated;
grant execute on function delete_files(uuid[]) to authenticated;
grant execute on function delete_folder(uuid, text) to authenticated;
grant execute on function restore_file(uuid) to authenticated;
grant execute on function restore_folder(uuid) to authenticated;
grant execute on function purge_trash(uuid, integer) to authenticated;
grant execute on function set_file_expiry(uuid, date) to authenticated;
grant execute on function link_file(uuid, uuid, uuid) to authenticated;
grant execute on function move_files(uuid[], uuid) to authenticated;
grant execute on function set_files_favorite(uuid[], boolean) to authenticated;
grant execute on function folder_counts(uuid) to authenticated;
grant execute on function search_files(uuid, text, integer) to authenticated;
grant execute on function register_file(uuid, uuid, text, text, text, bigint, date, uuid, uuid) to authenticated;


-- ===========================================================================
-- 0076_folder_default_key.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0076 — Lähtökansiot seuraavat käyttäjän kieltä
-- ---------------------------------------------------------------------------
--
-- Kate luo yhdeksän lähtökansiota suomeksi. Turkinkielinen käyttäjä näki
-- siis turkinkielisen sovelluksen jossa lukee "Sopimukset", "Kuitit" ja
-- "Myyntiraportit" — eikä hän voi tietää ovatko ne käännösvirhe vai
-- jonkun aiemmin kirjoittamia nimiä.
--
-- ---------------------------------------------------------------------------
-- MIKSI EI NIMEN UUDELLEENKIRJOITUSTA
-- ---------------------------------------------------------------------------
--
-- Suoraviivaisin korjaus olisi kirjoittaa nimet uudelleen kun käyttäjä
-- vaihtaa kieltä. Se ei käy: kieli on käyttäjäkohtainen
-- (profiles.locale). Saman ravintolan kaksi käyttäjää voivat lukea
-- Katea eri kielillä, ja toisen valinta muuttaisi sen mitä toinen näkee
-- kansiopuussa.
--
-- ---------------------------------------------------------------------------
-- RIVI MUISTAA OLEVANSA KOSKEMATON
-- ---------------------------------------------------------------------------
--
-- default_key kertoo että tämä kansio on Katen luoma ehdotus jota
-- kukaan ei ole vielä nimennyt. Sellainen käännetään näytettäessä.
--
-- Uudelleennimeäminen tyhjentää avaimen. Siitä hetkestä nimi on
-- käyttäjän oma eikä käänny enää millään kielellä — myös silloin kun
-- hän sattui kirjoittamaan täsmälleen saman sanan takaisin. Se on
-- oikein: hän on silloin päättänyt nimen, eikä päätöstä pidä perua
-- hänen puolestaan.
--
-- Nimi säilyy kannassa sellaisenaan. Käännös on esitystapa, ei tieto —
-- muuten sama rivi tarkoittaisi eri asiaa riippuen siitä kuka katsoo.

alter table folders
  add column if not exists default_key text;

/*
 * Avain on yksilöllinen ravintolassa.
 *
 * Kaksi "kuitit"-avainta samassa ravintolassa näyttäisi samalta
 * nimeltä kahdesti, eikä käyttäjä voisi erottaa niitä toisistaan.
 */
create unique index if not exists folders_default_key_once
  on folders (restaurant_id, default_key)
  where default_key is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Lähtökansiot avaimineen
-- ---------------------------------------------------------------------------

drop function if exists default_folder_names();

create or replace function default_folder_names()
returns table (key text, name text, sort_order integer)
language sql
immutable
set search_path = public
as $$
  values
    ('contracts',     'Sopimukset',        0),
    ('receipts',      'Kuitit',            1),
    ('sales_reports', 'Myyntiraportit',    2),
    ('invoices',      'Laskut',            3),
    ('finance',       'Talous',            4),
    ('staff',         'Työntekijät',       5),
    ('authorities',   'Viranomaiset',      6),
    ('important',     'Tärkeät tiedostot', 7),
    ('other',         'Muut',              8);
$$;

create or replace function seed_default_folders(p_restaurant uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into folders (restaurant_id, parent_folder_id, name, sort_order, default_key)
  select p_restaurant, null, d.name, d.sort_order, d.key
  from default_folder_names() d
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Nimeäminen katkaisee sidoksen
-- ---------------------------------------------------------------------------

create or replace function rename_folder(p_folder uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_old text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Kansion nimi puuttuu';
  end if;

  select restaurant_id, name into v_restaurant, v_old
  from folders where id = p_folder and deleted_at is null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * default_key nollataan aina, myös silloin kun nimi ei muutu.
   *
   * Käyttäjä avasi nimeämisen ja hyväksyi nimen. Se on päätös, ja
   * päätöksen jälkeen kansio ei saa vaihtaa nimeään kielen mukana.
   */
  update folders
  set name = v_name, default_key = null
  where id = p_folder;

  perform write_audit(
    v_restaurant, 'renamed', 'folder', p_folder, v_name,
    'Nimesi kansion ' || v_old || ' → ' || v_name
  );
end;
$$;

revoke execute on function default_folder_names() from public, anon, authenticated;
revoke execute on function seed_default_folders(uuid) from public, anon, authenticated;
revoke execute on function rename_folder(uuid, text) from public, anon;
grant execute on function rename_folder(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Olemassa olevat kansiot
-- ---------------------------------------------------------------------------
--
-- Ravintolat jotka on jo luotu saivat kansionsa ilman avainta. Ne
-- tunnistetaan nimestä — mutta vain juuritason kansiot, ja vain jos
-- nimi täsmää tarkalleen. Käyttäjän itse luoma "Talous" jossakin
-- alikansiossa ei ole Katen ehdotus eikä sitä ruveta kääntämään.

update folders f
set default_key = d.key
from default_folder_names() d
where f.parent_folder_id is null
  and f.default_key is null
  and lower(btrim(f.name)) = lower(d.name);

-- ---------------------------------------------------------------------------
-- Haku: osumat järjestykseen
-- ---------------------------------------------------------------------------

/**
 * Haku nimen osalla, parhaat ensin.
 *
 * Aiemmin järjestys oli pelkkä lisäysaika. Yhden kirjaimen haku "a"
 * palautti siis kaiken minkä nimessä sattuu olemaan a-kirjain,
 * satunnaisen näköisessä järjestyksessä — ja se on juuri se hetki
 * jolloin käyttäjä on kirjoittanut vasta yhden kirjaimen.
 *
 * Järjestys on kolmiportainen:
 *
 *   1. Nimi alkaa hakusanalla. Sitä käyttäjä useimmiten etsii.
 *   2. Osuman kohta nimessä. Aiempi osuma on parempi kuin myöhempi.
 *   3. Uusin ensin. Tasapelit eivät saa heilua latauksesta toiseen.
 *
 * Järjestys on kannassa eikä selaimessa, koska rajaus katkaisee listan
 * ennen kuin selain näkee sen: sadan tuloksen raja veisi parhaat
 * osumat mennessään jos ne olisivat lopussa.
 *
 * folder_path palautetaan tyhjänä. Sijainti lasketaan selaimessa,
 * jossa lähtökansioiden käännökset ovat käytettävissä — kanta ei tiedä
 * käyttäjän kieltä.
 */
create or replace function search_files(
  p_restaurant uuid,
  p_term text,
  p_limit integer default 50
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  folder_id uuid,
  folder_path text,
  is_favorite boolean,
  created_at timestamptz,
  expires_on date
)
language sql
stable
set search_path = public
as $$
  with haku as (select lower(btrim(coalesce(p_term, ''))) as term)
  select
    f.id,
    f.file_name,
    f.file_type,
    f.file_size,
    f.folder_id,
    ''::text,
    f.is_favorite,
    f.created_at,
    f.expires_on
  from files f, haku h
  where f.restaurant_id = p_restaurant
    and f.deleted_at is null
    and h.term <> ''
    and lower(f.file_name) like '%' || h.term || '%'
  order by
    case when lower(f.file_name) like h.term || '%' then 0 else 1 end,
    position(h.term in lower(f.file_name)),
    f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function search_files(uuid, text, integer) from public, anon;
grant execute on function search_files(uuid, text, integer) to authenticated;


-- ===========================================================================
-- 0077_file_reminder.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0077 — Voimassaolosta tehtävä
-- ---------------------------------------------------------------------------
--
-- Vanheneva lupa oli merkintä tiedostorivillä. Merkintä on huomio, ei
-- teko: se katoaa näkyvistä kun sivu suljetaan, eikä kukaan tee sille
-- mitään ennen kuin joku sattuu avaamaan Voimassaolo-välilehden.
--
-- Kate tekee siitä nyt tehtävän määräpäivineen. Tehtävät-osiossa on jo
-- eräpäivä, prioriteetti ja vastuuhenkilö — tämä on kytkentä, ei uusi
-- ominaisuus.
--
-- ---------------------------------------------------------------------------
-- MIKSI SARAKE EIKÄ HAKU
-- ---------------------------------------------------------------------------
--
-- Ilman sidosta tehtävä pitäisi löytää otsikon perusteella, kun
-- voimassaolo muuttuu tai poistetaan. Otsikko on käyttäjän muokattavissa
-- ja kuudella kielellä, joten haku löytäisi joskus väärän tehtävän ja
-- joskus ei mitään.
--
-- on delete set null: tehtävän poisto ei saa viedä tiedostoa mukanaan.
-- Sidos katkeaa, ja seuraava voimassaolon muutos tekee uuden tehtävän.

alter table files
  add column if not exists reminder_task_id uuid references tasks (id) on delete set null;

create index if not exists files_reminder
  on files (reminder_task_id)
  where reminder_task_id is not null;


-- ===========================================================================
-- 0078_file_activity.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0078 — Viimeksi käytetyt ja kansion viimeisin tapahtuma
-- ---------------------------------------------------------------------------
--
-- Ravintoloitsija ei muista missä kansiossa vuokrasopimus on. Hän
-- muistaa katsoneensa sitä viime viikolla.
--
-- "Viimeksi lisätyt" ei vastaa siihen: se kertoo mikä on uutta, ei mitä
-- on käytetty. Sopimus on voitu tallentaa vuosi sitten ja avata eilen —
-- ja juuri se eilinen avaus on se mistä sen löytää uudelleen.
--
-- ---------------------------------------------------------------------------
-- AVAUS ON TIETO, EI LOKI
-- ---------------------------------------------------------------------------
--
-- Sarake rivillä, ei erillistä tapahtumataulua. Kysymys on "milloin
-- tätä viimeksi katsottiin", ei "kuka katsoi mitäkin milloin".
-- Jälkimmäiseen vastaa audit_log, ja se on eri kysymys eri
-- käyttötarkoitukseen.
--
-- Ei myöskään käyttäjäkohtaisesti. Ravintolassa on muutama esihenkilö
-- ja he katsovat samoja papereita; "kuka viimeksi avasi" olisi tieto
-- jota kukaan ei kysy.

alter table files
  add column if not exists last_opened_at timestamptz;

create index if not exists files_recently_opened
  on files (restaurant_id, last_opened_at desc)
  where last_opened_at is not null and deleted_at is null;

/**
 * Avausajan merkintä.
 *
 * Lukuoikeus riittää: kirjanpitäjä saa avata tiedoston, ja hänen
 * avauksensa on yhtä lailla tieto siitä että tiedostoa käytetään.
 * files_write-käytäntö vaatisi esihenkilön, joten tämä on security
 * definer omalla tarkistuksellaan.
 *
 * Tuntematon tunniste palautuu hiljaa. Avaus on jo tapahtunut tai
 * epäonnistunut muualla, eikä merkinnän epäonnistuminen saa kaataa
 * tiedoston lataamista.
 */
create or replace function mark_file_opened(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then return; end if;

  if not can_read_finance(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set last_opened_at = now() where id = p_file;
end;
$$;

revoke execute on function mark_file_opened(uuid) from public, anon;
grant execute on function mark_file_opened(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Kansion viimeisin tapahtuma
-- ---------------------------------------------------------------------------
--
-- "86 tiedostoa · päivitetty tänään" kertoo yhdellä silmäyksellä missä
-- eletään ja mikä on hiljaista. Aika lasketaan samassa kyselyssä kuin
-- lukumäärä, joten se ei maksa erillistä kierrosta.
--
-- Paluutyyppi muuttuu, joten funktio on pudotettava ensin.

drop function if exists folder_counts(uuid);

create or replace function folder_counts(p_restaurant uuid)
returns table (folder_id uuid, file_count bigint, last_activity timestamptz)
language sql
stable
set search_path = public
as $$
  select f.folder_id, count(*), max(f.updated_at)
  from files f
  where f.restaurant_id = p_restaurant
    and f.folder_id is not null
    and f.deleted_at is null
  group by f.folder_id;
$$;

revoke execute on function folder_counts(uuid) from public, anon;
grant execute on function folder_counts(uuid) to authenticated;


-- ===========================================================================
-- 0079_payroll_tax_rules.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0079 — Palkanlaskennan vuosisäännöt
-- ---------------------------------------------------------------------------
--
-- Suomalainen palkanlaskenta on täynnä lukuja jotka muuttuvat kerran
-- vuodessa: työeläkemaksu, työttömyysvakuutusmaksu, työnantajan
-- sairausvakuutusmaksu, luontoisetujen verotusarvot. Yksikään niistä
-- ei ole sovelluslogiikkaa. Ne ovat tietoa jonka joku muu päättää.
--
-- ---------------------------------------------------------------------------
-- MIKSI TAULU EIKÄ VAKIO
-- ---------------------------------------------------------------------------
--
-- Kirjoitettuna koodiin "7,30 %" olisi oikein tasan vuoden. Kun
-- prosentti muuttuu 2027, vaihtoehtoja olisi kaksi: muuttaa vakio ja
-- rikkoa jokainen vuoden 2026 palkkalaskelma takautuvasti, tai
-- kirjoittaa if-lause vuosiluvusta ja toinen ensi vuonna.
--
-- Taulu tekee vuosimuutoksesta yhden rivin. Vanhat laskelmat pysyvät
-- ennallaan, koska ne lukevat oman vuotensa rivin — ja koska ne
-- tallentavat käytetyt arvot itseensä (0081).
--
-- ---------------------------------------------------------------------------
-- MITÄ TÄÄLLÄ EI OLE
-- ---------------------------------------------------------------------------
--
-- Ennakonpidätysprosenttia ei ole. Kate ei laske työntekijän
-- veroprosenttia — sen laskee Verohallinto ja se lukee verokortissa.
-- Täällä on vain se prosentti jota laki käskee käyttää silloin kun
-- verokorttia ei ole lainkaan.
--
-- Työnantajan tapaturmavakuutus- ja ryhmähenkivakuutusmaksua ei ole.
-- Ne eivät ole kansallisia prosentteja vaan vakuutusyhtiön ja
-- toimialan riskiluokan mukaisia, eikä keksitty luku ole parempi kuin
-- puuttuva luku.
--
-- ---------------------------------------------------------------------------
-- LÄHTEET
-- ---------------------------------------------------------------------------
--
-- Vuoden 2026 arvot on haettu näistä:
--
--   Eläketurvakeskus, Työeläkemaksut vuonna 2026
--   https://www.etk.fi/ajankohtaista/tyoelakemaksut-vuonna-2026/
--
--   Työeläkeyhtiö Elo, Sosiaalivakuutusmaksut 2026
--   https://www.elo.fi/fi-fi/tyonantaja/tyel-vakuuttaminen/tyel-maksu/
--   sosiaalivakuutusmaksut-2026
--
--   Verohallinto, Verokorttiohjeet maksajalle
--   https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/
--   yritys_tyonantajana/verokorttiohjeet/
--
--   Verohallinnon päätös luontoisetujen laskentaperusteista 2026
--   https://www.vero.fi/en/detailed-guidance/decisions/47380/
--   in-kind-benefits-fringe-benefits-2026/
--
-- Lähde tallennetaan riville. Kun joku kysyy kahden vuoden päästä
-- mistä 1,91 % tuli, vastaus on rivillä eikä kenenkään muistissa.

-- ---------------------------------------------------------------------------
-- 1. Vuosisäännöt
-- ---------------------------------------------------------------------------

create table if not exists payroll_tax_rules (
  tax_year integer primary key,

  -- --- Työntekijältä perittävät ------------------------------------------
  --
  -- Nämä kolme ovat ainoat jotka työnantaja pidättää palkasta
  -- ennakonpidätyksen lisäksi. Työntekijän sairausvakuutusmaksu ei ole
  -- listassa: se sisältyy verokortin pidätysprosenttiin eikä sitä
  -- peritä erikseen. Erillisenä se veloitettaisiin kahdesti.

  /** Työntekijän työeläkevakuutusmaksu, % palkasta. */
  employee_pension_rate numeric(5, 2) not null,

  /** Palkansaajan työttömyysvakuutusmaksu, % palkasta. */
  employee_unemployment_rate numeric(5, 2) not null,

  -- --- Työnantajan maksut -------------------------------------------------

  /**
   * Työnantajan työeläkevakuutusmaksu, % palkasta.
   *
   * Tämä on keskimääräinen luku. Todellinen maksu riippuu
   * vakuutusyhtiöstä, yrityksen koosta ja asiakashyvityksistä, joten
   * ravintola voi korvata sen omallaan (payroll_settings).
   */
  employer_pension_rate numeric(5, 2) not null,

  /** Työnantajan sairausvakuutusmaksu, % palkasta. */
  employer_health_rate numeric(5, 2) not null,

  /*
   * Työnantajan työttömyysvakuutusmaksu on porrastettu.
   *
   * Alempi prosentti rajaan asti, ylempi sen ylittävältä osalta.
   * Raja lasketaan koko vuoden palkkasummasta, ei kuukaudesta.
   */
  employer_unemployment_low_rate numeric(5, 2) not null,
  employer_unemployment_high_rate numeric(5, 2) not null,
  employer_unemployment_threshold_cents bigint not null,

  -- --- Ennakonpidätys -----------------------------------------------------

  /**
   * Pidätysprosentti kun verokorttia ei ole.
   *
   * Ei oletus eikä arvaus vaan laissa säädetty seuraus siitä ettei
   * verokorttia esitetä. Kate ei keksi tähän mitään lievempää.
   */
  no_tax_card_rate numeric(5, 2) not null,

  /** Suurin sallittu pidätysprosentti verokortilla. */
  max_withholding_rate numeric(5, 2) not null default 60.00,

  -- --- Ikärajat -----------------------------------------------------------
  --
  -- Maksuvelvollisuus alkaa ja päättyy iän mukaan. Rajat ovat
  -- säännöissä eivätkä koodissa, koska nekin ovat muuttuneet
  -- useammin kuin kerran.

  pension_min_age smallint not null,
  pension_max_age smallint not null,
  unemployment_min_age smallint not null,
  unemployment_max_age smallint not null,

  -- --- Jäljitettävyys -----------------------------------------------------

  /** Mistä luvut on otettu. Yksi tai useampi osoite, rivinvaihdoin. */
  source_url text not null default '',
  source_note text not null default '',

  /*
   * Vahvistettu vai alustava.
   *
   * Ensi vuoden luvut tiedetään usein loppusyksystä, mutta ne
   * vahvistetaan myöhemmin. Merkintä kertoo laskelman lukijalle
   * kummasta on kyse.
   */
  confirmed boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_tax_rules_year check (tax_year between 2000 and 2100),
  constraint payroll_tax_rules_rates check (
    employee_pension_rate >= 0 and employee_pension_rate <= 100
    and employee_unemployment_rate >= 0 and employee_unemployment_rate <= 100
    and employer_pension_rate >= 0 and employer_pension_rate <= 100
    and employer_health_rate >= 0 and employer_health_rate <= 100
    and employer_unemployment_low_rate >= 0
    and employer_unemployment_high_rate >= 0
    and no_tax_card_rate >= 0 and no_tax_card_rate <= 100
  ),
  constraint payroll_tax_rules_ages check (
    pension_min_age >= 0 and pension_max_age > pension_min_age
    and unemployment_min_age >= 0 and unemployment_max_age > unemployment_min_age
  )
);

-- ---------------------------------------------------------------------------
-- 2. Luontoisetujen verotusarvot
-- ---------------------------------------------------------------------------
--
-- Oma taulu eikä sarakkeita sääntöriville: etuja on kymmenkunta ja
-- niitä tulee lisää. Sarakkeina jokainen uusi etu olisi migraatio.
--
-- Kaikkia ei voi arvottaa taulukosta. Autoedun ja asuntoedun arvo
-- riippuu autosta ja asunnosta, joten niille tallennetaan arvo nollana
-- ja merkintä siitä että arvo on syötettävä käsin. Kate ei arvaa
-- työsuhdeauton verotusarvoa.

do $$ begin
  create type benefit_kind as enum (
    'meal', 'phone', 'car', 'housing', 'bicycle', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists payroll_benefit_values (
  tax_year integer not null references payroll_tax_rules(tax_year) on delete cascade,
  kind benefit_kind not null,

  /**
   * Verotusarvo sentteinä.
   *
   * Ravintoedulla ateriaa kohti, muilla kuukaudessa. Nolla tarkoittaa
   * ettei taulukkoarvoa ole — silloin arvo on aina syötettävä.
   */
  value_cents integer not null default 0,

  /** 'per_month' tai 'per_meal'. Kertoo mitä value_cents tarkoittaa. */
  unit text not null default 'per_month',

  /**
   * Vaatiiko käsin syötetyn arvon.
   *
   * Autoetu ja asuntoetu lasketaan aina tapauskohtaisesti. Merkintä
   * estää käyttöliittymää tarjoamasta nollaa oletusarvona.
   */
  requires_manual_value boolean not null default false,

  note text not null default '',

  primary key (tax_year, kind),

  constraint payroll_benefit_values_value check (value_cents >= 0),
  constraint payroll_benefit_values_unit check (unit in ('per_month', 'per_meal'))
);

-- ---------------------------------------------------------------------------
-- 3. Ravintolan omat palkka-asetukset
-- ---------------------------------------------------------------------------
--
-- Kansallinen keskiarvo ei ole kenenkään todellinen maksu. Työnantajan
-- TyEL-maksu riippuu vakuutusyhtiöstä ja asiakashyvityksistä,
-- tapaturmavakuutus toimialan riskiluokasta. Nämä ravintola tietää ja
-- Kate ei.
--
-- Rivi on vapaaehtoinen: ilman sitä käytetään vuosisääntöjen
-- keskiarvoa, ja työnantajan kustannus on likiarvo. Sen sanotaan
-- laskelmassa ääneen.

create table if not exists payroll_settings (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,

  /** Ravintolan oma työnantajan TyEL-%. Null = käytä vuoden keskiarvoa. */
  employer_pension_rate numeric(5, 2),

  /** Tapaturmavakuutusmaksu, %. Null = ei mukana laskelmassa. */
  employer_accident_rate numeric(5, 2),

  /** Ryhmähenkivakuutusmaksu, %. Null = ei mukana laskelmassa. */
  employer_group_life_rate numeric(5, 2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_settings_rates check (
    (employer_pension_rate is null or (employer_pension_rate >= 0 and employer_pension_rate <= 100))
    and (employer_accident_rate is null or (employer_accident_rate >= 0 and employer_accident_rate <= 100))
    and (employer_group_life_rate is null or (employer_group_life_rate >= 0 and employer_group_life_rate <= 100))
  )
);

-- ---------------------------------------------------------------------------
-- 4. Vuoden 2026 arvot
-- ---------------------------------------------------------------------------
--
-- Vuoden 2026 muutos työeläkemaksussa: ikäryhmittäin eriytyneet
-- työntekijämaksut poistuivat. Vuosina 2017–2025 53–62-vuotias maksoi
-- korkeampaa maksua; 2026 alkaen kaikki maksavat 7,30 %.
--
-- Työnantajan 17,10 % on keskiarvo. Todellinen maksu on
-- vakuutusyhtiökohtainen, ja ravintola voi korvata sen omallaan.

insert into payroll_tax_rules (
  tax_year,
  employee_pension_rate,
  employee_unemployment_rate,
  employer_pension_rate,
  employer_health_rate,
  employer_unemployment_low_rate,
  employer_unemployment_high_rate,
  employer_unemployment_threshold_cents,
  no_tax_card_rate,
  max_withholding_rate,
  pension_min_age,
  pension_max_age,
  unemployment_min_age,
  unemployment_max_age,
  source_url,
  source_note,
  confirmed
) values (
  2026,
  7.30,
  0.89,
  17.10,
  1.91,
  0.31,
  1.23,
  250950000,
  60.00,
  60.00,
  17,
  68,
  18,
  65,
  'https://www.etk.fi/ajankohtaista/tyoelakemaksut-vuonna-2026/' || chr(10) ||
  'https://www.elo.fi/fi-fi/tyonantaja/tyel-vakuuttaminen/tyel-maksu/sosiaalivakuutusmaksut-2026' || chr(10) ||
  'https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/yritys_tyonantajana/verokorttiohjeet/',
  'Tyontekijamaksun ikaporrastus poistui 2026 alkaen: kaikki ikaryhmat 7,30 %. ' ||
  'Tyonantajan TyEL 17,10 % on keskiarvo, todellinen maksu on vakuutusyhtiokohtainen. ' ||
  'Tyonantajan tyottomyysvakuutusmaksun raja 2 509 500 euroa vuoden palkkasummasta. ' ||
  'Ennakonpidatys ilman verokorttia 60 %.',
  true
)
on conflict (tax_year) do nothing;

insert into payroll_benefit_values (tax_year, kind, value_cents, unit, requires_manual_value, note)
values
  (2026, 'meal',    880, 'per_meal',  false,
   'Verohallinnon paatos 2026, 10 §. 8,80 euroa ateriaa kohti kun tyonantajan valittomat kustannukset ovat 8,80-14,00 euroa.'),
  (2026, 'phone',  2000, 'per_month', false,
   'Verohallinnon paatos 2026, 26 §. 20 euroa kuukaudessa.'),
  (2026, 'bicycle',   0, 'per_month', true,
   'Verohallinnon paatos 2026, 27 §. Arvo lasketaan pyoran hankintahinnasta; kunnossapito-osuus 30 e/kk sahkopyoralle ja 20 e/kk muulle. Syotettava kasin.'),
  (2026, 'car',       0, 'per_month', true,
   'Verohallinnon paatos 2026, 17 §. Arvo riippuu auton ika- ja hintaryhmasta. Syotettava kasin.'),
  (2026, 'housing',   0, 'per_month', true,
   'Verohallinnon paatos 2026, 2 §. Arvo riippuu sijainnista ja pinta-alasta. Syotettava kasin.'),
  (2026, 'other',     0, 'per_month', true,
   'Kayvan arvon mukaan, Verohallinnon paatos 2026, 28 §. Syotettava kasin.')
on conflict (tax_year, kind) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Oikeudet
-- ---------------------------------------------------------------------------
--
-- Vuosisäännöt ja luontoisetujen taulukkoarvot ovat julkista tietoa:
-- ne lukevat Verohallinnon ja Eläketurvakeskuksen sivuilla. Jokainen
-- kirjautunut saa lukea ne, koska palkkalaskelman lukijan on voitava
-- tarkistaa mistä luku tuli.
--
-- Kirjoitusoikeutta ei anneta kenellekään. Nämä rivit tulevat
-- migraatiosta, eikä ravintola saa muuttaa kansallisia prosentteja
-- omassa kannassaan — muutettu prosentti olisi väärä palkka ilman
-- että kukaan huomaisi.

alter table payroll_tax_rules enable row level security;
alter table payroll_benefit_values enable row level security;
alter table payroll_settings enable row level security;

drop policy if exists payroll_tax_rules_read on payroll_tax_rules;
create policy payroll_tax_rules_read on payroll_tax_rules
  for select to authenticated using (true);

drop policy if exists payroll_benefit_values_read on payroll_benefit_values;
create policy payroll_benefit_values_read on payroll_benefit_values
  for select to authenticated using (true);

/*
 * Palkka-asetukset ovat ravintolan omia.
 *
 * Lukuoikeus jäsenille: työnantajan kustannus näkyy laskelmalla, ja
 * sen tarkistaminen vaatii tiedon käytetystä prosentista.
 * Kirjoitusoikeus vain esihenkilölle.
 */
drop policy if exists payroll_settings_read on payroll_settings;
create policy payroll_settings_read on payroll_settings
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists payroll_settings_write on payroll_settings;
create policy payroll_settings_write on payroll_settings
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists payroll_tax_rules_touch on payroll_tax_rules;
create trigger payroll_tax_rules_touch before update on payroll_tax_rules
  for each row execute function touch_updated_at();

drop trigger if exists payroll_settings_touch on payroll_settings;
create trigger payroll_settings_touch before update on payroll_settings
  for each row execute function touch_updated_at();


-- ===========================================================================
-- 0080_tax_cards.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0080 — Verokortit, luontoisedut ja työsuhteen tiedot
-- ---------------------------------------------------------------------------
--
-- Verokortti on ainoa paikka josta ennakonpidätysprosentti tulee. Kate
-- ei laske sitä eikä arvaa sitä: Verohallinto laskee sen ja työntekijä
-- tuo sen. Tämän tiedoston tehtävä on ottaa se vastaan niin, ettei
-- kukaan voi myöhemmin kysyä "millä perusteella tästä pidätettiin
-- kaksikymmentä prosenttia" ilman että vastaus löytyy.
--
-- ---------------------------------------------------------------------------
-- VANHAA VEROKORTTIA EI KORVATA, SEN PÄÄLLE TULEE UUSI
-- ---------------------------------------------------------------------------
--
-- Työntekijällä on vuoden aikana usein kaksi tai kolme verokorttia:
-- tammikuun vanha, helmikuun uusi, ja kesällä muutosverokortti. Jos
-- uusi kirjoittaisi vanhan yli, kesäkuussa maksetun palkan perustetta
-- ei enää olisi olemassa.
--
-- Siksi verokortti on rivi jolla on voimassaoloväli, ja rivejä on niin
-- monta kuin kortteja on ollut. Päällekkäisyys estetään kannassa
-- exclude-rajoitteella eikä sovelluksessa: sovellustarkistus pätee
-- siihen polkuun jonka joku muisti tarkistaa.
--
-- ---------------------------------------------------------------------------
-- MAKSUPÄIVÄ VALITSEE KORTIN, EI TYÖPÄIVÄ
-- ---------------------------------------------------------------------------
--
-- Verohallinnon ohje on yksiselitteinen: sovellettava verokortti
-- määräytyy suorituksen maksupäivästä. Kesäkuussa tehty työ joka
-- maksetaan heinäkuussa kuuluu heinäkuun kortille.
--
-- Tämä on helppo tehdä väärin, koska työvuoro on se jota katsotaan.
-- Siksi hakufunktio ottaa parametrikseen maksupäivän ja sen nimi
-- sanoo sen ääneen.
--
-- ---------------------------------------------------------------------------
-- DOKUMENTTI MENEE TIEDOSTOKAAPPIIN, EI OMAAN SÄILÖÖNSÄ
-- ---------------------------------------------------------------------------
--
-- Katessa on jo yksityinen tiedostokaappi käytäntöineen, käyttö-
-- oikeuksineen ja välityspalvelimineen. Toinen säilö verokorteille
-- olisi toinen paikka jossa yksityisyys pitäisi muistaa toteuttaa
-- oikein.
--
-- Verokortin dokumentti on siis tavallinen files-rivi, ja verokortti
-- viittaa siihen. Pelkkä PDF kansiossa ei kuitenkaan riitä
-- palkanlaskentaan: prosentit luetaan aina tältä riviltä.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Verokortti
-- ---------------------------------------------------------------------------

do $$ begin
  create type tax_card_source as enum ('manual', 'document');
exception when duplicate_object then null; end $$;

create table if not exists tax_cards (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  /**
   * Perusprosentti: pidätys tulorajaan asti.
   *
   * numeric eikä integer, koska verokortissa lukee 17,5 eikä 17.
   */
  base_percent numeric(5, 2) not null,

  /** Lisäprosentti: pidätys tulorajan ylittävältä osalta. */
  additional_percent numeric(5, 2) not null,

  /** Vuositulorajа sentteinä. */
  income_limit_cents bigint not null,

  /**
   * Ennen Katea kertynyt tulo samalle kortille.
   *
   * Ravintola ottaa Katen käyttöön kesken vuoden, ja tuloraja on
   * koko vuoden raja. Ilman tätä kenttää tammi-toukokuun palkat
   * olisivat rajan kannalta olemattomia ja lisäprosentti jäisi
   * perimättä.
   */
  prior_income_cents bigint not null default 0,

  valid_from date not null,

  /** Null = toistaiseksi. Käytännössä vuoden loppu. */
  valid_to date,

  /** Verokortin kuva tai PDF tiedostokaapissa. */
  file_id uuid references files(id) on delete set null,

  /**
   * Mistä arvot tulivat.
   *
   * 'document' tarkoittaa että ne luettiin dokumentista ja käyttäjä
   * hyväksyi ne. Ei sitä että kone päätti — hyväksyntä on aina
   * ihmisen.
   */
  source tax_card_source not null default 'manual',

  note text not null default '',

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_cards_percentages check (
    base_percent >= 0 and base_percent <= 100
    and additional_percent >= 0 and additional_percent <= 100
  ),
  constraint tax_cards_limit check (income_limit_cents >= 0),
  constraint tax_cards_prior check (prior_income_cents >= 0),
  constraint tax_cards_validity check (valid_to is null or valid_to >= valid_from),

  /*
   * Kaksi voimassa olevaa korttia samalle päivälle on mahdoton
   * tilanne: laskenta joutuisi valitsemaan, eikä sillä ole perustetta
   * valita.
   *
   * Rajoite kannassa eikä tarkistus sovelluksessa. Sovellustarkistus
   * pätee siihen kirjoituspolkuun jonka joku muisti tarkistaa, ja
   * niitä on aina enemmän kuin muistetaan.
   */
  constraint tax_cards_no_overlap exclude using gist (
    restaurant_id with =,
    user_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index if not exists tax_cards_lookup
  on tax_cards (restaurant_id, user_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- 2. Luontoisedut
-- ---------------------------------------------------------------------------
--
-- Luontoisetu on veronalaista palkkaa jota ei makseta rahana. Se
-- kasvattaa ennakonpidätyksen ja vakuutusmaksujen perustetta mutta ei
-- nettopalkkaa — ja juuri siksi se on helppo laskea väärin.
--
-- Arvo tallennetaan riville eikä lueta vuositaulukosta laskentahetkellä.
-- Taulukkoarvo on lähtökohta jonka käyttöliittymä tarjoaa; rivillä on
-- se mitä tälle työntekijälle sovittiin.

create table if not exists employee_benefits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  kind benefit_kind not null,

  /** Verotusarvo kuukaudessa sentteinä. */
  monthly_value_cents integer not null,

  /** Vapaa nimi kun laji on 'other'. */
  label text not null default '',

  valid_from date not null,
  valid_to date,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employee_benefits_value check (monthly_value_cents >= 0),
  constraint employee_benefits_validity check (valid_to is null or valid_to >= valid_from),

  /*
   * Sama etu kahteen kertaan samalle ajalle olisi kaksinkertainen
   * verotusarvo. Eri lajit saavat olla päällekkäin: puhelinetu ja
   * ravintoetu ovat molemmat tavallisia yhtä aikaa.
   */
  constraint employee_benefits_no_overlap exclude using gist (
    restaurant_id with =,
    user_id with =,
    kind with =,
    label with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index if not exists employee_benefits_lookup
  on employee_benefits (restaurant_id, user_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- 3. Työsuhteen tiedot
-- ---------------------------------------------------------------------------
--
-- Nämä kuuluvat jäsenyyteen eivätkä uuteen tauluun: jäsenyys on jo se
-- rivi joka kertoo että tämä ihminen työskentelee tässä ravintolassa.
-- Erillinen taulu olisi toinen paikka jossa sama tieto asuu.
--
-- Syntymäaika on täällä eikä profiilissa. Profiili on yhteinen
-- kaikille ravintoloille joissa ihminen on töissä, ja syntymäaika on
-- palkanlaskennan tietoa: se ratkaisee vakuuttamisvelvollisuuden
-- ikärajat. Jäsenyydessä se on ravintolakohtainen ja rivikäytäntöjen
-- suojaama.

alter table memberships
  add column if not exists employment_starts_on date;

alter table memberships
  add column if not exists employment_ends_on date;

alter table memberships
  add column if not exists birth_date date;

alter table memberships
  drop constraint if exists memberships_employment_range;

alter table memberships
  add constraint memberships_employment_range check (
    employment_ends_on is null
    or employment_starts_on is null
    or employment_ends_on >= employment_starts_on
  );

/*
 * Uudet sarakkeet eivät päädy rajapintaan.
 *
 * 0028 poisti taulutason lukuoikeuden ja antoi sen takaisin sarake
 * kerrallaan. Syntymäaika ja työsuhteen päivät jäävät listan
 * ulkopuolelle, joten PostgREST ei tarjoile niitä kenellekään.
 * Esihenkilö lukee ne funktion kautta, työntekijä omansa.
 */

-- ---------------------------------------------------------------------------
-- 4. Rivitason käytännöt
-- ---------------------------------------------------------------------------
--
-- Verokortti on arkaluonteista henkilötietoa. Työntekijä näkee omansa
-- — hänellä on oikeus tarkistaa millä perusteella hänen palkastaan
-- pidätetään. Muiden kortteja hän ei näe.
--
-- Kirjanpitäjä ei näe verokortteja lainkaan. Hän tarvitsee
-- palkkasummat kirjanpitoon, ei yksittäisen ihmisen veroprosenttia.

alter table tax_cards enable row level security;
alter table employee_benefits enable row level security;

drop policy if exists tax_cards_read on tax_cards;
create policy tax_cards_read on tax_cards
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists tax_cards_write on tax_cards;
create policy tax_cards_write on tax_cards
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists employee_benefits_read on employee_benefits;
create policy employee_benefits_read on employee_benefits
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists employee_benefits_write on employee_benefits;
create policy employee_benefits_write on employee_benefits
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- ---------------------------------------------------------------------------
-- 5. Maksupäivän mukainen verokortti
-- ---------------------------------------------------------------------------
--
-- Funktion nimi sanoo mitä parametri on. `tax_card_for(user, date)`
-- olisi kutsuttu jonain päivänä työvuoron päivämäärällä, ja tulos
-- olisi ollut väärä ilman että mikään kaatuu.

create or replace function tax_card_on_pay_date(
  p_restaurant uuid,
  p_user uuid,
  p_pay_date date
)
returns tax_cards
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from tax_cards c
  where c.restaurant_id = p_restaurant
    and c.user_id = p_user
    and c.valid_from <= p_pay_date
    and (c.valid_to is null or c.valid_to >= p_pay_date)
    and (c.user_id = auth.uid() or is_manager(c.restaurant_id))
  order by c.valid_from desc
  limit 1;
$$;

revoke all on function tax_card_on_pay_date(uuid, uuid, date) from public, anon;
grant execute on function tax_card_on_pay_date(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Työntekijän palkkaperustiedot
-- ---------------------------------------------------------------------------
--
-- Yksi funktio joka kokoaa sen mitä palkanlaskenta tarvitsee
-- jäsenyydestä. Esihenkilö saa kaikki, työntekijä omansa, muut eivät
-- mitään.

create or replace function employee_payroll_info(p_restaurant uuid)
returns table (
  user_id uuid,
  pay_type pay_type,
  hourly_rate_cents integer,
  monthly_salary_cents integer,
  employment_starts_on date,
  employment_ends_on date,
  birth_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.pay_type,
    m.hourly_rate_cents,
    m.monthly_salary_cents,
    m.employment_starts_on,
    m.employment_ends_on,
    m.birth_date
  from memberships m
  where m.restaurant_id = p_restaurant
    and (is_manager(p_restaurant) or m.user_id = auth.uid())
    and m.restaurant_id in (select my_restaurant_ids());
$$;

revoke all on function employee_payroll_info(uuid) from public, anon;
grant execute on function employee_payroll_info(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Työsuhteen tietojen tallennus
-- ---------------------------------------------------------------------------
--
-- Sarakkeisiin ei ole kirjoitusoikeutta rajapinnan kautta, joten
-- tallennus kulkee funktion läpi. Funktio on samalla se paikka jossa
-- tarkistukset tehdään kerran.

create or replace function save_employment_details(
  p_restaurant uuid,
  p_user uuid,
  p_starts_on date,
  p_ends_on date,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'Tyosuhteen paattymispaiva ei voi olla ennen alkupaivaa.'
      using errcode = 'check_violation';
  end if;

  /*
   * Syntymäaika tulevaisuudessa tai 1900-luvun alussa on
   * näppäilyvirhe. Ikäraja vaikuttaa vakuutusmaksuihin, joten virhe
   * näkyisi palkassa eikä lomakkeella.
   */
  if p_birth_date is not null
     and (p_birth_date > current_date or p_birth_date < date '1920-01-01') then
    raise exception 'Syntymaaika ei ole uskottava.' using errcode = 'check_violation';
  end if;

  update memberships
  set employment_starts_on = p_starts_on,
      employment_ends_on = p_ends_on,
      birth_date = p_birth_date
  where restaurant_id = p_restaurant and user_id = p_user;

  if not found then
    raise exception 'Tyontekijaa ei loytynyt.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function save_employment_details(uuid, uuid, date, date, date) from public, anon;
grant execute on function save_employment_details(uuid, uuid, date, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Toimintaloki
-- ---------------------------------------------------------------------------
--
-- Lokiin kirjataan että verokortti lisättiin, muuttui tai poistettiin,
-- ja mitä kenttiä muutos koski. Prosentteja ja tulorajaa ei kirjata:
-- ne ovat juuri sitä arkaluonteista sisältöä jonka takia verokortti on
-- suojattu, eikä loki saa olla kiertotie sen lukemiseen.
--
-- Muuttuneiden kenttien nimet riittävät siihen mihin lokia käytetään:
-- kuka muutti veroprosenttia ja milloin. Arvon näkee kortilta, jos on
-- oikeus nähdä.

create or replace function audit_tax_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tax_cards := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
  v_period text := to_char(v_row.valid_from, 'DD.MM.YYYY') || '–' ||
    coalesce(to_char(v_row.valid_to, 'DD.MM.YYYY'), 'toistaiseksi');
  v_changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'tax_card', v_row.id, v_name,
      v_name || ': verokortti lisättiin (' || v_period || ').',
      null, null, true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'tax_card', v_row.id, v_name,
      v_name || ': verokortti poistettiin (' || v_period || ').',
      null, null, true
    );
    return old;
  end if;

  if new.base_percent is distinct from old.base_percent then
    v_changed := v_changed || 'veroprosentti';
  end if;
  if new.additional_percent is distinct from old.additional_percent then
    v_changed := v_changed || 'lisäprosentti';
  end if;
  if new.income_limit_cents is distinct from old.income_limit_cents then
    v_changed := v_changed || 'tuloraja';
  end if;
  if new.prior_income_cents is distinct from old.prior_income_cents then
    v_changed := v_changed || 'aiempi tulo';
  end if;
  if new.valid_from is distinct from old.valid_from
     or new.valid_to is distinct from old.valid_to then
    v_changed := v_changed || 'voimassaolo';
  end if;
  if new.file_id is distinct from old.file_id then
    v_changed := v_changed || 'dokumentti';
  end if;

  if array_length(v_changed, 1) is null then
    return new;
  end if;

  perform write_audit(
    v_row.restaurant_id, 'updated', 'tax_card', v_row.id, v_name,
    v_name || ': verokorttia muutettiin (' || v_period || '). Muuttuneet: ' ||
      array_to_string(v_changed, ', ') || '.',
    null, null, true
  );

  return new;
end;
$$;

revoke all on function audit_tax_cards() from public, anon, authenticated;

drop trigger if exists tax_cards_audit on tax_cards;
create trigger tax_cards_audit
  after insert or update or delete on tax_cards
  for each row execute function audit_tax_cards();

/*
 * Luontoisedun arvo kirjataan lokiin.
 *
 * Toisin kuin veroprosentti, luontoisetu on työsuhteen ehto eikä
 * Verohallinnon päätös työntekijän henkilökohtaisesta verotuksesta.
 * Sen muuttuminen on juuri se asia jonka takia lokia luetaan.
 */
create or replace function audit_employee_benefits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row employee_benefits := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
  v_label text := coalesce(nullif(v_row.label, ''), v_row.kind::text);
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' lisättiin (' ||
        audit_euros(v_row.monthly_value_cents) || '/kk).',
      null,
      jsonb_build_object('kind', v_row.kind, 'value_cents', v_row.monthly_value_cents),
      true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' poistettiin.',
      jsonb_build_object('kind', v_row.kind, 'value_cents', v_row.monthly_value_cents),
      null, true
    );
    return old;
  end if;

  if new.monthly_value_cents is distinct from old.monthly_value_cents
     or new.valid_from is distinct from old.valid_from
     or new.valid_to is distinct from old.valid_to then
    perform write_audit(
      v_row.restaurant_id, 'updated', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' muuttui ' ||
        audit_euros(old.monthly_value_cents) || ' → ' ||
        audit_euros(new.monthly_value_cents) || '/kk.',
      jsonb_build_object('value_cents', old.monthly_value_cents),
      jsonb_build_object('value_cents', new.monthly_value_cents),
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function audit_employee_benefits() from public, anon, authenticated;

drop trigger if exists employee_benefits_audit on employee_benefits;
create trigger employee_benefits_audit
  after insert or update or delete on employee_benefits
  for each row execute function audit_employee_benefits();

drop trigger if exists tax_cards_touch on tax_cards;
create trigger tax_cards_touch before update on tax_cards
  for each row execute function touch_updated_at();

drop trigger if exists employee_benefits_touch on employee_benefits;
create trigger employee_benefits_touch before update on employee_benefits
  for each row execute function touch_updated_at();


-- ===========================================================================
-- 0081_payslip_tax.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0081 — Palkkalaskelman verotus, vähennykset ja työnantajan kustannus
-- ---------------------------------------------------------------------------
--
-- 0027 laski bruttopalkan ja jätti kaksi saraketta odottamaan:
-- deductions_cents ja employer_cost_cents. Tämä migraatio täyttää sen
-- lupauksen — mutta ei yhtenä lukuna.
--
-- ---------------------------------------------------------------------------
-- YKSI PROSENTTI EI RIITÄ
-- ---------------------------------------------------------------------------
--
-- Houkutus on tallentaa "vähennykset" yhtenä summana. Silloin
-- palkkalaskelmasta ei näkisi mitä siinä on, eikä kukaan voisi
-- tarkistaa sitä. Ennakonpidätys menee Verohallinnolle,
-- työeläkemaksu eläkeyhtiölle ja työttömyysvakuutusmaksu
-- Työllisyysrahastolle. Ne ovat kolme eri maksua kolmelle eri
-- vastaanottajalle, ja jokainen niistä on ilmoitettava erikseen
-- tulorekisteriin.
--
-- Huomaa mitä listasta puuttuu: työntekijän sairausvakuutusmaksu.
-- Se sisältyy verokortin pidätysprosenttiin. Erillisenä rivinä se
-- perittäisiin kahdesti.
--
-- ---------------------------------------------------------------------------
-- KÄYTETYT ARVOT JÄÄDYTETÄÄN
-- ---------------------------------------------------------------------------
--
-- Vuoden 2027 tammikuussa työeläkemaksu on eri kuin nyt. Jos laskelma
-- lukisi prosentin sääntötaulusta joka kerta kun se avataan, vuoden
-- 2026 palkkalaskelma näyttäisi vuonna 2027 eri summat kuin sinä
-- päivänä kun se maksettiin — ja työntekijän tiliotteella olisi se
-- vanha summa.
--
-- Siksi jokainen laskennassa käytetty prosentti tallennetaan riville.
-- Sääntötaulu kertoo mitä käytetään uutta laskettaessa; laskelma
-- kertoo mitä käytettiin. Nämä ovat eri kysymyksiä.
--
-- ---------------------------------------------------------------------------
-- MAKSUPÄIVÄ ON OMA PÄIVÄNSÄ
-- ---------------------------------------------------------------------------
--
-- Kaudella on kolme päivää jotka on helppo sekoittaa:
--
--   työjakso      milloin työ tehtiin        (payslip_lines.work_date)
--   palkkakausi   miltä ajalta palkka on     (pay_periods.starts_on/ends_on)
--   maksupäivä    milloin raha liikkuu       (pay_periods.pay_date)
--
-- Verokortti ja verovuosi määräytyvät maksupäivästä. Kesäkuussa tehty
-- työ joka maksetaan heinäkuussa kuuluu heinäkuun verokortille, ja
-- joulukuun työ joka maksetaan tammikuussa kuuluu uuteen verovuoteen.

-- ---------------------------------------------------------------------------
-- 1. Maksupäivä
-- ---------------------------------------------------------------------------

alter table pay_periods
  add column if not exists pay_date date;

/*
 * Maksupäivä ei ole pakollinen avoimella kaudella.
 *
 * Kausi avataan usein ennen kuin maksupäivä on tiedossa. Hyväksyntä
 * sen sijaan vaatii sen — hyväksytty palkka ilman maksupäivää olisi
 * palkka jonka verokorttia ei voi valita. Se tarkistetaan
 * hyväksymisfunktiossa eikä check-rajoitteella, jotta virheilmoitus
 * on suomea eikä rajoitteen nimi.
 */

alter table payslips
  add column if not exists pay_date date;

-- ---------------------------------------------------------------------------
-- 2. Veronalainen palkka ja luontoisedut
-- ---------------------------------------------------------------------------

alter table payslips
  add column if not exists benefits_cents integer not null default 0;

/**
 * Veronalainen palkka = rahapalkka + luontoisetujen verotusarvo.
 *
 * Tästä lasketaan ennakonpidätys ja vakuutusmaksut. Nettopalkasta
 * luontoisetu vähennetään takaisin: sitä ei makseta rahana.
 */
alter table payslips
  add column if not exists taxable_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 3. Työntekijältä perittävät
-- ---------------------------------------------------------------------------

alter table payslips
  add column if not exists withholding_cents integer not null default 0;

alter table payslips
  add column if not exists employee_pension_cents integer not null default 0;

alter table payslips
  add column if not exists employee_unemployment_cents integer not null default 0;

alter table payslips
  add column if not exists net_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 4. Työnantajan maksut
-- ---------------------------------------------------------------------------
--
-- Nämä eivät vähennä työntekijän palkkaa. Ne kertovat mitä
-- työntekijä oikeasti maksaa työnantajalle — luku jota ravintoloitsija
-- tarvitsee hinnoitteluun ja jota palkkalaskelma ei perinteisesti
-- kerro.

alter table payslips
  add column if not exists employer_pension_cents integer not null default 0;

alter table payslips
  add column if not exists employer_health_cents integer not null default 0;

alter table payslips
  add column if not exists employer_unemployment_cents integer not null default 0;

alter table payslips
  add column if not exists employer_accident_cents integer not null default 0;

alter table payslips
  add column if not exists employer_group_life_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 5. Käytetyt laskenta-arvot
-- ---------------------------------------------------------------------------
--
-- Sanoin ne ääneen tiedoston alussa: nämä ovat se syy miksi vuoden
-- 2026 palkkalaskelma näyttää samalta vuonna 2027.

alter table payslips
  add column if not exists tax_rules_year_used integer;

alter table payslips
  add column if not exists tax_card_id uuid references tax_cards(id) on delete set null;

alter table payslips
  add column if not exists tax_base_percent_used numeric(5, 2);

alter table payslips
  add column if not exists tax_additional_percent_used numeric(5, 2);

alter table payslips
  add column if not exists employee_pension_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employee_unemployment_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_pension_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_health_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_unemployment_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_accident_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_group_life_rate_used numeric(5, 2);

/**
 * Verokortitta laskettu.
 *
 * Kun työntekijä ei ole esittänyt verokorttia, pidätys on lain mukaan
 * 60 %. Merkintä erottaa sen siitä että joku olisi kirjannut kortille
 * kuusikymmentä prosenttia — ja se on laskelmalla se lause jonka
 * lukija tarvitsee.
 */
alter table payslips
  add column if not exists no_tax_card boolean not null default false;

-- ---------------------------------------------------------------------------
-- 6. Tulorajan käyttö
-- ---------------------------------------------------------------------------
--
-- Kaksi lukua: paljonko rajaa oli käytetty ennen tätä laskelmaa ja
-- paljonko tämä käytti. Niistä saa jäljellä olevan ilman että
-- mitään lasketaan uudelleen — ja ne kertovat myös miksi juuri tällä
-- laskelmalla siirryttiin lisäprosenttiin.

alter table payslips
  add column if not exists income_limit_before_cents bigint;

alter table payslips
  add column if not exists income_limit_used_cents bigint;

-- ---------------------------------------------------------------------------
-- 7. Tila
-- ---------------------------------------------------------------------------
--
-- payslip_status sai arvot 'paid' ja 'cancelled' edellisessä
-- migraatiossa. Vain hyväksytty ja maksettu kerryttävät: luonnos on
-- keskeneräinen arvio ja peruttu on virhe jota ei tapahtunut.

alter table payslips
  add column if not exists paid_at timestamptz;

alter table payslips
  add column if not exists cancelled_at timestamptz;

alter table payslips
  add column if not exists cancelled_reason text;

-- ---------------------------------------------------------------------------
-- 8. Palkkarivin laji
-- ---------------------------------------------------------------------------
--
-- Ennen tätä rivin laji pääteltiin siitä onko pay_component_id null.
-- Luontoisetu ei ole palkkalaji eikä peruspalkka, ja päättely olisi
-- kertonut sen olevan peruspalkkaa.

do $$ begin
  create type payslip_line_kind as enum ('base', 'supplement', 'benefit');
exception when duplicate_object then null; end $$;

alter table payslip_lines
  add column if not exists line_kind payslip_line_kind not null default 'base';

/* Vanhat rivit: lisä jos palkkalaji, muuten peruspalkka. */
update payslip_lines
set line_kind = 'supplement'
where pay_component_id is not null and line_kind = 'base';

-- ---------------------------------------------------------------------------
-- 9. Palkkakertymä
-- ---------------------------------------------------------------------------
--
-- Kertymä lasketaan kannassa eikä selaimessa. Selaimessa laskettu
-- kertymä olisi oikea vain niin kauan kuin sivulla on kaikki
-- laskelmat — ja se ei ole koskaan totta.
--
-- Vuosi määräytyy maksupäivästä. Joulukuussa tehty työ joka maksetaan
-- tammikuussa on seuraavan vuoden tuloa, ja verottaja katsoo sitä
-- samalla tavalla.
--
-- Vain 'approved' ja 'paid'. Luonnos ei kerrytä mitään, eikä peruttu.

create or replace function payroll_accrual(
  p_restaurant uuid,
  p_user uuid,
  p_year integer
)
returns table (
  gross_cents bigint,
  benefits_cents bigint,
  taxable_cents bigint,
  withholding_cents bigint,
  employee_pension_cents bigint,
  employee_unemployment_cents bigint,
  net_cents bigint,
  employer_cost_cents bigint,
  payslip_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(p.gross_cents), 0)::bigint,
    coalesce(sum(p.benefits_cents), 0)::bigint,
    coalesce(sum(p.taxable_cents), 0)::bigint,
    coalesce(sum(p.withholding_cents), 0)::bigint,
    coalesce(sum(p.employee_pension_cents), 0)::bigint,
    coalesce(sum(p.employee_unemployment_cents), 0)::bigint,
    coalesce(sum(p.net_cents), 0)::bigint,
    coalesce(sum(
      p.gross_cents + p.employer_pension_cents + p.employer_health_cents
      + p.employer_unemployment_cents + p.employer_accident_cents
      + p.employer_group_life_cents
    ), 0)::bigint,
    count(*)::integer
  from payslips p
  where p.restaurant_id = p_restaurant
    and p.user_id = p_user
    and p.status in ('approved', 'paid')
    and p.pay_date is not null
    and extract(year from p.pay_date) = p_year
    and (p.user_id = auth.uid() or is_manager(p.restaurant_id));
$$;

revoke all on function payroll_accrual(uuid, uuid, integer) from public, anon;
grant execute on function payroll_accrual(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Tulorajan tila
-- ---------------------------------------------------------------------------
--
-- Kortin tuloraja koskee sitä aikaa jona kortti on voimassa.
-- Muutosverokortti tuo mukanaan oman rajansa loppuvuodelle, joten
-- käyttö lasketaan kortin voimassaoloajalta eikä koko kalenterivuodelta.
--
-- prior_income_cents kattaa sen mitä ennen Katea maksettiin. Ilman
-- sitä kesken vuotta käyttöönotettu Kate luulisi rajaa koskemattomaksi
-- ja jättäisi lisäprosentin perimättä.
--
-- ---------------------------------------------------------------------------
-- PUUTTUVA KORTTI PALAUTTAA TYHJÄN, EI NOLLIA
-- ---------------------------------------------------------------------------
--
-- Komposiittityyppiä palauttava funktio antaa osumatta jäädessään
-- yhden rivin jossa kaikki kentät ovat null — ei nollaa riviä. Ilman
-- `c.id is not null` tämä palautti verokortittomalle työntekijälle
-- rivin jossa raja on 0 ja jäljellä 0, ja käyttöliittymä kertoi
-- tulorajan olevan täynnä. Se on eri väite kuin "korttia ei ole", ja
-- väärä.

create or replace function income_limit_status(
  p_restaurant uuid,
  p_user uuid,
  p_pay_date date
)
returns table (
  tax_card_id uuid,
  limit_cents bigint,
  used_cents bigint,
  remaining_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with card as (
    select * from tax_card_on_pay_date(p_restaurant, p_user, p_pay_date)
  ),
  used as (
    select coalesce(sum(p.taxable_cents), 0)::bigint as total
    from payslips p, card c
    where c.id is not null
      and p.restaurant_id = p_restaurant
      and p.user_id = p_user
      and p.status in ('approved', 'paid')
      and p.pay_date is not null
      and p.pay_date >= c.valid_from
      and (c.valid_to is null or p.pay_date <= c.valid_to)
  )
  select
    c.id,
    c.income_limit_cents,
    c.prior_income_cents + u.total,
    greatest(0, c.income_limit_cents - (c.prior_income_cents + u.total))
  from card c, used u
  where c.id is not null
    and (p_user = auth.uid() or is_manager(p_restaurant));
$$;

revoke all on function income_limit_status(uuid, uuid, date) from public, anon;
grant execute on function income_limit_status(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Toimintaloki: palkkalaskelman elinkaari
-- ---------------------------------------------------------------------------
--
-- Laskelman syntyminen, hyväksyminen, maksaminen ja peruminen ovat ne
-- neljä hetkeä joiden takia palkkalokia luetaan. Summat kirjataan
-- bruttona ja nettona; rivikohtaista erittelyä ei, koska se on
-- laskelmalla eikä lokin tehtävä ole kopioida sitä.

create or replace function audit_payslips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payslips := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma luotiin.',
      null, null, false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma poistettiin.',
      null, null, true
    );
    return old;
  end if;

  if new.status is distinct from old.status then
    perform write_audit(
      v_row.restaurant_id,
      case new.status
        when 'cancelled' then 'cancelled'
        when 'approved' then 'completed'
        when 'paid' then 'completed'
        else 'updated'
      end,
      'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma ' ||
      case new.status
        when 'draft' then 'palautettiin luonnokseksi'
        when 'review' then 'siirtyi tarkistettavaksi'
        when 'approved' then 'hyväksyttiin'
        when 'paid' then 'merkittiin maksetuksi'
        when 'cancelled' then 'peruttiin'
        else new.status::text
      end ||
      ' (brutto ' || audit_euros(new.gross_cents) ||
      ', netto ' || audit_euros(new.net_cents) || ').',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      new.status in ('approved', 'paid', 'cancelled')
    );
  end if;

  return new;
end;
$$;

revoke all on function audit_payslips() from public, anon, authenticated;

drop trigger if exists payslips_audit on payslips;
create trigger payslips_audit
  after insert or update or delete on payslips
  for each row execute function audit_payslips();


-- ===========================================================================
-- 0082_floor_plan.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0082 — Pöytäkartta
-- ---------------------------------------------------------------------------
--
-- Pöytälista kertoo että pöytiä on kaksitoista. Se ei kerro kumpi
-- niistä on ikkunan vieressä, mitkä kaksi ovat vierekkäin, tai mihin
-- kuuden hengen seurue mahtuu.
--
-- Salissa se nähdään yhdellä silmäyksellä. Listassa ei nähdä
-- ollenkaan, ja siksi varauksia siirrellään päässä eikä ruudulla.
--
-- ---------------------------------------------------------------------------
-- PAIKKA OLI JO, SITÄ EI VAIN KÄYTETTY
-- ---------------------------------------------------------------------------
--
-- pos_x ja pos_y ovat olleet taulussa alusta asti prosentteina salin
-- leveydestä ja korkeudesta. Prosentti eikä pikseli, koska sama
-- kartta piirretään puhelimen ruudulle ja työpöydän näytölle — ja
-- pikselikoordinaatti tarkoittaisi eri paikkaa kummallakin.
--
-- Tässä lisätään se mitä paikan lisäksi tarvitaan tunnistamiseen.
--
-- ---------------------------------------------------------------------------
-- MUOTO ON TUNNISTAMISTA VARTEN, EI PIIRUSTUS
-- ---------------------------------------------------------------------------
--
-- Pyöreä kuuden hengen pöytä ja pitkä kuuden hengen pöytä ovat salissa
-- eri asioita, ja tarjoilija tunnistaa ne muodosta ennen kuin lukee
-- numeron. Kolme muotoa riittää siihen.
--
-- Kokoa ei kysytä erikseen. Se johdetaan paikkaluvusta: kahden hengen
-- pöytä on pieni ja kymmenen hengen iso, eikä kukaan halua säätää
-- leveyttä ja korkeutta erikseen kahdelletoista pöydälle. Tämä on
-- pöytäkartta eikä pohjapiirustus.

do $$ begin
  create type table_shape as enum ('round', 'square', 'rect');
exception when duplicate_object then null; end $$;

alter table restaurant_tables
  add column if not exists shape table_shape not null default 'round';

/**
 * Kierto asteina.
 *
 * Vain suorakaiteelle merkitsevä: pitkä pöytä seinän vierellä on
 * pystyssä, keskellä salia poikittain. Pyöreä pöytä näyttää
 * samalta joka asennossa, ja sen kiertäminen olisi säädin jolla ei
 * tapahdu mitään.
 */
alter table restaurant_tables
  add column if not exists rotation smallint not null default 0;

alter table restaurant_tables
  drop constraint if exists restaurant_tables_rotation;

alter table restaurant_tables
  add constraint restaurant_tables_rotation
  check (rotation >= 0 and rotation < 360);

-- ---------------------------------------------------------------------------
-- Sijaintien tallennus yhtenä eränä
-- ---------------------------------------------------------------------------
--
-- Kartan järjestely on yksi teko, ei kaksitoista. Käyttäjä siirtää
-- pöytiä kunnes sali näyttää oikealta ja tallentaa kerran.
--
-- Rivi kerrallaan päivittäminen tarkoittaisi kahtatoista kyselyä ja
-- sitä että puolet niistä voi onnistua. Puoliksi siirretty kartta on
-- huonompi kuin siirtämätön: siinä ei ole enää sitä järjestystä joka
-- oli ennen, eikä sitä jota yritettiin.
--
-- Tunniste tulee mukana, muttei ravintola: se luetaan riviltä. Näin
-- kutsuja ei voi kirjoittaa toisen ravintolan pöytiä antamalla väärän
-- tunnisteen — sama sääntö kuin tiedostokaapin toiminnoissa.

create or replace function save_table_positions(
  p_restaurant uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  /*
   * Yli sadan pöydän erä on virhe eikä ravintola.
   *
   * Raja ei suojaa mitään laskennallista; se estää sen että
   * väärinmuodostettu pyyntö kirjoittaisi mielivaltaisen määrän
   * rivejä yhdellä kutsulla.
   */
  if jsonb_array_length(p_positions) > 200 then
    raise exception 'Liian monta poytaa kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_positions)
  loop
    update restaurant_tables t
    set
      pos_x = round((v_row->>'x')::numeric, 2),
      pos_y = round((v_row->>'y')::numeric, 2),
      shape = coalesce((v_row->>'shape')::table_shape, t.shape),
      rotation = coalesce((v_row->>'rotation')::smallint, t.rotation)
    where t.id = (v_row->>'id')::uuid
      /*
       * Ravintola riviltä, ei parametrista.
       *
       * Parametri on jo tarkistettu is_managerilla, mutta rivin oma
       * ravintola on se joka ratkaisee: näin toisen ravintolan
       * pöydän tunniste ei osu mihinkään.
       */
      and t.restaurant_id = p_restaurant;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function save_table_positions(uuid, jsonb) from public, anon;
grant execute on function save_table_positions(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Muoto ja kierto myös päivänäkymään
-- ---------------------------------------------------------------------------
--
-- reservation_day kokoaa illan yhdeksi JSON-vastaukseksi, ja pöytien
-- kohdalla se listaa kentät nimeltä. Uusi sarake ei siis tule mukaan
-- itsestään: ilman tätä salinäkymä piirtäisi jokaisen pöydän
-- oletusmuodolla, ja järjestelty kartta näyttäisi eriltä kuin se jota
-- järjesteltiin.
--
-- Funktio kirjoitetaan kokonaan uusiksi, koska sen runko on yksi
-- json_build_object. Muutos on kaksi riviä 'tables'-osiossa; loppu on
-- sama kuin 0068:ssa.

create or replace function reservation_day(p_restaurant uuid, p_date date)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  v_from := (p_date + time '00:00') at time zone v_tz;
  v_to := ((p_date + 1) + time '00:00') at time zone v_tz;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y,
        'shape', t.shape,
        'rotation', t.rotation
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$function$;


-- ===========================================================================
-- 0083_table_options.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0083 — Pöytäehdotukset varausta tehtäessä
-- ---------------------------------------------------------------------------
--
-- reservation_pick_tables valitsee pienimmän sopivan pöydän tai
-- yhdistelmän ja palauttaa sen. Se on oikea valinta verkkovaraukselle:
-- asiakas ei tiedä mikä pöytä on ikkunan vieressä eikä sen kuulu
-- päättää siitä.
--
-- Salissa se on väärä valinta. Esihenkilö tietää että kahdeksan hengen
-- seurue kannattaa laittaa 12+13 eikä 18+19, koska 18 on keittiön oven
-- vieressä. Kate ei tiedä sitä eikä voi tietää — mutta se voi näyttää
-- molemmat ja antaa ihmisen valita.
--
-- ---------------------------------------------------------------------------
-- SAMA SAATAVUUS, ERI MÄÄRÄ VASTAUKSIA
-- ---------------------------------------------------------------------------
--
-- Tämä funktio ei ole toinen varausmoottori. Se käyttää täsmälleen
-- samaa vapaana olemisen sääntöä kuin reservation_pick_tables:
-- tyhjennysvälillä laajennettu aikaväli, estävät varaukset, käytöstä
-- poistetut pöydät pois.
--
-- Jos säännöt eroaisivat, käyttöliittymä tarjoaisi pöytää jonka
-- tallennus hylkää — ja se on pahempi kuin ehdotusten puuttuminen.
--
-- ---------------------------------------------------------------------------
-- JÄRJESTYS ON MIELIPIDE, JA SE SANOTAAN ÄÄNEEN
-- ---------------------------------------------------------------------------
--
-- Ensin ne joissa menee vähiten paikkoja hukkaan, sitten yksittäiset
-- pöydät ennen yhdistelmiä. Kahden hengen seurue neljän pöydässä on
-- kaksi menetettyä paikkaa; sama seurue kahdessa yhdistetyssä pöydässä
-- on kaksi menetettyä paikkaa ja yksi ylimääräinen pöytä pois pelistä.
--
-- Järjestys on ehdotus. Lista näyttää kaikki, ja esihenkilö valitsee.

create or replace function reservation_table_options(
  p_restaurant uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_party int,
  p_exclude uuid default null,
  p_limit int default 6
)
returns table (
  kind text,
  table_ids uuid[],
  label text,
  seats_max int,
  /** Montako paikkaa jää käyttämättä. Nolla on täydellinen osuma. */
  wasted int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_turnaround int;
  v_range tstzrange;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_range := tstzrange(
    p_start - make_interval(mins => coalesce(v_turnaround, 0)),
    p_end + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  return query
  with vapaat as (
    select t.id, t.name, t.seats_min, t.seats_max, t.sort_order
    from restaurant_tables t
    where t.restaurant_id = p_restaurant
      and t.active
      and not exists (
        select 1 from reservation_table_assignments a
        where a.table_id = t.id
          and a.blocking
          and a.during && v_range
          and (p_exclude is null or a.reservation_id <> p_exclude)
      )
  ),

  yksittaiset as (
    select
      'table'::text as kind,
      array[v.id] as table_ids,
      v.name as label,
      v.seats_max,
      v.seats_max - p_party as wasted,
      0 as jarjestys,
      v.sort_order
    from vapaat v
    where v.seats_min <= p_party and v.seats_max >= p_party
  ),

  yhdistelmat as (
    select
      'combination'::text as kind,
      array_agg(m.table_id order by t.sort_order, t.name) as table_ids,
      /*
       * Nimi yhdistelmälle.
       *
       * Ravintola voi antaa oman nimen ("Ikkunapöydät"). Jos ei ole,
       * nimi kootaan pöytien nimistä: "12 + 13" on se miten siitä
       * salissa puhutaan.
       */
      coalesce(
        nullif(btrim(c.name), ''),
        string_agg(t.name, ' + ' order by t.sort_order, t.name)
      ) as label,
      c.seats_max,
      c.seats_max - p_party as wasted,
      1 as jarjestys,
      min(t.sort_order) as sort_order
    from table_combinations c
    join table_combination_members m on m.combination_id = c.id
    join vapaat t on t.id = m.table_id
    where c.restaurant_id = p_restaurant
      and c.active
      and c.seats_min <= p_party
      and c.seats_max >= p_party
    group by c.id, c.name, c.seats_max
    /*
     * Yhdistelmä kelpaa vain kokonaisena.
     *
     * Liitos vapaisiin pöytiin pudottaa varatut jäsenet pois, joten
     * ryhmän koko kertoo montako niistä oli vapaana. Ilman tätä
     * ehtoa puoliksi varattu yhdistelmä näyttäisi vapaalta.
     */
    having count(*) = (
      select count(*) from table_combination_members x
      where x.combination_id = c.id
    )
  )

  select o.kind, o.table_ids, o.label, o.seats_max, o.wasted
  from (
    select * from yksittaiset
    union all
    select * from yhdistelmat
  ) o
  order by o.wasted asc, o.jarjestys asc, o.sort_order asc, o.label asc
  limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function reservation_table_options(uuid, timestamptz, timestamptz, int, uuid, int)
  from public, anon;

grant execute on function reservation_table_options(uuid, timestamptz, timestamptz, int, uuid, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Varauksen aikaväli yhdellä kutsulla
-- ---------------------------------------------------------------------------
--
-- Ehdotusfunktio ottaa vastaan aikaleimat, mutta lomakkeella on
-- päivämäärä ja kellonaika. Muunnos vaatii ravintolan aikavyöhykkeen
-- ja oletuskeston, ja molemmat ovat kannassa.
--
-- Selaimessa laskettuna sama muunnos olisi toinen paikka jossa
-- kesäaika menee pieleen — ja pahimmillaan ehdotus koskisi eri
-- aikaväliä kuin tallennus, jolloin lista tarjoaisi pöytää jonka
-- tallennus hylkää.

create or replace function reservation_window(
  p_restaurant uuid,
  p_date date,
  p_time text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_minutes int;
  v_start timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;

  select coalesce(s.default_duration_minutes, 90) into v_minutes
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_minutes := coalesce(v_minutes, 90);

  v_start := (p_date + p_time::time) at time zone v_tz;

  return json_build_object(
    'startsAt', v_start,
    'endsAt', v_start + make_interval(mins => v_minutes)
  );
end;
$$;

revoke execute on function reservation_window(uuid, date, text) from public, anon;
grant execute on function reservation_window(uuid, date, text) to authenticated;


-- ===========================================================================
-- 0084_floor_elements.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0084 — Salin kalusteet ja pöydän oma koko
-- ---------------------------------------------------------------------------
--
-- Pöydät ilman seiniä on pistejoukko. Sama kaksitoista ympyrää
-- näyttää samalta joka ravintolassa, eikä tarjoilija tunnista niistä
-- omaa saliaan.
--
-- Baaritiski, keittiön ovi ja vessan käytävä ovat ne kiintopisteet
-- joiden avulla ihminen lukee tilaa. Kun ne ovat kartalla, "pöytä 12"
-- lakkaa olemasta numero ja alkaa olla paikka.
--
-- ---------------------------------------------------------------------------
-- KALUSTE EI OLE PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Oma taulunsa eikä lippu pöytärivillä. Kalusteella ei ole
-- paikkalukua, sitä ei voi varata, se ei kuulu yhdistelmiin eikä sillä
-- ole tilaa. Sama taulu tarkoittaisi puolet sarakkeista tyhjänä ja
-- jokaisessa kyselyssä ehdon "and not is_furniture".
--
-- ---------------------------------------------------------------------------
-- KOKO ON VAPAA, TOISIN KUIN PÖYDÄLLÄ
-- ---------------------------------------------------------------------------
--
-- Pöydän koko johdetaan paikkaluvusta, koska kahden hengen pöytä on
-- pieni ja kymmenen hengen iso — se on tosiasia salissa. Seinällä ei
-- ole paikkalukua, ja sen pituus on juuri se mitä siitä pitää kertoa.
--
-- Leveys on prosenttia salin leveydestä ja korkeus prosenttia salin
-- korkeudesta. Kaksi eri yksikköä samassa rivissä on epäkaunista,
-- mutta vaihtoehto olisi tallentaa salin kuvasuhde jokaiselle
-- kalusteelle — ja silloin kartan muodon muuttaminen siirtäisi
-- kaikkea.

do $$ begin
  create type floor_element_kind as enum (
    'wall', 'bar', 'kitchen', 'wc', 'door', 'entrance', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists floor_elements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  /* Sama aluejako kuin pöydillä: terassilla on oma karttansa. */
  area_id uuid references dining_areas(id) on delete set null,

  kind floor_element_kind not null,

  /** Vapaa nimi. "Baari" riittää baarille, "Kabinetti 2" ovelle. */
  label text not null default '',

  /* Keskikohta prosentteina, kuten pöydillä. */
  pos_x numeric(5, 2) not null,
  pos_y numeric(5, 2) not null,

  /** Leveys prosentteina salin leveydestä. */
  width numeric(5, 2) not null default 20,

  /** Korkeus prosentteina salin korkeudesta. */
  height numeric(5, 2) not null default 6,

  rotation smallint not null default 0,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint floor_elements_position check (
    pos_x >= 0 and pos_x <= 100 and pos_y >= 0 and pos_y <= 100
  ),

  /*
   * Alaraja ei ole nolla.
   *
   * Nollan levyinen seinä on olemassa kannassa muttei kartalla, eikä
   * sitä saa enää tartuttua kiinni hiirellä. Kahden prosentin
   * vähimmäiskoko on pienin joka pysyy osoitettavana.
   */
  constraint floor_elements_size check (
    width >= 2 and width <= 100 and height >= 2 and height <= 100
  ),

  constraint floor_elements_rotation check (rotation >= 0 and rotation < 360)
);

create index if not exists floor_elements_restaurant_idx
  on floor_elements (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Pöydän oma koko
-- ---------------------------------------------------------------------------
--
-- Koko johdetaan paikkaluvusta, ja se on oikea oletus. Se ei ole aina
-- oikea: kuuden hengen pitkä juhlapöytä ja kuuden hengen pyöreä pöytä
-- vievät salista eri määrän tilaa, ja ravintoloitsija näkee sen
-- kartalta ennen kuin osaa sanoa miksi.
--
-- Null tarkoittaa "käytä paikkaluvusta johdettua". Se ei ole sama
-- asia kuin nolla eikä sama asia kuin oletusarvo tallennettuna:
-- johdettu koko seuraa paikkalukua, tallennettu ei.

alter table restaurant_tables
  add column if not exists width numeric(5, 2);

alter table restaurant_tables
  drop constraint if exists restaurant_tables_width;

alter table restaurant_tables
  add constraint restaurant_tables_width
  check (width is null or (width >= 3 and width <= 40));

-- ---------------------------------------------------------------------------
-- Käytännöt
-- ---------------------------------------------------------------------------
--
-- Sama jako kuin pöydillä: jäsen näkee salin, esihenkilö järjestää
-- sen. Tarjoilijan on nähtävä missä baari on; sen siirtäminen ei
-- kuulu hänelle.

alter table floor_elements enable row level security;

drop policy if exists floor_elements_read on floor_elements;
create policy floor_elements_read on floor_elements
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists floor_elements_write on floor_elements;
create policy floor_elements_write on floor_elements
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists floor_elements_touch on floor_elements;
create trigger floor_elements_touch before update on floor_elements
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Kartan tallennus yhtenä eränä
-- ---------------------------------------------------------------------------
--
-- Kartan järjestely on yksi teko. save_table_positions hoitaa pöydät;
-- tämä hoitaa kalusteet, ja sen on osattava myös lisäys ja poisto —
-- käyttäjä raahaa baarin kartalle ja poistaa väärin lisätyn seinän
-- samalla istumalla.
--
-- Poisto on "kaikki mitä listassa ei ole". Se on ainoa tapa jolla
-- selaimen tila ja kanta päätyvät samaan lopputulokseen ilman että
-- jokainen poisto on oma verkkokierroksensa — ja puoliksi tallennettu
-- kartta on huonompi kuin tallentamaton.

create or replace function save_floor_elements(
  p_restaurant uuid,
  p_area uuid,
  p_elements jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_elements) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(p_elements) > 200 then
    raise exception 'Liian monta kalustetta kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_elements)
  loop
    /*
     * Tunniste kertoo onko kyseessä uusi vai vanha.
     *
     * Selain antaa uudelle kalusteelle tunnisteen vasta kun kanta
     * antaa sen. Tyhjä tunniste on siis "tämä on uusi", ei virhe.
     */
    v_id := nullif(v_row->>'id', '')::uuid;

    if v_id is null then
      insert into floor_elements (
        restaurant_id, area_id, kind, label,
        pos_x, pos_y, width, height, rotation, sort_order
      )
      values (
        p_restaurant,
        p_area,
        (v_row->>'kind')::floor_element_kind,
        coalesce(left(btrim(v_row->>'label'), 40), ''),
        round((v_row->>'x')::numeric, 2),
        round((v_row->>'y')::numeric, 2),
        round((v_row->>'width')::numeric, 2),
        round((v_row->>'height')::numeric, 2),
        coalesce((v_row->>'rotation')::smallint, 0),
        v_count
      )
      returning id into v_id;
    else
      update floor_elements e
      set
        kind = (v_row->>'kind')::floor_element_kind,
        label = coalesce(left(btrim(v_row->>'label'), 40), ''),
        pos_x = round((v_row->>'x')::numeric, 2),
        pos_y = round((v_row->>'y')::numeric, 2),
        width = round((v_row->>'width')::numeric, 2),
        height = round((v_row->>'height')::numeric, 2),
        rotation = coalesce((v_row->>'rotation')::smallint, 0),
        sort_order = v_count
      where e.id = v_id
        /* Ravintola riviltä, ei parametrista: vieras tunniste ei osu. */
        and e.restaurant_id = p_restaurant;
    end if;

    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  end loop;

  /*
   * Poistetut pois.
   *
   * Rajaus alueeseen on olennainen: ilman sitä terassin tallennus
   * pyyhkisi salin kalusteet, koska ne eivät ole terassin listalla.
   */
  delete from floor_elements e
  where e.restaurant_id = p_restaurant
    and e.area_id is not distinct from p_area
    and not (e.id = any(v_ids));

  return v_count;
end;
$$;

revoke execute on function save_floor_elements(uuid, uuid, jsonb) from public, anon;
grant execute on function save_floor_elements(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Pöytien leveys mukaan sijaintitallennukseen
-- ---------------------------------------------------------------------------
--
-- save_table_positions kirjoitti paikan, muodon ja kierron. Leveys on
-- neljäs asia jota kartalla säädetään, ja se kuuluu samaan
-- tallennukseen: erillinen kutsu tarkoittaisi että puolet muutoksista
-- voi jäädä tallentumatta.

create or replace function save_table_positions(
  p_restaurant uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(p_positions) > 200 then
    raise exception 'Liian monta poytaa kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_positions)
  loop
    update restaurant_tables t
    set
      pos_x = round((v_row->>'x')::numeric, 2),
      pos_y = round((v_row->>'y')::numeric, 2),
      shape = coalesce((v_row->>'shape')::table_shape, t.shape),
      rotation = coalesce((v_row->>'rotation')::smallint, t.rotation),

      /*
       * Tyhjä leveys palauttaa johdetun koon.
       *
       * Null ei ole nolla eikä oletusarvo: se tarkoittaa "seuraa
       * paikkalukua". Ravintoloitsijan on päästävä takaisin siihen
       * ilman että hän arvaa mikä luku olisi ollut oikea.
       */
      width = case
        when v_row ? 'width' and nullif(v_row->>'width', '') is not null
          then round((v_row->>'width')::numeric, 2)
        when v_row ? 'width' then null
        else t.width
      end
    where t.id = (v_row->>'id')::uuid
      and t.restaurant_id = p_restaurant;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function save_table_positions(uuid, jsonb) from public, anon;
grant execute on function save_table_positions(uuid, jsonb) to authenticated;


-- ===========================================================================
-- 0085_service_state.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0085 — Laskua odottava pöytä ja keittiön kapasiteetti
-- ---------------------------------------------------------------------------
--
-- Kaksi asiaa jotka näkyvät salissa mutta eivät Katessa.
--
-- ---------------------------------------------------------------------------
-- 1. LASKUA ODOTTAVA PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Pöytä jossa on syöty ja lasku on pyydetty ei ole enää "asiakkaat
-- pöydässä" eikä vielä "vapaa". Se on se pöytä jonka tarjoilija
-- katsoo seuraavaksi, ja se on myös se pöytä joka vapautuu
-- kymmenessä minuutissa — tieto jota tarvitaan kun ovella seisoo
-- kaksi ihmistä.
--
-- Aikaleima eikä tila. reservation_status kertoo missä varaus menee
-- (tuleva, saapunut, mennyt); laskun pyytäminen on tapahtuma sen
-- sisällä. Uusi enum-arvo olisi pakottanut jokaisen tilasiirtymän
-- käsittelemään sen, ja "peruttu lasku" ei tarkoita mitään.

alter table reservations
  add column if not exists bill_requested_at timestamptz;

/**
 * Laskun pyyntö päälle ja pois.
 *
 * Sama funktio molempiin suuntiin, koska tarjoilija painaa väärää
 * pöytää yhtä usein kuin oikeaa. Peruminen ilman erillistä
 * toimintoa on se ero jonka takia merkintää uskalletaan käyttää.
 *
 * Vain saapuneelle seurueelle: laskua ei voi pyytää pöydästä jossa
 * ei istu ketään.
 */
create or replace function reservation_set_bill(
  p_reservation uuid,
  p_waiting boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_status reservation_status;
begin
  select r.restaurant_id, r.status into v_restaurant, v_status
  from reservations r where r.id = p_reservation;

  if v_restaurant is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if not is_manager(v_restaurant)
     and v_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_waiting and v_status <> 'arrived' then
    return json_build_object('ok', false, 'error', 'not_arrived');
  end if;

  update reservations
  set bill_requested_at = case when p_waiting then now() else null end
  where id = p_reservation;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function reservation_set_bill(uuid, boolean) from public, anon;
grant execute on function reservation_set_bill(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. KEITTIÖN KAPASITEETTI
-- ---------------------------------------------------------------------------
--
-- Pöytiä voi olla vapaana vaikka keittiö ei ehdi. Kaksitoista
-- neljän hengen pöytää tarkoittaa 48 paikkaa, mutta jos kaikki
-- istuutuvat kello 18:00, keittiö tekee 48 annosta puolessa
-- tunnissa — eikä tee.
--
-- Raja on annoksia aikaikkunassa, ei pöytiä. Kaksi eri asiaa:
-- pöytäkapasiteetti kertoo mahtuuko seurue istumaan,
-- keittiökapasiteetti ehtiikö keittiö ruokkia heidät.
--
-- ---------------------------------------------------------------------------
-- IKKUNA ON LIUKUVA, EI TASATUNTI
-- ---------------------------------------------------------------------------
--
-- "Enintään 40 henkeä tunnissa" tarkoittaa mitä tahansa tunnin
-- mittaista jaksoa, ei kello 18–19 ja 19–20 erikseen. Tasatunneittain
-- laskettuna 20 henkeä 18:55 ja 20 henkeä 19:05 mahtuisivat, vaikka
-- keittiöön osuu neljäkymmentä kymmenessä minuutissa.
--
-- Siksi tarkistus katsoo uuden varauksen alkuhetkestä eteen- ja
-- taaksepäin puoli ikkunaa, molemmat päät mukaan lukien.
--
-- Symmetria ei ollut ilmaista. Ensimmäinen toteutus käytti
-- puoliavointa väliä, ja silloin klo 18:30 mitattuna 18:00 laskettiin
-- mukaan mutta ei toisin päin: sama pari varauksia oli yhtä aikaa
-- sekä liikaa että sopivasti riippuen siitä kummasta päästä katsoi.
-- Testi löysi sen, ei silmä.

alter table reservation_settings
  add column if not exists kitchen_capacity integer;

alter table reservation_settings
  add column if not exists kitchen_window_minutes integer not null default 60;

alter table reservation_settings
  drop constraint if exists reservation_settings_kitchen;

alter table reservation_settings
  add constraint reservation_settings_kitchen check (
    (kitchen_capacity is null or kitchen_capacity > 0)
    and kitchen_window_minutes between 15 and 240
  );

/**
 * Montako ruokailijaa keittiöön osuu tähän aikaan.
 *
 * Lasketaan alkuajoista: ruoka tehdään kun seurue saapuu, ei koko
 * sen ajan kun se istuu. Kahden tunnin illallinen kuormittaa
 * keittiötä alussa, ei lopussa.
 *
 * Peruttu ja no-show eivät kuormita ketään.
 */
create or replace function kitchen_load(
  p_restaurant uuid,
  p_at timestamptz,
  p_exclude uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.party_size), 0)::integer
  from reservations r,
       lateral (
         select coalesce(s.kitchen_window_minutes, 60) as w
         from reservation_settings s
         where s.restaurant_id = p_restaurant
       ) k
  where r.restaurant_id = p_restaurant
    and r.status in ('pending', 'confirmed', 'arrived', 'completed')
    and (p_exclude is null or r.id <> p_exclude)
    /*
     * Etäisyys alkuhetkestä, molempiin suuntiin ja päät mukaan.
     *
     * abs() eikä kaksi vertailua: se on symmetrinen määritelmän
     * tasolla, eikä sitä voi vahingossa kirjoittaa epäsymmetriseksi
     * korjatessa. Sekunteina, koska minuuttien kokonaislukujako
     * pyöristäisi parittoman ikkunan väärin.
     */
    and abs(extract(epoch from (r.starts_at - p_at))) <= k.w * 30;
$$;

revoke execute on function kitchen_load(uuid, timestamptz, uuid) from public, anon;
grant execute on function kitchen_load(uuid, timestamptz, uuid) to authenticated;

/**
 * Mahtuuko seurue keittiön kapasiteettiin.
 *
 * Palauttaa tilanteen eikä pelkkää kyllä/ei: käyttöliittymän on
 * voitava kertoa kuinka paljon tilaa on jäljellä, jotta
 * ravintoloitsija näkee onko kyse yhdestä hengestä vai kymmenestä.
 *
 * Ilman asetettua rajaa vastaus on aina kyllä. Kate ei keksi
 * keittiölle kapasiteettia jota kukaan ei ole kertonut.
 */
create or replace function kitchen_check(
  p_restaurant uuid,
  p_at timestamptz,
  p_party integer,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_window integer;
  v_load integer;
begin
  select s.kitchen_capacity, coalesce(s.kitchen_window_minutes, 60)
  into v_capacity, v_window
  from reservation_settings s
  where s.restaurant_id = p_restaurant;

  if v_capacity is null then
    return json_build_object('limited', false, 'ok', true);
  end if;

  v_load := kitchen_load(p_restaurant, p_at, p_exclude);

  return json_build_object(
    'limited', true,
    'ok', v_load + p_party <= v_capacity,
    'capacity', v_capacity,
    'windowMinutes', v_window,
    'load', v_load,
    'remaining', greatest(0, v_capacity - v_load)
  );
end;
$$;

revoke execute on function kitchen_check(uuid, timestamptz, integer, uuid) from public, anon;
grant execute on function kitchen_check(uuid, timestamptz, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Raja varausmoottoriin
-- ---------------------------------------------------------------------------
--
-- Kapasiteetti joka näkyy vain ruudulla ei ole kapasiteetti. Se on
-- kytkettävä siihen yhteen paikkaan josta kaikki varaukset kulkevat.
--
-- ---------------------------------------------------------------------------
-- VERKKO ESTETÄÄN, SALI VAROITETAAN
-- ---------------------------------------------------------------------------
--
-- Asiakas verkossa ei voi neuvotella keittiön kanssa: hänelle raja on
-- raja, ja ylityksen salliminen tarkoittaisi ettei rajaa ole.
--
-- Esihenkilö sen sijaan tietää enemmän kuin Kate. Perjantain kymmenen
-- hengen seurue voi olla se joka tilaa kolme pizzaa, ja kielto olisi
-- silloin ohjelma joka väittää tietävänsä keittiöstä paremmin.
-- Hallintanäkymä näyttää kuorman, mutta ei estä.
--
-- reservation_slots suodattaa täydet ajat pois julkiselta listalta.
-- Ilman sitä asiakas valitsisi ajan jonka tallennus hylkää — ja se on
-- huonompi kuin ajan puuttuminen listalta.

create or replace function reservation_book(
  p_restaurant uuid,
  p_start timestamp with time zone,
  p_party integer,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source reservation_source,
  p_status reservation_status default 'confirmed'::reservation_status,
  p_minutes integer default null,
  p_tables uuid[] default null,
  p_cancel_token text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
  v_kitchen json;
begin
  perform pg_advisory_xact_lock(hashtext('kate:reservation:' || p_restaurant::text));

  v_minutes := coalesce(p_minutes, reservation_duration_for(p_restaurant, p_party));
  v_end := p_start + make_interval(mins => v_minutes);

  /* Keittiön raja koskee vain verkosta tulevia. */
  if p_source in ('widget', 'link') then
    v_kitchen := kitchen_check(p_restaurant, p_start, p_party);

    if (v_kitchen->>'limited')::boolean and not (v_kitchen->>'ok')::boolean then
      raise exception 'Keittio on varattu tahan aikaan.'
        using errcode = 'exclusion_violation';
    end if;
  end if;

  if p_tables is null or array_length(p_tables, 1) is null then
    v_tables := reservation_pick_tables(p_restaurant, p_start, v_end, p_party);
  else
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = p_restaurant
      )
    ) then
      raise exception 'Pöytä ei kuulu tähän ravintolaan.'
        using errcode = 'check_violation';
    end if;

    v_tables := p_tables;
  end if;

  if v_tables is null or array_length(v_tables, 1) is null then
    raise exception 'Vapaata pöytää ei ole tähän aikaan.'
      using errcode = 'exclusion_violation';
  end if;

  insert into reservations (
    restaurant_id, starts_at, ends_at, party_size, status, source,
    guest_name, guest_phone, guest_email, note, cancel_token_hash, created_by
  )
  values (
    p_restaurant, p_start, v_end, p_party, p_status, p_source,
    trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    case when p_cancel_token is null then null
         else encode(sha256(p_cancel_token::bytea), 'hex') end,
    auth.uid()
  )
  returning id into v_id;

  foreach v_table in array v_tables loop
    insert into reservation_table_assignments
      (reservation_id, table_id, starts_at, ends_at, blocking)
    values (
      v_id, v_table, p_start, v_end,
      p_status in ('pending', 'confirmed', 'arrived')
    );
  end loop;

  return v_id;
end;
$function$;

create or replace function reservation_slots(
  p_restaurant uuid,
  p_date date,
  p_party integer,
  p_exclude uuid default null
)
returns table(slot_time time without time zone, starts_at timestamp with time zone)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_tz text;
  v_slot int;
  v_lead int;
  v_minutes int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  select s.slot_minutes, s.lead_minutes into v_slot, v_lead
  from reservation_settings s where s.restaurant_id = p_restaurant;

  if v_slot is null then return; end if;

  v_minutes := reservation_duration_for(p_restaurant, p_party);

  return query
  with ikkunat as (
    select w.opens, w.last_seating from reservation_windows(p_restaurant, p_date) w
  ),
  ajat as (
    select
      (w.opens + make_interval(mins => v_slot * g.n))::time as t
    from ikkunat w
    cross join lateral generate_series(
      0,
      greatest(0, floor(extract(epoch from (w.last_seating - w.opens)) / 60 / v_slot)::int)
    ) as g(n)
  ),
  ehdokkaat as (
    select distinct a.t,
           ((p_date + a.t) at time zone v_tz) as alkaa
    from ajat a
  )
  select e.t, e.alkaa
  from ehdokkaat e
  where
    e.alkaa >= now() + make_interval(mins => coalesce(v_lead, 0))
    and reservation_pick_tables(
          p_restaurant,
          e.alkaa,
          e.alkaa + make_interval(mins => v_minutes),
          p_party,
          p_exclude
        ) is not null
    /* Täysi keittiö ei näy vapaana aikana. */
    and (kitchen_check(p_restaurant, e.alkaa, p_party, p_exclude)->>'ok')::boolean
  order by e.t;
end;
$function$;


-- ===========================================================================
-- 0086_reservation_update_poyta.sql
-- ===========================================================================

-- 0086 – Pöydän vaihto varaukseen korjattu
--
-- reservation_update kaatui poikkeukseen aina kun varaukselle
-- annettiin pöytä:
--
--   malformed array literal: "pöytä"
--
-- Syy on muutoslokin rivi
--
--   v_muutos := v_muutos || 'pöytä';
--
-- jossa v_muutos on text[] ja literaali on tyypitön. Postgres valitsee
-- silloin taulukko||taulukko -yhdistelmän ja yrittää lukea sanan
-- "pöytä" taulukoksi. Kaksi edellistä lisäystä välttyivät tältä vain
-- siksi, että ne olivat ||-yhdistelmiä ja siten valmiiksi text.
--
-- Korjaus on yksi tyyppimerkintä. Virhe nousi vasta onnistuneen
-- päivityksen jälkeen, joten muutos peruuntui transaktion mukana ja
-- käyttäjä näki vain yleisen "Toiminto ei onnistunut" -viestin.
--
-- Muu funktio on ennallaan.

create or replace function public.reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_party int;
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_table uuid;
  v_muutos text[] := array[]::text[];
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  v_party := coalesce(p_party, v_old.party_size);
  if v_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if p_date is not null or p_time is not null then
    v_start := (
      coalesce(p_date, (v_old.starts_at at time zone v_tz)::date)
      + coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    ) at time zone v_tz;
  else
    v_start := v_old.starts_at;
  end if;

  if v_party <> v_old.party_size then
    v_minutes := reservation_duration_for(v_old.restaurant_id, v_party);
  else
    v_minutes := (extract(epoch from (v_old.ends_at - v_old.starts_at)) / 60)::int;
  end if;
  v_end := v_start + make_interval(mins => v_minutes);

  if p_tables is not null then
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = v_old.restaurant_id
      )
    ) then
      return json_build_object('ok', false, 'error', 'table');
    end if;
    v_tables := p_tables;
  elsif v_start <> v_old.starts_at
        or v_end <> v_old.ends_at
        or v_party <> v_old.party_size
  then
    v_tables := reservation_pick_tables(
      v_old.restaurant_id, v_start, v_end, v_party, p_reservation
    );
    if v_tables is null then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set
      starts_at = v_start,
      ends_at = v_end,
      party_size = v_party,
      guest_name = coalesce(nullif(left(trim(p_name), 120), ''), guest_name),
      guest_phone = case when p_phone is null then guest_phone
                         else nullif(left(trim(p_phone), 40), '') end,
      guest_email = case when p_email is null then guest_email
                         else nullif(lower(left(trim(p_email), 160)), '') end,
      note = case when p_note is null then note
                  else nullif(left(trim(p_note), 500), '') end
    where id = p_reservation;

    if v_tables is not null then
      delete from reservation_table_assignments
      where reservation_id = p_reservation
        and table_id <> all (v_tables);

      foreach v_table in array v_tables loop
        insert into reservation_table_assignments
          (reservation_id, table_id, starts_at, ends_at, blocking)
        values (
          p_reservation, v_table, v_start, v_end,
          v_old.status in ('pending', 'confirmed', 'arrived')
        )
        on conflict (reservation_id, table_id) do update
          set starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              blocking = excluded.blocking;
      end loop;
    end if;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  if v_start <> v_old.starts_at then
    v_muutos := v_muutos || (
      'aika ' || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI')
      || ' -> ' || to_char(v_start at time zone v_tz, 'DD.MM. HH24:MI')
    );
  end if;
  if v_party <> v_old.party_size then
    v_muutos := v_muutos || ('koko ' || v_old.party_size || ' -> ' || v_party);
  end if;
  if v_tables is not null then
    -- Tyyppimerkintä on korjaus: ilman sitä Postgres lukee sanan
    -- taulukoksi ja koko päivitys peruuntuu.
    v_muutos := v_muutos || 'pöytä'::text;
  end if;

  perform write_audit(
    v_old.restaurant_id, 'reservation.update', 'reservation',
    p_reservation, v_old.guest_name,
    'Muutti varausta: ' || v_old.guest_name
      || case when array_length(v_muutos, 1) is null then ''
              else ' (' || array_to_string(v_muutos, ', ') || ')' end,
    jsonb_build_object('starts_at', v_old.starts_at, 'party_size', v_old.party_size),
    jsonb_build_object('starts_at', v_start, 'party_size', v_party),
    false
  );

  return json_build_object('ok', true);
end;
$fn$;

revoke all on function public.reservation_update(
  uuid, date, time, int, text, text, text, text, uuid[]
) from anon;


-- ===========================================================================
-- 0087_reservation_day.sql
-- ===========================================================================

-- 0087 – reservation_day: kalusteet ja aukioloaika mukaan
--
-- Tämä migraatio kirjaa tiedostoon sen mikä kantaan oli jo tehty.
-- Funktio kasvoi kahdessa vaiheessa pohjapiirroksen ja kalenterin
-- mukana, ja välissä sitä muutettiin suoraan kannassa. Ilman tätä
-- tiedostoa kantaa ei voi rakentaa uudelleen migraatioista, ja se on
-- pahempi vika kuin kumpikaan lisätty kenttä.
--
-- Funktio listaa kentät nimeltä, joten uusi sarake ei tule mukaan
-- itsestään — jokainen lisäys on oma rivinsä täällä:
--
--   0082  shape, rotation      pöydän muoto kartalla
--   0084  width, elements      leveys ja kalusteet
--   0085  billRequestedAt      laskua odottava pöytä
--   tämä  hours                aukioloaika kalenterin aikajanalle
--
-- Aukioloaika tulee reservation_windows-funktiosta eikä suoraan
-- taulusta: poikkeuspäivä syrjäyttää viikkorytmin, ja kalenterin
-- pitää piirtää se päivä joka oikeasti on.

create or replace function public.reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  v_from := (p_date + time '00:00') at time zone v_tz;
  v_to := ((p_date + 1) + time '00:00') at time zone v_tz;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'hours', (
      select json_build_object(
        'opens', to_char(w.opens, 'HH24:MI'),
        'lastSeating', to_char(w.last_seating, 'HH24:MI')
      )
      from reservation_windows(p_restaurant, p_date) w
      limit 1
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y,
        'shape', t.shape,
        'rotation', t.rotation,
        'width', t.width
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'elements', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'areaId', e.area_id,
        'kind', e.kind,
        'label', e.label,
        'posX', e.pos_x,
        'posY', e.pos_y,
        'width', e.width,
        'height', e.height,
        'rotation', e.rotation
      ) order by e.sort_order, e.created_at)
      from floor_elements e where e.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'billRequestedAt', r.bill_requested_at,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$fn$;

revoke all on function public.reservation_day(uuid, date) from anon;


-- ===========================================================================
-- 0088_reservation_stats.sql
-- ===========================================================================

-- 0088 – Varausanalytiikka
--
-- Yksi funktio joka lukee jakson varaukset kerran ja palauttaa niistä
-- summat. Laskenta on kannassa siksi, että vaihtoehto olisi hakea
-- vuoden varaukset selaimeen ja laskea siellä — ja silloin selain
-- saisi jokaisen asiakkaan nimen ja puhelinnumeron nähtäväkseen
-- voidakseen laskea montako heitä oli.
--
-- Funktio palauttaa lukumääriä, ei valmiita prosentteja. Osuudet ja
-- keskiarvot lasketaan sovelluksessa omassa moduulissaan, jotta
-- pyöristys on yhdessä paikassa ja testattavissa.
--
-- ---------------------------------------------------------------------
-- MITÄ TÄYTTÖASTE TÄSSÄ TARKOITTAA
-- ---------------------------------------------------------------------
--
-- Käytetyt paikat jaettuna salin paikoilla, viikonpäivän ja tunnin
-- mukaan, keskiarvona jakson päivistä.
--
-- Kolme rajausta, jotta luku tarkoittaa jotain:
--
-- 1. Mukaan vain aukiolotunnit. Suljettu maanantai ei ole nolla
--    prosenttia täynnä, se ei ole auki. Aukiolo haetaan päivä
--    kerrallaan, koska poikkeuspäivä syrjäyttää viikkorytmin.
--
-- 2. Viimeinen istumisaika on viimeinen mitattu tunti. Sen jälkeen
--    pöytää ei voi enää antaa, joten tyhjyys siellä ei ole
--    käyttämätöntä kapasiteettia vaan sulkemisaika.
--
-- 3. Kapasiteetti on nykyisten käytössä olevien pöytien paikkamäärä.
--    Tätä EI tiedetä menneisyydestä: jos sali on juuri laajennettu,
--    vanhat viikot näyttävät tyhjemmiltä kuin olivat. Käyttöliittymän
--    on sanottava tämä ääneen, ei piilotettava sitä prosenttiin.

create or replace function public.reservation_stats(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_seats int;
  v_tables int;
  v_out json;
begin
  /*
   * Esihenkilön tieto, ei koko henkilökunnan.
   *
   * Peruutusprosentti ja vieraiden määrä ovat liiketoiminnan lukuja
   * samaan tapaan kuin myynti. Salinäkymä riittää vuoron tekemiseen.
   */
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Virheellinen aikavali.' using errcode = '22007';
  end if;

  /*
   * Yläraja on suoja eikä mielipide: aukiolo haetaan päivä kerrallaan,
   * joten jakson pituus on suoraan kyselyiden määrä.
   */
  if (p_to - p_from) > 400 then
    raise exception 'Liian pitka aikavali.' using errcode = '22003';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;

  v_from := (p_from + time '00:00') at time zone v_tz;
  v_to := ((p_to + 1) + time '00:00') at time zone v_tz;

  select coalesce(sum(t.seats_max), 0), count(*)
    into v_seats, v_tables
  from restaurant_tables t
  where t.restaurant_id = p_restaurant and t.active;

  with varaukset as (
    select
      r.id,
      r.party_size,
      r.status::text as status,
      r.source::text as source,
      (r.starts_at at time zone v_tz) as alkaa,
      (r.ends_at at time zone v_tz) as paattyy
    from reservations r
    where r.restaurant_id = p_restaurant
      and r.starts_at >= v_from
      and r.starts_at < v_to
  ),

  /*
   * Varaus joka vie pöydän.
   *
   * Peruttu ja saapumatta jäänyt ovat merkintöjä siitä että joku aikoi
   * tulla. Ne lasketaan omina lukuinaan, mutta ne eivät ole vieraita
   * eivätkä täyttöastetta.
   */
  pitavat as (
    select * from varaukset
    where status in ('pending', 'confirmed', 'arrived', 'completed')
  ),

  paivat as (
    select d::date as paiva
    from generate_series(p_from, p_to, interval '1 day') d
  ),

  aukitunnit as (
    select distinct
      p.paiva,
      h.tunti
    from paivat p
    cross join lateral reservation_windows(p_restaurant, p.paiva) w
    cross join lateral generate_series(
      extract(hour from w.opens)::int,
      extract(hour from w.last_seating)::int,
      1
    ) as h(tunti)
  ),

  /*
   * Varatut paikat tunneittain.
   *
   * Varaus lasketaan jokaiselle tunnille jonka se kattaa: kello 18
   * alkava kahden tunnin varaus vie paikat myös yhdeksältä. Loppuhetki
   * vähennetään minuutilla, jottei tasan 20:00 päättyvä varaus näy
   * enää kahdeksalta.
   *
   * greatest pitää sarjan nousevana. Keskiyön yli menevä varaus jää
   * muuten tyhjäksi sarjaksi, koska 23 ei ole pienempi kuin 0.
   */
  kaytetyt as (
    select
      v.alkaa::date as paiva,
      gs.tunti,
      sum(v.party_size)::int as paikat,
      count(*)::int as varauksia
    from pitavat v
    cross join lateral generate_series(
      extract(hour from v.alkaa)::int,
      greatest(
        extract(hour from v.alkaa)::int,
        extract(hour from (v.paattyy - interval '1 minute'))::int
      ),
      1
    ) as gs(tunti)
    group by 1, 2
  )

  select json_build_object(
    'from', p_from,
    'to', p_to,
    'days', (p_to - p_from) + 1,

    'capacity', json_build_object('seats', v_seats, 'tables', v_tables),

    'totals', (
      select json_build_object(
        'reservations', count(*),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'noShow', count(*) filter (where status = 'no_show'),
        'realised', count(*) filter (where status in ('arrived', 'completed')),
        'upcoming', count(*) filter (where status in ('pending', 'confirmed')),
        'guests', coalesce(sum(party_size) filter (
          where status not in ('cancelled', 'no_show')), 0),
        'partySum', coalesce(sum(party_size) filter (
          where status not in ('cancelled', 'no_show')), 0),
        'partyCount', count(*) filter (
          where status not in ('cancelled', 'no_show'))
      )
      from varaukset
    ),

    'bySource', coalesce((
      select json_agg(json_build_object('source', s.source, 'count', s.n)
                      order by s.n desc, s.source)
      from (
        select source, count(*)::int as n from varaukset group by source
      ) s
    ), '[]'::json),

    'byHour', coalesce((
      select json_agg(json_build_object(
               'hour', h.tunti,
               'reservations', h.n,
               'guests', h.paikat)
             order by h.tunti)
      from (
        select extract(hour from alkaa)::int as tunti,
               count(*)::int as n,
               coalesce(sum(party_size), 0)::int as paikat
        from pitavat group by 1
      ) h
    ), '[]'::json),

    'byWeekday', coalesce((
      select json_agg(json_build_object(
               'weekday', w.vk,
               'reservations', w.n,
               'guests', w.paikat,
               'days', w.paivia,
               'openDays', w.auki)
             order by w.vk)
      from (
        select
          d.vk,
          d.paivia,
          coalesce(a.auki, 0) as auki,
          coalesce(v.n, 0) as n,
          coalesce(v.paikat, 0) as paikat
        from (
          select extract(isodow from paiva)::int as vk, count(*)::int as paivia
          from paivat group by 1
        ) d
        left join (
          select extract(isodow from paiva)::int as vk,
                 count(distinct paiva)::int as auki
          from aukitunnit group by 1
        ) a on a.vk = d.vk
        left join (
          select extract(isodow from alkaa)::int as vk,
                 count(*)::int as n,
                 coalesce(sum(party_size), 0)::int as paikat
          from pitavat group by 1
        ) v on v.vk = d.vk
      ) w
    ), '[]'::json),

    'occupancy', coalesce((
      select json_agg(json_build_object(
               'weekday', o.vk,
               'hour', o.tunti,
               'seats', o.paikat,
               'days', o.paivia)
             order by o.vk, o.tunti)
      from (
        select
          extract(isodow from t.paiva)::int as vk,
          t.tunti,
          round(avg(coalesce(k.paikat, 0))::numeric, 2) as paikat,
          count(*)::int as paivia
        from aukitunnit t
        left join kaytetyt k on k.paiva = t.paiva and k.tunti = t.tunti
        group by 1, 2
      ) o
    ), '[]'::json)
  )
  into v_out;

  return v_out;
end;
$fn$;

revoke all on function public.reservation_stats(uuid, date, date) from anon;


-- ===========================================================================
-- 0089_floor_plan_image.sql
-- ===========================================================================

-- 0089 – Salin pohjapiirros kuvana
--
-- Ravintolalla on pohjapiirros: arkkitehdin kuva, paloturvallisuuden
-- kaavio tai käsin piirretty luonnos. Pöytien raahaaminen tyhjälle
-- ruudukolle on arvailua siitä missä seinät ovat; kuvan päälle
-- raahattuna se on sen merkitsemistä mikä on jo tiedossa.
--
-- ---------------------------------------------------------------------
-- YKSI KUVA RAVINTOLAA KOHTI
-- ---------------------------------------------------------------------
--
-- Kartta on yksi laatikko, jonka sisällä alueet vaihtavat näkyviä
-- pöytiä. Kuva alueittain vaatisi laatikon alueittain, eikä sitä ole.
-- Useamman salin oma pohjapiirros on siis oma muutoksensa, ei tämän
-- taulun rivi.
--
-- ---------------------------------------------------------------------
-- KUVASUHDE TALLENNETAAN
-- ---------------------------------------------------------------------
--
-- Kartan laatikko on ollut kiinteä 3:2. Pohjapiirros ei ole, ja
-- venytetty pohjapiirros on väärä pohjapiirros: neliön muotoinen sali
-- näyttäisi siinä leveältä ja pöytä osuisi seinän läpi.
--
-- Kun kuva on, laatikko ottaa kuvan muodon. Pöytien sijainnit ovat
-- prosentteja, joten ne pysyvät samassa kohdassa salia.
--
-- ---------------------------------------------------------------------
-- TIEDOSTO ON YKSITYINEN
-- ---------------------------------------------------------------------
--
-- Pohjapiirros kertoo missä ovet ja hätäpoistumistiet ovat. Se ei
-- kuulu julkiseen osoitteeseen, joten ämpäri on yksityinen ja kuva
-- näytetään allekirjoitetulla linkillä kuten muutkin ravintolan
-- dokumentit.

-- ---------------------------------------------------------------------------
-- Taulu
-- ---------------------------------------------------------------------------

create table if not exists public.floor_plan_images (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete cascade,
  storage_path text not null,
  /* Kuvan omat mitat pikseleinä. Vain suhde kiinnostaa. */
  width int not null check (width > 0),
  height int not null check (height > 0),
  /*
   * Kuvan peittävyys kartalla.
   *
   * Pohjapiirros on tausta eikä sisältö: täydellä voimakkuudella se
   * kilpailee pöytien kanssa siitä kumpaa katsotaan. Säädettävä, koska
   * kuvat ovat eri vahvuisia — valokuva paperista on tummempi kuin
   * viivapiirros.
   */
  opacity numeric(3, 2) not null default 0.45
    check (opacity >= 0.05 and opacity <= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.floor_plan_images enable row level security;

drop policy if exists floor_plan_images_read on public.floor_plan_images;
create policy floor_plan_images_read on public.floor_plan_images
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

/*
 * Kirjoitus vain funktion kautta.
 *
 * Ei insert- eikä update-käytäntöä: tallennus kulkee
 * save_floor_plan_image-funktion läpi, joka tarkistaa esihenkilön ja
 * kirjoittaa muutoslokin. Suora oikeus tauluun olisi toinen reitti
 * samaan riviin, ja toinen reitti on se joka unohtuu tarkistaa.
 */

-- ---------------------------------------------------------------------------
-- Tallennus
-- ---------------------------------------------------------------------------

create or replace function public.save_floor_plan_image(
  p_restaurant uuid,
  p_path text,
  p_width int,
  p_height int,
  p_opacity numeric default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_vanha text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_path is null or length(trim(p_path)) = 0 then
    return json_build_object('ok', false, 'error', 'path');
  end if;

  /*
   * Polku alkaa ravintolan tunnisteella.
   *
   * Sama sääntö kuin tallennuskäytännöissä. Ilman tätä kutsuja voisi
   * osoittaa rivin toisen ravintolan tiedostoon: rivin lukisi vain
   * oma väki, mutta allekirjoitettu linkki tehtäisiin vieraaseen
   * kuvaan.
   */
  if split_part(p_path, '/', 1) <> p_restaurant::text then
    return json_build_object('ok', false, 'error', 'path');
  end if;

  if p_width is null or p_height is null or p_width <= 0 or p_height <= 0 then
    return json_build_object('ok', false, 'error', 'size');
  end if;

  select storage_path into v_vanha
  from floor_plan_images where restaurant_id = p_restaurant;

  insert into floor_plan_images (
    restaurant_id, storage_path, width, height, opacity, updated_by
  )
  values (
    p_restaurant, trim(p_path), p_width, p_height,
    coalesce(p_opacity, 0.45), auth.uid()
  )
  on conflict (restaurant_id) do update set
    storage_path = excluded.storage_path,
    width = excluded.width,
    height = excluded.height,
    opacity = excluded.opacity,
    updated_at = now(),
    updated_by = excluded.updated_by;

  perform write_audit(
    p_restaurant, 'floorplan.image', 'restaurant', p_restaurant, null,
    case when v_vanha is null
         then 'Lisäsi pohjapiirroksen'
         else 'Vaihtoi pohjapiirroksen' end,
    null, null, false
  );

  /*
   * Vanha tiedosto palautetaan poistettavaksi.
   *
   * Kanta ei osaa poistaa tallennustilasta, ja korvattu kuva jäisi
   * muuten maksamaan tilaa ikuisesti. Kutsuja poistaa sen — ja jos se
   * epäonnistuu, rivi osoittaa silti uuteen kuvaan.
   */
  return json_build_object(
    'ok', true,
    'previousPath', case when v_vanha = trim(p_path) then null else v_vanha end
  );
end;
$fn$;

create or replace function public.set_floor_plan_opacity(
  p_restaurant uuid,
  p_opacity numeric
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_opacity is null or p_opacity < 0.05 or p_opacity > 1 then
    return json_build_object('ok', false, 'error', 'opacity');
  end if;

  update floor_plan_images
  set opacity = p_opacity, updated_at = now(), updated_by = auth.uid()
  where restaurant_id = p_restaurant;

  if not found then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  /* Ei muutoslokia: peittävyys on katseluasetus, ei salin tieto. */
  return json_build_object('ok', true);
end;
$fn$;

create or replace function public.delete_floor_plan_image(
  p_restaurant uuid
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_path text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select storage_path into v_path
  from floor_plan_images where restaurant_id = p_restaurant;

  if v_path is null then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  delete from floor_plan_images where restaurant_id = p_restaurant;

  perform write_audit(
    p_restaurant, 'floorplan.image', 'restaurant', p_restaurant, null,
    'Poisti pohjapiirroksen', null, null, false
  );

  return json_build_object('ok', true, 'previousPath', v_path);
end;
$fn$;

revoke all on function public.save_floor_plan_image(uuid, text, int, int, numeric)
  from anon;
revoke all on function public.set_floor_plan_opacity(uuid, numeric) from anon;
revoke all on function public.delete_floor_plan_image(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Tallennustila
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'floorplans', 'floorplans', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/*
 * Luku koko väelle, kirjoitus esihenkilölle.
 *
 * Tarjoilija näkee kartan salinäkymässä ja kartta on kuvan päällä,
 * joten lukuoikeus on sama kuin karttaan. Kuvan vaihtaminen on salin
 * muuttamista, ja se on esihenkilön työtä.
 */
drop policy if exists floorplans_storage_read on storage.objects;
create policy floorplans_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'floorplans'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists floorplans_storage_write on storage.objects;
create policy floorplans_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists floorplans_storage_update on storage.objects;
create policy floorplans_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists floorplans_storage_delete on storage.objects;
create policy floorplans_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );


-- ===========================================================================
-- 0090_ledger_issue_codes.sql
-- ===========================================================================

-- 0090 – Kirjanpidon huomiot koodeina, ei lauseina
--
-- ledger_month_status rakensi "Mitä sinun pitää tehdä" -listan otsikot
-- ja selitteet valmiiksi suomeksi:
--
--   'title', 'Kirjausesityksiä odottaa'
--   'detail', v_esityksia || ' esitystä odottaa hyväksyntää.'
--
-- Ne näkyivät suomeksi myös englannin, ruotsin, tanskan, turkin ja
-- viron käyttäjille. Kanta ei tiedä kenelle se vastaa eikä millä
-- kielellä, eikä sen kuulukaan tietää.
--
-- ---------------------------------------------------------------------
-- KOODI ON TIETO, LAUSE ON ESITYSTAPA
-- ---------------------------------------------------------------------
--
-- Funktio palautti jo valmiiksi kentän 'kind' jokaiselle huomiolle.
-- Kaikki mitä lauseeseen tarvitaan on siis ollut olemassa: koodi,
-- vakavuus, lukumäärä ja rahaero. Lause kootaan sovelluksessa, jossa
-- käyttäjän kieli tiedetään.
--
-- Myös taivutus siirtyy sinne. Kanta valitsi yksikön ja monikon
-- käsin — ' kuitti' tai ' kuittia' — ja se sääntö on eri jokaisella
-- kielellä.
--
-- title ja detail POISTETAAN eikä jätetä varmuuden vuoksi. Jätettynä
-- ne olisivat kaksi kenttää joita joku käyttää vahingossa, ja vika
-- palaisi hiljaa takaisin.
--
-- Muu funktio on ennallaan: tila, luvut ja ALV lasketaan kuten ennen.

create or replace function public.ledger_month_status(
  p_restaurant uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_alku date := date_trunc('month', p_month)::date;
  v_loppu date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_alv jsonb;
  v_lukittu boolean;
  v_esityksia int; v_kirjattuja int; v_hylattyja int;
  v_kuitteja_ilman int; v_paivia_ilman int;
  v_myyntiero bigint; v_alvero bigint;
  v_ongelmat jsonb := '[]'::jsonb;
  v_tila text;
begin
  if not can_read_finance(p_restaurant) then raise exception 'Ei oikeutta'; end if;

  v_lukittu := exists (select 1 from closed_months
                       where restaurant_id = p_restaurant and month = v_alku);

  select count(*) filter (where status = 'proposed'),
         count(*) filter (where status = 'posted'),
         count(*) filter (where status = 'rejected')
    into v_esityksia, v_kirjattuja, v_hylattyja
  from ledger_entries
  where restaurant_id = p_restaurant and entry_date between v_alku and v_loppu;

  select count(*) into v_kuitteja_ilman from receipts rc
  where rc.restaurant_id = p_restaurant and rc.receipt_date between v_alku and v_loppu
    and not exists (select 1 from ledger_entries e
      where e.restaurant_id = p_restaurant and e.source_type = 'receipt' and e.source_id = rc.id);

  select count(*) into v_paivia_ilman from daily_sales ds
  where ds.restaurant_id = p_restaurant and ds.sales_date between v_alku and v_loppu
    and not exists (select 1 from ledger_entries e
      where e.restaurant_id = p_restaurant and e.source_type = 'daily_sales' and e.source_id = ds.id);

  v_alv := ledger_vat_summary(p_restaurant, v_alku);
  v_myyntiero := (v_alv->>'salesGrossSource')::bigint - (v_alv->>'salesGrossLedger')::bigint;
  v_alvero := (v_alv->>'salesVatSource')::bigint - (v_alv->>'salesVatLedger')::bigint;

  if v_kuitteja_ilman > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'receipts_missing', 'severity', 'warning',
      'count', v_kuitteja_ilman);
  end if;

  if v_paivia_ilman > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'sales_missing', 'severity', 'warning',
      'count', v_paivia_ilman);
  end if;

  if v_esityksia > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'proposals', 'severity', 'info',
      'count', v_esityksia);
  end if;

  /*
   * Täsmäämättömyydet ovat aina yksi huomio.
   *
   * count on lukumäärä listan oikeassa reunassa, ja "yksi ero" on
   * oikea luku: ero on yksi asia jonka joku selvittää, ei kokoelma.
   * Ero itse kulkee erikseen sentteinä.
   */
  if v_myyntiero <> 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'sales_mismatch', 'severity', 'critical', 'count', 1,
      'differenceCents', v_myyntiero);
  end if;

  if v_alvero <> 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'vat_mismatch', 'severity', 'critical', 'count', 1,
      'differenceCents', v_alvero);
  end if;

  if v_lukittu then
    v_tila := 'locked';
  elsif v_myyntiero <> 0 or v_alvero <> 0 then
    v_tila := 'review';
  elsif v_esityksia > 0 or v_kuitteja_ilman > 0 or v_paivia_ilman > 0 then
    v_tila := 'open';
  elsif v_kirjattuja > 0 then
    v_tila := 'ready';
  else
    v_tila := 'open';
  end if;

  return jsonb_build_object(
    'month', to_char(v_alku, 'YYYY-MM'),
    'status', v_tila,
    'proposed', v_esityksia,
    'posted', v_kirjattuja,
    'rejected', v_hylattyja,
    'receiptsMissing', v_kuitteja_ilman,
    'salesDaysMissing', v_paivia_ilman,
    'vat', v_alv,
    'issues', v_ongelmat
  );
end;
$fn$;

revoke all on function public.ledger_month_status(uuid, date) from anon;


-- ===========================================================================
-- 0091_reservation_fields.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0091 — Varausnumero, allergiat, peruutusraja ja keskiyön yli ulottuva ilta
-- ---------------------------------------------------------------------------
--
-- Tämä migraatio on pelkkää rakennetta: sarakkeet, rajoitteet ja kolme
-- pientä apufunktiota. Varausmoottorin funktiot kirjoitetaan seuraavassa
-- migraatiossa kerralla uudelleen, jotta samaa nelisataa riviä plpgsql:ää
-- ei muokata kahdesti peräkkäin — kaksi muokkausta samaan funktioon
-- kahdessa tiedostossa on tapa saada kannan tila ja tiedostot eri linjalle.
--
-- ---------------------------------------------------------------------------
-- 1. MIKSI AUKIOLO SAA YLITTÄÄ KESKIYÖN
-- ---------------------------------------------------------------------------
--
-- Rajoite last_seating > opens tarkoitti, ettei yökahvilaa voinut
-- kirjata: kello 18 avautuva ja 02 sulkeutuva ilta oli kannalle
-- virheellinen. Kierto olisi ollut kaksi riviä (18–24 ja 00–02), mutta
-- silloin ilta olisi kaksi aukioloa eri viikonpäivinä — ja kaikki mitä
-- niistä lasketaan olisi laskettu kahdesti.
--
-- Uusi sääntö: kellonaika joka on avaamista pienempi tarkoittaa
-- seuraavaa päivää. Aukiolon pituus on siis johdettu tieto eikä uusi
-- sarake, ja se johdetaan yhdessä paikassa: reservation_span_minutes.
--
-- Ainoa kielletty tapaus on tyhjä ikkuna: last_seating = opens olisi
-- joko nolla tai kaksikymmentäneljä tuntia, eikä kanta voi tietää kumpi.
--
-- ---------------------------------------------------------------------------
-- 2. MIKSI VARAUSNUMERO ON KIRJAIMIA
-- ---------------------------------------------------------------------------
--
-- Numero luetaan puhelimessa ääneen. Juokseva luku (varaus 412) on
-- luettava mutta paljastaa ravintolan varausmäärän kenelle tahansa
-- asiakkaalle, ja se on tieto joka ei kuulu kuittiin. Kuusi merkkiä
-- aakkosista joista puuttuvat 0/O, 1/I ja 8/B on yhtä luettava eikä
-- kerro mitään: 31^6 on 887 miljoonaa vaihtoehtoa.
--
-- Numero syntyy liipaisimessa eikä sovelluksessa. Varaus voi syntyä
-- neljästä paikasta (widget, sali, walk-in, tuonti), ja neljä paikkaa
-- jossa sama arvo pitää muistaa asettaa on kolme paikkaa liikaa.

-- ---------------------------------------------------------------------------
-- Aukiolon pituus
-- ---------------------------------------------------------------------------

create or replace function reservation_span_minutes(
  p_opens time,
  p_last_seating time
)
returns int
language sql
immutable
as $fn$
  select case
    when p_opens is null or p_last_seating is null then null
    when p_last_seating > p_opens then
      (extract(epoch from (p_last_seating - p_opens)) / 60)::int
    else
      (extract(epoch from (p_last_seating - p_opens)) / 60)::int + 1440
  end;
$fn$;

comment on function reservation_span_minutes(time, time) is
  'Minuutit avaamisesta viimeiseen istumisaikaan. Keskiyon ylitys tulkitaan seuraavaksi paivaksi.';

-- ---------------------------------------------------------------------------
-- Aukiolon rajoitteet
-- ---------------------------------------------------------------------------

alter table reservation_hours
  drop constraint if exists reservation_hours_order;

alter table reservation_hours
  drop constraint if exists reservation_hours_span;

alter table reservation_hours
  add constraint reservation_hours_span check (last_seating <> opens);

/*
 * Poikkeuspäivä samoilla säännöillä.
 *
 * Uudenvuodenaatto on juuri se päivä joka jatkuu keskiyön yli, joten
 * poikkeus jossa sitä ei voi kirjata olisi väärässä paikassa tiukka.
 */
alter table reservation_exceptions
  drop constraint if exists reservation_exceptions_hours;

alter table reservation_exceptions
  add constraint reservation_exceptions_hours check (
    closed or (
      opens is not null
      and last_seating is not null
      and last_seating <> opens
    )
  );

-- ---------------------------------------------------------------------------
-- Päivän aukioloikkuna
-- ---------------------------------------------------------------------------
--
-- Palautusarvo kasvaa yhdellä sarakkeella, joten funktio on pudotettava
-- ennen luontia. Kutsujat ovat plpgsql-funktioita jotka sitovat nimen
-- vasta ajossa, joten pudotus ei riko niitä — ne saavat uuden version
-- heti seuraavalla kutsulla.

drop function if exists reservation_windows(uuid, date);

create or replace function reservation_windows(
  p_restaurant uuid,
  p_date date
)
returns table (opens time, last_seating time, span_minutes int)
language sql
stable
security definer
set search_path = public
as $fn$
  with poikkeus as (
    select * from reservation_exceptions e
    where e.restaurant_id = p_restaurant and e.exception_date = p_date
  )
  select e.opens, e.last_seating,
         reservation_span_minutes(e.opens, e.last_seating)
  from poikkeus e
  where not e.closed

  union all

  select h.opens, h.last_seating,
         reservation_span_minutes(h.opens, h.last_seating)
  from reservation_hours h
  where h.restaurant_id = p_restaurant
    and h.weekday = extract(isodow from p_date)::int
    and not exists (select 1 from poikkeus);
$fn$;

-- ---------------------------------------------------------------------------
-- Kellonaika todelliseksi hetkeksi
-- ---------------------------------------------------------------------------
--
-- Kello 00:30 on illan varaus eikä aamun: se kuuluu siihen iltaan joka
-- avautui edellisenä päivänä. Muunnos on yhdessä paikassa, koska sama
-- kysymys esitetään neljästä kohdasta (verkkovaraus, salin varaus,
-- muokkaus, pöytäehdotus) — ja neljä eri vastausta tarkoittaisi, että
-- ehdotus koskee eri aikaväliä kuin tallennus.
--
-- Ilman aukioloaikaa (suljettu päivä, aukioloja ei asetettu) päivä on se
-- joka annettiin. Walk-in kirjataan silloin sellaisenaan, eikä Kate ala
-- arvailla kuuluuko kello kahden merkintä eiliseen.

create or replace function reservation_start_at(
  p_restaurant uuid,
  p_date date,
  p_time time
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_opens time;
  v_offset int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return null; end if;

  /*
   * Se ikkuna johon kellonaika osuu.
   *
   * Etäisyys avaamisesta kierrätetään vuorokauden yli, jolloin 00:30 on
   * 390 minuuttia 18:00:sta ja osuu iltaan jonka viimeinen aika on
   * 02:00. Sama lasku kelpaa myös päivälle joka päättyy ennen keskiyötä:
   * silloin ikkunan ulkopuolinen aika saa pituutta suuremman etäisyyden
   * eikä kelpaa.
   *
   * Päiviä voi olla kaksi (lounas ja illallinen), joten lähin voittaa.
   */
  select w.opens, o.off into v_opens, v_offset
  from reservation_windows(p_restaurant, p_date) w
  cross join lateral (
    select (((extract(epoch from (p_time - w.opens)) / 60)::int % 1440) + 1440) % 1440 as off
  ) o
  where o.off <= coalesce(w.span_minutes, 0)
  order by o.off
  limit 1;

  /*
   * Aukioloajan ulkopuolella päivä on se joka annettiin.
   *
   * Sali kirjaa walk-inin myös kiinni olevana päivänä, eikä Kate ala
   * arvailla kuuluuko kello kahden merkintä eiliseen iltaan.
   */
  if v_opens is null then
    return (p_date + p_time) at time zone v_tz;
  end if;

  return ((p_date + v_opens)::timestamp + make_interval(mins => v_offset))
         at time zone v_tz;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Varausnumero
-- ---------------------------------------------------------------------------

alter table reservations
  add column if not exists reference text;

/*
 * Allergiat omana kenttänään.
 *
 * Ne kulkivat ennen samassa vapaassa toivekentässä kuin pöytätoiveet ja
 * juhlan aihe. Keittiölle allergia on eri asia kuin toive: se on ainoa
 * rivi jonka lukematta jättäminen vie ihmisen sairaalaan. Oma kenttä on
 * se ero jonka takia sen voi näyttää salinäkymässä varoituksena eikä
 * muistiinpanona.
 */
alter table reservations
  add column if not exists allergies text;

alter table reservations
  drop constraint if exists reservations_allergies_length;

alter table reservations
  add constraint reservations_allergies_length
  check (allergies is null or length(allergies) <= 200);

create or replace function reservation_reference_candidate()
returns text
language sql
volatile
set search_path = public
as $fn$
  /*
   * Kuusi merkkiä aakkosista ilman sekoittuvia.
   *
   * 0/O, 1/I ja 8/B luetaan puhelimessa väärin, ja väärin luettu
   * varausnumero on huonompi kuin ei numeroa lainkaan. Satunnaisuus
   * tulee gen_random_uuid():sta, joka on pg_catalogissa — pgcrypton
   * gen_random_bytes asuu Supabasessa eri skeemassa eikä näy
   * search_path = public -funktioille.
   */
  select string_agg(
    substr(
      '23456789ACDEFGHJKLMNPQRSTUVWXYZ',
      1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), g.i) % 31),
      1
    ),
    ''
  )
  from generate_series(0, 5) as g(i);
$fn$;

create or replace function reservation_set_reference()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_try int := 0;
  v_ref text;
begin
  if new.reference is not null and trim(new.reference) <> '' then
    return new;
  end if;

  /*
   * Kymmenen yritystä ja sitten yksilöivä rajoite.
   *
   * Törmäys on 887 miljoonan vaihtoehdon joukossa niin harvinainen,
   * ettei silmukan tarvitse olla ikuinen. Jos kaikki kymmenen osuvat
   * varattuun, indeksi hylkää rivin — ja se on oikea lopputulos:
   * mieluummin yksi epäonnistunut varaus kuin kaksi samalla numerolla.
   */
  loop
    v_try := v_try + 1;
    v_ref := reservation_reference_candidate();

    exit when not exists (
      select 1 from reservations r
      where r.restaurant_id = new.restaurant_id and r.reference = v_ref
    );

    exit when v_try >= 10;
  end loop;

  new.reference := v_ref;
  return new;
end;
$fn$;

drop trigger if exists reservations_reference on reservations;

create trigger reservations_reference
  before insert on reservations
  for each row execute function reservation_set_reference();

/*
 * Vanhat varaukset saavat numeron takautuvasti.
 *
 * Ilman tätä kannassa olisi kahdenlaisia varauksia, ja jokainen numeroa
 * näyttävä näkymä tarvitsisi haaran tyhjälle. Silmukka rivi kerrallaan,
 * koska yksi update kaikille antaisi saman arvon koko joukolle:
 * volatile-funktio arvioidaan kyselyä kohti eikä riviä kohti.
 */
do $migr$
declare
  v_row record;
begin
  for v_row in
    select id from reservations
    where reference is null or trim(reference) = ''
  loop
    update reservations
    set reference = reservation_reference_candidate()
    where id = v_row.id;
  end loop;
end $migr$;

create unique index if not exists reservations_reference_key
  on reservations (restaurant_id, reference);

-- ---------------------------------------------------------------------------
-- Peruutusraja
-- ---------------------------------------------------------------------------
--
-- Verkossa peruutus onnistui varauksen alkuhetkeen asti. Kello 19:00
-- varatun pöydän peruminen 18:55 on ravintolalle sama kuin saapumatta
-- jättäminen: ruoka on esivalmisteltu eikä aikaa ehdi myydä uudelleen.
--
-- Raja on tunneissa ja asetuksissa, koska se on ravintolan päätös eikä
-- Katen. Nolla tarkoittaa entistä käytöstä: peruutus onnistuu alkuun
-- asti. Oletus on 24 tuntia, joka on alalla tavallinen.
--
-- RAJA EI ESTÄ PERUMISTA VAAN VERKKOPERUUTUSTA. Asiakas soittaa, ja sali
-- peruu varauksen salinäkymästä. Sitä ei rajoiteta: tieto siitä ettei
-- seurue tule on ravintolalle arvokas myös kymmenen minuuttia ennen.

alter table reservation_settings
  add column if not exists cancel_cutoff_hours int not null default 24;

alter table reservation_settings
  drop constraint if exists reservation_settings_cutoff;

alter table reservation_settings
  add constraint reservation_settings_cutoff
  check (cancel_cutoff_hours between 0 and 168);

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_windows(uuid, date) from public, anon;
revoke all on function reservation_start_at(uuid, date, time) from public, anon;
revoke all on function reservation_reference_candidate() from public, anon;

grant execute on function reservation_windows(uuid, date) to authenticated;
grant execute on function reservation_start_at(uuid, date, time) to authenticated;
grant execute on function reservation_span_minutes(time, time) to anon, authenticated;


-- ===========================================================================
-- 0092_reservation_engine_night.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0092 — Varausmoottori: yön yli jatkuva ilta, varausnumero, allergiat, raja
-- ---------------------------------------------------------------------------
--
-- Edellinen migraatio antoi sarakkeet ja apufunktiot. Tämä kirjoittaa
-- moottorin funktiot uudelleen niin, että jokainen niistä muuttuu
-- täsmälleen kerran. Neljä muutosta kulkee samojen funktioiden läpi:
--
--   1. Ilta joka jatkuu keskiyön yli
--      Kellonaika ei enää tarkoita annettua päivää vaan sitä hetkeä
--      johon se aukiolossa osuu. Muunnos on reservation_start_at:ssä,
--      ja jokainen kohta jossa päivä ja kello muutettiin aikaleimaksi
--      kutsuu nyt sitä.
--
--   2. Varausnumero
--      Syntyy liipaisimessa. Funktiot vain palauttavat sen eteenpäin —
--      asiakkaalle vahvistukseen ja saliin listaan.
--
--   3. Allergiat omana kenttänään
--      Kulkee widgetistä kantaan ja kannasta saliin erillään
--      toivekentästä.
--
--   4. Peruutusraja
--      public_cancel_reservation tarkistaa asetuksen. Salin oma
--      peruutus ei kulje täältä eikä siihen kosketa.
--
-- ---------------------------------------------------------------------------
-- MIKSI FUNKTIOT PUDOTETAAN ENNEN LUONTIA
-- ---------------------------------------------------------------------------
--
-- Uusi parametri ei ole muutos vaan uusi funktio: create or replace
-- jättäisi vanhan version pystyyn, ja kutsu ilman uutta parametria olisi
-- sen jälkeen kaksiselitteinen. Pudotus on siis osa muutosta eikä
-- siivousta.

-- ---------------------------------------------------------------------------
-- 1. Varauksen kirjaus
-- ---------------------------------------------------------------------------

drop function if exists reservation_book(
  uuid, timestamptz, int, text, text, text, text,
  reservation_source, reservation_status, int, uuid[], text
);

create or replace function reservation_book(
  p_restaurant uuid,
  p_start timestamptz,
  p_party int,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source reservation_source,
  p_status reservation_status default 'confirmed',
  p_minutes int default null,
  p_tables uuid[] default null,
  p_cancel_token text default null,
  p_allergies text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
  v_kitchen json;
begin
  /*
   * Lukko ennen hakua.
   *
   * Kaikki tämän ravintolan varausyritykset kulkevat tästä jonossa.
   * Transaktiokohtainen: vapautuu commitissa ja rollbackissa.
   */
  perform pg_advisory_xact_lock(hashtext('kate:reservation:' || p_restaurant::text));

  v_minutes := coalesce(p_minutes, reservation_duration_for(p_restaurant, p_party));
  v_end := p_start + make_interval(mins => v_minutes);

  /* Keittiön raja koskee vain verkosta tulevia. */
  if p_source in ('widget', 'link') then
    v_kitchen := kitchen_check(p_restaurant, p_start, p_party);

    if (v_kitchen->>'limited')::boolean and not (v_kitchen->>'ok')::boolean then
      raise exception 'Keittio on varattu tahan aikaan.'
        using errcode = 'exclusion_violation';
    end if;
  end if;

  if p_tables is null or array_length(p_tables, 1) is null then
    v_tables := reservation_pick_tables(p_restaurant, p_start, v_end, p_party);
  else
    /*
     * Käsin annetut pöydät tarkistetaan silti.
     *
     * Ne kuuluvat tähän ravintolaan — muuten esihenkilö voisi kirjata
     * varauksen toisen ravintolan pöytään.
     */
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = p_restaurant
      )
    ) then
      raise exception 'Pöytä ei kuulu tähän ravintolaan.'
        using errcode = 'check_violation';
    end if;

    v_tables := p_tables;
  end if;

  if v_tables is null or array_length(v_tables, 1) is null then
    raise exception 'Vapaata pöytää ei ole tähän aikaan.'
      using errcode = 'exclusion_violation';
  end if;

  insert into reservations (
    restaurant_id, starts_at, ends_at, party_size, status, source,
    guest_name, guest_phone, guest_email, note, allergies,
    cancel_token_hash, created_by
  )
  values (
    p_restaurant, p_start, v_end, p_party, p_status, p_source,
    trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_allergies, '')), ''),
    case when p_cancel_token is null then null
         else encode(sha256(p_cancel_token::bytea), 'hex') end,
    auth.uid()
  )
  returning id into v_id;

  foreach v_table in array v_tables loop
    insert into reservation_table_assignments
      (reservation_id, table_id, starts_at, ends_at, blocking)
    values (
      v_id, v_table, p_start, v_end,
      p_status in ('pending', 'confirmed', 'arrived')
    );
  end loop;

  return v_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Vapaat ajat
-- ---------------------------------------------------------------------------
--
-- Ajat lasketaan paikallisina aikaleimoina eikä kellonaikoina.
-- Kellonaika + minuutit kiertää vuorokauden ympäri hiljaa: 23:30 + 60
-- minuuttia on 00:30, ja se näytti kuuluvan samaan päivään. Paikallinen
-- aikaleima kasvaa seuraavaan päivään kuten ilta oikeasti kasvaa, ja
-- vasta lopuksi se muutetaan hetkeksi ravintolan vyöhykkeellä — jolloin
-- myös kesäajan vaihto osuu oikein.

create or replace function reservation_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns table (slot_time time, starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_slot int;
  v_lead int;
  v_minutes int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  select s.slot_minutes, s.lead_minutes into v_slot, v_lead
  from reservation_settings s where s.restaurant_id = p_restaurant;

  if v_slot is null then return; end if;

  v_minutes := reservation_duration_for(p_restaurant, p_party);

  return query
  with ikkunat as (
    select w.opens, w.span_minutes
    from reservation_windows(p_restaurant, p_date) w
  ),
  ajat as (
    select ((p_date + w.opens)::timestamp
            + make_interval(mins => v_slot * g.n)) as paikallinen
    from ikkunat w
    cross join lateral generate_series(
      0,
      /* Viimeinen istumisaika on mukana, sen jälkeiset eivät. */
      greatest(0, floor(coalesce(w.span_minutes, 0)::numeric / v_slot)::int)
    ) as g(n)
  ),
  ehdokkaat as (
    select distinct
      a.paikallinen::time as t,
      (a.paikallinen at time zone v_tz) as alkaa
    from ajat a
  )
  select e.t, e.alkaa
  from ehdokkaat e
  where
    /* Menneisyyteen ei varata, eikä liian lyhyellä varoitusajalla. */
    e.alkaa >= now() + make_interval(mins => coalesce(v_lead, 0))
    and reservation_pick_tables(
          p_restaurant,
          e.alkaa,
          e.alkaa + make_interval(mins => v_minutes),
          p_party,
          p_exclude
        ) is not null
    /* Täysi keittiö ei näy vapaana aikana. */
    and (kitchen_check(p_restaurant, e.alkaa, p_party, p_exclude)->>'ok')::boolean
  /*
   * Järjestys on hetki eikä kellonaika.
   *
   * Kellonajan mukaan lajiteltuna keskiyön jälkeiset ajat nousisivat
   * listan kärkeen: 00:30 on pienempi luku kuin 18:00, mutta se on
   * illan viimeinen aika eikä ensimmäinen.
   */
  order by e.alkaa;
end;
$fn$;

create or replace function reservation_admin_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.starts_at)
      from reservation_slots(p_restaurant, p_date, p_party, p_exclude) s
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Varauksen aikaväli lomakkeelle
-- ---------------------------------------------------------------------------

create or replace function reservation_window(
  p_restaurant uuid,
  p_date date,
  p_time text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_minutes int;
  v_start timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.default_duration_minutes, 90) into v_minutes
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_minutes := coalesce(v_minutes, 90);

  /* Sama muunnos kuin tallennuksessa, jottei ehdotus koske eri iltaa. */
  v_start := reservation_start_at(p_restaurant, p_date, p_time::time);

  return json_build_object(
    'startsAt', v_start,
    'endsAt', v_start + make_interval(mins => v_minutes)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Varaus ja walk-in salista
-- ---------------------------------------------------------------------------

drop function if exists reservation_create_admin(
  uuid, date, time, int, text, text, text, text, boolean, int, uuid[]
);

create or replace function reservation_create_admin(
  p_restaurant uuid,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_walk_in boolean default false,
  p_minutes int default null,
  p_tables uuid[] default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_start timestamptz;
  v_id uuid;
  v_ref text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if p_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  v_start := reservation_start_at(p_restaurant, p_date, p_time);

  begin
    v_id := reservation_book(
      p_restaurant, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      case when p_walk_in then 'walk_in'::reservation_source
           else 'admin'::reservation_source end,
      case when p_walk_in then 'arrived'::reservation_status
           else 'confirmed'::reservation_status end,
      p_minutes, p_tables, null,
      left(trim(coalesce(p_allergies, '')), 200)
    );
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.reference into v_ref from reservations r where r.id = v_id;

  perform write_audit(
    p_restaurant,
    case when p_walk_in then 'reservation.walk_in' else 'reservation.create' end,
    'reservation', v_id, trim(p_name),
    case when p_walk_in then 'Lisäsi walk-inin: ' else 'Loi varauksen: ' end
      || trim(p_name) || ', ' || p_party || ' hlö, '
      || to_char(p_date, 'DD.MM.YYYY') || ' klo ' || to_char(p_time, 'HH24:MI'),
    null,
    jsonb_build_object('party_size', p_party, 'starts_at', v_start),
    false
  );

  return json_build_object('ok', true, 'id', v_id, 'reference', v_ref);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Varauksen muokkaus
-- ---------------------------------------------------------------------------

drop function if exists reservation_update(
  uuid, date, time, int, text, text, text, text, uuid[]
);

create or replace function reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_night date;
  v_night_start timestamptz;
  v_party int;
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_table uuid;
  v_muutos text[] := array[]::text[];
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  v_party := coalesce(p_party, v_old.party_size);
  if v_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  /*
   * Uusi hetki lasketaan samasta funktiosta kuin uusi varaus.
   *
   * Kalenterissa varausta raahataan kello kahteen yöllä, ja se kuuluu
   * yhä siihen iltaan josta se raahattiin. Ilman yhteistä muunnosta
   * siirto olisi hypännyt vuorokauden taaksepäin.
   */
  if p_date is not null or p_time is not null then
    /*
     * Oletuspäivä on illan päivä, ei kalenteripäivä.
     *
     * Kello 00:30 alkava varaus on tallennettu sunnuntain puolelle
     * mutta se on lauantain iltaa. Jos siirto ilman päivämäärää
     * käyttäisi kalenteripäivää, kalenterissa tehty pieni siirto
     * hyppäisi vuorokauden eteenpäin.
     */
    v_night := (v_old.starts_at at time zone v_tz)::date;

    select n.starts_at into v_night_start
    from reservation_night_range(v_old.restaurant_id, v_night) n;

    if v_night_start is not null and v_old.starts_at < v_night_start then
      v_night := v_night - 1;
    end if;

    v_start := reservation_start_at(
      v_old.restaurant_id,
      coalesce(p_date, v_night),
      coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    );
  else
    v_start := v_old.starts_at;
  end if;

  if v_party <> v_old.party_size then
    v_minutes := reservation_duration_for(v_old.restaurant_id, v_party);
  else
    v_minutes := (extract(epoch from (v_old.ends_at - v_old.starts_at)) / 60)::int;
  end if;
  v_end := v_start + make_interval(mins => v_minutes);

  if p_tables is not null then
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = v_old.restaurant_id
      )
    ) then
      return json_build_object('ok', false, 'error', 'table');
    end if;
    v_tables := p_tables;
  elsif v_start <> v_old.starts_at
        or v_end <> v_old.ends_at
        or v_party <> v_old.party_size
  then
    v_tables := reservation_pick_tables(
      v_old.restaurant_id, v_start, v_end, v_party, p_reservation
    );
    if v_tables is null then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set
      starts_at = v_start,
      ends_at = v_end,
      party_size = v_party,
      guest_name = coalesce(nullif(left(trim(p_name), 120), ''), guest_name),
      guest_phone = case when p_phone is null then guest_phone
                         else nullif(left(trim(p_phone), 40), '') end,
      guest_email = case when p_email is null then guest_email
                         else nullif(lower(left(trim(p_email), 160)), '') end,
      note = case when p_note is null then note
                  else nullif(left(trim(p_note), 500), '') end,
      allergies = case when p_allergies is null then allergies
                       else nullif(left(trim(p_allergies), 200), '') end
    where id = p_reservation;

    if v_tables is not null then
      delete from reservation_table_assignments
      where reservation_id = p_reservation
        and table_id <> all (v_tables);

      foreach v_table in array v_tables loop
        insert into reservation_table_assignments
          (reservation_id, table_id, starts_at, ends_at, blocking)
        values (
          p_reservation, v_table, v_start, v_end,
          v_old.status in ('pending', 'confirmed', 'arrived')
        )
        on conflict (reservation_id, table_id) do update
          set starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              blocking = excluded.blocking;
      end loop;
    end if;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  if v_start <> v_old.starts_at then
    v_muutos := v_muutos || (
      'aika ' || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI')
      || ' -> ' || to_char(v_start at time zone v_tz, 'DD.MM. HH24:MI')
    );
  end if;
  if v_party <> v_old.party_size then
    v_muutos := v_muutos || ('koko ' || v_old.party_size || ' -> ' || v_party);
  end if;
  if v_tables is not null then
    /* Tyyppimerkintä on korjaus (0086): ilman sitä sana luetaan taulukoksi. */
    v_muutos := v_muutos || 'pöytä'::text;
  end if;

  perform write_audit(
    v_old.restaurant_id, 'reservation.update', 'reservation',
    p_reservation, v_old.guest_name,
    'Muutti varausta: ' || v_old.guest_name
      || case when array_length(v_muutos, 1) is null then ''
              else ' (' || array_to_string(v_muutos, ', ') || ')' end,
    jsonb_build_object('starts_at', v_old.starts_at, 'party_size', v_old.party_size),
    jsonb_build_object('starts_at', v_start, 'party_size', v_party),
    false
  );

  return json_build_object('ok', true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Julkinen varaus
-- ---------------------------------------------------------------------------

create or replace function public_reservation_config(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return null; end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;

  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object(
      'restaurantName', v_r.name,
      'enabled', false
    );
  end if;

  return json_build_object(
    'restaurantName', v_r.name,
    'enabled', true,
    'timezone', v_r.timezone,
    'minParty', v_s.min_party,
    'maxParty', v_s.max_party,
    'maxDaysAhead', v_s.max_days_ahead,
    /* Widget kertoo rajan ennen varausta, ei vasta peruutusyrityksessä. */
    'cancelCutoffHours', coalesce(v_s.cancel_cutoff_hours, 0),
    'today', (now() at time zone v_r.timezone)::date,
    'theme', json_build_object(
      'color', v_s.theme_color,
      'dark', v_s.theme_dark,
      'radius', v_s.theme_radius
    )
  );
end;
$fn$;

create or replace function public_reservation_slots(
  p_slug text,
  p_date date,
  p_party int
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
  v_today date;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return json_build_object('slots', '[]'::json); end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('slots', '[]'::json);
  end if;

  /* Rajat tarkistetaan täällä, ei selaimessa. */
  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('slots', '[]'::json, 'reason', 'party');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;

  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('slots', '[]'::json, 'reason', 'date');
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.starts_at)
      from reservation_slots(v_r.id, p_date, p_party) s
    ), '[]'::json)
  );
end;
$fn$;

drop function if exists public_create_reservation(
  text, date, time, int, text, text, text, text
);

create or replace function public_create_reservation(
  p_slug text,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
  v_today date;
  v_start timestamptz;
  v_id uuid;
  v_token text;
  v_res record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if coalesce(trim(p_phone), '') = '' then
    return json_build_object('ok', false, 'error', 'phone');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;
  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('ok', false, 'error', 'date');
  end if;

  /*
   * Sama puhelinnumero, korkeintaan viisi tulevaa varausta.
   *
   * Julkinen rajapinta ilman kirjautumista on täytettävissä
   * roskavarauksilla, ja täyteen varattu sali on ravintolalle sama asia
   * kuin suljettu. Raja on puhelinnumerossa eikä IP-osoitteessa, koska
   * numero kerätään joka tapauksessa.
   */
  if (
    select count(*)
    from reservations x
    where x.restaurant_id = v_r.id
      and x.guest_phone = left(trim(p_phone), 40)
      and x.status in ('pending', 'confirmed')
      and x.starts_at > now()
  ) >= 5 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  /*
   * Aika on aukioloikkunan sisällä.
   *
   * Etäisyys avaamisesta kierrätetään vuorokauden yli, joten sama
   * tarkistus kelpaa myös illalle joka jatkuu keskiyön yli: 00:30 on
   * 390 minuuttia 18:00:sta ja mahtuu ikkunaan jonka pituus on 480.
   */
  if not exists (
    select 1
    from reservation_windows(v_r.id, p_date) w
    cross join lateral (
      select (((extract(epoch from (p_time - w.opens)) / 60)::int % 1440) + 1440) % 1440 as off
    ) o
    where o.off <= coalesce(w.span_minutes, 0)
  ) then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if extract(epoch from p_time)::int % (v_s.slot_minutes * 60) <> 0 then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  v_start := reservation_start_at(v_r.id, p_date, p_time);

  if v_start < now() + make_interval(mins => v_s.lead_minutes) then
    return json_build_object('ok', false, 'error', 'too_late');
  end if;

  /*
   * Peruutustunnus arvotaan kannassa, ei clientissä.
   *
   * gen_random_uuid on pg_catalogissa ja käyttää samaa satunnaislähdettä
   * kuin pgcrypton gen_random_bytes, joka Supabasessa asuu skeemassa
   * jota search_path = public ei näe. Kaksi uuid:ta on 64 heksamerkkiä.
   */
  v_token := replace(gen_random_uuid()::text, '-', '')
             || replace(gen_random_uuid()::text, '-', '');

  begin
    v_id := reservation_book(
      v_r.id, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      'widget', 'confirmed', null, null, v_token,
      left(trim(coalesce(p_allergies, '')), 200)
    );
  exception
    when exclusion_violation then
      /* Sekä "ei vapaata pöytää" että rajoitteen laukeaminen. */
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.starts_at, r.ends_at, r.party_size, r.reference into v_res
  from reservations r where r.id = v_id;

  return json_build_object(
    'ok', true,
    'cancelToken', v_token,
    /* Numero on se jonka asiakas lukee puhelimessa ääneen. */
    'reference', v_res.reference,
    'restaurantName', v_r.name,
    'date', (v_res.starts_at at time zone v_r.timezone)::date,
    'time', to_char(p_time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'cancelCutoffHours', coalesce(v_s.cancel_cutoff_hours, 0),
    'tables', coalesce((
      select json_agg(t.name order by t.sort_order, t.name)
      from reservation_table_assignments a
      join restaurant_tables t on t.id = a.table_id
      where a.reservation_id = v_id
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. Asiakkaan oma peruutus
-- ---------------------------------------------------------------------------

create or replace function public_cancel_reservation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_res record;
  v_cutoff int;
begin
  if coalesce(trim(p_token), '') = '' then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_res.status in ('cancelled', 'no_show', 'completed') then
    return json_build_object('ok', false, 'error', 'already');
  end if;

  if v_res.starts_at < now() then
    return json_build_object('ok', false, 'error', 'past');
  end if;

  select coalesce(s.cancel_cutoff_hours, 0) into v_cutoff
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  /*
   * Raja koskee verkkoperuutusta, ei peruutusta.
   *
   * Asiakas soittaa ja sali peruu. Virhe kertoo rajan tunteina, jotta
   * käyttöliittymä voi sanoa mihin asti linkki toimi — "peruutus ei
   * onnistunut" ilman lukua on ohje soittaa arvaamalla.
   */
  if coalesce(v_cutoff, 0) > 0
     and v_res.starts_at < now() + make_interval(hours => v_cutoff) then
    return json_build_object(
      'ok', false,
      'error', 'cutoff',
      'cutoffHours', v_cutoff
    );
  end if;

  update reservations set status = 'cancelled' where id = v_res.id;

  return json_build_object(
    'ok', true,
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size
  );
end;
$fn$;

create or replace function public_reservation_lookup(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_res record;
  v_cutoff int;
begin
  if coalesce(trim(p_token), '') = '' then return null; end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then return null; end if;

  select coalesce(s.cancel_cutoff_hours, 0) into v_cutoff
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  return json_build_object(
    'restaurantName', v_res.restaurant_name,
    'reference', v_res.reference,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'guestName', v_res.guest_name,
    'status', v_res.status,
    'cancelCutoffHours', coalesce(v_cutoff, 0),
    /*
     * Miksi peruutusta ei voi tehdä.
     *
     * Sivu näyttää eri lauseen menneelle ajalle ja liian myöhäiselle:
     * jälkimmäisessä asiakas voi yhä perua soittamalla. Ero on
     * kellonajassa, ja kello kuuluu kantaan — sivu piirretään
     * palvelimella, ja siellä kellon lukeminen kesken piirron on
     * epävakaa tulos joka voi muuttua ilman että mikään muuttui.
     */
    'cancelBlocked', case
      when v_res.status not in ('pending', 'confirmed') then null
      when v_res.starts_at <= now() then 'past'
      when coalesce(v_cutoff, 0) > 0
           and v_res.starts_at < now() + make_interval(hours => v_cutoff)
        then 'cutoff'
      else null
    end,
    'cancellable', v_res.status in ('pending', 'confirmed')
                   and v_res.starts_at > now()
                   and (
                     coalesce(v_cutoff, 0) = 0
                     or v_res.starts_at >= now() + make_interval(hours => coalesce(v_cutoff, 0))
                   )
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Päivän varaukset
-- ---------------------------------------------------------------------------
--
-- ILTA KUULUU SIIHEN PÄIVÄÄN JONA SE AVAUTUI.
--
-- Kalenteripäivä oli oikea rajaus niin kauan kuin ilta päättyi ennen
-- keskiyötä. Nyt kello 00:30 alkava varaus on lauantain iltaa, ja
-- lauantain salinäkymän on näytettävä se — muuten se ilmestyisi
-- sunnuntain aamuun, jolloin ravintola on kiinni.
--
-- Raja kulkee siis edellisen illan viimeisessä ajassa: sunnuntai alkaa
-- siitä hetkestä johon lauantain ilta päättyi. Sama sääntö molemmissa
-- päissä, joten yksikään varaus ei näy kahdesti eikä katoa.

create or replace function reservation_night_range(
  p_restaurant uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_prev_last time;
  v_own_last time;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  /* Edellisen illan viimeinen aika, jos se ylitti keskiyön. */
  select max(w.last_seating) into v_prev_last
  from reservation_windows(p_restaurant, p_date - 1) w
  where w.last_seating < w.opens;

  /* Tämän illan viimeinen aika, jos se ylittää keskiyön. */
  select max(w.last_seating) into v_own_last
  from reservation_windows(p_restaurant, p_date) w
  where w.last_seating < w.opens;

  return query select
    case
      when v_prev_last is null then (p_date + time '00:00') at time zone v_tz
      /* Sekunti eteenpäin: tasan viimeiseen aikaan alkava kuuluu eiliseen. */
      else ((p_date + v_prev_last)::timestamp + interval '1 second') at time zone v_tz
    end,
    case
      when v_own_last is null then ((p_date + 1) + time '00:00') at time zone v_tz
      else (((p_date + 1) + v_own_last)::timestamp + interval '1 second') at time zone v_tz
    end;
end;
$fn$;

create or replace function public.reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  select n.starts_at, n.ends_at into v_from, v_to
  from reservation_night_range(p_restaurant, p_date) n;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party,
        'kitchenCapacity', s.kitchen_capacity,
        'kitchenWindowMinutes', s.kitchen_window_minutes
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'hours', (
      select json_build_object(
        'opens', to_char(w.opens, 'HH24:MI'),
        'lastSeating', to_char(w.last_seating, 'HH24:MI'),
        /* Kalenterin aikajana venyy tällä keskiyön yli. */
        'spanMinutes', w.span_minutes
      )
      from reservation_windows(p_restaurant, p_date) w
      order by w.opens
      limit 1
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y,
        'shape', t.shape,
        'rotation', t.rotation,
        'width', t.width
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'elements', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'areaId', e.area_id,
        'kind', e.kind,
        'label', e.label,
        'posX', e.pos_x,
        'posY', e.pos_y,
        'width', e.width,
        'height', e.height,
        'rotation', e.rotation
      ) order by e.sort_order, e.created_at)
      from floor_elements e where e.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'reference', r.reference,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        /* Allergia näkyy myös tarjoilijalle: se on salityötä. */
        'allergies', r.allergies,
        'billRequestedAt', r.bill_requested_at,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_book from public, anon;
revoke all on function reservation_slots from public, anon;
revoke all on function reservation_night_range(uuid, date) from public, anon;
grant execute on function reservation_night_range(uuid, date) to authenticated;
revoke all on function reservation_create_admin from public, anon;
revoke all on function reservation_update from public, anon;
revoke all on function public.reservation_day(uuid, date) from anon;

grant execute on function reservation_book to authenticated;
grant execute on function reservation_slots to authenticated;
grant execute on function reservation_create_admin to authenticated;
grant execute on function reservation_update to authenticated;
grant execute on function reservation_admin_slots to authenticated;
grant execute on function reservation_window(uuid, date, text) to authenticated;

grant execute on function public_reservation_config to anon, authenticated;
grant execute on function public_reservation_slots to anon, authenticated;
grant execute on function public_create_reservation to anon, authenticated;
grant execute on function public_cancel_reservation to anon, authenticated;
grant execute on function public_reservation_lookup to anon, authenticated;


-- ===========================================================================
-- 0093_reservation_search.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0093 — Varauslista: haku nimellä ja suodatus yli päivärajojen
-- ---------------------------------------------------------------------------
--
-- Salinäkymä vastaa kysymykseen "kuka tulee tänään". Se on oikea
-- kysymys vuoron aikana ja väärä joka muuna hetkenä:
--
--   "Soitti Virtanen, sanoi varanneensa jollekin päivälle" — päivä on
--   tuntematon, ja salinäkymä osaa vain yhden päivän kerrallaan.
--
--   "Onko ensi viikonlopulle paljon varauksia" — vastaus vaatii
--   seitsemän sivunlatausta ja muistin.
--
-- Tämä funktio hakee varaukset jaksosta eikä päivästä, ja etsii nimellä
-- tai varausnumerolla. Se on sama aineisto ja samat oikeudet kuin
-- reservation_day:ssä — yhteystiedot vain esihenkilölle — mutta rajaus
-- tulee kysymyksestä eikä kalenterista.
--
-- ---------------------------------------------------------------------------
-- MIKSI HAKU ON KANNASSA
-- ---------------------------------------------------------------------------
--
-- Vaihtoehto olisi hakea kaikki varaukset selaimeen ja suodattaa siellä.
-- Silloin jokainen sivunlataus lähettäisi jokaisen asiakkaan nimen ja
-- puhelinnumeron selaimeen, jotta niistä voitaisiin näyttää kymmenen.
--
-- ---------------------------------------------------------------------------
-- MIKSI SIVUTUS ON RAJA EIKÄ EHDOTUS
-- ---------------------------------------------------------------------------
--
-- Ravintolalla on vuodessa kymmeniä tuhansia varauksia. Ilman ylärajaa
-- "kaikki menneet" olisi kysely joka palauttaa ne kaikki kerran per
-- sivunlataus. Yläraja on kannassa eikä käyttöliittymässä, koska
-- käyttöliittymiä voi olla monta ja kanta on yksi.

create or replace function reservation_search(
  p_restaurant uuid,
  p_scope text default 'upcoming',
  p_date date default null,
  p_query text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_limit int;
  v_offset int;
  v_q text;
  v_total int;
  v_rows json;
  v_desc boolean;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  /*
   * Tyhjä haku ja pelkät välilyönnit ovat sama asia kuin ei hakua.
   *
   * Ilman tätä yhden välilyönnin kirjoittaminen kenttään näyttäisi
   * tyhjän listan ja väittäisi ettei varauksia ole.
   */
  v_q := nullif(trim(coalesce(p_query, '')), '');

  /*
   * Jakson rajat.
   *
   * Päivä käyttää samaa illan rajausta kuin salinäkymä: ilta kuuluu
   * siihen päivään jona se avautui, myös keskiyön jälkeen.
   */
  if p_scope = 'day' and p_date is not null then
    select n.starts_at, n.ends_at into v_from, v_to
    from reservation_night_range(p_restaurant, p_date) n;
    v_desc := false;
  elsif p_scope = 'past' then
    v_from := null;
    v_to := now();
    /* Menneet uusin ensin: lähin mennyt ilta on se jota kysytään. */
    v_desc := true;
  elsif p_scope = 'all' then
    v_from := null;
    v_to := null;
    v_desc := true;
  else
    v_from := now();
    v_to := null;
    v_desc := false;
  end if;

  select count(*) into v_total
  from reservations r
  where r.restaurant_id = p_restaurant
    and (v_from is null or r.starts_at >= v_from)
    and (v_to is null or r.starts_at < v_to)
    and (
      v_q is null
      or r.guest_name ilike '%' || v_q || '%'
      or r.reference ilike v_q || '%'
      or coalesce(r.guest_phone, '') ilike '%' || v_q || '%'
      or coalesce(r.guest_email, '') ilike '%' || v_q || '%'
    );

  select coalesce(json_agg(x.rivi order by x.jarjestys), '[]'::json)
  into v_rows
  from (
    select
      json_build_object(
        'id', r.id,
        'reference', r.reference,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'date', (r.starts_at at time zone v_tz)::date,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'allergies', r.allergies,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json),
        'tables', coalesce((
          select json_agg(t.name order by t.sort_order, t.name)
          from reservation_table_assignments a
          join restaurant_tables t on t.id = a.table_id
          where a.reservation_id = r.id
        ), '[]'::json)
      ) as rivi,
      /*
       * Järjestysavain erikseen.
       *
       * json_agg ei osaa lajitella rakentamansa olion kentän mukaan, ja
       * aikaleima merkkijonona lajittuisi kirjaimittain. Käänteinen
       * järjestys tehdään negaatiolla, jotta lajittelu on yksi lauseke
       * eikä kaksi haaraa jotka voivat ajautua erilleen.
       */
      case when v_desc then -extract(epoch from r.starts_at)
           else extract(epoch from r.starts_at) end as jarjestys
    from reservations r
    where r.restaurant_id = p_restaurant
      and (v_from is null or r.starts_at >= v_from)
      and (v_to is null or r.starts_at < v_to)
      and (
        v_q is null
        or r.guest_name ilike '%' || v_q || '%'
        or r.reference ilike v_q || '%'
        or coalesce(r.guest_phone, '') ilike '%' || v_q || '%'
        or coalesce(r.guest_email, '') ilike '%' || v_q || '%'
      )
    order by
      case when v_desc then -extract(epoch from r.starts_at)
           else extract(epoch from r.starts_at) end,
      r.guest_name
    limit v_limit
    offset v_offset
  ) x;

  return json_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'timezone', v_tz,
    'canManage', v_manager,
    'rows', v_rows
  );
end;
$fn$;

/*
 * Hakuindeksi nimelle ja numerolle.
 *
 * Ilman indeksiä ilike-haku lukee ravintolan kaikki varaukset. Se on
 * nopeaa tuhannella rivillä ja hidasta sadallatuhannella, ja ero näkyy
 * vasta silloin kun sitä ei ehdi korjata.
 */
create index if not exists reservations_restaurant_starts
  on reservations (restaurant_id, starts_at desc);

create index if not exists reservations_guest_name_search
  on reservations (restaurant_id, lower(guest_name));

revoke all on function reservation_search(uuid, text, date, text, int, int)
  from public, anon;

grant execute on function reservation_search(uuid, text, date, text, int, int)
  to authenticated;


-- ===========================================================================
-- 0094_reservation_stats_trend.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0094 — Analytiikka: päivittäinen kehitys ja vertailu edelliseen jaksoon
-- ---------------------------------------------------------------------------
--
-- Kolme lisäystä samaan funktioon:
--
--   1. byDay — jokainen jakson päivä omana rivinään, myös tyhjät.
--      Trendi on kuvio eikä luku, eikä kuviota näe ilman nollia:
--      lista jossa on vain ne päivät joina oli varauksia näyttää
--      tasaiselta myös silloin kun joka toinen päivä on tyhjä.
--
--   2. previous — edellisen yhtä pitkän jakson summat.
--      "142 varausta" ei kerro onko se paljon. "142, +18 %" kertoo.
--      Vertailujakso on edeltävä yhtä pitkä jakso eikä "sama kuukausi
--      viime vuonna": jälkimmäinen on parempi kysymys mutta vaatii
--      vuoden aineiston, jota useimmilla ei vielä ole.
--
--   3. Aukiolo joka ylittää keskiyön (0091) mukaan täyttöasteeseen.
--      Aiemmin tuntisarja laskettiin avaamistunnista viimeisen
--      istumisajan tuntiin, ja keskiyön yli menevällä illalla se oli
--      tyhjä sarja: 18 ei ole pienempi kuin 2.
--
-- ---------------------------------------------------------------------------
-- MINKÄ PÄIVÄN VARAUS ON
-- ---------------------------------------------------------------------------
--
-- Analytiikassa varaus kuuluu siihen kalenteripäivään jona se alkaa.
-- Salinäkymässä ilta kuuluu avauspäiväänsä, joten kello 00:30 alkava
-- varaus näkyy siellä lauantain iltana ja täällä sunnuntain rivillä.
--
-- Ero on tarkoituksellinen. Salissa kysymys on "kuka tulee tänä iltana"
-- ja vastauksen on oltava yksi ilta. Analytiikassa kysymys on "miten
-- varaukset jakautuvat", ja siinä kaikki luvut on laskettava samalla
-- säännöllä — myös täyttöaste, joka lasketaan kellonajoista. Yksi
-- sääntö koko funktiossa on tarkistettavissa; kaksi ei.

-- ---------------------------------------------------------------------------
-- Jakson summat
-- ---------------------------------------------------------------------------
--
-- Omana funktionaan, koska sama laskenta tehdään kahdesti: nykyiselle
-- jaksolle ja sitä edeltävälle. Kaksi kopiota samasta json_build_objectista
-- olisi kaksi paikkaa joissa "vieras" tarkoittaa eri asiaa.

create or replace function reservation_totals(
  p_restaurant uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns json
language sql
stable
security definer
set search_path = public
as $fn$
  select json_build_object(
    'reservations', count(*),
    'cancelled', count(*) filter (where r.status = 'cancelled'),
    'noShow', count(*) filter (where r.status = 'no_show'),
    'realised', count(*) filter (where r.status in ('arrived', 'completed')),
    'upcoming', count(*) filter (where r.status in ('pending', 'confirmed')),
    'guests', coalesce(sum(r.party_size) filter (
      where r.status not in ('cancelled', 'no_show')), 0),
    'partySum', coalesce(sum(r.party_size) filter (
      where r.status not in ('cancelled', 'no_show')), 0),
    'partyCount', count(*) filter (
      where r.status not in ('cancelled', 'no_show'))
  )
  from reservations r
  where r.restaurant_id = p_restaurant
    and r.starts_at >= p_from
    and r.starts_at < p_to;
$fn$;

revoke all on function reservation_totals(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function reservation_totals(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Analytiikka
-- ---------------------------------------------------------------------------

create or replace function public.reservation_stats(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_days int;
  v_prev_from timestamptz;
  v_seats int;
  v_tables int;
  v_out json;
begin
  /*
   * Esihenkilön tieto, ei koko henkilökunnan.
   *
   * Peruutusprosentti ja vieraiden määrä ovat liiketoiminnan lukuja
   * samaan tapaan kuin myynti. Salinäkymä riittää vuoron tekemiseen.
   */
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Virheellinen aikavali.' using errcode = '22007';
  end if;

  /*
   * Yläraja on suoja eikä mielipide: aukiolo haetaan päivä kerrallaan,
   * joten jakson pituus on suoraan kyselyiden määrä.
   */
  if (p_to - p_from) > 400 then
    raise exception 'Liian pitka aikavali.' using errcode = '22003';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;

  v_days := (p_to - p_from) + 1;
  v_from := (p_from + time '00:00') at time zone v_tz;
  v_to := ((p_to + 1) + time '00:00') at time zone v_tz;

  /* Edeltävä yhtä pitkä jakso, päivä ennen jakson alkua taaksepäin. */
  v_prev_from := ((p_from - v_days) + time '00:00') at time zone v_tz;

  select coalesce(sum(t.seats_max), 0), count(*)
    into v_seats, v_tables
  from restaurant_tables t
  where t.restaurant_id = p_restaurant and t.active;

  with varaukset as (
    select
      r.id,
      r.party_size,
      r.status::text as status,
      r.source::text as source,
      (r.starts_at at time zone v_tz) as alkaa,
      (r.ends_at at time zone v_tz) as paattyy
    from reservations r
    where r.restaurant_id = p_restaurant
      and r.starts_at >= v_from
      and r.starts_at < v_to
  ),

  /*
   * Varaus joka vie pöydän.
   *
   * Peruttu ja saapumatta jäänyt ovat merkintöjä siitä että joku aikoi
   * tulla. Ne lasketaan omina lukuinaan, mutta ne eivät ole vieraita
   * eivätkä täyttöastetta.
   */
  pitavat as (
    select * from varaukset
    where status in ('pending', 'confirmed', 'arrived', 'completed')
  ),

  paivat as (
    select d::date as paiva
    from generate_series(p_from, p_to, interval '1 day') d
  ),

  /*
   * Aukiolotunnit paikallisina hetkinä.
   *
   * Sarja lasketaan avaamistunnista aukiolon pituuden yli, jolloin
   * keskiyön ylittävä ilta jatkuu seuraavan päivän tunteihin sen sijaan
   * että sarja jäisi tyhjäksi. Tunti pyöristetään alaspäin, jotta
   * 18:30 avautuva ravintola on auki tunnilla 18 eikä puolikkaalla.
   */
  aukitunnit as (
    select distinct
      (h.hetki)::date as paiva,
      extract(hour from h.hetki)::int as tunti
    from paivat p
    cross join lateral reservation_windows(p_restaurant, p.paiva) w
    cross join lateral generate_series(
      0,
      floor(
        (coalesce(w.span_minutes, 0) + extract(minute from w.opens)::int)::numeric / 60
      )::int
    ) as g(n)
    cross join lateral (
      select date_trunc('hour', (p.paiva + w.opens)::timestamp)
             + make_interval(hours => g.n) as hetki
    ) h
  ),

  /* Auki olleet päivät avauspäivän mukaan: viikonpäivä on avauspäivä. */
  aukipaivat as (
    select p.paiva
    from paivat p
    where exists (select 1 from reservation_windows(p_restaurant, p.paiva))
  ),

  /*
   * Varatut paikat tunneittain.
   *
   * Varaus lasketaan jokaiselle tunnille jonka se kattaa: kello 18
   * alkava kahden tunnin varaus vie paikat myös yhdeksältä. Loppuhetki
   * vähennetään minuutilla, jottei tasan 20:00 päättyvä varaus näy enää
   * kahdeksalta.
   */
  kaytetyt as (
    select
      h.hetki::date as paiva,
      extract(hour from h.hetki)::int as tunti,
      sum(v.party_size)::int as paikat,
      count(*)::int as varauksia
    from pitavat v
    cross join lateral generate_series(
      0,
      greatest(
        0,
        floor(
          extract(epoch from (
            date_trunc('hour', v.paattyy - interval '1 minute')
            - date_trunc('hour', v.alkaa)
          )) / 3600
        )::int
      )
    ) as gs(n)
    cross join lateral (
      select date_trunc('hour', v.alkaa) + make_interval(hours => gs.n) as hetki
    ) h
    group by 1, 2
  )

  select json_build_object(
    'from', p_from,
    'to', p_to,
    'days', v_days,

    'capacity', json_build_object('seats', v_seats, 'tables', v_tables),

    'totals', reservation_totals(p_restaurant, v_from, v_to),

    /* Edeltävä jakso samoilla säännöillä, samasta funktiosta. */
    'previous', reservation_totals(p_restaurant, v_prev_from, v_from),

    'byDay', coalesce((
      select json_agg(json_build_object(
               'date', d.paiva,
               'reservations', d.n,
               'guests', d.vieraat,
               'cancelled', d.peruttu,
               'noShow', d.ei_saapunut)
             order by d.paiva)
      from (
        select
          p.paiva,
          coalesce(v.n, 0) as n,
          coalesce(v.vieraat, 0) as vieraat,
          coalesce(v.peruttu, 0) as peruttu,
          coalesce(v.ei_saapunut, 0) as ei_saapunut
        from paivat p
        left join (
          select
            alkaa::date as paiva,
            count(*)::int as n,
            coalesce(sum(party_size) filter (
              where status not in ('cancelled', 'no_show')), 0)::int as vieraat,
            count(*) filter (where status = 'cancelled')::int as peruttu,
            count(*) filter (where status = 'no_show')::int as ei_saapunut
          from varaukset
          group by 1
        ) v on v.paiva = p.paiva
      ) d
    ), '[]'::json),

    'bySource', coalesce((
      select json_agg(json_build_object('source', s.source, 'count', s.n)
                      order by s.n desc, s.source)
      from (
        select source, count(*)::int as n from varaukset group by source
      ) s
    ), '[]'::json),

    'byHour', coalesce((
      select json_agg(json_build_object(
               'hour', h.tunti,
               'reservations', h.n,
               'guests', h.paikat)
             order by h.tunti)
      from (
        select extract(hour from alkaa)::int as tunti,
               count(*)::int as n,
               coalesce(sum(party_size), 0)::int as paikat
        from pitavat group by 1
      ) h
    ), '[]'::json),

    'byWeekday', coalesce((
      select json_agg(json_build_object(
               'weekday', w.vk,
               'reservations', w.n,
               'guests', w.paikat,
               'days', w.paivia,
               'openDays', w.auki)
             order by w.vk)
      from (
        select
          d.vk,
          d.paivia,
          coalesce(a.auki, 0) as auki,
          coalesce(v.n, 0) as n,
          coalesce(v.paikat, 0) as paikat
        from (
          select extract(isodow from paiva)::int as vk, count(*)::int as paivia
          from paivat group by 1
        ) d
        left join (
          select extract(isodow from paiva)::int as vk,
                 count(distinct paiva)::int as auki
          from aukipaivat group by 1
        ) a on a.vk = d.vk
        left join (
          select extract(isodow from alkaa)::int as vk,
                 count(*)::int as n,
                 coalesce(sum(party_size), 0)::int as paikat
          from pitavat group by 1
        ) v on v.vk = d.vk
      ) w
    ), '[]'::json),

    'occupancy', coalesce((
      select json_agg(json_build_object(
               'weekday', o.vk,
               'hour', o.tunti,
               'seats', o.paikat,
               'days', o.paivia)
             order by o.vk, o.tunti)
      from (
        select
          extract(isodow from t.paiva)::int as vk,
          t.tunti,
          round(avg(coalesce(k.paikat, 0))::numeric, 2) as paikat,
          count(*)::int as paivia
        from aukitunnit t
        left join kaytetyt k on k.paiva = t.paiva and k.tunti = t.tunti
        group by 1, 2
      ) o
    ), '[]'::json)
  )
  into v_out;

  return v_out;
end;
$fn$;

revoke all on function public.reservation_stats(uuid, date, date) from anon;
grant execute on function public.reservation_stats(uuid, date, date) to authenticated;


-- ===========================================================================
-- 0095_reservation_import.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0095 — Pöytien ja varausten tuonti toisesta järjestelmästä
-- ---------------------------------------------------------------------------
--
-- Ravintola joka vaihtaa varausjärjestelmää ei aloita tyhjästä salista.
-- Sillä on pöydät, paikkaluvut ja kalenterillinen varauksia, ja ilman
-- niitä uusi järjestelmä on käyttökelvoton juuri sinä päivänä jona se
-- otetaan käyttöön.
--
-- ---------------------------------------------------------------------------
-- MIKSI TUONTI KULKEE VARAUSMOOTTORIN LÄPI
-- ---------------------------------------------------------------------------
--
-- Suora insert reservations-tauluun olisi nopeampi ja väärä: silloin
-- tuodulla varauksella ei olisi liitosriviä pöytään, eikä se veisi
-- pöytää keneltäkään. Sali näyttäisi tuodut varaukset listassa ja myisi
-- samat pöydät uudelleen verkossa.
--
-- Tuonti kutsuu siis reservation_book:ia kuten jokainen muukin varaus.
-- Siitä seuraa myös, että tuonti kunnioittaa päällekkäisyyttä: rivi joka
-- ei mahdu saliin ei mene läpi, ja sen näkee raportista.
--
-- ---------------------------------------------------------------------------
-- MIKSI RIVIN VIRHE EI KAADA TUONTIA
-- ---------------------------------------------------------------------------
--
-- Tuhannen rivin tiedostossa on aina rivejä joissa on tyhjä nimi tai
-- kahdesti sama pöytä. Jos yksi niistä peruisi koko tuonnin, ravintola
-- korjaisi tiedostoa rivi kerrallaan tietämättä montako muuta odottaa.
--
-- Jokainen rivi on siis oma alitransaktionsa: se joko menee läpi tai
-- palautuu yksin, ja raportti kertoo rivinumeroittain kumpi kävi.
--
-- ---------------------------------------------------------------------------
-- MIKSI SAMAN TIEDOSTON VOI TUODA KAHDESTI
-- ---------------------------------------------------------------------------
--
-- Tuonti keskeytyy: selain sulkeutuu, verkko katkeaa, tiedosto oli
-- puolikas. Ainoa turvallinen tapa jatkaa on ajaa sama tiedosto
-- uudelleen, joten rivi joka on jo kannassa (sama nimi, sama alkuhetki)
-- ohitetaan eikä kahdenneta.

-- ---------------------------------------------------------------------------
-- Pöydät
-- ---------------------------------------------------------------------------

create or replace function reservation_import_tables(
  p_restaurant uuid,
  p_rows jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row jsonb;
  v_index int := 0;
  v_name text;
  v_min int;
  v_max int;
  v_area text;
  v_area_id uuid;
  v_shape text;
  v_id uuid;
  v_added int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Virheellinen aineisto.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Liian monta rivia kerralla.' using errcode = '22003';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;

    begin
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      v_min := coalesce((v_row->>'seatsMin')::int, 1);
      v_max := coalesce((v_row->>'seatsMax')::int, v_min);
      v_area := nullif(trim(coalesce(v_row->>'area', '')), '');
      v_shape := lower(coalesce(nullif(trim(coalesce(v_row->>'shape', '')), ''), 'round'));

      if v_name is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'name');
        continue;
      end if;

      if v_min < 1 or v_max < v_min or v_max > 200 then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'seats');
        continue;
      end if;

      if v_shape not in ('round', 'square', 'rect') then
        v_shape := 'round';
      end if;

      /* Sama nimi kahdesti on tuonnin uusinta eikä uusi pöytä. */
      if exists (
        select 1 from restaurant_tables t
        where t.restaurant_id = p_restaurant
          and lower(t.name) = lower(v_name)
      ) then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', true, 'skipped', true, 'name', v_name);
        continue;
      end if;

      v_area_id := null;
      if v_area is not null then
        select a.id into v_area_id
        from dining_areas a
        where a.restaurant_id = p_restaurant and lower(a.name) = lower(v_area);

        if v_area_id is null then
          insert into dining_areas (restaurant_id, name)
          values (p_restaurant, left(v_area, 60))
          returning id into v_area_id;
        end if;
      end if;

      insert into restaurant_tables
        (restaurant_id, area_id, name, seats_min, seats_max, shape)
      values
        (p_restaurant, v_area_id, left(v_name, 60), v_min, v_max, v_shape::table_shape)
      returning id into v_id;

      v_added := v_added + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_index, 'ok', true, 'id', v_id, 'name', v_name);

    exception
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'failed');
    end;
  end loop;

  return json_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'failed', v_failed,
    'rows', v_results
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Varaukset
-- ---------------------------------------------------------------------------

create or replace function reservation_import_reservations(
  p_restaurant uuid,
  p_rows jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row jsonb;
  v_index int := 0;
  v_date date;
  v_time time;
  v_party int;
  v_name text;
  v_status reservation_status;
  v_start timestamptz;
  v_tables uuid[];
  v_missing text;
  v_id uuid;
  v_added int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Virheellinen aineisto.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 200 then
    raise exception 'Liian monta rivia kerralla.' using errcode = '22003';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;

    begin
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      v_date := (v_row->>'date')::date;
      v_time := (v_row->>'time')::time;
      v_party := coalesce((v_row->>'partySize')::int, 0);

      if v_name is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'name');
        continue;
      end if;

      if v_date is null or v_time is null then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'time');
        continue;
      end if;

      if v_party < 1 or v_party > 200 then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'party');
        continue;
      end if;

      v_status := coalesce(
        nullif(trim(coalesce(v_row->>'status', '')), ''), 'confirmed'
      )::reservation_status;

      v_start := reservation_start_at(p_restaurant, v_date, v_time);

      /* Sama nimi samaan hetkeen on jo tuotu. */
      if exists (
        select 1 from reservations r
        where r.restaurant_id = p_restaurant
          and r.starts_at = v_start
          and lower(r.guest_name) = lower(v_name)
      ) then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', true, 'skipped', true, 'name', v_name);
        continue;
      end if;

      /*
       * Pöydät nimeltä, jos tiedosto kertoo ne.
       *
       * Tuntematon pöydän nimi ei ole virhe vaan tieto siitä että
       * salinäkymä on eri: rivi menee läpi ilman pöytää, jolloin
       * moottori valitsee vapaan. Raportti kertoo rivin, jotta
       * ravintola voi tarkistaa sen.
       */
      v_tables := null;
      v_missing := null;

      if jsonb_typeof(v_row->'tables') = 'array'
         and jsonb_array_length(v_row->'tables') > 0 then
        select
          array_agg(t.id),
          string_agg(x.nimi, ', ') filter (where t.id is null)
        into v_tables, v_missing
        from jsonb_array_elements_text(v_row->'tables') as x(nimi)
        left join restaurant_tables t
          on t.restaurant_id = p_restaurant
         and lower(t.name) = lower(trim(x.nimi));

        v_tables := (
          select array_agg(id) from unnest(v_tables) as u(id) where id is not null
        );
      end if;

      v_id := reservation_book(
        p_restaurant,
        v_start,
        v_party,
        left(v_name, 120),
        left(trim(coalesce(v_row->>'phone', '')), 40),
        left(trim(coalesce(v_row->>'email', '')), 160),
        left(trim(coalesce(v_row->>'note', '')), 500),
        'admin'::reservation_source,
        v_status,
        nullif((v_row->>'minutes'), '')::int,
        v_tables,
        null,
        left(trim(coalesce(v_row->>'allergies', '')), 200)
      );

      v_added := v_added + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_index, 'ok', true, 'id', v_id, 'name', v_name,
        'unknownTables', v_missing);

    exception
      when exclusion_violation then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'taken');
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_index, 'ok', false, 'error', 'failed');
    end;
  end loop;

  return json_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'failed', v_failed,
    'rows', v_results
  );
end;
$fn$;

revoke all on function reservation_import_tables(uuid, jsonb) from public, anon;
revoke all on function reservation_import_reservations(uuid, jsonb) from public, anon;

grant execute on function reservation_import_tables(uuid, jsonb) to authenticated;
grant execute on function reservation_import_reservations(uuid, jsonb) to authenticated;

