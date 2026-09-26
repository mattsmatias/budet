import { describe, expect, it } from "vitest";
import { trialState, TRIAL_WARNING_DAYS } from "../trial";

/*
 * Kokeilun paivalaskenta.
 *
 * Paattymispaiva on mukana kokeilussa: 30.9. paattyva kokeilu on
 * voimassa koko sen paivan. Yksi paiva suuntaan tai toiseen on
 * asiakkaalle konkreettinen asia, joten se lukitaan testilla eika
 * jateta kommentin varaan.
 */

describe("kokeilun tila", () => {
  it("ei ole kokeilua kun asiakkuus on aktiivinen", () => {
    expect(trialState("active", "2026-10-30", "2026-09-27").kind).toBe("none");
  });

  it("ei ole kokeilua ilman paattymispaivaa", () => {
    expect(trialState("trial", null, "2026-09-27").kind).toBe("none");
  });

  it("on kaynnissa kun aikaa on runsaasti", () => {
    const tila = trialState("trial", "2026-10-27", "2026-09-27");

    expect(tila.kind).toBe("active");
    expect(tila.daysLeft).toBe(30);
    expect(tila.endsOn).toBe("2026-10-27");
  });

  it("varoittaa viikkoa ennen loppua", () => {
    const tila = trialState("trial", "2026-10-04", "2026-09-27");

    expect(tila.daysLeft).toBe(TRIAL_WARNING_DAYS);
    expect(tila.kind).toBe("ending");
  });

  it("ei varoita viela kahdeksan paivan paassa", () => {
    expect(trialState("trial", "2026-10-05", "2026-09-27").kind).toBe("active");
  });

  it("on yha voimassa paattymispaivana", () => {
    const tila = trialState("trial", "2026-09-27", "2026-09-27");

    expect(tila.kind).toBe("ending");
    expect(tila.daysLeft).toBe(0);
  });

  it("on paattynyt seuraavana paivana", () => {
    const tila = trialState("trial", "2026-09-27", "2026-09-28");

    expect(tila.kind).toBe("ended");
    expect(tila.daysLeft).toBe(-1);
  });

  it("kertoo montako paivaa kokeilun paattymisesta on", () => {
    expect(trialState("trial", "2026-09-01", "2026-09-27").daysLeft).toBe(-26);
  });

  it("kestaa kesaajan vaihtumisen yli", () => {
    /* 25.10.2026 kello siirtyy: paivien maara ei saa heittaa. */
    const tila = trialState("trial", "2026-11-01", "2026-10-20");

    expect(tila.daysLeft).toBe(12);
  });
});
