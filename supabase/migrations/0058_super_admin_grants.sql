-- ---------------------------------------------------------------------------
-- 0058 — Liput käyttöön ja oikeudet kuntoon
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Liput
-- ---------------------------------------------------------------------------
--
-- Oletuksena päällä. Olemassa olevat ravintolat käyttävät näitä
-- ominaisuuksia jo, ja pois-oletus sammuttaisi ne kaikilta samalla
-- hetkellä kun migraatio ajetaan.
--
-- Lippu on koodin tuntema nimi, joten se syntyy migraatiossa eikä
-- käyttöliittymästä: käyttöliittymästä luotu lippu ei vastaisi mitään
-- koodissa olevaa ehtoa.

insert into feature_flags (key, label, description, enabled) values
  ('lunch_module',     'Lounaslista',        'Julkinen lounaslista ja sen hallinta.', true),
  ('ai_assistant',     'Matti',              'AI-tyokaveri: analyysit ja ehdotukset.', true),
  ('payroll',          'Palkat',             'Palkkalaskelmat ja palkkakaudet.', true),
  ('tasks',            'Tehtavat',           'Tehtavat ja maaraajat.', true),
  ('advanced_reports', 'Laajat raportit',    'Excel- ja CSV-vienti seka kuukausiraportti.', true),
  ('shift_planning',   'Tyovuorosuunnittelu','Vuorojen suunnittelu ja kuukauden lista.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- anon pois
-- ---------------------------------------------------------------------------
--
-- Supabasen oletusoikeudet antavat EXECUTEn public-skeeman uusille
-- funktioille kolmelle roolille: anon, authenticated ja service_role.
-- "revoke from public" ei kumoa niitä, koska ne ovat nimenomaisia
-- rooligrantteja eivätkä PUBLIC-grantti.
--
-- Portti hylkäisi kirjautumattoman joka tapauksessa: auth.uid() on
-- silloin null, joten current_user_is_super_admin() palauttaa
-- epätoden. Tämä on toinen kerros — kutsua ei pääse edes yrittämään.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'sa\_%'
  loop
    execute format('revoke all on function %s from anon', f.sig);
  end loop;
end
$$;

-- sa_log on sisäinen apuri: sitä kutsuvat vain muut security definer
-- -funktiot, jotka ajavat määrittelijän oikeuksin. Kutsujan oma oikeus
-- ei siis ole tarpeen — ja ilman sitä lokiin ei voi kirjoittaa suoraan
-- ohi varsinaisten toimintojen.
revoke all on function sa_log from authenticated;

-- ---------------------------------------------------------------------------
-- Ensimmäinen ylläpitäjä
-- ---------------------------------------------------------------------------
--
-- Järjestelmätason rooli. Se ei muuta tenant-roolia eikä tenant-rooli
-- anna sitä: profiilin lippu ja jäsenyyden rooli ovat eri asioita.
--
-- Sähköpostilla eikä tunnisteella, jotta migraatio ei sisällä
-- ympäristökohtaista uuid:tä. Jos käyttäjää ei ole, ei tapahdu mitään
-- — tuoreessa kannassa ensimmäinen ylläpitäjä nimetään käsin.

update profiles p
set is_super_admin = true, updated_at = now()
from auth.users u
where u.id = p.id
  and u.email = 'oktay.hun@icloud.com'
  and not coalesce(p.is_super_admin, false);
