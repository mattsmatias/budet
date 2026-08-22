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
import { ISO_DATE } from "@/lib/restoflow/dates";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { weekStartOf } from "@/lib/restoflow/lunch";

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
function explain(error: { message?: string } | null, fallback: string): string {
  const message = error?.message ?? "";

  if (message.includes("Vain esihenkilö")) return message;
  if (message.includes("Tyhjää lounaslistaa")) return message;
  if (message.includes("Ruoan nimi")) return message;
  if (message.includes("Hinta ei voi")) return message;
  if (message.includes("ei löytynyt")) return message;

  return `${fallback} Yritä uudelleen.`;
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
  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) return { error: "Viikkoa ei ole vielä luotu." };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("publish_lunch_week", { p_menu: menuId });
  if (error) return { error: explain(error, "Julkaisu epäonnistui.") };

  revalidate();
  return { notice: "Lounaslista julkaistu." };
}

export async function setLunchWeekStatus(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const menuId = String(formData.get("menuId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!menuId) return { error: "Viikkoa ei ole vielä luotu." };
  if (status !== "draft" && status !== "archived") {
    return { error: "Tuntematon tila." };
  }

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_week_status", {
    p_menu: menuId,
    p_status: status,
  });
  if (error) return { error: explain(error, "Tilan vaihto epäonnistui.") };

  revalidate();
  return {
    notice: status === "archived" ? "Viikko arkistoitu." : "Viikko palautettu luonnokseksi.",
  };
}

// ---------------------------------------------------------------------------
// Kopiointi
// ---------------------------------------------------------------------------

export async function copyLunchWeek(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const from = String(formData.get("fromWeek") ?? "");
  const to = String(formData.get("toWeek") ?? "");

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { error: "Tarkista viikot." };
  }
  if (from === to) return { error: "Viikkoa ei voi kopioida itseensä." };

  const { restaurant } = await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("copy_lunch_week", {
    p_restaurant: restaurant.id,
    p_from_week: weekStartOf(from),
    p_to_week: weekStartOf(to),
  });

  if (error) {
    if (error.message?.includes("Kopioitavaa viikkoa ei löytynyt")) {
      return { error: "Kopioitavalla viikolla ei ole lounaslistaa." };
    }
    return { error: explain(error, "Kopiointi epäonnistui.") };
  }

  revalidate();
  return { notice: "Lounaslista kopioitu. Uusi viikko on luonnos." };
}

export async function copyLunchDay(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const from = String(formData.get("fromDay") ?? "");
  const to = String(formData.get("toDay") ?? "");

  if (!from || !to) return { error: "Valitse päivä johon kopioidaan." };
  if (from === to) return { error: "Päivää ei voi kopioida itseensä." };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("copy_lunch_day", {
    p_from: from,
    p_to: to,
  });
  if (error) return { error: explain(error, "Kopiointi epäonnistui.") };

  revalidate();
  return { notice: "Päivä kopioitu." };
}

// ---------------------------------------------------------------------------
// Ruoat
// ---------------------------------------------------------------------------

const itemSchema = z.object({
  dayId: z.string().uuid("Päivää ei löytynyt."),
  itemId: z.string().uuid().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Ruoan nimi puuttuu.")
    .max(120, "Nimi on liian pitkä."),
  description: z.string().trim().max(400, "Kuvaus on liian pitkä.").nullable(),
  diets: z.array(z.string()),
  allergens: z.array(z.string()),
});

export async function saveLunchItem(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const parsed = itemSchema.safeParse({
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

  if (error) return { error: explain(error, "Ruoan tallennus epäonnistui.") };

  revalidate();
  return { notice: parsed.data.itemId ? "Ruoka päivitetty." : "Ruoka lisätty." };
}

export async function deleteLunchItem(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  await supabase.rpc("delete_lunch_item", { p_item: itemId });
  revalidate();
}

export async function moveLunchItem(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  await supabase.rpc("move_lunch_item", {
    p_item: itemId,
    p_up: formData.get("direction") === "up",
  });
  revalidate();
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
  const menuId = String(formData.get("menuId") ?? "");
  if (!menuId) return { error: "Viikkoa ei ole vielä luotu." };

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_includes", {
    p_menu: menuId,
    p_dessert: formData.get("dessert") === "on",
    p_coffee: formData.get("coffee") === "on",
  });

  if (error) return { error: explain(error, "Tallennus epäonnistui.") };

  revalidate();
  return { notice: "Tallennettu." };
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
  const raw = String(value ?? "").trim().replace(",", ".").replace(/\s/g, "");
  if (raw === "") return null;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}

export async function setLunchPrice(
  _prev: LunchState,
  formData: FormData,
): Promise<LunchState> {
  const menuId = String(formData.get("menuId") ?? "");
  const name = String(formData.get("priceName") ?? "").trim();
  const raw = String(formData.get("price") ?? "").trim();

  if (!menuId) return { error: "Viikkoa ei ole vielä luotu." };
  if (name === "") return { error: "Hinnan nimi puuttuu." };

  const cents = parseEuros(raw);

  // Tyhjä poistaa hinnan; kelvoton teksti on virhe. Ilman tätä eroa
  // kirjoitusvirhe poistaisi hinnan hiljaa.
  if (raw !== "" && cents === null) {
    return { error: "Tarkista hinta." };
  }

  await requireContext("/admin/lounas");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_lunch_price", {
    p_menu: menuId,
    p_name: name,
    p_cents: cents,
  });

  if (error) return { error: explain(error, "Hinnan tallennus epäonnistui.") };

  revalidate();
  return { notice: cents === null ? "Hinta poistettu." : "Hinta tallennettu." };
}
