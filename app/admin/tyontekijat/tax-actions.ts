"use server";

/**
 * Verokortin, luontoisetujen ja työsuhdetietojen tallennus.
 *
 * Kaksi sääntöä, samat kuin palkkojen puolella.
 *
 * 1. Oikeus tarkistetaan täällä ja kannassa. Näkymän piilottama
 *    painike ei ole suojaus vaan sopimus siitä ettei kukaan katso.
 *
 * 2. Arvot tarkistetaan täällä ja kannassa. Sovellustarkistus antaa
 *    suomenkielisen virheilmoituksen, kannan rajoite pitää huolen
 *    siitä että sääntö pätee myös silloin kun joku kirjoittaa
 *    rajapintaan suoraan.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { createClient } from "@/utils/supabase/server";

export interface TaxState {
  error?: string;
  notice?: string;
}

const PATH = "/admin/tyontekijat";

const paiva = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Prosentti lomakkeelta.
 *
 * Suomalainen kirjoittaa "17,5". Ilman pilkun muunnosta Number()
 * antaisi NaN, ja NaN tallentuisi nollana — nolla veroprosentti on
 * juuri se virhe joka huomataan vasta palkkapäivänä.
 */
function prosentti(value: FormDataEntryValue | null): number | null {
  const teksti = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (teksti === "") return null;

  const luku = Number(teksti);
  return Number.isFinite(luku) ? luku : null;
}

/** Eurot lomakkeelta sentteinä. */
function sentit(value: FormDataEntryValue | null): number | null {
  const teksti = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (teksti === "") return null;

  const luku = Number(teksti);
  return Number.isFinite(luku) ? Math.round(luku * 100) : null;
}

/**
 * Kannan virhe luettavaksi.
 *
 * Päällekkäinen verokortti tulee kannasta exclusion-rajoitteen
 * rikkomuksena. Sen viesti on rajoitteen nimi ja indeksin sisältöä,
 * eikä se kerro käyttäjälle mitään. Raakaa kantavirhettä ei näytetä.
 */
function explain(message: string, t: ReturnType<typeof adminText>): string {
  if (message.includes("tax_cards_no_overlap")) return t.verotus.overlaps;
  if (message.includes("employee_benefits_no_overlap"))
    return t.verotus.overlaps;
  if (message.includes("Ei oikeutta")) return t.verotus.noRight;
  return t.palkka.calcFailed;
}

// ---------------------------------------------------------------------------
// Verokortti
// ---------------------------------------------------------------------------

/**
 * Verokortin tallennus.
 *
 * Aina uusi rivi, ei koskaan vanhan päälle. Vanha kortti on se
 * peruste jolla keväällä maksettu palkka laskettiin, ja sen
 * korvaaminen tekisi kevään laskelmista selittämättömiä.
 *
 * Muokkaus on olemassa näppäilyvirheitä varten ja kulkee id:llä.
 */
export async function saveTaxCard(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role, user } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const userId = String(formData.get("userId") ?? "");
  const id = String(formData.get("id") ?? "");

  const base = prosentti(formData.get("basePercent"));
  const additional = prosentti(formData.get("additionalPercent"));
  const limit = sentit(formData.get("incomeLimit"));
  const prior = sentit(formData.get("priorIncome")) ?? 0;

  const validFrom = String(formData.get("validFrom") ?? "");
  const validToRaw = String(formData.get("validTo") ?? "").trim();
  const fileId = String(formData.get("fileId") ?? "").trim();

  if (!userId || !paiva.safeParse(validFrom).success) {
    return { error: t.verotus.dateOrder };
  }

  if (validToRaw !== "" && !paiva.safeParse(validToRaw).success) {
    return { error: t.verotus.dateOrder };
  }

  const validTo = validToRaw === "" ? null : validToRaw;

  if (validTo !== null && validTo < validFrom) {
    return { error: t.verotus.dateOrder };
  }

  if (
    base === null ||
    additional === null ||
    base < 0 ||
    base > 100 ||
    additional < 0 ||
    additional > 100
  ) {
    return { error: t.verotus.percentRange };
  }

  if (limit === null || limit < 0 || prior < 0) {
    return { error: t.verotus.negative };
  }

  const supabase = await createClient();

  const rivi = {
    restaurant_id: restaurant.id,
    user_id: userId,
    base_percent: base,
    additional_percent: additional,
    income_limit_cents: limit,
    prior_income_cents: prior,
    valid_from: validFrom,
    valid_to: validTo,
    file_id: fileId === "" ? null : fileId,
    created_by: user.id,
  };

  const { error } = id
    ? await supabase
        .from("tax_cards")
        .update(rivi)
        .eq("id", id)
        .eq("restaurant_id", restaurant.id)
    : await supabase.from("tax_cards").insert(rivi);

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

