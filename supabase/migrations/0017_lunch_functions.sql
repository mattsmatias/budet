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
