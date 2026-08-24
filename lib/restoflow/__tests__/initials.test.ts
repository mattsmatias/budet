import { describe, expect, it } from "vitest";
import { initials } from "../initials";

describe("initials", () => {
  it("ottaa kahden sanan alkukirjaimet", () => {
    expect(initials("S-Market Kajaani")).toBe("SK");
    expect(initials("Metro Tukku")).toBe("MT");
  });

  it("ottaa yhdestä sanasta kaksi ensimmäistä kirjainta", () => {
    expect(initials("Kespro")).toBe("KE");
    expect(initials("Wolt")).toBe("WO");
  });

  it("sietää ylimääräiset välit", () => {
    expect(initials("  Metro   Tukku  ")).toBe("MT");
  });

  /*
   * Sitkeä välilyönti tulee suomalaisista syötteistä ja on eri merkki
   * kuin tavallinen välilyönti. Ilman tätä "Metro Tukku" olisi yksi
   * sana ja laatta lukisi "ME".
   */
  it("katkaisee myös sitkeästä välilyönnistä", () => {
    expect(initials("Metro\u00a0Tukku")).toBe("MT");
  });

  it("ei kaadu tyhjästä nimestä", () => {
    expect(initials("   ")).toBe("?");
  });

  it("suurentaa kirjaimet", () => {
    expect(initials("kespro oy")).toBe("KO");
  });
});
