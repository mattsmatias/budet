/**
 * Kyselyt audit trailiin, sääntöihin, raportteihin ja organisaatioon.
 *
 * Sama periaate kuin dokumenteilla: puuttuva skeema on tila jonka kutsuja
 * saa tietoonsa, ei poikkeus joka kaataa sivun.
 */

import { createClient } from "@/utils/supabase/server";
import { FI_RULES } from "@/lib/tax/rules/fi";
import { MILEAGE_RULES, PER_DIEM_RULES } from "@/lib/trips/rules";
import type { RuleVersion } from "@/lib/tax/types";
import type { DataResult, DocumentView } from "./documents";

const SCHEMA_MISSING =
  "Tietokannan rakenteet puuttuvat. Aja migraatiot supabase/migrations-hakemistosta.";

function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("schema cache"))
  );
}

function fail<T>(error: { code?: string; message?: string } | null): DataResult<T> {
  return isMissingSchema(error)
    ? { ok: false, problem: "schema_missing", message: SCHEMA_MISSING }
    : { ok: false, problem: "unavailable", message: "Tietoja ei voitu hakea juuri nyt." };
}

// ---------------------------------------------------------------------------
// Audit trail (§13)
// ---------------------------------------------------------------------------

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  source: string;
  metadata: Record<string, unknown>;
  actorName: string | null;
}

export async function listAuditEvents(
  orgId: string,
  options: { action?: string; entityId?: string; limit?: number } = {},
): Promise<DataResult<AuditEvent[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("audit_events")
      .select("id, action, entity_type, entity_id, created_at, source, metadata, user_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 200);

    if (options.action) query = query.eq("action", options.action);
    if (options.entityId) query = query.eq("entity_id", options.entityId);

    const { data, error } = await query;
    if (error) return fail(error);

    // Tekijöiden nimet erikseen: audit_events ei viittaa profiles-tauluun
    // vieraalla avaimella, koska tapahtuma säilyy vaikka käyttäjä poistuisi.
    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))];
    const names = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds as string[]);
      for (const p of profiles ?? []) {
        names.set(p.id as string, (p.full_name as string) ?? "");
      }
    }

    return {
      ok: true,
      source: "live",
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        action: r.action as string,
        entityType: r.entity_type as string,
        entityId: (r.entity_id as string | null) ?? null,
        createdAt: r.created_at as string,
        source: r.source as string,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        actorName: r.user_id ? (names.get(r.user_id as string) || null) : null,
      })),
    };
  } catch {
    return { ok: false, problem: "unavailable", message: "Yhteys ei vastaa." };
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organisaatio luotu",
  "document.uploaded": "Dokumentti vastaanotettu",
  "ocr.completed": "Poiminta valmis",
  "rules.applied": "Sääntömoottori ajettu",
  "document.approved": "Dokumentti hyväksytty",
  "document.rejected": "Dokumentti hylätty",
  "decision.rerun": "Päätös ajettu uudelleen",
  "export.created": "Vienti luotu",
  "trip.created": "Matka kirjattu",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

// ---------------------------------------------------------------------------
// Säännöt (§12)
// ---------------------------------------------------------------------------

export interface RuleRow {
  ruleId: string;
  name: string;
  category: string;
  jurisdiction: string;
  version: string;
  status: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  legalReference: string | null;
  notes: string | null;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
}

/**
 * Sääntöselain. Lukee kannasta jos mahdollista; muuten näyttää moottorin
 * omat säännöt, jotka ovat sama joukko. Kumpikaan ei ole "oikeampi" — kanta
 * on ajonaikainen totuus, koodi on se joka ajetaan.
 */
export async function listRules(): Promise<DataResult<RuleRow[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tax_rule_versions")
      .select(
        `rule_id, version, status, priority, effective_from, effective_to,
         legal_reference, notes, conditions, actions,
         tax_rules ( name, category, jurisdiction )`,
      )
      .order("priority");

    if (error || !data || data.length === 0) {
      return { ok: true, source: "demo", data: fromEngine() };
    }

    return {
      ok: true,
      source: "live",
      data: data.map((r) => {
        const parent = r.tax_rules as unknown as {
          name: string;
          category: string;
          jurisdiction: string;
        } | null;
        return {
          ruleId: r.rule_id as string,
          name: parent?.name ?? (r.rule_id as string),
          category: parent?.category ?? "vat",
          jurisdiction: parent?.jurisdiction ?? "FI",
          version: r.version as string,
          status: r.status as string,
          priority: r.priority as number,
          effectiveFrom: r.effective_from as string,
          effectiveTo: (r.effective_to as string | null) ?? null,
          legalReference: (r.legal_reference as string | null) ?? null,
          notes: (r.notes as string | null) ?? null,
          conditions: (r.conditions as Record<string, unknown>) ?? {},
          actions: (r.actions as Record<string, unknown>) ?? {},
        };
      }),
    };
  } catch {
    return { ok: true, source: "demo", data: fromEngine() };
  }
}

