-- 0136 Paiva kirjataan myos pelkalla ALV-erittelylla
--
-- Kirjaus vaati myyntiryhmarivit. Kuvatusta paivaraportista tullut
-- paiva sai ALV-erittelyn mutta ei aina riveja — silloin kun kassan
-- ryhmanimia ei tunnistettu Katen myyntiryhmiksi. Paiva jai
-- kirjanpidon ulkopuolelle eika kuukautta voinut sulkea, vaikka
-- kaikki tarvittava oli tallessa: verokanta, veroton ja vero.
--
-- Loytyi Ravintola Demon elokuusta: kaksi paivaa jumitti kuukauden,
-- toinen kasin kirjattuna ja toinen raportista kuvattuna. Sama vika,
-- kaksi eri reittia.
--
-- Nyt rivit kaytetaan jos ne ovat, ja muuten erittely. Myyntitili
-- haetaan kannan mukaan: se aktiivinen myyntiryhma jolla on sama
-- kanta, ensisijaisesti oletusryhma. Jos sellaista ei ole, kirjaus
-- menee myyntitilille 3000 — sama varatie kuin riveilla ennestaan.

create or replace function public.ledger_ensure_sales_day(p_day uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_d record; v_line record;
  v_year uuid; v_entry uuid; v_rivi integer;
  v_alvtili uuid; v_myyntitili uuid; v_kassatili uuid; v_pyoristys uuid;
  v_summa bigint; v_vero bigint; v_jaannos bigint;
begin
  select ds.id, ds.restaurant_id, ds.sales_date, ds.gross_sales_cents
    into v_d
  from daily_sales ds where ds.id = p_day;

  if v_d.id is null then return; end if;

  if exists (select 1 from ledger_entries
             where source_type = 'daily_sales' and source_id = p_day
               and status <> 'proposed') then
    return;
  end if;

  delete from ledger_entries
   where source_type = 'daily_sales' and source_id = p_day and status = 'proposed';

  if v_d.gross_sales_cents is null then return; end if;

  if not exists (select 1 from daily_sales_lines where daily_sales_id = p_day)
     and not exists (select 1 from daily_sales_vat where daily_sales_id = p_day) then
    return;
  end if;

  if exists (select 1 from closed_months
             where restaurant_id = v_d.restaurant_id
               and month = date_trunc('month', v_d.sales_date)::date) then
    return;
  end if;

  select id into v_kassatili from ledger_accounts
   where restaurant_id = v_d.restaurant_id and number = '1750';
  select id into v_pyoristys from ledger_accounts
   where restaurant_id = v_d.restaurant_id and number = '3900';
  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = v_d.restaurant_id and kind = 'vat_sales' limit 1;

  if v_kassatili is null or v_alvtili is null or v_pyoristys is null then return; end if;

  v_year := ledger_year_for(v_d.restaurant_id, v_d.sales_date);

  insert into ledger_entries (restaurant_id, fiscal_year_id, entry_number, entry_date,
    description, source_type, source_id, created_by)
  values (v_d.restaurant_id, v_year, ledger_next_number(v_year), v_d.sales_date,
    'Päivämyynti ' || to_char(v_d.sales_date, 'DD.MM.YYYY'),
    'daily_sales', p_day, auth.uid())
  returning id into v_entry;

  v_rivi := 1;
  v_summa := 0;

  insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
  values (v_entry, v_rivi, v_kassatili, v_d.gross_sales_cents, 'Päivän myynti');
  v_rivi := v_rivi + 1;

  for v_line in
    select l.sales_group_id, l.vat_rate, sum(l.net_cents)::integer as net_cents
    from daily_sales_lines l
    where l.daily_sales_id = p_day
    group by l.sales_group_id, l.vat_rate

    union all

    select (
             select g.id from sales_groups g
             where g.restaurant_id = v_d.restaurant_id
               and g.active
               and g.vat_rate = v.vat_rate
             order by g.is_default desc, g.sort_order
             limit 1
           ) as sales_group_id,
           v.vat_rate,
           sum(v.net_cents)::integer as net_cents
    from daily_sales_vat v
    where v.daily_sales_id = p_day
      and not exists (
        select 1 from daily_sales_lines l2 where l2.daily_sales_id = p_day
      )
    group by v.vat_rate
  loop
    v_myyntitili := null;

    if v_line.sales_group_id is not null then
      select account_id into v_myyntitili from ledger_mappings
       where restaurant_id = v_d.restaurant_id
         and kind = 'sales_group' and ref_id = v_line.sales_group_id;
    end if;

    if v_myyntitili is null then
      select id into v_myyntitili from ledger_accounts
       where restaurant_id = v_d.restaurant_id and number = '3000';
    end if;

    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, vat_rate, description)
    values (v_entry, v_rivi, v_myyntitili, v_line.net_cents, v_line.vat_rate, 'Myynti veroton');
    v_rivi := v_rivi + 1;
    v_summa := v_summa + v_line.net_cents;
  end loop;

  select coalesce(sum(vat_cents), 0) into v_vero
  from daily_sales_vat where daily_sales_id = p_day;

  if v_vero = 0 then
    select coalesce(sum(vat_cents), 0) into v_vero
    from daily_sales_lines where daily_sales_id = p_day;
  end if;

  if v_vero <> 0 then
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_alvtili, v_vero::integer, 'Myynnin ALV');
    v_rivi := v_rivi + 1;
  end if;

  v_jaannos := v_d.gross_sales_cents - v_summa - v_vero;

  if v_jaannos > 0 then
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_pyoristys, v_jaannos::integer, 'Pyöristys');
  elsif v_jaannos < 0 then
    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
    values (v_entry, v_rivi, v_pyoristys, (-v_jaannos)::integer, 'Pyöristys');
  end if;
end;
$function$;
