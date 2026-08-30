"use server";

/**
 * Varauksen peruutus linkillä.
 *
 * Ei kirjautumista: tunnus on se todiste jonka asiakas sai varatessaan.
 * Kannassa on vain tunnuksen tiiviste, joten vuotanut varmuuskopio ei
 * anna kenellekään oikeutta perua toisen varausta.
 *
 * Tarkistukset ovat kannan funktiossa — onko tunnus olemassa, onko
 * varaus jo peruttu, onko ajankohta mennyt. Tämä välittää tuloksen.
 */

import { revalidatePath } from "next/cache";
import { cancelPublicReservation } from "@/lib/restoflow/public-reservations";

export interface CancelState {
  error?: string;
  done?: boolean;
}

export async function cancelReservation(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");

  /* Tunnus on kaksi uuid:ta heksana. Muun mittainen ei ole tunnus. */
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "not_found" };

  const result = await cancelPublicReservation(token);

  if (!result.ok) return { error: result.error ?? "unknown" };

  revalidatePath(`/varaus/${token}`);
  return { done: true };
}
