/**
 * Varausten kyselyt.
 *
 * Erillään reservations.ts:stä, koska sitä tuovat myös
 * klientkomponentit: salinäkymän lomake tarvitsee tyypit ja
 * nextStatuses-funktion. Jos palvelimen Supabase-asiakas olisi samassa
 * moduulissa, se vedettäisiin selainnippuun mukana — ja käännös
 * kaatuisi siihen että next/headers ei toimi selaimessa.
 *
 * Sama jako kuin lunch.ts:n ja queries.ts:n välillä: laskenta erikseen,
 * haut erikseen.
 */

import { createClient } from "@/utils/supabase/server";
import type { FloorElement } from "./floor-plan";
import type {
  ReservationDay,
  ReservationSetup,
  RestaurantTable,
} from "./reservations";
import { DEFAULT_SETTINGS } from "./reservations";

/**
 * Päivän varaukset ja salin pöydät.
 *
 * Kutsuu kannan funktiota eikä tauluja: funktio karsii yhteystiedot
 * kutsujan roolin mukaan. Suora taulukysely palauttaisi joko kaiken tai
 * ei mitään, koska rivitason käytäntö ei osaa piilottaa saraketta.
 */
export async function loadReservationDay(
  restaurantId: string,
  date: string,
): Promise<ReservationDay | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reservation_day", {
    p_restaurant: restaurantId,
    p_date: date,
  });

  if (error || !data) return null;
  return data as unknown as ReservationDay;
}

/** Vapaat ajat annetulle päivälle ja seurueen koolle. */
export async function loadAdminSlots(
  restaurantId: string,
  date: string,
  partySize: number,
  excludeReservationId?: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reservation_admin_slots", {
    p_restaurant: restaurantId,
    p_date: date,
    p_party: partySize,
    p_exclude: excludeReservationId ?? null,
  });

  if (error || !data) return [];
  return ((data as { slots?: string[] }).slots ?? []) as string[];
}

export interface FreeTable {
  id: string;
  name: string;
  seatsMin: number;
  seatsMax: number;
  /** Mahtuuko seurue tähän pöytään? Ei estä valintaa, vaan varoittaa. */
  fits: boolean;
}

/** Pöydät jotka ovat vapaana juuri tämän varauksen aikana. */
export async function loadFreeTables(
  reservationId: string,
): Promise<FreeTable[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reservation_free_tables", {
    p_reservation: reservationId,
  });

  if (error || !data) return [];
  return data as unknown as FreeTable[];
}

/**
 * Kaikki mitä varausasetusten sivu näyttää.
 *
 * Suoraa taulukyselyä eikä funktiota: nämä ovat esihenkilön omaa
 * aineistoa eikä niissä ole mitään karsittavaa. Rivitason käytäntö
 * hoitaa rajauksen, ja seitsemän kyselyä rinnakkain on nopeampi kuin
 * yksi funktio joka rakentaa saman JSON:n.
 */
export async function loadReservationSetup(
  restaurantId: string,
): Promise<ReservationSetup> {
  const supabase = await createClient();

  const [
    settings,
    hours,
    durations,
    exceptions,
    areas,
    tables,
    combinations,
    elements,
  ] = await Promise.all([
    supabase
      .from("reservation_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    supabase
      .from("reservation_hours")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("weekday")
      .order("opens"),
    supabase
      .from("reservation_durations")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("min_party"),
    supabase
      .from("reservation_exceptions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("exception_date", new Date().toISOString().slice(0, 10))
      .order("exception_date"),
    supabase
      .from("dining_areas")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("table_combinations")
      .select("*, table_combination_members(table_id)")
      .eq("restaurant_id", restaurantId)
      .order("seats_max"),
    supabase
      .from("floor_elements")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
  ]);

  const s = settings.data as Record<string, unknown> | null;

  return {
    settings: s
      ? {
          enabled: Boolean(s.enabled),
          slotMinutes: Number(s.slot_minutes),
          defaultDurationMinutes: Number(s.default_duration_minutes),
          turnaroundMinutes: Number(s.turnaround_minutes),
          minParty: Number(s.min_party),
          maxParty: Number(s.max_party),
          maxDaysAhead: Number(s.max_days_ahead),
          leadMinutes: Number(s.lead_minutes),
          kitchenCapacity:
            s.kitchen_capacity === null || s.kitchen_capacity === undefined
              ? null
              : Number(s.kitchen_capacity),
          kitchenWindowMinutes: Number(s.kitchen_window_minutes ?? 60),
          themeColor: String(s.theme_color),
          themeDark: Boolean(s.theme_dark),
          themeRadius: Number(s.theme_radius),
        }
      : DEFAULT_SETTINGS,

    hours: (hours.data ?? []).map((row) => ({
      id: String(row.id),
      weekday: Number(row.weekday),
      /* time-sarake tulee muodossa HH:MM:SS; lomake haluaa HH:MM. */
      opens: String(row.opens).slice(0, 5),
      lastSeating: String(row.last_seating).slice(0, 5),
    })),

    durations: (durations.data ?? []).map((row) => ({
      id: String(row.id),
      minParty: Number(row.min_party),
      maxParty: row.max_party === null ? null : Number(row.max_party),
      minutes: Number(row.minutes),
    })),

    exceptions: (exceptions.data ?? []).map((row) => ({
      id: String(row.id),
      date: String(row.exception_date),
      closed: Boolean(row.closed),
      opens: row.opens ? String(row.opens).slice(0, 5) : null,
      lastSeating: row.last_seating
        ? String(row.last_seating).slice(0, 5)
        : null,
      note: row.note === null ? null : String(row.note),
    })),

    areas: (areas.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
    })),

    tables: (tables.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      areaId: row.area_id === null ? null : String(row.area_id),
      seatsMin: Number(row.seats_min),
      seatsMax: Number(row.seats_max),
      active: Boolean(row.active),
      posX: row.pos_x === null ? null : Number(row.pos_x),
      posY: row.pos_y === null ? null : Number(row.pos_y),
      shape: (row.shape ?? "round") as RestaurantTable["shape"],
      rotation: Number(row.rotation ?? 0),
      width:
        row.width === null || row.width === undefined
          ? null
          : Number(row.width),
    })),

    elements: (elements.data ?? []).map((row) => ({
      id: String(row.id),
      areaId: row.area_id === null ? null : String(row.area_id),
      kind: row.kind as FloorElement["kind"],
      label: String(row.label ?? ""),
      posX: Number(row.pos_x),
      posY: Number(row.pos_y),
      width: Number(row.width),
      height: Number(row.height),
      rotation: Number(row.rotation ?? 0),
    })),

    combinations: (combinations.data ?? []).map((row) => ({
      id: String(row.id),
      name: row.name === null ? null : String(row.name),
      seatsMin: Number(row.seats_min),
      seatsMax: Number(row.seats_max),
      active: Boolean(row.active),
      tableIds: (
        (row.table_combination_members ?? []) as { table_id: string }[]
      ).map((member) => member.table_id),
    })),
  };
}
