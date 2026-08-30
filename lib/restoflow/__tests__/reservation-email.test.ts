import { describe, expect, it } from "vitest";
import { looksLikeEmail } from "../email";
import {
  confirmationEmail,
  EMAIL_LOCALES,
  toEmailLocale,
  type ConfirmationInput,
} from "../reservation-email";

function varaus(muutos: Partial<ConfirmationInput> = {}): ConfirmationInput {
  return {
    locale: "fi",
    restaurantName: "Cafe Monami",
    date: "2026-08-31",
    time: "18:30",
    partySize: 4,
    tables: ["Pöytä 3"],
    guestName: "Oktay Hun",
    cancelUrl: "https://kate.fi/varaus/abc123",
    ...muutos,
  };
}

describe("varausvahvistuksen sisältö", () => {
  /*
   * Peruutuslinkki on koko viestin syy.
   *
   * Ilman sitä asiakkaalla ei ole mitään keinoa perua itse: kannassa
   * on tunnuksesta vain tiiviste, eikä sitä voi palauttaa kukaan.
   */
  it("pitää peruutuslinkin sekä tekstissä että HTML:ssä", () => {
    const viesti = confirmationEmail(varaus());

    expect(viesti.text).toContain("https://kate.fi/varaus/abc123");
    expect(viesti.html).toContain('href="https://kate.fi/varaus/abc123"');

    /* Myös luettavana tekstinä: osa ohjelmista ei näytä linkkejä. */
    expect(viesti.html).toContain(">https://kate.fi/varaus/abc123<");
  });

  it("kertoo aiheessa ravintolan ja ajan", () => {
    const viesti = confirmationEmail(varaus());

    /* Postilaatikossa näkyy usein vain aihe. */
    expect(viesti.subject).toContain("Cafe Monami");
    expect(viesti.subject).toContain("18:30");
    expect(viesti.subject).toContain("2026");
  });

  it("kirjoittaa päivän viikonpäivineen asiakkaan kielellä", () => {
    const suomi = confirmationEmail(varaus({ locale: "fi" }));
    const englanti = confirmationEmail(varaus({ locale: "en" }));

    /* 31.8.2026 on maanantai. Viikonpäivä on se mitä vahvistuksesta
       katsotaan — pelkkä numero ei kerro sitä. */
    expect(suomi.text.toLowerCase()).toContain("maanantai");
    expect(englanti.text).toContain("Monday");
  });

  /*
   * Nimen valitsee kuka tahansa internetissä.
   *
   * Varauslomake on avoin. Ilman merkitsevien merkkien karsintaa se
   * olisi tapa syöttää mitä tahansa HTML:ää viestiin, joka lähtee
   * ravintolan nimissä.
   */
  it("ei päästä nimeä HTML:ksi", () => {
    const viesti = confirmationEmail(
      varaus({ guestName: '<script>alert("x")</script>' }),
    );

    expect(viesti.html).not.toContain("<script>");
    expect(viesti.html).toContain("&lt;script&gt;");
  });

  it("jättää pöytärivin pois kun pöytää ei ole annettu", () => {
    const kanssa = confirmationEmail(varaus({ tables: ["Pöytä 3"] }));
    const ilman = confirmationEmail(varaus({ tables: [] }));

    expect(kanssa.text).toContain("Pöytä 3");

    /* Tyhjä "Pöytä:" -rivi näyttäisi siltä että jokin meni pieleen. */
    expect(ilman.text).not.toContain("Pöytä:");
  });

  it("taivuttaa yhden hengen seurueen yksikköön", () => {
    /* Rivinvaihto perässä erottaa yksikön monikosta: "1 henkilö" on
       myös "4 henkilöä" -rivin alkuosa. */
    expect(confirmationEmail(varaus({ partySize: 1 })).text).toContain(
      "1 henkilö\n",
    );
    expect(confirmationEmail(varaus({ partySize: 4 })).text).toContain(
      "4 henkilöä",
    );
  });

  /*
   * Kaikilla kielillä sama viesti.
   *
   * Kuudesta käännöksestä jää helposti yksi vajaaksi, ja puuttuva
   * peruutuslinkki yhdellä kielellä on juuri se vika jota kukaan ei
   * huomaa ennen kuin asiakas soittaa.
   */
  it("tuottaa kaikilla kielillä täyden viestin linkkeineen", () => {
    for (const locale of EMAIL_LOCALES) {
      const viesti = confirmationEmail(varaus({ locale }));

      expect(viesti.subject.length, locale).toBeGreaterThan(10);
      expect(viesti.text, locale).toContain("https://kate.fi/varaus/abc123");
      expect(viesti.html, locale).toContain("https://kate.fi/varaus/abc123");
      expect(viesti.text, locale).toContain("Cafe Monami");
    }
  });

  it("kestää kelvottoman päivän hajoamatta", () => {
    const viesti = confirmationEmail(varaus({ date: "ei-paiva" }));
    expect(viesti.text).toContain("ei-paiva");
  });
});

describe("kielen tunnistus", () => {
  it("hyväksyy tuetut kielet", () => {
    expect(toEmailLocale("sv")).toBe("sv");
    expect(toEmailLocale("EN")).toBe("en");

    /* Selain lähettää usein en-GB. */
    expect(toEmailLocale("en-GB")).toBe("en");
  });

  it("palautuu suomeen tuntemattomasta", () => {
    /* Vanha widget-versio ei lähetä kieltä lainkaan. */
    expect(toEmailLocale(null)).toBe("fi");
    expect(toEmailLocale("")).toBe("fi");
    expect(toEmailLocale("de")).toBe("fi");
  });
});

describe("osoitteen tarkistus", () => {
  it("hyväksyy tavallisen osoitteen", () => {
    expect(looksLikeEmail("asiakas@example.fi")).toBe(true);
    expect(looksLikeEmail("  etu.suku+varaus@sub.example.co.uk  ")).toBe(true);
  });

  it("hylkää sen mikä ei ole osoite", () => {
    expect(looksLikeEmail("")).toBe(false);
    expect(looksLikeEmail("eiosoitetta")).toBe(false);
    expect(looksLikeEmail("kaksi@@example.fi")).toBe(false);
    expect(looksLikeEmail("ei@verkkotunnusta")).toBe(false);
    expect(looksLikeEmail("piste@example.")).toBe(false);

    /* Rivinvaihto osoitteessa on otsakkeiden injektointiyritys. */
    expect(looksLikeEmail("a@b.fi\nBcc: uhri@example.fi")).toBe(false);
  });
});
