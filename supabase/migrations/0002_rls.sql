-- RestoFlow — Row Level Security.
--
-- Kaikki pääsy kulkee ravintolan jäsenyyden kautta. Rajat pakotetaan
-- tietokannassa, ei sovelluslogiikassa: unohdettu WHERE-ehto ei saa vuotaa
-- toisen ravintolan kuitteja.
--
-- Roolien erot:
--   owner     — kaikki, mukaan lukien budjetit ja käyttäjät
--   manager   — kaikki paitsi budjettien muokkaus ja käyttäjähallinta
--   employee  — vain omat: omat kuitit, omat vuorot, oma työaika
--   accountant— talous luettuna, ei tuntipalkkoja eikä työvuorohallintaa

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER ohittaa RLS:n, mikä katkaisee rekursion: memberships-
-- taulun politiikka ei voi kysyä memberships-taulua politiikan läpi.
create or replace function my_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from memberships
  where user_id = auth.uid() and active;
$$;

create or replace function my_role_in(p_restaurant uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from memberships
  where user_id = auth.uid() and restaurant_id = p_restaurant and active
  limit 1;
$$;

/** Onko käyttäjä managerin tasolla tai yli tässä ravintolassa? */
create or replace function is_manager(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role in ('owner', 'manager')
  );
$$;

create or replace function is_owner(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role = 'owner'
  );
$$;

/** Näkeekö rooli koko ravintolan talouden? Kirjanpitäjä näkee, työntekijä ei. */
create or replace function can_read_finance(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and restaurant_id = p_restaurant
      and active
      and role in ('owner', 'manager', 'accountant')
  );
$$;

grant execute on function my_restaurant_ids to authenticated;
grant execute on function my_role_in to authenticated;
grant execute on function is_manager to authenticated;
grant execute on function is_owner to authenticated;
grant execute on function can_read_finance to authenticated;

-- ---------------------------------------------------------------------------
-- RLS päälle
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table memberships enable row level security;
alter table suppliers enable row level security;
alter table supplier_category_overrides enable row level security;
alter table receipts enable row level security;
alter table receipt_items enable row level security;
alter table budgets enable row level security;
alter table shifts enable row level security;
alter table clock_events enable row level security;
alter table absences enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated
  using (
    -- Oma profiili, tai saman ravintolan jäsen. Nimi tarvitaan
    -- työvuorolistoihin, joten se ei voi olla vain omalle näkyvä.
    id = auth.uid()
    or exists (
      select 1 from memberships m
      where m.user_id = profiles.id
        and m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------

drop policy if exists restaurants_read on restaurants;
create policy restaurants_read on restaurants
  for select to authenticated
  using (id in (select my_restaurant_ids()));

drop policy if exists restaurants_update on restaurants;
create policy restaurants_update on restaurants
  for update to authenticated
  using (is_owner(id))
  with check (is_owner(id));

-- Luonti kulkee create_restaurant-funktion kautta, ei suoraan.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists memberships_manage on memberships;
create policy memberships_manage on memberships
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------

drop policy if exists suppliers_read on suppliers;
create policy suppliers_read on suppliers
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

-- Työntekijä saa luoda toimittajan kuittia lisätessään, muttei muokata.
drop policy if exists suppliers_insert on suppliers;
create policy suppliers_insert on suppliers
  for insert to authenticated
  with check (restaurant_id in (select my_restaurant_ids()));

drop policy if exists suppliers_update on suppliers;
create policy suppliers_update on suppliers
  for update to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists overrides_read on supplier_category_overrides;
create policy overrides_read on supplier_category_overrides
  for select to authenticated
  using (
    supplier_id in (
      select id from suppliers where restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists overrides_write on supplier_category_overrides;
create policy overrides_write on supplier_category_overrides
  for all to authenticated
  using (
    supplier_id in (
      select id from suppliers where is_manager(restaurant_id)
    )
  )
  with check (
    supplier_id in (
      select id from suppliers where is_manager(restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------

drop policy if exists receipts_read on receipts;
create policy receipts_read on receipts
  for select to authenticated
  using (
    -- Talousroolit näkevät kaikki, työntekijä vain omansa.
    can_read_finance(restaurant_id)
    or (restaurant_id in (select my_restaurant_ids()) and added_by = auth.uid())
  );

drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts
  for insert to authenticated
  with check (
    restaurant_id in (select my_restaurant_ids())
    and added_by = auth.uid()
  );

drop policy if exists receipts_update on receipts;
create policy receipts_update on receipts
  for update to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists receipts_delete on receipts;
create policy receipts_delete on receipts
  for delete to authenticated
  using (is_manager(restaurant_id));

-- Rivit perivät kuitin oikeudet.
drop policy if exists receipt_items_read on receipt_items;
create policy receipt_items_read on receipt_items
  for select to authenticated
  using (receipt_id in (select id from receipts));

drop policy if exists receipt_items_write on receipt_items;
create policy receipt_items_write on receipt_items
  for all to authenticated
  using (
    receipt_id in (
      select id from receipts
      where is_manager(restaurant_id) or added_by = auth.uid()
    )
  )
  with check (
    receipt_id in (
      select id from receipts
      where is_manager(restaurant_id) or added_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

drop policy if exists budgets_read on budgets;
create policy budgets_read on budgets
  for select to authenticated
  using (can_read_finance(restaurant_id));

-- Vain omistaja muokkaa budjetteja.
drop policy if exists budgets_write on budgets;
create policy budgets_write on budgets
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------

drop policy if exists shifts_read on shifts;
create policy shifts_read on shifts
  for select to authenticated
  using (
    is_manager(restaurant_id)
    or (restaurant_id in (select my_restaurant_ids()) and user_id = auth.uid())
    -- Avoimet vuorot näkyvät kaikille: niihin voi ilmoittautua.
    or (restaurant_id in (select my_restaurant_ids()) and user_id is null)
  );

drop policy if exists shifts_manage on shifts;
create policy shifts_manage on shifts
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- Työntekijä saa vastata omaan vuoroonsa. Ajan muuttaminen estetään
-- erillisellä liipaisimella alempana — WITH CHECK ei näe vanhaa riviä.
drop policy if exists shifts_respond on shifts;
create policy shifts_respond on shifts
  for update to authenticated
  using (user_id = auth.uid() and restaurant_id in (select my_restaurant_ids()))
  with check (user_id = auth.uid() and status in ('accepted', 'declined'));

-- ---------------------------------------------------------------------------
-- clock_events
-- ---------------------------------------------------------------------------

drop policy if exists clock_events_read on clock_events;
create policy clock_events_read on clock_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
    -- Kirjanpitäjä näkee tunnit raportointia varten.
    or (
      restaurant_id in (select my_restaurant_ids())
      and my_role_in(restaurant_id) = 'accountant'
    )
  );

-- Leimauksen saa tehdä vain itselleen.
drop policy if exists clock_events_insert on clock_events;
create policy clock_events_insert on clock_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and restaurant_id in (select my_restaurant_ids())
  );

-- Leimauksia ei muokata eikä poisteta. Työaikaloki on kirjanpitoa; korjaus
-- tehdään uudella tapahtumalla, ei vanhaa muuttamalla.

-- ---------------------------------------------------------------------------
-- absences
-- ---------------------------------------------------------------------------

drop policy if exists absences_read on absences;
create policy absences_read on absences
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists absences_insert on absences;
create policy absences_insert on absences
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and restaurant_id in (select my_restaurant_ids())
  );

-- ---------------------------------------------------------------------------
-- Työntekijän vuorovastauksen rajaus
-- ---------------------------------------------------------------------------

/**
 * Työntekijä saa vaihtaa vain tilan, ei aikoja eikä tekijää.
 *
 * RLS:n WITH CHECK tarkistaa vain uuden rivin, joten se ei voi verrata
 * vanhaan. Tämä liipaisin tekee sen.
 */
create or replace function guard_shift_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_manager(new.restaurant_id) then
    return new;
  end if;

  if new.shift_date is distinct from old.shift_date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.user_id is distinct from old.user_id
     or new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Vain vuoron tilan voi muuttaa';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_shift_response_trigger on shifts;
create trigger guard_shift_response_trigger
  before update on shifts
  for each row execute function guard_shift_response();
