/**
 * RestoFlow'n demo-aineisto.
 *
 * Aineisto on kiinteä eikä nojaa nykyhetkeen, jotta näkymät ovat
 * toistettavia ja testattavia. Kaikki luvut ovat keksittyjä ja
 * käyttöliittymä sanoo sen — demo-aineistoa ei saa esittää oikeana (§74).
 */

import type {
  ClockEvent,
  Employee,
  OpenShift,
  Receipt,
  Shift,
} from "./types";

/** Demon "nykyhetki". Kaikki suhteelliset näkymät lasketaan tästä. */
export const DEMO_NOW = "2026-08-20T13:39:21.000Z";
export const DEMO_TODAY = "2026-08-20";
export const DEMO_MONTH = "2026-08";

export const EMPLOYEES: Employee[] = [
  {
    id: "emp-ali",
    name: "Ali Hassan",
    role: "waiter",
    hourlyRateCents: 1480,
    canSeeReceipts: true,
    initials: "AH",
  },
  {
    id: "emp-ahmed",
    name: "Ahmed Karim",
    role: "kitchen",
    hourlyRateCents: 1620,
    canSeeReceipts: false,
    initials: "AK",
  },
  {
    id: "emp-sara",
    name: "Sara Lind",
    role: "waiter",
    hourlyRateCents: 1450,
    canSeeReceipts: false,
    initials: "SL",
  },
  {
    id: "emp-mika",
    name: "Mika Virtanen",
    role: "manager",
    hourlyRateCents: 2100,
    canSeeReceipts: true,
    initials: "MV",
  },
];

/** Kirjautunut työntekijä mobiilinäkymässä. */
export const CURRENT_EMPLOYEE_ID = "emp-ali";

