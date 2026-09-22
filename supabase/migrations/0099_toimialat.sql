-- Toimialat: ravintola, kahvila ja parturi-kampaamo.
--
-- Kate laajenee ravintoloista muihin pienyrityksiin. Toimiala ratkaisee
-- mitkä kulukategoriat yrityksellä on käytössä, millä myyntiryhmillä ja
-- ALV-kannoilla se aloittaa ja miten tilikartan myyntitilit nimetään.
-- Toimialan valitsee ylläpitäjä yritystä luodessa, ja sen voi vaihtaa
-- vain Developer Consolesta.
--
-- Uudet kulukategoriat:
--   products   hoitotuotteet ja tarvikkeet (parturi-kampaamo)
--   equipment  laitteet ja välineet (kaikki)
--   rent       toimitilakulut (kaikki)
--
-- Olemassa olevat yritykset ovat ravintoloita. Toimialan vaihto ei
-- muuta jo luotuja myyntiryhmiä eikä tietoja: se vaikuttaa siihen mitä
-- käyttöliittymä tarjoaa.

-- ---------------------------------------------------------------------------
-- 1. Toimiala ja uudet kategoriat
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'business_type') then
    create type public.business_type as enum ('restaurant', 'cafe', 'barber');
  end if;
end $$;

alter table public.restaurants
  add column if not exists business_type public.business_type not null default 'restaurant';

alter type public.expense_category add value if not exists 'products';
alter type public.expense_category add value if not exists 'equipment';
alter type public.expense_category add value if not exists 'rent';

-- ---------------------------------------------------------------------------
-- 2. Toimialan oletukset
-- ---------------------------------------------------------------------------

/* Myyntiryhmät, joilla yritys aloittaa. */
create or replace function public.business_default_sales_groups(p_type public.business_type)
returns table (name text, vat_rate numeric, is_default boolean, sort_order integer)
language sql
immutable
as $$
  select t.name, t.vat_rate, t.is_default, t.sort_order from (values
    ('restaurant'::public.business_type, 'Ravintolamyynti', 0.13500, true, 0),
    ('restaurant', 'Alkoholimyynti', 0.25500, false, 1),
    ('restaurant', 'Muut myynnit', 0.25500, false, 2),
    ('cafe', 'Kahvilamyynti', 0.13500, true, 0),
    ('cafe', 'Muut myynnit', 0.25500, false, 1),
    ('barber', 'Palvelumyynti', 0.25500, true, 0),
    ('barber', 'Tuotemyynti', 0.25500, false, 1)
  ) as t(kind, name, vat_rate, is_default, sort_order)
  where t.kind = p_type;
$$;

/* Kassan tuoteryhmien nimet oletusryhmiin, toimialan mukaan. */
create or replace function public.business_default_pos_names(p_type public.business_type)
returns table (pos_name text, group_name text)
language sql
immutable
as $$
  select d.pos_name, d.group_name from default_pos_names() d
  where p_type = 'restaurant'
  union all
  select d.pos_name,
         case when d.group_name = 'Ravintolamyynti' then 'Kahvilamyynti' else d.group_name end
  from default_pos_names() d
  where p_type = 'cafe' and d.group_name <> 'Alkoholimyynti'
  union all
  select * from (values
    ('PALVELU', 'Palvelumyynti'),
    ('PALVELUT', 'Palvelumyynti'),
    ('PARTURI', 'Palvelumyynti'),
    ('KAMPAAMO', 'Palvelumyynti'),
    ('HIUSTENLEIKKUU', 'Palvelumyynti'),
    ('LEIKKAUS', 'Palvelumyynti'),
    ('VÄRJÄYS', 'Palvelumyynti'),
    ('PARTA', 'Palvelumyynti'),
    ('TUOTE', 'Tuotemyynti'),
    ('TUOTTEET', 'Tuotemyynti'),
    ('TUOTEMYYNTI', 'Tuotemyynti'),
    ('MYYNTITUOTTEET', 'Tuotemyynti')
  ) as b(pos_name, group_name)
  where p_type = 'barber';
$$;

