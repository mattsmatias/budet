"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth";

export interface OnboardingState {
  error?: string;
}

const schema = z.object({
  name: z.string().trim().min(1, "Organisaation nimi puuttuu.").max(160),
  country: z.string().length(2),
  kind: z.enum(["company", "accounting_firm"]),
  businessId: z.string().trim().max(32).optional(),
  vatId: z.string().trim().max(32).optional(),
  accountingSoftware: z.string().trim().max(64).optional(),
  vatRegistered: z.boolean(),
});

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    country: formData.get("country"),
    kind: formData.get("kind"),
    businessId: formData.get("businessId") || undefined,
    vatId: formData.get("vatId") || undefined,
    accountingSoftware: formData.get("accountingSoftware") || undefined,
    vatRegistered: formData.get("vatRegistered") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // Organisaatio, jäsenyys ja tilaus syntyvät yhdessä tietokantafunktiossa,
  // jotta käyttäjä ei voi jäädä tilaan jossa organisaatio on olemassa mutta
  // hän ei ole sen jäsen.
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_country: parsed.data.country,
    p_kind: parsed.data.kind,
    p_role: parsed.data.kind === "accounting_firm" ? "firm_admin" : "company_admin",
    p_business_id: parsed.data.businessId ?? null,
    p_vat_id: parsed.data.vatId ?? null,
    p_accounting_software: parsed.data.accountingSoftware ?? null,
    p_vat_registered: parsed.data.vatRegistered,
  });

  if (error || !data) {
    if (error?.message?.includes("create_organization")) {
      return {
        error:
          "Tietokannan rakenteet puuttuvat. Aja migraatiot supabase/migrations-hakemistosta ennen kuin jatkat.",
      };
    }
    return { error: "Organisaation luonti ei onnistunut. Yritä uudelleen." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
