/**
 * Karakterisointitapaukset: nykyisen moottorin käyttäytyminen lukittuna.
 *
 * MIKSI TÄMÄ ON OLEMASSA.
 *
 * TES-moottori aiotaan kirjoittaa sääntömuotoiseksi. Nykyiset testit
 * eivät riitä turvaverkoksi, koska osa niistä rakentaa `MinuteSplit`-
 * olioita käsin ja kutsuu `employerCost`ia suoraan — juuri ne
 * rakenteet jotka refaktoroinnissa katoavat. Kun testi tuntee
 * moottorin sisukset, se katoaa moottorin mukana.
 *
 * Tämä tiedosto kulkee siksi vain julkisen `staffCost()`-rajapinnan
 * kautta. Se ei tiedä lisälajeista, minuuttijaosta eikä asetusten
 * muodosta — vain sen, mitä työ maksaa. Uusi moottori saa olla
 * sisältä mitä tahansa, kunhan se tuottaa samat luvut.
 *
 * TAPAUKSET EIVÄT OLE MIELIPITEITÄ.
 *
 * Odotusarvot on tuotettu ajamalla nykyinen moottori, ei laskemalla
 * käsin. Ne eivät kerro mikä on oikein vaan mitä Kate tänään tekee.
 * Jos refaktorointi muuttaa jonkin luvun, ero on joko virhe tai
 * tietoinen korjaus — kumpikin on parempi nähdä kuin olla näkemättä.
 */

import type { Employee, TimeEntry } from "../../employees";
import { DEFAULT_PAYROLL, type PayrollSettings } from "../../payroll";
import type { TesAgreement } from "../../tes";

export const AIKAVYOHYKE = "Europe/Helsinki";

/**
 * MaRa niin kuin se on tuotantokannassa.
 *
 * Arvot ovat PAM:n ja MaRan aineistosta: iltalisä 1,40 €/h klo 18–24,
 * yölisä 2,37 €/h klo 00–06, sunnuntai- ja pyhätyö 100 %, aattotyö
 * 50 % klo 15–24. Seuraava kausi 1.7.2027 nostaa lisät 1,43 ja 2,43.
 */
function saanto(
  ruleType: "evening" | "night" | "sunday" | "eve",
  value: number,
  unit: "eur_per_hour" | "percent",
  startTime: string | null = null,
  endTime: string | null = null,
) {
  return {
    id: `${ruleType}`,
    ruleType,
    name: ruleType,
    unit,
    value,
    startTime,
    endTime,
  };
}

export const MARA: TesAgreement[] = [
  {
    id: "marava-1",
    slug: "marava",
    name: "Matkailu-, ravintola- ja vapaa-ajan palveluiden TES",
    industry: "restaurant",
    validFrom: "2025-09-01",
    validUntil: "2027-06-30",
    isActive: true,
    rules: [
      saanto("evening", 1.4, "eur_per_hour", "18:00", "24:00"),
      saanto("night", 2.37, "eur_per_hour", "00:00", "06:00"),
      saanto("sunday", 100, "percent"),
      saanto("eve", 50, "percent", "15:00", "24:00"),
    ],
  },
  {
    id: "marava-2",
    slug: "marava",
    name: "Matkailu-, ravintola- ja vapaa-ajan palveluiden TES",
    industry: "restaurant",
    validFrom: "2027-07-01",
    validUntil: "2028-03-31",
    isActive: true,
    rules: [
      saanto("evening", 1.43, "eur_per_hour", "18:00", "24:00"),
      saanto("night", 2.43, "eur_per_hour", "00:00", "06:00"),
      saanto("sunday", 100, "percent"),
      saanto("eve", 50, "percent", "15:00", "24:00"),
    ],
  },
];

/**
 * Yrityksen omat kulut.
 *
 * Lomakustannus ja sivukulut eivät tule sopimuksesta vaan yritykseltä.
 * Nollat eivät kelpaisi: silloin testi ei lukitsisi kustannusketjun
 * kahta viimeistä vaihetta lainkaan.
 */
