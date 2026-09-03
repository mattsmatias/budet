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
import type { KitchenLoad } from "@/lib/restoflow/reservation-queries";
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
  revalidatePath("/admin/varaukset/asetukset");
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
  allergies: z.string().trim().max(200).optional(),
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
    allergies: formData.get("allergies") || undefined,
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
    p_allergies: parsed.data.allergies ?? null,
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
  allergies: z.string().trim().max(200).optional(),
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
    allergies: formData.has("allergies")
      ? String(formData.get("allergies"))
      : undefined,
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
    p_allergies: parsed.data.allergies ?? null,
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

  if (!z.string().uuid().safeParse(id).success)
    return { error: t.varaus.errGeneric };
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

// ---------------------------------------------------------------------------
// Lomakkeen haut
// ---------------------------------------------------------------------------

/**
 * Vapaat ajat seurueen koolle.
 *
 * Aika riippuu seurueen koosta: kahdelle vapaa aika ei ole vapaa
 * kuudelle, jos ainoa iso pöytä on varattu. Aiemmin lista laskettiin
 * kerran kahdelle hengelle ja näytettiin kaikille koolle — lomake
 * tarjosi aikoja jotka moottori hylkäsi vasta lähetyksen jälkeen.
 *
 * Palvelintoiminto eikä rajapintareitti: oikeustarkistus tulee
 * requireContextista ilman omaa CORS- ja tunnistuskerrosta.
 */
export async function fetchSlots(
  date: string,
  partySize: number,
  excludeId?: string,
): Promise<string[]> {
  if (!ISO_DATE.test(date)) return [];
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 200)
    return [];

  const { restaurant } = await requireContext("/admin/varaukset");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_admin_slots", {
    p_restaurant: restaurant.id,
    p_date: date,
    p_party: partySize,
    p_exclude:
      excludeId && z.string().uuid().safeParse(excludeId).success
        ? excludeId
        : null,
  });

  if (error || !data) return [];
  return ((data as { slots?: string[] }).slots ?? []) as string[];
}

export interface TableOption {
  id: string;
  name: string;
  seatsMin: number;
  seatsMax: number;
  /** Mahtuuko seurue tähän pöytään. Ei estä valintaa, vaan varoittaa. */
  fits: boolean;
}

/**
 * Pöydät jotka ovat vapaana juuri tämän varauksen aikana.
 *
 * Varaus ei estä itseään: sen oma pöytä on listalla, muuten pöydän
 * vaihtaminen näyttäisi siltä ettei nykyinen pöytä kelpaa.
 *
 * Ilman tätä pöytävalinta listasi kaikki pöydät, ja varatun
 * valitseminen päättyi virheeseen vasta tallennuksessa.
 */
export async function fetchFreeTables(
  reservationId: string,
): Promise<TableOption[]> {
  if (!z.string().uuid().safeParse(reservationId).success) return [];

  await requireContext("/admin/varaukset");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_free_tables", {
    p_reservation: reservationId,
  });

  if (error || !data) return [];
  return data as unknown as TableOption[];
}

// ---------------------------------------------------------------------------
// Pöytäehdotukset
// ---------------------------------------------------------------------------

export interface TableSuggestion {
  kind: "table" | "combination";
  tableIds: string[];
  /** "12" tai "12 + 13" — se miten pöydästä salissa puhutaan. */
  label: string;
  seatsMax: number;
  /** Montako paikkaa jää käyttämättä. Nolla on täydellinen osuma. */
  wasted: number;
}

/**
 * Sopivat pöydät ja yhdistelmät annetulle ajalle ja seurueelle.
 *
 * Varausmoottori valitsee pienimmän sopivan ja se on oikein
 * verkkovaraukselle: asiakas ei tiedä mikä pöytä on ikkunan vieressä
 * eikä sen kuulu päättää siitä.
 *
 * Salissa se on väärin. Esihenkilö tietää että kahdeksan hengen
 * seurue kannattaa laittaa 12+13 eikä 18+19, koska 18 on keittiön oven
 * vieressä. Kate ei tiedä sitä eikä voi tietää — mutta se voi näyttää
 * molemmat ja antaa ihmisen valita.
 *
 * Kesto tulee asetuksista samalla tavalla kuin varausta luotaessa.
 * Jos se laskettaisiin tässä toisin, ehdotus koskisi eri aikaväliä
 * kuin tallennus — ja lista tarjoaisi pöytää jonka tallennus hylkää.
 */
/**
 * Kaikki mitä lomake tarvitsee valitusta ajasta.
 *
 * Kolme kysymystä yhdellä kutsulla: mihin pöytään seurue mahtuu,
 * kestääkö keittiö sen, ja onko seuraava varaus tulossa pian. Ne
 * kysytään aina samaan aikaan ja samasta ajasta — kolme erillistä
 * hakua tarkoittaisi kolmea vastausta jotka voivat koskea eri hetkeä,
 * koska käyttäjä ehtii vaihtaa kellonaikaa niiden välissä.
 */
export interface TablePlan {
  options: TableSuggestion[];
  kitchen: KitchenLoad | null;
  /** Seuraava varaus tämän ajan jälkeen, jos se alkaa pian. */
  next: { guestName: string; minutes: number } | null;
}

