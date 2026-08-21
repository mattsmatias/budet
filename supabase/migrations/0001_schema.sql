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
