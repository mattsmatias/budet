"use client";

import { useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";
import { deleteDailySales } from "./actions";

/**
 * Päivän merkinnän poisto.
 *
 * Toiminto on ollut olemassa mutta mitään ei kutsunut sitä: väärin
 * kirjattua päivää ei päässyt poistamaan mistään. Poiminnan myötä
 * väärä luku on todennäköisempi kuin ennen — malli voi lukea numeron
 * väärin, ja silloin päivä on korjattava tai poistettava.
 *
 * KAKSI PAINALLUSTA, EI DIALOGIA.
 *
 * Vahvistus tapahtuu samassa rivissä: ensimmäinen painallus paljastaa
 * "Poista", toinen tekee sen. Erillinen ikkuna keskeyttäisi
 * taulukon selaamisen, ja "oletko varma" -kysymykseen vastataan
 * lukematta.
 */
export function DeleteDay({ date, label }: { date: string; label: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Poista ${label}`}
        title={`Poista ${label}`}
        className="rf-press flex h-7 w-7 items-center justify-center"
        style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
      >
        <RfIcon name="trash" size={15} />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <form action={deleteDailySales}>
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          className="rf-press whitespace-nowrap px-2.5 py-1 text-[12px] font-bold"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: 8,
          }}
        >
          Poista
        </button>
      </form>

      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rf-press whitespace-nowrap px-1.5 py-1 text-[12px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>
    </span>
  );
}
