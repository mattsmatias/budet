/**
 * Tuotteen ja toimittajan tunnistaminen nimestä.
 *
 * Kuittirivillä luki tähän asti aina kategorian ikoni, joten viisitoista
 * ruokariviä näytti viideltätoista samalta riviltä. Nimestä pääteltävä
 * ikoni tekee listasta silmäiltävän: maito erottuu jauhelihasta ilman
 * että tekstiä lukee.
 *
 * Tunnistus on sanahakua, ei ymmärtämistä. Se osuu tavallisiin suomen
 * kielen tuotenimiin ja menee ohi harvinaisista — ja se on tarkoitus.
 * Kun osumaa ei tule, palautetaan null ja kutsupaikka piirtää kategorian
 * ikonin kuten ennenkin. Väärä ikoni on huonompi kuin yleinen ikoni,
 * joten epävarmaa arvausta ei tehdä.
 *
 * Ikoni on koriste. Se ei vaikuta kategoriaan, summaan eikä ALV:hen —
 * mikään laskenta ei lue tätä tiedostoa.
 */

export type GlyphName =
  | "milk"
  | "egg"
  | "vegetable"
  | "fruit"
  | "meat"
  | "fish"
  | "bread"
  | "grain"
  | "jar"
  | "bottle"
  | "can"
  | "coffee"
  | "bag"
  | "deposit"
  | "wine"
  | "shop"
  | "wholesale";

/**
 * Sanat ja niiden ikonit, tarkin ensin.
 *
 * Järjestys ratkaisee: "maustekurkku" on purkkitavaraa vaikka siinä
 * lukee "kurkku", joten yhdyssanan on osuttava ennen perussanaa.
 * Sama koskee "maitorahkaa" ja "maitoa" — molemmat ovat maitotuotteita,
 * joten järjestyksellä ei ole väliä, mutta sääntö on sama.
 */
const PRODUCT_WORDS: [readonly string[], GlyphName][] = [
  // Purkit ja tölkit ennen sisältöään.
  [
    [
      "maustekurkku",
      "kastike",
      "ketsuppi",
      "sinappi",
      "majoneesi",
      "hillo",
      "hunaja",
      "säilyke",
      "tahna",
      "pesto",
      "salsa",
      "purkki",
    ],
    "jar",
  ],

  [["pantti", "kierrätys"], "deposit"],

  [
    [
      "maito",
      "kerma",
      "rahka",
      "jogurtti",
      "viili",
      "juusto",
      "voi ",
      "margariini",
      "piimä",
      "jäätelö",
      "raejuusto",
      "smetana",
    ],
    "milk",
  ],

  [["muna", "kananmuna"], "egg"],

  [
    [
      "jauheliha",
      "liha",
      "kana",
      "nauta",
      "possu",
      "porsas",
      "makkara",
      "filee",
      "pekoni",
      "kinkku",
      "nakki",
      "leikkele",
      "broileri",
    ],
    "meat",
  ],

  [
    ["lohi", "kala", "tonnikala", "silli", "katkarapu", "seiti", "muikku"],
    "fish",
  ],

  [
    [
      "leipä",
      "tortilla",
      "sämpylä",
      "patonki",
      "pizzapohja",
      "ruisleipä",
      "keksi",
      "pulla",
      "croissant",
      "näkkileipä",
    ],
    "bread",
  ],

  [
    [
      "makaroni",
      "pasta",
      "spagetti",
      "riisi",
      "jauho",
      "puuro",
      "hiutale",
      "couscous",
      "nuudeli",
      "myslit",
      "murot",
    ],
    "grain",
  ],

  [
    [
      "sipuli",
      "kurkku",
      "tomaatti",
      "salaatti",
      "peruna",
      "porkkana",
      "paprika",
      "kaali",
      "herne",
      "papu",
      "sieni",
      "vihannes",
      "basilika",
      "persilja",
      "kesäkurpitsa",
      "parsakaali",
      "maissi",
    ],
    "vegetable",
  ],

  [
    [
      "omena",
      "banaani",
      "päärynä",
      "appelsiini",
      "sitruuna",
      "marja",
      "mansikka",
      "mustikka",
      "viinirypäle",
      "ananas",
      "meloni",
      "hedelmä",
      "avokado",
      "lime",
    ],
    "fruit",
  ],

  [["kahvi", "tee ", "espresso", "cappuccino"], "coffee"],

  [["tölkki", "energiajuoma", "olut", "siideri", "lonkero"], "can"],

  [
    [
      "juoma",
      "mehu",
      "limsa",
      "limonadi",
      "vesi",
      "kivennäis",
      "virvoitus",
      "smoothie",
      "cola",
      "pullo",
    ],
    "bottle",
  ],

  [
    [
      "kassi",
      "pussi",
      "muovikassi",
      "paperikassi",
      "rasia",
      "kelmu",
      "folio",
      "pakkaus",
    ],
    "bag",
  ],
];

/**
 * Toimittajan ikoni nimestä.
 *
 * Vähittäiskauppa, tukku ja Alko näyttävät listassa erilaisilta, koska
 * ne ovat eri asioita: päivittäistavaraa, ammattiostoa ja alkoholia.
 */
const SUPPLIER_WORDS: [readonly string[], GlyphName][] = [
  [["alko", "viini", "panimo", "juomatukku"], "wine"],

  [
    [
      "tukku",
      "kespro",
      "metro ",
      "wihuri",
      "heinon",
      "valio",
      "meira",
      "atria",
      "hkscan",
      "snellman",
      "kesko pro",
    ],
    "wholesale",
  ],

  [
    [
      "market",
      "kauppa",
      "prisma",
      "lidl",
      "citymarket",
      "alepa",
      "sale",
      "coop",
      "sokos",
      "abc",
      "siwa",
      "valintatalo",
      "minimani",
      "tokmanni",
    ],
    "shop",
  ],
];

function matchWords(
  haystack: string,
  table: [readonly string[], GlyphName][],
): GlyphName | null {
  const text = haystack.toLowerCase();

  for (const [words, glyph] of table) {
    if (words.some((word) => text.includes(word))) return glyph;
  }
  return null;
}

/** Tuotteen ikoni rivin kuvauksesta, tai null jos ei tunnisteta. */
export function productGlyph(description: string): GlyphName | null {
  return matchWords(description, PRODUCT_WORDS);
}

/** Toimittajan ikoni nimestä, tai null jos ei tunnisteta. */
export function supplierGlyph(name: string): GlyphName | null {
  return matchWords(name, SUPPLIER_WORDS);
}
