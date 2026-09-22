-- 0100 — Matti muistaa edellisen keskustelun
--
-- KESKUSTELU SÄILYY KUNNES YRITTÄJÄ ITSE TYHJENTÄÄ SEN.
--
-- Viestit tallentuivat jo ai_messages-tauluun, mutta paneeli aloitti
-- joka kerta tyhjästä: eilinen kysymys ja vastaus katosivat näkyvistä
-- heti kun paneelin sulki. Nyt paneeli lataa viimeisimmän keskustelun,
-- ja yrittäjä voi tyhjentää sen itse.
--
-- 1. Kortit tallennetaan viestin mukana, jotta uudelleen avattu
--    vastaus näyttää samalta kuin silloin kun se annettiin. Kortti on
--    jo muotoiltu esitys työkalun tuloksesta, ei raakaa dataa.
--
-- 2. ai_clear_conversation poistaa keskustelun kokonaan (viestit ja
--    odottavat ehdotukset kaskadina). Vain oman keskustelun: sama
--    user_id = auth.uid() -ehto kuin kaikissa Matin funktioissa.
--    Audit-lokin rivit jäävät, conversation_id nollautuu (on delete set
--    null) — loki kertoo mitä tehtiin, ei sitä mitä keskusteltiin.

alter table ai_messages
  add column if not exists cards jsonb not null default '[]'::jsonb;

-- Uusi allekirjoitus korttiparametrilla. Vanha pudotetaan, jotta
-- nimetyt neljän parametrin kutsut eivät ole kaksiselitteisiä.
drop function if exists ai_add_message(uuid, ai_role, text, jsonb);

create or replace function ai_add_message(
  p_conversation uuid,
  p_role ai_role,
  p_content text,
  p_tool_calls jsonb default '[]'::jsonb,
  p_cards jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from ai_conversations
    where id = p_conversation and user_id = auth.uid()
  ) then
    raise exception 'Keskustelua ei löytynyt';
  end if;

  insert into ai_messages (conversation_id, role, content, tool_calls, cards)
  values (
    p_conversation,
    p_role,
    coalesce(p_content, ''),
    coalesce(p_tool_calls, '[]'::jsonb),
    coalesce(p_cards, '[]'::jsonb)
  )
  returning id into v_id;

  -- Otsikko ensimmäisestä käyttäjän viestistä.
  update ai_conversations c
  set updated_at = now(),
      title = case
        when c.title = 'Uusi keskustelu' and p_role = 'user'
          then left(regexp_replace(coalesce(p_content, ''), E'\\s+', ' ', 'g'), 60)
        else c.title
      end
  where c.id = p_conversation;

  return v_id;
end;
$$;

revoke all on function ai_add_message(uuid, ai_role, text, jsonb, jsonb) from public;
grant execute on function ai_add_message(uuid, ai_role, text, jsonb, jsonb) to authenticated;

create or replace function ai_clear_conversation(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from ai_conversations
  where id = p_conversation and user_id = auth.uid();
end;
$$;

revoke all on function ai_clear_conversation(uuid) from public;
grant execute on function ai_clear_conversation(uuid) to authenticated;
