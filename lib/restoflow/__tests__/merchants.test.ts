import { describe, expect, it } from "vitest";
import {
  MERCHANT_CONFIDENCE,
  isAutoMatch,
  isSuggestion,
  matchMerchant,
  merchantInitial,
  normalizeMerchantName,
  parseBusinessId,
  type Merchant,
} from "../merchants";

function merchant(
  id: string,
  name: string,
  aliases: string[],
  extra: Partial<Merchant> = {},
): Merchant {
  return {
    id,
    name,
    legalName: null,
    businessId: null,
    category: "grocery",
    subcategory: null,
    brandColor: "#000000",
    brandBackground: "#ffffff",
    logoUrl: null,
    aliases: aliases.map(normalizeMerchantName),
    ...extra,
  };
}

const catalogue: Merchant[] = [
  merchant("k-market", "K-Market", ["K-Market", "K Market", "KMarket"]),
  merchant("k-supermarket", "K-Supermarket", [
    "K-Supermarket",
    "K Supermarket",
  ]),
  merchant("k-citymarket", "K-Citymarket", ["K-Citymarket", "Citymarket"]),
  merchant("alepa", "Alepa", ["Alepa"]),
  merchant("s-market", "S-market", ["S-market", "S market"]),
  merchant("verkkokauppa-com", "Verkkokauppa.com", [
    "Verkkokauppa.com",
    "Verkkokauppa com",
    "Verkkokauppa",
  ]),
  merchant("gigantti", "Gigantti", ["Gigantti"], {
    category: "electronics",
    businessId: "1523846-8",
  }),
];

describe("nimen normalisointi", () => {
  it("poistaa yhtiömuodon ja välimerkit", () => {
    expect(normalizeMerchantName("Gigantti Oy")).toBe("gigantti");
    expect(normalizeMerchantName("K-MARKET")).toBe("k market");
    expect(normalizeMerchantName("  S-market  ")).toBe("s market");
  });

  // Piste kuuluu nimeen. Ilman sitä verkkokauppa.com olisi kaksi sanaa
  // joista toinen on maatunnus.
  it("säilyttää pisteen nimen sisällä", () => {
    expect(normalizeMerchantName("VERKKOKAUPPA.COM")).toBe("verkkokauppa.com");
  });

  // Skandit säilyvät: ä:n muuntaminen a:ksi yhdistäisi eri sanoja.
  it("säilyttää skandit", () => {
    expect(normalizeMerchantName("Päivittäistavara")).toBe("päivittäistavara");
  });
});

describe("Y-tunnus", () => {
  it("lukee kelvollisen tunnuksen", () => {
    expect(parseBusinessId("Y-tunnus: 1523846-8")).toBe("1523846-8");
    expect(parseBusinessId("ALV-numero FI15238468 Y 1523846 - 8")).toBe(
      "1523846-8",
    );
  });

  // Tarkiste on koko tunnuksen tarkoitus: väärin luettu numero jää
  // tähän kiinni eikä päädy tunnisteeksi jolle annetaan täysi varmuus.
  it("hylkää väärän tarkisteen", () => {
    expect(parseBusinessId("1523846-7")).toBeNull();
    expect(parseBusinessId("1234567-9")).toBeNull();
  });

  it("palauttaa null kun tunnusta ei ole", () => {
    expect(parseBusinessId("K-Market Malmi")).toBeNull();
    expect(parseBusinessId(null)).toBeNull();
  });
});

describe("kaupan tunnistus", () => {
  it("yhdistää eri kirjoitusasut samaan brändiin", () => {
    for (const raw of [
      "K-MARKET MALMI",
      "K-Market Malmi",
      "K-MARKET",
      "K Market",
    ]) {
      expect(matchMerchant(raw, null, catalogue)?.merchantId).toBe("k-market");
    }
  });

  it("erottaa saman ketjun eri muodot", () => {
    expect(
      matchMerchant("K-SUPERMARKET MALMI", null, catalogue)?.merchantId,
    ).toBe("k-supermarket");
    expect(matchMerchant("K-CITYMARKET", null, catalogue)?.merchantId).toBe(
      "k-citymarket",
    );
    expect(matchMerchant("ALEPA PIHLAJISTO", null, catalogue)?.merchantId).toBe(
      "alepa",
    );
  });

  it("tunnistaa verkkokaupan kirjoitusasusta riippumatta", () => {
    for (const raw of [
      "VERKKOKAUPPA.COM",
      "VERKKOKAUPPA COM",
      "Verkkokauppa.com Oy",
    ]) {
      expect(matchMerchant(raw, null, catalogue)?.merchantId).toBe(
        "verkkokauppa-com",
      );
    }
  });

  // Y-tunnus on yksikäsitteinen, joten se voittaa nimen. Tämä on koko
  // tunnistuksen tärkein sääntö: nimi voidaan lukea väärin, tarkistettu
  // Y-tunnus ei.
  it("antaa Y-tunnukselle etusijan nimen ohi", () => {
    const match = matchMerchant("Jokin Sekava Nimi", "1523846-8", catalogue);
    expect(match?.merchantId).toBe("gigantti");
    expect(match?.confidence).toBe(1);
    expect(match?.basis).toBe("business_id");
  });

  it("ei yhdistä eri yrityksiä samankaltaisen nimen takia", () => {
    expect(matchMerchant("Marketing Oy", null, catalogue)).toBeNull();
    expect(matchMerchant("Kalevan Kauppa", null, catalogue)).toBeNull();
  });

  it("palauttaa null tyhjälle nimelle", () => {
    expect(matchMerchant("", null, catalogue)).toBeNull();
    expect(matchMerchant("Oy", null, catalogue)).toBeNull();
  });
});