export const ASETUKSET: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  holidayRate: 0.115,
  sideCostRate: 0.23,
};

export function tyontekija(hourlyCents: number): Employee {
  return {
    id: "karakterisointi",
    firstName: "Karakterisointi",
    lastName: "Testi",
    email: null,
    jobTitle: null,
    hourlyCents,
    active: true,
    linked: false,
  };
}

/** Aikavyöhykkeen siirtymä millisekunteina annetulla hetkellä. */
function siirtyma(ts: number, timezone: string): number {
  const osat = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));

  const arvo = (tyyppi: string) =>
    Number(osat.find((o) => o.type === tyyppi)?.value ?? "0");

  const paikallisena = Date.UTC(
    arvo("year"),
    arvo("month") - 1,
    arvo("day"),
    arvo("hour") % 24,
    arvo("minute"),
    arvo("second"),
  );

  return paikallisena - ts;
}

/**
 * Paikallinen seinäkelloaika todelliseksi hetkeksi.
 *
 * Kesäajan vaihtumisen kohdalla sama seinäkelloaika voi esiintyä
 * kahdesti tai ei kertaakaan. Tämä valitsee niistä aina saman, jotta
 * testi on determinististä eikä riipu ajohetkestä.
 */
export function paikallinen(
  paiva: string,
  kello: string,
  timezone = AIKAVYOHYKE,
): Date {
  const naiivi = Date.parse(`${paiva}T${kello}:00Z`);
  const eka = naiivi - siirtyma(naiivi, timezone);
  return new Date(naiivi - siirtyma(eka, timezone));
}

export interface Tapaus {
  avain: string;
  paiva: string;
  kello: string;
  minuutit: number;
  tuntipalkka: number;
}

/* Päivät jotka kattavat sopimuksen erikoistapaukset. */
const PAIVAT: { paiva: string; kuvaus: string }[] = [
  { paiva: "2026-09-01", kuvaus: "arkitiistai" },
  { paiva: "2026-09-05", kuvaus: "lauantai" },
  { paiva: "2026-09-06", kuvaus: "sunnuntai" },
  { paiva: "2026-04-30", kuvaus: "vapunaatto" },
  { paiva: "2026-05-01", kuvaus: "vappu, pyhäpäivä" },
  { paiva: "2026-12-24", kuvaus: "jouluaatto" },
  { paiva: "2026-12-25", kuvaus: "joulupäivä" },
  { paiva: "2026-10-25", kuvaus: "kesäajan loppu" },
  { paiva: "2027-03-28", kuvaus: "kesäajan alku" },
  { paiva: "2027-06-30", kuvaus: "sopimusversion viimeinen päivä" },
  { paiva: "2027-07-01", kuvaus: "sopimusversion ensimmäinen päivä" },
];

/* Kellonajat jotka osuvat lisien rajoille. */
const KELLOT = ["00:00", "05:00", "06:00", "17:00", "18:00", "23:00"];

/* Kestot: minuutti, vajaa tunti, tasatunti ja täysi vuoro. */
const KESTOT = [1, 23, 60, 480];

/* Tuntipalkat eri suuruusluokista. */
const PALKAT = [1000, 1450, 1990, 2500];

export const PAIVAKUVAUKSET = new Map(
  PAIVAT.map((p) => [p.paiva, p.kuvaus]),
);

/** Kaikki tapaukset vakaassa järjestyksessä. */
export function tapaukset(): Tapaus[] {
  const kaikki: Tapaus[] = [];

  for (const { paiva } of PAIVAT) {
    for (const kello of KELLOT) {
      for (const minuutit of KESTOT) {
        for (const tuntipalkka of PALKAT) {
          kaikki.push({
            avain: `${paiva} ${kello} ${String(minuutit).padStart(3, "0")}min ${tuntipalkka}c`,
            paiva,
            kello,
            minuutit,
            tuntipalkka,
          });
        }
      }
    }
  }

  return kaikki;
}

