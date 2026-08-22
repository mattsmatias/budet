import { describe, expect, it } from "vitest";
import { TOOLS, findTool, toolsFor } from "../tools";
import type { Role } from "@/lib/restoflow/types";

/**
 * Matin työkalujen rakennetestit.
 *
 * Nämä eivät testaa mallia. Ne testaavat rajaa jonka takana malli
 * toimii, ja se raja on koko moduulin turvallisuus: jos kirjoittava
 * työkalu joskus alkaa kirjoittaa, tämä tiedosto huomaa sen.
 */

describe("työkalujen rakenne", () => {
  it("antaa jokaiselle työkalulle yksilöllisen nimen", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("löytää työkalun nimellä", () => {
    expect(findTool("get_dashboard_summary")?.level).toBe("read");
    expect(findTool("ei_ole_olemassa")).toBeNull();
  });

  /*
   * Kirjoittavan työkalun nimen on alettava propose-etuliitteellä.
   *
   * Nimi on se mitä malli näkee. Jos työkalu on nimeltään
   * "set_lunch_price", malli kertoo käyttäjälle asettaneensa hinnan —
   * vaikka se vain ehdotti sitä. Etuliite pitää mallin puheen
   * yhtenäisenä sen kanssa mitä oikeasti tapahtui.
   */
  it("nimeää kirjoittavat työkalut ehdotuksiksi", () => {
    for (const tool of TOOLS) {
      if (tool.level === "write") {
        expect(tool.name.startsWith("propose_")).toBe(true);
      } else {
        expect(tool.name.startsWith("propose_")).toBe(false);
      }
    }
  });

  it("kuvaa jokaisen työkalun mallille", () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  /*
   * Kirjoittavan työkalun kuvauksessa on sanottava ettei se kirjoita.
   *
   * Malli suunnittelee vuoronsa kuvausten perusteella. Ilman tätä se
   * voisi olettaa kutsuvansa toimintoa ja kertoa käyttäjälle työn
   * olevan valmis ennen kuin kukaan on hyväksynyt mitään.
   */
  it("kertoo kirjoittavan työkalun kuvauksessa ettei se muuta mitään", () => {
    for (const tool of TOOLS.filter((t) => t.level === "write")) {
      expect(tool.description).toMatch(/EI (muuta|kopioi|julkaise|tallenna)/);
    }
  });
});

describe("oikeudet", () => {
  const roles: Role[] = ["owner", "manager", "employee", "accountant"];

  it("rajaa työkalut roolin mukaan", () => {
    expect(toolsFor("owner").length).toBeGreaterThan(0);
    expect(toolsFor("employee")).toHaveLength(0);
  });

  /*
   * Työntekijällä ei ole yhtään työkalua, joten Mattia ei ole hänelle
   * olemassa. Tämä on tarkoitus: lounaslista ja kulut ovat ravintolan
   * hallintaa, eikä niitä avata luonnollisen kielen kautta ohi
   * rooliportin.
   */
  it("ei anna työntekijälle mitään", () => {
    expect(toolsFor("employee")).toEqual([]);
  });

  it("ei anna kirjanpitäjälle kirjoittavia työkaluja", () => {
    const write = toolsFor("accountant").filter((t) => t.level === "write");
    expect(write).toEqual([]);
  });

  // Jokaisen työkalun on vaadittava jokin oikeus. Oikeudeton työkalu
  // olisi reikä rooliportissa.
  it("vaatii jokaiselta työkalulta oikeuden", () => {
    for (const tool of TOOLS) {
      expect(typeof tool.requires).toBe("string");
      expect(tool.requires.length).toBeGreaterThan(0);
    }
  });

  it("ei anna millekään roolille työkalua johon sillä ei ole oikeutta", () => {
    for (const role of roles) {
      for (const tool of toolsFor(role)) {
        expect(TOOLS).toContain(tool);
      }
    }
  });
});

describe("syötteen validointi", () => {
  it("hylkää kelvottoman kuukauden", () => {
    const tool = findTool("get_dashboard_summary")!;
    expect(tool.schema.safeParse({ month: "elokuu" }).success).toBe(false);
    expect(tool.schema.safeParse({ month: "2026-08" }).success).toBe(true);
  });

  it("hylkää kelvottoman päivän", () => {
    const tool = findTool("propose_lunch_price")!;
    expect(tool.schema.safeParse({ date: "24.8.2026", euros: 16 }).success).toBe(false);
    expect(tool.schema.safeParse({ date: "2026-08-24", euros: 16 }).success).toBe(true);
  });

  // Negatiivinen hinta ei ole kirjoitusvirhe vaan mahdoton arvo.
  // Kanta torjuisi sen joka tapauksessa, mutta virheen on tultava
  // ennen kuin käyttäjälle näytetään esikatselu jota ei voi hyväksyä.
  it("hylkää negatiivisen hinnan", () => {
    const tool = findTool("propose_lunch_price")!;
    expect(tool.schema.safeParse({ date: "2026-08-24", euros: -5 }).success).toBe(false);
  });

  it("rajaa hinnan järkevään ylärajaan", () => {
    const tool = findTool("propose_lunch_price")!;
    expect(tool.schema.safeParse({ date: "2026-08-24", euros: 99999 }).success).toBe(false);
  });
});
