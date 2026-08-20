"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getActiveOrg, getSessionUser } from "@/lib/auth";
import { ingestDocument } from "@/lib/pipeline/ingest";
import { buildEntitlements, checkLimit } from "@/lib/services/entitlements";

export interface UploadState {
  error?: string;
  notice?: string;
}

export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Kirjaudu sisään lähettääksesi dokumentteja." };
  }

  const org = await getActiveOrg();
  if (!org) {
    return { error: "Luo ensin organisaatio." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Valitse tiedosto." };
  }

  const supabase = await createClient();

  // Käyttöraja tarkistetaan palvelimella, ei selaimessa (§30).
  const limit = await checkUsageLimit(supabase, org.id, org.planId);
  if (limit && !limit.allowed) {
    return { error: limit.reason };
  }

  const result = await ingestDocument({
    supabase,
    orgId: org.id,
    userId: user.id,
    file,
  });

  if (!result.ok) {
    revalidatePath("/inbox");
    return { error: result.message };
  }

  revalidatePath("/inbox");
  revalidatePath("/dashboard");

  return {
    notice:
      `Käsitelty: ${result.lineCount} riviä, ` +
      `${result.treatmentCount} ALV-käsittelyä.`,
  };
}

async function checkUsageLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  planId: string | null,
) {
  if (!planId) return null;

  const [{ data: plan }, { data: rows }, { data: usage }] = await Promise.all([
    supabase.from("plans").select("id, name").eq("id", planId).maybeSingle(),
    supabase
      .from("plan_entitlements")
      .select("key, limit_value, bool_value")
      .eq("plan_id", planId),
    supabase
      .from("usage_records")
      .select("quantity")
      .eq("org_id", orgId)
      .eq("metric", "documents")
      .gte("period_start", new Date(new Date().setDate(1)).toISOString().slice(0, 10)),
  ]);

  if (!plan || !rows) return null;

  const entitlements = buildEntitlements(plan.id as string, plan.name as string, rows);
  const used = (usage ?? []).reduce((s, r) => s + (r.quantity as number), 0);
  const periodStart = new Date(new Date().setDate(1)).toISOString().slice(0, 10);

  const verdict = checkLimit(
    entitlements,
    { used: { documents: used }, periodStart, periodEnd: periodStart },
    "documents",
  );

  return verdict.allowed
    ? { allowed: true as const, reason: "" }
    : { allowed: false as const, reason: verdict.reason };
}
