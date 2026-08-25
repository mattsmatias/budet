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
