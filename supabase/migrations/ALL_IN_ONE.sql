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
-- Sisältää 28 migraatiota:
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

