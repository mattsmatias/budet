import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { staffCost, staffCostPerHour } from "../staff-cost";
import {
  AIKAVYOHYKE,
  ASETUKSET,
  MARA,
  PAIVAKUVAUKSET,
  kuukaudenVuorot,
  kuukausitapaukset,
  tapaukset,
  tyontekija,
  vuoro,
  type Kuukausitapaus,
  type Tapaus,
  type Tulos,
} from "./karakterisointi/tapaukset";

/*
 * Karakterisointitesti ennen TES-moottorin refaktorointia.
 *
 * HYVÄKSYMISKRITEERI REFAKTOROINNILLE.
 *
 * Uusi sääntömuotoinen moottori saa muuttaa kaiken sisältä, mutta
 * jokaisen tapauksen on tuotettava sentilleen sama tulos. Jos jokin
 * luku muuttuu, muutos on joko virhe tai tietoinen korjaus — ja
 * kumpikin pitää nähdä, ei ohittaa.
 *
 * ODOTUKSIA EI SAA PÄIVITTÄÄ TESTIN LÄPI SAAMISEKSI.
 *
 * Fixture on tuotettu ajamalla nykyinen moottori. Sen uudelleen
 * kirjoittaminen vaatii ympäristömuuttujan, jotta sitä ei voi tehdä
 * vahingossa eikä huomaamatta:
 *
 *   KARAKTERISOINTI=kirjoita npx vitest run karakterisointi
 *
 * Testi kulkee vain julkisen staffCost()-rajapinnan kautta. Se ei
 * tunne MinuteSplitiä, lisälajeja eikä asetusten muotoa.
 */

const FIXTURE = new URL(
  "./karakterisointi/odotukset.json",
  import.meta.url,
);

const KIRJOITA = process.env.KARAKTERISOINTI === "kirjoita";

/** Yhden tapauksen kustannus nykyisellä moottorilla. */
function ajaKuukausi(tapaus: Kuukausitapaus): Tulos {
  return poimi(
    staffCost(
      [tyontekija(tapaus.tuntipalkka)],
      kuukaudenVuorot(tapaus),
      tapaus.kuukausi,
      AIKAVYOHYKE,
      ASETUKSET,
      MARA,
    ),
  );
}

function poimi(tulos: ReturnType<typeof staffCost>): Tulos {
  const { total } = tulos;

  return {
    minutes: total.minutes,
    baseCents: total.baseCents,
    supplementCents: total.supplementCents,
    holidayCents: total.holidayCents,
    sideCostCents: total.sideCostCents,
    totalCents: total.totalCents,
    perHourCents: staffCostPerHour(total),
    missingTes: tulos.missingTes,
  };
}

function aja(tapaus: Tapaus): Tulos {
  return poimi(
    staffCost(
      [tyontekija(tapaus.tuntipalkka)],
      [vuoro(tapaus)],
      tapaus.paiva.slice(0, 7),
      AIKAVYOHYKE,
      ASETUKSET,
      MARA,
    ),
  );
}

const KAIKKI = tapaukset();
const KUUKAUDET = kuukausitapaukset();

if (KIRJOITA) {
  const talteen: Record<string, Tulos> = {};
  for (const tapaus of KAIKKI) talteen[tapaus.avain] = aja(tapaus);
  for (const kk of KUUKAUDET) talteen[kk.avain] = ajaKuukausi(kk);

  const rivit = Object.entries(talteen).map(
    ([avain, tulos]) => `  ${JSON.stringify(avain)}: ${JSON.stringify(tulos)}`,
  );

  writeFileSync(FIXTURE, `{\n${rivit.join(",\n")}\n}\n`, "utf8");
}

const odotukset: Record<string, Tulos> = existsSync(FIXTURE)
  ? JSON.parse(readFileSync(FIXTURE, "utf8"))
  : {};

describe("karakterisointi: MaRa nykyisellä moottorilla", () => {
  it("fixture on olemassa", () => {
    /*
     * Puuttuva fixture on virhe eikä tyhjä lähtötilanne: ilman sitä
     * testi menisi läpi lukitsematta mitään.
     */
    expect(existsSync(FIXTURE)).toBe(true);
  });

  it("kattaa kaikki tapaukset eikä yhtään ylimääräistä", () => {
    expect(Object.keys(odotukset).sort()).toEqual(
      [...KAIKKI.map((t) => t.avain), ...KUUKAUDET.map((t) => t.avain)].sort(),
    );
  });

  for (const tapaus of KAIKKI) {
    const kuvaus = PAIVAKUVAUKSET.get(tapaus.paiva) ?? tapaus.paiva;

    it(`${tapaus.avain} (${kuvaus})`, () => {
      expect(aja(tapaus)).toEqual(odotukset[tapaus.avain]);
    });
  }
});

