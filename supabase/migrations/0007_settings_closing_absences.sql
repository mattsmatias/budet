-- ---------------------------------------------------------------------------
-- 0007 — Asetukset, kuukauden sulkeminen ja poissaolojen poisto
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Ravintolan asetukset
-- ---------------------------------------------------------------------------
--
-- Aikavyöhyke tarkistetaan pg_timezone_names-listaa vasten. Kelvoton
-- vyöhyke ei kaataisi mitään heti, mutta laskisi työajat väärin
-- huomaamatta — ja virhe löytyisi vasta palkanmaksusta.

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa asetuksia';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  update restaurants
  set name = trim(p_name),
      timezone = p_timezone,
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kuukauden sulkeminen
-- ---------------------------------------------------------------------------
--
-- Suljettu kuukausi on kirjanpitoon lähtenyt kuukausi. Sen jälkeen tehty
-- muutos ei enää täsmää siihen mitä kirjanpitäjälle on annettu, joten
-- kuittien lisäys, muokkaus ja poisto estetään liipaisimella — ei
-- sovelluskoodissa, koska sen ohi pääsee.

create table if not exists closed_months (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  -- Kuukauden ensimmäinen päivä. Date eikä text, jotta vertailu on
  -- indeksoitavissa eikä nojaa merkkijonon muotoon.
  month date not null,
  closed_by uuid not null references profiles (id),
  closed_at timestamptz not null default now(),
  note text,
  unique (restaurant_id, month)
);

create index if not exists closed_months_restaurant_idx
  on closed_months (restaurant_id, month);

alter table closed_months enable row level security;

drop policy if exists closed_months_read on closed_months;
create policy closed_months_read on closed_months
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists closed_months_write on closed_months;
create policy closed_months_write on closed_months
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

create or replace function is_month_closed(p_restaurant uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from closed_months
    where restaurant_id = p_restaurant
      and month = date_trunc('month', p_date)::date
  );
$$;

grant execute on function is_month_closed to authenticated;

/**
 * Estää muutokset suljettuun kuukauteen.
 *
 * Sekä vanha että uusi päivä tarkistetaan: muuten kuitin voisi siirtää
 * suljettuun kuukauteen tai pois siitä.
 */
create or replace function guard_closed_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if is_month_closed(old.restaurant_id, old.receipt_date) then
      raise exception 'Kuukausi on suljettu';
    end if;
    return old;
  end if;

  if is_month_closed(new.restaurant_id, new.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  if tg_op = 'UPDATE' and is_month_closed(old.restaurant_id, old.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  return new;
end;
$$;

drop trigger if exists receipts_closed_month on receipts;
create trigger receipts_closed_month
  before insert or update or delete on receipts
  for each row execute function guard_closed_month();

create or replace function close_month(
  p_restaurant uuid,
  p_month text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi sulkea kuukauden';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Kuukauden muoto on VVVV-KK';
  end if;

  v_month := (p_month || '-01')::date;

  -- Kuluvaa kuukautta ei suljeta: siihen tulee vielä kuitteja, ja
  -- sulkeminen estäisi ne kaikki.
  if v_month >= date_trunc('month', (now() at time zone (
    select timezone from restaurants where id = p_restaurant
  ))::date) then
    raise exception 'Kuluvaa tai tulevaa kuukautta ei voi sulkea';
  end if;

  insert into closed_months (restaurant_id, month, closed_by, note)
  values (p_restaurant, v_month, auth.uid(), nullif(trim(p_note), ''))
  on conflict (restaurant_id, month) do nothing;
end;
$$;

revoke all on function close_month from public;
grant execute on function close_month to authenticated;

create or replace function reopen_month(p_restaurant uuid, p_month text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi avata kuukauden';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Kuukauden muoto on VVVV-KK';
  end if;

  delete from closed_months
  where restaurant_id = p_restaurant
    and month = (p_month || '-01')::date;
end;
$$;

revoke all on function reopen_month from public;
grant execute on function reopen_month to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Poissaolon peruminen
-- ---------------------------------------------------------------------------
--
-- Ilmoituksen voi perua itse, esihenkilö kenen tahansa. Väärästä päivästä
-- tehty ilmoitus jäisi muuten pysyvästi vuorolistalle.

drop policy if exists absences_delete on absences;
create policy absences_delete on absences
  for delete to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));
