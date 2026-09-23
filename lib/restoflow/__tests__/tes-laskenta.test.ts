import { describe, expect, it } from "vitest";
import { staffCost } from "../staff-cost";
import type { Employee, TimeEntry } from "../employees";
import { settingsFromTes, versionFor, type TesAgreement } from "../tes";
import { splitMinutes, DEFAULT_PAYROLL } from "../payroll";

/*
 * TES-laskennan rajatapaukset.
 *
 * Arvot ovat MaRa-sopimuksen mukaiset: iltalisa 1,40 e/h klo 18–24 ja
 * yolisa 2,37 e/h klo 00–06 syyskuusta 2025, seuraava muutos 1.7.2027
 * (1,43 ja 2,43). Sunnuntai on 100 %:n korotus. Arvot tulevat naissa
 * testeissa TES-rakenteesta eivatka koodista, kuten laskennassakin.
 *
 * Nama testit vartioivat kolmea asiaa: lisa osuu vain omille
 * minuuteilleen, versio valitaan vuoron paivalla, eika tuleva versio
 * muuta vanhoja vuoroja.
 */

const AIKA = "Europe/Helsinki";
const PALKKA = 1450;

function saanto(
  ruleType: "evening" | "night" | "saturday" | "sunday",
  value: number,
  unit: "eur_per_hour" | "percent",
  startTime: string | null = null,
  endTime: string | null = null,
) {
  return { id: ruleType, ruleType, name: ruleType, unit, value, startTime, endTime };
}

/** MaRa 1.9.2025–30.6.2027. */
const VANHA: TesAgreement = {
  id: "v1",
  slug: "marava",
  name: "MaRa",
  industry: "restaurant",
  validFrom: "2025-09-01",
  validUntil: "2027-06-30",
  isActive: true,
  rules: [
    saanto("evening", 1.4, "eur_per_hour", "18:00", "24:00"),
    saanto("night", 2.37, "eur_per_hour", "00:00", "06:00"),
    saanto("sunday", 100, "percent"),
  ],
};

/** MaRa 1.7.2027 alkaen: samat valit, korkeammat lisat. */
const UUSI: TesAgreement = {
  ...VANHA,
  id: "v2",
  validFrom: "2027-07-01",
  validUntil: "2028-03-31",
  rules: [
    saanto("evening", 1.43, "eur_per_hour", "18:00", "24:00"),
    saanto("night", 2.43, "eur_per_hour", "00:00", "06:00"),
    saanto("sunday", 100, "percent"),
  ],
};

const VERSIOT = [VANHA, UUSI];

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

/** Vuoro paikallista aikaa: "2026-09-02", "14:00", 540 minuuttia. */
function vuoro(date: string, kello: string, minutes: number): TimeEntry {
  const alku = new Date(`${date}T${kello}:00+03:00`);

  return {
    id: `${date}-${kello}`,
    employeeId: "a",
    date,
    clockIn: alku.toISOString(),
    clockOut: new Date(alku.getTime() + minutes * 60_000).toISOString(),
    minutes,
  };
}

/** Minuutit luokittain vuoron paivan version mukaan. */
function jako(entry: TimeEntry) {
  const tes = versionFor(VERSIOT, entry.date);
  return splitMinutes(entry, AIKA, settingsFromTes(tes, DEFAULT_PAYROLL));
}

/** Kuukauden kustannus ilman sivukuluja ja lomakustannusta. */
function kulu(entries: TimeEntry[], month: string) {
  return staffCost([TESTI], entries, month, AIKA, DEFAULT_PAYROLL, VERSIOT)
    .total;
}

describe("kesto ei pyoristy", () => {
  const tapaukset: [string, number, number][] = [
    ["A: yksi minuutti", 1, 24],
    ["B: 23 minuuttia", 23, 556],
    ["C: tunti", 60, 1450],
    ["D: puolitoista tuntia", 90, 2175],
    ["E: kahdeksan tuntia", 480, 11600],
  ];

  for (const [nimi, minuutit, sentit] of tapaukset) {
    it(nimi, () => {
      /* Keskipaiva tiistaina: yksikaan lisa ei osu. */
      const cost = kulu([vuoro("2026-09-01", "10:00", minuutit)], "2026-09");

      expect(cost.minutes).toBe(minuutit);
      expect(cost.baseCents).toBe(sentit);
      expect(cost.supplementCents).toBe(0);
      expect(cost.totalCents).toBe(sentit);
    });
  }
});