/** Moottorin säännöt samassa muodossa, jotta selain toimii ilman kantaa. */
function fromEngine(): RuleRow[] {
  const vat: RuleRow[] = FI_RULES.map((r: RuleVersion) => ({
    ruleId: r.ruleId,
    name: r.name,
    category: r.ruleId.startsWith("ded-") ? "deductibility" : "vat",
    jurisdiction: r.jurisdiction,
    version: r.version,
    status: r.status,
    priority: r.priority,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo ?? null,
    legalReference: r.legalReference ?? null,
    notes: r.notes ?? null,
    conditions: r.conditions as unknown as Record<string, unknown>,
    actions: r.actions as unknown as Record<string, unknown>,
  }));

  const mileage: RuleRow[] = MILEAGE_RULES.map((r) => ({
    ruleId: r.ruleId,
    name: "Kilometrikorvaus",
    category: "mileage",
    jurisdiction: r.jurisdiction,
    version: r.version,
    status: r.status,
    priority: 100,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    legalReference: null,
    notes: r.notes ?? null,
    conditions: { jurisdiction: r.jurisdiction },
    actions: { rateCents: r.rateCents },
  }));

  const perDiem: RuleRow[] = PER_DIEM_RULES.map((r) => ({
    ruleId: r.ruleId,
    name: "Päiväraha",
    category: "per_diem",
    jurisdiction: r.jurisdiction,
    version: r.version,
    status: r.status,
    priority: 100,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    legalReference: null,
    notes: r.notes ?? null,
    conditions: { jurisdiction: r.jurisdiction },
    actions: {
      partialCents: r.partialCents,
      fullCents: r.fullCents,
      mealDeductionShare: r.mealDeductionShare,
    },
  }));

  return [...vat, ...mileage, ...perDiem].sort(
    (a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId),
  );
}

// ---------------------------------------------------------------------------
// Raportit (§26)
// ---------------------------------------------------------------------------

export interface VatBucket {
  vatCode: string;
  vatRate: number | null;
  netCents: number;
  vatCents: number;
  lineCount: number;
  deductible: boolean | null;
  reverseCharge: boolean;
}

/**
 * ALV-yhteenveto ALV-koodeittain. Lasketaan riveiltä, ei dokumenttitasolta —
 * muuten monikantainen tosite kirjautuisi yhteen koodiin.
 */
export function vatSummary(docs: DocumentView[]): VatBucket[] {
  const buckets = new Map<string, VatBucket>();

  for (const doc of docs) {
    for (const line of doc.classification.lines) {
      const d = line.decision;
      const key = `${d.vatCode ?? "?"}|${d.vatRate ?? "?"}`;

      const existing = buckets.get(key) ?? {
        vatCode: d.vatCode ?? "Ratkaisematta",
        vatRate: d.vatRate ?? null,
        netCents: 0,
        vatCents: 0,
        lineCount: 0,
        deductible: d.deductible ?? null,
        reverseCharge: d.reverseCharge,
      };

      existing.netCents += d.inputFacts.netAmountCents ?? 0;
      existing.vatCents += d.vatAmountCents ?? 0;
      existing.lineCount += 1;
      buckets.set(key, existing);
    }
  }

  return [...buckets.values()].sort(
    (a, b) => (b.vatRate ?? -1) - (a.vatRate ?? -1) || a.vatCode.localeCompare(b.vatCode),
  );
}

export interface ReportTotals {
  documents: number;
  lines: number;
  netCents: number;
  vatCents: number;
  deductibleVatCents: number;
  nonDeductibleVatCents: number;
  unresolvedVatCents: number;
  crossBorderDocs: number;
  needsReviewDocs: number;
  missingSupplierVatId: number;
}

export function reportTotals(docs: DocumentView[]): ReportTotals {
  let lines = 0;
  let netCents = 0;
  let vatCents = 0;
  let deductibleVatCents = 0;
  let nonDeductibleVatCents = 0;
  let unresolvedVatCents = 0;

  for (const doc of docs) {
    for (const line of doc.classification.lines) {
      const d = line.decision;
      lines += 1;
      netCents += d.inputFacts.netAmountCents ?? 0;
      const vat = d.vatAmountCents ?? 0;
      vatCents += vat;

      if (d.deductible === true) deductibleVatCents += vat;
      else if (d.deductible === false) nonDeductibleVatCents += vat;
      else unresolvedVatCents += vat;
    }
  }

  return {
    documents: docs.length,
    lines,
    netCents,
    vatCents,
    deductibleVatCents,
    nonDeductibleVatCents,
    unresolvedVatCents,
    crossBorderDocs: docs.filter((d) => d.crossBorder).length,
    needsReviewDocs: docs.filter((d) => d.status === "needs_review").length,
    missingSupplierVatId: docs.filter((d) => !d.supplierVatId).length,
  };
}

