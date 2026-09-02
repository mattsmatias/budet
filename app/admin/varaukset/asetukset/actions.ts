"use server";

/**
 * Varausasetusten toiminnot.
 *
 * Nämä kirjoittavat tauluihin suoraan eivätkä kannan funktioiden
 * kautta. Ero varausten hallintaan on tarkoituksellinen: varauksen
 * luonti tarvitsee lukon ja saatavuuslaskennan, mutta pöydän nimen
 * muuttaminen on tavallinen rivipäivitys jonka rivitason käytäntö
 * rajaa esihenkilölle.
 *
 * Sama sääntö silti pätee: oikeus tarkistetaan kannassa. is_manager on
 * jokaisen tämän tiedoston koskettaman taulun käytännössä, joten
 * väärään ravintolaan kirjoittava kysely ei kirjoita mitään.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";

export interface SetupState {
  error?: string;
  notice?: string;
}

const KELLO = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REITTI = "/admin/varaukset/asetukset";

function revalidate(): void {
  revalidatePath(REITTI);
  revalidatePath("/admin/varaukset");
}

async function konteksti() {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext(REITTI);
  const supabase = await createClient();
  return { t, restaurant, supabase };
}

// ---------------------------------------------------------------------------
// Perusasetukset
// ---------------------------------------------------------------------------

const AsetusSchema = z.object({
  enabled: z.coerce.boolean(),
  slotMinutes: z.coerce
    .number()
    .int()
    .refine((n) => [15, 20, 30, 60].includes(n)),
  defaultDurationMinutes: z.coerce.number().int().min(15).max(600),
  turnaroundMinutes: z.coerce.number().int().min(0).max(120),
  minParty: z.coerce.number().int().min(1),
  maxParty: z.coerce.number().int().min(1),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  leadMinutes: z.coerce.number().int().min(0).max(10080),

  /*
   * Tyhjä kenttä tarkoittaa "ei rajaa".
   *
   * z.coerce muuttaisi tyhjän merkkijonon nollaksi, ja nolla
   * kapasiteettia estäisi kaikki varaukset. Tyhjä käsitellään siis
   * ennen muunnosta.
   */
  kitchenCapacity: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(2000)])
    .transform((value) => (value === "" ? null : value)),

  kitchenWindowMinutes: z.coerce.number().int().min(15).max(240),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  themeDark: z.coerce.boolean(),
  themeRadius: z.coerce.number().int().min(0).max(28),
});

