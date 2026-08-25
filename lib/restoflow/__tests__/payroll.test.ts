import { describe, expect, it } from "vitest";
import {
  buildPayslip,
  componentApplies,
  componentMinutes,
  fingerprint,
  halfMonthPeriods,
  monthPeriod,
  rankComponents,
  resolveWorkday,
  type PayComponent,
  type TimeCorrection,
} from "../payroll";
import { workSegments } from "../timeclock";
import { formatMoney } from "@/lib/money";
import type { ClockEvent, Shift, User } from "../types";

/*
 * Aikaleimat ovat UTC:tä, kellonajat paikallisia.
 *
 * Helsinki on elokuussa UTC+3, joten paikallinen 10:02 on 07:02Z.
 * Testit kirjoitetaan paikallisina, koska niin palkkakin ajatellaan.
 */
const ZONE = "Europe/Helsinki";
const NOW = "2026-08-25T00:00:00.000Z";

/** Paikallinen kellonaika UTC-aikaleimaksi. Elokuu = UTC+3. */
function local(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const utcHour = h - 3;
  if (utcHour >= 0) {
    return `${date}T${String(utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
  }
  // Ennen klo 03:00 paikallista mennään edelliselle UTC-päivälle.
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const prev = d.toISOString().slice(0, 10);
  return `${prev}T${String(24 + utcHour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
}

function ev(type: ClockEvent["type"], at: string): ClockEvent {
  return { id: `${at}-${type}`, userId: "u1", type, at };
}

const user: User = {
  id: "u1",
  restaurantId: "r1",
  name: "Matti Meikäläinen",
  role: "employee",
  position: "waiter",
  hourlyRateCents: 1550,
  initials: "MM",
  active: true,
};

/** Maanantai 24.8.2026, suunniteltu 10:00-18:00. */
const shift: Shift = {
  breakMinutes: 0,
  note: null,
  publishedAt: "2026-08-01T00:00:00.000Z",
  cancelledAt: null,
  id: "sh1",
  restaurantId: "r1",
  userId: "u1",
  date: "2026-08-24",
  startTime: "10:00",
  endTime: "18:00",
  location: "Sali",
  status: "accepted",
};

function component(partial: Partial<PayComponent> = {}): PayComponent {
  return {
    id: "c1",
    name: "Iltalisä",
    code: "evening",
    unit: "per_hour",
    value: 150,
    weekdays: [],
    fromMinute: null,
    toMinute: null,
    stackable: true,
    validFrom: "2026-01-01",
    validTo: null,
    active: true,
    ...partial,
  };
}

function slip(over: {
  events?: ClockEvent[];
  corrections?: TimeCorrection[];
  components?: PayComponent[];
  user?: User;
  from?: string;
  to?: string;
} = {}) {
  return buildPayslip({
    user: over.user ?? user,
    from: over.from ?? "2026-08-24",
    to: over.to ?? "2026-08-24",
    events: over.events ?? [],
    shifts: [shift],
    corrections: over.corrections ?? [],
    components: over.components ?? [],
    nowIso: NOW,
    timezone: ZONE,
  });
}

// ---------------------------------------------------------------------------

describe("toteutunut aika ratkaisee, ei suunniteltu", () => {
  /*
   * Specin esimerkki sellaisenaan.
   *
   * Vuoro on suunniteltu 10:00-18:00 eli kahdeksaksi tunniksi, mutta
   * leimaukset ovat 10:02 ja 18:01. Palkan on perustuttava jälkimmäisiin.
   */
  const events = [
    ev("in", local("2026-08-24", "10:02")),
    ev("out", local("2026-08-24", "18:01")),
  ];

  it("laskee 7 h 59 min eikä kahdeksaa tuntia", () => {
    const result = slip({ events });
    expect(result.workedMinutes).toBe(479);
    expect(result.workedMinutes).not.toBe(480);
  });

  it("laskee peruspalkan toteutuneesta ajasta", () => {
    const result = slip({ events });
    // 479 min = 7,98333 h × 15,50 € = 123,74 €
    expect(result.baseCents).toBe(12374);
    expect(formatMoney(result.baseCents)).toBe(formatMoney(12374));
  });

  it("ei pyöristä minuutteja ylös eikä alas", () => {
    // Suunniteltu kahdeksan tuntia olisi 124,00 €.
    expect(slip({ events }).baseCents).toBeLessThan(12400);
  });

  it("näyttää kellonajat ravintolan ajassa", () => {
    const result = slip({ events });
    expect(result.lines[0].description).toBe("10:02–18:01");
  });

  it("liittää rivin vuoroon jäljitystä varten", () => {
    const result = slip({ events });
    expect(result.lines[0].shiftId).toBe("sh1");
    expect(result.lines[0].date).toBe("2026-08-24");
  });
});

describe("tauot", () => {
  it("vähentää tauon palkallisesta ajasta", () => {
    const events = [
      ev("in", local("2026-08-24", "10:00")),
      ev("break_start", local("2026-08-24", "13:00")),
      ev("break_end", local("2026-08-24", "13:30")),
      ev("out", local("2026-08-24", "18:00")),
    ];

    // 8 h - 30 min = 7,5 h
    expect(slip({ events }).workedMinutes).toBe(450);
  });

  it("ei maksa lisää tauon ajalta", () => {
    const events = [
      ev("in", local("2026-08-24", "17:00")),
      ev("break_start", local("2026-08-24", "18:00")),
      ev("break_end", local("2026-08-24", "19:00")),
      ev("out", local("2026-08-24", "20:00")),
    ];

    // Iltalisä 18:00-23:00: työtä siinä ikkunassa on vain 19-20.
    const ilta = component({ fromMinute: 18 * 60, toMinute: 23 * 60 });
    const result = slip({ events, components: [ilta] });
    const line = result.lines.find((l) => l.componentId === "c1");

    expect(line?.minutes).toBe(60);
  });
});

describe("puuttuva uloskirjaus", () => {
  const events = [ev("in", local("2026-08-24", "10:02"))];

  it("ei muodosta palkkaa", () => {
    const result = slip({ events });
    expect(result.workedMinutes).toBe(0);
    expect(result.grossCents).toBe(0);
  });

  it("kertoo syyn", () => {
    const result = slip({ events });
    expect(result.issues.map((i) => i.kind)).toContain("missing_out");
  });
});

describe("epäuskottava kesto", () => {
  /*
   * Tämä tapaus tuli tuotantoaineistosta.
   *
   * Yöllä klo 02:15 tehty sisäänleimaus jäi auki, ja seuraavan illan
   * leimaus sulki sen. Uloskirjaus oli olemassa, joten puuttuvan
   * leimauksen tarkistus ei huomannut mitään — mutta työaikaa kertyi
   * kahdenkymmenen tunnin edestä.
   */
  const events = [
    ev("in", local("2026-08-24", "02:15")),
    ev("break_start", local("2026-08-24", "22:42")),
    ev("out", local("2026-08-24", "22:45")),
  ];

  it("varoittaa yli kuudentoista tunnin jaksosta", () => {
    const result = slip({ events });
    expect(result.issues.map((i) => i.kind)).toContain("implausible");
  });

  it("kertoo keston varoituksessa", () => {
    const result = slip({ events });
    const issue = result.issues.find((i) => i.kind === "implausible");
    expect(issue?.message).toContain("20 tuntia");
  });

  it("ei varoita tavallisesta vuorosta", () => {
    const normaali = slip({
      events: [
        ev("in", local("2026-08-24", "10:00")),
        ev("out", local("2026-08-24", "18:00")),
      ],
    });
    expect(normaali.issues).toHaveLength(0);
  });

  /*
   * Summa näytetään silti.
   *
   * Nollaaminen piilottaisi ongelman: käyttäjä näkisi tyhjän päivän
   * eikä ymmärtäisi mistä varoitus kertoo. Hyväksyntä on se joka
   * estyy, ei laskenta.
   */
  it("näyttää kertyneen summan mutta estää hyväksynnän", () => {
    const result = slip({ events });
    expect(result.grossCents).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("työajan korjaus", () => {
  const events = [ev("in", local("2026-08-24", "10:02"))];

  const correction: TimeCorrection = {
    id: "corr1",
    userId: "u1",
    workDate: "2026-08-24",
    correctedIn: local("2026-08-24", "10:02"),
    correctedOut: local("2026-08-24", "18:00"),
    correctedBreakMinutes: 0,
    reason: "Ulosleima unohtui",
  };

  it("korvaa puuttuvan leimauksen", () => {
    const result = slip({ events, corrections: [correction] });
    expect(result.workedMinutes).toBe(478);
    expect(result.issues.map((i) => i.kind)).not.toContain("missing_out");
  });

  it("merkitsee rivin korjatuksi ja säilyttää viitteen", () => {
    const result = slip({ events, corrections: [correction] });
    expect(result.lines[0].correctionId).toBe("corr1");
    expect(result.lines[0].description).toContain("korjattu");
  });

  it("vähentää korjaukseen merkityn tauon", () => {
    const result = slip({
      events,
      corrections: [{ ...correction, correctedBreakMinutes: 30 }],
    });
    expect(result.workedMinutes).toBe(448);
  });
});

describe("palkkatiedon puuttuminen", () => {
  it("ei laske palkkaa ilman tuntipalkkaa", () => {
    const result = slip({
      user: { ...user, hourlyRateCents: null },
      events: [
        ev("in", local("2026-08-24", "10:00")),
        ev("out", local("2026-08-24", "18:00")),
      ],
    });

    expect(result.issues.map((i) => i.kind)).toContain("missing_rate");
    expect(result.baseCents).toBe(0);
  });
});

describe("palkkalajin ikkuna", () => {
  const segments = workSegments(
    [
      ev("in", local("2026-08-24", "16:00")),
      ev("out", local("2026-08-24", "22:00")),
    ],
    NOW,
  );

  it("laskee vain ikkunaan osuvat minuutit", () => {
    const ilta = component({ fromMinute: 18 * 60, toMinute: 23 * 60 });
    // 18:00-22:00 = 4 h
    expect(componentMinutes(segments, ilta, ZONE)).toBe(240);
  });

  /*
   * Yölisä 23:00-06:00 kulkee keskiyön yli. Ilman erillistä käsittelyä
   * ehto from <= minute < to olisi aina epätosi.
   */
  it("käsittelee keskiyön yli menevän ikkunan", () => {
    const yo = component({ code: "night", fromMinute: 23 * 60, toMinute: 6 * 60 });
    const yoSegments = workSegments(
      [
        ev("in", local("2026-08-24", "22:00")),
        ev("out", local("2026-08-25", "02:00")),
      ],
      NOW,
    );
    // 23:00-02:00 = 3 h
    expect(componentMinutes(yoSegments, yo, ZONE)).toBe(180);
  });

  it("rajaa viikonpäivän mukaan paikallisesti", () => {
    // 2026-08-24 on maanantai.
    const sunnuntai = component({ code: "sunday", weekdays: [7] });
    expect(componentMinutes(segments, sunnuntai, ZONE)).toBe(0);

    const maanantai = component({ weekdays: [1] });
    expect(componentMinutes(segments, maanantai, ZONE)).toBe(360);
  });
});

describe("palkkalajin voimassaolo", () => {
  it("ei sovella ennen alkupäivää", () => {
    expect(componentApplies(component({ validFrom: "2026-09-01" }), "2026-08-24")).toBe(false);
  });

  it("ei sovella päättymisen jälkeen", () => {
    expect(componentApplies(component({ validTo: "2026-08-01" }), "2026-08-24")).toBe(false);
  });

  it("ei sovella passiivista", () => {
    expect(componentApplies(component({ active: false }), "2026-08-24")).toBe(false);
  });

  it("sovelletaan voimassaoloaikana", () => {
    expect(componentApplies(component(), "2026-08-24")).toBe(true);
  });
});

describe("lisien laskenta", () => {
  const events = [
    ev("in", local("2026-08-24", "16:00")),
    ev("out", local("2026-08-24", "22:00")),
  ];

  it("maksaa euromääräisen lisän tunneilta", () => {
    const ilta = component({ fromMinute: 18 * 60, toMinute: 23 * 60, value: 150 });
    const result = slip({ events, components: [ilta] });
    // 4 h × 1,50 € = 6,00 €
    expect(result.supplementsCents).toBe(600);
  });

  it("maksaa prosenttilisän tuntipalkasta", () => {
    const sunnuntai = component({
      code: "sunday", unit: "percent", value: 100, weekdays: [1],
    });
    const result = slip({ events, components: [sunnuntai] });
    // 6 h × 15,50 € × 100 % = 93,00 €
    expect(result.supplementsCents).toBe(9300);
  });

  it("laskee bruttopalkan perusosan ja lisien summana", () => {
    const ilta = component({ fromMinute: 18 * 60, toMinute: 23 * 60 });
    const result = slip({ events, components: [ilta] });
    expect(result.grossCents).toBe(result.baseCents + result.supplementsCents);
  });

  /*
   * Yhdistelemättömistä lisistä maksetaan arvokkain.
   *
   * Sama minuutti voi osua sekä sunnuntai- että iltalisään. Jos
   * kumpikaan ei ole yhdisteltävä, molempien maksaminen olisi
   * kaksinkertainen korvaus samasta työstä.
   */
  it("maksaa vain arvokkaimman kun lisät eivät yhdisty", () => {
    const ilta = component({
      id: "c-ilta", name: "Iltalisä", value: 150,
      fromMinute: 18 * 60, toMinute: 23 * 60, stackable: false,
    });
    const iso = component({
      id: "c-iso", name: "Suuri lisä", value: 500,
      fromMinute: 18 * 60, toMinute: 23 * 60, stackable: false,
    });

    const result = slip({ events, components: [ilta, iso] });
    // 4 h × 5,00 € = 20,00 €, ei 20,00 + 6,00.
    expect(result.supplementsCents).toBe(2000);
  });

  it("maksaa molemmat kun lisät yhdistyvät", () => {
    const ilta = component({ id: "c-ilta", value: 150, fromMinute: 18 * 60, toMinute: 23 * 60 });
    const muu = component({ id: "c-muu", value: 100, fromMinute: 18 * 60, toMinute: 23 * 60 });

    const result = slip({ events, components: [ilta, muu] });
    // 4 h × (1,50 + 1,00) = 10,00 €
    expect(result.supplementsCents).toBe(1000);
  });

  it("järjestää lisät arvon mukaan", () => {
    const halpa = component({ id: "a", value: 100 });
    const kallis = component({ id: "b", value: 400 });
    const prosentti = component({ id: "c", unit: "percent", value: 100 });

    // 100 % 15,50 €:sta on 15,50 € eli arvokkain.
    expect(rankComponents([halpa, kallis, prosentti], 1550).map((c) => c.id))
      .toEqual(["c", "b", "a"]);
  });
});

describe("palkkakaudet", () => {
  it("jakaa kuukauden puolikkaisiin", () => {
    expect(halfMonthPeriods("2026-08")).toEqual([
      { startsOn: "2026-08-01", endsOn: "2026-08-15" },
      { startsOn: "2026-08-16", endsOn: "2026-08-31" },
    ]);
  });

  it("osaa myös helmikuun", () => {
    expect(halfMonthPeriods("2026-02")[1].endsOn).toBe("2026-02-28");
  });

  it("antaa koko kuukauden yhtenä kautena", () => {
    expect(monthPeriod("2026-08")).toEqual({
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
    });
  });
});

describe("sormenjälki", () => {
  const events = [
    ev("in", local("2026-08-24", "10:00")),
    ev("out", local("2026-08-24", "18:00")),
  ];

  it("pysyy samana samoista tiedoista", () => {
    expect(fingerprint(slip({ events }))).toBe(fingerprint(slip({ events })));
  });

  /*
   * Tämä on koko sormenjäljen tarkoitus: hyväksytyn laskelman jälkeen
   * tehty muutos on havaittava.
   */
  it("muuttuu kun työaikaa korjataan", () => {
    const ennen = fingerprint(slip({ events }));

    const jalkeen = fingerprint(
      slip({
        events,
        corrections: [
          {
            id: "corr1", userId: "u1", workDate: "2026-08-24",
            correctedIn: local("2026-08-24", "10:00"),
            correctedOut: local("2026-08-24", "19:00"),
            correctedBreakMinutes: 0,
            reason: "Ylityö kirjattiin jälkikäteen",
          },
        ],
      }),
    );

    expect(jalkeen).not.toBe(ennen);
  });

  it("muuttuu kun lisä otetaan käyttöön", () => {
    const ennen = fingerprint(slip({ events }));
    const jalkeen = fingerprint(
      slip({ events, components: [component({ fromMinute: 16 * 60, toMinute: 23 * 60 })] }),
    );

    expect(jalkeen).not.toBe(ennen);
  });
});

describe("yhden päivän ratkaisu", () => {
  it("kertoo lähteeksi leimaukset kun korjausta ei ole", () => {
    const workday = resolveWorkday({
      userId: "u1",
      date: "2026-08-24",
      events: [
        ev("in", local("2026-08-24", "10:00")),
        ev("out", local("2026-08-24", "18:00")),
      ],
      correction: undefined,
      shift,
      nowIso: NOW,
      timezone: ZONE,
    });

    expect(workday.source).toBe("clock");
    expect(workday.correctionId).toBeNull();
    expect(workday.workedMinutes).toBe(480);
  });
});
