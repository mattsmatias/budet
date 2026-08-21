-- RestoFlow — managerin toiminnot.
--
-- Neljä asiaa jotka puuttuivat: käyttäjien kutsuminen, kuitin tarkistuksen
-- päättäminen, budjettien asetus ja työvuorojen hallinta.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Kutsut
-- ---------------------------------------------------------------------------

/**
 * Liittymiskoodi, ei sähköpostikutsu.
 *
 * Sähköpostin lähetys vaatisi ulkoisen palvelun. Koodi toimii ilman sitä:
 * manageri antaa sen työntekijälle miten haluaa, ja työntekijä syöttää sen
 * rekisteröitymisen jälkeen.
 *
 * Koodista tallennetaan vain tiiviste. Tietokannan lukuoikeus ei siis
 * riitä liittymiseen.
 */
create table if not exists restaurant_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  code_hash text not null unique,
  -- Neljä viimeistä merkkiä näkyviin, jotta manageri tunnistaa kutsun
  -- listasta antamatta koodia uudelleen.
  code_hint text not null,
  role app_role not null default 'employee',
  position staff_position,
  hourly_rate_cents int check (hourly_rate_cents is null or hourly_rate_cents >= 0),
  label text,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references profiles (id) on delete set null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists restaurant_invitations_idx
  on restaurant_invitations (restaurant_id, created_at desc);

alter table restaurant_invitations enable row level security;

drop policy if exists restaurant_invitations_read on restaurant_invitations;
create policy restaurant_invitations_read on restaurant_invitations
  for select to authenticated
  using (is_manager(restaurant_id));

drop policy if exists restaurant_invitations_manage on restaurant_invitations;
create policy restaurant_invitations_manage on restaurant_invitations
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

/**
 * Luo kutsukoodin.
 *
 * Palauttaa koodin selväkielisenä kerran — sitä ei voi hakea myöhemmin,
 * koska kannassa on vain tiiviste. Kadonnut koodi mitätöidään ja luodaan
 * uusi.
 */
