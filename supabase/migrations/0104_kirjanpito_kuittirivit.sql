-- 0104 — Kuitin kirjausesitys riveittäin ja poiston siivous
--
-- KOLME VIRHETTÄ KUITIN KIRJAUKSESSA.
--
-- 1. Sekakuitti kirjautui yhdelle tilille.
--    ledger_ensure_receipt käytti kuitin yhteistä kategoriaa, vaikka
--    rivit olivat eri luokissa: ruoka, pesuaine ja pakkaukset samalta
--    tukkukuitilta menivät kaikki samalle kulutilille. Kulut näyttivät
--    Katessa oikein (rivikohtaisesti) mutta kirjanpidossa väärin.
--
-- 2. Rivien muutos ei päivittänyt esitystä.
--    Laukaisin oli vain receipts-taulussa. Kuitti tallennetaan ensin ja
--    rivit sen jälkeen, joten esitys laskettiin ilman rivejä, eikä rivin
--    kategorian korjaus näkynyt kirjanpidossa koskaan.
--
-- 3. Poistettu kuitti jätti esityksensä.
--    Poistolle ei ollut laukaisinta: kirjausesitys jäi tositteeksi jonka
--    lähdettä ei ole. Kirjatun tositteen kuitin sai myös poistaa, jolloin
--    kirjanpitoon jäi tosite ilman tositeaineistoa.
--
-- KORJAUS.
--
-- - Esitys jaetaan rivien kategorioihin. Verottomat osuudet lasketaan
--   riveiltä (rivin ALV tai kanta), ja pyöristysero kohdistetaan
--   suurimmalle riville, jotta kulut + ALV = maksettu täsmälleen. Jos
--   rivejä ei ole tai niiden summa ei täsmää kuittiin, käytetään kuitin
--   kategoriaa kuten ennenkin.
-- - Saman tilin rivit yhdistetään.
-- - Uudelleen laskettu esitys pitää tositenumeronsa.
-- - receipt_items-laukaisimet laskevat esityksen uudelleen kerran
--   lausetta kohden (ei kerran riviä kohden).
-- - Kuitin poisto poistaa esityksen. Kirjatun tositteen kuittia ei voi
--   poistaa: korjaus tehdään korjaustositteella. Poikkeus on koko
--   yrityksen poisto (restaurant_exists, 0101).

create or replace function public.ledger_ensure_receipt(p_receipt uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_r record;
  v_year uuid; v_entry uuid; v_rivi integer;
  v_alvtili uuid; v_maksutili uuid; v_oletustili uuid;
  v_netto integer;
  v_old_number integer; v_old_year uuid;
  v_items_total bigint; v_items_count integer;
  v_split jsonb;
  v_sum_net bigint; v_diff integer;
  v_line record;
begin
  -- Aiempi esitys talteen: numero säilyy uudelleenlaskennassa.
  select entry_number, fiscal_year_id into v_old_number, v_old_year
  from ledger_entries
  where source_type = 'receipt' and source_id = p_receipt and status = 'proposed'
  limit 1;

  select rc.id, rc.restaurant_id, rc.receipt_date, rc.supplier_name, rc.total_cents,
         coalesce(rc.vat_cents, 0) as vat_cents,
         rc.category::text as category, rc.payment_method::text as payment_method,
         rc.status::text as status
    into v_r
  from receipts rc where rc.id = p_receipt;

  -- Kuitti poistettu: esitys lähtee sen mukana.
  if v_r.id is null then
    delete from ledger_entries
     where source_type = 'receipt' and source_id = p_receipt and status = 'proposed';
    return;
  end if;

  -- Kirjattuun ei kosketa. Muutos vaatii korjaustositteen.
  if exists (select 1 from ledger_entries
             where source_type = 'receipt' and source_id = p_receipt
               and status <> 'proposed') then
    return;
  end if;

  delete from ledger_entries
   where source_type = 'receipt' and source_id = p_receipt and status = 'proposed';

  if v_r.status <> 'confirmed' then return; end if;

  if exists (select 1 from closed_months
             where restaurant_id = v_r.restaurant_id
               and month = date_trunc('month', v_r.receipt_date)::date) then
    return;
  end if;

  select account_id into v_maksutili from ledger_mappings
   where restaurant_id = v_r.restaurant_id and kind = 'payment_method' and ref_key = v_r.payment_method;
  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = v_r.restaurant_id and kind = 'vat_purchases' limit 1;
  select account_id into v_oletustili from ledger_mappings
   where restaurant_id = v_r.restaurant_id and kind = 'expense_category' and ref_key = 'other';

  if v_maksutili is null or v_alvtili is null then return; end if;

  v_netto := v_r.total_cents - v_r.vat_cents;

  -- Verottomat osuudet tileittäin riveiltä.
  select coalesce(sum(i.total_cents), 0), count(*)
    into v_items_total, v_items_count
  from receipt_items i where i.receipt_id = p_receipt;

  if v_items_count > 0 and v_items_total = v_r.total_cents then
    select jsonb_agg(jsonb_build_object('account', account_id, 'net', net) order by net desc)
      into v_split
    from (
      select coalesce(m.account_id, v_oletustili) as account_id,
             sum(
               i.total_cents - coalesce(
                 i.vat_cents,
                 case when coalesce(i.vat_rate, 0) > 0
                      then round(i.total_cents * i.vat_rate / (1 + i.vat_rate))::integer
                      else 0 end
               )
             )::bigint as net
      from receipt_items i
      left join ledger_mappings m
        on m.restaurant_id = v_r.restaurant_id
       and m.kind = 'expense_category'
       and m.ref_key = i.category::text
      where i.receipt_id = p_receipt
      group by 1
    ) t
    where account_id is not null;
  end if;

  -- Ei rivejä tai ne eivät täsmää: kuitin oma kategoria.
  if v_split is null or jsonb_array_length(v_split) = 0 then
    select jsonb_build_array(jsonb_build_object('account', coalesce(m.account_id, v_oletustili), 'net', v_netto))
      into v_split
    from (select 1) x
    left join ledger_mappings m
      on m.restaurant_id = v_r.restaurant_id and m.kind = 'expense_category' and m.ref_key = v_r.category;
  end if;

  if (v_split -> 0 ->> 'account') is null then return; end if;

  -- Pyöristysero suurimmalle riville: kulut + ALV = maksettu.
  select coalesce(sum((e ->> 'net')::bigint), 0) into v_sum_net
  from jsonb_array_elements(v_split) e;
  v_diff := v_netto - v_sum_net;
  v_split := jsonb_set(v_split, '{0,net}', to_jsonb((v_split -> 0 ->> 'net')::bigint + v_diff));

  v_year := ledger_year_for(v_r.restaurant_id, v_r.receipt_date);

  insert into ledger_entries (restaurant_id, fiscal_year_id, entry_number, entry_date,
    description, source_type, source_id, created_by)
  values (
    v_r.restaurant_id, v_year,
    case when v_old_year = v_year and v_old_number is not null
         then v_old_number else ledger_next_number(v_year) end,
    v_r.receipt_date, v_r.supplier_name, 'receipt', p_receipt, auth.uid())
  returning id into v_entry;

  v_rivi := 1;
  for v_line in
    select (e ->> 'account')::uuid as account_id, (e ->> 'net')::integer as net
    from jsonb_array_elements(v_split) e
  loop
    if v_line.net <> 0 then
      insert into ledger_lines (entry_id, line_number, account_id, debit_cents, credit_cents, description)
      values (v_entry, v_rivi, v_line.account_id,
              greatest(v_line.net, 0), greatest(-v_line.net, 0), 'Veroton');
      v_rivi := v_rivi + 1;
    end if;
  end loop;

  if v_r.vat_cents > 0 then
    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, vat_cents, description)
    values (v_entry, v_rivi, v_alvtili, v_r.vat_cents, v_r.vat_cents, 'Vähennettävä ALV');
    v_rivi := v_rivi + 1;
  end if;

  insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
  values (v_entry, v_rivi, v_maksutili, v_r.total_cents, 'Maksettu');
