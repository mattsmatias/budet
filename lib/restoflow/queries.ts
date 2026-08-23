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

import type { PayComponent, TimeCorrection } from "./payroll";
import type { Merchant } from "./merchants";
import type { AllergenType, DietType, LunchWeek } from "./lunch";
import { createClient } from "@/utils/supabase/server";
import type {
  MerchantCategory,
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

/**
 * Ravintolan henkilöstö.
 *
 * Palkka ei tule jäsenriviltä vaan erillisestä funktiosta. Sarakkeen
 * lukuoikeus on poistettu kannasta (migraatio 0028), koska rivikäytäntö
 * antoi jokaiselle jäsenelle koko henkilöstön palkat rajapinnan kautta.
 *
 * Jos kutsuja ei ole esihenkilö, funktio palauttaa tyhjän ja palkaksi
 * jää null. Se on sama arvo jonka tyyppi on aina sallinut, joten
 * kutsuva koodi käsittelee sen jo.
 */
export async function fetchUsers(restaurantId: string): Promise<User[]> {
  const supabase = await createClient();

  const [members, rates] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, position, active, profiles ( full_name )")
      .eq("restaurant_id", restaurantId)
      .eq("active", true),
    supabase.rpc("staff_pay_rates", { p_restaurant: restaurantId }),
  ]);

  if (members.error || !members.data) return [];

  const rateByUser = new Map<string, number | null>(
    ((rates.data as { user_id: string; hourly_rate_cents: number | null }[] | null) ?? [])
      .map((row) => [row.user_id, row.hourly_rate_cents]),
  );

  return members.data.map((row) => {
    const name =
      (row.profiles as unknown as { full_name: string | null } | null)?.full_name ??
      "Nimetön";
    const id = row.user_id as string;

    return {
      id,
      restaurantId,
      name,
      role: row.role as User["role"],
      position: (row.position as User["position"]) ?? null,
      hourlyRateCents: rateByUser.get(id) ?? null,
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
      "id, name, default_category, merchant_id, merchant_confidence, merchant_confirmed, supplier_category_overrides ( from_category, to_category, count )",
    )
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId,
    name: row.name as string,
    defaultCategory: row.default_category as ExpenseCategory,
    merchantId: (row.merchant_id as string | null) ?? null,
    merchantConfidence: row.merchant_confidence === null
      ? null
      : Number(row.merchant_confidence),
    merchantConfirmed: Boolean(row.merchant_confirmed),
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

/**
 * Brändiluettelo.
 *
 * Yhteinen kaikille eikä ravintolakohtainen, joten hakua ei rajata
 * millään. Luettelo on pieni ja muuttuu vain migraatioilla, joten se
 * haetaan kokonaan kerralla — osittainen haku tarkoittaisi että
 * tunnistus näkisi eri joukon kuin käyttöliittymä.
 */
export async function fetchMerchants(): Promise<Merchant[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id, name, legal_name, business_id, category, subcategory, brand_color, brand_background, logo_url, merchant_aliases ( alias )",
    )
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    legalName: (row.legal_name as string | null) ?? null,
    businessId: (row.business_id as string | null) ?? null,
    category: row.category as string,
    subcategory: (row.subcategory as string | null) ?? null,
    brandColor: row.brand_color as string,
    brandBackground: row.brand_background as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    aliases: ((row.merchant_aliases as unknown as { alias: string }[]) ?? []).map(
      (a) => a.alias,
    ),
  }));
}

/** Brändikategorioiden nimet. Luetaan kannasta, ei kovakoodattu. */
export async function fetchMerchantCategories(): Promise<MerchantCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merchant_categories")
    .select("id, label, sort_order")
    .order("sort_order");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    sortOrder: row.sort_order as number,
  }));
}

// ---------------------------------------------------------------------------
// Lounas
// ---------------------------------------------------------------------------
//
// Nämä eivät ole fetchRestaurantDatassa. Se paketti ladataan jokaisella
// hallintasivulla, ja lounasviikko kiinnostaa vain yhtä sivua — mukaan
// otettuna se hidastaisi kaikkia muita.

