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
