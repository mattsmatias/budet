import { describe, expect, it } from "vitest";
import { staffCost } from "../staff-cost";
import { settingsFromTes, versionFor, type TesAgreement } from "../tes";
import { splitMinutes, DEFAULT_PAYROLL } from "../payroll";
import type { Employee, TimeEntry } from "../employees";

/*
 * MaRa-laskennan loppuauditointi.
 *
 * Nama testit eivat lisaa saantoja vaan vartioivat sita mika on jo
 * rakennettu: version valinta paivamaaralla, minuuttien osuminen
 * oikeaan paivaan ja kellonaikaan, korotusten kohdistuminen ja
 * kustannusketjun jarjestys.
 *
 * Kaikki arvot tulevat TES-rakenteesta kuten tuotannossakin.
 */

const AIKA = "Europe/Helsinki";
const PALKKA = 1450;

function saanto(
  ruleType: "evening" | "night" | "sunday" | "eve",
  value: number,
  unit: "eur_per_hour" | "percent",
  startTime: string | null = null,
  endTime: string | null = null,
) {
  return {
    id: ruleType,
    ruleType,
    name: ruleType,
    unit,
    value,
    startTime,
    endTime,
  };
}

const SAANNOT_VANHA = [
  saanto("evening", 1.4, "eur_per_hour", "18:00", "24:00"),
  saanto("night", 2.37, "eur_per_hour", "00:00", "06:00"),
  saanto("sunday", 100, "percent"),
  saanto("eve", 50, "percent", "15:00", "24:00"),
];

const SAANNOT_UUSI = [
  saanto("evening", 1.43, "eur_per_hour", "18:00", "24:00"),
  saanto("night", 2.43, "eur_per_hour", "00:00", "06:00"),
  saanto("sunday", 100, "percent"),
  saanto("eve", 50, "percent", "15:00", "24:00"),
];

const V1: TesAgreement = {
  id: "v1",
  slug: "marava",
  name: "MaRa",
  industry: "restaurant",
  validFrom: "2025-09-01",
  validUntil: "2027-06-30",
  isActive: true,
  rules: SAANNOT_VANHA,
};

const V2: TesAgreement = {
  ...V1,
  id: "v2",
  validFrom: "2027-07-01",
  validUntil: "2028-03-31",
  rules: SAANNOT_UUSI,
};

const VERSIOT = [V1, V2];

const TESTI: Employee = {
  id: "a",
  firstName: "Testi",
  lastName: "Test",
  email: null,
  jobTitle: null,
  hourlyCents: PALKKA,
  active: true,
  linked: false,
};

/** Vuoro annetusta UTC-hetkesta. */
function vuoroUtc(date: string, utc: string, minutes: number): TimeEntry {
  const alku = new Date(utc);

  return {
    id: `${date}-${utc}`,
    employeeId: "a",
    date,
    clockIn: alku.toISOString(),
    clockOut: new Date(alku.getTime() + minutes * 60_000).toISOString(),
    minutes,
  };
}

/** Vuoro paikallisesta kellonajasta: siirtyma annetaan erikseen. */
function vuoro(
  date: string,
  kello: string,
  minutes: number,
  siirtyma = "+03:00",
): TimeEntry {
  return vuoroUtc(date, `${date}T${kello}:00${siirtyma}`, minutes);
}

function kulu(entries: TimeEntry[], month: string, versiot = VERSIOT) {
  return staffCost([TESTI], entries, month, AIKA, DEFAULT_PAYROLL, versiot)
    .total;
}

function jako(entry: TimeEntry) {
  return splitMinutes(
    entry,
    AIKA,
    settingsFromTes(versionFor(VERSIOT, entry.date), DEFAULT_PAYROLL),
  );
}

describe("1: versioiden rajat", () => {
  const tapaukset: [string, string | null][] = [
    ["2025-08-31", null],
    ["2025-09-01", "v1"],
    ["2027-06-30", "v1"],
    ["2027-07-01", "v2"],
    ["2028-03-31", "v2"],
    ["2028-04-01", null],
  ];

  for (const [paiva, odotus] of tapaukset) {
    it(`${paiva} → ${odotus ?? "ei versiota"}`, () => {
      expect(versionFor(VERSIOT, paiva)?.id ?? null).toBe(odotus);
    });
  }

  it("vanha vuoro ei muutu kun uusi versio lisataan", () => {
    const vuorot = [vuoro("2026-12-01", "19:00", 180, "+02:00")];

    const ennen = kulu(vuorot, "2026-12", [V1]);
    const jalkeen = kulu(vuorot, "2026-12", VERSIOT);

    expect(jalkeen.totalCents).toBe(ennen.totalCents);
  });

  it("puuttuva versio ilmoitetaan eika arvata", () => {
    const tulos = staffCost(
      [TESTI],
      [vuoro("2025-08-31", "19:00", 60)],
      "2025-08",
      AIKA,
      DEFAULT_PAYROLL,
      VERSIOT,
    );

    expect(tulos.missingTes).toEqual(["2025-08-31"]);
    expect(tulos.total.supplementCents).toBe(0);
  });
});

