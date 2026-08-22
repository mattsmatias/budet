/**
 * Kokoaa numeroidut migraatiot yhdeksi tiedostoksi.
 *
 * Käsin ylläpidetty niputus jää väistämättä jälkeen: niin kävi
 * ALL_IN_ONE.sql:lle, joka viittasi vielä vanhaan taulunimeen ja
 * puuttui kaksi migraatiota. Tuoreesta kannasta rakennettu ympäristö
 * olisi silloin eri kuin tuotanto, ja ero löytyisi vasta virheenä.
 *
 * Aja: npm run bundle:sql
 */

import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const OUT = path.join(DIR, "ALL_IN_ONE.sql");

const files = fs
  .readdirSync(DIR)
  .filter((name) => /^\d{4}_.*\.sql$/.test(name))
  .sort();

if (files.length === 0) {
  console.error("Migraatioita ei löytynyt kansiosta", DIR);
  process.exit(1);
}

const header = `-- ---------------------------------------------------------------------------
-- RestoFlow — kaikki migraatiot yhtenä tiedostona
-- ---------------------------------------------------------------------------
--
-- GENEROITU TIEDOSTO. Älä muokkaa käsin — muutokset katoavat.
-- Lähde: supabase/migrations/000*.sql
-- Luo uudelleen: npm run bundle:sql
--
-- Käyttö: liitä kokonaisuudessaan Supabasen SQL-editoriin tuoreelle
-- kannalle. Migraatiot ovat idempotentteja (create ... if not exists,
-- create or replace, drop policy if exists), joten ajo olemassa olevaa
-- kantaa vasten on turvallinen.
--
-- Sisältää ${files.length} migraatiota:
${files.map((name) => `--   ${name}`).join("\n")}
-- ---------------------------------------------------------------------------

`;

const body = files
  .map((name) => {
    const sql = fs.readFileSync(path.join(DIR, name), "utf8").trimEnd();

    return [
      "",
      "-- ===========================================================================",
      `-- ${name}`,
      "-- ===========================================================================",
      "",
      sql,
      "",
    ].join("\n");
  })
  .join("\n");

fs.writeFileSync(OUT, header + body + "\n");

const lines = (header + body).split("\n").length;
console.log(`ALL_IN_ONE.sql: ${files.length} migraatiota, ${lines} riviä`);
