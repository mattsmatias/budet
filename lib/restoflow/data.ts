/**
 * RestoFlow'n demo-aineisto.
 *
 * Kaikki luvut ovat keksittyjä ja käyttöliittymä sanoo sen (§74).
 *
 * Aineisto on kiinteä eikä nojaa nykyhetkeen, jotta näkymät ovat
 * toistettavia ja testattavia. Volyymi (satoja kuitteja) tuotetaan
 * siemenetyllä generaattorilla — käsin kirjoitettuna se olisi tuhansia
 * rivejä, ja satunnaisluvuilla näkymät muuttuisivat joka latauksella.
 *
 * Nimetyt kuitit kirjoitetaan käsin: ne esiintyvät käyttöliittymässä
 * esimerkkeinä, ja niiden pitää olla tarkalleen tietynlaisia — mukaan
 * lukien tarkoituksellinen kaksoiskappale ja ALV-ristiriita.
 */

import type {
  Absence,
  Budget,
  ClockEvent,
  ExpenseCategory,
  OpenShift,
  Receipt,
  ReceiptItem,
  Restaurant,
  Shift,
  Supplier,
  User,
} from "./types";

/** Demon "nykyhetki". Kaikki suhteelliset näkymät lasketaan tästä. */
export const DEMO_NOW = "2026-08-20T13:39:21.000Z";
export const DEMO_TODAY = "2026-08-20";
export const DEMO_MONTH = "2026-08";

export const RESTAURANT: Restaurant = {
  id: "rest-linnea",
  name: "Ravintola Linnea",
  timezone: "Europe/Helsinki",
  currency: "EUR",
};

// ---------------------------------------------------------------------------
// Käyttäjät
// ---------------------------------------------------------------------------

export const USERS: User[] = [
  { id: "u-mika", restaurantId: RESTAURANT.id, name: "Mika Virtanen", role: "owner", position: "manager", hourlyRateCents: 2400, initials: "MV", active: true },
  { id: "u-ali", restaurantId: RESTAURANT.id, name: "Ali Hassan", role: "employee", position: "waiter", hourlyRateCents: 1480, initials: "AH", active: true },
  { id: "u-ahmed", restaurantId: RESTAURANT.id, name: "Ahmed Karim", role: "employee", position: "kitchen", hourlyRateCents: 1620, initials: "AK", active: true },
  { id: "u-sara", restaurantId: RESTAURANT.id, name: "Sara Lind", role: "employee", position: "waiter", hourlyRateCents: 1450, initials: "SL", active: true },
  { id: "u-noora", restaurantId: RESTAURANT.id, name: "Noora Ketola", role: "manager", position: "manager", hourlyRateCents: 2100, initials: "NK", active: true },
  { id: "u-tilitoimisto", restaurantId: RESTAURANT.id, name: "Lehtinen Tilitoimisto", role: "accountant", position: null, hourlyRateCents: null, initials: "LT", active: true },
];

/** Kirjautunut käyttäjä mobiilinäkymässä. */
export const CURRENT_USER_ID = "u-ali";

/** Kirjautunut käyttäjä hallintanäkymässä. */
export const CURRENT_ADMIN_ID = "u-mika";

export function userById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

/** Työntekijät joilla on työvuoroja — kirjanpitäjä ei ole vuorossa. */
export const STAFF: User[] = USERS.filter((u) => u.position !== null);

// ---------------------------------------------------------------------------
// Toimittajat
// ---------------------------------------------------------------------------

