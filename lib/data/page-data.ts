/**
 * Yhteinen dokumenttien lataus sivuille.
 *
 * Sama sääntö kaikkialla: kirjautunut näkee oman datansa tai tyhjän,
 * kirjautumaton demon. Ilman tätä jokainen sivu toistaisi ehdon ja
 * yksikin unohdus vuotaisi demolukuja kirjautuneelle.
 */

import type { AppMode } from "@/lib/auth";
import {
  demoDocuments,
  emptyDocuments,
  listDocuments,
  type DataResult,
  type DocumentView,
} from "./documents";

export async function loadDocuments(
  mode: AppMode,
): Promise<DataResult<DocumentView[]>> {
  if (mode.kind === "live") return listDocuments(mode.org.id);
  if (mode.kind === "demo") return demoDocuments();
  return emptyDocuments();
}