describe("karakterisointi on determinististä", () => {
  it("sama tapaus tuottaa saman tuloksen kahdesti", () => {
    const tapaus = KAIKKI.find((t) => t.minuutit === 480)!;

    expect(aja(tapaus)).toEqual(aja(tapaus));
  });

  it("tulos ei riipu kutsujärjestyksestä", () => {
    const eka = KAIKKI[0];
    const toka = KAIKKI[KAIKKI.length - 1];

    const ekaEnsin = [aja(eka), aja(toka)];
    const tokaEnsin = [aja(toka), aja(eka)];

    expect(ekaEnsin[0]).toEqual(tokaEnsin[1]);
    expect(ekaEnsin[1]).toEqual(tokaEnsin[0]);
  });
});

describe("karakterisointi lukitsee kustannusketjun", () => {
  /*
   * Ketjun jokainen vaihe erikseen.
   *
   * Pelkkä loppusumma ei riittäisi: kaksi eri tavalla väärää välierää
   * voi tuottaa saman summan, ja silloin refaktorointi läpäisisi
   * testin väärin perustein.
   */
  it("jokainen tapaus noudattaa samaa järjestystä", () => {
    for (const tapaus of KAIKKI) {
      const t = odotukset[tapaus.avain];
      if (!t || t.minutes === 0) continue;

      const palkkakustannus = t.baseCents + t.supplementCents;
      const loma = Math.round(palkkakustannus * ASETUKSET.holidayRate);
      const sivu = Math.round(
        (palkkakustannus + loma) * ASETUKSET.sideCostRate,
      );

      expect({
        avain: tapaus.avain,
        loma: t.holidayCents,
        sivu: t.sideCostCents,
        yhteensa: t.totalCents,
      }).toEqual({
        avain: tapaus.avain,
        loma,
        sivu,
        yhteensa: palkkakustannus + loma + sivu,
      });
    }
  });

  it("tuntikustannus on kokonaiskustannus jaettuna tunneilla", () => {
    for (const tapaus of KAIKKI) {
      const t = odotukset[tapaus.avain];
      if (!t || t.minutes === 0) continue;

      expect(t.perHourCents).toBe(
        Math.round(t.totalCents / (t.minutes / 60)),
      );
    }
  });
});

describe("karakterisointi havaitsee muutoksen", () => {
  /*
   * Turvaverkko jolla ei ole reikia.
   *
   * Testi joka lukitsee vaarat luvut lapaisee refaktoroinnin joka
   * rikkoo laskennan. Tama muuttaa yhta TES-arvoa tarkoituksella ja
   * vaatii etta ero nakyy: jos ei nay, fixture ei vartioi mitaan.
   */
  it("yhden sentin ero iltalisassa rikkoo tapauksia", () => {
    const muutettu = MARA.map((versio) => ({
      ...versio,
      rules: versio.rules.map((saanto) =>
        saanto.ruleType === "evening"
          ? { ...saanto, value: saanto.value + 0.01 }
          : saanto,
      ),
    }));

    /* Iltatunnit riittavat: koko matriisin ajo toiseen kertaan olisi hidas. */
    const otos = KAIKKI.filter(
      (t) => t.kello === "18:00" && t.minuutit === 60,
    );

    const erot = otos.filter((tapaus) => {
      const tulos = staffCost(
        [tyontekija(tapaus.tuntipalkka)],
        [vuoro(tapaus)],
        tapaus.paiva.slice(0, 7),
        AIKAVYOHYKE,
        ASETUKSET,
        muutettu,
      ).total;

      return tulos.totalCents !== odotukset[tapaus.avain]?.totalCents;
    });

    expect(otos.length).toBeGreaterThan(0);
    expect(erot.length).toBe(otos.length);
  });
});

describe("karakterisointi: kuukausi useasta vuorosta", () => {
  /*
   * Vuorojen valinen summaus.
   *
   * Nykyinen moottori laskee ja pyoristaa vuoron kerrallaan ja
   * summaa vasta sitten. Kuukausitasolla pyoristava moottori antaisi
   * eri sentit, eika yhden vuoron tapaus huomaisi sita.
   */
  for (const tapaus of KUUKAUDET) {
    it(tapaus.avain, () => {
      expect(ajaKuukausi(tapaus)).toEqual(odotukset[tapaus.avain]);
    });
  }

  it("kuukauden summa on vuorojen summa sentilleen", () => {
    for (const tapaus of KUUKAUDET) {
      const osat = tapaus.vuorot.map((v) =>
        aja({
          avain: "osa",
          paiva: v.paiva,
          kello: v.kello,
          minuutit: v.minuutit,
          tuntipalkka: tapaus.tuntipalkka,
        }),
      );

      const summa = osat.reduce((a, b) => a + b.totalCents, 0);

      expect({ avain: tapaus.avain, summa }).toEqual({
        avain: tapaus.avain,
        summa: odotukset[tapaus.avain].totalCents,
      });
    }
  });
});