create or replace function create_invitation(
  p_restaurant uuid,
  p_role app_role default 'employee',
  p_position staff_position default null,
  p_hourly_rate_cents int default null,
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi kutsua käyttäjiä';
  end if;

  -- Aakkostosta on jätetty pois I, O, 0 ja 1: ne sekoittuvat puhelimessa
  -- luettuna ja koodi kirjoitetaan käsin.
  v_code := '';
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, position,
    hourly_rate_cents, label, created_by
  )
  values (
    p_restaurant,
    encode(digest(v_code, 'sha256'), 'hex'),
    right(v_code, 4),
    p_role,
    p_position,
    p_hourly_rate_cents,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  return v_code;
end;
$$;

revoke all on function create_invitation from public;
grant execute on function create_invitation to authenticated;

/**
 * Lunastaa kutsukoodin.
 *
 * SECURITY DEFINER, koska kutsuja ei vielä ole ravintolan jäsen eikä siis
 * näe kutsuriviä RLS:n läpi. Tarkistukset tehdään tässä käsin.
 */
create or replace function accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv restaurant_invitations;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex');

  if v_inv.id is null then
    raise exception 'Koodia ei löytynyt';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Koodi on jo käytetty';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Koodi on vanhentunut';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  -- Sama kaava kuin budjeteissa: päivitä, lisää jos ei ollut. Jäsenyys voi
  -- olla olemassa passivoituna, jolloin kutsu herättää sen uudelleen.
  update memberships
  set active = true,
      role = v_inv.role,
      position = v_inv.position,
      hourly_rate_cents = coalesce(v_inv.hourly_rate_cents, hourly_rate_cents)
  where restaurant_id = v_inv.restaurant_id and user_id = v_user;

  if not found then
    insert into memberships (
      restaurant_id, user_id, role, position, hourly_rate_cents
    )
    values (
      v_inv.restaurant_id, v_user, v_inv.role, v_inv.position,
      v_inv.hourly_rate_cents
    );
  end if;

  update restaurant_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.restaurant_id;
end;
$$;

revoke all on function accept_invitation from public;
grant execute on function accept_invitation to authenticated;

-- ---------------------------------------------------------------------------
-- Kuitin tarkistus
-- ---------------------------------------------------------------------------

/**
 * Päättää kuitin tarkistuksen.
 *
 * Korjatut arvot kirjoitetaan samalla kertaa: erillisenä muokkauksena ja
 * hyväksyntänä kuitti voisi jäädä tilaan jossa se on hyväksytty mutta
 * vanhoilla arvoilla.
 *
 * Kun kategoria muuttuu, korjaus kirjataan toimittajalle. Kun sama korjaus
 * toistuu, sitä ehdotetaan jatkossa.
 */
create or replace function review_receipt(
  p_receipt uuid,
  p_approve boolean,
  p_supplier_name text default null,
  p_date date default null,
  p_total_cents int default null,
  p_vat_cents int default null,
  p_category expense_category default null,
  p_payment payment_method default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt receipts;
  v_new_category expense_category;
begin
  select * into v_receipt from receipts where id = p_receipt;

  if v_receipt.id is null then
    raise exception 'Kuittia ei löytynyt';
  end if;

  if not is_manager(v_receipt.restaurant_id) then
    raise exception 'Vain esihenkilö voi tarkistaa kuitin';
  end if;

  v_new_category := coalesce(p_category, v_receipt.category);

  -- Kategoriakorjaus toimittajalle: sääntö korjaushistoriasta, ei
  -- mallin koulutusta, ja se on nähtävissä ja kumottavissa.
  if v_receipt.supplier_id is not null
     and v_new_category is distinct from v_receipt.category then
    insert into supplier_category_overrides (
      supplier_id, from_category, to_category, count
    )
    values (v_receipt.supplier_id, v_receipt.category, v_new_category, 1)
    on conflict (supplier_id, from_category, to_category)
      do update set count = supplier_category_overrides.count + 1,
                    updated_at = now();
  end if;

  update receipts
  set supplier_name = coalesce(nullif(trim(p_supplier_name), ''), supplier_name),
      receipt_date = coalesce(p_date, receipt_date),
      total_cents = coalesce(p_total_cents, total_cents),
      vat_cents = coalesce(p_vat_cents, vat_cents),
      category = v_new_category,
      payment_method = coalesce(p_payment, payment_method),
      note = coalesce(nullif(trim(p_note), ''), note),
      status = case when p_approve then 'confirmed'::receipt_status
                    else 'needs_review'::receipt_status end,
      review_reasons = case when p_approve then '{}'::text[] else review_reasons end
  where id = p_receipt;
end;
$$;

revoke all on function review_receipt from public;
grant execute on function review_receipt to authenticated;

-- ---------------------------------------------------------------------------
-- Budjetit
-- ---------------------------------------------------------------------------

/**
 * Asettaa toistuvan kuukausibudjetin kategorialle.
 *
 * Nolla poistaa budjetin: budjetoimaton kategoria näytetään eri tavalla
 * kuin kategoria jonka budjetti on nolla, ja jälkimmäinen olisi aina
 * ylitetty.
 */
create or replace function set_budget(
  p_restaurant uuid,
  p_category expense_category,
  p_amount_cents int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi asettaa budjetteja';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    delete from budgets
    where restaurant_id = p_restaurant and category = p_category and month is null;
    return;
  end if;

  -- Päivitä ensin, lisää vasta jos riviä ei ollut. ON CONFLICT joutuisi
  -- päättelemään osittaisindeksin (month is null), mikä on herkkä
  -- kirjoitusasulle; tämä tekee saman ilman päättelyä.
  update budgets
  set amount_cents = p_amount_cents, updated_at = now()
  where restaurant_id = p_restaurant and category = p_category and month is null;

  if not found then
    insert into budgets (restaurant_id, category, month, amount_cents)
    values (p_restaurant, p_category, null, p_amount_cents);
  end if;
end;
$$;

revoke all on function set_budget from public;
grant execute on function set_budget to authenticated;

-- ---------------------------------------------------------------------------
-- Jäsenyyden päivitys
-- ---------------------------------------------------------------------------

/**
 * Päivittää jäsenen roolin, tehtävän ja tuntipalkan.
 *
 * Omistaja ei voi poistaa omaa omistajuuttaan jos hän on ainoa omistaja —
 * muuten ravintola jäisi ilman ketään joka voi hallita sitä.
 */
create or replace function update_membership(
  p_restaurant uuid,
  p_user uuid,
  p_role app_role,
  p_position staff_position,
  p_hourly_rate_cents int,
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_count int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa jäsenyyksiä';
  end if;

  if p_role is distinct from 'owner' or not p_active then
    select count(*) into v_owner_count from memberships
    where restaurant_id = p_restaurant and role = 'owner' and active;

    if v_owner_count <= 1 and exists (
      select 1 from memberships
      where restaurant_id = p_restaurant and user_id = p_user
        and role = 'owner' and active
    ) then
      raise exception 'Ravintolalla on oltava vähintään yksi omistaja';
    end if;
  end if;

  update memberships
  set role = p_role,
      position = p_position,
      hourly_rate_cents = p_hourly_rate_cents,
      active = p_active
  where restaurant_id = p_restaurant and user_id = p_user;
end;
$$;

revoke all on function update_membership from public;
grant execute on function update_membership to authenticated;

-- ---------------------------------------------------------------------------
-- Työvuorot
-- ---------------------------------------------------------------------------

/**
 * Luo tai päivittää työvuoron.
 *
 * Kun aika muuttuu jo hyväksyttyyn vuoroon, tila palautuu odottamaan
 * vastausta ja vanhat ajat säilytetään. Työntekijä on hyväksynyt tietyn
 * ajan, ei mitä tahansa aikaa.
 */
create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case when p_user is null then 'draft' else 'pending' end
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        when v_old.user_id is distinct from p_user then 'pending'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

/** Poistaa vuoron. Menneitä vuoroja ei poisteta — ne ovat historiaa. */
create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;

-- ---------------------------------------------------------------------------
-- Kaksoiskappaleen poisto
-- ---------------------------------------------------------------------------

/** Poistaa kuitin. Rivit poistuvat kaskadina. */
create or replace function delete_receipt(p_receipt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from receipts where id = p_receipt;
  if v_restaurant is null then return; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi poistaa kuitteja';
  end if;

  delete from receipts where id = p_receipt;
end;
$$;

revoke all on function delete_receipt from public;
grant execute on function delete_receipt to authenticated;
