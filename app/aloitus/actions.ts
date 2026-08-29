"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_RESTAURANT_COOKIE } from "@/lib/restoflow/session";

export interface SetupState {
  error?: string;
}

const schema = z.object({
  name: z.string().trim().min(1, "Ravintolan nimi puuttuu.").max(160),
  timezone: z.string().trim().max(64),
});

/**
 * Perustaa ravintolan.
 *
 * Ravintola ja omistajajäsenyys syntyvät yhdessä tietokantafunktiossa,
 * jottei käyttäjä voi jäädä tilaan jossa ravintola on olemassa mutta hän ei
 * ole sen jäsen — silloin RLS estäisi häntä näkemästä omaa ravintolaansa.
 */
export async function createRestaurant(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || "Europe/Helsinki",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_restaurant", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
  });

  if (error || !data) return { error: explain(error) };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, data as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect("/admin");
}

/**
 * Kertoo mitä tapahtui ja mitä tehdä.
 *
 * Yleinen "yritä uudelleen" piilottaisi syyn, jolloin käyttäjä ei voi tehdä
 * mitään. Tuntematon virhe näytetään sellaisenaan — vaikeaselkoinen viesti
 * on silti parempi kuin hyödytön.
 */
function explain(error: { code?: string; message?: string } | null): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return (
      "Tietokannan rakenteet puuttuvat. Aja migraatiot " +
      "supabase/migrations-hakemistosta ennen kuin jatkat."
    );
  }
  if (message.includes("Kirjautuminen vaaditaan")) {
    return "Istunto on vanhentunut. Kirjaudu uudelleen sisään.";
  }
  if (code === "23503" || message.includes("foreign key")) {
    return "Käyttäjäprofiiliasi ei löydy. Kirjaudu ulos ja takaisin sisään.";
  }

  return message
    ? `Ravintolan luonti epäonnistui: ${message}`
    : "Ravintolan luonti epäonnistui tuntemattomasta syystä.";
}
