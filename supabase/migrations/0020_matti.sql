-- ---------------------------------------------------------------------------
-- 0020 — Matti, BUDetin AI-työkaveri
-- ---------------------------------------------------------------------------
--
-- Kolme taulua ja yksi periaate.
--
-- PERIAATE: mallin tuotos ei voi muuttaa dataa.
--
-- Kirjoittavat työkalut eivät kirjoita. Ne tallentavat ehdotuksen
-- ai_pending_actions-tauluun ja palauttavat esikatselun. Vasta kun
-- ihminen hyväksyy sen käyttöliittymässä, palvelin lukee ehdotuksen
-- KANNASTA — ei selaimen lähettämästä pyynnöstä — tarkistaa oikeudet
-- uudelleen ja suorittaa toiminnon olemassa olevalla funktiolla.
--
-- Tämä ei ole varotoimi vaan rakenne. Jos malli harhautetaan kuittiin
-- piilotetulla tekstillä, se saa aikaan korkeintaan ehdotuksen jonka
-- käyttäjä näkee ja hylkää. Kehotusinjektio ei voi ohittaa ihmistä,
-- koska mallilla ei ole reittiä kantaan.
--
-- Matti käyttää käyttäjän omaa istuntoa, ei palveluavainta. Sama RLS
-- joka suojaa käyttöliittymää suojaa Mattia: toisen ravintolan dataa
-- ei ole olemassa hänelle sen paremmin kuin käyttäjällekään.

