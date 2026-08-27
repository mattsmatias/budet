"use server";

/**
 * Kirjanpidon kirjoitustoiminnot.
 *
 * KAIKKI KULKEE KANNAN FUNKTION KAUTTA.
 *
 * Yksikään näistä ei kirjoita tauluun suoraan. Tasapaino, lukitus,
 * täsmäytys ja jäljitettävyys ovat kannassa, ja suora insert ohittaisi
 * ne kaikki. Palvelintoiminto on tässä kuori joka tarkistaa syötteen
 * muodon ja kääntää virheen suomeksi.
 *
 * OIKEUS TARKISTETAAN KAHDESTI.
 *
 * Täällä siksi, että käyttäjä saa kunnollisen viestin. Kannassa siksi,
 * että tämä tiedosto ei ole ainoa tie sinne.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import type { AdminState } from "../actions";

const PATH = "/admin/kirjanpito";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Yhteinen alkutarkistus.
 *
 * Palauttaa joko virheen tai kontekstin. Jokainen toiminto alkaa
 * samalla kolmella tarkistuksella, ja kolmesti kopioituna yksi niistä
 * ehtisi ajautua muista erilleen.
 */
async function vaadiOikeus() {
  const ctx = await requireContext(PATH);
  if (!can(ctx.role, "accounting.manage")) {
    return { error: "Sinulla ei ole oikeutta kirjata kirjanpitoa." as const };
  }
  return { ctx };
}

function kuukausiKentasta(formData: FormData): string | null {
  const raw = String(formData.get("kuukausi") ?? "");
  return ISO_MONTH.test(raw) ? raw : null;
}

/**
 * Muodosta kuukauden kirjausesitykset lähteistä.
 *
 * Idempotentti: kanta tarkistaa jokaisen lähteen ennen kirjausta.
 * Painikkeen voi painaa niin monta kertaa kuin haluaa.
 */
export async function syncMonth(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const guard = await vaadiOikeus();
  if ("error" in guard) return guard;

  const month = kuukausiKentasta(formData);
  if (!month) return { error: "Kuukausi puuttuu." };

  const supabase = await createClient();

  // Tilikartta on oltava ennen kuin mitään voi kohdistaa. Kutsu on
  // idempotentti, joten sen voi tehdä joka kerta.
  await supabase.rpc("ledger_seed", { p_restaurant: guard.ctx.restaurant.id });

  const { data, error } = await supabase.rpc("ledger_sync_month", {
    p_restaurant: guard.ctx.restaurant.id,
    p_month: `${month}-01`,
  });

  if (error) return { error: error.message };

  const tulos = (data ?? {}) as {
    locked?: boolean;
    message?: string;
    receipts?: number;
    salesDays?: number;
    skipped?: unknown[];
  };

  if (tulos.locked) return { error: tulos.message ?? "Kuukausi on suljettu." };

  revalidatePath(PATH, "layout");

  const luotu = (tulos.receipts ?? 0) + (tulos.salesDays ?? 0);
  const ohi = tulos.skipped?.length ?? 0;

  if (luotu === 0 && ohi === 0) {
    return { notice: "Kaikki kuukauden tapahtumat ovat jo kirjanpidossa." };
  }

  return {
    notice:
      `${luotu} ${luotu === 1 ? "kirjausesitys" : "kirjausesitystä"} muodostettu` +
      (ohi > 0 ? ` · ${ohi} ohitettu` : ""),
  };
}

/** Hyväksy yksi kirjausesitys. */
export async function postEntry(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const guard = await vaadiOikeus();
  if ("error" in guard) return guard;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Tositetta ei löydy." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ledger_post", { p_entry: id });
  if (error) return { error: error.message };

  revalidatePath(PATH, "layout");
  return { notice: "Tosite kirjattu." };
}

/**
 * Hyväksy kaikki kuukauden esitykset kerralla.
 *
 * Yksi kerrallaan olisi sata klikkausta kuukaudessa. Kanta tarkistaa
 * jokaisen erikseen, joten joukkohyväksyntä ei ohita mitään —
 * se vain säästää klikkaukset.
 */
export async function postAll(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const guard = await vaadiOikeus();
  if ("error" in guard) return guard;

  const month = kuukausiKentasta(formData);
  if (!month) return { error: "Kuukausi puuttuu." };

  const supabase = await createClient();

  const { data: rows, error: haku } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("restaurant_id", guard.ctx.restaurant.id)
    .eq("status", "proposed")
    .gte("entry_date", `${month}-01`)
    .lte("entry_date", `${month}-31`);

  if (haku) return { error: haku.message };
  if (!rows || rows.length === 0) {
    return { notice: "Ei hyväksyttäviä kirjausesityksiä." };
  }

  let kirjattu = 0;
  for (const row of rows) {
    const { error } = await supabase.rpc("ledger_post", { p_entry: row.id });
    if (error) return { error: `${kirjattu} kirjattu, sitten: ${error.message}` };
    kirjattu += 1;
  }

  revalidatePath(PATH, "layout");
  return {
    notice: `${kirjattu} ${kirjattu === 1 ? "tosite" : "tositetta"} kirjattu.`,
  };
}

/** Hylkää kirjausesitys. Se jää näkyviin, jotta sama lähde ei ehdota itseään uudelleen. */
export async function rejectEntry(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const guard = await vaadiOikeus();
  if ("error" in guard) return guard;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Tositetta ei löydy." };

  const syy = String(formData.get("syy") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("ledger_reject", {
    p_entry: id,
    p_reason: syy || null,
  });
  if (error) return { error: error.message };

  revalidatePath(PATH, "layout");
  return { notice: "Kirjausesitys hylätty." };
}

/** Tee korjaustosite. Alkuperäinen säilyy. */
export async function correctEntry(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const guard = await vaadiOikeus();
  if ("error" in guard) return guard;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Tositetta ei löydy." };

  const syy = String(formData.get("syy") ?? "").trim();
  if (syy === "") return { error: "Korjaukselle on annettava syy." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ledger_correct", {
    p_entry: id,
    p_reason: syy,
  });
  if (error) return { error: error.message };

  revalidatePath(PATH, "layout");
  return { notice: "Korjaustosite muodostettu. Se odottaa hyväksyntää." };
}

/**
 * Sulje kuukausi.
 *
 * Kanta kieltäytyy jos täsmäytys ei mene läpi tai esityksiä on
 * hyväksymättä. Se palauttaa syyn eikä virhettä, joten se näytetään
 * sellaisenaan.
 */
export async function closeMonth(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const ctx = await requireContext(PATH);

  // Sulkeminen on omistajan oikeus, ei esihenkilön.
  if (ctx.role !== "owner") {
    return { error: "Vain omistaja voi sulkea kirjanpidon kuukauden." };
  }

  const month = kuukausiKentasta(formData);
  if (!month) return { error: "Kuukausi puuttuu." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ledger_close_month", {
    p_restaurant: ctx.restaurant.id,
    p_month: `${month}-01`,
    p_note: String(formData.get("merkinta") ?? "").trim() || null,
  });

  if (error) return { error: error.message };

  const tulos = (data ?? {}) as { closed?: boolean; reason?: string };
  if (!tulos.closed) {
    return { error: tulos.reason ?? "Kuukautta ei voitu sulkea." };
  }

  revalidatePath(PATH, "layout");
  return { notice: "Kuukausi suljettu." };
}
