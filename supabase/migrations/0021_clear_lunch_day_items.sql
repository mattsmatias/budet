-- ---------------------------------------------------------------------------
-- 0021 — Päivän ruokien tyhjennys
-- ---------------------------------------------------------------------------
--
-- Tarvitaan kun lounaslista korvataan uudella. Vaihtoehto olisi poistaa
-- rivit yksitellen sovelluksesta käsin, mutta silloin puolittain
-- epäonnistunut korvaus jättäisi päivän tilaan jota kukaan ei pyytänyt:
-- osa vanhoista ruoista poistettuna, uusia ei vielä lisätty.
--
-- Hintoja ei kosketa. Ruokien vaihtaminen ei ole syy nollata hintaa, ja
-- hinnan katoaminen huomaamatta olisi pahempi virhe kuin väärä
-- ruokalista — se näkyy asiakkaalle ovessa.

create or replace function clear_lunch_day_items(p_day uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_day_restaurant(p_day);

  if v_restaurant is null then
    raise exception 'Päivää ei löytynyt';
  end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  delete from lunch_items where lunch_day_id = p_day;
end;
$$;

revoke all on function clear_lunch_day_items from public;
grant execute on function clear_lunch_day_items to authenticated;
