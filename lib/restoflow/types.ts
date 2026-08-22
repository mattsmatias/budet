/**
 * Budet'n domain-tyypit.
 *
 * Rakenne:
 *   Restaurant → Membership → User (rooli)
 *              → Supplier
 *              → Receipt → ReceiptItem
 *              → Budget
 *              → Shift ⇄ TimeEntry
 *              → Notification (johdettu, ei tallennettu)
 *
 * Rajaus on tarkoituksellinen: kuitit, kulut, työvuorot ja työaika. Ei
 * myyntiä, ei kassaa, ei pankkiyhteyttä, ei varastoa. Tietomallissa ei ole
 * kenttää liikevaihdolle, jotta käyttöliittymä ei voi vahingossa esittää
 * kulutietoja ravintolan tuloksena.
 *
 * Rahamäärät ovat AINA sentteinä kokonaislukuina. Liukuluku ei kelpaa
 * rahaan: 0.1 + 0.2 ei ole 0.3.
 */

// ---------------------------------------------------------------------------
// Ravintola ja käyttäjät
// ---------------------------------------------------------------------------

export interface Restaurant {
  id: string;
  name: string;
  /** IANA-vyöhyke. Työaika lasketaan tässä ajassa. */
  timezone: string;
  currency: "EUR";
}

/**
 * Roolit.
 *
 * Owner ja manager eroavat vain siinä että owner voi hallita käyttäjiä ja
 * budjetteja. Accountant on lukuoikeus talouteen ilman henkilöstön
 * yksityiskohtia. Employee näkee vain omansa.
 */
export type Role = "owner" | "manager" | "employee" | "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Omistaja",
  manager: "Manager",
  employee: "Työntekijä",
  accountant: "Kirjanpitäjä",
};

export type StaffPosition = "waiter" | "kitchen" | "manager" | "cleaning";

export const POSITION_LABELS: Record<StaffPosition, string> = {
  waiter: "Tarjoilija",
  kitchen: "Keittiö",
  manager: "Vuoropäällikkö",
  cleaning: "Siivous",
};

export interface User {
  id: string;
  restaurantId: string;
  name: string;
  role: Role;
  position: StaffPosition | null;
  /** Tuntipalkka sentteinä. Null kirjanpitäjälle. */
  hourlyRateCents: number | null;
  initials: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Kategoriat
// ---------------------------------------------------------------------------

export type ExpenseCategory =
  | "food"
  | "alcohol"
  | "soft_drinks"
  | "cleaning"
  | "kitchen_supplies"
  | "packaging"
  | "staff"
  | "transport"
  | "other";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Ruoka",
  alcohol: "Alkoholi",
  soft_drinks: "Alkoholittomat",
  cleaning: "Siivous",
  kitchen_supplies: "Keittiötarvikkeet",
  packaging: "Pakkausmateriaalit",
  staff: "Henkilöstö",
  transport: "Kuljetus",
  other: "Muut",
};

/** Kategoriat esitysjärjestyksessä. */
export const CATEGORY_ORDER: ExpenseCategory[] = [
  "food",
  "alcohol",
  "soft_drinks",
  "kitchen_supplies",
  "packaging",
  "cleaning",
  "transport",
  "staff",
  "other",
];

// ---------------------------------------------------------------------------
// ALV
// ---------------------------------------------------------------------------

/**
 * Odotetut ALV-kannat kategorioittain.
 *
 * DEMO-ARVOJA. Näitä ei ole validoitu virallista lähdettä vasten, ja niitä
 * käytetään VAIN poikkeamien tunnistukseen — ei koskaan verokannan
 * asettamiseen käyttäjän puolesta. Jos poimittu ALV ei vastaa odotettua,
 * kuitti merkitään tarkistettavaksi eikä arvoa muuteta.
 */
export const EXPECTED_VAT_RATES: Record<ExpenseCategory, number[]> = {
  food: [0.145],
  alcohol: [0.255],
  soft_drinks: [0.145, 0.255],
  cleaning: [0.255],
  kitchen_supplies: [0.255],
  packaging: [0.255],
  staff: [0.255],
  transport: [0.255],
  other: [0.145, 0.255],
};

export type PaymentMethod = "card" | "cash" | "invoice" | "unknown";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: "Kortti",
  cash: "Käteinen",
  invoice: "Lasku",
  unknown: "Ei tiedossa",
};

// ---------------------------------------------------------------------------
// Kuitit
// ---------------------------------------------------------------------------

export type ReceiptStatus = "confirmed" | "needs_review";

/**
 * Poimitun kentän luottamus. Sama rakenne kaikille kentille, jotta
 * käyttöliittymä voi merkitä epävarman tiedon ilman erikoistapauksia.
 */
export interface Extracted<T> {
  value: T | null;
  confidence: "high" | "medium" | "low";
  hint?: string;
}

/**
 * Kuitin rivi.
 *
 * Jokaisella rivillä on oma kategoriansa ja ALV-kantansa. Ilman tätä
 * kysymykseen "mihin 312,50 € meni" ei voi vastata, ja sekakuitti
 * (ruokaa + pesuainetta) kirjautuisi kokonaan väärään kategoriaan.
 */
export interface ReceiptItem {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  totalCents: number;
  category: ExpenseCategory;
  vatRate: number | null;
  vatCents: number | null;
  /** Tuoteryhmä, jos tunnistettu. */
  productGroup: string | null;
}

/**
 * Ravintolan oma kulukategoria.
 *
 * Kartoittuu aina yhteen yhdeksästä perusluokasta. Perusluokka ratkaisee
 * ALV-odotuksen ja budjetin, oma nimi vain sen miltä rivi näyttää
 * raportissa. Ilman kytköstä järjestelmä ei tietäisi mitä ALV-kannan
 * pitäisi olla.
 */