/** Yhden viikon lounaslista päivineen, hintoineen ja ruokineen. */
export async function fetchLunchWeek(
  restaurantId: string,
  weekStart: string,
): Promise<LunchWeek | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lunch_menus")
    .select(
      "id, week_start, week_end, status, published_at, content_updated_at, includes_dessert, includes_coffee, lunch_prices ( id, name, price_cents, sort_order ), lunch_days ( id, date, lunch_items ( id, name, description, sort_order, lunch_item_diets ( diet_type ), lunch_item_allergens ( allergen_type ) ) )",
    )
    .eq("restaurant_id", restaurantId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error || !data) return null;

  const days = ((data.lunch_days as unknown as LunchDayRow[]) ?? [])
    .map((day) => ({
      id: day.id,
      date: day.date,
      items: (day.lunch_items ?? [])
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? null,
          sortOrder: item.sort_order,
          diets: (item.lunch_item_diets ?? []).map((d) => d.diet_type),
          allergens: (item.lunch_item_allergens ?? []).map((a) => a.allergen_type),
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const prices = (
    (data.lunch_prices as unknown as {
      id: string;
      name: string;
      price_cents: number;
      sort_order: number;
    }[]) ?? []
  )
    .map((price) => ({
      id: price.id,
      name: price.name,
      cents: price.price_cents,
      sortOrder: price.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    id: data.id as string,
    weekStart: data.week_start as string,
    weekEnd: data.week_end as string,
    prices,
    includesDessert: Boolean(data.includes_dessert),
    includesCoffee: Boolean(data.includes_coffee),
    status: data.status as LunchWeek["status"],
    publishedAt: (data.published_at as string | null) ?? null,
    contentUpdatedAt: data.content_updated_at as string,
    days,
  };
}

interface LunchDayRow {
  id: string;
  date: string;
  lunch_items:
    | {
        id: string;
        name: string;
        description: string | null;
        sort_order: number;
        lunch_item_diets: { diet_type: string }[] | null;
        lunch_item_allergens: { allergen_type: string }[] | null;
      }[]
    | null;
}

export interface LunchWeekSummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: LunchWeek["status"];
  publishedAt: string | null;
  itemCount: number;
}

/** Aiemmat viikot historialistaa varten, uusin ensin. */
export async function fetchLunchHistory(
  restaurantId: string,
  limit = 12,
): Promise<LunchWeekSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lunch_menus")
    .select(
      "id, week_start, week_end, status, published_at, lunch_days ( lunch_items ( id ) )",
    )
    .eq("restaurant_id", restaurantId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    weekStart: row.week_start as string,
    weekEnd: row.week_end as string,
    status: row.status as LunchWeek["status"],
    publishedAt: (row.published_at as string | null) ?? null,
    itemCount: (
      (row.lunch_days as unknown as { lunch_items: unknown[] | null }[]) ?? []
    ).reduce((sum, day) => sum + (day.lunch_items?.length ?? 0), 0),
  }));
}

/** Ruokavaliot ja allergeenit. Sanastot kannassa, ei koodissa. */
export async function fetchDietTypes(): Promise<DietType[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diet_types")
    .select("id, label, short_label")
    .order("sort_order");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    shortLabel: row.short_label as string,
  }));
}

export async function fetchAllergenTypes(): Promise<AllergenType[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("allergen_types")
    .select("id, label")
    .order("sort_order");

  if (error || !data) return [];

  return data.map((row) => ({ id: row.id as string, label: row.label as string }));
}

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
  /** Tunnetut kaupat. Yhteinen luettelo, ei ravintolakohtainen. */
  merchants: Merchant[];
  merchantCategories: MerchantCategory[];
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
    merchants,
    merchantCategories,
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
    fetchMerchants(),
    fetchMerchantCategories(),
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
    merchants,
    merchantCategories,
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

// ---------------------------------------------------------------------------
// Palkat
// ---------------------------------------------------------------------------
//
// Nämä eivät ole fetchRestaurantDatassa. Se paketti ladataan jokaisella
// hallintasivulla, ja palkkatietoja tarvitsee vain Palkat-sivu.