/**
 * Verokortin poisto.
 *
 * Kortti johon on jo laskettu palkkaa ei katoa: palkkalaskelman
 * viite muuttuu tyhjäksi (on delete set null), mutta laskelmalle
 * tallennetut prosentit jäävät. Laskelma pysyy siis selitettävänä
 * vaikka kortti poistettaisiin.
 */
export async function deleteTaxCard(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t.verotus.noRight };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_cards")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

// ---------------------------------------------------------------------------
// Luontoisedut
// ---------------------------------------------------------------------------

const LAJIT = ["meal", "phone", "car", "housing", "bicycle", "other"] as const;

export async function saveBenefit(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role, user } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const userId = String(formData.get("userId") ?? "");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const label = String(formData.get("label") ?? "")
    .trim()
    .slice(0, 60);
  const value = sentit(formData.get("monthlyValue"));

  const validFrom = String(formData.get("validFrom") ?? "");
  const validToRaw = String(formData.get("validTo") ?? "").trim();

  if (!userId || !LAJIT.includes(kind as (typeof LAJIT)[number])) {
    return { error: t.verotus.noRight };
  }

  if (!paiva.safeParse(validFrom).success)
    return { error: t.verotus.dateOrder };

  if (validToRaw !== "" && !paiva.safeParse(validToRaw).success) {
    return { error: t.verotus.dateOrder };
  }

  const validTo = validToRaw === "" ? null : validToRaw;
  if (validTo !== null && validTo < validFrom) {
    return { error: t.verotus.dateOrder };
  }

  if (value === null || value < 0) return { error: t.verotus.negative };

  const supabase = await createClient();

  const rivi = {
    restaurant_id: restaurant.id,
    user_id: userId,
    kind,
    label,
    monthly_value_cents: value,
    valid_from: validFrom,
    valid_to: validTo,
    created_by: user.id,
  };

  const { error } = id
    ? await supabase
        .from("employee_benefits")
        .update(rivi)
        .eq("id", id)
        .eq("restaurant_id", restaurant.id)
    : await supabase.from("employee_benefits").insert(rivi);

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

export async function deleteBenefit(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t.verotus.noRight };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_benefits")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

// ---------------------------------------------------------------------------
// Työsuhteen tiedot
// ---------------------------------------------------------------------------

/**
 * Työsuhteen alku, loppu ja syntymäaika.
 *
 * Kulkee kantafunktion kautta, koska sarakkeisiin ei ole
 * kirjoitusoikeutta rajapinnasta: syntymäaika ja palkka eivät saa olla
 * kenen tahansa jäsenen kirjoitettavissa.
 */
export async function saveEmployment(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);

  if (!can(role, "staff.manage")) return { error: t.verotus.noRight };

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: t.verotus.noRight };

  const luePaiva = (nimi: string): string | null => {
    const arvo = String(formData.get(nimi) ?? "").trim();
    return arvo === "" ? null : arvo;
  };

  const startsOn = luePaiva("startsOn");
  const endsOn = luePaiva("endsOn");
  const birthDate = luePaiva("birthDate");

  for (const arvo of [startsOn, endsOn, birthDate]) {
    if (arvo !== null && !paiva.safeParse(arvo).success) {
      return { error: t.verotus.dateOrder };
    }
  }

  if (startsOn && endsOn && endsOn < startsOn) {
    return { error: t.verotus.dateOrder };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_employment_details", {
    p_restaurant: restaurant.id,
    p_user: userId,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_birth_date: birthDate,
  });

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

// ---------------------------------------------------------------------------
// Ravintolan palkka-asetukset
// ---------------------------------------------------------------------------

/**
 * Työnantajan omat maksuprosentit.
 *
 * Ilman näitä työnantajan kustannus on likiarvo: eläkemaksuna on
 * kansallinen keskiarvo eikä tämän ravintolan vakuutusyhtiön maksu,
 * eikä tapaturmavakuutus ole mukana lainkaan. Tyhjä kenttä tarkoittaa
 * "ei tiedossa" eikä nollaa.
 */