export async function saveSettings(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const parsed = AsetusSchema.safeParse({
    enabled: formData.get("enabled") === "1",
    slotMinutes: formData.get("slotMinutes"),
    defaultDurationMinutes: formData.get("defaultDurationMinutes"),
    turnaroundMinutes: formData.get("turnaroundMinutes"),
    minParty: formData.get("minParty"),
    maxParty: formData.get("maxParty"),
    maxDaysAhead: formData.get("maxDaysAhead"),
    leadMinutes: formData.get("leadMinutes"),
    kitchenCapacity: formData.get("kitchenCapacity") ?? "",
    kitchenWindowMinutes: formData.get("kitchenWindowMinutes") ?? 60,
    themeColor: formData.get("themeColor"),
    themeDark: formData.get("themeDark") === "1",
    themeRadius: formData.get("themeRadius"),
  });

  if (!parsed.success) return { error: t.varausAsetus.errFields };
  if (parsed.data.maxParty < parsed.data.minParty) {
    return { error: t.varausAsetus.errPartyRange };
  }

  const { error } = await supabase.from("reservation_settings").upsert(
    {
      restaurant_id: restaurant.id,
      enabled: parsed.data.enabled,
      slot_minutes: parsed.data.slotMinutes,
      default_duration_minutes: parsed.data.defaultDurationMinutes,
      turnaround_minutes: parsed.data.turnaroundMinutes,
      min_party: parsed.data.minParty,
      max_party: parsed.data.maxParty,
      max_days_ahead: parsed.data.maxDaysAhead,
      lead_minutes: parsed.data.leadMinutes,
      kitchen_capacity: parsed.data.kitchenCapacity,
      kitchen_window_minutes: parsed.data.kitchenWindowMinutes,
      theme_color: parsed.data.themeColor,
      theme_dark: parsed.data.themeDark,
      theme_radius: parsed.data.themeRadius,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) return { error: t.varausAsetus.errGeneric };

  revalidate();
  return { notice: t.varausAsetus.saved };
}

// ---------------------------------------------------------------------------
// Aukioloajat
// ---------------------------------------------------------------------------

/**
 * Koko viikko kerralla.
 *
 * Rivi kerrallaan tallentaminen jättäisi viikon välitilaan jossa
 * maanantai on uusi ja tiistai vanha. Aukiolo luetaan kokonaisuutena —
 * "milloin olemme auki" ei ole seitsemän erillistä asetusta.
 *
 * Päivä jolta rivi puuttuu on kiinni. Siksi tyhjä kenttä ei ole virhe
 * vaan tapa merkitä suljettu päivä.
 */
export async function saveHours(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const rivit: {
    restaurant_id: string;
    weekday: number;
    opens: string;
    last_seating: string;
  }[] = [];

  for (let weekday = 1; weekday <= 7; weekday++) {
    const opens = String(formData.get(`opens-${weekday}`) ?? "").trim();
    const last = String(formData.get(`last-${weekday}`) ?? "").trim();

    if (!opens && !last) continue;
    if (!KELLO.test(opens) || !KELLO.test(last)) {
      return { error: t.varausAsetus.errHours };
    }
    if (last <= opens) return { error: t.varausAsetus.errHourOrder };

    rivit.push({
      restaurant_id: restaurant.id,
      weekday,
      opens,
      last_seating: last,
    });
  }

  const { error: poisto } = await supabase
    .from("reservation_hours")
    .delete()
    .eq("restaurant_id", restaurant.id);

  if (poisto) return { error: t.varausAsetus.errGeneric };

  if (rivit.length > 0) {
    const { error } = await supabase.from("reservation_hours").insert(rivit);
    if (error) return { error: t.varausAsetus.errGeneric };
  }

  revalidate();
  return { notice: t.varausAsetus.saved };
}

// ---------------------------------------------------------------------------
// Kesto seurueen koon mukaan
// ---------------------------------------------------------------------------

export async function addDuration(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const minParty = Number(formData.get("minParty"));
  const maxRaw = String(formData.get("maxParty") ?? "").trim();
  const maxParty = maxRaw === "" ? null : Number(maxRaw);
  const minutes = Number(formData.get("minutes"));

  if (!Number.isInteger(minParty) || minParty < 1) {
    return { error: t.varausAsetus.errFields };
  }
  if (
    maxParty !== null &&
    (!Number.isInteger(maxParty) || maxParty < minParty)
  ) {
    return { error: t.varausAsetus.errPartyRange };
  }
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 600) {
    return { error: t.varausAsetus.errFields };
  }

  const { error } = await supabase.from("reservation_durations").insert({
    restaurant_id: restaurant.id,
    min_party: minParty,
    max_party: maxParty,
    minutes,
  });

  if (error) return { error: t.varausAsetus.errGeneric };

  revalidate();
  return { notice: t.varausAsetus.saved };
}

export async function removeDuration(formData: FormData): Promise<void> {
  const { restaurant, supabase } = await konteksti();
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  await supabase
    .from("reservation_durations")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidate();
}

// ---------------------------------------------------------------------------
// Poikkeukset
// ---------------------------------------------------------------------------

export async function addException(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return { error: t.varausAsetus.errFields };

  const closed = formData.get("closed") === "1";
  const opens = String(formData.get("opens") ?? "").trim();
  const last = String(formData.get("last") ?? "").trim();

  if (!closed && (!KELLO.test(opens) || !KELLO.test(last) || last <= opens)) {
    return { error: t.varausAsetus.errHours };
  }

  const { error } = await supabase.from("reservation_exceptions").upsert(
    {
      restaurant_id: restaurant.id,
      exception_date: date,
      closed,
      opens: closed ? null : opens,
      last_seating: closed ? null : last,
      note: String(formData.get("note") ?? "").trim() || null,
    },
    { onConflict: "restaurant_id,exception_date" },
  );

  if (error) return { error: t.varausAsetus.errGeneric };

  revalidate();
  return { notice: t.varausAsetus.saved };
}

export async function removeException(formData: FormData): Promise<void> {
  const { restaurant, supabase } = await konteksti();
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  await supabase
    .from("reservation_exceptions")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidate();
}

// ---------------------------------------------------------------------------
// Alueet
// ---------------------------------------------------------------------------

