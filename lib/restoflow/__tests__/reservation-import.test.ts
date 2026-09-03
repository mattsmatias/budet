/**
 * Tuonnin tulkinta.
 *
 * Tämä on se osa joka menee rikki oudolla tiedostolla, ja rikkoutumisen
 * seuraus on hiljainen: väärin luettu päivämääräsarake ei näytä
 * virheeltä vaan sadalta varaukselta väärällä kuukaudella. Siksi juuri
 * nämä funktiot testataan tarkasti — kanta ei voi enää tietää mitä
 * tiedostossa luki.
 */

import { describe, expect, it } from "vitest";
import {
  chunk,
  detectDelimiter,
  guessReservationColumns,
  guessTableColumns,
  parseDelimited,
  parseImportDate,
  parseImportNumber,
  parseImportStatus,
  parseImportTables,
  parseImportTime,
  prepareReservations,
  prepareTables,
} from "../reservation-import";

// ===========================================================================
// Tiedosto soluiksi
// ===========================================================================

describe("detectDelimiter", () => {
  it("tunnistaa puolipisteen", () => {
    expect(detectDelimiter("pvm;klo;nimi\n2026-08-31;19:00;Virtanen")).toBe(";");
  });

  it("tunnistaa pilkun", () => {
    expect(detectDelimiter("date,time,name")).toBe(",");
  });

  it("tunnistaa sarkaimen", () => {
    expect(detectDelimiter("date\ttime\tname")).toBe("\t");
  });

  it("ei laske lainausmerkkien sisällä olevia", () => {
    /* "Virtanen, Anna" on yksi solu eikä kaksi. */
    expect(detectDelimiter('nimi;puh\n"Virtanen, Anna";040')).toBe(";");
  });
});

