import { sep } from "node:path";

/**
 * Luo brändiluettelon siemenmigraation.
 *
 * Aliakset normalisoidaan samalla funktiolla jota tunnistus käyttää.
 * Käsin kirjoitettuina ne ajautuisivat väistämättä erilleen: alias
 * tallennettaisiin muodossa jota tunnistus ei koskaan tuota, eikä
 * kukaan huomaisi ennen kuin kauppa jää tunnistamatta.
 *
 *   node scripts/merchant-seed.mjs > supabase/migrations/0014_merchant_seed.sql
 */

// Sama logiikka kuin lib/restoflow/merchants.ts. Pidetty tässä koska
// skripti ajetaan ilman TypeScript-käännöstä; poikkeama huomataan
// testissä joka vertaa tuloksia.
const NOISE_WORDS = new Set([
  "oy", "oyj", "ab", "ky", "tmi", "ltd", "as", "abp", "osk",
  "finland", "suomi", "yritysmyynti", "kuitti", "myymala", "myymälä",
]);

export function normalize(raw) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .split(" ")
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter((word) => word !== "" && !NOISE_WORDS.has(word))
    .join(" ")
    .trim();
}

/**
 * Brändit.
 *
 * Värit ovat tunnisteita eivätkä virallisia brändiohjeistuksia. Ne on
 * valittu niin että ketjut erottuvat toisistaan listassa; tarkat arvot
 * voi korjata migraatiolla koskematta koodiin.
 *
 * Y-tunnukset on jätetty tyhjiksi tarkoituksella. Väärä Y-tunnus olisi
 * pahempi kuin puuttuva, koska tunnistus luottaa siihen kaiken muun
 * ohi. Ne lisätään sitä mukaa kun ne varmistetaan lähteestä.
 */
