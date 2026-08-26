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
