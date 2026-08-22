/**
 * Kyselyt tietokantaan.
 *
 * Muuntaa kannan rivit domain-tyypeiksi, jotta näkymät ja laskenta eivät
 * tunne sarakenimiä. Yksi muunnospaikka tarkoittaa myös että kentän
 * uudelleennimeäminen kannassa koskee yhtä tiedostoa.
 *
 * RLS hoitaa rajaukset, joten näissä ei ole ravintolakohtaisia
 * turvatarkistuksia — ne olisivat toisto joka voi ajautua eri linjalle.
 * Ravintolatunniste on silti kyselyissä mukana, koska ilman sitä
 * tietokannan pitäisi skannata kaikki rivit joihin käyttäjällä on oikeus.
 */

import { createClient } from "@/utils/supabase/server";
import type {
  CustomCategory,
  Absence,
  Budget,
  OpenShift,
  ClockEvent,
  ExpenseCategory,
  Receipt,
  ReceiptItem,
  ReviewReason,
  Shift,
  Supplier,
  User,
} from "./types";

// ---------------------------------------------------------------------------
// Kuitit
// ---------------------------------------------------------------------------

const RECEIPT_COLUMNS = `
  id, restaurant_id, supplier_id, supplier_name, receipt_date, total_cents,
  vat_cents, category, payment_method, receipt_number, note, status,
  review_reasons, image_path, image_quality, added_by, created_at, category_id,
  receipt_items (
    id, line_number, description, quantity, unit, total_cents, category,
    vat_rate, vat_cents, product_group
  )
`;

interface ReceiptRow {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  supplier_name: string;
  receipt_date: string;
  total_cents: number;
  vat_cents: number | null;
  category: string;
  payment_method: string;
  receipt_number: string | null;
  note: string | null;
  status: string;
  review_reasons: string[] | null;
  image_path: string | null;
  category_id: string | null;
  image_quality: string | null;
  added_by: string;
  created_at: string;
  receipt_items: ItemRow[] | null;
}

interface ItemRow {
  id: string;
  line_number: number;
  description: string | null;
  quantity: string | number | null;
  unit: string | null;
  total_cents: number;
  category: string;
  vat_rate: string | number | null;
  vat_cents: number | null;
  product_group: string | null;
}

function toItem(row: ItemRow): ReceiptItem {
  return {
    id: row.id,
    lineNumber: row.line_number,
    description: row.description ?? "",
    // numeric palautuu merkkijonona: Postgresin numeric ei mahdu turvallisesti
    // JavaScriptin numeroon, joten ajuri ei muunna sitä puolestamme.
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    totalCents: row.total_cents,
    category: row.category as ExpenseCategory,
    vatRate: row.vat_rate === null ? null : Number(row.vat_rate),
    vatCents: row.vat_cents,
    productGroup: row.product_group,
  };
}

function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    supplierId: row.supplier_id ?? "",
    supplierName: row.supplier_name,
    date: row.receipt_date,
    totalCents: row.total_cents,
    vatCents: row.vat_cents,
    category: row.category as ExpenseCategory,
    paymentMethod: row.payment_method as Receipt["paymentMethod"],
    receiptNumber: row.receipt_number,
    note: row.note,
    status: row.status as Receipt["status"],
    reviewReasons: (row.review_reasons ?? []) as ReviewReason[],
    items: (row.receipt_items ?? [])
      .slice()
      .sort((a, b) => a.line_number - b.line_number)
      .map(toItem),
    addedByUserId: row.added_by,
    addedAt: row.created_at,
    hasImage: Boolean(row.image_path),
    imagePath: row.image_path,
    categoryId: row.category_id,
    imageQuality: (row.image_quality as "good" | "poor" | null) ?? null,
  };
}

/**
 * Kuitit ravintolalle.
 *
 * Raja on korkea mutta olemassa: ilman sitä yhden vuoden aineisto
 * ladattaisiin kokonaan joka sivunlatauksella.
 */
