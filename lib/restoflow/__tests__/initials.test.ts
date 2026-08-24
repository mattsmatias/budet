import { describe, expect, it } from "vitest";
import { initials, personInitials } from "../initials";

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

describe("personInitials", () => {
  it("ottaa etunimen ja sukunimen alkukirjaimet", () => {
    expect(personInitials("Oktay Hun")).toBe("OH");
  });

  /*
   * Toinen etunimi ei ole se jolla ihmistä kutsutaan. Sukunimi on
   * viimeinen sana, ei toinen — tässä initials() ja personInitials()
   * eroavat toisistaan.
   */
  it("ohittaa toisen etunimen", () => {
    expect(personInitials("Oktay Matias Hun")).toBe("OH");
    expect(initials("Oktay Matias Hun")).toBe("OM");
  });

  it("antaa yhdestä sanasta kaksi kirjainta", () => {
    expect(personInitials("Oktay")).toBe("OK");
  });

  it("ei kaadu tyhjästä", () => {
    expect(personInitials("  ")).toBe("?");
  });
});
