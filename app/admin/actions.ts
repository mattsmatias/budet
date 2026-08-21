"use server";

/**
 * Managerin toiminnot.
 *
 * Oikeustarkistus tehdään tietokantafunktioissa, ei täällä. Nämä actionit
 * validoivat syötteen ja kääntävät virheen luettavaksi — pääsysääntö on
 * yhdessä paikassa, eikä se voi ajautua eri linjalle sovelluskoodin kanssa.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import type {
  ExpenseCategory,
  PaymentMethod,
  Role,
  StaffPosition,
} from "@/lib/restoflow/types";

export interface AdminState {
  error?: string;
  notice?: string;
  /** Kutsukoodi näytetään kerran — sitä ei voi hakea myöhemmin. */
  code?: string;
}

/** "14,50" tai "14.50" → 1450. Tyhjä → null. */
function parseEuros(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".").replace(/\s/g, "");
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// Kutsut
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  role: z.enum(["owner", "manager", "employee", "accountant"]),
  position: z.enum(["waiter", "kitchen", "manager", "cleaning"]).nullable(),
  label: z.string().trim().max(80).nullable(),
});

export async function createInvitation(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant } = await requireContext("/admin/tyontekijat");

  const rawPosition = String(formData.get("position") ?? "");
  const parsed = inviteSchema.safeParse({
    role: formData.get("role"),
    position: rawPosition === "" ? null : rawPosition,
    label: (formData.get("label") as string) || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_restaurant: restaurant.id,
    p_role: parsed.data.role,
    p_position: parsed.data.position,
    p_hourly_rate_cents: parseEuros(formData.get("hourlyRate")),
    p_label: parsed.data.label,
  });

  if (error) return { error: explain(error, "Kutsun luonti epäonnistui") };

  revalidatePath("/admin/tyontekijat");
  return { code: data as string, notice: "Kutsukoodi luotu." };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const id = String(formData.get("invitationId") ?? "");
  if (!id) return;

  await requireContext("/admin/tyontekijat");
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", id);

  revalidatePath("/admin/tyontekijat");
}

/** Lunastaa koodin. Kutsuja ei vielä kuulu ravintolaan, joten ei requireContext. */
export async function acceptInvitation(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (code.length < 4) return { error: "Syötä kutsukoodi." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_code: code });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("ei löytynyt")) return { error: "Koodia ei löytynyt." };
    if (message.includes("jo käytetty")) return { error: "Koodi on jo käytetty." };
    if (message.includes("vanhentunut")) return { error: "Koodi on vanhentunut." };
    return { error: explain(error, "Liittyminen epäonnistui") };
  }

  revalidatePath("/", "layout");
  return { notice: "Liityit ravintolaan." };
}

// ---------------------------------------------------------------------------
// Jäsenyydet
// ---------------------------------------------------------------------------

const membershipSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "manager", "employee", "accountant"]),
  position: z.enum(["waiter", "kitchen", "manager", "cleaning"]).nullable(),
  active: z.boolean(),
});

export async function updateMembership(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant } = await requireContext("/admin/tyontekijat");

  const rawPosition = String(formData.get("position") ?? "");
  const parsed = membershipSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    position: rawPosition === "" ? null : rawPosition,
    active: formData.get("active") !== "false",
  });

  if (!parsed.success) return { error: "Tarkista syötetyt tiedot." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_membership", {
    p_restaurant: restaurant.id,
    p_user: parsed.data.userId,
    p_role: parsed.data.role as Role,
    p_position: parsed.data.position as StaffPosition | null,
    p_hourly_rate_cents: parseEuros(formData.get("hourlyRate")),
    p_active: parsed.data.active,
  });

  if (error) {
    if (error.message?.includes("vähintään yksi omistaja")) {
      return {
        error:
          "Ravintolalla on oltava vähintään yksi omistaja. Nimitä joku toinen " +
          "omistajaksi ennen kuin muutat omaa rooliasi.",
      };
    }
    return { error: explain(error, "Tallennus epäonnistui") };
  }

  revalidatePath("/admin", "layout");
  return { notice: "Tiedot tallennettu." };
}

// ---------------------------------------------------------------------------
// Budjetit
// ---------------------------------------------------------------------------

