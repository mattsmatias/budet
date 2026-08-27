/**
 * Kirjanpidon kyselyt.
 *
 * OMA TIEDOSTONSA, EI JAETTUA PAKETTIA.
 *
 * fetchRestaurantData hakee kuusitoista taulua joka sivunlatauksella,
 * koska lähes jokainen hallintasivu tarvitsee niistä jotain.
 * Kirjanpito ei ole niistä yksikään: sen luvut kiinnostavat vain
 * kirjanpitosivua. Paketissa ne hidastaisivat kahtatoista muuta sivua
 * ilman että kukaan katsoisi tulosta.
 *
 * KAIKKI LASKENTA ON KANNASSA.
 *
 * Nämä funktiot kutsuvat tallennettuja funktioita ja kääntävät
 * jsonb:n tyypeiksi. Yhtään summaa ei lasketa täällä — jos näkymä
 * laskisi omansa, raportti ja kirjanpito voisivat erota.
 */

import { createClient } from "@/utils/supabase/server";
import type {
  LedgerEntry,
  MonthState,
  VatSummary,
} from "./accounting";

/** Tilikartan rivi näkymälle. */
export interface LedgerAccount {
  id: string;
  number: string;
  name: string;
  type: "revenue" | "expense" | "asset" | "liability" | "equity";
  vatRate: number | null;
  active: boolean;
  isSystem: boolean;
}

export interface GeneralLedgerAccount extends Omit<LedgerAccount, "vatRate" | "active" | "isSystem"> {
  debitCents: number;
  creditCents: number;
  balanceCents: number;
  lineCount: number;
  lines: {
    entryId: string;
    entryNumber: number;
    date: string;
    description: string;
    sourceType: string;
    sourceId: string | null;
    debitCents: number;
    creditCents: number;
  }[];
}

export interface IncomeStatement {
  from: string;
  to: string;
  includesProposed: boolean;
  revenue: { number: string; name: string; amountCents: number }[];
  revenueTotalCents: number;
  expenses: { number: string; name: string; amountCents: number }[];
  expenseTotalCents: number;
  resultCents: number;
}

export interface BalanceSheet {
  asOf: string;
  includesProposed: boolean;
  assets: { number: string; name: string; amountCents: number }[];
  assetsTotalCents: number;
  liabilities: { number: string; name: string; amountCents: number }[];
  liabilitiesTotalCents: number;
  resultCents: number;
  balancesTotalCents: number;
  balanced: boolean;
}

/**
 * Kuukauden tila ja "mitä sinun pitää tehdä".
 *
 * Yksi kutsu antaa tositemäärät, puuttuvat lähteet, ALV-yhteenvedon ja
 * täsmäytyksen. Ne lasketaan samasta hetkestä, joten luvut eivät voi
 * olla keskenään eri mieltä niin kuin kuusi erillistä kyselyä voisi.
 */
export async function fetchMonthState(
  restaurantId: string,
  month: string,
): Promise<MonthState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ledger_month_status", {
    p_restaurant: restaurantId,
    p_month: `${month}-01`,
  });

  if (error || !data) return null;
  return data as MonthState;
}

export async function fetchJournal(
  restaurantId: string,
  month: string,
  includeProposed = true,
): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);

  const { data, error } = await supabase.rpc("ledger_journal", {
    p_restaurant: restaurantId,
    p_from: from,
    p_to: to,
    p_include_proposed: includeProposed,
  });

  if (error || !data) return [];

  return ((data as { entries?: unknown[] }).entries ?? []).map((row) => {
    const e = row as Record<string, unknown>;
    return {
      id: String(e.id),
      entryNumber: Number(e.entry_number),
      entryDate: String(e.entry_date),
      description: String(e.description),
      sourceType: e.source_type as LedgerEntry["sourceType"],
      sourceId: e.source_id ? String(e.source_id) : null,
      status: e.status as LedgerEntry["status"],
      correctsId: e.corrects_id ? String(e.corrects_id) : null,
      totalCents: Number(e.total_cents ?? 0),
      lines: ((e.lines ?? []) as Record<string, unknown>[]).map((l) => ({
        accountNumber: String(l.accountNumber),
        accountName: String(l.accountName),
        debitCents: Number(l.debitCents ?? 0),
        creditCents: Number(l.creditCents ?? 0),
        vatRate: l.vatRate === null || l.vatRate === undefined ? null : Number(l.vatRate),
        vatCents: l.vatCents === null || l.vatCents === undefined ? null : Number(l.vatCents),
        description: l.description ? String(l.description) : null,
      })),
    };
  });
}