export const SUPPLIERS: Supplier[] = [
  { id: "s-kespro", restaurantId: RESTAURANT.id, name: "Kespro", defaultCategory: "food", categoryOverrides: [] },
  { id: "s-metro", restaurantId: RESTAURANT.id, name: "Metro Tukku", defaultCategory: "food", categoryOverrides: [] },
  { id: "s-meira", restaurantId: RESTAURANT.id, name: "Meira Nova", defaultCategory: "food", categoryOverrides: [] },
  { id: "s-valio", restaurantId: RESTAURANT.id, name: "Valio", defaultCategory: "food", categoryOverrides: [] },
  { id: "s-hartwall", restaurantId: RESTAURANT.id, name: "Hartwall", defaultCategory: "soft_drinks", categoryOverrides: [] },
  { id: "s-sinebrychoff", restaurantId: RESTAURANT.id, name: "Sinebrychoff", defaultCategory: "alcohol", categoryOverrides: [] },
  { id: "s-alko", restaurantId: RESTAURANT.id, name: "Alko Yritysmyynti", defaultCategory: "alcohol", categoryOverrides: [] },
  {
    id: "s-lyreco",
    restaurantId: RESTAURANT.id,
    name: "Lyreco",
    defaultCategory: "packaging",
    // Manageri on korjannut tämän toistuvasti — ehdotetaan jatkossa.
    categoryOverrides: [{ from: "other", to: "kitchen_supplies", count: 4 }],
  },
  { id: "s-sol", restaurantId: RESTAURANT.id, name: "SOL Palvelut", defaultCategory: "cleaning", categoryOverrides: [] },
  { id: "s-wolt", restaurantId: RESTAURANT.id, name: "Wolt Market", defaultCategory: "food", categoryOverrides: [] },
  { id: "s-kcity", restaurantId: RESTAURANT.id, name: "K-Citymarket", defaultCategory: "other", categoryOverrides: [] },
  { id: "s-tokmanni", restaurantId: RESTAURANT.id, name: "Tokmanni", defaultCategory: "kitchen_supplies", categoryOverrides: [] },
  { id: "s-posti", restaurantId: RESTAURANT.id, name: "Posti Kuljetus", defaultCategory: "transport", categoryOverrides: [] },
];

export function supplierById(id: string): Supplier | undefined {
  return SUPPLIERS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Budjetit
// ---------------------------------------------------------------------------

/**
 * Toistuvat kuukausibudjetit.
 *
 * Ruoka on tarkoituksella tiukka jotta varoitus näkyy demossa, ja siivous
 * ylittyy. Ilman kumpaakaan budjettinäkymä olisi pelkkää vihreää eikä
 * kertoisi miltä ongelma näyttää.
 */
export const BUDGETS: Budget[] = [
  { id: "b-food", restaurantId: RESTAURANT.id, category: "food", month: null, amountCents: 2350000 },
  { id: "b-alcohol", restaurantId: RESTAURANT.id, category: "alcohol", month: null, amountCents: 900000 },
  { id: "b-soft", restaurantId: RESTAURANT.id, category: "soft_drinks", month: null, amountCents: 500000 },
  { id: "b-kitchen", restaurantId: RESTAURANT.id, category: "kitchen_supplies", month: null, amountCents: 400000 },
  { id: "b-packaging", restaurantId: RESTAURANT.id, category: "packaging", month: null, amountCents: 300000 },
  { id: "b-cleaning", restaurantId: RESTAURANT.id, category: "cleaning", month: null, amountCents: 260000 },
  { id: "b-transport", restaurantId: RESTAURANT.id, category: "transport", month: null, amountCents: 150000 },
];

// ---------------------------------------------------------------------------
// Kuittien generointi
// ---------------------------------------------------------------------------

/**
 * Siemenetty pseudosatunnaisgeneraattori (mulberry32).
 *
 * Sama siemen tuottaa aina saman aineiston. Math.random() tekisi näkymistä
 * toistokelvottomia ja testeistä epävakaita.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Template {
  supplierId: string;
  category: ExpenseCategory;
  /** Tyypillinen laskun haarukka sentteinä. */
  min: number;
  max: number;
  /** Kuinka monta kertaa kuukaudessa. */
  perMonth: number;
  vatRate: number;
  payment: "card" | "invoice";
  products: string[];
}

