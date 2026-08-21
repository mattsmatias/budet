"use server";

/**
 * Työntekijän toiminnot.
 *
 * Kaikki kirjoitus kulkee tästä. Selain ei kirjoita tietokantaan suoraan
 * edes silloin kun RLS sallisi sen — palvelin on ainoa paikka jossa
 * siirtymien kelvollisuus tarkistetaan ja jossa virheen voi kääntää
 * ihmisluettavaksi.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { reviewReasonsFor, type ExtractionResult } from "@/lib/restoflow/receipt-ai";
import type { ClockEventType, ExpenseCategory, PaymentMethod } from "@/lib/restoflow/types";

export interface ActionState {
  error?: string;
  notice?: string;
  /** Tallennetun kuitin tunniste — käyttöliittymä voi avata sen. */
  receiptId?: string;
}

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

const CLOCK_TYPES: ClockEventType[] = ["in", "break_start", "break_end", "out"];

/**
 * Leimaa työajan.
 *
 * Siirtymän kelvollisuus tarkistetaan tietokantafunktiossa, ei täällä:
 * kaksi auki olevaa välilehteä voisi muuten tuottaa kaksi sisäänleimausta
 * peräkkäin, ja työaika laskettaisiin väärin.
 */
export async function recordClockEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = String(formData.get("type") ?? "") as ClockEventType;
  if (!CLOCK_TYPES.includes(type)) {
    return { error: "Tuntematon leimaustyyppi." };
  }

  const { restaurant } = await requireContext("/app/tyoaika");
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_clock_event", {
    p_restaurant: restaurant.id,
    p_type: type,
  });

  if (error) {
    if (error.message?.includes("ei ole mahdollinen")) {
      return {
        error:
          "Leimaus ei käy nykyisessä tilassa. Lataa sivu uudelleen — " +
          "tilanne on saattanut muuttua toisessa välilehdessä.",
      };
    }
    return { error: explain(error, "Leimaus epäonnistui") };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: LABELS[type] };
}

const LABELS: Record<ClockEventType, string> = {
  in: "Sisäänleimaus kirjattu.",
  break_start: "Tauko alkoi.",
  break_end: "Takaisin töissä.",
  out: "Uloskirjaus kirjattu.",
};

// ---------------------------------------------------------------------------
// Kuitit
// ---------------------------------------------------------------------------

const receiptSchema = z.object({
  supplier: z.string().trim().min(1, "Toimittaja puuttuu.").max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarkista päivämäärä."),
  totalCents: z.number().int().min(0, "Loppusumma puuttuu."),
  vatCents: z.number().int().min(0).nullable(),
  category: z.string().min(1, "Valitse kategoria."),
  payment: z.string().min(1),
  receiptNumber: z.string().trim().max(64).nullable(),
  note: z.string().trim().max(500).nullable(),
});

/** "186,90" tai "186.90" → 18690. Tyhjä → null. */
function parseEuros(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".").replace(/\s/g, "");
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/**
 * Tallentaa kuitin riveineen.
 *
 * Rivit tulevat lomakkeelta JSON-merkkijonona: ne on jo vahvistettu
 * poimintanäkymässä, eikä niitä muokata enää tässä. Kuitti ja rivit
 * kirjoitetaan yhdessä tietokantafunktiossa — puolikas kuitti näyttäisi
 * kulunäkymässä oikealta mutta jakautuisi väärään kategoriaan.
 */
export async function saveReceipt(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { restaurant } = await requireContext("/app/kuitit");

  const parsed = receiptSchema.safeParse({
    supplier: formData.get("supplier"),
    date: formData.get("date"),
    totalCents: parseEuros(formData.get("total")) ?? -1,
    vatCents: parseEuros(formData.get("vat")),
    category: formData.get("category"),
    payment: formData.get("payment") || "unknown",
    receiptNumber: (formData.get("receiptNumber") as string) || null,
    note: (formData.get("note") as string) || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const items = parseItems(formData.get("items"));
  const reasons = deriveReviewReasons(parsed.data, items);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_receipt", {
    p_restaurant: restaurant.id,
    p_supplier_name: parsed.data.supplier,
    p_date: parsed.data.date,
    p_total_cents: parsed.data.totalCents,
    p_vat_cents: parsed.data.vatCents,
    p_category: parsed.data.category as ExpenseCategory,
    p_payment: parsed.data.payment as PaymentMethod,
    p_receipt_number: parsed.data.receiptNumber,
    p_note: parsed.data.note,
    p_status: reasons.length > 0 ? "needs_review" : "confirmed",
    p_review_reasons: reasons,
    p_image_path: (formData.get("imagePath") as string) || null,
    p_image_quality: (formData.get("imageQuality") as string) || null,
    p_file_hash: (formData.get("fileHash") as string) || null,
    p_items: items,
  });

  if (error) {
    if (error.code === "23505" || error.message?.includes("receipts_hash_unique")) {
      return {
        error:
          "Tämä sama tiedosto on jo tallennettu. Jos kyseessä on eri ostos, " +
          "kuvaa kuitti uudelleen.",
      };
    }
    return { error: explain(error, "Kuitin tallennus epäonnistui") };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: "Kuitti tallennettu.", receiptId: data as string };
}