export const MERCHANTS = [
  // --- Ruokakaupat -------------------------------------------------------
  { id: "k-market", name: "K-Market", category: "grocery",
    color: "#F28C28", background: "#FFF7ED",
    aliases: ["K-Market", "K Market", "KMarket"] },

  { id: "k-supermarket", name: "K-Supermarket", category: "grocery",
    color: "#E85D04", background: "#FFF7ED",
    aliases: ["K-Supermarket", "K Supermarket", "KSupermarket"] },

  { id: "k-citymarket", name: "K-Citymarket", category: "grocery",
    color: "#D64500", background: "#FFF7ED",
    aliases: ["K-Citymarket", "K Citymarket", "K-Citymarket", "Citymarket"] },

  { id: "s-market", name: "S-market", category: "grocery",
    color: "#00AA46", background: "#F0FDF4",
    aliases: ["S-market", "S market", "Smarket"] },

  { id: "alepa", name: "Alepa", category: "grocery",
    color: "#E30613", background: "#FFF1F2",
    aliases: ["Alepa"] },

  { id: "sale", name: "Sale", category: "grocery",
    color: "#0A7D33", background: "#F0FDF4",
    aliases: ["Sale"] },

  { id: "prisma", name: "Prisma", category: "grocery",
    color: "#00693E", background: "#F0FDF4",
    aliases: ["Prisma"] },

  { id: "lidl", name: "Lidl", category: "grocery",
    color: "#0050AA", background: "#EFF6FF",
    aliases: ["Lidl"] },

  { id: "minimani", name: "Minimani", category: "grocery",
    color: "#C8102E", background: "#FFF1F2",
    aliases: ["Minimani"] },

  // --- Elektroniikka -----------------------------------------------------
  { id: "gigantti", name: "Gigantti", category: "electronics",
    color: "#005EB8", background: "#EFF6FF",
    aliases: ["Gigantti"] },

  { id: "power", name: "POWER", category: "electronics",
    color: "#0F172A", background: "#F1F5F9",
    aliases: ["Power"] },

  { id: "verkkokauppa-com", name: "Verkkokauppa.com", category: "electronics",
    color: "#E4002B", background: "#FFF1F2",
    aliases: ["Verkkokauppa.com", "Verkkokauppa com", "Verkkokauppa"] },

  { id: "elisa", name: "Elisa", category: "electronics",
    color: "#0019AF", background: "#EFF6FF",
    aliases: ["Elisa"] },

  { id: "dna", name: "DNA", category: "electronics",
    color: "#6E2585", background: "#FAF5FF",
    aliases: ["DNA"] },

  { id: "telia", name: "Telia", category: "electronics",
    color: "#990AE3", background: "#FAF5FF",
    aliases: ["Telia", "Telia Finland"] },

  // --- Rautakaupat -------------------------------------------------------
  { id: "k-rauta", name: "K-Rauta", category: "hardware",
    color: "#E85D04", background: "#FFF7ED",
    aliases: ["K-Rauta", "K Rauta", "KRauta"] },

  { id: "bauhaus", name: "BAUHAUS", category: "hardware",
    color: "#C8102E", background: "#FFF1F2",
    aliases: ["Bauhaus"] },

  { id: "stark", name: "STARK", category: "hardware",
    color: "#1D4ED8", background: "#EFF6FF",
    aliases: ["Stark", "Stark Suomi"] },

  { id: "puuilo", name: "Puuilo", category: "hardware",
    color: "#F59E0B", background: "#FFFBEB",
    aliases: ["Puuilo"] },

  // --- Autoilu -----------------------------------------------------------
  //
  // Motonet on speksissä kahdessa kategoriassa. Autoilu valittiin, koska
  // pykälässä 1 se on annettu nimenomaisesti tälle yritykselle.
  { id: "motonet", name: "Motonet", category: "automotive",
    color: "#0F52BA", background: "#EFF6FF",
    aliases: ["Motonet"] },

  // --- Vähittäiskauppa ---------------------------------------------------
  { id: "tokmanni", name: "Tokmanni", category: "retail",
    color: "#E4002B", background: "#FFF1F2",
    aliases: ["Tokmanni"] },

  { id: "clas-ohlson", name: "Clas Ohlson", category: "retail",
    color: "#00447C", background: "#EFF6FF",
    aliases: ["Clas Ohlson"] },

  { id: "ikea", name: "IKEA", category: "retail",
    color: "#0058A3", background: "#EFF6FF",
    aliases: ["Ikea"] },

  // --- Apteekit ----------------------------------------------------------
  { id: "yliopiston-apteekki", name: "Yliopiston Apteekki", category: "pharmacy",
    color: "#00843D", background: "#F0FDF4",
    aliases: ["Yliopiston Apteekki", "YA Apteekki"] },

  // --- Alkoholi ----------------------------------------------------------
  { id: "alko", name: "Alko", category: "alcohol",
    color: "#003DA5", background: "#EFF6FF",
    aliases: ["Alko"] },

  // --- Ravintolat --------------------------------------------------------
  { id: "mcdonalds", name: "McDonald's", category: "restaurant",
    color: "#DA291C", background: "#FFF1F2",
    aliases: ["McDonalds", "McDonald's", "Mc Donalds"] },

  { id: "hesburger", name: "Hesburger", category: "restaurant",
    color: "#004B93", background: "#EFF6FF",
    aliases: ["Hesburger"] },

  { id: "burger-king", name: "Burger King", category: "restaurant",
    color: "#D62300", background: "#FFF7ED",
    aliases: ["Burger King"] },

  { id: "subway", name: "Subway", category: "restaurant",
    color: "#008C15", background: "#F0FDF4",
    aliases: ["Subway"] },

  { id: "wolt", name: "Wolt", category: "restaurant",
    color: "#00C2E8", background: "#ECFEFF",
    aliases: ["Wolt", "Wolt Enterprises"] },

  { id: "foodora", name: "Foodora", category: "restaurant",
    color: "#D70F64", background: "#FDF2F8",
    aliases: ["Foodora"] },

  // --- Liikenne ----------------------------------------------------------
  { id: "hsl", name: "HSL", category: "transport",
    color: "#007AC9", background: "#EFF6FF",
    aliases: ["HSL", "Helsingin seudun liikenne"] },

  { id: "vr", name: "VR", category: "transport",
    color: "#007A3D", background: "#F0FDF4",
    aliases: ["VR", "VR Group"] },

  { id: "finnair", name: "Finnair", category: "transport",
    color: "#0B1560", background: "#EFF6FF",
    aliases: ["Finnair"] },

  // --- Tukut -------------------------------------------------------------
  //
  // Ravintolan tavallisimmat ostopaikat. Nämä eivät ole speksin listalla
  // mutta ovat juuri se aineisto jota tämä sovellus käsittelee.
  { id: "kespro", name: "Kespro", category: "grocery",
    color: "#E85D04", background: "#FFF7ED",
    aliases: ["Kespro"] },

  { id: "metro-tukku", name: "Metro-tukku", category: "grocery",
    color: "#00519E", background: "#EFF6FF",
    aliases: ["Metro-tukku", "Metro tukku", "Meira Nova"] },

  { id: "valio", name: "Valio", category: "grocery",
    color: "#0057B8", background: "#EFF6FF",
    aliases: ["Valio"] },

  { id: "heinon-tukku", name: "Heinon Tukku", category: "grocery",
    color: "#C8102E", background: "#FFF1F2",
    aliases: ["Heinon Tukku"] },
];

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Tulostus vain kun skripti ajetaan suoraan.
 *
 * Testi tuo tämän moduulin verratakseen normalisointia kirjastoon.
 * Ilman tätä ehtoa koko migraatio tulostuisi testiajon sekaan joka
 * kerta kun testit ajetaan.
 */
