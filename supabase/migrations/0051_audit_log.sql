-- ---------------------------------------------------------------------------
-- 0051 — Toimintaloki
-- ---------------------------------------------------------------------------
--
-- Kun myöhemmin kysytään "kuka muutti tämän ja mikä se oli ennen",
-- Budetin on pystyttävä vastaamaan. Palkkatieto, työaikakorjaus,
-- verokanta ja käyttöoikeus ovat asioita joissa muistikuva ei riitä.
--
-- ---------------------------------------------------------------------------
-- Miksi oma taulu eikä audit_events
-- ---------------------------------------------------------------------------
--
-- Kannassa on jo audit_events, mutta se kuuluu toiselle sovellukselle:
-- sen org_id on vierasavain organizations-tauluun ja user_id
-- profiles-tauluun. Budetin vuokralainen on ravintola, eikä ravintolan
-- tunnistetta voi kirjoittaa sarakkeeseen joka viittaa organisaatioon.
-- Saman taulun jakaminen vaatisi toisen sovelluksen rivikäytäntöjen
-- muuttamista, eikä sitä voi tehdä testaamatta sitä sovellusta.
--
-- ---------------------------------------------------------------------------
-- Loki on liittymätön kohteestaan
-- ---------------------------------------------------------------------------
--
-- entity_id on pelkkä uuid ilman vierasavainta, ja tekijän nimi
-- tallennetaan tekstinä. Syy on se että loki on todiste tapahtumasta:
-- se ei saa kadota kun kohde poistetaan. Vierasavain joko estäisi
-- poiston tai veisi lokirivin mukanaan — kummassakin tapauksessa
-- "kuka poisti työntekijän" jäisi vastaamatta.

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /*
   * Tekijä sekä viitteenä että nimenä.
   *
   * Viite katkeaa jos käyttäjä poistetaan; nimi jää. Loki jonka
   * tekijää ei voi enää tunnistaa ei ole todiste mistään.
   */
  actor_id uuid references profiles (id) on delete set null,
  actor_name text not null default 'Tuntematon',
  actor_role text,

  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_name text,

  /* Yksi lause suomeksi. Lista luetaan tästä, ei JSON-kentistä. */
  summary text not null,

  /*
   * Muuttuneet kentät, ei koko riviä.
   *
   * Koko rivin tallentaminen veisi lokiin myös sellaista mitä siellä
   * ei tarvita, ja osa siitä on arkaluontoista. Vain se mikä muuttui.
   */
  before_data jsonb,
  after_data jsonb,

  /*
   * Kriittinen tapahtuma nostetaan omaksi ryhmäkseen.
   *
   * Palkka, käyttöoikeus, työaikakorjaus ja verokanta ovat niitä
   * joiden takia lokia luetaan. Ilman merkintää ne hukkuvat
   * tavallisten muutosten sekaan.
   */
  critical boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists audit_log_lookup
  on audit_log (restaurant_id, created_at desc);
create index if not exists audit_log_entity
  on audit_log (restaurant_id, entity_type, entity_id);
create index if not exists audit_log_actor
  on audit_log (restaurant_id, actor_id);

-- ---------------------------------------------------------------------------
-- Loki on vain luettava ja vain omistajalle
-- ---------------------------------------------------------------------------
--
-- LISÄYSKÄYTÄNTÖÄ EI OLE, EIKÄ MUUTOS- TAI POISTOKÄYTÄNTÖÄ.
--
-- Rivikäytäntö joka puuttuu tarkoittaa että toiminto on kielletty.
-- Kirjaukset syntyvät liipaisimista ja security definer -funktioista,
-- jotka ajetaan taulun omistajan oikeuksin — käyttäjä ei voi
-- kirjoittaa lokiin suoraan, eikä siis myöskään väärentää tekijää.
--
-- Loki sisältää palkkamuutokset ja asetukset, joten se on omistajan
-- näkymä. Vuoropäällikkö näkee oman työnsä jäljet kohteiden omista
-- näkymistä.

alter table audit_log enable row level security;

drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log
  for select to authenticated
  using (is_owner(restaurant_id));

revoke insert, update, delete on audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Kirjaus
-- ---------------------------------------------------------------------------
--
-- Tekijä luetaan istunnosta eikä parametrista. Parametrina se olisi
-- kutsujan kerrottavissa, ja loki jonka tekijän voi valita itse ei ole
-- todiste.

create or replace function write_audit(
  p_restaurant uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_name text,
  p_summary text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_critical boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_role text;
begin
  if p_restaurant is null then return; end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name
  from profiles p
  where p.id = v_actor;

  select m.role::text into v_role
  from memberships m
  where m.restaurant_id = p_restaurant and m.user_id = v_actor;

  insert into audit_log (
    restaurant_id, actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_name, summary,
    before_data, after_data, critical
  )
  values (
    p_restaurant, v_actor, coalesce(v_name, 'Järjestelmä'), v_role,
    p_action, p_entity_type, p_entity_id, p_entity_name, p_summary,
    p_before, p_after, p_critical
  );
end;
$$;

revoke all on function write_audit from public;