export async function fetchPayComponents(
  restaurantId: string,
): Promise<PayComponent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_components")
    .select(
      "id, name, code, unit, value, weekdays, from_minute, to_minute, stackable, valid_from, valid_to, active",
    )
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    unit: row.unit as PayComponent["unit"],
    // numeric tulee merkkijonona: Number() ennen laskentaa.
    value: Number(row.value),
    weekdays: (row.weekdays as number[] | null) ?? [],
    fromMinute: (row.from_minute as number | null) ?? null,
    toMinute: (row.to_minute as number | null) ?? null,
    stackable: Boolean(row.stackable),
    validFrom: row.valid_from as string,
    validTo: (row.valid_to as string | null) ?? null,
    active: Boolean(row.active),
  }));
}

export interface PayPeriod {
  id: string;
  startsOn: string;
  endsOn: string;
  status: "open" | "review" | "approved" | "paid";
  approvedAt: string | null;
  paidAt: string | null;
}

export async function fetchPayPeriods(restaurantId: string): Promise<PayPeriod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_periods")
    .select("id, starts_on, ends_on, status, approved_at, paid_at")
    .eq("restaurant_id", restaurantId)
    .order("starts_on", { ascending: false })
    .limit(24);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
    status: row.status as PayPeriod["status"],
    approvedAt: (row.approved_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
  }));
}

/** Korjaukset aikaväliltä. Palkkalaskenta tarvitsee vain kauden omat. */
export async function fetchTimeCorrections(
  restaurantId: string,
  fromDate: string,
  toDate: string,
): Promise<TimeCorrection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_corrections")
    .select(
      "id, user_id, work_date, corrected_in, corrected_out, corrected_break_minutes, reason",
    )
    .eq("restaurant_id", restaurantId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    workDate: row.work_date as string,
    correctedIn: row.corrected_in as string,
    correctedOut: row.corrected_out as string,
    correctedBreakMinutes: (row.corrected_break_minutes as number | null) ?? 0,
    reason: row.reason as string,
  }));
}

/** Yhden korjauksen koko tarina, tarkastusnäkymään. */
export interface CorrectionRecord extends TimeCorrection {
  originalIn: string | null;
  originalOut: string | null;
  createdBy: string;
  createdAt: string;
}

export async function fetchCorrectionHistory(
  restaurantId: string,
  fromDate: string,
  toDate: string,
): Promise<CorrectionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_corrections")
    .select(
      "id, user_id, work_date, original_in, original_out, corrected_in, corrected_out, corrected_break_minutes, reason, created_by, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    workDate: row.work_date as string,
    originalIn: (row.original_in as string | null) ?? null,
    originalOut: (row.original_out as string | null) ?? null,
    correctedIn: row.corrected_in as string,
    correctedOut: row.corrected_out as string,
    correctedBreakMinutes: (row.corrected_break_minutes as number | null) ?? 0,
    reason: row.reason as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }));
}

export interface StoredPayslip {
  id: string;
  userId: string;
  status: "draft" | "review" | "approved";
  workedMinutes: number;
  baseCents: number;
  supplementsCents: number;
  grossCents: number;
  sourceFingerprint: string;
  approvedAt: string | null;
}

export async function fetchPayslips(periodId: string): Promise<StoredPayslip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select(
      "id, user_id, status, worked_minutes, base_cents, supplements_cents, gross_cents, source_fingerprint, approved_at",
    )
    .eq("pay_period_id", periodId);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as StoredPayslip["status"],
    workedMinutes: (row.worked_minutes as number | null) ?? 0,
    baseCents: (row.base_cents as number | null) ?? 0,
    supplementsCents: (row.supplements_cents as number | null) ?? 0,
    grossCents: (row.gross_cents as number | null) ?? 0,
    sourceFingerprint: (row.source_fingerprint as string | null) ?? "",
    approvedAt: (row.approved_at as string | null) ?? null,
  }));
}