const TEMPLATES: Template[] = [
  { supplierId: "s-kespro", category: "food", min: 180000, max: 520000, perMonth: 8, vatRate: 0.145, payment: "invoice", products: ["Tuoretuotteet", "Pakasteet", "Kuivatuotteet", "Liha ja kala"] },
  { supplierId: "s-metro", category: "food", min: 90000, max: 380000, perMonth: 7, vatRate: 0.145, payment: "card", products: ["Vihannekset", "Liha", "Mausteet", "Öljyt"] },
  { supplierId: "s-meira", category: "food", min: 40000, max: 190000, perMonth: 5, vatRate: 0.145, payment: "invoice", products: ["Kahvi", "Leivontatarvikkeet", "Säilykkeet"] },
  { supplierId: "s-valio", category: "food", min: 60000, max: 240000, perMonth: 6, vatRate: 0.145, payment: "invoice", products: ["Maitotuotteet", "Juustot", "Voi"] },
  { supplierId: "s-hartwall", category: "soft_drinks", min: 80000, max: 260000, perMonth: 4, vatRate: 0.145, payment: "invoice", products: ["Virvoitusjuomat", "Kivennäisvedet", "Mehut"] },
  { supplierId: "s-sinebrychoff", category: "alcohol", min: 150000, max: 420000, perMonth: 4, vatRate: 0.255, payment: "invoice", products: ["Olut", "Siideri"] },
  { supplierId: "s-alko", category: "alcohol", min: 90000, max: 310000, perMonth: 3, vatRate: 0.255, payment: "invoice", products: ["Viinit", "Väkevät"] },
  { supplierId: "s-lyreco", category: "packaging", min: 30000, max: 120000, perMonth: 3, vatRate: 0.255, payment: "invoice", products: ["Servetit", "Take-away-rasiat", "Kertakäyttöastiat"] },
  { supplierId: "s-tokmanni", category: "kitchen_supplies", min: 20000, max: 140000, perMonth: 3, vatRate: 0.255, payment: "card", products: ["Keittiövälineet", "Astiat", "Pienkalusteet"] },
  { supplierId: "s-sol", category: "cleaning", min: 90000, max: 180000, perMonth: 2, vatRate: 0.255, payment: "invoice", products: ["Siivouspalvelu", "Puhdistusaineet"] },
  { supplierId: "s-posti", category: "transport", min: 15000, max: 60000, perMonth: 2, vatRate: 0.255, payment: "invoice", products: ["Kuljetus", "Rahti"] },
  { supplierId: "s-kcity", category: "other", min: 5000, max: 45000, perMonth: 5, vatRate: 0.145, payment: "card", products: ["Sekalaiset ostot"] },
  { supplierId: "s-wolt", category: "food", min: 3000, max: 28000, perMonth: 6, vatRate: 0.145, payment: "card", products: ["Täydennysostos"] },
];

const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08"];

/** Kuukausikerroin — kesä vilkastuu, elokuu vilkkain. */
const MONTH_FACTOR: Record<string, number> = {
  "2026-05": 0.72,
  "2026-06": 0.85,
  "2026-07": 0.93,
  "2026-08": 1.0,
};

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function generateReceipts(): Receipt[] {
  const random = rng(20260820);
  const out: Receipt[] = [];
  let n = 0;

  for (const month of MONTHS) {
    const factor = MONTH_FACTOR[month];
    // Kuluva kuukausi on kesken — kuitteja vain kuluvaan päivään asti.
    const lastDay = month === DEMO_MONTH ? 20 : daysInMonth(month);

    for (const t of TEMPLATES) {
      const count = Math.max(1, Math.round(t.perMonth * factor));

      for (let i = 0; i < count; i += 1) {
        const day = 1 + Math.floor(random() * lastDay);
        const date = `${month}-${String(day).padStart(2, "0")}`;
        const total = Math.round((t.min + random() * (t.max - t.min)) * factor);
        const vat = Math.round((total * t.vatRate) / (1 + t.vatRate));

        n += 1;
        const id = `g-${String(n).padStart(3, "0")}`;

        out.push({
          id,
          restaurantId: RESTAURANT.id,
          supplierId: t.supplierId,
          supplierName: supplierById(t.supplierId)?.name ?? "Tuntematon",
          date,
          totalCents: total,
          vatCents: vat,
          category: t.category,
          paymentMethod: t.payment,
          receiptNumber: `${t.supplierId.slice(2, 5).toUpperCase()}-${10000 + n}`,
          note: null,
          status: "confirmed",
          reviewReasons: [],
          items: buildItems(id, t, total, random),
          addedByUserId: t.payment === "card" ? "u-ali" : "u-mika",
          addedAt: `${date}T18:20:00.000Z`,
          hasImage: true,
          imageQuality: "good",
        });
      }
    }
  }

  return out;
}

