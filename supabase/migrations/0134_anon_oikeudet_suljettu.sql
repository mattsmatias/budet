-- 0134 Kirjautumattomalta suljetaan kaikki paitsi kolme
--
-- 77 SECURITY DEFINER -funktiota oli anonin kutsuttavissa. Jokainen
-- niista tarkistaa kutsujan itse, joten mitaan ei vuotanut — mutta
-- turvallisuus lepasi sen varassa etta jokainen 77:sta muistaa
-- tarkistaa. Oikea oletus on painvastainen: suljettu, ja auki vain
-- se mille on syy.
--
-- AUKI JAAVAT KOLME.
--
--   preview_invitation       kirjautumaton tarkistaa kutsukoodin
--   preview_kate_invitation  sama Katen oman tiimin koodille
--   submit_contact_request   etusivun yhteydenottolomake
--
-- Lisaksi auki jaavat rivikaytannoissa kaytetyt apufunktiot
-- (is_owner, my_restaurant_ids, current_user_is_super_admin ja
-- muutama muu). Niita kutsutaan kaytannon sisalla, ja ilman
-- EXECUTE-oikeutta anonin kysely kaatuisi virheeseen sen sijaan etta
-- palauttaisi tyhjan. Ne palauttavat vain kutsujan oman paasyn.
--
-- MOLEMMAT NIMETAAN: PUBLIC JA ANON.
--
-- Osa oikeuksista tuli PUBLICin kautta, jolloin pelkka revoke
-- anonilta ei tehnyt mitaan. Kirjautuneelle oikeus myonnetaan
-- takaisin, jotta sovellus toimii tasmalleen kuten ennen.

do $$
declare
  v_rivi record;
  v_suljettu int := 0;
begin
  for v_rivi in
    with saannoissa as (
      select distinct p.proname
      from pg_proc p
      join pg_policies pol on (
        coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')
          ilike '%' || p.proname || '%'
      )
      where p.pronamespace = 'public'::regnamespace
    )
    select p.oid::regprocedure as tunnus
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in (
        'preview_invitation', 'preview_kate_invitation', 'submit_contact_request'
      )
      and p.proname not in (select proname from saannoissa)
  loop
    execute format('revoke all on function %s from public, anon', v_rivi.tunnus);
    execute format('grant execute on function %s to authenticated', v_rivi.tunnus);
    v_suljettu := v_suljettu + 1;
  end loop;

  raise notice 'Suljettu anonilta: % funktiota', v_suljettu;
end $$;
