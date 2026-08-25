import { describe, expect, it } from "vitest";
import { ALERT_KINDS, alertIcon } from "../alert-icons";

describe("alertIcon", () => {
  /*
   * Taulukko on tyypitetty täydelliseksi, mutta tyyppi ei estä
   * kirjoittamasta samaa avainta kahdesti eikä kerro jos joku
   * poistetaan. Luku on tässä siksi, että uusi huomiotyyppi ei valu
   * sisään ilman ikonipäätöstä.
   */
  it("kattaa kaikki huomiotyypit", () => {
    expect(ALERT_KINDS).toHaveLength(16);
  });

  it("antaa jokaiselle ikonin", () => {
    for (const kind of ALERT_KINDS) {
      expect(alertIcon(kind)).toBeTruthy();
    }
  });

  it("antaa kuittiaiheille kuitin ja vuoroaiheille kellon", () => {
    expect(alertIcon("receipt_needs_review")).toBe("receipt");
    expect(alertIcon("duplicate_receipt")).toBe("receipt");
    expect(alertIcon("late_clock_in")).toBe("clock");
    expect(alertIcon("budget_exceeded")).toBe("budget");
  });

  /*
   * Sama aihe, eri vakavuus, sama ikoni. Vakavuus on värissä; jos se
   * olisi myös muodossa, muoto ei kertoisi aiheesta mitään.
   */
  it("ei erottele vakavuutta muodolla", () => {
    expect(alertIcon("budget_warning")).toBe(alertIcon("budget_exceeded"));
  });
});