/** Yksi vuoro paikallisesta kellonajasta. */
export function vuoro(tapaus: Tapaus): TimeEntry {
  const alku = paikallinen(tapaus.paiva, tapaus.kello);

  return {
    id: tapaus.avain,
    employeeId: "karakterisointi",
    date: tapaus.paiva,
    clockIn: alku.toISOString(),
    clockOut: new Date(alku.getTime() + tapaus.minuutit * 60_000).toISOString(),
    minutes: tapaus.minuutit,
  };
}

/** Lukittavat luvut. Kaikki sentteinä, tunnit minuutteina. */
export interface Tulos {
  minutes: number;
  baseCents: number;
  supplementCents: number;
  holidayCents: number;
  sideCostCents: number;
  totalCents: number;
  perHourCents: number | null;
  missingTes: string[];
}

/**
 * Kuukausitapaukset: useita vuoroja samassa kuussa.
 *
 * Yhden vuoron tapaukset eivät lukitse sitä, että kustannukset
 * lasketaan ja pyöristetään vuoro kerrallaan ja summataan vasta
 * sitten. Kuukausitasolla pyöristävä moottori antaisi eri sentit
 * eikä yksikään yhden vuoron tapaus huomaisi sitä.
 */
export interface Kuukausitapaus {
  avain: string;
  kuukausi: string;
  tuntipalkka: number;
  vuorot: { paiva: string; kello: string; minuutit: number }[];
}

export function kuukausitapaukset(): Kuukausitapaus[] {
  const mallit: {
    nimi: string;
    kuukausi: string;
    vuorot: { paiva: string; kello: string; minuutit: number }[];
  }[] = [
    {
      nimi: "arki-sunnuntai-aatto",
      kuukausi: "2026-12",
      vuorot: [
        { paiva: "2026-12-01", kello: "09:00", minuutit: 480 },
        { paiva: "2026-12-06", kello: "18:00", minuutit: 300 },
        { paiva: "2026-12-24", kello: "14:00", minuutit: 480 },
        { paiva: "2026-12-25", kello: "22:00", minuutit: 240 },
      ],
    },
    {
      nimi: "viisi-vajaata-vuoroa",
      kuukausi: "2026-09",
      vuorot: [
        { paiva: "2026-09-01", kello: "17:50", minuutit: 23 },
        { paiva: "2026-09-02", kello: "23:50", minuutit: 23 },
        { paiva: "2026-09-03", kello: "05:50", minuutit: 23 },
        { paiva: "2026-09-05", kello: "13:00", minuutit: 23 },
        { paiva: "2026-09-06", kello: "18:00", minuutit: 23 },
      ],
    },
    {
      nimi: "kesaajan-siirtyma",
      kuukausi: "2026-10",
      vuorot: [
        { paiva: "2026-10-24", kello: "22:00", minuutit: 300 },
        { paiva: "2026-10-25", kello: "00:00", minuutit: 420 },
      ],
    },
    {
      nimi: "sopimusversion-vaihtuminen",
      kuukausi: "2027",
      vuorot: [
        { paiva: "2027-06-30", kello: "18:00", minuutit: 360 },
        { paiva: "2027-07-01", kello: "18:00", minuutit: 360 },
      ],
    },
  ];

  const kaikki: Kuukausitapaus[] = [];

  for (const malli of mallit) {
    for (const tuntipalkka of PALKAT) {
      kaikki.push({
        avain: `kuukausi ${malli.nimi} ${tuntipalkka}c`,
        kuukausi: malli.kuukausi,
        tuntipalkka,
        vuorot: malli.vuorot,
      });
    }
  }

  return kaikki;
}

/** Kuukausitapauksen vuorot leimauksiksi. */
export function kuukaudenVuorot(tapaus: Kuukausitapaus): TimeEntry[] {
  return tapaus.vuorot.map((v, i) => {
    const alku = paikallinen(v.paiva, v.kello);

    return {
      id: `${tapaus.avain}-${i}`,
      employeeId: "karakterisointi",
      date: v.paiva,
      clockIn: alku.toISOString(),
      clockOut: new Date(alku.getTime() + v.minuutit * 60_000).toISOString(),
      minutes: v.minuutit,
    };
  });
}
