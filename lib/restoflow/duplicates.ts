/**
 * Kaksoiskappaleiden tunnistus.
 *
 * Sama kuitti päätyy järjestelmään kahdesti helposti: työntekijä kuvaa sen
 * illalla ja manageri lisää saman laskun aamulla. Ilman tunnistusta kulut
 * näyttävät suuremmilta kuin ovat, eikä virhettä huomaa mistään.
 *
 * Tunnistus on tarkoituksella varovainen: se EHDOTTAA kaksoiskappaletta,
 * ei poista mitään. Kaksi samansuuruista ostosta samalta toimittajalta
 * samana päivänä on täysin mahdollista.
 */

import type { Receipt } from "./types";
import type { AdminText } from "@/lib/i18n/admin-text";

/** Kuinka monen päivän sisällä samat summat tulkitaan epäilyttäviksi. */
const DAY_WINDOW = 1;

/** Sentin heitto — sama kuitti voi poimia hieman eri summan. */
const AMOUNT_TOLERANCE_CENTS = 2;

export interface DuplicateGroup {
  /** Kaikki ryhmän kuitit, vanhin ensin. */
  receipts: Receipt[];
  supplierName: string;
  totalCents: number;
  /** Miksi nämä tulkittiin samaksi. */
  reason: string;
}

/**
 * Etsii mahdolliset kaksoiskappaleet.
 *
 * Kriteeri: sama toimittaja, sama summa sentin tarkkuudella, päivämäärät
 * enintään päivän päässä toisistaan. Kuittinumero kumoaa epäilyn jos
 * molemmilla on numero ja ne eroavat — silloin kyse on eri tositteista.
 */
export function findDuplicates(
  receipts: Receipt[],
  t: AdminText,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const claimed = new Set<string>();

  const sorted = [...receipts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i];
    if (claimed.has(a.id)) continue;

    const matches: Receipt[] = [];

    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j];
      if (claimed.has(b.id)) continue;
      if (!looksLikeSame(a, b)) continue;
      matches.push(b);
    }

    if (matches.length > 0) {
      const all = [a, ...matches];
      all.forEach((r) => claimed.add(r.id));
      groups.push({
        receipts: all,
        supplierName: a.supplierName,
        totalCents: a.totalCents,
        reason: describeReason(a, matches[0], t),
      });
    }
  }

  return groups;
}

function looksLikeSame(a: Receipt, b: Receipt): boolean {
  if (a.supplierId !== b.supplierId) return false;
  if (Math.abs(a.totalCents - b.totalCents) > AMOUNT_TOLERANCE_CENTS)
    return false;
  if (daysApart(a.date, b.date) > DAY_WINDOW) return false;

  // Eri kuittinumerot todistavat eri tositteet.
  if (
    a.receiptNumber &&
    b.receiptNumber &&
    a.receiptNumber !== b.receiptNumber
  ) {
    return false;
  }

  return true;
}

function describeReason(a: Receipt, b: Receipt, t: AdminText): string {
  const parts = [t.havaintoDup.sameSupplier, t.havaintoDup.sameAmount];
  parts.push(
    a.date === b.date ? t.havainto.sameDay : t.havainto.consecutiveDays,
  );
  if (a.receiptNumber && a.receiptNumber === b.receiptNumber) {
    parts.push(t.havaintoDup.sameReceiptNumber);
  }
  return parts.join(" · ");
}

export function daysApart(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86400000;
}

/** Kuittien tunnisteet jotka kuuluvat johonkin epäiltyyn ryhmään. */
export function duplicateIds(receipts: Receipt[], t: AdminText): Set<string> {
  const ids = new Set<string>();
  for (const group of findDuplicates(receipts, t)) {
    for (const receipt of group.receipts) ids.add(receipt.id);
  }
  return ids;
}
