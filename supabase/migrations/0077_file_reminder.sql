-- ---------------------------------------------------------------------------
-- 0077 — Voimassaolosta tehtävä
-- ---------------------------------------------------------------------------
--
-- Vanheneva lupa oli merkintä tiedostorivillä. Merkintä on huomio, ei
-- teko: se katoaa näkyvistä kun sivu suljetaan, eikä kukaan tee sille
-- mitään ennen kuin joku sattuu avaamaan Voimassaolo-välilehden.
--
-- Kate tekee siitä nyt tehtävän määräpäivineen. Tehtävät-osiossa on jo
-- eräpäivä, prioriteetti ja vastuuhenkilö — tämä on kytkentä, ei uusi
-- ominaisuus.
--
-- ---------------------------------------------------------------------------
-- MIKSI SARAKE EIKÄ HAKU
-- ---------------------------------------------------------------------------
--
-- Ilman sidosta tehtävä pitäisi löytää otsikon perusteella, kun
-- voimassaolo muuttuu tai poistetaan. Otsikko on käyttäjän muokattavissa
-- ja kuudella kielellä, joten haku löytäisi joskus väärän tehtävän ja
-- joskus ei mitään.
--
-- on delete set null: tehtävän poisto ei saa viedä tiedostoa mukanaan.
-- Sidos katkeaa, ja seuraava voimassaolon muutos tekee uuden tehtävän.

alter table files
  add column if not exists reminder_task_id uuid references tasks (id) on delete set null;

create index if not exists files_reminder
  on files (reminder_task_id)
  where reminder_task_id is not null;