export async function addArea(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: t.varausAsetus.errFields };

  const { error } = await supabase
    .from("dining_areas")
    .insert({ restaurant_id: restaurant.id, name });

  if (error) return { error: t.varausAsetus.errDuplicate };

  revalidate();
  return { notice: t.varausAsetus.saved };
}

export async function removeArea(formData: FormData): Promise<void> {
  const { restaurant, supabase } = await konteksti();
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  /*
   * Alueen poisto ei poista pöytiä.
   *
   * Vierasavain on on delete set null: pöydät jäävät saliin ja
   * putoavat "Muut"-ryhmään. Alue on ryhmittelyä, ei omistajuutta —
   * väärin nimetyn alueen poistaminen ei saa hävittää salia.
   */
  await supabase
    .from("dining_areas")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidate();
}

// ---------------------------------------------------------------------------
// Pöydät
// ---------------------------------------------------------------------------

const PoytaSchema = z.object({
  name: z.string().trim().min(1).max(40),
  seatsMin: z.coerce.number().int().min(1).max(100),
  seatsMax: z.coerce.number().int().min(1).max(100),
  areaId: z.string().uuid().nullable(),
  active: z.coerce.boolean(),
});

export async function saveTable(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const parsed = PoytaSchema.safeParse({
    name: formData.get("name"),
    seatsMin: formData.get("seatsMin"),
    seatsMax: formData.get("seatsMax"),
    areaId: String(formData.get("areaId") ?? "") || null,
    active: formData.get("active") === "1",
  });

  if (!parsed.success) return { error: t.varausAsetus.errFields };
  if (parsed.data.seatsMax < parsed.data.seatsMin) {
    return { error: t.varausAsetus.errSeatRange };
  }

  const id = String(formData.get("id") ?? "");
  const rivi = {
    restaurant_id: restaurant.id,
    name: parsed.data.name,
    seats_min: parsed.data.seatsMin,
    seats_max: parsed.data.seatsMax,
    area_id: parsed.data.areaId,
    active: parsed.data.active,
  };

  const { error } = id
    ? await supabase
        .from("restaurant_tables")
        .update(rivi)
        .eq("id", id)
        .eq("restaurant_id", restaurant.id)
    : await supabase.from("restaurant_tables").insert(rivi);

  if (error) return { error: t.varausAsetus.errDuplicate };

  revalidate();
  return { notice: t.varausAsetus.saved };
}

/**
 * Pöydän poisto.
 *
 * Poistaa myös sen varaukset kaskadina, joten se on tarkoitettu vain
 * väärin lisätylle pöydälle. Käytöstä poistuva pöytä merkitään
 * epäaktiiviseksi: silloin uudet varaukset eivät osu siihen mutta
 * illan varaukset säilyvät.
 */
export async function removeTable(formData: FormData): Promise<void> {
  const { restaurant, supabase } = await konteksti();
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  await supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidate();
}

// ---------------------------------------------------------------------------
// Yhdistelmät
// ---------------------------------------------------------------------------

/**
 * Yhdistelmä ja sen jäsenet samassa toiminnossa.
 *
 * Yhdistelmä ilman pöytiä ei tarkoita mitään, ja varausmoottori
 * ohittaa sen. Kaksi erillistä tallennusta jättäisi puolivalmiin
 * rivin näkyviin.
 */
export async function saveCombination(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const seatsMin = Number(formData.get("seatsMin"));
  const seatsMax = Number(formData.get("seatsMax"));
  const tables = formData.getAll("tableId").map(String).filter(Boolean);

  if (
    !Number.isInteger(seatsMin) ||
    !Number.isInteger(seatsMax) ||
    seatsMin < 1
  ) {
    return { error: t.varausAsetus.errFields };
  }
  if (seatsMax < seatsMin) return { error: t.varausAsetus.errSeatRange };
  if (tables.length < 2) return { error: t.varausAsetus.errCombinationSize };

  const { data, error } = await supabase
    .from("table_combinations")
    .insert({
      restaurant_id: restaurant.id,
      name: String(formData.get("name") ?? "").trim() || null,
      seats_min: seatsMin,
      seats_max: seatsMax,
    })
    .select("id")
    .single();

  if (error || !data) return { error: t.varausAsetus.errGeneric };

  const { error: jasenet } = await supabase
    .from("table_combination_members")
    .insert(tables.map((table_id) => ({ combination_id: data.id, table_id })));

  if (jasenet) {
    /* Puolivalmis yhdistelmä pois: se olisi rivi jota moottori ei käytä. */
    await supabase.from("table_combinations").delete().eq("id", data.id);
    return { error: t.varausAsetus.errGeneric };
  }

  revalidate();
  return { notice: t.varausAsetus.saved };
}