-- ---------------------------------------------------------------------------
-- 1. Keskustelut
-- ---------------------------------------------------------------------------

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,

  /** Lyhyt otsikko listaa varten. Ensimmäisestä viestistä. */
  title text not null default 'Uusi keskustelu',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on ai_conversations (user_id, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_role') then
    create type ai_role as enum ('user', 'assistant');
  end if;
end;
$$;

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,

  role ai_role not null,
  content text not null default '',

  /**
   * Työkalukutsut ja niiden tulokset.
   *
   * Tallennetaan jotta keskustelun voi jatkaa uudelleen ladattuna ja
   * jotta jälkikäteen näkee mihin dataan vastaus perustui. Ilman tätä
   * "Matti sanoi 8 240 €" olisi väite jota ei voi tarkistaa.
   */
  tool_calls jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Ehdotetut muutokset
-- ---------------------------------------------------------------------------
--
-- Ehdotus tallennetaan palvelimella. Selain saa vain tunnisteen.
--
-- Jos argumentit kulkisivat selaimen kautta takaisin, hyväksyntä olisi
-- vain muodollisuus: kuka tahansa voisi vaihtaa summan hyväksynnän ja
-- suorituksen välissä. Nyt hyväksyntä viittaa siihen mitä käyttäjälle
-- näytettiin, eikä muuhun.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type ai_action_status as enum ('pending', 'confirmed', 'cancelled', 'failed');
  end if;
end;
$$;

create table if not exists ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,

  /** Työkalun nimi. Palvelin ratkaisee tästä mitä suoritetaan. */
  tool text not null,

  /** Työkalun argumentit sellaisina kuin ne validoitiin. */
  arguments jsonb not null,

  /** Mitä käyttäjälle näytettiin. Auditointia varten. */
  preview jsonb not null,

  status ai_action_status not null default 'pending',

  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ai_pending_actions_conversation_idx
  on ai_pending_actions (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Audit
-- ---------------------------------------------------------------------------
--
-- Jokaisesta suoritetusta muutoksesta jää jälki. Ei siksi että jotain
-- odotettaisiin menevän pieleen, vaan siksi että "Matti muutti hinnan"
-- on tarkistettavissa vain jos ennen ja jälkeen on tallessa.

create table if not exists ai_audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete set null,
  conversation_id uuid references ai_conversations (id) on delete set null,

  tool text not null,
  arguments jsonb not null default '{}'::jsonb,

  /** Kohteen tunniste, esim. lounaspäivän id. */
  target text,

  before_value jsonb,
  after_value jsonb,

  /** Vahvistiko ihminen. Kirjoittavissa aina tosi. */
  confirmed boolean not null default false,

  success boolean not null,
  error text,

  created_at timestamptz not null default now()
);

create index if not exists ai_audit_log_restaurant_idx
  on ai_audit_log (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Pääsy
-- ---------------------------------------------------------------------------
--
-- Keskustelu on henkilökohtainen: se voi sisältää käyttäjän omia
-- kysymyksiä eikä kuulu muille saman ravintolan jäsenille. Auditloki
-- sen sijaan koskee ravintolaa, ja esihenkilön on voitava lukea se.

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_pending_actions enable row level security;
alter table ai_audit_log enable row level security;

drop policy if exists ai_conversations_own on ai_conversations;
create policy ai_conversations_own on ai_conversations
  for select to authenticated
  using (user_id = auth.uid() and restaurant_id in (select my_restaurant_ids()));

drop policy if exists ai_messages_own on ai_messages;
create policy ai_messages_own on ai_messages
  for select to authenticated
  using (
    conversation_id in (
      select id from ai_conversations where user_id = auth.uid()
    )
  );

drop policy if exists ai_pending_actions_own on ai_pending_actions;
create policy ai_pending_actions_own on ai_pending_actions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_audit_log_read on ai_audit_log;
create policy ai_audit_log_read on ai_audit_log
  for select to authenticated
  using (is_manager(restaurant_id));

-- Kirjoitusoikeutta ei anneta kenellekään. Kaikki kirjoitukset kulkevat
-- alla olevien funktioiden kautta, jotta niitä ei voi tehdä ohi
-- tarkistusten.

-- ---------------------------------------------------------------------------
-- 5. Funktiot
-- ---------------------------------------------------------------------------

/** Avaa tai jatkaa keskustelua. */
create or replace function ai_open_conversation(
  p_restaurant uuid,
  p_conversation uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  if p_conversation is not null then
    select id into v_id from ai_conversations
    where id = p_conversation and user_id = auth.uid();

    if v_id is not null then
      update ai_conversations set updated_at = now() where id = v_id;
      return v_id;
    end if;
  end if;

  insert into ai_conversations (restaurant_id, user_id)
  values (p_restaurant, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function ai_open_conversation from public;
grant execute on function ai_open_conversation to authenticated;

/** Tallentaa viestin. Vain oman keskustelun. */
create or replace function ai_add_message(
  p_conversation uuid,
  p_role ai_role,
  p_content text,
  p_tool_calls jsonb default '[]'::jsonb
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

  insert into ai_messages (conversation_id, role, content, tool_calls)
  values (p_conversation, p_role, coalesce(p_content, ''), coalesce(p_tool_calls, '[]'::jsonb))
  returning id into v_id;

  -- Otsikko ensimmäisestä käyttäjän viestistä. Keskustelulista ilman
  -- otsikoita on rivi tunnisteita.
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

revoke all on function ai_add_message from public;
grant execute on function ai_add_message to authenticated;

/** Tallentaa ehdotetun muutoksen odottamaan hyväksyntää. */
create or replace function ai_propose_action(
  p_conversation uuid,
  p_tool text,
  p_arguments jsonb,
  p_preview jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_id uuid;
begin
  select restaurant_id into v_restaurant from ai_conversations
  where id = p_conversation and user_id = auth.uid();

  if v_restaurant is null then
    raise exception 'Keskustelua ei löytynyt';
  end if;

  insert into ai_pending_actions
    (conversation_id, restaurant_id, user_id, tool, arguments, preview)
  values
    (p_conversation, v_restaurant, auth.uid(), p_tool, p_arguments, p_preview)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function ai_propose_action from public;
grant execute on function ai_propose_action to authenticated;

/**
 * Merkitsee ehdotuksen ratkaistuksi.
 *
 * Palauttaa ehdotuksen rivin vain jos se oli vielä odottamassa. Näin
 * sama hyväksyntä ei voi suorittaa toimintoa kahdesti: toinen kutsu
 * ei saa riviä eikä siis tee mitään.
 */
create or replace function ai_resolve_action(
  p_action uuid,
  p_status ai_action_status
)
returns ai_pending_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ai_pending_actions;
begin
  update ai_pending_actions
  set status = p_status, resolved_at = now()
  where id = p_action
    and user_id = auth.uid()
    and status = 'pending'
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function ai_resolve_action from public;
grant execute on function ai_resolve_action to authenticated;

/** Kirjaa suoritetun toiminnon. */
create or replace function ai_log_action(
  p_restaurant uuid,
  p_conversation uuid,
  p_tool text,
  p_arguments jsonb,
  p_target text,
  p_before jsonb,
  p_after jsonb,
  p_confirmed boolean,
  p_success boolean,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  insert into ai_audit_log (
    restaurant_id, user_id, conversation_id, tool, arguments, target,
    before_value, after_value, confirmed, success, error
  )
  values (
    p_restaurant, auth.uid(), p_conversation, p_tool,
    coalesce(p_arguments, '{}'::jsonb), p_target,
    p_before, p_after, p_confirmed, p_success, p_error
  );
end;
$$;

revoke all on function ai_log_action from public;
grant execute on function ai_log_action to authenticated;
