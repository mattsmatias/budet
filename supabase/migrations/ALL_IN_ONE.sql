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
-- Sisältää 9 migraatiota:
--   0001_schema.sql
--   0002_rls.sql
--   0003_functions.sql
--   0004_management.sql
--   0005_auth_callback.sql
--   0006_receipts_manager_only.sql
--   0007_settings_closing_absences.sql
--   0008_custom_categories.sql
--   0009_invitation_hash_fix.sql
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

