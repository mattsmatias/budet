/**
 * RestoFlow'n domain-tyypit.
 *
 * Rajaus on tarkoituksellinen: kuitit, kulut, työvuorot ja työaika. Ei
 * myyntiä, ei kassaa, ei pankkiyhteyttä, ei varastoa. Tietomallissa ei ole
 * kenttää liikevaihdolle, jotta käyttöliittymä ei voi vahingossa esittää
 * kulutietoja ravintolan tuloksena.
 *
 * Rahamäärät ovat AINA sentteinä kokonaislukuina. Liukuluku ei kelpaa
 * rahaan: 0.1 + 0.2 ei ole 0.3.
 */

export type ExpenseCategory =
  | "food"
  | "drinks"
  | "supplies"
  | "cleaning"
  | "other";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Ruoka",
  drinks: "Juomat",
  supplies: "Tarvikkeet",
  cleaning: "Siivous",
  other: "Muut",
};

export type PaymentMethod = "card" | "cash" | "invoice" | "unknown";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: "Kortti",
  cash: "Käteinen",
  invoice: "Lasku",
  unknown: "Ei tiedossa",
};

export type ReceiptStatus = "confirmed" | "needs_review";

/**
 * Poimitun kentän luottamus. Sama rakenne kaikille kentille, jotta
 * käyttöliittymä voi merkitä epävarman tiedon ilman erikoistapauksia.
 *
 * Epävarmaa tietoa ei koskaan esitetä faktana — se on koko pointti.
 */
export interface Extracted<T> {
  value: T | null;
  confidence: "high" | "medium" | "low";
  /** Näytetään käyttäjälle kun luottamus ei ole korkea. */
  hint?: string;
}

export interface ReceiptLine {
  description: string;
  quantity: number | null;
  totalCents: number;
}

export interface Receipt {
  id: string;
  supplier: string;
  /** ISO-päivä, esim. "2026-08-20". */
  date: string;
  totalCents: number;
  vatCents: number | null;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  receiptNumber: string | null;
  note: string | null;
  status: ReceiptStatus;
  /** Miksi kuitti odottaa tarkistusta. Tyhjä kun status on confirmed. */
  reviewReasons: ReviewReason[];
  lines: ReceiptLine[];
  addedByUserId: string;
  addedAt: string;
  /** Onko kuittikuva tallessa. */
  hasImage: boolean;
}

export type ReviewReason =
  | "vat_missing"
  | "vat_uncertain"
  | "category_missing"
  | "total_uncertain"
  | "supplier_uncertain"
  | "date_uncertain"
  | "duplicate_suspected";

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  vat_missing: "ALV puuttuu",
  vat_uncertain: "ALV epävarma",
  category_missing: "Kategoria puuttuu",
  total_uncertain: "Tunnistettu summa epävarma",
  supplier_uncertain: "Toimittaja epävarma",
  date_uncertain: "Päivämäärä epävarma",
  duplicate_suspected: "Mahdollinen kaksoiskappale",
};

// ---------------------------------------------------------------------------
// Henkilöstö
// ---------------------------------------------------------------------------

export type StaffRole = "waiter" | "kitchen" | "manager" | "cleaning";

export const ROLE_LABELS: Record<StaffRole, string> = {
  waiter: "Tarjoilija",
  kitchen: "Keittiö",
  manager: "Manager",
  cleaning: "Siivous",
};

export interface Employee {
  id: string;
  name: string;
  role: StaffRole;
  /** Tuntipalkka sentteinä. Henkilöstökulu lasketaan tästä ja tunneista. */
  hourlyRateCents: number;
  /** Näkeekö työntekijä kuitit. Osa ravintoloista ei halua tätä. */
  canSeeReceipts: boolean;
  initials: string;
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

export type ShiftStatus = "approved" | "pending" | "changed";

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  approved: "Hyväksytty",
  pending: "Odottaa hyväksyntää",
  changed: "Muuttunut",
};

export interface Shift {
  id: string;
  employeeId: string;
  /** ISO-päivä. */
  date: string;
  /** "14:00" */
  startTime: string;
  /** "22:00" */
  endTime: string;
  location: string;
  status: ShiftStatus;
  /** Kun vuoro on muuttunut, alkuperäiset ajat säilytetään. */
  previousStartTime?: string;
  previousEndTime?: string;
}

/** Avoin vuoro jolle ei ole vielä tekijää. */
export interface OpenShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: StaffRole;
}

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

export type ClockEventType = "in" | "break_start" | "break_end" | "out";

export const CLOCK_EVENT_LABELS: Record<ClockEventType, string> = {
  in: "Sisään",
  break_start: "Tauko",
  break_end: "Takaisin töihin",
  out: "Ulos",
};

export interface ClockEvent {
  id: string;
  employeeId: string;
  type: ClockEventType;
  /** ISO-aikaleima. */
  at: string;
}

/** Työntekijän tila juuri nyt. Johdettu tapahtumista, ei tallennettu. */
export type ClockState = "off" | "working" | "on_break";

export const CLOCK_STATE_LABELS: Record<ClockState, string> = {
  off: "Et ole tällä hetkellä töissä",
  working: "Olet nyt töissä",
  on_break: "Olet tauolla",
};