describe("2: kellonajan rajat", () => {
  it("ilta alkaa tasan 18 eika 17:59", () => {
    /* 17:00–19:00 tiistaina: vain jalkimmainen tunti on iltaa. */
    expect(jako(vuoro("2026-09-01", "17:00", 120)).evening).toBe(60);
  });

  it("ilta paattyy keskiyohon ja yo alkaa siita", () => {
    /* 23:00–01:00: tunti iltaa ja tunti yota. */
    const split = jako(vuoro("2026-09-01", "23:00", 120));

    expect(split.evening).toBe(60);
    expect(split.night).toBe(60);
  });

  it("yo paattyy tasan kuudelta", () => {
    /* 05:00–07:00: tunti yota ja tunti tavallista. */
    const split = jako(vuoro("2026-09-01", "05:00", 120));

    expect(split.night).toBe(60);
    expect(split.evening).toBe(0);
  });

  it("minuutti ei ole seka iltaa etta yota", () => {
    const split = jako(vuoro("2026-09-01", "14:00", 900));

    expect(split.evening + split.night).toBeLessThanOrEqual(split.total);
    expect(split.evening).toBe(360);
    expect(split.night).toBe(300);
  });
});

describe("2: kesa- ja talviajan vaihtuminen", () => {
  it("syksylla toistuva tunti lasketaan kerran per todellinen minuutti", () => {
    /*
     * 25.10.2026 kello siirtyy taaksepain: paikallinen 00–06 on
     * seitseman todellista tuntia. Jokainen niista on yota.
     */
    const entry = vuoroUtc("2026-10-25", "2026-10-24T21:00:00Z", 420);
    const split = jako(entry);

    expect(split.total).toBe(420);
    expect(split.night).toBe(420);
  });

  it("kevaalla puuttuva tunti ei tuota tyhjia minuutteja", () => {
    /*
     * 28.3.2027 kello siirtyy eteenpain: paikallinen 00–06 on viisi
     * todellista tuntia.
     */
    const entry = vuoroUtc("2027-03-28", "2027-03-27T22:00:00Z", 300);
    const split = jako(entry);

    expect(split.total).toBe(300);
    expect(split.night).toBe(300);
  });

  it("aikavyohyke ratkaisee lisan, ei palvelimen UTC", () => {
    /*
     * 19:00 Helsingissa on 16:00 UTC. Ilman vyohyketta tunti ei
     * osuisi iltalisaan lainkaan.
     */
    const entry = vuoroUtc("2026-09-01", "2026-09-01T16:00:00Z", 60);

    expect(jako(entry).evening).toBe(60);
  });
});

describe("6: vuoron rajat yli keskiyon", () => {
  it("ma 23 – ti 01", () => {
    const cost = kulu([vuoro("2026-09-07", "23:00", 120)], "2026-09");

    /* Tunti iltalisaa ja tunti yolisaa, ei korotuksia. */
    expect(cost.baseCents).toBe(2900);
    expect(cost.supplementCents).toBe(140 + 237);
  });

  it("su 23 – ma 02: korotus ei valu maanantain puolelle", () => {
    const split = jako(vuoro("2026-09-06", "23:00", 180));
    const cost = kulu([vuoro("2026-09-06", "23:00", 180)], "2026-09");

    expect(split.sunday).toBe(60);
    expect(split.sundayEvening).toBe(60);
    expect(split.sundayNight).toBe(0);
    expect(split.night).toBe(120);

    /*
     * Sunnuntain tunti: iltalisa 1,40 e ja korotus 14,50 e + 1,40 e.
     * Maanantain kaksi tuntia: yolisa 4,74 e ilman korotusta.
     */
    expect(cost.supplementCents).toBe(140 + 1450 + 140 + 474);
  });

  it("la 23 – su 02: korotus alkaa vasta keskiyosta", () => {
    const split = jako(vuoro("2026-09-05", "23:00", 180));

    expect(split.sunday).toBe(120);
    expect(split.sundayNight).toBe(120);
    expect(split.sundayEvening).toBe(0);
  });

  it("juhannusaatto 22 – juhannuspaiva 02", () => {
    const split = jako(vuoro("2026-06-19", "22:00", 240));
    const cost = kulu([vuoro("2026-06-19", "22:00", 240)], "2026-06");

    /* Aatto keskiyohon asti, sen jalkeen pyhapaiva. */
    expect(split.eve).toBe(120);
    expect(split.eveEvening).toBe(120);
    expect(split.sunday).toBe(120);
    expect(split.sundayNight).toBe(120);

    /*
     * Aatto: iltalisa 2,80 e ja 50 % summasta 29,00 e + 2,80 e.
     * Juhannuspaiva: yolisa 4,74 e ja 100 % summasta 29,00 e + 4,74 e.
     */
    expect(cost.supplementCents).toBe(280 + 1590 + 474 + 3374);
  });

  it("aatto ja pyha eivat koskaan osu samaan minuuttiin", () => {
    /* Jouluaatto 12:00 – joulupaiva 12:00. */
    const split = jako(vuoro("2026-12-24", "12:00", 1440, "+02:00"));

    expect(split.eve).toBe(540); // 15–24
    expect(split.sunday).toBe(720); // 00–12 joulupaivana
    expect(split.eve + split.sunday).toBeLessThanOrEqual(split.total);
  });
});

