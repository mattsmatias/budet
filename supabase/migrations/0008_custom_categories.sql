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
