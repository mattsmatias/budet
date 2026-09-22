import { describe, expect, it } from "vitest";
import { systemPrompt } from "../prompt";
import type { MattiContext } from "../context";
import type { BusinessType } from "@/lib/restoflow/business";

/**
 * Matti tietää minkä alan yritystä se palvelee.
 *
 * Sama Matti palvelee ravintolaa, kahvilaa ja parturia. Jos toimiala
 * putoaa kehotteesta, parturi saa neuvoja ruokakuluista.
 */
function ctx(businessType: BusinessType): MattiContext {
  return {
    restaurantId: "rest-1",
    restaurantName: "Testi Oy",
    businessType,
    role: "owner",
    userName: "Oktay",
    month: "2026-09",
    today: "2026-09-22",
    now: "2026-09-22T09:00:00Z",
    timezone: "Europe/Helsinki",
    currentPage: null,
    locale: "fi",
    data: {} as MattiContext["data"],
  };
}

describe("Matin kehote toimialan mukaan", () => {
  it("kertoo parturille olevansa parturi-kampaamo", () => {
    const prompt = systemPrompt(ctx("barber"));
    expect(prompt).toContain("parturi-kampaamo");
    expect(prompt).not.toContain("Tämä yritys on ravintola");
  });

  it("kertoo kahvilalle olevansa kahvila", () => {
    expect(systemPrompt(ctx("cafe"))).toContain("Tämä yritys on kahvila");
  });

  it("ohjaa parturin asiakasmäärään eikä raaka-aineisiin", () => {
    const prompt = systemPrompt(ctx("barber"));
    expect(prompt).toContain("# Parturi-kampaamon luvut");
    expect(prompt).toContain("get_break_even");
    expect(prompt).toContain("get_weekday_pattern");
    expect(prompt).not.toContain("# Ravintolan luvut");
  });

  it("ohjaa kahvilan keskiostokseen ja tuotekatteeseen", () => {
    const prompt = systemPrompt(ctx("cafe"));
    expect(prompt).toContain("# Kahvilan luvut");
    expect(prompt).toContain("Keskiostos");
  });

  it("antaa ravintolalle raaka-aineprosentin ja prime costin", () => {
    const prompt = systemPrompt(ctx("restaurant"));
    expect(prompt).toContain("# Ravintolan luvut");
    expect(prompt).toContain("prime cost");
    expect(prompt).toContain("get_price_changes");
  });

  it("pitää ravintolan ravintolana", () => {
    expect(systemPrompt(ctx("restaurant"))).toContain(
      "Tämä yritys on ravintola",
    );
  });
});