describe("7: euro ja prosentti", () => {
  const tunnit = [vuoro("2026-09-01", "19:00", 60)];

  function iltalisalla(value: number, unit: "eur_per_hour" | "percent") {
    const tes: TesAgreement = {
      ...V1,
      rules: [saanto("evening", value, unit, "18:00", "24:00")],
    };

    return (hourlyCents: number) =>
      staffCost(
        [{ ...TESTI, hourlyCents }],
        tunnit,
        "2026-09",
        AIKA,
        DEFAULT_PAYROLL,
        [tes],
      ).total.supplementCents;
  }

  it("euromaarainen lisa ei riipu tuntipalkasta", () => {
    const laske = iltalisalla(1.4, "eur_per_hour");

    expect(laske(1450)).toBe(140);
    expect(laske(2900)).toBe(140);
  });

  it("prosenttilisa skaalautuu tuntipalkan mukana", () => {
    const laske = iltalisalla(10, "percent");

    expect(laske(1450)).toBe(145);
    expect(laske(2900)).toBe(290);
  });

  it("prosenttia ei tulkita euroina", () => {
    /* 100 % ei ole 100 e/h. */
    const tes: TesAgreement = {
      ...V1,
      rules: [saanto("sunday", 100, "percent")],
    };

    const cost = staffCost(
      [TESTI],
      [vuoro("2026-09-06", "12:00", 60)],
      "2026-09",
      AIKA,
      DEFAULT_PAYROLL,
      [tes],
    ).total;

    expect(cost.supplementCents).toBe(1450);
  });
});

describe("8: kustannusketjun jarjestys", () => {
  const asetukset = {
    ...DEFAULT_PAYROLL,
    holidayRate: 0.115,
    sideCostRate: 0.23,
  };

  /** Ketju kasin: palkka → lisat → lomakustannus → sivukulut. */
  function ketju(baseCents: number, lisat: number) {
    const palkkakustannus = baseCents + lisat;
    const loma = Math.round(palkkakustannus * 0.115);
    const sivu = Math.round((palkkakustannus + loma) * 0.23);

    return { loma, sivu, total: palkkakustannus + loma + sivu };
  }

  const tapaukset: [string, TimeEntry][] = [
    ["arkipaiva", vuoro("2026-09-01", "10:00", 480)],
    ["iltavuoro", vuoro("2026-09-01", "16:00", 480)],
    ["sunnuntai-ilta", vuoro("2026-09-06", "16:00", 480)],
    ["jouluaatto", vuoro("2026-12-24", "12:00", 480, "+02:00")],
  ];

  for (const [nimi, entry] of tapaukset) {
    it(`${nimi}: lomakustannus ja sivukulut kerran korotetusta palkasta`, () => {
      const cost = staffCost(
        [TESTI],
        [entry],
        entry.date.slice(0, 7),
        AIKA,
        asetukset,
        VERSIOT,
      ).total;

      const odotus = ketju(cost.baseCents, cost.supplementCents);

      expect(cost.holidayCents).toBe(odotus.loma);
      expect(cost.sideCostCents).toBe(odotus.sivu);
      expect(cost.totalCents).toBe(odotus.total);
    });
  }

  it("sunnuntaikorotus ei kerro loppusummaa", () => {
    const arki = staffCost(
      [TESTI],
      [vuoro("2026-09-07", "12:00", 60)],
      "2026-09",
      AIKA,
      asetukset,
      VERSIOT,
    ).total;

    const pyha = staffCost(
      [TESTI],
      [vuoro("2026-09-06", "12:00", 60)],
      "2026-09",
      AIKA,
      asetukset,
      VERSIOT,
    ).total;

    /*
     * Palkkakustannus kaksinkertaistuu, ja lomakustannus ja sivukulut
     * seuraavat siita — mutta niita ei koroteta erikseen, joten
     * kokonaisuus on tasan kaksinkertainen eika enempaa.
     */
    expect(pyha.baseCents + pyha.supplementCents).toBe(
      (arki.baseCents + arki.supplementCents) * 2,
    );
    expect(pyha.totalCents).toBe(arki.totalCents * 2);
  });
});