describe("varmuusrajat", () => {
  it("liittää tarkan osuman itsestään", () => {
    const match = matchMerchant("Alepa", null, catalogue);
    expect(isAutoMatch(match)).toBe(true);
    expect(isSuggestion(match)).toBe(false);
  });

  it("liittää toimipisteen nimestä itsestään", () => {
    const match = matchMerchant("K-MARKET MALMI", null, catalogue);
    expect(match?.basis).toBe("prefix");
    expect(isAutoMatch(match)).toBe(true);
  });

  // Heikoin peruste jää ehdotukseksi. Väärä kauppa kirjanpidossa on
  // pahempi kuin tuntematon kauppa.
  it("jättää sanaosuman ehdotukseksi", () => {
    const match = matchMerchant("Ostopaikka Alepa Kallio", null, catalogue);
    expect(match?.basis).toBe("token");
    expect(isAutoMatch(match)).toBe(false);
    expect(isSuggestion(match)).toBe(true);
  });

  it("ei tunnista mitään ilman osumaa", () => {
    expect(isAutoMatch(null)).toBe(false);
    expect(isSuggestion(null)).toBe(false);
  });

  it("pitää rajat järkevässä järjestyksessä", () => {
    expect(MERCHANT_CONFIDENCE.suggest).toBeLessThan(MERCHANT_CONFIDENCE.auto);
    expect(MERCHANT_CONFIDENCE.auto).toBeLessThanOrEqual(1);
  });
});

describe("logon kirjain", () => {
  it("antaa nimen ensimmäisen kirjaimen", () => {
    expect(merchantInitial("K-Market")).toBe("K");
    expect(merchantInitial("verkkokauppa.com")).toBe("V");
    expect(merchantInitial("  alepa")).toBe("A");
  });

  it("antaa kysymysmerkin tyhjälle", () => {
    expect(merchantInitial("")).toBe("?");
    expect(merchantInitial("   ")).toBe("?");
  });
});

// ---------------------------------------------------------------------------

/**
 * Siemenskripti normalisoi aliakset omalla kopiollaan, koska se ajetaan
 * ilman TypeScript-käännöstä. Kaksi normalisointia on riski: jos ne
 * ajautuvat erilleen, kantaan tallennetaan alias jota tunnistus ei
 * koskaan tuota, ja kauppa jää tunnistamatta ilman virheilmoitusta.
 *
 * Tämä testi ei salli sitä.
 */
describe("siemenskriptin normalisointi", () => {
  it("tuottaa saman tuloksen kuin kirjasto", async () => {
    const seed = await import("../../../scripts/merchant-seed.mjs");

    const samples = [
      "K-MARKET MALMI",
      "Gigantti Oy",
      "VERKKOKAUPPA.COM",
      "S-market Kajaani",
      "McDonald's",
      "Yliopiston Apteekki",
      "  Alepa  Pihlajisto ",
      "Päivittäistavara Ky",
    ];

    for (const sample of samples) {
      expect(seed.normalize(sample)).toBe(normalizeMerchantName(sample));
    }
  });

  it("ei anna kahden yrityksen jakaa kirjoitusasua", async () => {
    const seed = await import("../../../scripts/merchant-seed.mjs");
    const owner = new Map<string, string>();

    for (const m of seed.MERCHANTS) {
      for (const raw of [m.name, ...m.aliases]) {
        const alias = normalizeMerchantName(raw);
        const existing = owner.get(alias);

        expect(existing ?? m.id).toBe(m.id);
        owner.set(alias, m.id);
      }
    }
  });
});