/**
 * Kuinka pian seuraava varaus lasketaan "pian alkavaksi".
 *
 * Kaksi tuntia on tavallisen illallisen kesto: sitä lähempänä oleva
 * varaus tarkoittaa, että walk-in joutuu lähtemään kesken tai
 * seuraava seurue odottamaan. Kauempana oleva ei ole vielä kenenkään
 * ongelma eikä siitä kannata varoittaa.
 */
const SOON_MINUTES = 120;

export async function fetchTableOptions(input: {
  date: string;
  time: string;
  partySize: number;
  excludeId?: string;
}): Promise<TablePlan> {
  const tyhja: TablePlan = { options: [], kitchen: null, next: null };
  const { restaurant } = await requireContext("/admin/varaukset");

  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      partySize: z.number().int().min(1).max(200),
      excludeId: z.string().uuid().nullable(),
    })
    .safeParse({ ...input, excludeId: input.excludeId ?? null });

  if (!parsed.success) return tyhja;

  const supabase = await createClient();

  /*
   * Alku ja loppu lasketaan kannassa, ei selaimessa.
   *
   * Ravintolan aikavyöhyke ja kesto ovat kannassa, ja niiden
   * toistaminen täällä olisi toinen paikka jossa kesäaika menee
   * pieleen. Funktio ottaa vastaan aikaleimat, joten ne muodostetaan
   * yhdellä kyselyllä samasta lähteestä kuin varaus.
   */
  const { data: window, error: windowError } = await supabase.rpc(
    "reservation_window",
    {
      p_restaurant: restaurant.id,
      p_date: parsed.data.date,
      p_time: parsed.data.time,
    },
  );

  if (windowError || !window) return tyhja;

  const { startsAt, endsAt } = window as { startsAt: string; endsAt: string };

  /*
   * Kolme kysymystä rinnakkain.
   *
   * Ne eivät riipu toisistaan: keittiön kuorma ei muutu siitä mitä
   * pöytiä on vapaana. Peräkkäin ne olisivat kolme edestakaista matkaa
   * kantaan siinä hetkessä jona käyttäjä odottaa lomakkeen päivittyvän.
   */
  const [options, kitchen, next] = await Promise.all([
    supabase.rpc("reservation_table_options", {
      p_restaurant: restaurant.id,
      p_start: startsAt,
      p_end: endsAt,
      p_party: parsed.data.partySize,
      p_exclude: parsed.data.excludeId,
      p_limit: 6,
    }),
    supabase.rpc("kitchen_check", {
      p_restaurant: restaurant.id,
      p_at: startsAt,
      p_party: parsed.data.partySize,
      p_exclude: parsed.data.excludeId,
    }),
    supabase
      .from("reservations")
      .select("starts_at, guest_name, status")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["pending", "confirmed", "arrived"])
      .gt("starts_at", startsAt)
      .order("starts_at")
      .limit(1),
  ]);

  const suggestions = options.error
    ? []
    : (
        (options.data ?? []) as {
          kind: "table" | "combination";
          table_ids: string[];
          label: string;
          seats_max: number;
          wasted: number;
        }[]
      ).map((row) => ({
        kind: row.kind,
        tableIds: row.table_ids,
        label: row.label,
        seatsMax: row.seats_max,
        wasted: row.wasted,
      }));

  return {
    options: suggestions,
    kitchen: kitchen.error ? null : (kitchen.data as unknown as KitchenLoad),
    next: seuraava(next.data?.[0], startsAt),
  };
}

/**
 * Seuraava varaus, jos se alkaa pian.
 *
 * Palautetaan minuutteina eikä kellonaikana. Aikaleiman muotoilu
 * vaatisi ravintolan vyöhykkeen, ja kysymys johon salissa haetaan
 * vastausta on joka tapauksessa "kauanko tässä pöydässä voi istua" —
 * siihen vastaa erotus eikä kello.
 *
 * Kaukana oleva varaus palautetaan tyhjänä: varoitus joka koskee ensi
 * viikkoa ei ole varoitus vaan kohinaa.
 */
function seuraava(
  row: { starts_at: string; guest_name: string } | undefined,
  startsAt: string,
): TablePlan["next"] {
  if (!row) return null;

  const ero = Math.round(
    (Date.parse(row.starts_at) - Date.parse(startsAt)) / 60000,
  );

  if (!Number.isFinite(ero) || ero < 0 || ero > SOON_MINUTES) return null;

  return { guestName: row.guest_name, minutes: ero };
}

/**
 * Laskun pyyntö päälle ja pois.
 *
 * Sama toiminto molempiin suuntiin, koska tarjoilija painaa väärää
 * pöytää yhtä usein kuin oikeaa. Peruminen ilman erillistä painiketta
 * on se ero jonka takia merkintää uskalletaan käyttää kesken vuoron.
 *
 * Ei esihenkilön oikeutta: laskun pyytäminen on salityötä, ja se on
 * juuri se merkintä jonka tarjoilijan on voitava tehdä ohi mennessään.
 * Kanta tarkistaa jäsenyyden.
 */
export async function setBill(
  _prev: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  const t = adminText(await resolveLocale());
  await requireContext("/admin/varaukset");

  const id = String(formData.get("id") ?? "");
  const waiting = String(formData.get("waiting") ?? "") === "1";

  if (!z.string().uuid().safeParse(id).success) {
    return { error: t.varaus.errGeneric };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_set_bill", {
    p_reservation: id,
    p_waiting: waiting,
  });

  if (error) return { error: t.varaus.errGeneric };

  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) return { error: explain(result?.error, t) };

  revalidatePath("/admin/varaukset", "layout");
  return {};
}
