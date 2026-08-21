-- RestoFlow — funktiot ja tallennus.

-- ---------------------------------------------------------------------------
-- Profiili syntyy rekisteröitymisestä
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Täydennä profiilit käyttäjille jotka rekisteröityivät ennen liipaisinta.
insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- Ravintolan perustus
-- ---------------------------------------------------------------------------

/**
 * Luo ravintolan, omistajajäsenyyden ja oletusbudjetit yhdessä
 * transaktiossa.
 *
 * Jos jokin epäonnistuu, mitään ei jää puolitiehen — muuten käyttäjä voisi
 * jäädä tilaan jossa ravintola on olemassa mutta hän ei ole sen jäsen,
 * jolloin RLS estäisi häntä näkemästä omaa ravintolaansa.
 */
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

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;

-- ---------------------------------------------------------------------------
-- Kuitin tallennus riveineen
-- ---------------------------------------------------------------------------

/**
 * Tallentaa kuitin ja sen rivit yhdessä transaktiossa.
 *
 * Rivit ovat osa kuittia, eivät erillinen asia: puolikas kuitti jolla on
 * summa muttei rivejä näyttäisi kulunäkymässä oikealta ja jakautuisi
 * väärään kategoriaan.
 *
 * Palauttaa kuitin tunnisteen, tai virheen jos sama tiedosto on jo
 * tallennettu.
 */
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
  p_items jsonb default '[]'::jsonb
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
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'Loppusumma puuttuu';
  end if;

  -- Toimittaja luodaan tarvittaessa. Nimi on ravintolan sisällä uniikki,
  -- joten kilpaileva lisäys ei tuota kaksoiskappaletta.
  if coalesce(trim(p_supplier_name), '') <> '' then
    insert into suppliers (restaurant_id, name, default_category)
    values (p_restaurant, trim(p_supplier_name), p_category)
    on conflict (restaurant_id, name) do update set name = excluded.name
    returning id into v_supplier;
  end if;

  insert into receipts (
    restaurant_id, supplier_id, supplier_name, receipt_date, total_cents,
    vat_cents, category, payment_method, receipt_number, note, status,
    review_reasons, image_path, image_quality, file_hash, added_by
  )
  values (
    p_restaurant, v_supplier, coalesce(nullif(trim(p_supplier_name), ''), 'Tuntematon'),
    p_date, p_total_cents, p_vat_cents, p_category, p_payment,
    nullif(trim(p_receipt_number), ''), nullif(trim(p_note), ''), p_status,
    coalesce(p_review_reasons, '{}'), p_image_path, p_image_quality,
    nullif(trim(p_file_hash), ''), v_user
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

-- ---------------------------------------------------------------------------
-- Leimaus
-- ---------------------------------------------------------------------------

/**
 * Kirjaa työaikatapahtuman ja tarkistaa siirtymän kelvollisuuden
 * palvelimella.
 *
 * Selaimen tarkistukseen ei voi luottaa: kaksi välilehteä auki, ja
 * "SISÄÄN" voisi tulla kahdesti. Tila johdetaan tässä samasta
 * tapahtumajonosta kuin käyttöliittymässä.
 */
create or replace function record_clock_event(
  p_restaurant uuid,
  p_type clock_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_state text := 'off';
  v_row record;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (
    select 1 from memberships
    where user_id = v_user and restaurant_id = p_restaurant and active
  ) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  -- Tila kuluvan päivän tapahtumista, samassa järjestyksessä kuin ne sattuivat.
  for v_row in
    select event_type from clock_events
    where user_id = v_user
      and restaurant_id = p_restaurant
      and occurred_at >= date_trunc('day', now())
    order by occurred_at
  loop
    v_state := case
      when v_row.event_type = 'in' and v_state = 'off' then 'working'
      when v_row.event_type = 'break_start' and v_state = 'working' then 'on_break'
      when v_row.event_type = 'break_end' and v_state = 'on_break' then 'working'
      when v_row.event_type = 'out' then 'off'
      else v_state
    end;
  end loop;

  if not (
    (p_type = 'in' and v_state = 'off')
    or (p_type = 'break_start' and v_state = 'working')
    or (p_type = 'break_end' and v_state = 'on_break')
    or (p_type = 'out' and v_state in ('working', 'on_break'))
  ) then
    raise exception 'Leimaus ei ole mahdollinen nykyisessä tilassa (%)', v_state;
  end if;

  insert into clock_events (restaurant_id, user_id, event_type)
  values (p_restaurant, v_user, p_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function record_clock_event from public;
grant execute on function record_clock_event to authenticated;

-- ---------------------------------------------------------------------------
-- Näkymä omista ravintoloista
-- ---------------------------------------------------------------------------

create or replace view my_restaurants
with (security_invoker = true)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;

-- ---------------------------------------------------------------------------
-- Tallennus
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 20971520,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

-- Polku alkaa aina ravintolan tunnisteella, ja pääsy ratkaistaan samalla
-- jäsenyydellä kuin muualla.
drop policy if exists receipts_storage_read on storage.objects;
create policy receipts_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists receipts_storage_write on storage.objects;
create policy receipts_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists receipts_storage_delete on storage.objects;
create policy receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );
