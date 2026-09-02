"use client";

/**
 * Pöytä kartalta auki.
 *
 * Kartta kertoo värillä missä mennään. Se ei kerro kuka pöydässä
 * istuu, milloin seurue tuli eikä mihin asti pöytä on varattu — ja
 * juuri niitä kysytään kun tarjoilija pysähtyy pöydän kohdalle.
 *
 * ---------------------------------------------------------------------
 * KATSOMINEN JA TEKEMINEN SAMASSA PAIKASSA
 * ---------------------------------------------------------------------
 *
 * Paneelissa on myös ne kolme tekoa jotka pöydälle tehdään vuoron
 * aikana: seurue saapui, lasku pyydettiin, pöytä vapautui. Ilman niitä
 * tarjoilija katsoisi karttaa ja tekisi merkinnän listasta — kaksi
 * näkymää samaan tekoon, ja siksi merkintä jäisi tekemättä.
 *
 * ---------------------------------------------------------------------
 * PANEELI EI OLE DIALOGI
 * ---------------------------------------------------------------------
 *
 * Kartta jää näkyviin taakse. Vuoron aikana katsotaan kahta pöytää
 * peräkkäin, eikä väliin kuulu sulkemista.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import type {
  Reservation,
  RestaurantTable,
  TableState,
} from "@/lib/restoflow/reservations";
import { RfIcon } from "@/components/restoflow/icons";
import { setBill, setStatus, type ReservationState } from "./actions";

const initial: ReservationState = {};

export function TablePanel({
  t,
  table,
  state,
  stateLabel,
  reservation,
  onClose,
}: {
  t: AdminText;
  table: RestaurantTable;
  state: TableState;
  stateLabel: string;
  /** Pöydässä juuri nyt oleva varaus, tai null jos pöytä on vapaa. */
  reservation: Reservation | null;
  onClose: () => void;
}) {
  const [statusState, statusAction] = useActionState(setStatus, initial);
  const [billState, billAction] = useActionState(setBill, initial);

  const virhe = statusState.error ?? billState.error;

  return (
    <aside
      className="rf-enter mt-3 px-3 py-3"
      aria-label={table.name}
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">{table.name}</p>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {`${stateLabel} · ${fill(t.varaus.seatsRange, {
              min: String(table.seatsMin),
              max: String(table.seatsMax),
            })}`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t.varaus.closeTable}
          className="rf-press flex h-8 w-8 items-center justify-center"
          style={{ borderRadius: "50%", color: "var(--rf-text-2)" }}
        >
          <RfIcon name="close" size={17} />
        </button>
      </div>

      {reservation ? (
        <>
          <dl className="mt-3 space-y-1 text-[13.5px]">
            <Rivi label={t.varaus.guest} value={reservation.guestName} />
            <Rivi
              label={t.varaus.time}
              value={`${reservation.time}–${reservation.endTime}`}
            />
            <Rivi
              label={t.varaus.partySize}
              value={String(reservation.partySize)}
            />

            {/* Yhteystiedot vain jos kanta antoi ne: työntekijä ei näe. */}
            {reservation.guestPhone ? (
              <Rivi label={t.varaus.phone} value={reservation.guestPhone} />
            ) : null}

            {reservation.note ? (
              <Rivi label={t.varaus.note} value={reservation.note} />
            ) : null}

            {reservation.billRequestedAt ? (
              <Rivi
                label={t.varaus.stateBilling}
                value={kello(reservation.billRequestedAt)}
              />
            ) : null}
          </dl>

          {virhe ? (
            <p
              role="alert"
              className="mt-2 text-[13px]"
              style={{ color: "var(--rf-red-text)" }}
            >
              {virhe}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {/*
              Saapuminen ensin, koska se on illan ensimmäinen teko.

              Näkyy vain kun sitä ei ole vielä tehty: painike joka ei
              tee mitään on painike jota kokeillaan uudelleen.
            */}
            {reservation.status !== "arrived" ? (
              <form action={statusAction}>
                <input type="hidden" name="id" value={reservation.id} />
                <input type="hidden" name="status" value="arrived" />
                <Toiminto label={t.varaus.markArrived} tone="primary" />
              </form>
            ) : null}

            {/*
              Laskupyyntö vain istuvalle seurueelle.

              Laskua ei voi pyytää pöydästä jossa ei istu ketään, ja
              kanta on samaa mieltä.
            */}
            {reservation.status === "arrived" ? (
              <form action={billAction}>
                <input type="hidden" name="id" value={reservation.id} />
                <input
                  type="hidden"
                  name="waiting"
                  value={reservation.billRequestedAt ? "0" : "1"}
                />
                <Toiminto
                  label={
                    reservation.billRequestedAt
                      ? t.varaus.cancelBill
                      : t.varaus.requestBill
                  }
                  tone="ghost"
                />
              </form>
            ) : null}

            {reservation.status === "arrived" ? (
              <form action={statusAction}>
                <input type="hidden" name="id" value={reservation.id} />
                <input type="hidden" name="status" value="completed" />
                <Toiminto label={t.varaus.releaseTable} tone="ghost" />
              </form>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {state === "disabled" ? stateLabel : t.varaus.tableFree}
        </p>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------

function Rivi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0" style={{ color: "var(--rf-text-3)" }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-medium">{value}</dd>
    </div>
  );
}

/**
 * Painike joka tietää olevansa lähetyksessä.
 *
 * useFormStatus lukee sen lomakkeen tilan jonka sisällä komponentti
 * on, eikä toimi samassa komponentissa jossa lomake määritellään.
 */
function Toiminto({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-3.5 py-2 text-[13px] font-semibold disabled:opacity-45"
      style={{
        background: tone === "primary" ? "var(--rf-accent)" : "var(--rf-inset)",
        color: tone === "primary" ? "var(--rf-on-accent)" : "var(--rf-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Kellonaika aikaleimasta.
 *
 * Selaimen paikallinen aika riittää: tämä luetaan salissa, ja salin
 * kello on sama kuin selaimen. Ravintolan aikavyöhyke olisi tässä
 * tarkempi mutta ei sen todempi.
 */
function kello(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