export function buildSeedSql() {
  const lines = [];

  lines.push("-- ---------------------------------------------------------------------------");
  lines.push("-- 0014 — Brändiluettelon siemenaineisto");
  lines.push("-- ---------------------------------------------------------------------------");
  lines.push("--");
  lines.push("-- GENEROITU TIEDOSTO. Älä muokkaa käsin.");
  lines.push("--   node scripts/merchant-seed.mjs > supabase/migrations/0014_merchant_seed.sql");
  lines.push("--");
  lines.push("-- Aliakset on normalisoitu samalla säännöllä jota tunnistus käyttää.");
  lines.push("-- Käsin kirjoitettuina ne ajautuisivat erilleen, ja kauppa jäisi");
  lines.push("-- tunnistamatta ilman että kukaan huomaisi miksi.");
  lines.push("--");
  lines.push("-- Uusi yritys lisätään skriptiin ja migraatio ajetaan uudelleen.");
  lines.push("-- Käyttöliittymään ei kosketa.");
  lines.push("");

  lines.push("insert into merchants (id, name, category, brand_color, brand_background) values");
  lines.push(
    MERCHANTS.map(
      (m) =>
        `  (${sql(m.id)}, ${sql(m.name)}, ${sql(m.category)}, ` +
        `${sql(m.color)}, ${sql(m.background)})`,
    ).join(",\n") + "\non conflict (id) do update set",
  );
  lines.push("  name = excluded.name,");
  lines.push("  category = excluded.category,");
  lines.push("  brand_color = excluded.brand_color,");
  lines.push("  brand_background = excluded.brand_background,");
  lines.push("  updated_at = now();");
  lines.push("");

  // Aliakset: normalisoitu nimi on aina mukana, vaikka sitä ei lueteltaisi.
  const rows = [];
  const seen = new Map();

  for (const merchant of MERCHANTS) {
    const forms = new Set([merchant.name, ...merchant.aliases].map(normalize));

    for (const alias of forms) {
      if (alias.length < 2) continue;

      const owner = seen.get(alias);
      if (owner && owner !== merchant.id) {
        throw new Error(
          `Alias "${alias}" kuuluisi sekä ${owner}- että ${merchant.id}-brändille. ` +
            "Kaksi yritystä ei saa jakaa kirjoitusasua.",
        );
      }

      seen.set(alias, merchant.id);
      rows.push(`  (${sql(merchant.id)}, ${sql(alias)})`);
    }
  }

  lines.push("insert into merchant_aliases (merchant_id, alias) values");
  lines.push(rows.join(",\n"));
  lines.push("on conflict (alias) do update set merchant_id = excluded.merchant_id;");
  lines.push("");

  return lines.join(String.fromCharCode(10));
}

// import.meta.url on tiedosto-URL, argv[1] tavallinen polku.
if (process.argv[1] && import.meta.url.endsWith(encodeURI(process.argv[1].split(sep).join('/')))) {
  console.log(buildSeedSql());
}