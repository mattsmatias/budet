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
