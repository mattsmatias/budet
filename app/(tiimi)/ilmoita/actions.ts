"use server";

/**
 * Työntekijän ilmoitus kiinnostuneesta yrityksestä.
 *
 * OIKEUS TARKISTETAAN KANNASSA.
 *
 * submit_referral kysyy itse onko kutsuja Katen työntekijä ja hylkää
 * kutsun jos ei ole. requireKateStaff on tässä siksi, että kirjautunut
 * saa selvän ohjauksen sen sijaan että lomake palauttaisi kantavirheen
 * — ei siksi että se suojaisi mitään.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireKateStaff } from "@/lib/restoflow/session";

export interface IlmoitusState {
  error?: string;
  /** Ilmoitettu yritys: näytetään kuittauksessa nimeltä. */
  done?: string;
  /** Uuden rivin tunniste. Lomake tyhjennetään kun tämä vaihtuu. */
  id?: string;
}

const skeema = z.object({
  restaurant: z.string().trim().min(1, "Kirjoita yrityksen nimi.").max(160),
  name: z.string().trim().min(1, "Kirjoita yhteyshenkilön nimi.").max(120),
  email: z.string().trim().toLowerCase().email("Tarkista sähköpostiosoite."),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
});

/**
 * Kantavirhe luettavaksi.
 *
 * Funktio nostaa lyhyen tunnisteen, koska sama funktio palvelee myös
 * muita kutsujia. Käännös tehdään tässä, yhdessä paikassa.
 */
function virhe(message: string): string {
  if (message.includes("duplicate")) {
    return "Sama yritys ilmoitettiin juuri äsken. Tarkista omat ilmoituksesi alta.";
  }
  if (message.includes("email")) return "Tarkista sähköpostiosoite.";
  if (message.includes("required")) return "Täytä yritys, yhteyshenkilö ja sähköposti.";
  if (message.includes("Vain Katen tyontekija")) {
    return "Tunnuksellasi ei ole oikeutta ilmoittaa yrityksiä.";
  }
  return message;
}

export async function submitReferral(
  _prev: IlmoitusState,
  data: FormData,
): Promise<IlmoitusState> {
  await requireKateStaff("/ilmoita");

  const parsed = skeema.safeParse({
    restaurant: data.get("restaurant"),
    name: data.get("name"),
    email: data.get("email"),
    phone: data.get("phone") ?? undefined,
    message: data.get("message") ?? undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("submit_referral", {
    p_restaurant: parsed.data.restaurant,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone ?? null,
    p_message: parsed.data.message ?? null,
  });

  if (error) return { error: virhe(error.message) };

  /*
   * Molemmat listat päivittyvät.
   *
   * Työntekijän oma lista on tällä sivulla ja konsolin lista on
   * toisen käyttäjän sivulla — layout-tason mitätöinti kattaa
   * molemmat ilman että tässä pitää luetella polkuja.
   */
  revalidatePath("/", "layout");

  return {
    done: parsed.data.restaurant,
    id: typeof id === "string" ? id : undefined,
  };
}
