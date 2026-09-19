"use server";

/**
 * Yhteydenottopyynnön lähetys.
 *
 * Validointi on kannassa (submit_contact_request): pakolliset kentät,
 * sähköpostin muoto ja määrärajoitus. Tämä vain kokoaa lomakkeen,
 * suodattaa botit piilokentällä ja kääntää kannan virhekoodin
 * lomakkeen tilaksi. Käännetty teksti valitaan lomakkeessa.
 */

import { createClient } from "@/utils/supabase/server";

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; code: "required" | "email" | "rate" | "generic" };

export async function submitContact(
  _previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  const text = (key: string) => String(form.get(key) ?? "").trim();

  /*
   * Piilokenttä: ihminen ei näe sitä eikä täytä, botti täyttää kaiken.
   * Botille vastataan kuin lähetys olisi onnistunut, jotta se ei opi
   * kiertämään estoa.
   */
  if (text("website") !== "") return { status: "sent" };

  const name = text("name");
  const restaurant = text("restaurant");
  const email = text("email");

  if (!name || !restaurant || !email) {
    return { status: "error", code: "required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_request", {
    p_name: name.slice(0, 120),
    p_restaurant: restaurant.slice(0, 160),
    p_email: email.slice(0, 200),
    p_phone: text("phone").slice(0, 40) || null,
    p_message: text("message").slice(0, 2000) || null,
    p_locale: text("locale").slice(0, 5) || "fi",
  });

  if (error) {
    const code = error.message.trim();
    if (code === "required" || code === "email" || code === "rate") {
      return { status: "error", code };
    }
    return { status: "error", code: "generic" };
  }

  return { status: "sent" };
}