export function employeeById(id: string): Employee | undefined {
  return EMPLOYEES.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// Kuitit
// ---------------------------------------------------------------------------

let seq = 0;
function r(partial: Omit<Receipt, "id" | "addedAt" | "lines" | "hasImage"> &
  Partial<Pick<Receipt, "lines" | "hasImage" | "addedAt">>): Receipt {
  seq += 1;
  return {
    id: `rcp-${String(seq).padStart(3, "0")}`,
    addedAt: `${partial.date}T18:20:00.000Z`,
    lines: [],
    hasImage: true,
    ...partial,
  };
}

export const RECEIPTS: Receipt[] = [
  // Elokuu — kuluva kuukausi
  r({
    supplier: "Metro Tukku",
    date: "2026-08-20",
    totalCents: 18690,
    vatCents: null,
    category: "food",
    paymentMethod: "card",
    receiptNumber: "MT-4471",
    note: null,
    status: "needs_review",
    reviewReasons: ["vat_missing"],
    addedByUserId: "emp-ali",
    lines: [
      { description: "Naudan sisäfilee 4 kg", quantity: 4, totalCents: 8960 },
      { description: "Perunat 25 kg", quantity: 1, totalCents: 2450 },
      { description: "Salaattisekoitus", quantity: 6, totalCents: 3480 },
      { description: "Oliiviöljy 5 l", quantity: 1, totalCents: 3800 },
    ],
  }),
  r({
    supplier: "Kespro",
    date: "2026-08-19",
    totalCents: 31250,
    vatCents: 5438,
    category: "food",
    paymentMethod: "invoice",
    receiptNumber: "KP-88214",
    note: "Viikonlopun tilaus",
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
    lines: [
      { description: "Tuoretuotteet", quantity: null, totalCents: 18400 },
      { description: "Pakasteet", quantity: null, totalCents: 12850 },
    ],
  }),
  r({
    supplier: "Wolt Market",
    date: "2026-08-18",
    totalCents: 4520,
    vatCents: null,
    category: "supplies",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "needs_review",
    reviewReasons: ["total_uncertain", "vat_missing"],
    addedByUserId: "emp-ali",
  }),
  r({
    supplier: "K-Citymarket",
    date: "2026-08-18",
    totalCents: 8720,
    vatCents: 1517,
    category: "other",
    paymentMethod: "card",
    receiptNumber: "KC-1120",
    note: null,
    status: "needs_review",
    reviewReasons: ["category_missing"],
    addedByUserId: "emp-sara",
  }),
  r({
    supplier: "Meira Nova",
    date: "2026-08-17",
    totalCents: 7430,
    vatCents: 1293,
    category: "food",
    paymentMethod: "invoice",
    receiptNumber: "MN-7781",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
  }),
  r({
    supplier: "Hartwall",
    date: "2026-08-16",
    totalCents: 684000,
    vatCents: 132048,
    category: "drinks",
    paymentMethod: "invoice",
    receiptNumber: "HW-2261",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
    lines: [
      { description: "Olut 0,33 l × 240", quantity: 240, totalCents: 43200 },
      { description: "Virvoitusjuomat", quantity: null, totalCents: 25200 },
    ],
  }),
  r({
    supplier: "Lyreco",
    date: "2026-08-14",
    totalCents: 324800,
    vatCents: 62685,
    category: "supplies",
    paymentMethod: "invoice",
    receiptNumber: "LY-3390",
    note: "Servetit ja pakkaustarvikkeet",
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
  }),
  r({
    supplier: "SOL Palvelut",
    date: "2026-08-12",
    totalCents: 324000,
    vatCents: 62522,
    category: "cleaning",
    paymentMethod: "invoice",
    receiptNumber: "SOL-9021",
    note: "Kuukausisiivous",
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
  }),
  r({
    supplier: "Valio",
    date: "2026-08-11",
    totalCents: 515600,
    vatCents: 89722,
    category: "food",
    paymentMethod: "invoice",
    receiptNumber: "VA-5512",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-ahmed",
  }),
  r({
    supplier: "Sinebrychoff",
    date: "2026-08-08",
    totalCents: 598000,
    vatCents: 115434,
    category: "drinks",
    paymentMethod: "invoice",
    receiptNumber: "SB-4410",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
  }),
  r({
    supplier: "Metro Tukku",
    date: "2026-08-06",
    totalCents: 443100,
    vatCents: 77098,
    category: "food",
    paymentMethod: "card",
    receiptNumber: "MT-4402",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-ali",
  }),
  r({
    supplier: "Tokmanni",
    date: "2026-08-04",
    totalCents: 268900,
    vatCents: 51893,
    category: "other",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-sara",
  }),
  r({
    supplier: "Kespro",
    date: "2026-08-02",
    totalCents: 712000,
    vatCents: 123893,
    category: "food",
    paymentMethod: "invoice",
    receiptNumber: "KP-88100",
    note: null,
    status: "confirmed",
    reviewReasons: [],
    addedByUserId: "emp-mika",
  }),

  // Heinäkuu — vertailukuukausi
  r({ supplier: "Kespro", date: "2026-07-28", totalCents: 489000, vatCents: 85096, category: "food", paymentMethod: "invoice", receiptNumber: "KP-87710", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Hartwall", date: "2026-07-22", totalCents: 612000, vatCents: 118120, category: "drinks", paymentMethod: "invoice", receiptNumber: "HW-2180", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Metro Tukku", date: "2026-07-18", totalCents: 274000, vatCents: 47678, category: "food", paymentMethod: "card", receiptNumber: "MT-4310", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-ali" }),
  r({ supplier: "SOL Palvelut", date: "2026-07-12", totalCents: 324000, vatCents: 62522, category: "cleaning", paymentMethod: "invoice", receiptNumber: "SOL-8890", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Lyreco", date: "2026-07-09", totalCents: 298400, vatCents: 57588, category: "supplies", paymentMethod: "invoice", receiptNumber: "LY-3210", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Valio", date: "2026-07-05", totalCents: 298000, vatCents: 51861, category: "food", paymentMethod: "invoice", receiptNumber: "VA-5390", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-ahmed" }),
  r({ supplier: "Tokmanni", date: "2026-07-03", totalCents: 242000, vatCents: 46703, category: "other", paymentMethod: "card", receiptNumber: null, note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-sara" }),

  // Kesäkuu
  r({ supplier: "Kespro", date: "2026-06-26", totalCents: 456000, vatCents: 79339, category: "food", paymentMethod: "invoice", receiptNumber: "KP-87200", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Hartwall", date: "2026-06-20", totalCents: 543000, vatCents: 104803, category: "drinks", paymentMethod: "invoice", receiptNumber: "HW-2090", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Metro Tukku", date: "2026-06-14", totalCents: 421000, vatCents: 73254, category: "food", paymentMethod: "card", receiptNumber: "MT-4210", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-ali" }),
  r({ supplier: "SOL Palvelut", date: "2026-06-12", totalCents: 308000, vatCents: 59446, category: "cleaning", paymentMethod: "invoice", receiptNumber: "SOL-8710", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Lyreco", date: "2026-06-06", totalCents: 282000, vatCents: 54418, category: "supplies", paymentMethod: "invoice", receiptNumber: "LY-3080", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),

  // Toukokuu
  r({ supplier: "Kespro", date: "2026-05-27", totalCents: 431000, vatCents: 74991, category: "food", paymentMethod: "invoice", receiptNumber: "KP-86600", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Hartwall", date: "2026-05-19", totalCents: 497000, vatCents: 95924, category: "drinks", paymentMethod: "invoice", receiptNumber: "HW-1990", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
  r({ supplier: "Metro Tukku", date: "2026-05-13", totalCents: 398000, vatCents: 69245, category: "food", paymentMethod: "card", receiptNumber: "MT-4090", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-ali" }),
  r({ supplier: "SOL Palvelut", date: "2026-05-11", totalCents: 30800, vatCents: 5944, category: "cleaning", paymentMethod: "invoice", receiptNumber: "SOL-8520", note: null, status: "confirmed", reviewReasons: [], addedByUserId: "emp-mika" }),
];

export function receiptById(id: string): Receipt | undefined {
  return RECEIPTS.find((r) => r.id === id);
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

export const SHIFTS: Shift[] = [
  { id: "sh-1", employeeId: "emp-ali", date: "2026-08-20", startTime: "14:00", endTime: "22:00", location: "Sali", status: "approved" },
  { id: "sh-2", employeeId: "emp-ali", date: "2026-08-21", startTime: "17:00", endTime: "23:00", location: "Sali", status: "changed", previousStartTime: "16:00", previousEndTime: "22:00" },
  { id: "sh-3", employeeId: "emp-ali", date: "2026-08-23", startTime: "14:00", endTime: "22:00", location: "Sali", status: "approved" },
  { id: "sh-4", employeeId: "emp-ali", date: "2026-08-25", startTime: "16:00", endTime: "23:00", location: "Sali", status: "pending" },
  { id: "sh-5", employeeId: "emp-ali", date: "2026-08-27", startTime: "14:00", endTime: "22:00", location: "Sali", status: "approved" },
  { id: "sh-6", employeeId: "emp-ahmed", date: "2026-08-21", startTime: "16:00", endTime: "23:00", location: "Keittiö", status: "approved" },
  { id: "sh-7", employeeId: "emp-ahmed", date: "2026-08-22", startTime: "12:00", endTime: "20:00", location: "Keittiö", status: "approved" },
  { id: "sh-8", employeeId: "emp-ahmed", date: "2026-08-24", startTime: "16:00", endTime: "23:00", location: "Keittiö", status: "pending" },
  { id: "sh-9", employeeId: "emp-sara", date: "2026-08-22", startTime: "14:00", endTime: "22:00", location: "Sali", status: "approved" },
  { id: "sh-10", employeeId: "emp-sara", date: "2026-08-23", startTime: "16:00", endTime: "23:00", location: "Sali", status: "approved" },
  { id: "sh-11", employeeId: "emp-sara", date: "2026-08-26", startTime: "14:00", endTime: "22:00", location: "Sali", status: "pending" },
  { id: "sh-12", employeeId: "emp-mika", date: "2026-08-20", startTime: "10:00", endTime: "18:00", location: "Toimisto", status: "approved" },
  { id: "sh-13", employeeId: "emp-mika", date: "2026-08-22", startTime: "10:00", endTime: "18:00", location: "Toimisto", status: "approved" },
];

export const OPEN_SHIFTS: OpenShift[] = [
  { id: "os-1", date: "2026-08-24", startTime: "14:00", endTime: "22:00", role: "waiter" },
  { id: "os-2", date: "2026-08-28", startTime: "16:00", endTime: "23:00", role: "kitchen" },
  { id: "os-3", date: "2026-08-30", startTime: "12:00", endTime: "20:00", role: "waiter" },
];

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

let evSeq = 0;
function e(employeeId: string, type: ClockEvent["type"], at: string): ClockEvent {
  evSeq += 1;
  return { id: `clk-${evSeq}`, employeeId, type, at };
}

/**
 * Alin tapahtuma on tarkoituksella auki: Ali on kirjautunut sisään klo 09:02
 * eikä ulos. Näin mobiilinäkymän laskuri käy ja "Olet nyt töissä" näkyy.
 */
export const CLOCK_EVENTS: ClockEvent[] = [
  // Ali — kuluva päivä, käynnissä
  e("emp-ali", "in", "2026-08-20T09:02:00.000Z"),
  e("emp-ali", "break_start", "2026-08-20T12:14:00.000Z"),
  e("emp-ali", "break_end", "2026-08-20T12:44:00.000Z"),

  // Ali — aiemmat päivät tällä viikolla
  e("emp-ali", "in", "2026-08-19T14:00:00.000Z"),
  e("emp-ali", "break_start", "2026-08-19T17:30:00.000Z"),
  e("emp-ali", "break_end", "2026-08-19T18:00:00.000Z"),
  e("emp-ali", "out", "2026-08-19T22:10:00.000Z"),
  e("emp-ali", "in", "2026-08-18T14:05:00.000Z"),
  e("emp-ali", "out", "2026-08-18T22:00:00.000Z"),
  e("emp-ali", "in", "2026-08-17T14:00:00.000Z"),
  e("emp-ali", "out", "2026-08-17T21:50:00.000Z"),

  // Ahmed
  e("emp-ahmed", "in", "2026-08-20T11:00:00.000Z"),
  e("emp-ahmed", "in", "2026-08-19T16:00:00.000Z"),
  e("emp-ahmed", "out", "2026-08-19T23:05:00.000Z"),
  e("emp-ahmed", "in", "2026-08-18T16:00:00.000Z"),
  e("emp-ahmed", "out", "2026-08-18T22:55:00.000Z"),

  // Sara
  e("emp-sara", "in", "2026-08-19T14:00:00.000Z"),
  e("emp-sara", "out", "2026-08-19T21:45:00.000Z"),
  e("emp-sara", "in", "2026-08-17T14:00:00.000Z"),
  e("emp-sara", "out", "2026-08-17T22:00:00.000Z"),
];

export function eventsFor(employeeId: string): ClockEvent[] {
  return CLOCK_EVENTS.filter((e) => e.employeeId === employeeId);
}

export function shiftsFor(employeeId: string): Shift[] {
  return SHIFTS.filter((s) => s.employeeId === employeeId).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/**
 * Kuukauden työtunnit työntekijää kohti. Palautetaan valmiiksi laskettuna,
 * jotta admin-näkymien ei tarvitse toistaa aggregointia.
 */
export const MONTHLY_HOURS: Record<string, number> = {
  "emp-ali": 164,
  "emp-ahmed": 142,
  "emp-sara": 126,
  "emp-mika": 96,
};
