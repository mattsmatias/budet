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

import { cache } from "react";

import type {
  PosMapping,
  PosVatRate,
  SalesGroup,
  SalesLine,
} from "./sales-vat";
import type { DailySales } from "./sales";
import type { Task } from "./tasks";
import type { AuditEvent } from "./audit";
import type { Merchant } from "./merchants";
import { createClient } from "@/utils/supabase/server";
import type {
  MerchantCategory,
  CustomCategory,
  Budget,
  ExpenseCategory,
  Receipt,
  ReceiptItem,
  ReviewReason,
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
  receipt_pages ( page_number, storage_path, file_hash ),
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
  receipt_pages?: {
    page_number: number;
    storage_path: string;
    file_hash: string | null;
  }[];
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
    /*
     * Kuvallisuus tulee sivuista.
     *
     * image_path on peili ensimmäiseen sivuun; jos ne joskus eroaisivat,
     * sivut ovat oikeassa. Vanhat kuitit siirrettiin sivutauluun
     * migraatiossa 0040, joten tyhjä lista tarkoittaa oikeasti
     * kuvatonta kuittia.
     */
    hasImage: (row.receipt_pages ?? []).length > 0 || Boolean(row.image_path),
    imagePath: row.image_path,
    pages: (row.receipt_pages ?? [])
      .slice()
      .sort((a, b) => a.page_number - b.page_number)
      .map((page) => ({
        pageNumber: page.page_number,
        storagePath: page.storage_path,
        fileHash: page.file_hash,
      })),
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
 * Lyhytikäiset osoitteet kuitin sivuille.
 *
 * Bucket on yksityinen, joten suora osoite ei toimi. Allekirjoitus
 * vanhenee tunnissa: linkki joka päätyy vahingossa eteenpäin ei jää
 * auki loputtomiin. RLS ratkaisee pääsyn, joten toisen ravintolan
 * kuvalle ei saa allekirjoitusta.
 *
 * SIVUJÄRJESTYS SÄILYY.
 *
 * Allekirjoitukset haetaan yhdellä kutsulla ja järjestetään takaisin
 * annettuun järjestykseen. Rajapinta ei lupaa palauttavansa rivejä
 * samassa järjestyksessä, ja sivujärjestys on osa kuitin sisältöä —
 * kolmisivuisen laskun sivu 3 ei saa näkyä ensimmäisenä.
 *
 * Yksi epäonnistunut sivu ei kaada muita: se jää pois listalta, ja
 * loput näkyvät.
 */
export async function fetchReceiptImageUrls(
  paths: string[],
): Promise<string[]> {
  const wanted = paths.filter((path) => path.trim() !== "");
  if (wanted.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrls(wanted, 3600);

  if (error || !data) return [];

  const byPath = new Map(
    data
      .filter((row) => row.signedUrl)
      .map((row) => [row.path ?? "", row.signedUrl]),
  );

  return wanted
    .map((path) => byPath.get(path))
    .filter((url): url is string => Boolean(url));
}

// ---------------------------------------------------------------------------
// Käyttäjät
// ---------------------------------------------------------------------------

/**
 * Ravintolan aktiiviset käyttäjät.
 *
 * Nimi ja rooli. Tehtävien vastuuhenkilöt, toimintaloki ja raporttien
 * vastaanottajat tarvitsevat nämä — palkkatietoja Katessa ei ole, koska
 * palkat maksetaan palkkapalvelussa.
 */
export async function fetchUsers(restaurantId: string): Promise<User[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, active, profiles ( full_name )")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);

  if (error || !data) return [];

  return data.map((row) => {
    const name =
      (row.profiles as unknown as { full_name: string | null } | null)
        ?.full_name ?? "Nimetön";

    return {
      id: row.user_id as string,
      restaurantId,
      name,
      role: row.role as User["role"],
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

export async function fetchSuppliers(
  restaurantId: string,
): Promise<Supplier[]> {
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
    merchantConfidence:
      row.merchant_confidence === null ? null : Number(row.merchant_confidence),
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
// Kuukaudet ja kategoriat
// ---------------------------------------------------------------------------

/**
 * Suljetut kuukaudet muodossa "2026-07".
 *
 * Kanta tallentaa kuukauden ensimmäisenä päivänä, jotta vertailu on
 * indeksoitavissa. Sovellus laskee kuukausilla merkkijonoina, joten
 * muunnos tehdään tässä eikä joka kutsupaikassa erikseen.
 */
export async function fetchClosedMonths(
  restaurantId: string,
): Promise<string[]> {
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
    aliases: (
      (row.merchant_aliases as unknown as { alias: string }[]) ?? []
    ).map((a) => a.alias),
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

export interface RestaurantData {
  receipts: Receipt[];
  users: User[];
  suppliers: Supplier[];
  budgets: Budget[];
  /** Kuukaudet jotka on lukittu kirjanpitoon, uusin ensin. */
  closedMonths: string[];
  /** Ravintolan omat kulukategoriat. */
  categories: CustomCategory[];
  /** Tunnetut kaupat. Yhteinen luettelo, ei ravintolakohtainen. */
  merchants: Merchant[];
  merchantCategories: MerchantCategory[];
  /** Päivän myynnit, uusin ensin. Poikkeamat tarvitsevat vertailuhistorian. */
  sales: DailySales[];
  /**
   * Myyntiryhmät ja kassaryhmien kohdistukset.
   *
   * Mukana kuormassa eikä erikseen haettuna, koska verokantaa tarvitaan
   * joka paikassa jossa myynnistä puhutaan — ja kaksi lähdettä samalle
   * kannalle ajautuisi erilleen.
   */
  salesGroups: SalesGroup[];
  posMappings: PosMapping[];
  /* Tehtävät samassa paketissa: yksi lähde, monta näkymää. */
  tasks: Task[];
}

/**
 * Koko ravintolan aineisto yhdellä kutsulla.
 *
 * YKSI HAKU PYYNTÖÄ KOHTI.
 *
 * cache() on tässä eikä kutsujissa. Kääre oli aiemmin sivukontekstissa,
 * mutta hallinnan layout kutsui tätä funktiota suoraan — se meni kääreen
 * ohi, ja layout ja sivu hakivat saman aineiston erikseen. Mitattuna se
 * oli 32 kyselyä kuudentoista sijaan jokaisella sivunvaihdolla.
 *
 * Kun kääre on lähteessä, uusi kutsuja ei voi vahingossa jäädä sen
 * ulkopuolelle.
 */
export const fetchRestaurantData = cache(loadRestaurantData);

async function loadRestaurantData(
  restaurantId: string,
): Promise<RestaurantData> {
  const [
    receipts,
    users,
    suppliers,
    budgets,
    closedMonths,
    categories,
    merchants,
    merchantCategories,
    sales,
    salesGroups,
    posMappings,
    tasks,
  ] = await Promise.all([
    fetchReceipts(restaurantId),
    fetchUsers(restaurantId),
    fetchSuppliers(restaurantId),
    fetchBudgets(restaurantId),
    fetchClosedMonths(restaurantId),
    fetchExpenseCategories(restaurantId),
    fetchMerchants(),
    fetchMerchantCategories(),
    fetchDailySales(restaurantId),
    fetchSalesGroups(restaurantId),
    fetchPosMappings(restaurantId),
    fetchTasks(restaurantId),
  ]);

  return {
    receipts,
    users,
    suppliers,
    budgets,
    closedMonths,
    categories,
    merchants,
    merchantCategories,
    sales,
    salesGroups,
    posMappings,
    tasks,
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
    .select(
      "id, code_hint, role, label, expires_at, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    codeHint: row.code_hint as string,
    role: row.role as User["role"],
    label: (row.label as string | null) ?? null,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Päivän myynti
// ---------------------------------------------------------------------------

/**
 * Myyntipäivät uusin ensin.
 *
 * Oletusraja kattaa noin kolme kuukautta: viikonpäivävertailu tarvitsee
 * historiaa, mutta koko historian lataaminen joka sivunlatauksella olisi
 * tuhlausta.
 */
export async function fetchDailySales(
  restaurantId: string,
  limit = 100,
): Promise<DailySales[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_sales")
    .select(
      "sales_date, net_sales_cents, gross_sales_cents, vat_cents, transactions, source, pos_gross_cents, pos_vat_cents, target_cents, note",
    )
    .eq("restaurant_id", restaurantId)
    .order("sales_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.sales_date as string,
    netCents: (row.net_sales_cents as number | null) ?? 0,
    targetCents: (row.target_cents as number | null) ?? null,
    note: (row.note as string | null) ?? null,
    grossCents: (row.gross_sales_cents as number | null) ?? null,
    vatCents: (row.vat_cents as number | null) ?? null,
    transactions: (row.transactions as number | null) ?? null,
    source: ((row.source as string | null) ?? "manual") as "manual" | "report",
    posGrossCents: (row.pos_gross_cents as number | null) ?? null,
    posVatCents: (row.pos_vat_cents as number | null) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Myyntiryhmät ja verokannat
// ---------------------------------------------------------------------------

/**
 * Ravintolan myyntiryhmät.
 *
 * Myös pois käytöstä otetut: vanhat myyntirivit viittaavat niihin, ja
 * ilman nimeä rivi olisi historiassa nimetön summa. "Käytössä" rajaa
 * vain sitä mitä uudelle riville voi valita.
 */
export async function fetchSalesGroups(
  restaurantId: string,
): Promise<SalesGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_groups")
    .select("id, name, vat_rate, active, is_default, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    // numeric tulee Supabasesta merkkijonona: Number tarvitaan, mutta
    // vain esitykseen — laskenta tapahtuu sentteinä.
    vatRate: Number(row.vat_rate),
    active: row.active as boolean,
    isDefault: row.is_default as boolean,
    sortOrder: row.sort_order as number,
  }));
}

/** Kassajärjestelmän ryhmänimien kohdistukset. */
export async function fetchPosMappings(
  restaurantId: string,
): Promise<PosMapping[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_sales_groups")
    .select("id, pos_name, sales_group_id")
    .eq("restaurant_id", restaurantId)
    .order("pos_name", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    posName: row.pos_name as string,
    salesGroupId: row.sales_group_id as string,
  }));
}

/**
 * Yhden päivän myyntirivit.
 *
 * Erillinen kysely eikä osa fetchDailySalesia: rivejä tarvitaan yhden
 * päivän täsmäytykseen, ja sadan päivän rivien hakeminen listanäkymään
 * olisi tuhat riviä jota kukaan ei katso.
 */
export async function fetchSalesLines(
  restaurantId: string,
  date: string,
): Promise<SalesLine[]> {
  const supabase = await createClient();

  const { data: day } = await supabase
    .from("daily_sales")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("sales_date", date)
    .maybeSingle();

  if (!day) return [];

  const { data, error } = await supabase
    .from("daily_sales_lines")
    .select(
      "sales_group_id, vat_rate, gross_cents, vat_cents, net_cents, pos_name, pos_vat_cents",
    )
    .eq("daily_sales_id", day.id as string);

  if (error || !data) return [];

  return data.map((row) => ({
    salesGroupId: row.sales_group_id as string,
    vatRate: Number(row.vat_rate),
    grossCents: row.gross_cents as number,
    vatCents: row.vat_cents as number,
    netCents: row.net_cents as number,
    posName: (row.pos_name as string | null) ?? null,
    posVatCents: (row.pos_vat_cents as number | null) ?? null,
  }));
}

/**
 * Kassan oma ALV-erittely yhdelle päivälle.
 *
 * Tyhjä lista tarkoittaa ettei raportissa ollut ALV-taulukkoa tai että
 * päivä on kirjattu käsin. Silloin vero johdetaan myyntiriveistä.
 */
export async function fetchPosVatRates(
  restaurantId: string,
  date: string,
): Promise<PosVatRate[]> {
  const supabase = await createClient();

  const { data: day } = await supabase
    .from("daily_sales")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("sales_date", date)
    .maybeSingle();

  if (!day) return [];

  const { data, error } = await supabase
    .from("daily_sales_vat")
    .select("vat_rate, gross_cents, vat_cents, net_cents")
    .eq("daily_sales_id", day.id as string);

  if (error || !data) return [];

  return data
    .map((row) => ({
      vatRate: Number(row.vat_rate),
      vatCents: row.vat_cents as number,
      // Vain vero on pakollinen: osa kassoista tulostaa kannoittain
      // vain sen.
      grossCents: (row.gross_cents as number | null) ?? null,
      netCents: (row.net_cents as number | null) ?? null,
    }))
    .sort((a, b) => b.vatRate - a.vatRate);
}

/**
 * Aikavälin myyntirivit päivittäin ryhmiteltynä.
 *
 * YKSI KYSELY, EI KAHTA PER PÄIVÄ.
 *
 * ALV-raportti haki ensin päivän tunnuksen ja sitten sen rivit —
 * kuukaudessa se on kuusikymmentäkaksi kyselyä, ja jokainen niistä
 * odottaa edellistä. Sisäliitos tekee saman yhdellä.
 */
export async function fetchSalesLinesBetween(
  restaurantId: string,
  from: string,
  to: string,
): Promise<Map<string, SalesLine[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("daily_sales_lines")
    .select(
      "sales_group_id, vat_rate, gross_cents, vat_cents, net_cents, pos_name, pos_vat_cents, daily_sales!inner(sales_date, restaurant_id)",
    )
    .eq("daily_sales.restaurant_id", restaurantId)
    .gte("daily_sales.sales_date", from)
    .lte("daily_sales.sales_date", to);

  const byDate = new Map<string, SalesLine[]>();
  if (error || !data) return byDate;

  for (const row of data) {
    // Sisäliitos palauttaa yhden rivin objektina, ei taulukkona.
    const day = row.daily_sales as unknown as { sales_date: string };
    const date = day.sales_date;

    const lines = byDate.get(date) ?? [];
    lines.push({
      salesGroupId: row.sales_group_id as string,
      vatRate: Number(row.vat_rate),
      grossCents: row.gross_cents as number,
      vatCents: row.vat_cents as number,
      netCents: row.net_cents as number,
      posName: (row.pos_name as string | null) ?? null,
      posVatCents: (row.pos_vat_cents as number | null) ?? null,
    });
    byDate.set(date, lines);
  }

  return byDate;
}

// ---------------------------------------------------------------------------
// Tehtävät
// ---------------------------------------------------------------------------

/**
 * Ravintolan tehtävät.
 *
 * Rivikäytäntö rajaa näkyvyyden: työntekijä saa omat ja koko
 * henkilöstölle merkityt, esihenkilö kaikki. Suodatus ei ole täällä,
 * koska sen voi ohittaa — kanta ratkaisee.
 */
export async function fetchTasks(restaurantId: string): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, restaurant_id, title, description, due_on, due_time, priority, visibility, assigned_to, completed_at, completed_by, cancelled_at, cancelled_by, recurrence, parent_task_id, remind_days_before, remind_on_due, remind_when_overdue, created_by, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("due_on");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    dueOn: row.due_on as string,
    // time palautuu muodossa "15:00:00"; näytöllä ja vertailussa riittää tunti ja minuutti.
    dueTime: row.due_time ? String(row.due_time).slice(0, 5) : null,
    priority: row.priority as Task["priority"],
    visibility: row.visibility as Task["visibility"],
    assignedTo: (row.assigned_to as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    completedBy: (row.completed_by as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancelledBy: (row.cancelled_by as string | null) ?? null,
    recurrence: row.recurrence as Task["recurrence"],
    parentTaskId: (row.parent_task_id as string | null) ?? null,
    remindDaysBefore: ((row.remind_days_before as number[] | null) ?? []).map(
      Number,
    ),
    remindOnDue: Boolean(row.remind_on_due),
    remindWhenOverdue: Boolean(row.remind_when_overdue),
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }));
}

export async function fetchTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("restaurant_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const all = await fetchTasks(data.restaurant_id as string);
  return all.find((task) => task.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Toimintaloki
// ---------------------------------------------------------------------------

/**
 * Lokitapahtumat sivuittain.
 *
 * Loki kasvaa nopeasti, joten koko historiaa ei ladata kerralla.
 * Suodatus ja haku tehdään kannassa: selaimessa suodattaminen vaatisi
 * kaiken lataamista ensin, mikä on juuri se mitä yritetään välttää.
 */
export async function fetchAuditLog(
  restaurantId: string,
  options: {
    entityType?: string;
    action?: string;
    actorId?: string;
    search?: string;
    since?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ events: AuditEvent[]; hasMore: boolean }> {
  const supabase = await createClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let query = supabase
    .from("audit_log")
    .select(
      "id, actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_name, summary, before_data, after_data, critical, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    // Yksi yli sivun: kertoo onko seuraavaa sivua ilman erillistä laskentaa.
    .range(offset, offset + limit);

  if (options.entityType) query = query.eq("entity_type", options.entityType);
  if (options.action) query = query.eq("action", options.action);
  if (options.actorId) query = query.eq("actor_id", options.actorId);
  if (options.since) query = query.gte("created_at", options.since);

  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ").trim();
    if (term !== "") {
      query = query.or(
        `summary.ilike.%${term}%,actor_name.ilike.%${term}%,entity_name.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error || !data) return { events: [], hasMore: false };

  const rows = data.slice(0, limit);

  return {
    hasMore: data.length > limit,
    events: rows.map((row) => ({
      id: row.id as string,
      actorId: (row.actor_id as string | null) ?? null,
      actorName: row.actor_name as string,
      actorRole: (row.actor_role as string | null) ?? null,
      action: row.action as string,
      entityType: row.entity_type as string,
      entityId: (row.entity_id as string | null) ?? null,
      entityName: (row.entity_name as string | null) ?? null,
      summary: row.summary as string,
      beforeData: (row.before_data as Record<string, unknown> | null) ?? null,
      afterData: (row.after_data as Record<string, unknown> | null) ?? null,
      critical: Boolean(row.critical),
      createdAt: row.created_at as string,
    })),
  };
}
