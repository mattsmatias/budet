"use server";

/**
 * Dokumentin päätöstoiminnot (§14, §23).
 *
 * Kaikki nämä ovat kirjanpidollisesti merkittäviä tekoja, joten jokainen
 * kirjataan audit trailiin ja jokainen tarkistaa oikeudet palvelimella.
 * Hyväksyttyä päätöstä ei koskaan kirjoiteta hiljaisesti yli.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getActiveOrg, getSessionUser } from "@/lib/auth";
import { classifyDocument } from "@/lib/tax/document";
import { ENGINE_VERSION } from "@/lib/tax/engine";

export interface ActionState {
  error?: string;
  notice?: string;
}

interface Ctx {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  userId: string;
}

async function context(): Promise<Ctx | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Kirjaudu sisään." };

  const org = await getActiveOrg();
  if (!org) return { error: "Valitse organisaatio." };

  // Työntekijä ei hyväksy omia kulujaan.
  if (org.role === "employee") {
    return { error: "Rooli ei salli tätä toimintoa." };
  }

  return { supabase: await createClient(), orgId: org.id, userId: user.id };
}

// ---------------------------------------------------------------------------

export async function approveDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };

  const documentId = String(formData.get("documentId") ?? "");
  const override = formData.get("override") === "on";
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select("id, status, needs_review, review_reasons")
    .eq("org_id", ctx.orgId)
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return { error: "Dokumenttia ei löytynyt." };
  if (doc.status === "approved") return { notice: "Dokumentti on jo hyväksytty." };
  if (doc.status === "exported") {
    return { error: "Viety dokumentti ei ole enää hyväksyttävissä." };
  }

  // Tarkistusta vaativan dokumentin voi hyväksyä vain nimenomaisella
  // perustellulla ohituksella. Perustelu tallennetaan audit trailiin.
  if (doc.needs_review && !override) {
    return {
      error:
        "Dokumentti odottaa tarkistusta. Käsittele syyt tai anna nimenomainen ohitus perusteluineen.",
    };
  }
  if (doc.needs_review && override && overrideReason.length < 5) {
    return { error: "Ohitus vaatii perustelun (vähintään 5 merkkiä)." };
  }

  const { error } = await ctx.supabase
    .from("documents")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: ctx.userId,
      needs_review: false,
    })
    .eq("id", documentId);

  if (error) return { error: "Hyväksyntä ei onnistunut." };

  await ctx.supabase
    .from("reviews")
    .update({
      state: "resolved",
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: override ? `Ohitettu: ${overrideReason}` : "Hyväksytty",
    })
    .eq("document_id", documentId)
    .eq("state", "open");

  await audit(ctx, "document.approved", documentId, {
    override,
    override_reason: override ? overrideReason : null,
    review_reasons: doc.review_reasons,
  });

  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/inbox");
  revalidatePath("/review");
  revalidatePath("/dashboard");

  return { notice: override ? "Hyväksytty ohituksella." : "Hyväksytty." };
}

export async function rejectDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };

  const documentId = String(formData.get("documentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (reason.length < 3) return { error: "Kerro lyhyesti miksi hylkäät." };

  const { error } = await ctx.supabase
    .from("documents")
    .update({ status: "rejected", needs_review: false })
    .eq("org_id", ctx.orgId)
    .eq("id", documentId);

  if (error) return { error: "Hylkäys ei onnistunut." };

  await ctx.supabase
    .from("reviews")
    .update({
      state: "rejected",
      resolved_by: ctx.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: reason,
    })
    .eq("document_id", documentId)
    .eq("state", "open");

  await audit(ctx, "document.rejected", documentId, { reason });

  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/inbox");
  revalidatePath("/review");

  return { notice: "Hylätty." };
}

/**
 * Ajaa verotuspäätöksen uudelleen nykyisillä säännöillä (§14).
 *
 * Historiallista päätöstä EI muuteta. Uusi päätös merkitään nykyiseksi ja
 * osoittaa supersedes_id:llä korvaamaansa, jolloin ero on nähtävissä ja
 * vanha päätös pysyy auditoitavana.
 */