export interface CustomCategory {
  id: string;
  restaurantId: string;
  name: string;
  baseCategory: ExpenseCategory;
  active: boolean;
  sortOrder: number;
}

export interface Receipt {
  id: string;
  restaurantId: string;
  supplierId: string;
  supplierName: string;
  /** ISO-päivä, esim. "2026-08-20". */
  date: string;
  totalCents: number;
  vatCents: number | null;
  /** Dokumenttitason kategoria — johdettu riveiltä kun niitä on. */
  category: ExpenseCategory;
  /** Ravintolan oma kategoria, jos sellainen on valittu. */
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  receiptNumber: string | null;
  note: string | null;
  status: ReceiptStatus;
  reviewReasons: ReviewReason[];
  items: ReceiptItem[];
  addedByUserId: string;
  addedAt: string;
  hasImage: boolean;
  /** Polku tallennuksessa. Kuvaa ei voi näyttää ilman tätä. */
  imagePath: string | null;
  /** Kuvan laatuarvio poiminnasta. Vaikuttaa tarkistustarpeeseen. */
  imageQuality: "good" | "poor" | null;
}

export type ReviewReason =
  | "vat_missing"
  | "vat_uncertain"
  | "vat_mismatch"
  | "category_missing"
  | "total_uncertain"
  | "supplier_uncertain"
  | "date_uncertain"
  | "payment_missing"
  | "duplicate_suspected"
  | "poor_image"
  | "items_dont_sum";

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  vat_missing: "ALV puuttuu",
  vat_uncertain: "ALV epävarma",
  vat_mismatch: "ALV ei vastaa kategorian verokantaa",
  category_missing: "Kategoria puuttuu",
  total_uncertain: "Tunnistettu summa epävarma",
  supplier_uncertain: "Toimittaja epävarma",
  date_uncertain: "Päivämäärä epävarma",
  payment_missing: "Maksutapa puuttuu",
  duplicate_suspected: "Mahdollinen kaksoiskappale",
  poor_image: "Kuittikuva epäselvä",
  items_dont_sum: "Rivien summa ei täsmää loppusummaan",
};

// ---------------------------------------------------------------------------
// Toimittajat
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  /** Kategoria jota tämä toimittaja tyypillisesti edustaa. */
  defaultCategory: ExpenseCategory;
  /**
   * Managerin tekemät kategoriakorjaukset. Kun sama korjaus toistuu,
   * sitä ehdotetaan jatkossa — tämä on "oppiminen", ei mallin koulutus.
   */
  categoryOverrides: { from: ExpenseCategory; to: ExpenseCategory; count: number }[];
}

// ---------------------------------------------------------------------------
// Budjetit
// ---------------------------------------------------------------------------

export interface Budget {
  id: string;
  restaurantId: string;
  category: ExpenseCategory;
  /** Kuukausi "2026-08", tai null jos toistuva joka kuukausi. */
  month: string | null;
  amountCents: number;
}

export type BudgetStatus = "ok" | "warning" | "exceeded" | "none";

// ---------------------------------------------------------------------------
// Työvuorot ja työaika
// ---------------------------------------------------------------------------

export type ShiftStatus = "draft" | "pending" | "accepted" | "declined" | "changed";

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  draft: "Luonnos",
  pending: "Odottaa vastausta",
  accepted: "Hyväksytty",
  declined: "Ei pääse",
  changed: "Muuttunut",
};

export interface Shift {
  id: string;
  restaurantId: string;
  userId: string;
  date: string;
  /** "14:00" */
  startTime: string;
  endTime: string;
  location: string;
  status: ShiftStatus;
  previousStartTime?: string;
  previousEndTime?: string;
}

export interface OpenShift {
  id: string;
  restaurantId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: StaffPosition;
}

export type ClockEventType = "in" | "break_start" | "break_end" | "out";

export const CLOCK_EVENT_LABELS: Record<ClockEventType, string> = {
  in: "Sisään",
  break_start: "Tauko",
  break_end: "Takaisin töihin",
  out: "Ulos",
};

/** Yksittäinen leimaus. Työaika johdetaan näistä, ei tallenneta erikseen. */
export interface ClockEvent {
  id: string;
  userId: string;
  type: ClockEventType;
  at: string;
}

export type ClockState = "off" | "working" | "on_break";

export const CLOCK_STATE_LABELS: Record<ClockState, string> = {
  off: "Et ole tällä hetkellä töissä",
  working: "Olet nyt töissä",
  on_break: "Olet tauolla",
};

// ---------------------------------------------------------------------------
// Poissaolot
// ---------------------------------------------------------------------------

export type AbsenceKind = "sick" | "other" | "cannot_attend";

export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  sick: "Sairaus",
  other: "Muu poissaolo",
  cannot_attend: "En pääse vuoroon",
};

export interface Absence {
  id: string;
  userId: string;
  date: string;
  kind: AbsenceKind;
  note: string | null;
  reportedAt: string;
}

// ---------------------------------------------------------------------------
// Ilmoitukset ja poikkeamat
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertKind =
  | "duplicate_receipt"
  | "budget_warning"
  | "budget_exceeded"
  | "supplier_spike"
  | "receipt_needs_review"
  | "missing_payment_method"
  | "vat_mismatch"
  | "unclosed_shift"
  | "shift_pending"
  | "open_shift"
  | "shift_variance";

/**
 * Poikkeama.
 *
 * Johdetaan aina aineiston tilasta, ei tallenneta. Tallennettu hälytys
 * jäisi roikkumaan senkin jälkeen kun asia on hoidettu.
 */
export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
  /** Mitä tämä koskee — käytetään ryhmittelyyn. */
  entityId?: string;
}
