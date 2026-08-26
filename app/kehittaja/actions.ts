"use server";

/**
 * Developer Consolen toiminnot.
 *
 * OIKEUS TARKISTETAAN KANNASSA, EI TÄÄLLÄ.
 *
 * Jokainen sa_-funktio kysyy current_user_is_super_admin() itse ja
 * hylkää kutsun jos vastaus on ei. Nämä actionit validoivat syötteen
 * ja kääntävät virheen luettavaksi. Jos tänne lisäisi oman
 * roolitarkistuksen, sääntö olisi kahdessa paikassa ja niistä toinen
 * ehtisi vanhentua.
 *
 * requireSuperAdmin on silti mukana: se estää turhan verkkokierroksen
 * ja antaa selvän ohjauksen sen sijaan että lomake palauttaisi
 * kryptisen kantavirheen.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireSuperAdmin } from "@/lib/restoflow/session";

export interface DevState {
  error?: string;
  notice?: string;
  /** Kutsukoodi näytetään kerran — kannassa on vain tiiviste. */
  code?: string;
  /** Luodun ravintolan tunniste, jotta käyttöliittymä voi avata sen. */
  restaurantId?: string;
}

/** Tyhjä merkkijono on "ei arvoa", ei arvo. */
function teksti(data: FormData, name: string): string | null {
  const raw = String(data.get(name) ?? "").trim();
  return raw === "" ? null : raw;
}

/**
 * Kantavirhe luettavaksi.
 *
 * Postgresin viesti kertoo tarkalleen mikä meni pieleen, mutta se
 * kertoo sen myös rakenteesta. Tunnetut tapaukset käännetään; muut
 * näytetään sellaisenaan, koska väärä arvaus olisi pahempi kuin
 * tekninen teksti.
 */
