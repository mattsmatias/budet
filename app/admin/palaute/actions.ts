"use server";

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { isFeedbackKind } from "@/lib/restoflow/feedback";
import type { AdminState } from "../actions";

/**
 * Ilmoitus kehittäjille.
 *
 * YRITYS JA KÄYTTÄJÄ EIVÄT TULE LOMAKKEELTA.
 *
 * Ne luetaan istunnosta. Lomakkeelta tullut yritystunnus olisi
 * asiakkaan syöte, ja silloin ilmoituksen voisi lähettää toisen
 * nimissä. Kanta tarkistaa saman uudelleen: rivikäytäntö vaatii että
 * yritys on omien joukossa ja että lähettäjä on kirjautunut käyttäjä.
 *
 * POLKU TULEE PALVELIMELTA SIINÄ MIELESSÄ ETTÄ SE TARKISTETAAN.
 *
 * Selain kertoo mistä näkymästä ilmoitus lähti, koska vain se tietää
 * sen. Arvo kuitenkin rajataan omaan sovellukseen ja katkaistaan:
 * kentästä ei saa tulla paikkaa johon kirjoitetaan mitä tahansa.
 */
export async function sendFeedback(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, user } = await requireContext("/admin/palaute");

  const kindRaw = String(formData.get("kind") ?? "");
  const kind = isFeedbackKind(kindRaw) ? kindRaw : "contact";

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  /*
   * Sama alaraja kuin kannassa.
   *
   * "ei toimi" on kolme sanaa joista ei voi aloittaa mitään. Raja on
   * kannassa check-ehtona, ja tässä siksi että virheestä saa
   * ymmärrettävän lauseen eikä kannan poikkeusta.
   */
  if (title.length < 3 || body.length < 10) {
    return { error: t.palaute.tooShort };
  }

  const path = siivoaPolku(String(formData.get("path") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    restaurant_id: restaurant.id,
    created_by: user.id,
    kind,
    title: title.slice(0, 120),
    body: body.slice(0, 4000),
    path,
  });

  if (error) return { error: t.palaute.failed };

  revalidatePath("/admin/palaute");

  return { notice: t.palaute.sent };
}

/**
 * Polku kelpaa vain jos se on oman sovelluksen sisäinen.
 *
 * Kelvoton arvo jätetään pois eikä torjuta koko lähetystä: ilmoitus on
 * arvokkaampi kuin sen mukana tullut vihje siitä mistä se lähti.
 */
function siivoaPolku(arvo: string): string | null {
  const polku = arvo.trim();
  if (!polku.startsWith("/") || polku.startsWith("//")) return null;
  return polku.slice(0, 300);
}