export async function fetchReceipts(
  restaurantId: string,
  limit = 500,
): Promise<Receipt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select(RECEIPT_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("receipt_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as ReceiptRow[]).map(toReceipt);
}

export async function fetchReceipt(id: string): Promise<Receipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipts")
    .select(RECEIPT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toReceipt(data as unknown as ReceiptRow);
}

/**
 * Lyhytikäinen osoite kuitin kuvalle.
 *
 * Bucket on yksityinen, joten suora osoite ei toimi. Allekirjoitus
 * vanhenee tunnissa: linkki joka päätyy vahingossa eteenpäin ei jää
 * auki loputtomiin. RLS ratkaisee pääsyn, joten toisen ravintolan
 * kuvalle ei saa allekirjoitusta.
 */
export async function fetchReceiptImageUrl(
  imagePath: string | null,
): Promise<string | null> {
  if (!imagePath) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(imagePath, 3600);

  if (error || !data) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Käyttäjät
// ---------------------------------------------------------------------------

export async function fetchUsers(restaurantId: string): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, position, hourly_rate_cents, active, profiles ( full_name )")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);

  if (error || !data) return [];

  return data.map((row) => {
    const name =
      (row.profiles as unknown as { full_name: string | null } | null)?.full_name ??
      "Nimetön";

    return {
      id: row.user_id as string,
      restaurantId,
      name,
      role: row.role as User["role"],
      position: (row.position as User["position"]) ?? null,
      hourlyRateCents: (row.hourly_rate_cents as number | null) ?? null,
      initials: initialsOf(name),
      active: Boolean(row.active),
    };
  });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Toimittajat
// ---------------------------------------------------------------------------

export async function fetchSuppliers(restaurantId: string): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, name, default_category, supplier_category_overrides ( from_category, to_category, count )",
    )
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId,
    name: row.name as string,
    defaultCategory: row.default_category as ExpenseCategory,
    categoryOverrides: (
      (row.supplier_category_overrides as unknown as {
        from_category: string;
        to_category: string;
        count: number;
      }[]) ?? []
    ).map((o) => ({
      from: o.from_category as ExpenseCategory,
      to: o.to_category as ExpenseCategory,
      count: o.count,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Budjetit
// ---------------------------------------------------------------------------

export async function fetchBudgets(restaurantId: string): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, category, month, amount_cents")
    .eq("restaurant_id", restaurantId);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId,
    category: row.category as ExpenseCategory,
    // Kannassa kuukauden ensimmäinen päivä, domainissa "2026-08".
    month: row.month ? (row.month as string).slice(0, 7) : null,
    amountCents: row.amount_cents as number,
  }));
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

export async function fetchShifts(
  restaurantId: string,
  fromDate?: string,
): Promise<Shift[]> {
  const supabase = await createClient();
  let query = supabase
    .from("shifts")
    .select(
      "id, user_id, position, shift_date, start_time, end_time, location, status, previous_start_time, previous_end_time",
    )
    .eq("restaurant_id", restaurantId)
    .order("shift_date");

  if (fromDate) query = query.gte("shift_date", fromDate);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((row) => row.user_id !== null)
    .map((row) => ({
      id: row.id as string,
      restaurantId,
      userId: row.user_id as string,
      date: row.shift_date as string,
      startTime: hhmm(row.start_time as string),
      endTime: hhmm(row.end_time as string),
      location: (row.location as string) ?? "",
      status: row.status as Shift["status"],
      previousStartTime: row.previous_start_time
        ? hhmm(row.previous_start_time as string)
        : undefined,
      previousEndTime: row.previous_end_time
        ? hhmm(row.previous_end_time as string)
        : undefined,
    }));
}

/** Avoimet vuorot — user_id on null. */
export async function fetchOpenShifts(
  restaurantId: string,
  fromDate?: string,
): Promise<OpenShift[]> {
  const supabase = await createClient();
  let query = supabase
    .from("shifts")
    .select("id, position, shift_date, start_time, end_time")
    .eq("restaurant_id", restaurantId)
    .is("user_id", null)
    .order("shift_date");

  if (fromDate) query = query.gte("shift_date", fromDate);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId,
    date: row.shift_date as string,
    startTime: hhmm(row.start_time as string),
    endTime: hhmm(row.end_time as string),
    position: (row.position as "waiter" | "kitchen" | "manager" | "cleaning") ?? "waiter",
  }));
}