end;
$function$;

-- Rivien muutos laskee esityksen uudelleen, kerran kuittia kohden.
-- Transitiotaulut vaativat yhden tapahtuman laukaisinta kohden, joten
-- lisäys, muutos ja poisto ovat omia laukaisimiaan. Virhe ei kaada
-- tallennusta: kuukauden tila kertoo puuttuvasta esityksestä.
create or replace function public.ledger_receipt_items_inserted()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  for v_id in select distinct receipt_id from new_rows loop
    begin perform ledger_ensure_receipt(v_id); exception when others then null; end;
  end loop;
  return null;
end;
$function$;

create or replace function public.ledger_receipt_items_deleted()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  for v_id in select distinct receipt_id from old_rows loop
    begin perform ledger_ensure_receipt(v_id); exception when others then null; end;
  end loop;
  return null;
end;
$function$;

create or replace function public.ledger_receipt_items_updated()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  for v_id in
    select receipt_id from new_rows union select receipt_id from old_rows
  loop
    begin perform ledger_ensure_receipt(v_id); exception when others then null; end;
  end loop;
  return null;
end;
$function$;

drop trigger if exists receipt_items_ledger_ins on receipt_items;
create trigger receipt_items_ledger_ins
  after insert on receipt_items
  referencing new table as new_rows
  for each statement execute function public.ledger_receipt_items_inserted();

drop trigger if exists receipt_items_ledger_upd on receipt_items;
create trigger receipt_items_ledger_upd
  after update on receipt_items
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.ledger_receipt_items_updated();

drop trigger if exists receipt_items_ledger_del on receipt_items;
create trigger receipt_items_ledger_del
  after delete on receipt_items
  referencing old table as old_rows
  for each statement execute function public.ledger_receipt_items_deleted();

-- Kuitin poisto: kirjattua ei poisteta, esitys siivotaan.
create or replace function public.ledger_receipt_deleted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_when = 'BEFORE' then
    if restaurant_exists(old.restaurant_id) and exists (
      select 1 from ledger_entries
      where source_type = 'receipt' and source_id = old.id and status = 'posted'
    ) then
      raise exception 'Kuitti on kirjattu kirjanpitoon. Korjaa se korjaustositteella.';
    end if;
    return old;
  end if;

  delete from ledger_entries
   where source_type = 'receipt' and source_id = old.id and status = 'proposed';
  return old;
end;
$function$;

drop trigger if exists receipts_ledger_guard on receipts;
create trigger receipts_ledger_guard
  before delete on receipts
  for each row execute function public.ledger_receipt_deleted();

drop trigger if exists receipts_ledger_cleanup on receipts;
create trigger receipts_ledger_cleanup
  after delete on receipts
  for each row execute function public.ledger_receipt_deleted();
