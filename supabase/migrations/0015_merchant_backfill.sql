-- ---------------------------------------------------------------------------
-- 0015 — Olemassa olevat toimipisteet brändeihin
-- ---------------------------------------------------------------------------
--
-- Kertaluontoinen aineistokorjaus. Uudet kuitit tunnistetaan
-- sovelluksessa automaattisesti; tämä koskee vain sitä mikä oli
-- tallennettu ennen tunnistusta.
--
-- Tunnisteet on ajettu sovelluksen oman tunnistusfunktion läpi ja
-- tarkistettu yksitellen. Normalisointia ei toisteta SQL:ssä:
-- Postgresin säännöllinen lauseke ei tue samoja merkkiluokkia kuin
-- JavaScript, joten kaksi toteutusta ajautuisi väistämättä erilleen ja
-- kantaan päätyisi liitoksia joita sovellus ei olisi tehnyt.
--
-- Tyhjässä kannassa nämä eivät osu mihinkään eivätkä tee mitään.
--
-- merchant_confirmed jää epätodeksi: tämä on koneen tekemä tunnistus, ja
-- käyttäjä saa yhä korjata sen käyttöliittymästä.

update suppliers set merchant_id = 'gigantti', merchant_confidence = 0.97
where id = 'c1bc1c2d-3925-4fe0-a4e1-66d6ab8055ab' and merchant_id is null;

update suppliers set merchant_id = 'gigantti', merchant_confidence = 0.92
where id = '3f34faa6-00bb-4808-9ebc-60d0c0bb18e8' and merchant_id is null;

update suppliers set merchant_id = 'k-market', merchant_confidence = 0.97
where id = '5d5e941d-5044-41df-a789-cdef508df5ff' and merchant_id is null;

update suppliers set merchant_id = 'k-market', merchant_confidence = 0.92
where id = '7de0ec49-3922-4abb-ab8b-034bb76ebcdb' and merchant_id is null;

update suppliers set merchant_id = 's-market', merchant_confidence = 0.92
where id = '931c9048-c457-4fbd-a270-cd2384723add' and merchant_id is null;