/** Jakaa laskun 1–4 riville jotka summautuvat tarkalleen loppusummaan. */
function buildItems(
  receiptId: string,
  t: Template,
  total: number,
  random: () => number,
): ReceiptItem[] {
  const count = 1 + Math.floor(random() * Math.min(4, t.products.length));
  const weights = Array.from({ length: count }, () => 0.5 + random());
  const sum = weights.reduce((s, w) => s + w, 0);

  const items: ReceiptItem[] = [];
  let allocated = 0;

  for (let i = 0; i < count; i += 1) {
    // Viimeinen rivi saa jäännöksen, jotta summa täsmää sentilleen.
    const cents =
      i === count - 1 ? total - allocated : Math.round((total * weights[i]) / sum);
    allocated += cents;

    items.push({
      id: `${receiptId}-l${i + 1}`,
      lineNumber: i + 1,
      description: t.products[i % t.products.length],
      quantity: null,
      unit: null,
      totalCents: cents,
      category: t.category,
      vatRate: t.vatRate,
      vatCents: Math.round((cents * t.vatRate) / (1 + t.vatRate)),
      productGroup: null,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Nimetyt kuitit — esimerkkejä, sisältävät tarkoitukselliset viat
// ---------------------------------------------------------------------------

const NAMED: Receipt[] = [
  {
    id: "r-metro-0820",
    restaurantId: RESTAURANT.id,
    supplierId: "s-metro",
    supplierName: "Metro Tukku",
    date: "2026-08-20",
    totalCents: 18690,
    vatCents: null, // ALV puuttuu — tarkistettava
    category: "food",
    paymentMethod: "card",
    receiptNumber: "MT-4471",
    note: null,
    status: "needs_review",
    reviewReasons: ["vat_missing"],
    addedByUserId: "u-ali",
    addedAt: "2026-08-20T18:20:00.000Z",
    hasImage: true,
    imageQuality: "good",
    items: [
      { id: "r-metro-0820-l1", lineNumber: 1, description: "Naudan sisäfilee", quantity: 4, unit: "kg", totalCents: 8960, category: "food", vatRate: 0.145, vatCents: 1135, productGroup: "Liha" },
      { id: "r-metro-0820-l2", lineNumber: 2, description: "Perunat", quantity: 25, unit: "kg", totalCents: 2450, category: "food", vatRate: 0.145, vatCents: 310, productGroup: "Vihannekset" },
      { id: "r-metro-0820-l3", lineNumber: 3, description: "Salaattisekoitus", quantity: 6, unit: "pkt", totalCents: 3480, category: "food", vatRate: 0.145, vatCents: 441, productGroup: "Vihannekset" },
      { id: "r-metro-0820-l4", lineNumber: 4, description: "Oliiviöljy", quantity: 1, unit: "kanisteri", totalCents: 3800, category: "food", vatRate: 0.145, vatCents: 481, productGroup: "Öljyt" },
    ],
  },
  {
    // Sekakuitti: ruokaa, juomaa ja pesuainetta samalla tositteella.
    // Juuri se tapaus jossa rivikohtainen jako on välttämätön.
    id: "r-kespro-0819",
    restaurantId: RESTAURANT.id,
    supplierId: "s-kespro",
    supplierName: "Kespro",
    date: "2026-08-19",
    totalCents: 31250,
    vatCents: 4601,
    category: "food",
    paymentMethod: "invoice",
    receiptNumber: "KP-88214",
    note: "Viikonlopun tilaus",
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "u-mika",
    addedAt: "2026-08-19T18:20:00.000Z",
    hasImage: true,
    imageQuality: "good",
    items: [
      { id: "r-kespro-0819-l1", lineNumber: 1, description: "Kanafilee", quantity: 10, unit: "kg", totalCents: 14200, category: "food", vatRate: 0.145, vatCents: 1799, productGroup: "Liha" },
      { id: "r-kespro-0819-l2", lineNumber: 2, description: "Coca-Cola 0,33 l", quantity: 24, unit: "kpl", totalCents: 8650, category: "soft_drinks", vatRate: 0.145, vatCents: 1096, productGroup: "Virvoitusjuomat" },
      { id: "r-kespro-0819-l3", lineNumber: 3, description: "Astianpesuaine", quantity: 2, unit: "kanisteri", totalCents: 5900, category: "cleaning", vatRate: 0.255, vatCents: 1198, productGroup: "Puhdistusaineet" },
      { id: "r-kespro-0819-l4", lineNumber: 4, description: "Talouspaperi", quantity: 6, unit: "rll", totalCents: 2500, category: "cleaning", vatRate: 0.255, vatCents: 508, productGroup: "Puhdistusaineet" },
    ],
  },
  {
    id: "r-wolt-0818",
    restaurantId: RESTAURANT.id,
    supplierId: "s-wolt",
    supplierName: "Wolt Market",
    date: "2026-08-18",
    totalCents: 4520,
    vatCents: null,
    category: "food",
    paymentMethod: "unknown", // maksutapa puuttuu
    receiptNumber: null,
    note: null,
    status: "needs_review",
    reviewReasons: ["total_uncertain", "vat_missing", "payment_missing", "poor_image"],
    addedByUserId: "u-ali",
    addedAt: "2026-08-18T21:05:00.000Z",
    hasImage: true,
    imageQuality: "poor",
    items: [],
  },
  {
    // ALV-ristiriita: alkoholiksi luokiteltu, mutta ALV vastaa 14,5 %
    id: "r-alko-0817",
    restaurantId: RESTAURANT.id,
    supplierId: "s-alko",
    supplierName: "Alko Yritysmyynti",
    date: "2026-08-17",
    totalCents: 128400,
    vatCents: 16260,
    category: "alcohol",
    paymentMethod: "invoice",
    receiptNumber: "ALK-7781",
    note: null,
    status: "needs_review",
    reviewReasons: ["vat_mismatch"],
    addedByUserId: "u-mika",
    addedAt: "2026-08-17T12:00:00.000Z",
    hasImage: true,
    imageQuality: "good",
    items: [],
  },
  {
    // Kaksoiskappaleen ensimmäinen
    id: "r-kcity-0818a",
    restaurantId: RESTAURANT.id,
    supplierId: "s-kcity",
    supplierName: "K-Citymarket",
    date: "2026-08-18",
    totalCents: 8720,
    vatCents: 1104,
    category: "other",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "u-sara",
    addedAt: "2026-08-18T16:40:00.000Z",
    hasImage: true,
    imageQuality: "good",
    items: [],
  },
  {
    // ...ja sen kaksoiskappale, toisen käyttäjän lisäämänä seuraavana aamuna
    id: "r-kcity-0818b",
    restaurantId: RESTAURANT.id,
    supplierId: "s-kcity",
    supplierName: "K-Citymarket",
    date: "2026-08-18",
    totalCents: 8720,
    vatCents: 1104,
    category: "other",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "u-mika",
    addedAt: "2026-08-19T09:12:00.000Z",
    hasImage: true,
    imageQuality: "good",
    items: [],
  },
];

export const RECEIPTS: Receipt[] = [...NAMED, ...generateReceipts()];

export function receiptById(id: string): Receipt | undefined {
  return RECEIPTS.find((r) => r.id === id);
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

export const SHIFTS: Shift[] = [
  { id: "sh-1", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-17", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-2", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-18", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-3", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-19", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-4", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-20", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-5", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-21", startTime: "17:00", endTime: "23:00", location: "Sali", status: "changed", previousStartTime: "16:00", previousEndTime: "22:00" },
  { id: "sh-6", restaurantId: RESTAURANT.id, userId: "u-ali", date: "2026-08-23", startTime: "14:00", endTime: "22:00", location: "Sali", status: "pending" },
  { id: "sh-7", restaurantId: RESTAURANT.id, userId: "u-ahmed", date: "2026-08-18", startTime: "16:00", endTime: "23:00", location: "Keittiö", status: "accepted" },
  { id: "sh-8", restaurantId: RESTAURANT.id, userId: "u-ahmed", date: "2026-08-19", startTime: "16:00", endTime: "23:00", location: "Keittiö", status: "accepted" },
  { id: "sh-9", restaurantId: RESTAURANT.id, userId: "u-ahmed", date: "2026-08-20", startTime: "11:00", endTime: "19:00", location: "Keittiö", status: "accepted" },
  { id: "sh-10", restaurantId: RESTAURANT.id, userId: "u-ahmed", date: "2026-08-22", startTime: "12:00", endTime: "20:00", location: "Keittiö", status: "pending" },
  { id: "sh-11", restaurantId: RESTAURANT.id, userId: "u-sara", date: "2026-08-17", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-12", restaurantId: RESTAURANT.id, userId: "u-sara", date: "2026-08-19", startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted" },
  { id: "sh-13", restaurantId: RESTAURANT.id, userId: "u-sara", date: "2026-08-22", startTime: "14:00", endTime: "22:00", location: "Sali", status: "declined" },
  { id: "sh-14", restaurantId: RESTAURANT.id, userId: "u-noora", date: "2026-08-20", startTime: "10:00", endTime: "18:00", location: "Toimisto", status: "accepted" },
  { id: "sh-15", restaurantId: RESTAURANT.id, userId: "u-noora", date: "2026-08-22", startTime: "10:00", endTime: "18:00", location: "Toimisto", status: "accepted" },
];

export const OPEN_SHIFTS: OpenShift[] = [
  { id: "os-1", restaurantId: RESTAURANT.id, date: "2026-08-22", startTime: "14:00", endTime: "22:00", position: "waiter" },
  { id: "os-2", restaurantId: RESTAURANT.id, date: "2026-08-24", startTime: "16:00", endTime: "23:00", position: "kitchen" },
  { id: "os-3", restaurantId: RESTAURANT.id, date: "2026-08-28", startTime: "12:00", endTime: "20:00", position: "waiter" },
];

export const ABSENCES: Absence[] = [
  { id: "ab-1", userId: "u-sara", date: "2026-08-22", kind: "cannot_attend", note: "Perhesyy", reportedAt: "2026-08-19T20:14:00.000Z" },
];

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

let evSeq = 0;
function e(userId: string, type: ClockEvent["type"], at: string): ClockEvent {
  evSeq += 1;
  return { id: `clk-${evSeq}`, userId, type, at };
}

/**
 * Alin leimaus on tarkoituksella auki: hän on kirjautunut sisään eikä ulos,
 * joten mobiilinäkymän laskuri käy ja "Olet nyt töissä" näkyy.
 *
 * Ahmedin 18.8. vuoro jäi sulkematta — se nostaa hälytyksen.
 *
 * Alin leimaukset ovat systemaattisesti muutaman minuutin yli vuoron, mikä
 * tuottaa toistuvan ylityksen kuvion suunniteltu-vs-toteutunut-näkymään.
 */
export const CLOCK_EVENTS: ClockEvent[] = [
  // Ali — käynnissä oleva päivä
  e("u-ali", "in", "2026-08-20T09:02:00.000Z"),
  e("u-ali", "break_start", "2026-08-20T12:14:00.000Z"),
  e("u-ali", "break_end", "2026-08-20T12:44:00.000Z"),

  // Ali — aiemmat päivät
  e("u-ali", "in", "2026-08-19T14:04:00.000Z"),
  e("u-ali", "break_start", "2026-08-19T17:30:00.000Z"),
  e("u-ali", "break_end", "2026-08-19T18:00:00.000Z"),
  e("u-ali", "out", "2026-08-19T22:17:00.000Z"),
  e("u-ali", "in", "2026-08-18T14:03:00.000Z"),
  e("u-ali", "out", "2026-08-18T22:21:00.000Z"),
  e("u-ali", "in", "2026-08-17T14:06:00.000Z"),
  e("u-ali", "out", "2026-08-17T22:14:00.000Z"),

  // Ahmed
  e("u-ahmed", "in", "2026-08-20T11:00:00.000Z"),
  e("u-ahmed", "in", "2026-08-19T16:00:00.000Z"),
  e("u-ahmed", "out", "2026-08-19T23:05:00.000Z"),
  // 18.8. jäi sulkematta
  e("u-ahmed", "in", "2026-08-18T16:00:00.000Z"),

  // Sara
  e("u-sara", "in", "2026-08-19T14:00:00.000Z"),
  e("u-sara", "out", "2026-08-19T21:45:00.000Z"),
  e("u-sara", "in", "2026-08-17T14:00:00.000Z"),
  e("u-sara", "out", "2026-08-17T22:00:00.000Z"),

  // Noora
  e("u-noora", "in", "2026-08-20T10:00:00.000Z"),
];

export function eventsFor(userId: string): ClockEvent[] {
  return CLOCK_EVENTS.filter((x) => x.userId === userId);
}

export function shiftsFor(userId: string): Shift[] {
  return SHIFTS.filter((s) => s.userId === userId).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ---------------------------------------------------------------------------
// Kuukauden työtunnit
// ---------------------------------------------------------------------------

/**
 * Kuukauden toteutuneet tunnit työntekijää kohti.
 *
 * Demo-arvoja: leimauksia on aineistossa vain muutamalta päivältä, joten
 * koko kuukauden tuntimäärää ei voi laskea niistä. Oikeassa sovelluksessa
 * tämä johdettaisiin leimauksista samalla laskennalla kuin päivänäkymä.
 */
export const MONTHLY_HOURS: Record<string, number> = {
  "u-ali": 164,
  "u-ahmed": 142,
  "u-sara": 126,
  "u-noora": 96,
  "u-mika": 88,
};

export function monthlyHoursFor(userId: string): number {
  return MONTHLY_HOURS[userId] ?? 0;
}
