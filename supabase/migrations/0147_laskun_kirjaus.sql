-- 0147 Laskun kirjaus: myyntisaaminen ja sen maksu
--
-- KAKSI TAPAHTUMAA, EI YKSI.
--
-- Lasku ja sen maksu ovat eri hetkia ja eri kirjauksia. Lasku
-- synnyttaa saatavan (myyntisaamiset debet, myynti ja ALV kredit), ja
-- maksu purkaa sen (pankki debet, myyntisaamiset kredit). Yhtena
-- kirjauksena myynti nakyisi vasta maksupaivana, ja silloin
-- suoriteperuste rikkoutuisi: myynti kuuluu sille kuukaudelle jona se
-- tapahtui, ei sille jona raha tuli.
--
-- LUONNOS EI OLE SAATAVA.
--
-- Kirjaus syntyy vasta kun lasku on lahetetty. Luonnos on kirjoitusta
-- ruudulla eika tapahtumaa, ja jos se kirjautuisi, jokainen kesken
-- jaanyt lasku nakyisi saatavana jota kukaan ei ole luvannut maksaa.
-- Tilan palautuminen luonnokseksi poistaa ehdotuksen itsestaan.
--
-- Sama kuvio kuin muillakin lahteilla: ehdotus jonka omistaja
-- vahvistaa. Kirjattua ei kosketa, suljettuun kuukauteen ei kirjata,
-- ja virhe kirjauksen rakentamisessa ei kaada laskun tallennusta.

create or replace function ledger_ensure_invoice(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_l record;
  v_year uuid;
  v_entry uuid;
  v_rivi integer;
  v_saamiset uuid;
  v_myynti uuid;
  v_alvtili uuid;
  v_kanta record;
begin
  select i.id, i.restaurant_id, i.invoice_date, i.status, i.number,
         i.recipient_name, i.total_cents, i.vat_cents
    into v_l
  from invoices i where i.id = p_invoice;

  if v_l.id is null then return; end if;

  /* Kirjattua tositetta ei rakenneta uudelleen. */
  if exists (select 1 from ledger_entries
             where source_type = 'invoice' and source_id = p_invoice
               and status <> 'proposed') then
    return;
  end if;

  delete from ledger_entries
   where source_type = 'invoice' and source_id = p_invoice and status = 'proposed';

  /* Vain lahetetty tai maksettu lasku on saatava. */
  if v_l.status not in ('sent', 'paid') then return; end if;

  if exists (select 1 from closed_months
             where restaurant_id = v_l.restaurant_id
               and month = date_trunc('month', v_l.invoice_date)::date) then
    return;
  end if;

  select id into v_saamiset from ledger_accounts
   where restaurant_id = v_l.restaurant_id and number = '1700';
  select id into v_myynti from ledger_accounts
   where restaurant_id = v_l.restaurant_id and number = '3000';
  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = v_l.restaurant_id and kind = 'vat_sales' limit 1;

  if v_saamiset is null or v_myynti is null or v_alvtili is null then return; end if;

  v_year := ledger_year_for(v_l.restaurant_id, v_l.invoice_date);

  insert into ledger_entries (restaurant_id, fiscal_year_id, entry_number, entry_date,
    description, source_type, source_id, created_by)
  values (v_l.restaurant_id, v_year, ledger_next_number(v_year), v_l.invoice_date,
    'Lasku ' || v_l.number || ' · ' || v_l.recipient_name,
    'invoice', p_invoice, auth.uid())
  returning id into v_entry;

  insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
  values (v_entry, 1, v_saamiset, v_l.total_cents, 'Myyntisaaminen');

  v_rivi := 2;

  /*
   * Myynti kannoittain, samasta lahteesta kuin laskun oma erittely.
   *
   * Rivin netto on jo pyoristetty laskua luotaessa, joten summaus
   * antaa saman luvun kuin laskulla lukee.
   */
  for v_kanta in
    select c.rate as rate, sum(r.net_cents)::integer as netto
    from invoice_rows r
    join vat_codes c on c.id = r.vat_code_id
    where r.invoice_id = p_invoice
    group by c.rate
    order by c.rate
  loop
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, vat_rate, description)
    values (v_entry, v_rivi, v_myynti, v_kanta.netto, v_kanta.rate, 'Myynti veroton');
    v_rivi := v_rivi + 1;
  end loop;

  if v_l.vat_cents <> 0 then
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_alvtili, v_l.vat_cents, 'Myynnin ALV');
  end if;
