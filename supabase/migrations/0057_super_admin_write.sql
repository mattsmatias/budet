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
