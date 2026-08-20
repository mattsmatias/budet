"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getActiveOrg, getSessionUser } from "@/lib/auth";
import { parseTripText } from "@/lib/trips/parse";
import { calculateTrip } from "@/lib/trips/rules";

export interface TripState {
  error?: string;
  notice?: string;
  /** Jäsennetty ehdotus, jonka käyttäjä vahvistaa ennen tallennusta. */
  draft?: {
    raw: string;
    date: string;
    origin: string;
    destination: string;
    purpose: string;
    kilometers: number;
    durationHours: number;
    mealsProvided: number;
    missing: string[];
    calculation: ReturnType<typeof calculateTrip>;
  };
}

/**
 * Jäsentää vapaan tekstin ehdotukseksi. EI tallenna mitään.
 *
 * Jäsennin on deterministinen eikä arvaa: se mitä se ei tunnistanut jää
 * käyttäjän täytettäväksi, ja laskelma näytetään ennen tallennusta (§74).
 */
export async function parseTrip(
  _prev: TripState,
  formData: FormData,
): Promise<TripState> {
  const raw = String(formData.get("text") ?? "").trim();
  if (raw.length < 5) {
    return { error: "Kuvaile matka lyhyesti, esimerkiksi reitti ja kilometrit." };
  }

  const date =
    String(formData.get("date") ?? "") || new Date().toISOString().slice(0, 10);

  const parsed = parseTripText(raw);
  const kilometers = parsed.kilometers ?? 0;
  const durationHours = parsed.durationHours ?? 0;

  const calculation = calculateTrip({
    date,
    kilometers,
    durationHours: parsed.durationHours,
    mealsProvided: parsed.mealsProvided,
  });

  return {
    draft: {
      raw,
      date,
      origin: parsed.origin ?? "",
      destination: parsed.destination ?? "",
      purpose: parsed.purpose ?? "",
      kilometers,
      durationHours,
      mealsProvided: parsed.mealsProvided ?? 0,
      missing: parsed.missing,
      calculation,
    },
  };
}

const saveSchema = z.object({
  raw: z.string().max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarkista päivämäärä."),
  origin: z.string().trim().max(120),
  destination: z.string().trim().max(120),
  purpose: z.string().trim().max(200),
  kilometers: z.coerce.number().min(0).max(10000),
  durationHours: z.coerce.number().min(0).max(240),
  mealsProvided: z.coerce.number().min(0).max(2),
});

/** Tallentaa vahvistetun matkan. Korvaus lasketaan uudelleen palvelimella. */
export async function saveTrip(
  _prev: TripState,
  formData: FormData,
): Promise<TripState> {
  const user = await getSessionUser();
  if (!user) return { error: "Kirjaudu sisään tallentaaksesi matkan." };

  const org = await getActiveOrg();
  if (!org) return { error: "Luo ensin organisaatio." };

  const parsed = saveSchema.safeParse({
    raw: formData.get("raw"),
    date: formData.get("date"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
    purpose: formData.get("purpose"),
    kilometers: formData.get("kilometers"),
    durationHours: formData.get("durationHours"),
    mealsProvided: formData.get("mealsProvided"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Selaimen laskelmaan ei luoteta: korvaus lasketaan uudelleen samasta
  // sääntöjoukosta ennen tallennusta.
  const calc = calculateTrip({
    date: parsed.data.date,
    kilometers: parsed.data.kilometers,
    durationHours: parsed.data.durationHours,
    mealsProvided: parsed.data.mealsProvided,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      org_id: org.id,
      user_id: user.id,
      trip_date: parsed.data.date,
      origin: parsed.data.origin || null,
      destination: parsed.data.destination || null,
      purpose: parsed.data.purpose || null,
      kilometers: parsed.data.kilometers,
      mileage_rule_id: calc.mileageRuleId ?? null,
      mileage_rule_version: calc.mileageRuleVersion ?? null,
      mileage_rate_cents: calc.mileageRateCents,
      per_diem_rule_id: calc.perDiemRuleId ?? null,
      per_diem_rule_version: calc.perDiemRuleVersion ?? null,
      per_diem_cents: calc.perDiemCents,
      meal_deduction_cents: calc.mealDeductionCents,
      total_reimbursement_cents: calc.totalCents,
      raw_input: parsed.data.raw,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message?.includes("schema cache")) {
      return { error: "Tietokannan rakenteet puuttuvat. Aja migraatiot ensin." };
    }
    return { error: "Matkan tallennus ei onnistunut." };
  }

  await supabase.rpc("log_audit_event", {
    p_org_id: org.id,
    p_action: "trip.created",
    p_entity_type: "trip",
    p_entity_id: data.id,
    p_metadata: {
      kilometers: parsed.data.kilometers,
      total_cents: calc.totalCents,
      mileage_rule: `${calc.mileageRuleId}@${calc.mileageRuleVersion}`,
    },
  });

  revalidatePath("/trips");

  return { notice: "Matka tallennettu." };
}
