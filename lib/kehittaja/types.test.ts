import { describe, expect, it } from "vitest";
import {
  PLAN_LABELS,
  STATUS_LABELS,
  healthOf,
  statusTone,
  type RestaurantStatus,
} from "./types";

const NYT = new Date("2026-08-26T12:00:00Z");

function paivaaSitten(n: number): string {
  return new Date(NYT.getTime() - n * 86_400_000).toISOString();
}

describe("statusTone", () => {
  it("antaa jokaiselle tilalle sävyn", () => {
    const tilat: RestaurantStatus[] = [
      "trial",
      "active",
      "suspended",
      "cancelled",
      "archived",
    ];
    for (const tila of tilat) {
      expect(statusTone(tila)).toBeTruthy();
    }
  });

  /*
   * Punainen on varattu sille mikä vaatii toimenpiteen.
   *
   * Keskeytys on oma päätös eikä hälytys, joten se ei saa punaista —
   * muuten oma toiminta näyttää järjestelmävialta.
   */
  it("varaa punaisen päättyneelle asiakkuudelle", () => {
    expect(statusTone("cancelled")).toBe("risk");
    expect(statusTone("suspended")).not.toBe("risk");
    expect(statusTone("active")).toBe("ok");
  });
});

describe("STATUS_LABELS ja PLAN_LABELS", () => {
  it("kattaa kaikki tilat ja paketit", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(5);
    expect(Object.keys(PLAN_LABELS)).toHaveLength(4);
  });
});

describe("healthOf", () => {
  it("pitää tänään kirjautunutta terveenä", () => {
    const { level } = healthOf(paivaaSitten(0), "active", NYT);
    expect(level).toBe("healthy");
  });

  it("nostaa huomion kahden viikon jälkeen", () => {
    expect(healthOf(paivaaSitten(13), "active", NYT).level).toBe("healthy");
    expect(healthOf(paivaaSitten(14), "active", NYT).level).toBe("attention");
  });

  it("nostaa riskin kuukauden jälkeen", () => {
    expect(healthOf(paivaaSitten(29), "active", NYT).level).toBe("attention");
    expect(healthOf(paivaaSitten(30), "active", NYT).level).toBe("risk");
  });

  it("kertoo syyn päivinä", () => {
    expect(healthOf(paivaaSitten(21), "active", NYT).reason).toContain("21");
  });

  /*
   * Keskeytetty ei ole "ei kirjautunut pitkään aikaan".
   *
   * Syy on tiedossa: käyttö on katkaistu. Jos tila kerrottaisiin
   * kirjautumisen perusteella, keskeytetty ravintola näyttäisi
   * ajautuneen pois itsestään.
   */
  it("kertoo keskeytyksen syyksi tilan eikä kirjautumista", () => {
    const tulos = healthOf(paivaaSitten(0), "suspended", NYT);
    expect(tulos.level).toBe("risk");
    expect(tulos.reason).toBe(STATUS_LABELS.suspended);
  });

  it("ei pidä arkistoitua ongelmana", () => {
    expect(healthOf(null, "archived", NYT).level).toBe("healthy");
  });

  it("nostaa huomion jos kukaan ei ole koskaan kirjautunut", () => {
    const tulos = healthOf(null, "active", NYT);
    expect(tulos.level).toBe("attention");
    expect(tulos.reason).toContain("Ei yhtään");
  });
});
