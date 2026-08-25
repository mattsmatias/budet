-- ---------------------------------------------------------------------------
-- 0036 — Kassan päiväraportti
-- ---------------------------------------------------------------------------
--
-- Päivän myynti on kirjattu käsin yhtenä lukuna. Luku on oikea mutta
-- sen ympäriltä on jäänyt pois kaikki mitä kassan päiväraportissa jo
-- lukee: verollinen summa, ALV ja kuittien määrä.
--
-- Kuitti kuvataan ja poimitaan. Päiväraportti on sama paperi samasta
-- tulostimesta, ja se on kirjattu käsin. Nyt sekin kuvataan.
--
-- MITÄ TALLENNETAAN
--
-- Vain se mitä raportissa lukee ja mitä joku katsoo:
--
--   veroton   — oli jo. Työvoiman osuus lasketaan tästä.
--   verollinen — mitä asiakas maksoi.
--   alv        — erotus, ja samalla tarkiste: netto + alv = brutto.
--   tapahtumat — kuittien määrä. Antaa keskiostoksen.
--
-- Maksutapajakauma (kortti/käteinen) jää pois. Se on raportissa, mutta
-- Budet ei tee siitä mitään: pankkiyhteyttä ei ole eikä kassan
-- täsmäytystä. Kenttä jota kukaan ei lue on kenttä joka vanhenee.
--
-- KAIKKI UUDET SARAKKEET OVAT VAPAAEHTOISIA
--
-- Käsin kirjattu päivä on yhä kelvollinen: yksi luku riittää. Uudet
-- kentät täyttyvät kun raportti kuvataan, eivätkä ne saa muuttua
-- pakoksi vanhoille riveille.

alter table daily_sales
  add column if not exists gross_sales_cents integer;

alter table daily_sales
  add column if not exists vat_cents integer;

alter table daily_sales
  add column if not exists transactions integer;

/*
 * Mistä rivi on peräisin.
 *
 * "Kirjattu käsin" ja "luettu raportista" ovat eri luotettavuutta, ja
 * ero on nähtävä myöhemmin — muuten ei voi tietää kannattaako lukua
 * epäillä kun se ei täsmää kirjanpitoon.
 */
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_source') then
    create type sales_source as enum ('manual', 'report');
  end if;
end
$$;

alter table daily_sales
  add column if not exists source sales_source not null default 'manual';

-- ---------------------------------------------------------------------------
-- Rajoitteet
-- ---------------------------------------------------------------------------

alter table daily_sales drop constraint if exists daily_sales_gross_positive;
alter table daily_sales add constraint daily_sales_gross_positive
  check (gross_sales_cents is null or gross_sales_cents >= 0);

alter table daily_sales drop constraint if exists daily_sales_vat_positive;
alter table daily_sales add constraint daily_sales_vat_positive
  check (vat_cents is null or vat_cents >= 0);

alter table daily_sales drop constraint if exists daily_sales_transactions_positive;
alter table daily_sales add constraint daily_sales_transactions_positive
  check (transactions is null or transactions >= 0);

/*
 * Verollinen ei voi olla verotonta pienempi.
 *
 * Tämä on ainoa suhde joka on aina tosi ALV-kannasta riippumatta.
 * Tarkempi ehto (netto + alv = brutto) jätetään sovellukseen, koska
 * kassan pyöristykset tekevät siitä toisinaan sentin sivussa — ja
 * sentin takia hylätty päiväraportti olisi huonompi kuin merkintä
 * siitä että luvut eivät täsmää.
 */
alter table daily_sales drop constraint if exists daily_sales_gross_gte_net;
alter table daily_sales add constraint daily_sales_gross_gte_net
  check (gross_sales_cents is null or gross_sales_cents >= net_sales_cents);