export async function setBudget(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant } = await requireContext("/admin/budjetit");

  const category = String(formData.get("category") ?? "") as ExpenseCategory;
  if (!category) return { error: "Kategoria puuttuu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_budget", {
    p_restaurant: restaurant.id,
    p_category: category,
    p_amount_cents: parseEuros(formData.get("amount")) ?? 0,
  });

  if (error) return { error: explain(error, "Budjetin tallennus epäonnistui") };

  revalidatePath("/admin", "layout");
  return { notice: "Budjetti tallennettu." };
}

// ---------------------------------------------------------------------------
// Kuitin tarkistus
// ---------------------------------------------------------------------------

export async function reviewReceipt(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const receiptId = String(formData.get("receiptId") ?? "");
  if (!receiptId) return { error: "Kuittia ei löytynyt." };

  await requireContext("/admin/kuitit");
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const { error } = await supabase.rpc("review_receipt", {
    p_receipt: receiptId,
    p_approve: formData.get("action") !== "reject",
    p_supplier_name: (formData.get("supplier") as string) || null,
    p_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    p_total_cents: parseEuros(formData.get("total")),
    p_vat_cents: parseEuros(formData.get("vat")),
    p_category: (formData.get("category") as ExpenseCategory) || null,
    p_payment: (formData.get("payment") as PaymentMethod) || null,
    p_note: (formData.get("note") as string) || null,
  });

  if (error) return { error: explain(error, "Tarkistus epäonnistui") };

  revalidatePath("/admin", "layout");
  return {
    notice:
      formData.get("action") === "reject"
        ? "Kuitti jätettiin tarkistusjonoon."
        : "Kuitti hyväksytty.",
  };
}

export async function deleteReceipt(formData: FormData): Promise<void> {
  const id = String(formData.get("receiptId") ?? "");
  if (!id) return;

  await requireContext("/admin/kuitit");
  const supabase = await createClient();
  await supabase.rpc("delete_receipt", { p_receipt: id });

  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

const shiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarkista päivämäärä."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Tarkista alkuaika."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Tarkista loppuaika."),
  location: z.string().trim().max(80),
});

export async function saveShift(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant } = await requireContext("/admin/tyovuorot");

  const parsed = shiftSchema.safeParse({
    date: formData.get("date"),
    start: formData.get("start"),
    end: formData.get("end"),
    location: (formData.get("location") as string) ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.start === parsed.data.end) {
    return { error: "Alku- ja loppuaika ovat samat." };
  }

  const userId = String(formData.get("userId") ?? "");
  const shiftId = String(formData.get("shiftId") ?? "");
  const position = String(formData.get("position") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_shift", {
    p_restaurant: restaurant.id,
    p_shift: shiftId || null,
    p_user: userId || null,
    p_date: parsed.data.date,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
    p_location: parsed.data.location,
    p_position: position || null,
  });

  if (error) return { error: explain(error, "Vuoron tallennus epäonnistui") };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  return {
    notice: shiftId
      ? "Vuoro päivitetty."
      : userId
        ? "Vuoro luotu ja lähetetty hyväksyttäväksi."
        : "Avoin vuoro luotu.",
  };
}

export async function deleteShift(formData: FormData): Promise<void> {
  const id = String(formData.get("shiftId") ?? "");
  if (!id) return;

  await requireContext("/admin/tyovuorot");
  const supabase = await createClient();
  await supabase.rpc("delete_shift", { p_shift: id });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------------------

function explain(
  error: { code?: string; message?: string } | null,
  prefix: string,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return "Tietokannan rakenteet puuttuvat. Aja migraatiot 0004 ja 0005.";
  }
  if (code === "42501" || message.includes("row-level security")) {
    return "Sinulla ei ole oikeutta tähän toimintoon.";
  }
  if (message.includes("Vain omistaja")) {
    return "Vain omistaja voi tehdä tämän.";
  }
  if (message.includes("Vain esihenkilö")) {
    return "Vain esihenkilö voi tehdä tämän.";
  }
  if (message.includes("Mennyttä vuoroa")) {
    return "Mennyttä vuoroa ei voi poistaa.";
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}