end;
$$;

create or replace function ledger_ensure_invoice_payment(p_invoice uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_l record;
  v_year uuid;
  v_entry uuid;
  v_saamiset uuid;
  v_pankki uuid;
  v_paiva date;
begin
  select i.id, i.restaurant_id, i.status, i.number, i.recipient_name,
         i.total_cents, i.paid_at, i.invoice_date
    into v_l
  from invoices i where i.id = p_invoice;

  if v_l.id is null then return; end if;

  if exists (select 1 from ledger_entries
             where source_type = 'invoice_payment' and source_id = p_invoice
               and status <> 'proposed') then
    return;
  end if;

  delete from ledger_entries
   where source_type = 'invoice_payment' and source_id = p_invoice
     and status = 'proposed';

  if v_l.status <> 'paid' or v_l.paid_at is null then return; end if;

  v_paiva := v_l.paid_at::date;

  if exists (select 1 from closed_months
             where restaurant_id = v_l.restaurant_id
               and month = date_trunc('month', v_paiva)::date) then
    return;
  end if;

  select id into v_saamiset from ledger_accounts
   where restaurant_id = v_l.restaurant_id and number = '1700';
  select id into v_pankki from ledger_accounts
   where restaurant_id = v_l.restaurant_id and number = '1910';

  if v_saamiset is null or v_pankki is null then return; end if;

  v_year := ledger_year_for(v_l.restaurant_id, v_paiva);

  insert into ledger_entries (restaurant_id, fiscal_year_id, entry_number, entry_date,
    description, source_type, source_id, created_by)
  values (v_l.restaurant_id, v_year, ledger_next_number(v_year), v_paiva,
    'Laskun ' || v_l.number || ' suoritus',
    'invoice_payment', p_invoice, auth.uid())
  returning id into v_entry;

  insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
  values (v_entry, 1, v_pankki, v_l.total_cents, 'Suoritus');

  insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
  values (v_entry, 2, v_saamiset, v_l.total_cents, 'Myyntisaaminen kuitataan');
end;
$$;

/* Lahteen muutos paivittaa molemmat ehdotukset. Vaiti kuten muillakin. */
create or replace function ledger_lasku_muuttui()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform ledger_ensure_invoice(coalesce(new.id, old.id));
    perform ledger_ensure_invoice_payment(coalesce(new.id, old.id));
  exception when others then
    null;
  end;

  return coalesce(new, old);
end;
$$;

drop trigger if exists invoices_ledger on invoices;
create trigger invoices_ledger
  after insert or update on invoices
  for each row execute function ledger_lasku_muuttui();

/*
 * Laskun merkitseminen maksetuksi.
 *
 * Paiva on parametri eika now(): tiliote kertoo milloin raha tuli, ja
 * se voi olla eri kuin se hetki jona joku ehtii merkita sen. Vaara
 * paiva siirtaisi suorituksen vaaralle kuukaudelle.
 */
create or replace function mark_invoice_paid(p_invoice uuid, p_date date default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_restaurant uuid;
  v_status invoice_status;
  v_paiva date := coalesce(p_date, current_date);
begin
  select restaurant_id, status into v_restaurant, v_status
  from invoices where id = p_invoice;

  if v_restaurant is null then
    raise exception 'Laskua ei loytynyt';
  end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta' using errcode = '42501';
  end if;

  if v_status <> 'sent' then
    raise exception 'Vain lahetetyn laskun voi merkita maksetuksi';
  end if;

  update invoices
  set status = 'paid',
      paid_at = v_paiva::timestamptz,
      paid_cents = total_cents
  where id = p_invoice;

  perform write_audit(
    v_restaurant, 'update', 'invoice', p_invoice, null,
    'Lasku merkittiin maksetuksi', null,
    jsonb_build_object('paid_on', v_paiva), false
  );
end;
$$;

revoke all on function mark_invoice_paid(uuid, date) from public, anon;
grant execute on function mark_invoice_paid(uuid, date) to authenticated;