interface ItemInput {
  description: string;
  quantity: number | null;
  unit: string | null;
  totalCents: number;
  category: ExpenseCategory;
  vatRate: number | null;
  vatCents: number | null;
  productGroup: string | null;
}

function parseItems(raw: FormDataEntryValue | null): ItemInput[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => typeof i?.totalCents === "number" && i.totalCents >= 0)
      .map((i) => ({
        description: String(i.description ?? ""),
        quantity: typeof i.quantity === "number" ? i.quantity : null,
        unit: i.unit ? String(i.unit) : null,
        totalCents: Math.round(i.totalCents),
        category: (i.category ?? "other") as ExpenseCategory,
        vatRate: typeof i.vatRate === "number" ? i.vatRate : null,
        vatCents: typeof i.vatCents === "number" ? Math.round(i.vatCents) : null,
        productGroup: i.productGroup ? String(i.productGroup) : null,
      }));
  } catch {
    // Vioittunut syöte ei saa kaataa tallennusta — kuitti menee läpi
    // rivittä ja päätyy tarkistusjonoon.
    return [];
  }
}

/**
 * Tarkistussyyt tallennushetkellä.
 *
 * Lasketaan uudelleen palvelimella eikä luoteta lomakkeen kenttään:
 * muuten kuitin voisi merkitä tarkistetuksi ohittamalla poimintanäkymän.
 */
function deriveReviewReasons(
  data: z.infer<typeof receiptSchema>,
  items: ItemInput[],
): string[] {
  const fake: ExtractionResult = {
    supplier: { value: data.supplier, confidence: "high" },
    date: { value: data.date, confidence: "high" },
    totalCents: { value: data.totalCents, confidence: "high" },
    vatCents: {
      value: data.vatCents,
      confidence: data.vatCents === null ? "low" : "high",
    },
    category: { value: data.category as ExpenseCategory, confidence: "high" },
    paymentMethod: {
      value: data.payment as PaymentMethod,
      confidence: data.payment === "unknown" ? "low" : "high",
    },
    receiptNumber: { value: data.receiptNumber, confidence: "high" },
    items: [],
    imageQuality: "good",
    elapsedMs: 0,
  };

  const reasons = reviewReasonsFor(fake);

  // Rivien on summauduttava loppusummaan, muuten kulujako on väärä.
  if (items.length > 0) {
    const sum = items.reduce((s, i) => s + i.totalCents, 0);
    if (Math.abs(sum - data.totalCents) > 2) reasons.push("items_dont_sum");
  }

  return [...new Set(reasons)];
}

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

/**
 * Hyväksyy tai kieltäytyy vuorosta.
 *
 * RLS sallii vain oman vuoron ja vain tilan vaihdon; liipaisin estää aikojen
 * muuttamisen. Tämä funktio ei siis voi tehdä enempää kuin mihin
 * työntekijällä on oikeus, vaikka sitä kutsuttaisiin väärillä arvoilla.
 */
export async function respondToShift(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const answer = String(formData.get("answer") ?? "");

  if (!shiftId) return { error: "Vuoroa ei löytynyt." };
  if (answer !== "accepted" && answer !== "declined") {
    return { error: "Tuntematon vastaus." };
  }

  await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: answer })
    .eq("id", shiftId);

  if (error) return { error: explain(error, "Vastauksen tallennus epäonnistui") };

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return {
    notice: answer === "accepted" ? "Vuoro hyväksytty." : "Ilmoitettu esihenkilölle.",
  };
}

// ---------------------------------------------------------------------------
// Poissaolot
// ---------------------------------------------------------------------------

const absenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarkista päivämäärä."),
  kind: z.enum(["sick", "other", "cannot_attend"]),
  note: z.string().trim().max(300).nullable(),
});

export async function reportAbsence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = absenceSchema.safeParse({
    date: formData.get("date"),
    kind: formData.get("kind"),
    note: (formData.get("note") as string) || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { restaurant, user } = await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase.from("absences").insert({
    restaurant_id: restaurant.id,
    user_id: user.id,
    absence_date: parsed.data.date,
    kind: parsed.data.kind,
    note: parsed.data.note,
  });

  if (error) return { error: explain(error, "Ilmoituksen tallennus epäonnistui") };

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: "Poissaolo ilmoitettu." };
}

// ---------------------------------------------------------------------------

/**
 * Kääntää tietokannan virheen toimintakelpoiseksi.
 *
 * Yleinen "yritä uudelleen" piilottaisi syyn, jolloin käyttäjä ei voi tehdä
 * mitään. Tuntematon virhe näytetään sellaisenaan.
 */
function explain(
  error: { code?: string; message?: string } | null,
  prefix: string,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return "Tietokannan rakenteet puuttuvat. Aja migraatiot ensin.";
  }
  if (code === "42501" || message.includes("row-level security")) {
    return "Sinulla ei ole oikeutta tähän toimintoon.";
  }
  if (message.includes("Kirjautuminen vaaditaan")) {
    return "Istunto on vanhentunut. Kirjaudu uudelleen sisään.";
  }
  if (message.includes("Vain vuoron tilan")) {
    return "Vuoron aikoja voi muuttaa vain esihenkilö.";
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}
