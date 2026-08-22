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
