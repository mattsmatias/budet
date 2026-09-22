-- 0103 — Tyhjennys tyhjentää koko Matin historian yrityksessä
--
-- VIRHE.
--
-- Tyhjennys poisti vain avoimen keskustelun. Matti tallentaa jokaisen
-- keskustelun erikseen, joten seuraavalla avauksella näkyviin nousi
-- edellinen — syyskuun alun vastaus avoimesta leimauksesta, vaikka
-- leimaukset oli poistettu Katesta kokonaan. Yrittäjä tyhjensi
-- keskustelun ja sai vanhan tilalle.
--
-- KORJAUS.
--
-- ai_clear_history poistaa käyttäjän kaikki Matti-keskustelut tässä
-- yrityksessä. Vain omat (user_id = auth.uid()) ja vain yrityksessä
-- johon käyttäjä kuuluu. Yritys tulee palvelimen istunnosta, ei
-- selaimelta.

create or replace function public.ai_clear_history(p_restaurant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän yritykseen';
  end if;

  delete from ai_conversations
  where restaurant_id = p_restaurant and user_id = auth.uid();
end;
$$;

revoke all on function public.ai_clear_history(uuid) from public;
grant execute on function public.ai_clear_history(uuid) to authenticated;
