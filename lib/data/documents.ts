/**
 * Datakerros dokumenteille.
 *
 * Sivut eivät kirjoita SQL:ää eivätkä tunne Supabasen asiakasta. Tämä
 * kerros palauttaa saman muodon riippumatta siitä tuleeko data kannasta vai
 * demo-aineistosta, jotta käyttöliittymän ei tarvitse haarautua.
 *
 * Puuttuva skeema ei ole poikkeus vaan tila: se palautetaan kutsujalle
 * ilmoituksena, ei kaatumisena.
 */

import { createClient } from "@/utils/supabase/server";
import { classifyDocument, type DocumentClassification } from "@/lib/tax/document";
import { DEMO_DOCUMENTS, getDemoDocument, type DemoDocument } from "@/lib/demo/data";

export type DocumentView = DemoDocument;

export type DataResult<T> =
  | { ok: true; data: T; source: "live" | "demo" }
  | { ok: false; problem: "schema_missing" | "unavailable"; message: string };

const SCHEMA_MISSING =
  "Tietokannan rakenteet puuttuvat. Aja migraatiot supabase/migrations-hakemistosta.";

function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  // PostgREST: 42P01 = undefined_table, PGRST205 = tuntematon taulu skeemavälimuistissa
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("schema cache"))
  );
}

/** Dokumenttilista organisaatiolle. */
export async function listDocuments(orgId: string): Promise<DataResult<DocumentView[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("documents")
      .select(
        `id, supplier_name, supplier_vat_id, supplier_country, document_number,
         document_date, kind, status, currency, is_demo, assigned_to,
         document_line_items ( line_number, description, category, net_amount_cents )`,
      )
      .eq("org_id", orgId)
      .order("document_date", { ascending: false })
      .limit(100);

    if (error) {
      return isMissingSchema(error)
        ? { ok: false, problem: "schema_missing", message: SCHEMA_MISSING }
        : {
            ok: false,
            problem: "unavailable",
            message: "Dokumenttien haku ei onnistunut juuri nyt. Yritä hetken kuluttua.",
          };
    }

    return { ok: true, data: (data ?? []).map(toView), source: "live" };
  } catch {
    return {
      ok: false,
      problem: "unavailable",
      message: "Yhteys tietokantaan ei vastaa.",
    };
  }
}

export async function fetchDocument(
  orgId: string,
  documentId: string,
): Promise<DataResult<DocumentView | null>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("documents")
      .select(
        `id, supplier_name, supplier_vat_id, supplier_country, document_number,
         document_date, kind, status, currency, is_demo, assigned_to,
         document_line_items ( line_number, description, category, net_amount_cents )`,
      )
      .eq("org_id", orgId)
      .eq("id", documentId)
      .maybeSingle();

    if (error) {
      return isMissingSchema(error)
        ? { ok: false, problem: "schema_missing", message: SCHEMA_MISSING }
        : { ok: false, problem: "unavailable", message: "Dokumentin haku epäonnistui." };
    }

    return { ok: true, data: data ? toView(data) : null, source: "live" };
  } catch {
    return { ok: false, problem: "unavailable", message: "Yhteys ei vastaa." };
  }
}

/** Demo-aineisto kirjautumattomalle käyttäjälle. */
export function demoDocuments(): DataResult<DocumentView[]> {
  return { ok: true, data: DEMO_DOCUMENTS, source: "demo" };
}

export function demoDocument(id: string): DataResult<DocumentView | null> {
  return { ok: true, data: getDemoDocument(id) ?? null, source: "demo" };
}

// ---------------------------------------------------------------------------

interface DbLine {
  line_number: number;
  description: string | null;
  category: string | null;
  net_amount_cents: number | null;
}

interface DbDocument {
  id: string;
  supplier_name: string | null;
  supplier_vat_id: string | null;
  supplier_country: string | null;
  document_number: string | null;
  document_date: string | null;
  kind: string;
  status: string;
  currency: string;
  is_demo: boolean;
  assigned_to: string | null;
  document_line_items: DbLine[] | null;
}

/**
 * Muuntaa kantarivin näkymäksi ja ajaa luokittelun sääntömoottorilla.
 *
 * Luokittelu ajetaan tässä lukuhetkellä, jotta näkymä on aina ajan tasalla
 * nykyisten sääntöjen kanssa. Hyväksytyn dokumentin lukittu päätös luetaan
 * tax_decisions-taulusta erikseen — sitä ei koskaan korvata tällä (§14).
 */
function toView(row: DbDocument): DocumentView {
  const lines = (row.document_line_items ?? [])
    .slice()
    .sort((a, b) => a.line_number - b.line_number);

  const country = row.supplier_country ?? "FI";
  const crossBorder = country !== "FI";

  const classification: DocumentClassification = classifyDocument({
    jurisdiction: "FI",
    transactionDate: row.document_date ?? new Date().toISOString().slice(0, 10),
    supplierCountry: country,
    buyerCountry: crossBorder ? "FI" : undefined,
    buyerType: crossBorder ? "business" : undefined,
    supplyType: "goods",
    currency: row.currency,
    lines: lines.map((l) => ({
      lineNumber: l.line_number,
      description: l.description ?? undefined,
      category: l.category ?? undefined,
      netAmountCents: l.net_amount_cents ?? undefined,
    })),
  });

  return {
    id: row.id,
    supplier: row.supplier_name ?? "Tuntematon toimittaja",
    supplierVatId: row.supplier_vat_id ?? undefined,
    country,
    documentNumber: row.document_number ?? "—",
    date: row.document_date ?? "—",
    kind: (["receipt", "invoice", "daily_report"].includes(row.kind)
      ? row.kind
      : "receipt") as DocumentView["kind"],
    status: row.status as DocumentView["status"],
    currency: row.currency,
    crossBorder,
    classification,
  };
}
