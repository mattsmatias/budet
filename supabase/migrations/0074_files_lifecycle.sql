-- ---------------------------------------------------------------------------
-- 0074 — Tiedostojen elinkaari: voimassaolo, roskakori ja liitokset
-- ---------------------------------------------------------------------------
--
-- Kolme lisäystä, jotka tekevät kaapista aktiivisen.
--
-- ---------------------------------------------------------------------------
-- 1. VOIMASSAOLO ON SE MIKÄ OIKEASTI SATUTTAA
-- ---------------------------------------------------------------------------
--
-- Ravintolaa vahingoittavat juuri ne paperit jotka vanhenevat:
-- anniskelulupa, elintarvikehuoneistoilmoitus, vakuutus, vuokrasopimus,
-- hygieniapassit, määräaikaiset työsopimukset. Niiden unohtuminen ei
-- ole epämukavuus vaan sakko, suljettu terassi tai vakuuttamaton
-- tulipalo.
--
-- expires_on on valinnainen. Useimmilla tiedostoilla ei ole
-- voimassaoloa, eikä pakollinen kenttä tekisi niistä sellaisia — se
-- tekisi vain jokaisesta latauksesta yhden kysymyksen pidemmän.
--
-- ---------------------------------------------------------------------
-- 2. POISTO ON PERUTTAVISSA
-- ---------------------------------------------------------------------
--
-- Kansion poisto sisältöineen oli lopullinen. Se on ainoa toiminto
-- tässä osiossa jossa virhe maksaa oikeasti, joten se saa välitilan:
-- rivi merkitään poistetuksi, ja objekti storagessa säilyy.
--
-- Lopullinen häviäminen tapahtuu kolmenkymmenen päivän jälkeen.
-- Siivous ajetaan silloin kun roskakori avataan — ajastettua tehtävää
-- ei ole, ja lisätty ajastin olisi uusi liikkuva osa siihen mitä
-- avaaminen tekee joka tapauksessa.
--
-- Poistettu rivi ei näy missään normaalissa näkymässä. Suodatus on
-- kyselyissä eikä käytännössä: käytäntö piilottaisi rivin myös
-- palautukselta, ja silloin roskakoria ei voisi tyhjentää eikä
-- palauttaa.
--
-- ---------------------------------------------------------------------
-- 3. TIEDOSTO KIINNI SIIHEN MITÄ SE KOSKEE
-- ---------------------------------------------------------------------
--
-- Sopimus kuuluu toimittajalle ja lasku kuitille. Liitos on sarake
-- eikä oma taulunsa: tiedosto koskee yhtä toimittajaa ja yhtä kuittia,
-- ei montaa, ja monen suhde olisi taulu jota kukaan ei täytä.
--
-- on delete set null molemmissa: toimittajan poisto ei saa viedä
-- sopimusta mukanaan. Tiedosto jää kaappiin ilman liitosta, mikä on
-- oikea lopputulos.

-- ---------------------------------------------------------------------------
-- Sarakkeet
-- ---------------------------------------------------------------------------

alter table files
  add column if not exists expires_on date,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles (id) on delete set null,
  add column if not exists supplier_id uuid references suppliers (id) on delete set null,
  add column if not exists receipt_id uuid references receipts (id) on delete set null;

alter table folders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indeksit
-- ---------------------------------------------------------------------------
--
-- Vanhat indeksit rakennetaan uudelleen osittaisina: poistettu rivi ei
-- kuulu mihinkään normaaliin kyselyyn, eikä sen tarvitse viedä tilaa
-- niiden indekseistä.

drop index if exists files_by_folder;
create index files_by_folder
  on files (restaurant_id, folder_id, created_at desc)
  where deleted_at is null;

drop index if exists files_recent;
create index files_recent
  on files (restaurant_id, created_at desc)
  where deleted_at is null;

drop index if exists files_favorites;
create index files_favorites
  on files (restaurant_id, created_at desc)
  where is_favorite and deleted_at is null;

create index if not exists files_expiring
  on files (restaurant_id, expires_on)
  where expires_on is not null and deleted_at is null;

create index if not exists files_trash
  on files (restaurant_id, deleted_at)
  where deleted_at is not null;

create index if not exists files_by_supplier
  on files (supplier_id)
  where supplier_id is not null and deleted_at is null;

create index if not exists files_by_receipt
  on files (receipt_id)
  where receipt_id is not null and deleted_at is null;

/*
 * Nimen yksilöllisyys koskee vain eläviä kansioita.
 *
 * Muuten poistettu "2026" estäisi uuden luomisen samalla nimellä, ja
 * este olisi näkymätön: kansiota jota ei näy ei osaa myöskään
 * palauttaa mielessään.
 */
drop index if exists folders_unique_name_in_parent;
create unique index folders_unique_name_in_parent
  on folders (restaurant_id, parent_folder_id, lower(btrim(name)))
  where parent_folder_id is not null and deleted_at is null;

drop index if exists folders_unique_name_in_root;
create unique index folders_unique_name_in_root
  on folders (restaurant_id, lower(btrim(name)))
  where parent_folder_id is null and deleted_at is null;
