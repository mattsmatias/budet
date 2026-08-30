"use server";

/**
 * Pöytävarausten toiminnot.
 *
 * Oikeustarkistus on kannan funktioissa, kuten muuallakin tässä
 * sovelluksessa: reservation_create_admin, reservation_update ja
 * reservation_set_status tarkistavat kukin is_manager itse. Tämä
 * kerros validoi muodon ja kääntää virheen luettavaksi.
 *
 * Sama linja on syystä. Jos pääsysääntö olisi täällä, kanta luottaisi
 * sovellukseen — ja silloin jokainen uusi kutsupaikka olisi uusi tapa
 * unohtaa tarkistus.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";

export interface ReservationState {
  error?: string;
  notice?: string;
}

const KELLO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Kannan virhekoodi luettavaksi lauseeksi.
 *
 * Kannan funktiot palauttavat lyhyen koodin eivätkä valmista tekstiä,
 * koska sama koodi näytetään kuudella kielellä. Poikkeuksena
 * oikeusvirhe, joka nousee suomenkielisenä poikkeuksena — se ei ole
 * asiakkaalle näytettävä viesti vaan merkki siitä että jotain on
 * pielessä, ja se näytetään yleisenä.
 */
function explain(code: string | undefined, t: AdminText): string {
  switch (code) {
    case "taken":
      return t.varaus.errTaken;
    case "party":
      return t.varaus.errParty;
    case "table":
      return t.varaus.errTable;
    case "name":
      return t.varaus.errName;
    default:
      return t.varaus.errGeneric;
  }
}

function revalidate(): void {
  revalidatePath("/admin/varaukset");
  revalidatePath("/admin/asetukset/varaukset");
}

// ---------------------------------------------------------------------------
// Uusi varaus ja walk-in
// ---------------------------------------------------------------------------

const LuoSchema = z.object({
  date: z.string().regex(ISO_DATE),
  time: z.string().regex(KELLO),
  partySize: z.coerce.number().int().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
  walkIn: z.coerce.boolean().optional(),
  minutes: z.coerce.number().int().min(15).max(600).optional(),
});

/**
 * Varaus tai walk-in hallintanäkymästä.
 *
 * Sama toiminto molemmille. Walk-in on varaus joka on jo saapunut:
 * seurue istuu pöydässä, ja siksi se saa tilan arrived heti. Ero on
 * yhdessä lipussa eikä omassa polussaan — muuten walk-in ei näkyisi
 * saatavuuslaskennassa, ja verkkovaraus voisi myydä saman pöydän.
 */
export async function createReservation(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext("/admin/varaukset");

  const parsed = LuoSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    partySize: formData.get("partySize"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    note: formData.get("note") || undefined,
    walkIn: formData.get("walkIn") === "1" ? true : undefined,
    minutes: formData.get("minutes") || undefined,
  });

  if (!parsed.success) return { error: t.varaus.errFields };

  const tables = formData
    .getAll("tableId")
    .map(String)
    .filter((id) => id.length > 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_create_admin", {
    p_restaurant: restaurant.id,
    p_date: parsed.data.date,
    p_time: parsed.data.time,
    p_party: parsed.data.partySize,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone ?? null,
    p_email: parsed.data.email ?? null,
    p_note: parsed.data.note ?? null,
    p_walk_in: parsed.data.walkIn ?? false,
    p_minutes: parsed.data.minutes ?? null,
    p_tables: tables.length > 0 ? tables : null,
  });

  if (error) return { error: t.varaus.errGeneric };

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { error: explain(result?.error, t) };

  revalidate();
  return {
    notice: parsed.data.walkIn ? t.varaus.walkInAdded : t.varaus.added,
  };
}

// ---------------------------------------------------------------------------
// Muokkaus
// ---------------------------------------------------------------------------

const MuokkaaSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(ISO_DATE).optional(),
  time: z.string().regex(KELLO).optional(),
  partySize: z.coerce.number().int().min(1).max(200).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Ajan, koon, yhteystietojen ja pöytien muutos.
 *
 * Yksi toiminto eikä neljä. Ne riippuvat toisistaan: uusi aika voi
 * viedä pöydän ja suurempi seurue ei ehkä mahdu vanhaan. Neljä
 * erillistä kutsua tarkoittaisi neljää tilaa joista jokin voi jäädä
 * puolitiehen.
 *
 * Tyhjä merkkijono tyhjentää kentän, puuttuva jättää ennalleen. Ero on
 * kannan funktiossa sama.
 */
export async function updateReservation(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const t = adminText(await resolveLocale());
  await requireContext("/admin/varaukset");

  const parsed = MuokkaaSchema.safeParse({
    id: formData.get("id"),
    date: formData.get("date") || undefined,
    time: formData.get("time") || undefined,
    partySize: formData.get("partySize") || undefined,
    name: formData.get("name") || undefined,
    phone: formData.has("phone") ? String(formData.get("phone")) : undefined,
    email: formData.has("email") ? String(formData.get("email")) : undefined,
    note: formData.has("note") ? String(formData.get("note")) : undefined,
  });

  if (!parsed.success) return { error: t.varaus.errFields };

  /*
   * Pöydät vain jos lomakkeessa oli pöytävalinta.
   *
   * Tyhjä lista ja "ei valintaa" ovat eri asioita: edellinen
   * tarkoittaisi "poista kaikki pöydät", jälkimmäinen "älä koske".
   * Piilokenttä kertoo kummasta on kyse.
   */
  const touchesTables = formData.get("tablesTouched") === "1";
  const tables = formData
    .getAll("tableId")
    .map(String)
    .filter((id) => id.length > 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_update", {
    p_reservation: parsed.data.id,
    p_date: parsed.data.date ?? null,
    p_time: parsed.data.time ?? null,
    p_party: parsed.data.partySize ?? null,
    p_name: parsed.data.name ?? null,
    p_phone: parsed.data.phone ?? null,
    p_email: parsed.data.email ?? null,
    p_note: parsed.data.note ?? null,
    p_tables: touchesTables && tables.length > 0 ? tables : null,
  });

  if (error) return { error: t.varaus.errGeneric };

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { error: explain(result?.error, t) };

  revalidate();
  return { notice: t.varaus.saved };
}

// ---------------------------------------------------------------------------
// Tila
// ---------------------------------------------------------------------------

const TILAT = [
  "pending",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
] as const;

/**
 * Saapui, lähti, ei saapunut, peruttu.
 *
 * EI SAAPUNUT ON PELKKÄ MERKINTÄ. Siitä ei seuraa maksua, veloitusta
 * eikä korttivarmennusta — tila on olemassa jotta ravintola tietää
 * kuinka usein näin käy, ei jotta asiakasta rangaistaisiin.
 */
export async function setStatus(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const t = adminText(await resolveLocale());
  await requireContext("/admin/varaukset");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!z.string().uuid().safeParse(id).success) return { error: t.varaus.errGeneric };
  if (!TILAT.includes(status as (typeof TILAT)[number])) {
    return { error: t.varaus.errGeneric };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_set_status", {
    p_reservation: id,
    p_status: status,
  });

  if (error) return { error: t.varaus.errGeneric };

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { error: explain(result?.error, t) };

  revalidate();
  return { notice: t.varaus.saved };
}