function virhe(message: string): string {
  if (message.includes("restaurants_business_id_muoto")) {
    return "Y-tunnuksen muoto on 1234567-8.";
  }
  if (message.includes("restaurants_trial_paattyy")) {
    return "Kokeilulle on annettava kesto.";
  }
  if (message.includes("Vain jarjestelman yllapitaja")) {
    return "Toiminto vaatii järjestelmän ylläpitäjän oikeudet.";
  }
  if (message.includes("Vahvistus ei tasmaa")) {
    return "Kirjoitettu nimi ei täsmää ravintolan nimeen.";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Ravintola
// ---------------------------------------------------------------------------

export async function createRestaurant(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const name = teksti(data, "name");
  if (!name) return { error: "Ravintolan nimi puuttuu." };

  const status = String(data.get("status") ?? "active");
  const trialDays = Number(data.get("trialDays") ?? 14);

  const supabase = await createClient();

  const { data: created, error } = await supabase.rpc("sa_create_restaurant", {
    p_name: name,
    p_timezone: teksti(data, "timezone") ?? "Europe/Helsinki",
    p_legal_name: teksti(data, "legalName"),
    p_business_id: teksti(data, "businessId"),
    p_address: teksti(data, "address"),
    p_postal_code: teksti(data, "postalCode"),
    p_city: teksti(data, "city"),
    p_phone: teksti(data, "phone"),
    p_email: teksti(data, "email"),
    p_website: teksti(data, "website"),
    p_industry: teksti(data, "industry"),
    p_plan: String(data.get("plan") ?? "free"),
    p_status: status,
    p_trial_days: status === "trial" ? (Number.isFinite(trialDays) ? trialDays : 14) : null,
    p_is_test: data.get("isTest") === "on",
  });

  if (error) return { error: virhe(error.message) };

  const id = (created as { id?: string } | null)?.id;
  if (!id) return { error: "Ravintolan luonti ei palauttanut tunnistetta." };

  /*
   * Omistajan kutsu heti luonnin yhteydessä.
   *
   * Ravintola ilman omistajaa on tyhjä kuori jota kukaan ei pääse
   * käyttämään. Koodi palautetaan kerran; kannassa on vain tiiviste,
   * joten sitä ei voi hakea myöhemmin uudelleen.
   */
  const ownerLabel = teksti(data, "ownerName");
  const { data: code, error: inviteError } = await supabase.rpc("sa_invite_owner", {
    p_restaurant: id,
    p_role: "owner",
    p_label: ownerLabel,
  });

  revalidatePath("/kehittaja", "layout");

  if (inviteError) {
    return {
      restaurantId: id,
      notice: `Ravintola ${name} luotiin, mutta kutsun luonti epäonnistui: ${inviteError.message}`,
    };
  }

  return {
    restaurantId: id,
    code: typeof code === "string" ? code : undefined,
    notice: `Ravintola ${name} luotiin.`,
  };
}

export async function updateRestaurant(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const id = String(data.get("id") ?? "");
  if (id === "") return { error: "Ravintolaa ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_update_restaurant", {
    p_id: id,
    p_name: teksti(data, "name"),
    p_legal_name: teksti(data, "legalName"),
    p_business_id: teksti(data, "businessId"),
    p_address: teksti(data, "address"),
    p_postal_code: teksti(data, "postalCode"),
    p_city: teksti(data, "city"),
    p_phone: teksti(data, "phone"),
    p_email: teksti(data, "email"),
    p_website: teksti(data, "website"),
    p_industry: teksti(data, "industry"),
    p_timezone: teksti(data, "timezone"),
    p_is_test: data.get("isTest") === "on",
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Tiedot tallennettiin." };
}

export async function setStatus(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const id = String(data.get("id") ?? "");
  const status = String(data.get("status") ?? "");
  if (id === "" || status === "") return { error: "Tilaa ei tunnistettu." };

  const trialDays = Number(data.get("trialDays") ?? 14);

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_status", {
    p_id: id,
    p_status: status,
    p_trial_days: status === "trial" ? (Number.isFinite(trialDays) ? trialDays : 14) : null,
    p_note: teksti(data, "note"),
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Tila päivitettiin." };
}

export async function setPlan(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const id = String(data.get("id") ?? "");
  const plan = String(data.get("plan") ?? "");
  if (id === "" || plan === "") return { error: "Pakettia ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_plan", { p_id: id, p_plan: plan });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Paketti päivitettiin." };
}

/**
 * Pysyvä poisto.
 *
 * Vahvistus on ravintolan nimi kirjoitettuna. Kanta tarkistaa sen
 * uudelleen, joten selaimen ohittaminen ei auta.
 */
export async function deleteRestaurant(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const id = String(data.get("id") ?? "");
  const confirm = String(data.get("confirm") ?? "");
  if (id === "") return { error: "Ravintolaa ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_delete_restaurant", {
    p_id: id,
    p_confirm: confirm,
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  redirect("/kehittaja/ravintolat");
}

// ---------------------------------------------------------------------------
// Käyttäjät
// ---------------------------------------------------------------------------

export async function inviteUser(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const id = String(data.get("id") ?? "");
  if (id === "") return { error: "Ravintolaa ei tunnistettu." };

  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("sa_invite_owner", {
    p_restaurant: id,
    p_role: String(data.get("role") ?? "owner"),
    p_label: teksti(data, "label"),
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return {
    code: typeof code === "string" ? code : undefined,
    notice: "Kutsu luotiin.",
  };
}

export async function setMemberActive(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const membership = String(data.get("membership") ?? "");
  if (membership === "") return { error: "Käyttäjää ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_member_active", {
    p_membership: membership,
    p_active: data.get("active") === "true",
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: data.get("active") === "true" ? "Käyttäjä aktivoitiin." : "Käyttäjä poistettiin käytöstä." };
}

export async function setMemberRole(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const membership = String(data.get("membership") ?? "");
  const role = String(data.get("role") ?? "");
  if (membership === "" || role === "") return { error: "Roolia ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_member_role", {
    p_membership: membership,
    p_role: role,
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Rooli päivitettiin." };
}

// ---------------------------------------------------------------------------
// Feature flagit
// ---------------------------------------------------------------------------

export async function setFlag(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const key = String(data.get("key") ?? "");
  if (key === "") return { error: "Lippua ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_flag", {
    p_key: key,
    p_enabled: data.get("enabled") === "true",
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Lippu päivitettiin." };
}

/**
 * Ravintolakohtainen poikkeus.
 *
 * Kolme arvoa, ei kaksi: päälle, pois, tai takaisin oletukseen.
 * Ilman kolmatta poikkeuksen voisi luoda muttei poistaa, ja ravintola
 * jäisi pysyvästi irti globaalista asetuksesta.
 */
export async function setFlagFor(_prev: DevState, data: FormData): Promise<DevState> {
  await requireSuperAdmin();

  const key = String(data.get("key") ?? "");
  const restaurant = String(data.get("restaurant") ?? "");
  if (key === "" || restaurant === "") return { error: "Lippua ei tunnistettu." };

  const arvo = String(data.get("value") ?? "");
  const enabled = arvo === "oletus" ? null : arvo === "true";

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_flag_for", {
    p_key: key,
    p_restaurant: restaurant,
    p_enabled: enabled,
  });

  if (error) return { error: virhe(error.message) };

  revalidatePath("/kehittaja", "layout");
  return { notice: "Poikkeus päivitettiin." };
}