export async function fetchGeneralLedger(
  restaurantId: string,
  month: string,
  includeProposed = true,
): Promise<GeneralLedgerAccount[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);

  const { data, error } = await supabase.rpc("ledger_general", {
    p_restaurant: restaurantId,
    p_from: from,
    p_to: to,
    p_include_proposed: includeProposed,
  });

  if (error || !data) return [];

  return ((data as { accounts?: unknown[] }).accounts ?? []).map((row) => {
    const a = row as Record<string, unknown>;
    return {
      id: String(a.id),
      number: String(a.number),
      name: String(a.name),
      type: a.type as GeneralLedgerAccount["type"],
      debitCents: Number(a.debit_cents ?? 0),
      creditCents: Number(a.credit_cents ?? 0),
      balanceCents: Number(a.balance_cents ?? 0),
      lineCount: Number(a.line_count ?? 0),
      lines: ((a.lines ?? []) as Record<string, unknown>[]).map((l) => ({
        entryId: String(l.entryId),
        entryNumber: Number(l.entryNumber),
        date: String(l.date),
        description: String(l.description),
        sourceType: String(l.sourceType),
        sourceId: l.sourceId ? String(l.sourceId) : null,
        debitCents: Number(l.debitCents ?? 0),
        creditCents: Number(l.creditCents ?? 0),
      })),
    };
  });
}

export async function fetchAccounts(
  restaurantId: string,
): Promise<LedgerAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_accounts")
    .select("id, number, name, type, vat_rate, active, is_system")
    .eq("restaurant_id", restaurantId)
    .order("number");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    number: row.number as string,
    name: row.name as string,
    type: row.type as LedgerAccount["type"],
    vatRate: row.vat_rate === null ? null : Number(row.vat_rate),
    active: Boolean(row.active),
    isSystem: Boolean(row.is_system),
  }));
}

export async function fetchVatSummary(
  restaurantId: string,
  month: string,
): Promise<VatSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ledger_vat_summary", {
    p_restaurant: restaurantId,
    p_month: `${month}-01`,
  });

  if (error || !data) return null;
  return data as VatSummary;
}

export async function fetchIncomeStatement(
  restaurantId: string,
  month: string,
  includeProposed = false,
): Promise<IncomeStatement | null> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);

  const { data, error } = await supabase.rpc("ledger_income_statement", {
    p_restaurant: restaurantId,
    p_from: from,
    p_to: to,
    p_include_proposed: includeProposed,
  });

  if (error || !data) return null;
  return data as IncomeStatement;
}

export async function fetchBalanceSheet(
  restaurantId: string,
  month: string,
  includeProposed = false,
): Promise<BalanceSheet | null> {
  const supabase = await createClient();
  const { to } = monthRange(month);

  const { data, error } = await supabase.rpc("ledger_balance_sheet", {
    p_restaurant: restaurantId,
    p_as_of: to,
    p_include_proposed: includeProposed,
  });

  if (error || !data) return null;
  return data as BalanceSheet;
}

// ---------------------------------------------------------------------------

/**
 * Kuukauden ensimmäinen ja viimeinen päivä.
 *
 * Viimeinen lasketaan seuraavan kuun nollannesta päivästä: helmikuun
 * pituutta ei tarvitse tietää eikä karkausvuotta muistaa.
 */
function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0));
  return {
    from: `${month}-01`,
    to: `${month}-${String(last.getUTCDate()).padStart(2, "0")}`,
  };
}

/**
 * Yhden lähdetapahtuman kirjanpitotila.
 *
 * Kuitin sivu kysyy "onko tämä kirjanpidossa". Vastaus on yksi rivi,
 * joten sitä ei haeta koko kuukauden päiväkirjan kautta.
 *
 * Palauttaa myös tositenumeron: "kirjattu" ilman numeroa ei auta
 * ketään joka etsii tositetta kirjanpidosta.
 */
export interface SourceLink {
  state: "unprocessed" | "proposed" | "posted" | "rejected";
  entryNumber: number | null;
  entryId: string | null;
  entryDate: string | null;
}

export async function fetchSourceLink(
  restaurantId: string,
  sourceType: "receipt" | "daily_sales",
  sourceId: string,
): Promise<SourceLink> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, entry_number, entry_date, status")
    .eq("restaurant_id", restaurantId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error || !data) {
    return { state: "unprocessed", entryNumber: null, entryId: null, entryDate: null };
  }

  return {
    state: data.status as SourceLink["state"],
    entryNumber: Number(data.entry_number),
    entryId: String(data.id),
    entryDate: String(data.entry_date),
  };
}

/**
 * Veroasioiden ohjeet.
 *
 * Voimassa olevat: alkanut ja ei päättynyt. Vanhentunut ohje jää
 * tauluun historiaksi muttei näy — väärä ohje on pahempi kuin
 * puuttuva.
 */
export interface TaxGuide {
  key: string;
  taxType: string;
  title: string;
  summary: string;
  steps: string[];
  source: string | null;
  sourceUrl: string | null;
}

export async function fetchTaxGuides(): Promise<TaxGuide[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("tax_guides")
    .select("key, tax_type, title, summary, steps, source, source_url, effective_until")
    .lte("effective_from", today)
    .order("sort_order");

  if (error || !data) return [];

  return data
    .filter((row) => !row.effective_until || String(row.effective_until) >= today)
    .map((row) => ({
      key: String(row.key),
      taxType: String(row.tax_type),
      title: String(row.title),
      summary: String(row.summary),
      steps: (row.steps ?? []) as string[],
      source: row.source ? String(row.source) : null,
      sourceUrl: row.source_url ? String(row.source_url) : null,
    }));
}
