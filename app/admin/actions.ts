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
import { canAddReceipts } from "@/lib/restoflow/permissions";
import { reviewReasonsForSave } from "@/lib/restoflow/receipt-ai";
import {
  isAutoMatch,
  matchMerchant,
  parseBusinessId,
} from "@/lib/restoflow/merchants";
import { fetchMerchants } from "@/lib/restoflow/queries";
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
  /** Tallennetun kuitin tunniste — käyttöliittymä voi avata sen. */
  receiptId?: string;
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

/**
 * Tallentaa kuitin riveineen.
 *
 * Rivit tulevat lomakkeelta JSON-merkkijonona: ne on jo vahvistettu
 * poimintanäkymässä, eikä niitä muokata enää tässä. Kuitti ja rivit
 * kirjoitetaan yhdessä tietokantafunktiossa — puolikas kuitti näyttäisi
 * kulunäkymässä oikealta mutta jakautuisi väärään kategoriaan.
 */
export async function saveReceipt(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant, role } = await requireContext("/admin/kuitit");

  // Kuitti on ravintolan kirjanpitoaineistoa, ei työntekijän ilmoitus.
  // Tietokanta torjuu tämän joka tapauksessa; tässä virheestä saa luettavan.
  if (!canAddReceipts(role)) {
    return { error: "Vain ravintolan esihenkilö voi lisätä kuitteja." };
  }

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
  const reasons = reviewReasonsForSave({
    supplier: parsed.data.supplier,
    date: parsed.data.date,
    totalCents: parsed.data.totalCents,
    vatCents: parsed.data.vatCents,
    category: parsed.data.category as ExpenseCategory,
    payment: parsed.data.payment as PaymentMethod,
    receiptNumber: parsed.data.receiptNumber,
    items,
  });

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
    p_category_id: (formData.get("categoryId") as string) || null,
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

  // Kaupan tunnistus tehdään tallennuksen jälkeen omana askeleenaan.
  // Se ei saa kaataa kuittia: jos brändi jää tunnistamatta tai koko
  // luettelo on tavoittamattomissa, kuitti on silti kirjattu.
  await linkSupplierToMerchant(
    supabase,
    restaurant.id,
    parsed.data.supplier,
    (formData.get("businessId") as string) || null,
  );

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

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

/**
 * Liittää juuri tallennetun toimipisteen tunnettuun brändiin.
 *
 * Linkki on toimipisteessä eikä kuitissa. Näin yhden kaupan tunnistus
 * — tai sen korjaus — koskee kaikkia sen kuitteja kerralla, myös jo
 * tallennettuja.
 *
 * Vain riittävän varma osuma liitetään. Heikompi jää tekemättä eikä
 * sitä yritetä uudelleen joka kuitilla: väärä kauppa kirjanpidossa on
 * pahempi kuin tuntematon kauppa, koska väärää ei kukaan tarkista.
 *
 * Virheitä ei nosteta. Tämä on koriste ja hakutieto, ei osa kuittia.
 */
async function linkSupplierToMerchant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  supplierName: string,
  rawBusinessId: string | null,
): Promise<void> {
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, merchant_id, merchant_confirmed")
    .eq("restaurant_id", restaurantId)
    .eq("name", supplierName.trim())
    .maybeSingle();

  if (!supplier) return;

  // Ihmisen vahvistamaa ei kosketa. Tietokanta torjuu tämän joka
  // tapauksessa; tässä säästetään turha kysely.
  if (supplier.merchant_confirmed) return;

  const merchants = await fetchMerchants();
  if (merchants.length === 0) return;

  const match = matchMerchant(
    supplierName,
    parseBusinessId(rawBusinessId),
    merchants,
  );

  if (!isAutoMatch(match)) return;

  await supabase.rpc("set_supplier_merchant", {
    p_supplier: supplier.id,
    p_merchant: match!.merchantId,
    p_confidence: match!.confidence,
    p_confirmed: false,
  });
}

// ---------------------------------------------------------------------------
// Asetukset
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Nimi puuttuu.").max(120),
  timezone: z.string().trim().min(1, "Valitse aikavyöhyke."),
});

/**
 * Ravintolan nimi ja aikavyöhyke.
 *
 * Aikavyöhyke ei ole kosmeettinen: työaika, kuukausirajat ja vuorojen
 * päivät lasketaan siinä. Kanta tarkistaa vyöhykkeen olemassaolon, koska
 * kelvoton arvo ei kaataisi mitään heti vaan laskisi tunnit väärin.
 */
export async function updateSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_restaurant", {
    p_restaurant: restaurant.id,
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
  });

  if (error) return { error: explain(error, "Asetusten tallennus epäonnistui") };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  return { notice: "Asetukset tallennettu." };
}

// ---------------------------------------------------------------------------
// Kuukauden sulkeminen
// ---------------------------------------------------------------------------

/**
 * Sulkee kuukauden kirjanpitoon.
 *
 * Sulkemisen jälkeen kuukauden kuitteja ei voi lisätä, muuttaa eikä
 * poistaa — muuten kirjanpitäjälle annettu aineisto ja järjestelmän
 * sisältö eroaisivat toisistaan huomaamatta. Este on kannan
 * liipaisimessa, ei täällä.
 */
