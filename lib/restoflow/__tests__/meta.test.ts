import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptToken,
  tokenHint,
  tokenKeyReady,
} from "../meta-crypto";
import {
  IG_CAPTION_MAX,
  alreadyPublished,
  buildLunchPost,
  igOverflow,
} from "../meta-post";
import { MetaError, META_SCOPES } from "../meta-api";
import type { DietType, LunchWeek } from "../lunch";

// ---------------------------------------------------------------------------
// Salaus
// ---------------------------------------------------------------------------

const AVAIN = Buffer.alloc(32, 7).toString("base64");

describe("tokenien salaus", () => {
  beforeEach(() => {
    process.env.META_TOKEN_KEY = AVAIN;
  });

  afterEach(() => {
    delete process.env.META_TOKEN_KEY;
  });

  it("purkaa saman kuin salasi", () => {
    const tokeni = "EAAG...pitka-sivutokeni-1234567890";
    expect(decryptToken(encryptToken(tokeni))).toBe(tokeni);
  });

  it("tuottaa eri salatekstin samasta tokenista", () => {
    /*
     * Satunnainen alkuvektori joka kerta. Ilman sitä kannasta näkisi
     * mitkä ravintolat jakavat saman tokenin.
     */
    const a = encryptToken("sama");
    const b = encryptToken("sama");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("sama");
    expect(decryptToken(b)).toBe("sama");
  });

  it("hylkää muokatun salatekstin", () => {
    /*
     * GCM todentaa eheyden. Ilman sitä muokattu salateksti purkautuisi
     * roskaksi, joka lähetettäisiin Metalle tokenina.
     */
    const salattu = encryptToken("tokeni");
    const raw = Buffer.from(salattu, "base64");
    raw[raw.length - 1] ^= 0xff;

    expect(() => decryptToken(raw.toString("base64"))).toThrow();
  });

  it("hylkää liian lyhyen syötteen", () => {
    expect(() => decryptToken(Buffer.alloc(8).toString("base64"))).toThrow();
  });

  it("hylkää väärän avaimen", () => {
    const salattu = encryptToken("tokeni");
    process.env.META_TOKEN_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptToken(salattu)).toThrow();
  });

  it("kertoo puuttuvasta avaimesta selvästi", () => {
    delete process.env.META_TOKEN_KEY;
    expect(tokenKeyReady()).toBe(false);
    expect(() => encryptToken("x")).toThrow(/META_TOKEN_KEY/);
  });

  it("hylkää väärän mittaisen avaimen", () => {
    process.env.META_TOKEN_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptToken("x")).toThrow(/32/);
  });

  it("vihjeessä on vain neljä viimeistä merkkiä", () => {
    expect(tokenHint("EAAGabcdef1234")).toBe("••••1234");
    expect(tokenHint("abc")).toBe("••••");
    expect(tokenHint("EAAGabcdef1234")).not.toContain("EAAG");
  });
});

// ---------------------------------------------------------------------------
// Julkaisuteksti
// ---------------------------------------------------------------------------

const DIETS: DietType[] = [
  { id: "vegan", label: "Vegaani", shortLabel: "VE" } as DietType,
  { id: "gluten_free", label: "Gluteeniton", shortLabel: "G" } as DietType,
];

function viikko(partial: Partial<LunchWeek> = {}): LunchWeek {
  return {
    id: "menu-1",
    weekStart: "2026-08-31",
    weekEnd: "2026-09-06",
    status: "draft",
    publishedAt: null,
    contentUpdatedAt: "2026-08-30T10:00:00Z",
    prices: [{ id: "p1", name: "Lounas", cents: 1550, sortOrder: 0 }],
    includesDessert: true,
    includesCoffee: true,
    days: [
      {
        id: "d1",
        date: "2026-08-31",
        items: [
          {
            id: "i1",
            name: "Juureskeitto",
            description: null,
            sortOrder: 1,
            diets: ["vegan"],
            allergens: [],
          },
          {
            id: "i2",
            name: "Lohikeitto",
            description: null,
            sortOrder: 2,
            diets: [],
            allergens: [],
          },
        ],
      },
      { id: "d2", date: "2026-09-01", items: [] },
    ],
    ...partial,
  } as LunchWeek;
}