/* Luo yrityksen oletusmyyntiryhmät ja kassakohdistukset. */
create or replace function public.business_seed_sales(p_restaurant uuid, p_type public.business_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  select p_restaurant, g.name, g.vat_rate, g.is_default, g.sort_order
  from business_default_sales_groups(p_type) g;

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select p_restaurant, d.pos_name, g.id
  from business_default_pos_names(p_type) d
  join sales_groups g on g.restaurant_id = p_restaurant and g.name = d.group_name
  on conflict do nothing;
end;
$$;

revoke all on function public.business_seed_sales(uuid, public.business_type) from public, anon, authenticated;

/* Tilikartta toimialan mukaan: myyntitilien nimet vaihtuvat. */
create or replace function public.business_ledger_accounts(p_type public.business_type)
returns table (number text, name text, type text)
language sql
immutable
as $$
  select * from (values
    ('1750', 'Kassatilitykset', 'asset'),
    ('1763', 'Arvonlisäverosaaminen', 'asset'),
    ('1900', 'Käteiskassa', 'asset'),
    ('1910', 'Pankkitili', 'asset'),
    ('1920', 'Korttisaatavat', 'asset'),
    ('2460', 'Arvonlisäverovelka', 'liability'),
    ('2870', 'Ostovelat', 'liability'),
    ('3000', case p_type when 'cafe' then 'Kahvilamyynti'
                         when 'barber' then 'Palvelumyynti'
                         else 'Ravintolamyynti' end, 'revenue'),
    ('3010', case p_type when 'barber' then 'Tuotemyynti'
                         else 'Alkoholimyynti' end, 'revenue'),
    ('3020', 'Muu myynti', 'revenue'),
    ('3900', 'Pyöristyserot', 'revenue'),
    ('4000', 'Elintarvikeostot', 'expense'),
    ('4010', 'Alkoholiostot', 'expense'),
    ('4020', 'Alkoholittomat juomat', 'expense'),
    ('4030', 'Hoitotuotteet ja tarvikkeet', 'expense'),
    ('4100', 'Keittiötarvikkeet', 'expense'),
    ('4110', 'Pakkaustarvikkeet', 'expense'),
    ('4120', 'Siivoustarvikkeet', 'expense'),
    ('4130', 'Laitteet ja välineet', 'expense'),
    ('4200', 'Kuljetus', 'expense'),
    ('4300', 'Toimitilakulut', 'expense'),
    ('4900', 'Muut kulut', 'expense'),
    ('5000', 'Henkilöstökulut', 'expense')
  ) as t(number, name, type);
$$;

create or replace function public.business_category_accounts()
returns table (category text, account text)
language sql
immutable
as $$
  select * from (values
    ('food', '4000'), ('alcohol', '4010'), ('soft_drinks', '4020'),
    ('products', '4030'), ('kitchen_supplies', '4100'), ('packaging', '4110'),
    ('cleaning', '4120'), ('equipment', '4130'), ('transport', '4200'),
    ('rent', '4300'), ('staff', '5000'), ('other', '4900')
  ) as t(category, account);
$$;

-- ---------------------------------------------------------------------------
-- 3. Tilikartan luonti uudelle yritykselle
-- ---------------------------------------------------------------------------

create or replace function public.ledger_seed_uusi_ravintola()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into ledger_accounts (restaurant_id, number, name, type, is_system, sort_order)
    select new.id, t.number, t.name, t.type::ledger_account_type, true, t.number::integer
    from business_ledger_accounts(new.business_type) t
    on conflict do nothing;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    select new.id, 'expense_category', m.category, a.id
    from business_category_accounts() m
    join ledger_accounts a on a.restaurant_id = new.id and a.number = m.account
    on conflict do nothing;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    select new.id, 'payment_method', m.avain, a.id
    from (values ('card','1920'),('cash','1900'),('invoice','2870'),('unknown','1910')) as m(avain, tili)
    join ledger_accounts a on a.restaurant_id = new.id and a.number = m.tili
    on conflict do nothing;

    insert into ledger_mappings (restaurant_id, kind, account_id)
    select new.id, 'vat_purchases', a.id from ledger_accounts a
    where a.restaurant_id = new.id and a.number = '1763'
    on conflict do nothing;

    insert into ledger_mappings (restaurant_id, kind, account_id)
    select new.id, 'vat_sales', a.id from ledger_accounts a
    where a.restaurant_id = new.id and a.number = '2460'
    on conflict do nothing;
  exception when others then
    null;
  end;

  return new;
end;
$$;

/* Myyntiryhmän tili: alkoholi- ja tuotemyynti omalle tilille. */
create or replace function public.ledger_map_sales_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_tili uuid;
begin
  begin
    select id into v_tili from ledger_accounts
     where restaurant_id = new.restaurant_id
       and number = case
         when lower(new.name) like '%alkoholi%' then '3010'
         when lower(new.name) like '%tuote%'    then '3010'
         when lower(new.name) like '%muu%'      then '3020'
         else '3000'
       end;

    if v_tili is not null then
      insert into ledger_mappings (restaurant_id, kind, ref_id, account_id)
      values (new.restaurant_id, 'sales_group', new.id, v_tili)
      on conflict do nothing;
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- Olemassa oleville yrityksille uudet kulutilit ja kohdistukset.
insert into ledger_accounts (restaurant_id, number, name, type, is_system, sort_order)
select r.id, t.number, t.name, t.type::ledger_account_type, true, t.number::integer
from restaurants r
cross join (values
  ('4030', 'Hoitotuotteet ja tarvikkeet', 'expense'),
  ('4130', 'Laitteet ja välineet', 'expense'),
  ('4300', 'Toimitilakulut', 'expense')
) as t(number, name, type)
where exists (select 1 from ledger_accounts a where a.restaurant_id = r.id)
on conflict do nothing;

insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
select a.restaurant_id, 'expense_category', m.category, a.id
from (values ('products', '4030'), ('equipment', '4130'), ('rent', '4300')) as m(category, account)
join ledger_accounts a on a.number = m.account
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Luontifunktiot käyttävät toimialaa
-- ---------------------------------------------------------------------------

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

  perform business_seed_sales(v_id, 'restaurant');
  perform seed_default_folders(v_id);

  return v_id;
end;
$$;

create or replace function public.seed_default_sales_groups(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
  v_type public.business_type;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi lisätä myyntiryhmiä';
  end if;

  if exists (select 1 from sales_groups where restaurant_id = p_restaurant) then
    return 0;
  end if;

  select business_type into v_type from restaurants where id = p_restaurant;

  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  select p_restaurant, g.name, g.vat_rate, g.is_default, g.sort_order
  from business_default_sales_groups(coalesce(v_type, 'restaurant')) g;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

create or replace function public.seed_default_pos_mappings(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added integer := 0;
  v_type public.business_type;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kohdistuksia';
  end if;

  select business_type into v_type from restaurants where id = p_restaurant;

  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select p_restaurant, d.pos_name, g.id
  from business_default_pos_names(coalesce(v_type, 'restaurant')) d
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

drop function if exists public.sa_create_restaurant(
  text, text, text, text, text, text, text, text, text, text, text,
  restaurant_plan, restaurant_status, integer, boolean
);

create function public.sa_create_restaurant(
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
  p_business_type public.business_type default 'restaurant',
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
    raise exception 'Yrityksen nimi puuttuu';
  end if;

  if p_status = 'trial' then
    v_trial := current_date + coalesce(p_trial_days, 14);
  end if;

  for v_attempt in 1..5 loop
    begin
      insert into restaurants (
        name, timezone, slug, legal_name, business_id, address, postal_code,
        city, phone, email, website, business_type, plan, status, trial_ends_on,
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
        coalesce(p_business_type, 'restaurant'),
        p_plan, p_status, v_trial,
        coalesce(p_is_test, false),
        auth.uid(),
        now()
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Osoitetunnusta ei voitu muodostaa. Kokeile toista nimea.';
      end if;
    end;
  end loop;

  perform business_seed_sales(v_id, coalesce(p_business_type, 'restaurant'));
  perform seed_default_folders(v_id);

  perform sa_log(
    'restaurant.created',
    'Yritys luotiin: ' || trim(p_name),
    'restaurant', v_id, trim(p_name),
    null,
    jsonb_build_object('plan', p_plan, 'status', p_status,
                       'type', p_business_type, 'test', coalesce(p_is_test, false)),
    false
  );

  return jsonb_build_object('id', v_id, 'name', trim(p_name));
end;
$$;

drop function if exists public.sa_update_restaurant(
  uuid, text, text, text, text, text, text, text, text, text, text, text, boolean
);

create function public.sa_update_restaurant(
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
  p_business_type public.business_type default null,
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
    name          = coalesce(nullif(trim(p_name), ''), name),
    legal_name    = nullif(trim(p_legal_name), ''),
    business_id   = nullif(trim(p_business_id), ''),
    address       = nullif(trim(p_address), ''),
    postal_code   = nullif(trim(p_postal_code), ''),
    city          = nullif(trim(p_city), ''),
    phone         = nullif(trim(p_phone), ''),
    email         = nullif(trim(p_email), ''),
    website       = nullif(trim(p_website), ''),
    business_type = coalesce(p_business_type, business_type),
    timezone      = coalesce(nullif(trim(p_timezone), ''), timezone),
    is_test_account = coalesce(p_is_test, is_test_account),
    updated_at    = now()
  where id = p_id;

  select to_jsonb(r) - 'id' into v_after from restaurants r where r.id = p_id;

  perform sa_log(
    'restaurant.updated',
    'Yrityksen tietoja muutettiin: ' || coalesce(trim(p_name), ''),
    'restaurant', p_id, trim(p_name),
    v_before, v_after, false
  );
end;
$$;

revoke all on function public.sa_create_restaurant(
  text, text, text, text, text, text, text, text, text, text,
  public.business_type, restaurant_plan, restaurant_status, integer, boolean
) from public, anon;
grant execute on function public.sa_create_restaurant(
  text, text, text, text, text, text, text, text, text, text,
  public.business_type, restaurant_plan, restaurant_status, integer, boolean
) to authenticated;

revoke all on function public.sa_update_restaurant(
  uuid, text, text, text, text, text, text, text, text, text,
  public.business_type, text, boolean
) from public, anon;
grant execute on function public.sa_update_restaurant(
  uuid, text, text, text, text, text, text, text, text, text,
  public.business_type, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Toimiala näkyviin: oma yritys ja ylläpitäjän näkymät
-- ---------------------------------------------------------------------------

drop view if exists public.my_restaurants;

create view public.my_restaurants
with (security_invoker = true) as
select r.id, r.name, r.timezone, r.currency, m.role, r.slug, r.business_type
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

revoke all on public.my_restaurants from anon;
grant select on public.my_restaurants to authenticated;

/* Ylläpitäjän yrityssivu ja lista näyttävät toimialan. */
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
           r.business_type::text as business_type,
           r.status_note, r.status_changed_at, r.created_at
    from restaurants r where r.id = p_id
  ) x;

  return v;
end;
$$;

create or replace function public.sa_restaurants()
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
      r.business_type::text as business_type,
      r.business_id, r.city, r.timezone, r.currency,
      r.is_test_account, r.trial_ends_on, r.created_at,
      (select count(*) from memberships m where m.restaurant_id = r.id and m.active) as user_count,
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

/* Tilikartan luonti käsin: sama toimialan tilikartta kuin uudelle yritykselle. */
create or replace function public.ledger_seed(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_luotu integer := 0; v_kohdistuksia integer := 0;
  v_id uuid; v_rivi record; v_ryhma record;
  v_type public.business_type;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi luoda tilikartan';
  end if;

  select business_type into v_type from restaurants where id = p_restaurant;

  for v_rivi in
    select * from business_ledger_accounts(coalesce(v_type, 'restaurant'))
  loop
    insert into ledger_accounts (restaurant_id, number, name, type, vat_rate, is_system, sort_order)
    values (p_restaurant, v_rivi.number, v_rivi.name, v_rivi.type::ledger_account_type,
            null, true, v_rivi.number::integer)
    on conflict (restaurant_id, number) do nothing;
    if found then v_luotu := v_luotu + 1; end if;
  end loop;

  for v_rivi in
    select category as avain, account as tili from business_category_accounts()
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;
    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'expense_category', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  for v_rivi in
    select * from (values
      ('card','1920'),('cash','1900'),('invoice','2870'),('unknown','1910')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;
    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'payment_method', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '1763';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_purchases', v_id) on conflict do nothing;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '2460';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_sales', v_id) on conflict do nothing;

  for v_ryhma in
    select id, name from sales_groups where restaurant_id = p_restaurant and active
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant
       and number = case
         when lower(v_ryhma.name) like '%alkoholi%' then '3010'
         when lower(v_ryhma.name) like '%tuote%'    then '3010'
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
$$;
