"use server";

/**
 * Managerin toiminnot.
 *
 * Oikeustarkistus tehdään tietokantafunktioissa, ei täällä. Nämä actionit
 * validoivat syötteen ja kääntävät virheen luettavaksi — pääsysääntö on
 * yhdessä paikassa, eikä se voi ajautua eri linjalle sovelluskoodin kanssa.
 */

import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText, type AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { lineVatCents } from "@/lib/restoflow/vat";
import { parseReceiptPages } from "@/lib/restoflow/receipt-pages";
import { ISO_DATE, ISO_MONTH } from "@/lib/restoflow/dates";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can, canAddReceipts } from "@/lib/restoflow/permissions";
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
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".")
    .replace(/\s/g, "");
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
  const t = adminText(await resolveLocale());
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

  if (error) return { error: explain(error, t.toiminnot.inviteFailed, t) };

  revalidatePath("/admin/tyontekijat");
  return { code: data as string, notice: t.toiminnot.inviteCreated };
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
  const t = adminText(await resolveLocale());
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) return { error: t.toiminnot.enterCode };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_code: code });

  if (error) {
    const message = error.message ?? "";
    if (message.includes(t.toiminnot.notFound))
      return { error: t.toiminnot.codeNotFound };
    if (message.includes(t.toiminnot.alreadyUsed))
      return { error: t.toiminnot.codeUsed };
    if (message.includes("vanhentunut"))
      return { error: t.toiminnot.codeExpired };
    return { error: explain(error, t.toiminnot.joinFailed, t) };
  }

  revalidatePath("/", "layout");
  return { notice: t.toiminnot.joined };
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
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext("/admin/tyontekijat");

  const rawPosition = String(formData.get("position") ?? "");
  const parsed = membershipSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    position: rawPosition === "" ? null : rawPosition,
    active: formData.get("active") !== "false",
  });

  if (!parsed.success) return { error: t.toiminnot.checkInput };

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
    if (error.message?.includes(t.toiminnot.needOwner)) {
      return {
        error: t.toiminnot.needOwnerBody,
      };
    }
    return { error: explain(error, t.toiminnot.saveFailed, t) };
  }

  revalidatePath("/admin", "layout");
  return { notice: t.toiminnot.saved };
}

// ---------------------------------------------------------------------------
// Budjetit
// ---------------------------------------------------------------------------

export async function setBudget(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext("/admin/budjetit");

  const category = String(formData.get("category") ?? "") as ExpenseCategory;
  if (!category) return { error: t.toiminnot.categoryMissing };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_budget", {
    p_restaurant: restaurant.id,
    p_category: category,
    p_amount_cents: parseEuros(formData.get("amount")) ?? 0,
  });

  if (error) return { error: explain(error, t.toiminnot.budgetSaveFailed, t) };

  revalidatePath("/admin", "layout");
  return { notice: t.toiminnot.budgetSaved };
}

// ---------------------------------------------------------------------------
// Kuitin tarkistus
// ---------------------------------------------------------------------------

