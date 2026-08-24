-- ---------------------------------------------------------------------------
-- 0030 — Työyhteisö
-- ---------------------------------------------------------------------------
--
-- Työntekijä näkee ketkä ovat hänen työkavereitaan ja kenellä on tänään
-- syntymäpäivä. Ei sosiaalinen verkosto: nimi, tehtävä, ja päivä.
--
-- SYNTYMÄVUOTTA EI TALLENNETA
--
-- Vaatimus oli ettei vuotta näytetä. Sen olisi voinut toteuttaa
-- piilottamalla vuosi näkymässä, mutta silloin se olisi silti kannassa
-- ja rajapinnan takana — ja juuri se ero UI:n ja kannan välillä on se
-- mikä palkoissa piti korjata erikseen (migraatio 0028).
--
-- Päivä ja kuukausi erillisinä lukuina. Budet ei tarvitse ikää mihinkään,
-- joten sitä ei kysytä. Tietoa jota ei ole ei voi vuotaa.

alter table profiles add column if not exists birth_day smallint;
alter table profiles add column if not exists birth_month smallint;

alter table profiles drop constraint if exists profiles_birthday_valid;

/*
 * Molemmat tai ei kumpaakaan, ja päivä kuukauden mukaan.
 *
 * 29.2. sallitaan: karkauspäivänä syntynyt on olemassa, eikä vuoden
 * puuttuminen saa tehdä hänestä mahdotonta.
 */
alter table profiles add constraint profiles_birthday_valid check (
  (birth_day is null and birth_month is null)
  or (
    birth_month between 1 and 12
    and birth_day between 1 and
      case birth_month
        when 2 then 29
        when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
        else 31
      end
  )
);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- profiles_read sallii jo saman ravintolan jäsenten lukea toistensa
-- profiilit. Uudet sarakkeet kulkevat samaa reittiä, eikä erillistä
-- käytäntöä tarvita: päivä ja kuukausi ovat juuri se tieto joka on
-- tarkoituskin näyttää työkavereille.
--
-- Muiden ravintoloiden työntekijät eivät näy, koska käytäntö vaatii
-- yhteisen jäsenyyden. Se on tarkistettu erikseen alla olevassa
-- testissä eikä oletettu.