export async function rerunDecision(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };

  const documentId = String(formData.get("documentId") ?? "");

  const { data: doc } = await ctx.supabase
    .from("documents")
    .select(
      `id, status, supplier_country, document_date, currency,
       document_line_items ( id, line_number, description, category, net_amount_cents )`,
    )
    .eq("org_id", ctx.orgId)
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return { error: "Dokumenttia ei löytynyt." };

  const lines = (doc.document_line_items ?? []).slice().sort(
    (a, b) => (a.line_number as number) - (b.line_number as number),
  );

  if (lines.length === 0) return { error: "Dokumentilla ei ole rivejä." };

  const country = (doc.supplier_country as string) ?? "FI";
  const crossBorder = country !== "FI";

  const classification = classifyDocument({
    jurisdiction: "FI",
    transactionDate:
      (doc.document_date as string) ?? new Date().toISOString().slice(0, 10),
    supplierCountry: country,
    buyerCountry: crossBorder ? "FI" : undefined,
    buyerType: crossBorder ? "business" : undefined,
    supplyType: "goods",
    currency: (doc.currency as string) ?? "EUR",
    lines: lines.map((l) => ({
      lineNumber: l.line_number as number,
      description: (l.description as string) ?? undefined,
      category: (l.category as string) ?? undefined,
      netAmountCents: (l.net_amount_cents as number) ?? undefined,
    })),
  });

  // Nykyiset päätökset talteen vertailua ja supersedes-viittausta varten.
  const { data: previous } = await ctx.supabase
    .from("tax_decisions")
    .select("id, line_item_id, vat_code, vat_rate, rule_id, rule_version")
    .eq("document_id", documentId)
    .eq("is_current", true);

  const previousByLine = new Map(
    (previous ?? []).map((p) => [p.line_item_id as string, p]),
  );
  const lineIdByNumber = new Map(
    lines.map((l) => [l.line_number as number, l.id as string]),
  );

  let changed = 0;
  const rows = classification.lines.map((line) => {
    const lineItemId = lineIdByNumber.get(line.lineNumber) ?? null;
    const prev = lineItemId ? previousByLine.get(lineItemId) : undefined;

    if (
      prev &&
      (prev.vat_code !== line.decision.vatCode ||
        Number(prev.vat_rate) !== line.decision.vatRate ||
        prev.rule_version !== line.decision.ruleVersion)
    ) {
      changed += 1;
    }

    return {
      org_id: ctx.orgId,
      document_id: documentId,
      line_item_id: lineItemId,
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
      supersedes_id: prev?.id ?? null,
      is_current: true,
      created_by: ctx.userId,
    };
  });

  // Vanhat merkitään ei-nykyisiksi. Rivejä ei poisteta eikä muuteta muuten.
  if (previous && previous.length > 0) {
    await ctx.supabase
      .from("tax_decisions")
      .update({ is_current: false })
      .eq("document_id", documentId)
      .eq("is_current", true);
  }

  const { error } = await ctx.supabase.from("tax_decisions").insert(rows);
  if (error) return { error: "Uudelleenajo ei onnistunut." };

  await audit(ctx, "decision.rerun", documentId, {
    engine_version: ENGINE_VERSION,
    changed_lines: changed,
    needs_review: classification.needsReview,
  });

  revalidatePath(`/documents/${documentId}`);

  return {
    notice:
      changed === 0
        ? "Uudelleenajo valmis. Päätös ei muuttunut."
        : `Uudelleenajo valmis. ${changed} rivin käsittely muuttui — vanha päätös säilyy historiassa.`,
  };
}

async function audit(
  ctx: Ctx,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await ctx.supabase.rpc("log_audit_event", {
    p_org_id: ctx.orgId,
    p_action: action,
    p_entity_type: "document",
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  if (error) {
    console.error(`[verra] audit-kirjaus epäonnistui: ${action}`, error.message);
  }
}
