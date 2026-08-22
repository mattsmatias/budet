-- ---------------------------------------------------------------------------
-- 0022 — Lounashinta viikolle, ei päivälle
-- ---------------------------------------------------------------------------
--
-- Hinta oli päiväkohtainen. Se oli liikaa: ravintolan lounas maksaa
-- saman verran maanantaina ja perjantaina, ja päiväkohtainen hinta
-- tarkoitti viittä kenttää joihin kirjoitetaan viisi kertaa sama luku.
-- Viisi paikkaa samalle luvulle on myös viisi paikkaa jossa se voi
-- jäädä päivittämättä.
--
-- Hinta siirtyy viikolle. Nimetyt hinnat säilyvät — Lounas,
-- Eläkeläinen, Lapset — mutta ne koskevat koko viikkoa.
--
-- Siirto on puhdas: hintarivejä ei ollut vielä yhtään.

-- Käytäntö viittaa vanhaan sarakkeeseen, joten se on pudotettava
-- ennen saraketta. Uusi luodaan alempana.
drop policy if exists lunch_prices_read on lunch_prices;

alter table lunch_prices
  drop constraint if exists lunch_prices_lunch_day_id_name_key;

alter table lunch_prices
  add column if not exists menu_id uuid references lunch_menus (id) on delete cascade;

-- Olemassa olevat rivit päivän kautta viikolle. Tyhjässä taulussa
-- tämä ei tee mitään, mutta se on oikein myös jos rivejä olisi.
update lunch_prices p
set menu_id = d.menu_id
from lunch_days d
where d.id = p.lunch_day_id and p.menu_id is null;

-- Sama nimi kahdesti samalla viikolla ei ole hinta vaan ristiriita.
delete from lunch_prices a
using lunch_prices b
where a.menu_id = b.menu_id
  and a.name = b.name
  and a.ctid > b.ctid;

alter table lunch_prices alter column menu_id set not null;
alter table lunch_prices drop column if exists lunch_day_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lunch_prices_menu_name_key'
  ) then
    alter table lunch_prices add constraint lunch_prices_menu_name_key
      unique (menu_id, name);
  end if;
end;
$$;

drop index if exists lunch_prices_day_idx;
create index if not exists lunch_prices_menu_idx
  on lunch_prices (menu_id, sort_order);

-- ---------------------------------------------------------------------------
-- Käytäntö ja liipaisin uudelleen
-- ---------------------------------------------------------------------------

drop policy if exists lunch_prices_read on lunch_prices;
create policy lunch_prices_read on lunch_prices
  for select to authenticated
  using (
    menu_id in (
      select id from lunch_menus
      where restaurant_id in (select my_restaurant_ids())
    )
  );

-- Sisällön muutosaika päivittyy nyt suoraan viikosta eikä päivän kautta.
create or replace function touch_lunch_menu_from_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus set content_updated_at = now(), updated_at = now()
  where id = coalesce(new.menu_id, old.menu_id);
  return null;
end;
$$;

drop trigger if exists lunch_prices_touch on lunch_prices;
create trigger lunch_prices_touch
  after insert or update or delete on lunch_prices
  for each row execute function touch_lunch_menu_from_price();

-- ---------------------------------------------------------------------------
-- Hinnan asetus
-- ---------------------------------------------------------------------------

drop function if exists set_lunch_price(uuid, text, int);

/**
 * Viikon lounashinta. Null poistaa hinnan.
 *
 * Ottaa viikon eikä päivän. Päiväkohtainen kutsu jäisi eloon
 * rinnalle ja tuottaisi hiljaa vanhan mallin mukaisia rivejä.
 */
create or replace function set_lunch_price(
  p_menu uuid,
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
  select restaurant_id into v_restaurant from lunch_menus where id = p_menu;

  if v_restaurant is null then
    raise exception 'Viikkoa ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Hinnan nimi puuttuu';
  end if;

  if p_cents is null then
    delete from lunch_prices where menu_id = p_menu and name = trim(p_name);
    return;
  end if;

  if p_cents < 0 then
    raise exception 'Hinta ei voi olla negatiivinen';
  end if;

  insert into lunch_prices (menu_id, name, price_cents)
  values (p_menu, trim(p_name), p_cents)
  on conflict (menu_id, name)
  do update set price_cents = excluded.price_cents;
end;
$$;

revoke all on function set_lunch_price from public;
grant execute on function set_lunch_price to authenticated;

-- ---------------------------------------------------------------------------
-- Kopiointi
-- ---------------------------------------------------------------------------

/**
 * Päivän kopiointi ei enää koske hintoihin.
 *
 * Hinta on viikon ominaisuus, joten päivän kopioiminen toiseen päivään
 * samalla viikolla ei voi muuttaa sitä.
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

  if v_restaurant is null or lunch_day_restaurant(p_to) is distinct from v_restaurant then
    raise exception 'Päivää ei löytynyt';
  end if;
  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;
  if p_from = p_to then return; end if;

  delete from lunch_items where lunch_day_id = p_to;

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

/** Viikon kopiointi ottaa hinnat mukaan. */
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

  update lunch_menus
  set status = 'draft', published_at = null, updated_at = now()
  where id = v_to_menu;

  return v_to_menu;
end;
$$;

revoke all on function copy_lunch_week from public;
grant execute on function copy_lunch_week to authenticated;

-- ---------------------------------------------------------------------------
-- Julkinen haku
-- ---------------------------------------------------------------------------

/** Hinnat viikon tasolla, ei enää päivien sisällä. */
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
      'days', '[]'::json
    );
  end if;

  return json_build_object(
    'restaurantName', v_restaurant.name,
    'weekStart', v_menu.week_start,
    'weekEnd', v_menu.week_end,
    'published', true,
    'publishedAt', v_menu.published_at,
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