describe("parseDelimited", () => {
  it("lukee rivit ja solut", () => {
    const rows = parseDelimited("a,b\n1,2\n3,4");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("säilyttää lainausmerkkien sisällä olevan erottimen", () => {
    const rows = parseDelimited('nimi,note\n"Virtanen, Anna","kakku, kynttilät"');
    expect(rows[1]).toEqual(["Virtanen, Anna", "kakku, kynttilät"]);
  });

  it("lukee kahdennetun lainausmerkin yhtenä", () => {
    const rows = parseDelimited('a\n"sano ""hei"""');
    expect(rows[1][0]).toBe('sano "hei"');
  });

  it("lukee rivinvaihdon lainausmerkkien sisältä", () => {
    const rows = parseDelimited('a,b\n"eka\ntoka",2');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("eka\ntoka");
  });

  it("ohittaa tyhjän rivin tiedoston lopussa", () => {
    expect(parseDelimited("a,b\n1,2\n")).toHaveLength(2);
  });

  it("ei sotkeudu tiedoston alun tavujärjestysmerkkiin", () => {
    /* Excel kirjoittaa sen, ja ilman poistoa ensimmäinen otsikko ei osu. */
    const rows = parseDelimited("﻿pvm,klo\n2026-08-31,19:00");
    expect(rows[0][0]).toBe("pvm");
  });
});

// ===========================================================================
// Sarakkeiden tunnistus
// ===========================================================================

describe("guessReservationColumns", () => {
  it("tunnistaa suomenkieliset otsikot", () => {
    const map = guessReservationColumns([
      "Päivä",
      "Klo",
      "Henkilöä",
      "Nimi",
      "Puhelin",
    ]);

    expect(map.date).toBe(0);
    expect(map.time).toBe(1);
    expect(map.partySize).toBe(2);
    expect(map.name).toBe(3);
    expect(map.phone).toBe(4);
  });

  it("tunnistaa englanninkieliset otsikot", () => {
    const map = guessReservationColumns([
      "Date",
      "Time",
      "Party size",
      "Guest name",
      "Email",
    ]);

    expect(map.date).toBe(0);
    expect(map.partySize).toBe(2);
    expect(map.name).toBe(3);
    expect(map.email).toBe(4);
  });

  it("ei anna samaa saraketta kahdelle kentälle", () => {
    /*
     * "Name" osuisi sekä nimeen että pöytään ("table name"), ja sama
     * sarake kahdessa kentässä tarkoittaisi että pöydäksi luetaan
     * asiakkaan nimi.
     */
    const map = guessReservationColumns(["Name", "Guests"]);
    expect(map.tables).not.toBe(map.name);
  });
});

describe("guessTableColumns", () => {
  it("tunnistaa pöytäsarakkeet", () => {
    const map = guessTableColumns(["Pöytä", "Paikat", "Alue"]);

    expect(map.name).toBe(0);
    expect(map.seatsMax).toBe(1);
    expect(map.area).toBe(2);
  });
});

// ===========================================================================
// Arvojen tulkinta
// ===========================================================================

describe("parseImportDate", () => {
  it("lukee ISO-muodon", () => {
    expect(parseImportDate("2026-08-31")).toBe("2026-08-31");
  });

  it("lukee suomalaisen muodon", () => {
    expect(parseImportDate("31.8.2026")).toBe("2026-08-31");
    expect(parseImportDate("1.9.2026")).toBe("2026-09-01");
  });

  it("olettaa päivän ensin kauttaviivoissa", () => {
    expect(parseImportDate("31/08/2026")).toBe("2026-08-31");
    expect(parseImportDate("03/04/2026")).toBe("2026-04-03");
  });

  it("tunnistaa amerikkalaisen kun se on ainoa mahdollinen", () => {
    /* 08/31 ei voi olla päivä 8 kuukautta 31. */
    expect(parseImportDate("08/31/2026")).toBe("2026-08-31");
  });

  it("hylkää päivän jota ei ole", () => {
    expect(parseImportDate("31.2.2026")).toBeNull();
  });

  it("hylkää sen mitä ei osaa lukea", () => {
    expect(parseImportDate("ensi perjantaina")).toBeNull();
    expect(parseImportDate("")).toBeNull();
  });
});

describe("parseImportTime", () => {
  it("lukee kellonajan", () => {
    expect(parseImportTime("19:00")).toBe("19:00");
    expect(parseImportTime("9:05")).toBe("09:05");
  });

  it("lukee pisteellä kirjoitetun", () => {
    expect(parseImportTime("19.30")).toBe("19:30");
  });

  it("lukee aikaleimasta", () => {
    expect(parseImportTime("2026-08-31 19:00:00")).toBe("19:00");
  });

  it("ei lue kellonaikaa päivämäärän keskeltä", () => {
    /* Ilman reunaehtoja "31.8.2026 19:00" olisi kello 08:20. */
    expect(parseImportTime("31.8.2026 19:00")).toBe("19:00");
  });

  it("hylkää kelvottoman", () => {
    expect(parseImportTime("25:00")).toBeNull();
    expect(parseImportTime("illalla")).toBeNull();
  });
});

describe("parseImportNumber", () => {
  it("lukee luvun tekstin seasta", () => {
    expect(parseImportNumber("4")).toBe(4);
    expect(parseImportNumber("4 hlö")).toBe(4);
    expect(parseImportNumber("party of 6")).toBe(6);
  });

  it("palauttaa null eikä ykköstä kun lukua ei ole", () => {
    /* Ykkönen olisi hiljaa väärä siellä missä oli kymmenen. */
    expect(parseImportNumber("")).toBeNull();
  });
});

describe("parseImportTables", () => {
  it("jakaa pöydät", () => {
    expect(parseImportTables("12 + 13")).toEqual(["12", "13"]);
    expect(parseImportTables("12,13")).toEqual(["12", "13"]);
    expect(parseImportTables("A1/A2")).toEqual(["A1", "A2"]);
  });

  it("palauttaa tyhjän kun solu on tyhjä", () => {
    expect(parseImportTables("")).toEqual([]);
  });
});

describe("parseImportStatus", () => {
  it("tunnistaa peruutuksen ja saapumattoman", () => {
    expect(parseImportStatus("Peruttu")).toBe("cancelled");
    expect(parseImportStatus("cancelled")).toBe("cancelled");
    expect(parseImportStatus("No show")).toBe("no_show");
  });

  it("tuo saapuneen valmiina eikä saapuneena", () => {
    /* Menneen illan seurue ei istu enää pöydässä. */
    expect(parseImportStatus("arrived")).toBe("completed");
  });

  it("olettaa vahvistetun kun tila on tuntematon", () => {
    expect(parseImportStatus("jotain muuta")).toBe("confirmed");
    expect(parseImportStatus("")).toBe("confirmed");
  });
});

// ===========================================================================
// Rivit tuotavaksi
// ===========================================================================

const otsikot = ["Päivä", "Klo", "Henkilöä", "Nimi", "Puhelin", "Allergiat"];

function rivit(...data: string[][]): string[][] {
  return [otsikot, ...data];
}

describe("prepareReservations", () => {
  const map = guessReservationColumns(otsikot);

  it("tekee kelvollisesta rivistä varauksen", () => {
    const { rows, problems } = prepareReservations(
      rivit(["31.8.2026", "19:00", "4", "Virtanen", "040123", "pähkinä"]),
      map,
    );

    expect(problems).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      date: "2026-08-31",
      time: "19:00",
      partySize: 4,
      name: "Virtanen",
      phone: "040123",
      allergies: "pähkinä",
      status: "confirmed",
    });
  });

  it("kertoo rivinumeron ja kentän kelvottomasta rivistä", () => {
    const { rows, problems } = prepareReservations(
      rivit(
        ["31.8.2026", "19:00", "4", "Virtanen", "", ""],
        ["ensi viikolla", "19:00", "2", "Korhonen", "", ""],
      ),
      map,
    );

    /* Yksi kelvollinen ei kaadu toisen mukana. */
    expect(rows).toHaveLength(1);
    expect(problems).toEqual([
      { line: 3, field: "date", value: "ensi viikolla" },
    ]);
  });

  it("vaatii nimen", () => {
    const { problems } = prepareReservations(
      rivit(["31.8.2026", "19:00", "4", "", "", ""]),
      map,
    );

    expect(problems[0].field).toBe("name");
  });
});

describe("prepareTables", () => {
  const poytaOtsikot = ["Nimi", "Paikat", "Alue", "Muoto"];
  const map = guessTableColumns(poytaOtsikot);

  it("tekee pöydän rivistä", () => {
    const { rows } = prepareTables(
      [poytaOtsikot, ["Ikkuna 1", "4", "Sali", "pyöreä"]],
      map,
    );

    expect(rows[0]).toEqual({
      name: "Ikkuna 1",
      seatsMin: 1,
      seatsMax: 4,
      area: "Sali",
      shape: "round",
    });
  });

  it("olettaa vähimmäismääräksi yhden", () => {
    /*
     * Toisin päin arvattuna tuonti sulkisi pöytiä pois käytöstä
     * hiljaa: kuuden pöytä johon ei mahdu kahta.
     */
    const { rows } = prepareTables([poytaOtsikot, ["Kabinetti", "8", "", ""]], map);
    expect(rows[0].seatsMin).toBe(1);
  });

  it("vaatii paikkaluvun", () => {
    const { problems } = prepareTables(
      [poytaOtsikot, ["Terassi 1", "", "", ""]],
      map,
    );

    expect(problems[0].field).toBe("seatsMax");
  });
});

describe("chunk", () => {
  it("jakaa rivit paloihin", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("palauttaa tyhjästä tyhjän", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});