// ---------------------------------------------------------------------------
// Organisaatio ja käyttö (§60)
// ---------------------------------------------------------------------------

export interface OrgMember {
  userId: string;
  name: string | null;
  role: string;
}

export interface UsageSummary {
  documentsUsed: number;
  documentsLimit: number | null;
  periodStart: string;
  planId: string | null;
  planName: string | null;
  trialEndsAt: string | null;
  subscriptionState: string | null;
}

export async function listMembers(orgId: string): Promise<DataResult<OrgMember[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("user_id, role, profiles ( full_name )")
      .eq("org_id", orgId);

    if (error) return fail(error);

    return {
      ok: true,
      source: "live",
      data: (data ?? []).map((r) => ({
        userId: r.user_id as string,
        name:
          (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        role: r.role as string,
      })),
    };
  } catch {
    return { ok: false, problem: "unavailable", message: "Yhteys ei vastaa." };
  }
}

export async function usageSummary(orgId: string): Promise<DataResult<UsageSummary>> {
  try {
    const supabase = await createClient();
    const periodStart = new Date(new Date().setDate(1)).toISOString().slice(0, 10);

    const [{ data: sub }, { data: usage }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_id, state, trial_ends_at, plans ( name )")
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("usage_records")
        .select("quantity")
        .eq("org_id", orgId)
        .eq("metric", "documents")
        .gte("period_start", periodStart),
    ]);

    const planId = (sub?.plan_id as string | null) ?? null;
    let limit: number | null = null;

    if (planId) {
      const { data: ent } = await supabase
        .from("plan_entitlements")
        .select("limit_value")
        .eq("plan_id", planId)
        .eq("key", "documents_per_month")
        .maybeSingle();
      limit = (ent?.limit_value as number | null) ?? null;
    }

    return {
      ok: true,
      source: "live",
      data: {
        documentsUsed: (usage ?? []).reduce((s, r) => s + (r.quantity as number), 0),
        documentsLimit: limit,
        periodStart,
        planId,
        planName:
          (sub?.plans as unknown as { name: string } | null)?.name ?? planId ?? null,
        trialEndsAt: (sub?.trial_ends_at as string | null) ?? null,
        subscriptionState: (sub?.state as string | null) ?? null,
      },
    };
  } catch {
    return { ok: false, problem: "unavailable", message: "Yhteys ei vastaa." };
  }
}

// ---------------------------------------------------------------------------
// Tilitoimiston asiakkaat (§21)
// ---------------------------------------------------------------------------

export interface ClientRow {
  id: string;
  name: string;
  country: string;
  pendingDocs: number;
  needsReview: number;
  lastActivity: string | null;
}

export async function listClients(firmOrgId: string): Promise<DataResult<ClientRow[]>> {
  try {
    const supabase = await createClient();

    const { data: relations, error } = await supabase
      .from("accounting_relationships")
      .select("client_org_id, organizations!accounting_relationships_client_org_id_fkey ( id, name, country )")
      .eq("firm_org_id", firmOrgId)
      .eq("active", true);

    if (error) return fail(error);
    if (!relations || relations.length === 0) {
      return { ok: true, source: "live", data: [] };
    }

    const clientIds = relations.map((r) => r.client_org_id as string);

    const { data: docs } = await supabase
      .from("documents")
      .select("org_id, status, updated_at")
      .in("org_id", clientIds);

    const byOrg = new Map<string, { pending: number; review: number; last: string | null }>();
    for (const d of docs ?? []) {
      const orgId = d.org_id as string;
      const entry = byOrg.get(orgId) ?? { pending: 0, review: 0, last: null };
      if (["received", "processing", "processed"].includes(d.status as string)) {
        entry.pending += 1;
      }
      if (d.status === "needs_review") entry.review += 1;
      const updated = d.updated_at as string;
      if (!entry.last || updated > entry.last) entry.last = updated;
      byOrg.set(orgId, entry);
    }

    return {
      ok: true,
      source: "live",
      data: relations.map((r) => {
        const org = r.organizations as unknown as {
          id: string;
          name: string;
          country: string;
        } | null;
        const stats = byOrg.get(r.client_org_id as string);
        return {
          id: (org?.id ?? r.client_org_id) as string,
          name: org?.name ?? "Tuntematon",
          country: org?.country ?? "—",
          pendingDocs: stats?.pending ?? 0,
          needsReview: stats?.review ?? 0,
          lastActivity: stats?.last ?? null,
        };
      }),
    };
  } catch {
    return { ok: false, problem: "unavailable", message: "Yhteys ei vastaa." };
  }
}
