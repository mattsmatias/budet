import type { IconName } from "@/components/restoflow/icons";
import type { AlertKind } from "./types";

/**
 * Huomion ikoni sen aiheesta, ei vakavuudesta.
 *
 * Vakavuus näkyy jo kahdesti: rivin vasemmassa reunassa värillisenä
 * palkkina ja ikonin värissä. Kolmas kerta ei kerro mitään uutta —
 * kolme huutomerkkiä allekkain on kolme samanlaista riviä, ja silmä
 * joutuu lukemaan jokaisen otsikon selvittääkseen mistä on kyse.
 *
 * Aihe sen sijaan on juuri se mitä silmä etsii: onko tämä kuitti,
 * vuoro vai budjetti. Sama muoto kuin valikossa, joten rivi ja sen
 * kohde tunnistuvat samasta merkistä.
 *
 * Taulukko on täydellinen eikä sillä ole oletusarvoa: uusi
 * huomiotyyppi ei käänny ennen kuin joku on päättänyt mikä se on.
 */
const ICONS: Record<AlertKind, IconName> = {
  duplicate_receipt: "receipt",
  receipt_needs_review: "receipt",
  missing_payment_method: "receipt",
  receipt_gap: "receipt",

  vat_mismatch: "report",

  budget_warning: "budget",
  budget_exceeded: "budget",

  supplier_spike: "trend",
  sales_shortfall: "trend",

  // Vuoro on kalenterissa, leimaus kellossa. Ero on siinä kumpaa
  // katsotaan: suunnitelmaa vai sitä mitä oikeasti tapahtui.
  open_shift: "calendar",
  unassigned_shift: "calendar",
  absence_reported: "staff",

  late_clock_in: "clock",
  shift_overrun: "clock",
  unclosed_shift: "clock",
  shift_variance: "clock",
};

export function alertIcon(kind: AlertKind): IconName {
  return ICONS[kind];
}

/** Kaikki tunnetut tyypit — testiä varten. */
export const ALERT_KINDS = Object.keys(ICONS) as AlertKind[];