export async function reviewReceipt(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const receiptId = String(formData.get("receiptId") ?? "");
  if (!receiptId) return { error: t.toiminnot.receiptNotFound };

  await requireContext("/admin/kuitit");
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const { error } = await supabase.rpc("review_receipt", {
    p_receipt: receiptId,
    p_approve: formData.get("action") !== "reject",
    p_supplier_name: (formData.get("supplier") as string) || null,
    p_date: ISO_DATE.test(date) ? date : null,
    p_total_cents: parseEuros(formData.get("total")),
    p_vat_cents: parseEuros(formData.get("vat")),
    p_category: (formData.get("category") as ExpenseCategory) || null,
    p_payment: (formData.get("payment") as PaymentMethod) || null,
    p_note: (formData.get("note") as string) || null,
  });

  if (error) return { error: explain(error, t.toiminnot.reviewFailed, t) };

  revalidatePath("/admin", "layout");
  return {
    notice:
      formData.get("action") === "reject"
        ? t.toiminnot.leftInQueue
        : t.toiminnot.receiptApproved,
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

const shiftSchema = (t: AdminText) =>
  z.object({
    date: z.string().regex(ISO_DATE, t.toiminnot.checkDate),
    start: z.string().regex(/^\d{2}:\d{2}$/, t.toiminnot.checkStart),
    end: z.string().regex(/^\d{2}:\d{2}$/, t.toiminnot.checkEnd),
    location: z.string().trim().max(80),
  });

export async function saveShift(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext("/admin/tyovuorot");

  const parsed = shiftSchema(t).safeParse({
    date: formData.get("date"),
    start: formData.get("start"),
    end: formData.get("end"),
    location: (formData.get("location") as string) ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.start === parsed.data.end) {
    return { error: t.toiminnot.sameTimes };
  }

  const userId = String(formData.get("userId") ?? "");
  const shiftId = String(formData.get("shiftId") ?? "");
  const position = String(formData.get("position") ?? "");

  /*
   * Tauko luetaan minuutteina.
   *
   * Kelvoton arvo on nolla eikä virhe: tauoton vuoro on kelvollinen
   * vuoro, ja tyhjä kenttä tarkoittaa juuri sitä. Yläraja on kannassa,
   * joka hylkää vuorokauden mittaisen tauon.
   */
  const breakRaw = Number(String(formData.get("break") ?? "0").trim() || "0");
  const breakMinutes =
    Number.isFinite(breakRaw) && breakRaw > 0 ? Math.round(breakRaw) : 0;

  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 200);

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
    p_break: breakMinutes,
    p_note: note || null,
  });

  if (error) return { error: explain(error, t.toiminnot.shiftSaveFailed, t) };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  return {
    notice: shiftId
      ? t.toiminnot.shiftUpdated
      : /*
         * Uusi vuoro syntyy luonnoksena.
         *
         * Kuukauden suunnittelu on keskeneräistä siihen asti kun se
         * julkaistaan, eikä keskeneräinen suunnitelma kuulu
         * työntekijän kalenteriin. Viesti sanoo sen ääneen, jottei
         * kukaan jää odottamaan että vuoro ilmestyisi itsestään.
         */
        t.toiminnot.shiftDraft,
  };
}

/**
 * Julkaisee kuukauden luonnokset.
 *
 * Aikaväli kerralla: kuukausi suunnitellaan kokonaisuutena ja se myös
 * luvataan kokonaisuutena. Vuoro kerrallaan julkaiseminen jättäisi
 * työntekijälle puolikkaan kuukauden, eikä hän tietäisi onko loppu
 * tulossa.
 */
export async function publishShifts(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return { error: t.toiminnot.noPublishRight };

  const month = String(formData.get("month") ?? "");
  if (!ISO_MONTH.test(month)) return { error: t.toiminnot.checkMonth };

  const [year, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_shifts", {
    p_restaurant: restaurant.id,
    p_from: from,
    p_to: to,
  });

  if (error) return { error: explain(error, t.toiminnot.publishFailed, t) };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  const count = Number(data ?? 0);

  return {
    notice:
      count === 0
        ? t.toiminnot.noDrafts
        : fill(t.toiminnot.shiftsPublished, {
            maara: String(count),
            yksikko: count === 1 ? t.toiminnot.shiftOne : t.toiminnot.shiftMany,
          }),
  };
}

/**
 * Peruu julkaistun vuoron.
 *
 * Ei poista: poistettu rivi veisi mukanaan tiedon siitä että vuoro oli
 * olemassa, ja juuri se tieto tarvitaan kun kysytään miksi joku ei
 * ollut töissä.
 */