export async function removeCombination(formData: FormData): Promise<void> {
  const { restaurant, supabase } = await konteksti();
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  await supabase
    .from("table_combinations")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidate();
}

// ---------------------------------------------------------------------------
// Pöytäkartta
// ---------------------------------------------------------------------------

/**
 * Pöytien paikat, muodot ja kierrot yhtenä eränä.
 *
 * Kartan järjestely on yksi teko eikä kaksitoista: käyttäjä siirtää
 * pöytiä kunnes sali näyttää oikealta ja tallentaa kerran.
 *
 * Tarkistus on täällä ja kannassa. Täällä siksi että virheilmoitus
 * olisi suomea, kannassa siksi että sääntö pätee myös silloin kun
 * joku kirjoittaa rajapintaan suoraan.
 */
const SijaintiSchema = z.object({
  id: z.string().uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  shape: z.enum(["round", "square", "rect"]),
  rotation: z.number().int().min(0).max(359),
  /** Null = paikkaluvusta johdettu koko. */
  width: z.number().min(3).max(40).nullable(),
});

const KalusteSchema = z.object({
  /** Uudella kalusteella ei ole vielä tunnistetta. */
  id: z.string().uuid().nullable(),
  kind: z.enum(["wall", "bar", "kitchen", "wc", "door", "entrance", "other"]),
  label: z.string().max(40),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(2).max(100),
  height: z.number().min(2).max(100),
  rotation: z.number().int().min(0).max(359),
});

/**
 * Pohjapiirros yhtenä tekona.
 *
 * Pöydät ja kalusteet tallennetaan samalla painalluksella, koska ne
 * ovat samaa työtä: käyttäjä siirtää baaritiskiä ja sen viereistä
 * pöytää peräkkäin eikä ajattele niitä eri asioina.
 *
 * Kaksi erillistä toimintoa tarkoittaisi että toinen voi onnistua ja
 * toinen ei — ja puoliksi tallennettu sali on huonompi kuin
 * tallentamaton, koska siinä ei ole enää sitä järjestystä joka oli
 * ennen eikä sitä jota yritettiin.
 *
 * Tarkistus on täällä ja kannassa. Täällä siksi että virheilmoitus
 * olisi suomea, kannassa siksi että sääntö pätee myös silloin kun
 * joku kirjoittaa rajapintaan suoraan.
 */
export async function saveFloorPlan(input: {
  tables: unknown;
  elements: unknown;
  areaId: string | null;
}): Promise<SetupState> {
  const { t, restaurant, supabase } = await konteksti();

  const poydat = z.array(SijaintiSchema).max(200).safeParse(input.tables);
  const kalusteet = z.array(KalusteSchema).max(200).safeParse(input.elements);

  if (!poydat.success || !kalusteet.success) {
    return { error: t.varausAsetus.errFields };
  }

  const alue =
    input.areaId === null
      ? null
      : z.string().uuid().safeParse(input.areaId).success
        ? input.areaId
        : null;

  if (poydat.data.length > 0) {
    const { error } = await supabase.rpc("save_table_positions", {
      p_restaurant: restaurant.id,
      p_positions: poydat.data,
    });

    if (error) return { error: t.varausAsetus.errFields };
  }

  /*
   * Kalusteet tallennetaan aina, myös tyhjänä.
   *
   * Tyhjä lista tarkoittaa "tältä alueelta poistettiin kaikki", ja se
   * on yhtä lailla muutos kuin lisäys. Ohitus tyhjällä listalla
   * tekisi viimeisen kalusteen poistamisesta mahdotonta.
   */
  const { error: kalusteVirhe } = await supabase.rpc("save_floor_elements", {
    p_restaurant: restaurant.id,
    p_area: alue,
    p_elements: kalusteet.data,
  });

  if (kalusteVirhe) return { error: t.varausAsetus.errFields };

  revalidate();
  return { notice: t.poytakartta.saved };
}
