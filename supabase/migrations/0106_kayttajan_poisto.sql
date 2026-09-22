-- 0106 — Pääsyn poisto poistaa käyttäjän
--
-- VIRHE.
--
-- "Poista pääsy" merkitsi jäsenyyden passiiviseksi. Tunnus jäi: poistettu
-- kirjanpitäjä pystyi yhä kirjautumaan ja päätyi aloitussivulle, josta
-- hän olisi voinut syöttää uuden koodin tai perustaa yrityksen.
--
-- KORJAUS.
--
-- remove_member poistaa jäsenyyden. Jos käyttäjä ei sen jälkeen kuulu
-- yhteenkään yritykseen eikä ole järjestelmän ylläpitäjä, hänen
-- tunnuksensa poistetaan kokonaan (profiili ja istunnot kaskadina).
--
-- Jos tunnuksella on historiaa, jota ei voi irrottaa — hän on lisännyt
-- kuitteja, kirjannut myyntiä, luonut tehtäviä tai sulkenut kuukauden —
-- poisto rikkoisi kirjanpidon jäljen "kuka teki". Silloin tunnus
-- lukitaan (banned_until) ja kaikki istunnot poistetaan. Kummassakin
-- tapauksessa kirjautuminen ei enää onnistu.
--
-- Omistaja voi poistaa vain oman yrityksensä käyttäjiä, ei itseään eikä
-- viimeistä omistajaa. Toisessa yrityksessä olevan jäsenyys ja tunnus
-- säilyvät.

create or replace function public.remove_member(p_restaurant uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owners int;
  v_other int;
  v_admin boolean;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi poistaa käyttäjiä';
  end if;

  if p_user = auth.uid() then
    raise exception 'Omaa pääsyä ei voi poistaa';
  end if;

  if not exists (
    select 1 from memberships where restaurant_id = p_restaurant and user_id = p_user
  ) then
    raise exception 'Käyttäjää ei löytynyt';
  end if;

  if exists (
    select 1 from memberships
    where restaurant_id = p_restaurant and user_id = p_user and role = 'owner' and active
  ) then
    select count(*) into v_owners from memberships
    where restaurant_id = p_restaurant and role = 'owner' and active;
    if v_owners <= 1 then
      raise exception 'Yrityksellä on oltava vähintään yksi omistaja';
    end if;
  end if;

  delete from memberships where restaurant_id = p_restaurant and user_id = p_user;

  select count(*) into v_other from memberships where user_id = p_user;
  select coalesce(is_super_admin, false) into v_admin from profiles where id = p_user;

  if v_other > 0 or coalesce(v_admin, false) then
    return 'removed';
  end if;

  begin
    delete from auth.users where id = p_user;
    return 'deleted';
  exception when foreign_key_violation then
    update auth.users set banned_until = 'infinity' where id = p_user;
    delete from auth.refresh_tokens where user_id = p_user::text;
    delete from auth.sessions where user_id = p_user;
    return 'locked';
  end;
end;
$$;

revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Onko kirjautuneen tunnus yhä käytössä. Poistettu tai lukittu tunnus
-- voi kantaa voimassa olevaa pääsytokenia vielä hetken; sovellus
-- kirjaa sen ulos tämän perusteella.
create or replace function public.my_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join profiles p on p.id = u.id
    where u.id = auth.uid()
      and (u.banned_until is null or u.banned_until < now())
  );
$$;

revoke all on function public.my_account_active() from public;
grant execute on function public.my_account_active() to authenticated;
