-- ---------------------------------------------------------------------------
-- 0031 — Oman profiilin päivitys ei enää kaadu rekursioon
-- ---------------------------------------------------------------------------
--
-- Oman nimen tallennus asetuksissa palautti:
--
--   42P17  infinite recursion detected in policy for relation "profiles"
--
-- Luku toimi, kirjoitus ei. Toiminto oli siis rikki niin kauan kuin se
-- on ollut olemassa, ja vika löytyi vasta kun syntymäpäivän tallennusta
-- testattiin oikeaa rajapintaa vasten eikä käyttöliittymän läpi.
--
-- SYY
--
-- profiles_update_self -käytännön with check -lauseke teki alikyselyn
-- samaan tauluun jota se suojasi:
--
--   is_super_admin = (select is_super_admin from profiles where id = auth.uid())
--
-- Jokainen päivitys joutui siis tarkistamaan käytännön, joka luki
-- taulua, mikä tarkisti käytännön. Postgres katkaisee kierteen
-- virheeseen.
--
-- AIKOMUS OLI OIKEA, KEINO EI
--
-- Lauseke yritti estää käyttäjää nostamasta itseään pääkäyttäjäksi.
-- Rivitason suojaus ei voi verrata uutta riviä vanhaan — with check
-- näkee vain uuden — joten vertailu piti hakea kannasta, ja siitä
-- kierre syntyi.
--
-- Sama sääntö sarakeoikeutena on sekä yksinkertaisempi että tiukempi:
-- kenttää ei voi kirjoittaa lainkaan, joten sen arvoa ei tarvitse
-- verrata mihinkään.

-- ---------------------------------------------------------------------------
-- 1. Rekursoiva käytäntö pois
-- ---------------------------------------------------------------------------
--
-- Käytännön using-ehto on sama kuin profiles_update_own -käytännössä
-- (id = auth.uid()), joten pääsysääntö ei muutu. Vain rikkinäinen
-- lisäehto katoaa.

drop policy if exists profiles_update_self on profiles;

-- ---------------------------------------------------------------------------
-- 2. Suojattu kenttä sarakeoikeudella
-- ---------------------------------------------------------------------------
--
-- Käyttäjä saa muuttaa omia tietojaan mutta ei pääkäyttäjälippuaan.
-- is_super_admin jää listan ulkopuolelle, jolloin sitä koskeva
-- päivitys hylätään oikeuspuutteena eikä käytäntötarkistuksena.

revoke update on profiles from authenticated;

grant update (
  full_name,
  avatar_url,
  locale,
  birth_day,
  birth_month
) on profiles to authenticated;
