import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Varauswidget.
 *
 * Widget on yksi riippumaton tiedosto public-kansiossa: sitä ei
 * käännetä, se ei tuo mitään, ja se ladataan vieraalta sivustolta.
 * Siksi sitä ei voi tuoda tähän moduulina — testi lukee lähteen ja
 * tarkistaa siitä ne asiat jotka voivat hiljaa mennä rikki.
 *
 * Tärkein niistä on kielten avaimet. Sanakirja on kopio, koska widget
 * ei voi tuoda lib/i18n:ää, ja kopio jää päivittämättä.
 */

const LAHDE = readFileSync(
  fileURLToPath(new URL("../../../public/widget.js", import.meta.url)),
  "utf8",
);

const KIELET = ["fi", "en", "sv", "da", "tr", "et"];

/**
 * Sanakirja irti lähteestä.
 *
 * Sulkeiden laskenta eikä regex: sanakirjassa on aaltosulkeita myös
 * merkkijonojen sisällä ({maara}), ja ahne haku söisi väärän kohdan.
 */
function lueTekstit(): Record<string, Record<string, string>> {
  const merkki = "var TEKSTIT = {";
  const alku = LAHDE.indexOf(merkki);
  if (alku === -1) throw new Error("TEKSTIT-objektia ei löydy widget.js:stä");

  let syvyys = 0;
  let jono: string | null = null;

  for (let i = alku + merkki.length - 1; i < LAHDE.length; i++) {
    const c = LAHDE[i];

    if (jono) {
      if (c === "\\") i++;
      else if (c === jono) jono = null;
      continue;
    }

    if (c === '"' || c === "'") jono = c;
    else if (c === "{") syvyys++;
    else if (c === "}") {
      syvyys--;
      if (syvyys === 0) {
        const koodi = LAHDE.slice(alku + merkki.length - 1, i + 1);
        return new Function(`return ${koodi}`)() as Record<
          string,
          Record<string, string>
        >;
      }
    }
  }

  throw new Error("TEKSTIT-objektin sulkeet eivät mene umpeen");
}

const TEKSTIT = lueTekstit();

describe("widgetin kielet", () => {
  it("kattaa samat kuusi kieltä kuin sovellus", () => {
    expect(Object.keys(TEKSTIT).sort()).toEqual([...KIELET].sort());
  });

  it("jokaisella kielellä on samat avaimet", () => {
    const perusta = Object.keys(TEKSTIT.fi).sort();

    for (const kieli of KIELET) {
      expect(Object.keys(TEKSTIT[kieli]).sort(), kieli).toEqual(perusta);
    }
  });

  it("yksikään teksti ei ole tyhjä", () => {
    for (const kieli of KIELET) {
      for (const [avain, arvo] of Object.entries(TEKSTIT[kieli])) {
        expect(arvo.trim(), `${kieli}.${avain}`).not.toBe("");
      }
    }
  });

  it("suomenkielistä tekstiä ei ole jäänyt muihin kieliin", () => {
    /*
     * Sama tarkistus kuin admin-text.test.ts:ssä. Lyhyt sana voi olla
     * sama kahdella kielellä ("Walk-in"), joten raja on pituudessa:
     * pitkä identtinen lause on kääntämättä jäänyt eikä sattuma.
     */
    for (const kieli of KIELET.filter((k) => k !== "fi")) {
      for (const [avain, arvo] of Object.entries(TEKSTIT[kieli])) {
        if (arvo.length < 14) continue;
        expect(arvo, `${kieli}.${avain}`).not.toBe(TEKSTIT.fi[avain]);
      }
    }
  });

  it("jokainen virhekoodi on käännetty", () => {
    /*
     * VIRHEET kartoittaa palvelimen koodin tekstiavaimeksi. Jos kartta
     * osoittaa avaimeen jota ei ole, asiakas näkee tyhjän virheen
     * juuri silloin kun jokin meni pieleen.
     */
    const kartta = LAHDE.slice(
      LAHDE.indexOf("var VIRHEET = {"),
      LAHDE.indexOf("};", LAHDE.indexOf("var VIRHEET = {")),
    );

    const avaimet = [...kartta.matchAll(/"(err[A-Za-z]+)"/g)].map((m) => m[1]);
    expect(avaimet.length).toBeGreaterThan(5);

    for (const avain of avaimet) {
      for (const kieli of KIELET) {
        expect(TEKSTIT[kieli][avain], `${kieli}.${avain}`).toBeTruthy();
      }
    }
  });
});

describe("widgetin turvallisuus", () => {
  it("ei kirjoita sivulle innerHTML:llä", () => {
    /*
     * Asiakkaan nimi, ravintolan nimi ja muistiinpano piirtyvät
     * sellaisenaan. innerHTML tekisi niistä suoritettavaa koodia
     * ravintolan omalla sivulla — siis XSS ravintolan verkkotunnuksessa.
     * textContent ei suorita mitään.
     */
    expect(LAHDE).not.toMatch(/\.innerHTML\s*=/);
    expect(LAHDE).not.toMatch(/\.outerHTML\s*=/);
    expect(LAHDE).not.toMatch(/insertAdjacentHTML/);
    expect(LAHDE).not.toMatch(/document\.write/);
  });

  it("ei käytä evalia", () => {
    expect(LAHDE).not.toMatch(/\beval\s*\(/);
    expect(LAHDE).not.toMatch(/new Function\s*\(/);
  });

  it("ei lähetä ravintolan tunnistetta vaan slugin", () => {
    /*
     * Kannan funktio hakee ravintolan slugista itse. Jos widget
     * lähettäisi uuid:n, se olisi selaimen valitsema arvo.
     */
    expect(LAHDE).toContain("data-restaurant");
    expect(LAHDE).not.toMatch(/restaurant_?[Ii]d/);
  });

  it("kutsuu vain omaa alkuperäänsä", () => {
    /* Osoite johdetaan skriptin omasta src:stä, ei kovakoodata. */
    expect(LAHDE).toContain("new URL(script.src, location.href).origin");
    expect(LAHDE).not.toMatch(/https?:\/\/(?!…)[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});

describe("widgetin rakenne", () => {
  it("eristyy isäntäsivun tyyleistä varjopuulla", () => {
    expect(LAHDE).toContain("attachShadow");
  });

  it("perii kirjasimen isäntäsivulta", () => {
    /*
     * Tämä on se yksi asia joka saa widgetin näyttämään ravintolan
     * omalta osalta. Jos joku joskus asettaa font-familyn, widget
     * alkaa näyttää upotetulta palvelulta.
     */
    expect(LAHDE).toContain("font: inherit");
    expect(LAHDE).not.toMatch(/font-family:\s*(?!inherit)/);
  });

  it("odottaa DOM:in valmistumista jos kiinnityskohtaa ei vielä ole", () => {
    expect(LAHDE).toContain('document.readyState === "loading"');
    expect(LAHDE).toContain("DOMContentLoaded");
  });
});
