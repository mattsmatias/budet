import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";
import {
  averageCheckCents,
  plausibleReportDate,
  reconcile,
} from "../sales-report";

describe("reconcile", () => {
  it("laskee puuttuvan verottoman", () => {
    const r = reconcile({
      grossCents: 290000,
      vatCents: 40000,
      netCents: null,
    });
    expect(r.netCents).toBe(250000);
    expect(r.derived).toEqual(["netCents"]);
    expect(r.mismatch).toBeNull();
  });

  it("laskee puuttuvan verollisen", () => {
    const r = reconcile({
      grossCents: null,
      vatCents: 40000,
      netCents: 250000,
    });
    expect(r.grossCents).toBe(290000);
    expect(r.derived).toEqual(["grossCents"]);
  });

  it("laskee puuttuvan ALV:n", () => {
    const r = reconcile({
      grossCents: 290000,
      vatCents: null,
      netCents: 250000,
    });
    expect(r.vatCents).toBe(40000);
    expect(r.derived).toEqual(["vatCents"]);
  });

  /*
   * Yhdestä summasta ei voi johtaa toista tuntematta ALV-kantaa, ja
   * ravintolassa kantoja on samassa päivässä kaksi tai kolme: ruoka
   * 14 %, alkoholi 25,5 %. Keksitty kanta tuottaisi luvun joka näyttää
   * oikealta muttei ole.
   */
  it("ei keksi lukua yhdestä summasta", () => {
    const r = reconcile({ grossCents: 290000, vatCents: null, netCents: null });
    expect(r.netCents).toBeNull();
    expect(r.vatCents).toBeNull();
    expect(r.derived).toEqual([]);
  });

  it("hyväksyy kaikki kolme kun ne täsmäävät", () => {
    const r = reconcile({
      grossCents: 290000,
      vatCents: 40000,
      netCents: 250000,
    });
    expect(r.mismatch).toBeNull();
    expect(r.derived).toEqual([]);
  });

  /* Kassan pyöristys on sentin sivussa. Se ei ole virhe. */
  it("sietää sentin pyöristyksen", () => {
    const r = reconcile({
      grossCents: 290001,
      vatCents: 40000,
      netCents: 250000,
    });
    expect(r.mismatch).toBeNull();
  });

  it("kertoo ristiriidan lukuineen", () => {
    const r = reconcile({
      grossCents: 290000,
      vatCents: 40000,
      netCents: 245000,
    });
    /* formatMoney käyttää sitkeää välilyöntiä, joten literaali ei kelpaa. */
    expect(r.mismatch).toContain(formatMoney(290000));
    expect(r.mismatch).toContain(formatMoney(285000));
  });

  it("ei muuta lukuja ristiriidasta huolimatta", () => {
    const r = reconcile({
      grossCents: 290000,
      vatCents: 40000,
      netCents: 245000,
    });
    expect(r.grossCents).toBe(290000);
    expect(r.netCents).toBe(245000);
  });

  it("sietää tyhjän raportin", () => {
    const r = reconcile({ grossCents: null, vatCents: null, netCents: null });
    expect(r.derived).toEqual([]);
    expect(r.mismatch).toBeNull();
  });
});

describe("averageCheckCents", () => {
  it("laskee verollisesta summasta", () => {
    expect(averageCheckCents(290000, 100)).toBe(2900);
  });

  it("pyöristää senttiin", () => {
    expect(averageCheckCents(100000, 3)).toBe(33333);
  });

  /* Avoinna ollut mutta myymätön päivä, ei jakolaskuvirhe. */
  it("ei jaa nollalla", () => {
    expect(averageCheckCents(290000, 0)).toBeNull();
  });

  it("vaatii molemmat luvut", () => {
    expect(averageCheckCents(null, 100)).toBeNull();
    expect(averageCheckCents(290000, null)).toBeNull();
  });
});

describe("plausibleReportDate", () => {
  it("hyväksyy tämän päivän ja eilisen", () => {
    expect(plausibleReportDate("2026-08-25", "2026-08-25")).toBe(true);
    expect(plausibleReportDate("2026-08-24", "2026-08-25")).toBe(true);
  });

  /* Tulevan päivän raporttia ei ole olemassa. */
  it("hylkää tulevan päivän", () => {
    expect(plausibleReportDate("2026-08-26", "2026-08-25")).toBe(false);
  });

  /*
   * Vuosiluku on raportissa se numero joka luetaan väärin useimmin:
   * se on pienimmällä ja usein reunassa.
   */
  it("hylkää liian vanhan päivän", () => {
    expect(plausibleReportDate("2024-12-31", "2026-08-25")).toBe(false);
    expect(plausibleReportDate("2025-01-01", "2026-08-25")).toBe(true);
  });

  it("hylkää muodottoman", () => {
    expect(plausibleReportDate("25.8.2026", "2026-08-25")).toBe(false);
    expect(plausibleReportDate("", "2026-08-25")).toBe(false);
  });
});