export async function closeMonth(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const month = String(formData.get("month") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
    return { error: "Valitse kuukausi." };
  }

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.rpc("close_month", {
    p_restaurant: restaurant.id,
    p_month: month,
    p_note: note || null,
  });

  if (error) return { error: explain(error, "Kuukauden sulkeminen epäonnistui") };

  revalidatePath("/admin", "layout");
  return { notice: `Kuukausi ${month} suljettu.` };
}

/** Avaa suljetun kuukauden uudelleen. Vain omistaja. */
export async function reopenMonth(formData: FormData): Promise<void> {
  const month = String(formData.get("month") ?? "");
  if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) return;

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();
  await supabase.rpc("reopen_month", {
    p_restaurant: restaurant.id,
    p_month: month,
  });

  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Poissaolot
// ---------------------------------------------------------------------------

/** Peruu poissaoloilmoituksen. RLS sallii oman tai esihenkilölle kenen tahansa. */
export async function cancelAbsence(formData: FormData): Promise<void> {
  const id = String(formData.get("absenceId") ?? "");
  if (!id) return;

  await requireContext("/admin/tyovuorot");
  const supabase = await createClient();
  await supabase.from("absences").delete().eq("id", id);

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

/**
 * Merkitsee sairauslomatodistuksen nähdyksi, tai poistaa merkinnän.
 *
 * Todistusta itseään ei tallenneta. Lääkärintodistus on terveystieto ja
 * siinä lukee usein diagnoosi; työnantajalle kuuluu tieto poissaolosta ja
 * sen kestosta, ei sen syystä. Budetiin jää merkintä siitä että todistus
 * on nähty ja mille ajalle poissaolo on ilmoitettu — se mitä
 * palkanmaksuun tarvitaan.
 */
export async function markAbsenceCertificate(formData: FormData): Promise<void> {
  const id = String(formData.get("absenceId") ?? "");
  if (!id) return;

  // Merkinnän voi myös purkaa: väärään ilmoitukseen osunut kuittaus
  // jäisi muuten pysyväksi väitteeksi.
  const seen = formData.get("seen") === "true";

  await requireContext("/admin/tyovuorot");
  const supabase = await createClient();
  await supabase.rpc("mark_absence_certificate", {
    p_absence: id,
    p_seen: seen,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

// ---------------------------------------------------------------------------
// Omat kulukategoriat
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Nimi puuttuu.").max(60),
  base: z.enum([
    "food", "alcohol", "soft_drinks", "cleaning", "kitchen_supplies",
    "packaging", "staff", "transport", "other",
  ]),
  active: z.boolean(),
});

/**
 * Luo tai muokkaa ravintolan omaa kategoriaa.
 *
 * Perusluokka on pakollinen: se ratkaisee ALV-odotuksen ja budjetin.
 * Ilman kytköstä oma kategoria olisi pelkkä nimilappu jonka kohdalla
 * järjestelmä ei voisi tunnistaa mitään poikkeamaa.
 */
export async function saveCategory(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const parsed = categorySchema.safeParse({
    id: (formData.get("categoryId") as string) || null,
    name: formData.get("name"),
    base: formData.get("base"),
    active: formData.get("active") !== "off",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.rpc("upsert_expense_category", {
    p_restaurant: restaurant.id,
    p_id: parsed.data.id,
    p_name: parsed.data.name,
    p_base: parsed.data.base as ExpenseCategory,
    p_active: parsed.data.active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Samanniminen kategoria on jo olemassa." };
    }
    return { error: explain(error, "Kategorian tallennus epäonnistui") };
  }

  revalidatePath("/admin", "layout");
  return { notice: "Kategoria tallennettu." };
}

/** Poistaa kategorian. Kuitit säilyvät ja palaavat perusluokkaan. */
export async function deleteCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("categoryId") ?? "");
  if (!id) return;

  await requireContext("/admin/asetukset");
  const supabase = await createClient();
  await supabase.rpc("delete_expense_category", { p_category: id });

  revalidatePath("/admin", "layout");
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
  // Postgresin oma teksti "numeric field overflow" ei kerro käyttäjälle
  // mitään. Se tarkoittaa että jokin luku ei mahdu sarakkeeseensa, ja
  // käytännössä se on aina poimitussa rivissä.
  if (code === "22003" || message.includes("numeric field overflow")) {
    return (
      "Jokin poimittu luku ei kelpaa — todennäköisesti rivin ALV-kanta " +
      "tai määrä. Poista kuittirivit tai korjaa luvut ja tallenna uudelleen."
    );
  }
  if (message.includes("Kuukausi on suljettu")) {
    return "Kuukausi on suljettu kirjanpitoon. Avaa se asetuksista jos muutos on välttämätön.";
  }
  if (message.includes("Tuntematon aikavyöhyke")) {
    return "Tuntematon aikavyöhyke.";
  }
  if (message.includes("Kuluvaa tai tulevaa")) {
    return "Kuluvaa tai tulevaa kuukautta ei voi sulkea.";
  }
  if (message.includes("hallita kategorioita")) {
    return "Vain omistaja voi hallita kategorioita.";
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}