describe("lisa vain omille minuuteilleen", () => {
  it("F: vuoro paattyy ennen iltalisan alkua", () => {
    /* 10:00–17:00 tiistaina. */
    const split = jako(vuoro("2026-09-01", "10:00", 420));

    expect(split.total).toBe(420);
    expect(split.evening).toBe(0);
    expect(split.night).toBe(0);
  });

  it("G: vuoro alkaa ennen iltalisaa ja jatkuu sen aikana", () => {
    /* 14:00–23:00: kahdeksan tuntia paivaa, viisi tuntia iltaa. */
    const split = jako(vuoro("2026-09-01", "14:00", 540));

    expect(split.total).toBe(540);
    expect(split.evening).toBe(300);
    expect(split.night).toBe(0);
  });

  it("G: iltalisa maksetaan vain illan tunneista", () => {
    const cost = kulu([vuoro("2026-09-01", "14:00", 540)], "2026-09");

    /* 9 h x 14,50 e = 130,50 e ja 5 h x 1,40 e = 7,00 e. */
    expect(cost.baseCents).toBe(13050);
    expect(cost.supplementCents).toBe(700);
    expect(cost.totalCents).toBe(13750);
  });

  it("H: vuoro alkaa iltalisan aikana ja paattyy sen jalkeen", () => {
    /* 22:00–02:00: kaksi tuntia iltaa, kaksi tuntia yota. */
    const split = jako(vuoro("2026-09-01", "22:00", 240));

    expect(split.evening).toBe(120);
    expect(split.night).toBe(120);
  });

  it("H: ilta ja yo lasketaan omilla arvoillaan", () => {
    const cost = kulu([vuoro("2026-09-01", "22:00", 240)], "2026-09");

    /* 2 h x 1,40 e + 2 h x 2,37 e = 7,54 e. */
    expect(cost.supplementCents).toBe(754);
  });

  it("I: vuoro kokonaan lisaajan sisalla", () => {
    /* 19:00–22:00 tiistaina: kaikki kolme tuntia iltaa. */
    const split = jako(vuoro("2026-09-01", "19:00", 180));

    expect(split.evening).toBe(180);
    expect(split.total).toBe(180);
  });

  it("tunti 23–24 saa iltalisan kun sopimus sanoo klo 18–24", () => {
    /*
     * Tama oli virhe: "24:00" hylattiin kelvottomana, jolloin valiksi
     * tuli oletus 18–23 eika viimeinen tunti saanut lisaa.
     */
    const split = jako(vuoro("2026-09-01", "23:00", 60));

    expect(split.evening).toBe(60);
  });
});

describe("viikonpaiva", () => {
  it("J: sunnuntaivuoro saa sadan prosentin korotuksen", () => {
    /* Sunnuntai 6.9.2026, 10:00–16:00. */
    const cost = kulu([vuoro("2026-09-06", "10:00", 360)], "2026-09");

    expect(cost.baseCents).toBe(8700);
    /* 6 h x 14,50 e x 100 % = 87,00 e. */
    expect(cost.supplementCents).toBe(8700);
    expect(cost.totalCents).toBe(17400);
  });

  it("K: sunnuntai-ilta saa seka sunnuntai- etta iltalisan", () => {
    /* Sunnuntai 20:00–23:00. */
    const split = jako(vuoro("2026-09-06", "20:00", 180));
    const cost = kulu([vuoro("2026-09-06", "20:00", 180)], "2026-09");

    expect(split.sunday).toBe(180);
    expect(split.evening).toBe(180);
    expect(split.sundayEvening).toBe(180);
    /*
     * Sopimus korottaa peruspalkan ja iltalisan: 43,50 e peruspalkan
     * korotusta, 4,20 e iltalisaa ja 4,20 e sen korotusta.
     */
    expect(cost.supplementCents).toBe(4350 + 420 + 420);
  });

  it("lauantailisan kellonaikavali rajaa lisan", () => {
    /*
     * MaRa ei tunne lauantailisaa, mutta rakenteen pitaa tukea sita:
     * lauantai klo 13 alkaen tarkoittaa etta aamu jaa ilman.
     */
    const tes: TesAgreement = {
      ...VANHA,
      rules: [saanto("saturday", 2, "eur_per_hour", "13:00", "24:00")],
    };

    /* Lauantai 5.9.2026, 10:00–16:00. */
    const split = splitMinutes(
      vuoro("2026-09-05", "10:00", 360),
      AIKA,
      settingsFromTes(tes, DEFAULT_PAYROLL),
    );

    expect(split.total).toBe(360);
    expect(split.saturday).toBe(180);
  });

  it("ilman kellonaikaa viikonpaivalisa koskee koko paivaa", () => {
    const tes: TesAgreement = {
      ...VANHA,
      rules: [saanto("saturday", 2, "eur_per_hour")],
    };

    const split = splitMinutes(
      vuoro("2026-09-05", "10:00", 360),
      AIKA,
      settingsFromTes(tes, DEFAULT_PAYROLL),
    );

    expect(split.saturday).toBe(360);
  });
});

