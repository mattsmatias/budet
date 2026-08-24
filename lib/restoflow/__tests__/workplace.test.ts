import { describe, expect, it } from "vitest";
import { birthdaySentence, birthdaysToday, formatBirthday } from "../workplace";
import type { Colleague } from "../queries";

const ZONE = "Europe/Helsinki";

function person(partial: Partial<Colleague> = {}): Colleague {
  return {
    id: "u1",
    name: "Minna Virtanen",
    initials: "MV",
    position: "waiter",
    avatarUrl: null,
    birthDay: 24,
    birthMonth: 8,
    ...partial,
  };
}

describe("syntymäpäivän muotoilu", () => {
  it("näyttää päivän ja kuukauden ilman vuotta", () => {
    expect(formatBirthday(24, 8)).toBe("24. elokuuta");
    expect(formatBirthday(1, 1)).toBe("1. tammikuuta");
  });

  // Vuotta ei ole edes tallennettu, joten sitä ei voi vahingossa näyttää.
  it("ei sisällä vuosilukua", () => {
    expect(formatBirthday(24, 8)).not.toMatch(/\d{4}/);
  });
});

describe("tämän päivän syntymäpäivät", () => {
  /*
   * Päivä luetaan ravintolan ajassa. Klo 01:00 Helsingissä on UTC:ssä
   * vielä edellinen päivä, ja syntymäpäivä vääränä päivänä on juuri se
   * pieni virhe jonka joku huomaa.
   */
  const yollaHelsingissa = "2026-08-23T22:30:00.000Z"; // 24.8. klo 01:30

  it("löytää sankarin paikallisen päivän mukaan", () => {
    expect(birthdaysToday([person()], yollaHelsingissa, ZONE)).toHaveLength(1);
  });

  it("ei löydä sankaria UTC-päivän mukaan", () => {
    expect(birthdaysToday([person()], yollaHelsingissa, "UTC")).toHaveLength(0);
  });

  it("ohittaa merkitsemättömät", () => {
    const tuntematon = person({ birthDay: null, birthMonth: null });
    expect(birthdaysToday([tuntematon], yollaHelsingissa, ZONE)).toHaveLength(0);
  });

  it("ohittaa muut päivät", () => {
    const toinen = person({ birthDay: 25, birthMonth: 8 });
    expect(birthdaysToday([toinen], yollaHelsingissa, ZONE)).toHaveLength(0);
  });
});

describe("onnittelulause", () => {
  /*
   * Nimeä ei taivuteta.
   *
   * Genetiivi vaatisi astevaihtelun: "Mikko" -> "Mikon". Naiivi sääntö
   * tuotti "Mikkon", ja väärin taivutettu nimi on juuri se yksityiskohta
   * jonka omistaja huomaa heti.
   */
  it("käyttää nimeä perusmuodossa", () => {
    expect(birthdaySentence(["Minna Virtanen"])).toBe("Minna täyttää tänään vuosia!");
  });

  it("ei taivuta myöskään astevaihtelullista nimeä", () => {
    const lause = birthdaySentence(["Mikko Nieminen"]);
    expect(lause).toBe("Mikko täyttää tänään vuosia!");
    expect(lause).not.toContain("Mikkon");
  });

  it("yhdistää kaksi nimeä ja-sanalla", () => {
    expect(birthdaySentence(["Minna V", "Mikko N"])).toBe(
      "Minna ja Mikko täyttävät tänään vuosia!",
    );
  });

  it("luettelee useamman pilkuin", () => {
    expect(birthdaySentence(["Minna V", "Mikko N", "Laura L"])).toBe(
      "Minna, Mikko ja Laura täyttävät tänään vuosia!",
    );
  });

  it("kestää tyhjän listan", () => {
    expect(birthdaySentence([])).toBe("");
  });
});
