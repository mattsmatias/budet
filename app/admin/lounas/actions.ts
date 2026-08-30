"use server";

/**
 * Lounaslistan toiminnot.
 *
 * Oikeustarkistus tehdään tietokantafunktioissa, kuten muuallakin tässä
 * sovelluksessa. Nämä validoivat syötteen ja kääntävät virheen
 * luettavaksi — pääsysääntö on yhdessä paikassa eikä se voi ajautua eri
 * linjalle sovelluskoodin kanssa.
 */

import { revalidatePath } from "next/cache";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { weekStartOf, priceSortOrder } from "@/lib/restoflow/lunch";
import { isLunchTheme } from "@/lib/restoflow/lunch-themes";

export interface LunchState {
  error?: string;
  notice?: string;
}

/**
 * Kääntää kannan virheen luettavaksi.
 *
 * Tietokantafunktiot nostavat suomenkielisiä poikkeuksia, joten ne
 * näytetään sellaisenaan. Tuntematon virhe saa yleisen tekstin: Postgresin
 * oma viesti kertoisi käyttäjälle sarakenimiä eikä mitään hyödyllistä.
 */
function explain(
  error: { message?: string } | null,
  fallback: string,
  t: AdminText,
): string {
  const message = error?.message ?? "";

  if (message.includes("Vain esihenkilö")) return message;
  if (message.includes("Tyhjää lounaslistaa")) return message;
  if (message.includes("Ruoan nimi")) return message;
  if (message.includes("Hinta ei voi")) return message;
  if (message.includes("ei löytynyt")) return message;

  return fill(t.lounas.retrySuffix, { syy: fallback });
}

function revalidate(): void {
  revalidatePath("/admin/lounas");
  revalidatePath("/lounas", "layout");
}

// ---------------------------------------------------------------------------
// Viikko
// ---------------------------------------------------------------------------

/**
 * Avaa viikon muokattavaksi.
 *
 * Luo viikon ja sen seitsemän päivää jos niitä ei vielä ole. Päivät
 * luodaan kerralla eikä sitä mukaa kun niihin lisätään ruokaa: puolikas
 * viikko näyttäisi siltä että ravintola on kiinni loppuviikon.
 */
export async function openLunchWeek(formData: FormData): Promise<void> {
  const raw = String(formData.get("weekStart") ?? "");
  if (!ISO_DATE.test(raw)) return;

  const { restaurant } = await requireContext("/admin/lounas");
  const supabase = await createClient();

  await supabase.rpc("open_lunch_week", {
    p_restaurant: restaurant.id,
    p_week_start: weekStartOf(raw),
  });

  revalidate();
}

export async function publishLunchWeek(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) return { error: t.lounas.weekNotCreated };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("publish_lunch_week", {
    p_menu: menuId,
  });
  if (error) return { error: explain(error, t.lounas.publishFailed, t) };

  revalidate();
  return { notice: t.lounas.publishedNotice };
}

export async function setLunchWeekStatus(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const menuId = String(formData.get("menuId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!menuId) return { error: t.lounas.weekNotCreated };
  if (status !== "draft" && status !== "archived") {
    return { error: t.lounas.unknownStatus };
  }

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_week_status", {
    p_menu: menuId,
    p_status: status,
  });
  if (error) return { error: explain(error, t.lounas.statusChangeFailed, t) };

  revalidate();
  return {
    notice:
      status === "archived" ? t.lounas.weekArchived : t.lounas.weekBackToDraft,
  };
}

// ---------------------------------------------------------------------------
// Kopiointi
// ---------------------------------------------------------------------------

export async function copyLunchWeek(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const from = String(formData.get("fromWeek") ?? "");
  const to = String(formData.get("toWeek") ?? "");

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { error: t.lounas.checkWeeks };
  }
  if (from === to) return { error: t.lounas.cannotCopyToSelf };

  const { restaurant } = await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("copy_lunch_week", {
    p_restaurant: restaurant.id,
    p_from_week: weekStartOf(from),
    p_to_week: weekStartOf(to),
  });

  if (error) {
    if (error.message?.includes("Kopioitavaa viikkoa ei löytynyt")) {
      return { error: t.lounas.sourceWeekEmpty };
    }
    return { error: explain(error, t.lounas.copyFailed, t) };
  }

  revalidate();
  return { notice: t.lounas.weekCopied };
}

export async function copyLunchDay(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const from = String(formData.get("fromDay") ?? "");
  const to = String(formData.get("toDay") ?? "");

  if (!from || !to) return { error: t.lounas.chooseTargetDay };
  if (from === to) return { error: t.lounas.dayCannotCopySelf };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("copy_lunch_day", {
    p_from: from,
    p_to: to,
  });
  if (error) return { error: explain(error, t.lounas.copyFailed, t) };

  revalidate();
  return { notice: t.lounas.dayCopied };
}

// ---------------------------------------------------------------------------
// Ruoat
// ---------------------------------------------------------------------------

const itemSchema = (t: AdminText) =>
  z.object({
    dayId: z.string().uuid(t.lounas.dayNotFound),
    itemId: z.string().uuid().nullable(),
    name: z
      .string()
      .trim()
      .min(1, t.lounas.itemNameMissing)
      .max(120, t.lounas.nameTooLong),
    description: z.string().trim().max(400, t.lounas.descTooLong).nullable(),
    diets: z.array(z.string()),
    allergens: z.array(z.string()),
  });