describe("version vaihtuminen", () => {
  it("M: vuoro ennen vaihtumista kaytaa vanhoja arvoja", () => {
    /* 30.6.2027 klo 19–22. */
    const cost = kulu([vuoro("2027-06-30", "19:00", 180)], "2027-06");

    expect(versionFor(VERSIOT, "2027-06-30")?.id).toBe("v1");
    /* 3 h x 1,40 e = 4,20 e. */
    expect(cost.supplementCents).toBe(420);
  });

  it("L: vaihtumispaiva kuuluu uudelle versiolle", () => {
    /* 1.7.2027 klo 19–22. */
    const cost = kulu([vuoro("2027-07-01", "19:00", 180)], "2027-07");

    expect(versionFor(VERSIOT, "2027-07-01")?.id).toBe("v2");
    /* 3 h x 1,43 e = 4,29 e. */
    expect(cost.supplementCents).toBe(429);
  });

  it("N: vaihtumisen jalkeen kaytaa uusia arvoja", () => {
    /* 2.7.2027 klo 00–06 on yota. */
    const cost = kulu([vuoro("2027-07-02", "00:00", 360)], "2027-07");

    /* 6 h x 2,43 e = 14,58 e. */
    expect(cost.supplementCents).toBe(1458);
  });

  it("sama kuukausi molemmin puolin vaihtumista laskee kumpikin omillaan", () => {
    const cost = kulu(
      [vuoro("2027-06-30", "19:00", 180), vuoro("2027-07-01", "19:00", 180)],
      "2027",
    );

    /* 4,20 e vanhalla ja 4,29 e uudella versiolla. */
    expect(cost.supplementCents).toBe(420 + 429);
  });

  it("tuleva versio ei muuta jo tehtya vuoroa", () => {
    const vanhaVuoro = [vuoro("2026-09-01", "19:00", 180)];

    const ennen = staffCost(
      [TESTI],
      vanhaVuoro,
      "2026-09",
      AIKA,
      DEFAULT_PAYROLL,
      [VANHA],
    ).total;

    const jalkeen = staffCost(
      [TESTI],
      vanhaVuoro,
      "2026-09",
      AIKA,
      DEFAULT_PAYROLL,
      VERSIOT,
    ).total;

    expect(jalkeen.totalCents).toBe(ennen.totalCents);
  });
});

describe("lomakustannus ja sivukulut", () => {
  const asetukset = {
    ...DEFAULT_PAYROLL,
    holidayRate: 0.115,
    sideCostRate: 0.23,
  };

  it("lasketaan palkasta ja lisista, ei paalletysten", () => {
    /* Tiistai 19:00–22:00: 3 h peruspalkkaa ja 3 h iltalisaa. */
    const cost = staffCost(
      [TESTI],
      [vuoro("2026-09-01", "19:00", 180)],
      "2026-09",
      AIKA,
      asetukset,
      VERSIOT,
    ).total;

    const palkka = 4350;
    const lisat = 420;
    const loma = Math.round((palkka + lisat) * 0.115);
    const sivu = Math.round((palkka + lisat + loma) * 0.23);

    expect(cost.baseCents).toBe(palkka);
    expect(cost.supplementCents).toBe(lisat);
    expect(cost.holidayCents).toBe(loma);
    expect(cost.sideCostCents).toBe(sivu);
    expect(cost.totalCents).toBe(palkka + lisat + loma + sivu);
  });

  it("sivukulut lasketaan lomakustannuksen sisaltavasta summasta vain kerran", () => {
    const cost = staffCost(
      [TESTI],
      [vuoro("2026-09-01", "10:00", 60)],
      "2026-09",
      AIKA,
      asetukset,
      VERSIOT,
    ).total;

    expect(cost.holidayCents).toBe(Math.round(1450 * 0.115));
    expect(cost.sideCostCents).toBe(
      Math.round((1450 + Math.round(1450 * 0.115)) * 0.23),
    );
  });
});
