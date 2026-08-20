/**
 * Dokumentin käsittelyputki (§46).
 *
 *   lataus → tiiviste → duplikaattitarkistus → tallennus → poiminta
 *   → normalisointi → luokittelu → päätökset → audit
 *
 * Ajetaan tällä hetkellä synkronisesti server actionin sisällä. Rakenne on
 * tarkoituksella vaiheistettu ja idempotenssiavaimella varustettu, jotta
 * siirto processing_jobs-jonoon ei vaadi logiikan uudelleenkirjoitusta.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOcrProvider } from "@/lib/services/ocr";
import type { ExtractionResult } from "@/lib/services/ocr/types";
import { classifyDocument } from "@/lib/tax/document";
import { ENGINE_VERSION } from "@/lib/tax/engine";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 20_971_520);

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export type IngestResult =
  | { ok: true; documentId: string; lineCount: number; treatmentCount: number }
  | { ok: false; code: IngestErrorCode; message: string; documentId?: string };

export type IngestErrorCode =
  | "too_large"
  | "unsupported_type"
  | "duplicate"
  | "storage_failed"
  | "schema_missing"
  | "processing_failed";

interface IngestInput {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  file: File;
}

export async function ingestDocument({
  supabase,
  orgId,
  userId,
  file,
}: IngestInput): Promise<IngestResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: `Tiedosto on liian suuri. Enimmäiskoko on ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mt.`,
    };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "Tiedostomuotoa ei tueta. Käytä PDF-, JPG-, PNG- tai HEIC-tiedostoa.",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // 1. Duplikaattitarkistus tiivisteellä ennen kuin mitään tallennetaan (§8).
  const { data: existing, error: dupError } = await supabase
    .from("document_files")
    .select("document_id")
    .eq("org_id", orgId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (dupError && isSchemaMissing(dupError)) {
    return { ok: false, code: "schema_missing", message: SCHEMA_MISSING };
  }
  if (existing) {
    return {
      ok: false,
      code: "duplicate",
      message: "Tämä tiedosto on jo lähetetty aiemmin.",
      documentId: existing.document_id as string,
    };
  }

  // 2. Dokumenttirivi ensin, jotta tallennuspolku voidaan sitoa siihen.
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      org_id: orgId,
      status: "processing",
      source: "upload",
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (docError || !doc) {
    return isSchemaMissing(docError)
      ? { ok: false, code: "schema_missing", message: SCHEMA_MISSING }
      : { ok: false, code: "processing_failed", message: "Dokumentin luonti epäonnistui." };
  }

  const documentId = doc.id as string;
  // Polku alkaa organisaation tunnisteella — tallennuksen RLS nojaa tähän.
  const storagePath = `${orgId}/${documentId}/${sanitise(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    await supabase
      .from("documents")
      .update({ status: "error", processing_error: "Tallennus epäonnistui." })
      .eq("id", documentId);
    return {
      ok: false,
      code: "storage_failed",
      message: "Tiedoston tallennus epäonnistui. Tarkista että documents-bucket on luotu.",
      documentId,
    };
  }

  await supabase.from("document_files").insert({
    document_id: documentId,
    org_id: orgId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    byte_size: file.size,
    sha256,
  });

  await logAudit(supabase, orgId, "document.uploaded", documentId, {
    file_name: file.name,
    byte_size: file.size,
  });

  // 3. Poiminta.
  let extraction: ExtractionResult;
  try {
    extraction = await getOcrProvider().extract({
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });
  } catch {
    await supabase
      .from("documents")
      .update({ status: "error", processing_error: "Poiminta epäonnistui." })
      .eq("id", documentId);
    return {
      ok: false,
      code: "processing_failed",
      message: "Dokumentin luku epäonnistui. Dokumentti jäi virhetilaan.",
      documentId,
    };
  }

  await logAudit(supabase, orgId, "ocr.completed", documentId, {
    provider: extraction.provider,
    confidence: extraction.overallConfidence,
  });

  // 4. Luokittelu sääntömoottorilla.
  const supplierCountry = extraction.supplierCountry.value ?? "FI";
  const crossBorder = supplierCountry !== "FI";

  const classification = classifyDocument({
    jurisdiction: "FI",
    transactionDate:
      extraction.documentDate.value ?? new Date().toISOString().slice(0, 10),
    supplierCountry,
    buyerCountry: crossBorder ? "FI" : undefined,
    buyerType: crossBorder ? "business" : undefined,
    supplyType: "goods",
    currency: extraction.currency.value ?? "EUR",
    lines: extraction.lineItems.map((l) => ({
      lineNumber: l.lineNumber,
      description: l.description.value ?? undefined,
      category: l.suggestedCategory.value ?? undefined,
      netAmountCents: l.netAmountCents.value ?? undefined,
      extractionConfidence: Math.min(
        l.netAmountCents.confidence,
        l.suggestedCategory.confidence,
      ),
    })),
  });

  // 5. Rivit.
  const lineRows = extraction.lineItems.map((l) => {
    const decision = classification.lines.find(
      (c) => c.lineNumber === l.lineNumber,
    )?.decision;
    return {
      document_id: documentId,
      org_id: orgId,
      line_number: l.lineNumber,
      description: l.description.value,
      category: l.suggestedCategory.value,
      quantity: l.quantity.value,
      unit_price_cents: l.unitPriceCents.value,
      net_amount_cents: l.netAmountCents.value ?? 0,
      vat_rate: decision?.vatRate ?? null,
      vat_amount_cents: decision?.vatAmountCents ?? 0,
      gross_amount_cents:
        (l.netAmountCents.value ?? 0) + (decision?.vatAmountCents ?? 0),
      confidence: l.netAmountCents.confidence,
    };
  });

  const { data: insertedLines } = await supabase
    .from("document_line_items")
    .insert(lineRows)
    .select("id, line_number");

  // 6. Verotuspäätökset — yksi per rivi, muuttumattomina.
  const lineIdByNumber = new Map(
    (insertedLines ?? []).map((r) => [r.line_number as number, r.id as string]),
  );

  const decisionRows = classification.lines.map((line) => ({
    org_id: orgId,
    document_id: documentId,
    line_item_id: lineIdByNumber.get(line.lineNumber) ?? null,
    rule_id: line.decision.ruleId ?? null,
    rule_version: line.decision.ruleVersion ?? null,
    engine_version: ENGINE_VERSION,
    jurisdiction: line.decision.jurisdiction ?? "FI",
    effective_from: line.decision.effectiveFrom ?? null,
    outcome: line.decision.outcome,
    vat_code: line.decision.vatCode ?? null,
    vat_rate: line.decision.vatRate ?? null,
    vat_amount_cents: line.decision.vatAmountCents ?? null,
    deductible: line.decision.deductible ?? null,
    reverse_charge: line.decision.reverseCharge,
    input_facts: line.decision.inputFacts,
    reason: line.decision.reason,
    source_reference: line.decision.sourceReference ?? null,
    confidence: line.decision.confidence,
    confidence_score: line.decision.confidenceScore,
    created_by: userId,
  }));

  if (decisionRows.length > 0) {
    await supabase.from("tax_decisions").insert(decisionRows);
  }

  // 7. Dokumentin yhteenveto ja lopputila.
  const netTotal = extraction.netAmountCents.value ?? classification.totalNetCents;
  const status = classification.needsReview ? "needs_review" : "processed";

  await supabase
    .from("documents")
    .update({
      status,
      kind: mapKind(extraction.documentKind.value),
      supplier_name: extraction.supplierName.value,
      supplier_vat_id: extraction.supplierVatId.value,
      supplier_country: supplierCountry,
      supplier_address: extraction.supplierAddress.value,
      document_number: extraction.documentNumber.value,
      document_date: extraction.documentDate.value,
      due_date: extraction.dueDate.value,
      currency: extraction.currency.value ?? "EUR",
      net_amount_cents: netTotal,
      vat_amount_cents: classification.totalVatCents,
      gross_amount_cents: netTotal + classification.totalVatCents,
      payment_method: extraction.paymentMethod.value,
      confidence: bandFor(extraction.overallConfidence),
      confidence_score: extraction.overallConfidence,
      needs_review: classification.needsReview,
      review_reasons: classification.reviewReasons,
      processed_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (classification.needsReview) {
    await supabase.from("reviews").insert({
      org_id: orgId,
      document_id: documentId,
      state: "open",
      reasons: classification.reviewReasons,
    });
  }

  await logAudit(supabase, orgId, "rules.applied", documentId, {
    treatment_count: classification.treatmentCount,
    needs_review: classification.needsReview,
    engine_version: ENGINE_VERSION,
  });

  // Käyttö kirjataan vasta onnistuneen käsittelyn jälkeen.
  await supabase.rpc("record_usage", {
    p_org_id: orgId,
    p_metric: "documents",
    p_entity_type: "document",
    p_entity_id: documentId,
  });

  return {
    ok: true,
    documentId,
    lineCount: classification.lines.length,
    treatmentCount: classification.treatmentCount,
  };
}

// ---------------------------------------------------------------------------

const SCHEMA_MISSING =
  "Tietokannan rakenteet puuttuvat. Aja migraatiot supabase/migrations-hakemistosta.";

function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("schema cache"))
  );
}

async function logAudit(
  supabase: SupabaseClient,
  orgId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  // Audit-kirjaus ei saa kaataa käsittelyä, mutta epäonnistuminen on
  // merkittävä asia — se näkyy palvelinlokissa.
  const { error } = await supabase.rpc("log_audit_event", {
    p_org_id: orgId,
    p_action: action,
    p_entity_type: "document",
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  if (error) {
    console.error(`[verra] audit-kirjaus epäonnistui: ${action}`, error.message);
  }
}

function sanitise(fileName: string): string {
  return fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
}

function mapKind(value: string | null): string {
  const allowed = ["receipt", "invoice", "credit_note", "daily_report", "travel_expense"];
  return value && allowed.includes(value) ? value : "unknown";
}

function bandFor(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}
