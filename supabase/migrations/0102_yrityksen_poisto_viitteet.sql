-- 0102 — Yrityksen poisto kirjanpitoineen
--
-- VIRHE.
--
-- Kun 0101 korjasi lokin, yritys jolla on kirjanpitoa kaatui seuraavaan:
--   update or delete on table "ledger_accounts" violates foreign key
--   constraint "ledger_lines_account_id_fkey"
--
-- Yrityksen poisto poistaa kaskadina sekä tilikartan että tositteet
-- riveineen, mutta järjestystä ei voi valita: tili ehtii poistua ennen
-- sitä riviä joka siihen viittaa. ON DELETE RESTRICT tarkistetaan heti,
-- eikä sitä voi lykätä.
--
-- KORJAUS.
--
-- Nämä viiteavaimet muutetaan RESTRICT → NO ACTION DEFERRABLE INITIALLY
-- IMMEDIATE. Tavallisessa käytössä ne suojaavat täsmälleen samoin: tiliä,
-- tilikautta, myyntiryhmää tai tositetta johon viitataan ei voi poistaa,
-- ja tarkistus tehdään saman lauseen lopussa. Vain sa_delete_restaurant
-- lykkää ne transaktion loppuun, jolloin kaikki yrityksen rivit ovat jo
-- poistuneet ja tarkistus menee läpi. Suojia ei ohiteta — viittaus
-- tarkistetaan edelleen, vain myöhemmin.

alter table ledger_lines drop constraint ledger_lines_account_id_fkey;
alter table ledger_lines add constraint ledger_lines_account_id_fkey
  foreign key (account_id) references ledger_accounts (id)
  deferrable initially immediate;

alter table ledger_entries drop constraint ledger_entries_fiscal_year_id_fkey;
alter table ledger_entries add constraint ledger_entries_fiscal_year_id_fkey
  foreign key (fiscal_year_id) references fiscal_years (id)
  deferrable initially immediate;

alter table ledger_entries drop constraint ledger_entries_corrects_id_fkey;
alter table ledger_entries add constraint ledger_entries_corrects_id_fkey
  foreign key (corrects_id) references ledger_entries (id)
  deferrable initially immediate;

alter table daily_sales_lines drop constraint daily_sales_lines_sales_group_id_fkey;
alter table daily_sales_lines add constraint daily_sales_lines_sales_group_id_fkey
  foreign key (sales_group_id) references sales_groups (id)
  deferrable initially immediate;

alter table export_items drop constraint export_items_document_id_fkey;
alter table export_items add constraint export_items_document_id_fkey
  foreign key (document_id) references documents (id)
  deferrable initially immediate;

alter table export_items drop constraint export_items_tax_decision_id_fkey;
alter table export_items add constraint export_items_tax_decision_id_fkey
  foreign key (tax_decision_id) references tax_decisions (id)
  deferrable initially immediate;

create or replace function public.sa_delete_restaurant(p_id uuid, p_confirm text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_snapshot jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain järjestelmän ylläpitäjä';
  end if;

  select name into v_name from restaurants where id = p_id;
  if v_name is null then
    raise exception 'Yritystä ei löydy';
  end if;

  if trim(coalesce(p_confirm, '')) <> v_name then
    raise exception 'Vahvistus ei täsmää yrityksen nimeen';
  end if;

  select jsonb_build_object(
    'name', v_name,
    'users',    (select count(*) from memberships where restaurant_id = p_id),
    'receipts', (select count(*) from receipts where restaurant_id = p_id),
    'tasks',    (select count(*) from tasks where restaurant_id = p_id)
  ) into v_snapshot;

  -- Loki ensin: rivi ei saa kadota poiston mukana.
  perform sa_log(
    'restaurant.deleted',
    'Yritys poistettiin pysyvästi: ' || v_name,
    'restaurant', p_id, v_name, v_snapshot, null, true
  );

  -- Kaskadin järjestystä ei voi valita: viittaukset tarkistetaan vasta
  -- kun kaikki yrityksen rivit ovat poistuneet (ks. 0102).
  set constraints
    ledger_lines_account_id_fkey,
    ledger_entries_fiscal_year_id_fkey,
    ledger_entries_corrects_id_fkey,
    daily_sales_lines_sales_group_id_fkey,
    export_items_document_id_fkey,
    export_items_tax_decision_id_fkey
  deferred;

  delete from restaurants where id = p_id;
end;
$function$;