export async function savePayrollSettings(
  _prev: TaxState,
  formData: FormData,
): Promise<TaxState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const kentat = ["pension", "accident", "groupLife"] as const;
  const arvot: Record<string, number | null> = {};

  for (const kentta of kentat) {
    const luku = prosentti(formData.get(kentta));
    if (luku !== null && (luku < 0 || luku > 100)) {
      return { error: t.verotus.percentRange };
    }
    arvot[kentta] = luku;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_settings").upsert(
    {
      restaurant_id: restaurant.id,
      employer_pension_rate: arvot.pension,
      employer_accident_rate: arvot.accident,
      employer_group_life_rate: arvot.groupLife,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) return { error: explain(error.message ?? "", t) };

  revalidatePath(PATH, "layout");
  return { notice: t.verotus.saved };
}

// ---------------------------------------------------------------------------
// Verokortin dokumentti
// ---------------------------------------------------------------------------

/**
 * Verokortti tiedostokaappiin, ei omaan säilöönsä.
 *
 * Katessa on jo yksityinen tiedostokaappi käytäntöineen,
 * käyttöoikeuksineen ja välityspalvelimineen. Toinen säilö
 * verokorteille olisi toinen paikka jossa yksityisyys pitäisi muistaa
 * toteuttaa oikein — ja se on juuri se paikka josta se jonain päivänä
 * unohtuisi.
 *
 * Polku on Työntekijät → [nimi] → Verokortit. Kansiot luodaan
 * tarvittaessa, mutta niitä ei nimetä uudelleen jos ne ovat olemassa:
 * rakenne on ravintolan oma, ja käyttäjän tekemä järjestys voittaa.
 *
 * Pelkkä PDF kansiossa ei silti riitä palkanlaskentaan. Prosentit
 * luetaan aina tax_cards-riviltä, ja dokumentti on todiste sen
 * takana.
 */
export async function attachTaxCardDocument(input: {
  employeeName: string;
  name: string;
  path: string;
  type: string;
  size: number;
}): Promise<{ fileId?: string; error?: string }> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);

  if (!can(role, "payroll.manage")) return { error: t.verotus.noRight };

  const supabase = await createClient();

  const staffFolder = await folderByKey(restaurant.id, "staff");
  const person = await childFolder(
    restaurant.id,
    staffFolder,
    input.employeeName.trim() || t.verotus.section,
  );
  const cards = await childFolder(restaurant.id, person, t.verotus.taxCards);

  const { data, error } = await supabase.rpc("register_file", {
    p_restaurant: restaurant.id,
    p_folder: cards,
    p_name: input.name.slice(0, 200),
    p_path: input.path,
    p_type: input.type,
    p_size: input.size,
    p_expires: null,
    p_supplier: null,
  });

  if (error) {
    /*
     * Kirjaus epäonnistui mutta objekti on jo storagessa.
     *
     * Ilman siivousta jäisi tiedosto jota kukaan ei näe eikä voi
     * poistaa: sillä ei ole riviä, joten se ei ole missään näkymässä.
     */
    await supabase.storage.from("files").remove([input.path]);
    return { error: explain(error.message ?? "", t) };
  }

  revalidatePath(PATH, "layout");
  return { fileId: typeof data === "string" ? data : undefined };
}

/** Katen lähtökansio tunnisteella. Null jos se on poistettu. */
async function folderByKey(
  restaurantId: string,
  key: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("folders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("default_key", key)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Alikansio nimellä, luodaan jos puuttuu.
 *
 * Nimivertailu on tarkka eikä sumea. Sumea vertailu osuisi jonain
 * päivänä väärään kansioon, ja verokortti päätyisi toisen työntekijän
 * kansioon — juuri se virhe jota tässä ei saa tehdä.
 */
async function childFolder(
  restaurantId: string,
  parentId: string | null,
  name: string,
): Promise<string | null> {
  const supabase = await createClient();

  let query = supabase
    .from("folders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("name", name)
    .is("deleted_at", null);

  query =
    parentId === null
      ? query.is("parent_folder_id", null)
      : query.eq("parent_folder_id", parentId);

  const { data: found } = await query.maybeSingle();
  if (found) return (found as { id: string }).id;

  const { data: created } = await supabase.rpc("create_folder", {
    p_restaurant: restaurantId,
    p_parent: parentId,
    p_name: name,
  });

  return typeof created === "string" ? created : null;
}
