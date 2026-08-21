-- ---------------------------------------------------------------------------
-- 0006 — Kuitin lisääminen vain ravintolan esihenkilölle
-- ---------------------------------------------------------------------------
--
-- Kuitti on ravintolan kirjanpitoaineistoa, ei työntekijän ilmoitus. Kuka
-- tahansa vuorossa oleva ei saa synnyttää kulukirjausta jota kukaan ei ole
-- hyväksynyt, eikä ladata kuvaa ravintolan tallennustilaan.
--
-- Sama rajaus kolmella kerroksella, koska yksikään ei yksin riitä:
--   1. create_receipt on security definer ja ohittaa RLS:n → tarkistus
--      funktion sisään
--   2. suora taulukirjoitus PostgREST:n läpi ohittaa funktion → tarkistus
--      insert-politiikkaan
--   3. kuva ladataan selaimesta suoraan storageen → tarkistus storage-
--      politiikkaan
--
-- Käyttöliittymän piilotettu painike ei ole tässä listassa, koska se ei ole
-- pääsynhallintaa.
--
-- Funktion runko on 0003:sta sellaisenaan; vain oikeustarkistus on
-- vaihdettu.

-- ---------------------------------------------------------------------------
-- 1. Funktio
-- ---------------------------------------------------------------------------

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

  -- Jäsenyys ei enää riitä: rooli ratkaisee. Kuitti on ravintolan
  -- kirjanpitoaineistoa, ei työntekijän ilmoitus.
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi lisätä kuitteja';
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
-- 2. Taulupolitiikka
-- ---------------------------------------------------------------------------

drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts
  for insert to authenticated
  with check (
    is_manager(restaurant_id)
    and added_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Tallennuspolitiikka
-- ---------------------------------------------------------------------------

drop policy if exists receipts_storage_write on storage.objects;
create policy receipts_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

-- upsert: true päivittää olemassa olevan objektin, ja ilman update-
-- politiikkaa saman tiedoston lataus uudelleen kaatuu oikeusvirheeseen.
drop policy if exists receipts_storage_update on storage.objects;
create policy receipts_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and is_manager((storage.foldername(name))[1]::uuid)
  );