/** Postgresin time palautuu muodossa "14:00:00". */
function hhmm(value: string): string {
  return value.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

export async function fetchClockEvents(
  restaurantId: string,
  fromIso?: string,
): Promise<ClockEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clock_events")
    .select("id, user_id, event_type, occurred_at")
    .eq("restaurant_id", restaurantId)
    .order("occurred_at");

  if (fromIso) query = query.gte("occurred_at", fromIso);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    type: row.event_type as ClockEvent["type"],
    at: row.occurred_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Poissaolot
// ---------------------------------------------------------------------------

export async function fetchAbsences(
  restaurantId: string,
  fromDate?: string,
): Promise<Absence[]> {
  const supabase = await createClient();
  let query = supabase
    .from("absences")
    .select(
      "id, user_id, absence_date, end_date, kind, note, created_at, certificate_seen_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("absence_date", { ascending: false });

  // Rajaus loppupäivään eikä alkuun: eilen alkanut sairausloma on yhä
  // voimassa tänään, ja alkupäivään rajaus pudottaisi sen listalta.
  if (fromDate) query = query.gte("end_date", fromDate);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    date: row.absence_date as string,
    endDate: (row.end_date as string) ?? (row.absence_date as string),
    kind: row.kind as Absence["kind"],
    note: (row.note as string | null) ?? null,
    reportedAt: row.created_at as string,
    certificateSeenAt: (row.certificate_seen_at as string | null) ?? null,
  }));
}

/**
 * Suljetut kuukaudet muodossa "2026-07".
 *
 * Kanta tallentaa kuukauden ensimmäisenä päivänä, jotta vertailu on
 * indeksoitavissa. Sovellus laskee kuukausilla merkkijonoina, joten
 * muunnos tehdään tässä eikä joka kutsupaikassa erikseen.
 */
export async function fetchClosedMonths(restaurantId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closed_months")
    .select("month")
    .eq("restaurant_id", restaurantId)
    .order("month", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => String(row.month).slice(0, 7));
}

/**
 * Ravintolan omat kulukategoriat.
 *
 * Myös passiiviset palautetaan: vanha kuitti voi viitata kategoriaan
 * joka on sittemmin poistettu käytöstä, ja sen nimi on silti näytettävä.
 */
export async function fetchExpenseCategories(
  restaurantId: string,
): Promise<CustomCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, restaurant_id, name, base_category, active, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    baseCategory: row.base_category as CustomCategory["baseCategory"],
    active: row.active as boolean,
    sortOrder: row.sort_order as number,
  }));
}

// ---------------------------------------------------------------------------
// Koottu näkymädata
// ---------------------------------------------------------------------------

export interface RestaurantData {
  receipts: Receipt[];
  openShifts: OpenShift[];
  users: User[];
  suppliers: Supplier[];
  budgets: Budget[];
  shifts: Shift[];
  clockEvents: ClockEvent[];
  absences: Absence[];
  /** Kuukaudet jotka on lukittu kirjanpitoon, uusin ensin. */
  closedMonths: string[];
  /** Ravintolan omat kulukategoriat. */
  categories: CustomCategory[];
}

/**
 * Kaikki mitä hallintanäkymä tarvitsee, yhdellä kierroksella.
 *
 * Rinnakkain: kyselyt eivät riipu toisistaan, ja peräkkäin ajettuna
 * sivunlataus kestäisi yhdeksän kyselyn verran.
 */
export async function fetchRestaurantData(
  restaurantId: string,
): Promise<RestaurantData> {
  const [
    receipts,
    users,
    suppliers,
    budgets,
    shifts,
    openShifts,
    clockEvents,
    absences,
    closedMonths,
    categories,
  ] = await Promise.all([
    fetchReceipts(restaurantId),
    fetchUsers(restaurantId),
    fetchSuppliers(restaurantId),
    fetchBudgets(restaurantId),
    fetchShifts(restaurantId),
    fetchOpenShifts(restaurantId),
    fetchClockEvents(restaurantId),
    fetchAbsences(restaurantId),
    fetchClosedMonths(restaurantId),
    fetchExpenseCategories(restaurantId),
  ]);

  return {
    receipts,
    users,
    suppliers,
    budgets,
    shifts,
    openShifts,
    clockEvents,
    absences,
    closedMonths,
    categories,
  };
}

// ---------------------------------------------------------------------------
// Kutsut
// ---------------------------------------------------------------------------

export interface Invitation {
  id: string;
  /** Koodin neljä viimeistä merkkiä. Koko koodia ei voi hakea. */
  codeHint: string;
  role: User["role"];
  position: User["position"];
  hourlyRateCents: number | null;
  label: string | null;
  expiresAt: string;
  createdAt: string;
}

/** Lunastamattomat, voimassa olevat kutsut. */
export async function fetchInvitations(
  restaurantId: string,
): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_invitations")
    .select("id, code_hint, role, position, hourly_rate_cents, label, expires_at, created_at")
    .eq("restaurant_id", restaurantId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    codeHint: row.code_hint as string,
    role: row.role as User["role"],
    position: (row.position as User["position"]) ?? null,
    hourlyRateCents: (row.hourly_rate_cents as number | null) ?? null,
    label: (row.label as string | null) ?? null,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  }));
}
