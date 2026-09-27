-- Myyntipäivän poisto ja kirjanpito.
--
-- KUITILLA OLI TÄMÄ, MYYNTIPÄIVÄLLÄ EI.
--
-- Kuitin poisto on aina siivonnut kirjausesityksen ja estänyt poiston
-- jos kuitti on jo kirjattu. Myyntipäivällä ei ollut kumpaakaan: rivin
-- poisto jätti esityksen roikkumaan lähteeseen jota ei enää ole, ja
-- kuukauden sulkeminen olisi kirjannut myyntiä päivältä joka oli
-- poistettu. Suljetun kuukauden päivän sai poistaa lukosta huolimatta.
--
-- SAMA KUVIO KUIN KUITILLA.
--
-- BEFORE estää poiston jos päivä on jo kirjattu — kirjattua korjataan
-- korjaustositteella, ei poistamalla. AFTER siivoaa esityksen.

create or replace function ledger_sales_day_deleted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_when = 'BEFORE' then
    if restaurant_exists(old.restaurant_id) and exists (
      select 1 from ledger_entries
       where source_type = 'daily_sales'
         and source_id = old.id
         and status = 'posted'
    ) then
      raise exception 'Päivä on kirjattu kirjanpitoon. Korjaa se korjaustositteella.';
    end if;
    return old;
  end if;

  delete from ledger_entries
   where source_type = 'daily_sales'
     and source_id = old.id
     and status = 'proposed';
  return old;
end;
$$;

revoke execute on function ledger_sales_day_deleted() from public, anon;

drop trigger if exists daily_sales_ledger_guard on daily_sales;
create trigger daily_sales_ledger_guard
  before delete on daily_sales
  for each row execute function ledger_sales_day_deleted();

drop trigger if exists daily_sales_ledger_cleanup on daily_sales;
create trigger daily_sales_ledger_cleanup
  after delete on daily_sales
  for each row execute function ledger_sales_day_deleted();

-- Jo syntyneet orvot esitykset pois: lähdettä ei ole, joten esitys ei
-- voi enää tarkoittaa mitään.
delete from ledger_entries e
 where e.source_type = 'daily_sales'
   and e.status = 'proposed'
   and not exists (select 1 from daily_sales d where d.id = e.source_id);
