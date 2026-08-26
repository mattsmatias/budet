-- ---------------------------------------------------------------------------
-- 0055 — Super Adminin loki ja feature flagit
-- ---------------------------------------------------------------------------
--
-- OMA LOKI, EI RAVINTOLAN LOKIA.
--
-- audit_log on ravintolan oma: sen rivit näkyvät ravintolan omistajalle
-- ja ne on rajattu restaurant_id:llä. Ylläpitäjän toimet eivät kuulu
-- sinne kahdesta syystä. Ne koskevat usein useaa ravintolaa tai ei
-- yhtäkään, jolloin restaurant_id ei ole totta. Ja ravintolan omistajan
-- ei kuulu nähdä mitä toiselle ravintolalle on tehty.
--
-- Tämä loki on liitteetön: siihen vain lisätään. Päivitys- ja
-- poistokäytäntöjä ei ole, joten RLS hylkää ne kaikilta — myös
-- ylläpitäjältä itseltään. Loki jonka voi siivota ei ole loki.

create table if not exists super_admin_audit_log (
  id           uuid primary key default gen_random_uuid(),

  actor_id     uuid references auth.users(id) on delete set null,
  -- Nimi talteen kirjoitushetkellä: käyttäjä voidaan poistaa, ja
  -- silloin loki kertoisi vain tyhjän tunnisteen.
  actor_email  text,

  action       text not null,

  -- Kohde on vapaamuotoinen: ravintola, käyttäjä, lippu tai
  -- järjestelmäasetus. Vierasavainta ei ole, koska kohde voidaan
  -- poistaa eikä rivi saa kadota sen mukana.
  target_type  text,
  target_id    uuid,
  target_name  text,

  summary      text not null,
  before_data  jsonb,
  after_data   jsonb,

  -- Vaatiiko rivi huomiota jälkikäteen luettuna: poistot,
  -- oikeusmuutokset, impersonointi.
  critical     boolean not null default false,

  created_at   timestamptz not null default now()
);

create index if not exists sa_audit_created_idx on super_admin_audit_log (created_at desc);
create index if not exists sa_audit_target_idx  on super_admin_audit_log (target_type, target_id);
create index if not exists sa_audit_actor_idx   on super_admin_audit_log (actor_id);

alter table super_admin_audit_log enable row level security;

-- Vain ylläpitäjä lukee. Ei update- eikä delete-käytäntöä: RLS hylkää
-- ne oletuksena, joten rivejä ei voi muuttaa jälkikäteen.
drop policy if exists sa_audit_select on super_admin_audit_log;
create policy sa_audit_select on super_admin_audit_log
  for select using (current_user_is_super_admin());

-- ---------------------------------------------------------------------------
-- Kirjaus
-- ---------------------------------------------------------------------------
--
-- Funktion kautta eikä suoralla insertillä: silloin actor ja aikaleima
-- tulevat istunnosta eikä kutsujan antamina, eikä kirjoittaja voi
-- esiintyä toisena.

create or replace function sa_log(
  p_action      text,
  p_summary     text,
  p_target_type text default null,
  p_target_id   uuid default null,
  p_target_name text default null,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_critical    boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  insert into super_admin_audit_log (
    actor_id, actor_email, action, target_type, target_id, target_name,
    summary, before_data, after_data, critical
  )
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_action, p_target_type, p_target_id, p_target_name,
    p_summary, p_before, p_after, p_critical
  );
end;
$$;

revoke all on function sa_log from public;

-- ---------------------------------------------------------------------------
-- Feature flagit
-- ---------------------------------------------------------------------------
--
-- Lippu on koodin tuntema nimi, ei rivi jonka ylläpitäjä keksii. Siksi
-- avain on tekstiavain eikä uuid: koodissa lukee 'lunch_module', ja
-- sama merkkijono on tässä.
--
-- KOLME TILAA, EI KAHTA.
--
-- Lippu on päällä kaikille, pois kaikilta, tai ravintolakohtainen.
-- Ravintolakohtainen ohitus on oma taulunsa, jolloin globaali oletus ja
-- poikkeus eivät kirjoita samaan kenttään — muuten oletuksen
-- vaihtaminen pyyhkisi poikkeukset.

create table if not exists feature_flags (
  key         text primary key,
  label       text not null,
  description text,
  enabled     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists feature_flag_restaurants (
  flag_key      text not null references feature_flags(key) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  enabled       boolean not null,
  created_at    timestamptz not null default now(),
  primary key (flag_key, restaurant_id)
);

alter table feature_flags enable row level security;
alter table feature_flag_restaurants enable row level security;

-- Ylläpitäjä hallitsee.
drop policy if exists flags_sa_all on feature_flags;
create policy flags_sa_all on feature_flags
  for all using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

drop policy if exists flag_overrides_sa_all on feature_flag_restaurants;
create policy flag_overrides_sa_all on feature_flag_restaurants
  for all using (current_user_is_super_admin())
  with check (current_user_is_super_admin());

-- Ravintola lukee omat lippunsa. Ilman tätä sovellus ei voisi kysyä
-- onko ominaisuus käytössä ilman ylläpitäjän oikeuksia.
drop policy if exists flags_read on feature_flags;
create policy flags_read on feature_flags
  for select using (auth.uid() is not null);

drop policy if exists flag_overrides_read on feature_flag_restaurants;
create policy flag_overrides_read on feature_flag_restaurants
  for select using (
    exists (
      select 1 from memberships m
      where m.restaurant_id = feature_flag_restaurants.restaurant_id
        and m.user_id = auth.uid()
        and m.active
    )
  );

-- ---------------------------------------------------------------------------
-- Onko lippu päällä tälle ravintolalle?
-- ---------------------------------------------------------------------------
--
-- Poikkeus voittaa globaalin oletuksen. Tuntematon lippu on pois
-- päältä: kirjoitusvirhe nimessä ei saa avata ominaisuutta.

create or replace function feature_enabled(p_key text, p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.enabled from feature_flag_restaurants o
      where o.flag_key = p_key and o.restaurant_id = p_restaurant),
    (select f.enabled from feature_flags f where f.key = p_key),
    false
  );
$$;

grant execute on function feature_enabled to authenticated;
