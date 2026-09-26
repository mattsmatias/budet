-- ---------------------------------------------------------------------------
-- 0125 — Kokeilun tila myos asiakkaalle
-- ---------------------------------------------------------------------------
--
-- ASIAKAS EI NAHNYT OMAA KOKEILUAAN.
--
-- restaurants.status ja trial_ends_on ovat olleet olemassa migraatiosta
-- 0054 asti, ja Katen hallinta on nahnyt niista koko ajan kaikki. Yritys
-- itse ei nahnyt mitaan: ei paivia jaljella, ei paattymispaivaa, ei
-- ilmoitusta kun kokeilu loppui. Lupaus kolmestakymmenesta paivasta
-- annetaan etusivulla, joten sen pitaa nakya myos sisaanpaastyaan.
--
-- Nakymaan lisataan kaksi saraketta. Ne ovat yrityksen omaa tietoa
-- omasta asiakkuudestaan, eika nakyma nayta muiden yritysten rivejä:
-- security_invoker seka memberships-ehto pysyvat ennallaan.
--
-- auth.uid() kaaritaan select-lausekkeeksi samasta syysta kuin
-- migraatiossa 0122: ilman kaaretta se suoritetaan riviä kohti.

create or replace view my_restaurants
with (security_invoker = true) as
select r.id,
       r.name,
       r.timezone,
       r.currency,
       m.role,
       r.slug,
       r.business_type,
       r.logo_path,
       r.status,
       r.trial_ends_on
  from restaurants r
  join memberships m on m.restaurant_id = r.id
 where m.user_id = (select auth.uid())
   and m.active;

comment on view my_restaurants is
  'Kayttajan omat yritykset rooleineen. Sisaltaa asiakkuuden tilan ja kokeilun paattymispaivan, jotta yritys nakee oman kokeilunsa.';
