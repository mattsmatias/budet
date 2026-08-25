-- ---------------------------------------------------------------------------
-- 0042 — Vajaa ALV-rivi kelpaa
-- ---------------------------------------------------------------------------
--
-- Migraatio 0041 vaati ALV-riviltä kaikki kolme lukua: veron, verottoman
-- ja verollisen. Se on oikea vaatimus sille kassalle josta ominaisuus
-- rakennettiin — sen raportissa on sarakkeet ALV / NE / TTC.
--
-- KAIKKI KASSAT EIVÄT TULOSTA KOLMEA SARAKETTA.
--
-- Osa tulostaa vain veron kantaa kohti: "ALV 14 % 12,34". Silloin
-- kolmen luvun vaatimus hylkäsi koko rivin, ja päivä palasi johtamaan
-- veron tuoteryhmistä — eli takaisin siihen tilanteeseen jonka 0041
-- korjasi.
--
-- VERO ON SE LUKU JOTA TARVITAAN.
--
-- Veroton ja verollinen ovat kannoittaisen vertailun tarkkuutta, eivät
-- sen edellytys. Kun ne puuttuvat, kassan ilmoittama vero on yhä
-- kassan ilmoittama vero, ja juuri se on kirjanpidon luku.
--
-- Nollaa ei käytetä puuttuvan merkkinä: nolla on kelvollinen summa
-- nollaverokannan rivillä, ja "ei tiedetä" on eri asia kuin "on nolla".

alter table daily_sales_vat alter column gross_cents drop not null;
alter table daily_sales_vat alter column net_cents drop not null;

-- ---------------------------------------------------------------------------
-- Rivin sisäinen ristiriita on yhä virhe
-- ---------------------------------------------------------------------------
--
-- Puuttuva luku sallitaan, väärä ei. Jos molemmat ovat tiedossa,
-- niiden on summauduttava verolliseksi sentin sisällä — kassa
-- pyöristää, mutta ei enempää. Ristiriitainen rivi tarkoittaa väärin
-- luettua raporttia, eikä väärin luettu luku saa päästä kirjanpidon
-- lähteeksi.

alter table daily_sales_vat drop constraint if exists daily_sales_vat_sums;
alter table daily_sales_vat add constraint daily_sales_vat_sums check (
  gross_cents is null
  or net_cents is null
  or abs(gross_cents - net_cents - vat_cents) <= 1
);
