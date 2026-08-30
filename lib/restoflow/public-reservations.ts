/**
 * Julkisen varauksen aineisto.
 *
 * Kaikki kulkee neljän security definer -funktion kautta. Asiakkaan
 * selain ei kosketa tauluihin — ei siksi että rivitason käytännöt
 * pettäisivät, vaan koska julkisen pinnan on oltava luettavissa
 * kokonaan yhdeltä sivulta. Neljä funktiota voi lukea; yhdentoista
 * taulun käytännöt eivät.
 *
 * Ravintola tunnistetaan slugista eikä tunnisteesta. Selaimen
 * lähettämä restaurant_id olisi selaimen valitsema, ja slug on
 * julkinen osoite joka on jo verkkosivun linkissä.
 */

import { createClient } from "@/utils/supabase/server";

export interface ReservationTheme {
  color: string;
  dark: boolean;
  radius: number;
}

export interface PublicReservationConfig {
  restaurantName: string;
  enabled: boolean;
  timezone?: string;
  minParty?: number;
  maxParty?: number;
  maxDaysAhead?: number;
  /** Tämä päivä ravintolan vyöhykkeellä, ei selaimen. */
  today?: string;
  theme?: ReservationTheme;
}

export async function loadReservationConfig(
  slug: string,
): Promise<PublicReservationConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_reservation_config", {
    p_slug: slug,
  });

  if (error || !data) return null;
  return data as unknown as PublicReservationConfig;
}

export async function loadPublicSlots(
  slug: string,
  date: string,
  partySize: number,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_reservation_slots", {
    p_slug: slug,
    p_date: date,
    p_party: partySize,
  });

  if (error || !data) return [];
  return ((data as { slots?: string[] }).slots ?? []) as string[];
}

export interface CreateResult {
  ok: boolean;
  error?: string;
  cancelToken?: string;
  restaurantName?: string;
  date?: string;
  time?: string;
  partySize?: number;
  tables?: string[];
}

export interface CreateInput {
  slug: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email?: string | null;
  note?: string | null;
}

export async function createPublicReservation(
  input: CreateInput,
): Promise<CreateResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_create_reservation", {
    p_slug: input.slug,
    p_date: input.date,
    p_time: input.time,
    p_party: input.partySize,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_note: input.note ?? null,
  });

  if (error || !data) return { ok: false, error: "unknown" };
  return data as unknown as CreateResult;
}

export interface ReservationLookup {
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  status: string;
  cancellable: boolean;
}

export async function lookupReservation(
  token: string,
): Promise<ReservationLookup | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_reservation_lookup", {
    p_token: token,
  });

  if (error || !data) return null;
  return data as unknown as ReservationLookup;
}

export interface CancelResult {
  ok: boolean;
  error?: string;
  restaurantName?: string;
  date?: string;
  time?: string;
  partySize?: number;
}

export async function cancelPublicReservation(
  token: string,
): Promise<CancelResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_cancel_reservation", {
    p_token: token,
  });

  if (error || !data) return { ok: false, error: "unknown" };
  return data as unknown as CancelResult;
}