export async function saveLunchItem(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const parsed = itemSchema(t).safeParse({
    dayId: formData.get("dayId"),
    itemId: (formData.get("itemId") as string) || null,
    name: formData.get("name"),
    description: (formData.get("description") as string) || null,
    // Valintaruudut tulevat lomakkeelta samannimisinä kenttinä.
    diets: formData.getAll("diets").map(String),
    allergens: formData.getAll("allergens").map(String),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("save_lunch_item", {
    p_day: parsed.data.dayId,
    p_item: parsed.data.itemId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_diets: parsed.data.diets,
    p_allergens: parsed.data.allergens,
  });

  if (error) return { error: explain(error, t.lounas.itemSaveFailed, t) };

  revalidate();
  return {
    notice: parsed.data.itemId ? t.lounas.itemUpdated : t.lounas.itemAdded,
  };
}

export async function deleteLunchItem(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  await supabase.rpc("delete_lunch_item", { p_item: itemId });
  revalidate();
}

/**
 * Päivän ruokien järjestys kerralla.
 *
 * Koko lista eikä yksi siirto. Raahaus pudottaa ruoan monta paikkaa
 * kerralla, ja sarja vierekkäisvaihtoja olisi sarja kutsuja joista
 * jokin voi epäonnistua kesken — silloin lista jäisi puolittain
 * väärään järjestykseen.
 *
 * Tunnisteet tarkistetaan muodoltaan tässä ja kuuluvuudeltaan
 * kannassa: reorder_lunch_items hylkää toisen päivän ruoan.
 */
export async function reorderLunchItems(
  dayId: string,
  itemIds: string[],
): Promise<void> {
  const uuid = z.string().uuid();
  if (!uuid.safeParse(dayId).success) return;
  if (itemIds.length === 0) return;
  if (!itemIds.every((id) => uuid.safeParse(id).success)) return;

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  await supabase.rpc("reorder_lunch_items", {
    p_day: dayId,
    p_items: itemIds,
  });
  revalidate();
}

// ---------------------------------------------------------------------------
// Teema
// ---------------------------------------------------------------------------

/**
 * Julkisen lounassivun teema.
 *
 * Ravintolan valinta eikä viikon, joten se ei nollaudu uudella
 * viikolla eikä sitä tarvitse valita joka maanantai.
 */
export async function setLunchTheme(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const theme = String(formData.get("theme") ?? "");

  if (!isLunchTheme(theme)) return { error: t.lounas.unknownTheme };

  const { restaurant } = await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_theme", {
    p_restaurant: restaurant.id,
    p_theme: theme,
  });

  if (error) return { error: explain(error, t.lounas.themeChangeFailed, t) };

  revalidate();
  return { notice: t.lounas.themeChanged };
}

// ---------------------------------------------------------------------------
// Mitä hintaan sisältyy
// ---------------------------------------------------------------------------

/**
 * Jälkiruoka ja kahvi.
 *
 * Molemmat kerralla, koska lomake lähettää molempien tilan. Yksi
 * kenttä kerrallaan lähettäminen tarkoittaisi että puuttuva kenttä
 * tulkitaan epätodeksi — ja valintaruutu jota ei rastita ei lähetä
 * mitään.
 */
export async function setLunchIncludes(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) return { error: t.lounas.weekNotCreated };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_includes", {
    p_menu: menuId,
    p_dessert: formData.get("dessert") === "on",
    p_coffee: formData.get("coffee") === "on",
  });

  if (error) return { error: explain(error, t.lounas.saveFailed, t) };

  revalidate();
  return { notice: t.lounas.savedNotice };
}

// ---------------------------------------------------------------------------
// Hinnat
// ---------------------------------------------------------------------------

/**
 * "15,50" tai "15.50" → 1550. Tyhjä → null, joka poistaa hinnan.
 *
 * Sama sääntö kuin kuiteissa. Raha on sentteinä kokonaislukuna koko
 * sovelluksessa, eikä lounas ole poikkeus.
 */
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

export async function setLunchPrice(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const t = adminText(await resolveLocale());
  const menuId = String(formData.get("menuId") ?? "");
  const name = String(formData.get("priceName") ?? "").trim();
  const raw = String(formData.get("price") ?? "").trim();

  if (!menuId) return { error: t.lounas.weekNotCreated };
  if (name === "") return { error: t.lounas.priceNameMissing };

  const cents = parseEuros(raw);

  // Tyhjä poistaa hinnan; kelvoton teksti on virhe. Ilman tätä eroa
  // kirjoitusvirhe poistaisi hinnan hiljaa.
  if (raw !== "" && cents === null) {
    return { error: t.lounas.checkPrice };
  }

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_price", {
    p_menu: menuId,
    p_name: name,
    p_cents: cents,
    // Jarjestys tulee sanastosta eika kannasta: nimet ja niiden
    // jarjestys ovat sama tuotepaatos ja asuvat samassa paikassa.
    p_sort: priceSortOrder(name),
  });

  if (error) return { error: explain(error, t.lounas.priceSaveFailed, t) };

  revalidate();
  return {
    notice: cents === null ? t.lounas.priceRemoved : t.lounas.priceSaved,
  };
}