describe("buildLunchPost", () => {
  const perus = { restaurantName: "Cafe Monami", diets: DIETS, locale: "fi" as const };

  it("aloittaa otsikolla ja päättyy ravintolan nimeen", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti.startsWith("🍽️ VIIKON LOUNAS")).toBe(true);
    expect(teksti.trimEnd().endsWith("📍 Cafe Monami")).toBe(true);
  });

  it("listaa päivän ruoat luetelmana", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti).toContain("• Juureskeitto");
    expect(teksti).toContain("• Lohikeitto");
  });

  it("merkitsee ruokavaliot lyhenteinä", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti).toContain("• Juureskeitto (VE)");
    /* Ilman merkintöjä ei tyhjiä sulkeita. */
    expect(teksti).toContain("• Lohikeitto\n");
    expect(teksti).not.toContain("()");
  });

  it("jättää tyhjän päivän pois", () => {
    /* Tyhjä päivä julkaisussa näyttäisi siltä että ravintola on kiinni. */
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti).toContain("Maanantai");
    expect(teksti).not.toContain("Tiistai");
  });

  it("näyttää hinnan kerran eikä ruokaa kohti", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    const osumat = teksti.match(/15,50/g) ?? [];
    expect(osumat).toHaveLength(1);
  });

  it("kertoo mitä hintaan sisältyy", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti).toContain("jälkiruoka ja kahvi");
  });

  it("jättää sisältyy-lauseen pois kun mitään ei sisälly", () => {
    const teksti = buildLunchPost({
      week: viikko({ includesDessert: false, includesCoffee: false }),
      ...perus,
    });
    expect(teksti).not.toContain("sisältyy");
    expect(teksti).toContain("15,50");
  });

  it("tulee toimeen ilman hintaa", () => {
    const teksti = buildLunchPost({ week: viikko({ prices: [] }), ...perus });
    expect(teksti).toContain("• Juureskeitto");
    expect(teksti).toContain("📍 Cafe Monami");
  });

  it("palauttaa tyhjän kun viikossa ei ole yhtään ruokaa", () => {
    /*
     * Tyhjä teksti estää julkaisun. Pelkkä otsikko ja osoite olisi
     * julkaisu joka kertoo asiakkaalle tyhjää.
     */
    const tyhja = viikko({
      days: [{ id: "d1", date: "2026-08-31", items: [] }],
    });
    expect(buildLunchPost({ week: tyhja, ...perus })).toBe("");
  });

  it("ei sisällä markkinointipuhetta", () => {
    const teksti = buildLunchPost({ week: viikko(), ...perus });
    expect(teksti.toLowerCase()).not.toMatch(
      /tervetuloa|herkullis|maistuv|nauti|ainutlaatuis/,
    );
  });
});

describe("igOverflow", () => {
  it("on nolla kun teksti mahtuu", () => {
    expect(igOverflow("lyhyt")).toBe(0);
  });

  it("kertoo montako merkkiä on liikaa", () => {
    expect(igOverflow("x".repeat(IG_CAPTION_MAX + 12))).toBe(12);
  });
});

describe("alreadyPublished", () => {
  const rivi = (menuId: string | null, fb: string, ig: string) => ({
    menuId,
    facebookStatus: fb,
    instagramStatus: ig,
  });

  it("tunnistaa jo julkaistun viikon", () => {
    expect(alreadyPublished([rivi("m1", "ok", "skipped")], "m1")).toBe(true);
  });

  it("riittää että toinen kanava onnistui", () => {
    expect(alreadyPublished([rivi("m1", "failed", "ok")], "m1")).toBe(true);
  });

  it("epäonnistunut yritys ei ole julkaisu", () => {
    /*
     * Muuten epäonnistuneen julkaisun jälkeen käyttäjä saisi
     * varoituksen kaksoisjulkaisusta yrittäessään uudelleen.
     */
    expect(alreadyPublished([rivi("m1", "failed", "failed")], "m1")).toBe(false);
  });

  it("toinen viikko ei estä", () => {
    expect(alreadyPublished([rivi("m2", "ok", "ok")], "m1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rajapinta
// ---------------------------------------------------------------------------

describe("MetaError", () => {
  const virhe = (code: number) => new MetaError("x", code, null, null, null);

  it("tunnistaa vanhentuneen tokenin", () => {
    expect(virhe(190).tokenInvalid).toBe(true);
    expect(virhe(200).tokenInvalid).toBe(false);
  });

  it("tunnistaa puuttuvan oikeuden", () => {
    expect(virhe(200).permissionMissing).toBe(true);
    expect(virhe(190).permissionMissing).toBe(false);
  });

  it("tunnistaa ohimenevän häiriön", () => {
    expect(virhe(2).retryable).toBe(true);
    expect(virhe(190).retryable).toBe(false);
  });
});

describe("META_SCOPES", () => {
  it("sisältää julkaisuun tarvittavat oikeudet", () => {
    expect(META_SCOPES).toContain("pages_manage_posts");
    expect(META_SCOPES).toContain("instagram_content_publish");
    expect(META_SCOPES).toContain("instagram_basic");
    expect(META_SCOPES).toContain("pages_show_list");
    expect(META_SCOPES).toContain("pages_read_engagement");
  });

  it("ei pyydä laajempaa oikeutta kuin tarvitsee", () => {
    /*
     * business_management antaisi pääsyn koko Business Manageriin.
     * Sitä ei tarvita kun käyttäjällä on suora rooli sivulla, ja
     * turha oikeus hidastaa App Review'ta.
     */
    expect(META_SCOPES).not.toContain("business_management");
    expect(META_SCOPES).not.toContain("pages_manage_metadata");
    expect(META_SCOPES).not.toContain("publish_to_groups");
  });
});