export async function cancelShift(formData: FormData): Promise<void> {
  const id = String(formData.get("shiftId") ?? "");
  if (!id) return;

  const { role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_shift", { p_shift: id });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
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

const receiptSchema = (t: AdminText) =>
  z.object({
    supplier: z.string().trim().min(1, t.toiminnot.supplierMissing).max(160),
    date: z.string().regex(ISO_DATE, t.toiminnot.checkDate),
    totalCents: z.number().int().min(0, t.toiminnot.totalMissing),
    vatCents: z.number().int().min(0).nullable(),
    category: z.string().min(1, t.toiminnot.chooseCategory),
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
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/kuitit");

  // Kuitti on ravintolan kirjanpitoaineistoa, ei työntekijän ilmoitus.
  // Tietokanta torjuu tämän joka tapauksessa; tässä virheestä saa luettavan.
  if (!canAddReceipts(role)) {
    return { error: t.toiminnot.onlyManagerReceipts };
  }

  const parsed = receiptSchema(t).safeParse({
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
    if (
      error.code === "23505" ||
      error.message?.includes("receipts_hash_unique")
    ) {
      return {
        error: t.toiminnot.duplicateFile,
      };
    }
    return { error: explain(error, t.toiminnot.receiptSaveFailed, t) };
  }

  /*
   * Sivut kirjoitetaan omana askeleenaan kuitin jälkeen.
   *
   * Sivu viittaa kuittiin, joten kuitin on oltava olemassa ensin. Jos
   * tämä epäonnistuu, kuitti on jo tallennettu eikä sitä peruta:
   * ensimmäinen sivu on create_receipt-kutsun myötä jo kuitin kuvana,
   * joten kuitti ei jää kuvattomaksi. Loput sivut voi liittää
   * uudelleen — poistettu kuitti taas olisi kirjoitettava alusta.
   */
  const pages = parseReceiptPages(formData.get("pages"));

  if (pages.length > 0) {
    const { error: pageError } = await supabase.rpc("set_receipt_pages", {
      p_receipt: data as string,
      p_paths: pages.map((page) => page.path),
      p_hashes: pages.map((page) => page.hash),
    });

    if (pageError) {
      revalidatePath("/admin", "layout");
      return {
        notice: fill(t.toiminnot.extraPagesLost, {
          maara: String(pages.length - 1),
        }),
        receiptId: data as string,
      };
    }
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

  return { notice: t.toiminnot.receiptSaved, receiptId: data as string };
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
        /*
         * RIVIN ALV LASKETAAN, EI POIMITA.
         *
         * Brutto kertaa kanta on tarkka laskutoimitus, eikä mallilta
         * kannata kysyä lukua jonka voi johtaa. Poimittu luku voisi
         * lisäksi olla ristiriidassa rivin oman kannan kanssa — ja
         * sellaista ristiriitaa ei huomaisi kukaan.
         *
         * Selaimen lähettämään lukuun ei myöskään voi luottaa:
         * lomakkeen sisällön voi kirjoittaa itse.
         */
        vatCents: lineVatCents(
          Math.round(i.totalCents),
          typeof i.vatRate === "number" ? i.vatRate : null,
        ),
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

const restaurantSchema = (t: AdminText) =>
  z.object({
    name: z.string().trim().min(1, t.toiminnot.nameMissing).max(120),
    timezone: z.string().trim().min(1, t.toiminnot.chooseTimezone),
  });

/**
 * Ravintolan nimi ja aikavyöhyke.
 *
 * Aikavyöhyke ei ole kosmeettinen: työaika, kuukausirajat ja vuorojen
 * päivät lasketaan siinä. Palvelin käy UTC:ssä, joten väärä vyöhyke
 * siirtäisi yövuoron väärälle päivälle.
 *
 * YKSI OSIO, YKSI LOMAKE, YKSI KUTSU.
 *
 * Asetussivu on jaettu osioihin, ja jokainen lähettää vain omat
 * kenttänsä. Kanta tulkitsee nullin "älä koske" -merkiksi, joten
 * nimen tallentaminen ei nollaa vuoroasetuksia. Aiemmin kaikki
 * kentät kirjoitettiin joka kerta, ja se toimi vain niin kauan kuin
 * lomakkeita oli yksi.
 */
export async function updateRestaurant(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const parsed = restaurantSchema(t).safeParse({
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

  if (error)
    return { error: explain(error, t.toiminnot.settingsSaveFailed, t) };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  return { notice: t.toiminnot.restaurantSaved };
}

/**
 * Vuoro- ja leimaussäännöt.
 *
 * Leimausikkuna on ollut kannassa alusta asti mutta lukittuna
 * kolmeenkymmeneen minuuttiin, koska sitä ei voinut muuttaa mistään.
 * Ravintoloiden käytännöt eroavat: toisessa tullaan varttia ennen,
 * toisessa tunti.
 */
export async function updateShiftRules(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const minutes = Number(formData.get("clockInEarlyMinutes"));

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    return { error: t.toiminnot.clockWindowRange };
  }

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_restaurant", {
    p_restaurant: restaurant.id,
    // Valintaruutu ei lähetä mitään kun se on pois päältä, joten
    // arvoa ei voi lukea sen olemassaolosta — lomake on aina tämä,
    // joten poissaolo tarkoittaa tässä varmasti "ei".
    p_open_shift_claiming: formData.get("openShiftClaiming") === "on",
    p_clock_in_early_minutes: minutes,
  });

  if (error)
    return { error: explain(error, t.toiminnot.settingsSaveFailed, t) };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");

  return { notice: t.toiminnot.shiftSettingsSaved };
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
  const t = adminText(await resolveLocale());
  const month = String(formData.get("month") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
    return { error: t.toiminnot.chooseMonth };
  }

  const { restaurant } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.rpc("close_month", {
    p_restaurant: restaurant.id,
    p_month: month,
    p_note: note || null,
  });

  if (error) return { error: explain(error, t.toiminnot.closeMonthFailed, t) };

  revalidatePath("/admin", "layout");
  return { notice: fill(t.toiminnot.monthClosedOk, { kuukausi: month }) };
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
 * sen kestosta, ei sen syystä. Kateen jää merkintä siitä että todistus
 * on nähty ja mille ajalle poissaolo on ilmoitettu — se mitä
 * palkanmaksuun tarvitaan.
 */
export async function markAbsenceCertificate(
  formData: FormData,
): Promise<void> {
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

const categorySchema = (t: AdminText) =>
  z.object({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(1, t.toiminnot.nameMissing).max(60),
    base: z.enum([
      "food",
      "alcohol",
      "soft_drinks",
      "cleaning",
      "kitchen_supplies",
      "packaging",
      "staff",
      "transport",
      "other",
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
  const t = adminText(await resolveLocale());
  const parsed = categorySchema(t).safeParse({
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
      return { error: t.toiminnot.categoryExists };
    }
    return { error: explain(error, t.toiminnot.categorySaveFailed, t) };
  }

  revalidatePath("/admin", "layout");
  return { notice: t.toiminnot.categorySaved };
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

/*
 * Kannan virheen tulkinta.
 *
 * TUNNISTUS ON SUOMEKSI, VASTAUS KAANNETAAN.
 *
 * Ehdot vertaavat siihen mita Postgres-funktiot palauttavat, ja ne
 * puhuvat suomea riippumatta kayttoliittyman kielesta. Jos naista
 * tekisi kaannettavia, tunnistus lakkaisi toimimasta heti kun
 * kayttaja vaihtaa kielta.
 */
function explain(
  error: { code?: string; message?: string } | null,
  prefix: string,
  t: AdminText,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return t.toiminnot.migrationsMissing;
  }
  if (code === "42501" || message.includes("row-level security")) {
    return t.toiminnot.noRight;
  }
  if (message.includes("Vain omistaja")) {
    return t.toiminnot.ownerOnlyBody;
  }
  if (message.includes("Vain esihenkilö")) {
    return t.toiminnot.managerOnlyBody;
  }
  if (message.includes("Mennyttä vuoroa")) {
    return t.toiminnot.pastShiftBody;
  }
  // Postgresin oma teksti "numeric field overflow" ei kerro käyttäjälle
  // mitään. Se tarkoittaa että jokin luku ei mahdu sarakkeeseensa, ja
  // käytännössä se on aina poimitussa rivissä.
  if (code === "22003" || message.includes("numeric field overflow")) {
    return t.toiminnot.badNumbers;
  }
  if (message.includes("Kuukausi on suljettu")) {
    return t.toiminnot.monthClosedBody;
  }
  if (message.includes("Tuntematon aikavyöhyke")) {
    return t.toiminnot.unknownTimezoneBody;
  }
  if (message.includes("Kuluvaa tai tulevaa")) {
    return t.toiminnot.currentOrFutureBody;
  }
  if (message.includes("hallita kategorioita")) {
    return t.toiminnot.ownerOnlyCategories;
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}
