"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import type {
  Reservation,
  ReservationStatus,
  RestaurantTable,
} from "@/lib/restoflow/reservations";
import { nextStatuses } from "@/lib/restoflow/reservations";
import {
  createReservation,
  setStatus,
  updateReservation,
  type ReservationState,
} from "./actions";

const initial: ReservationState = {};

// ---------------------------------------------------------------------------
// Tilapainikkeet
// ---------------------------------------------------------------------------

/**
 * Seuraava askel, ei kuutta painiketta.
 *
 * Salissa vuoropäällikkö tekee kahta asiaa: merkitsee saapuneen ja
 * merkitsee lähteneen. Loput ovat poikkeuksia. Jos kaikki kuusi tilaa
 * olisivat rivillä, kaksi tavallisinta hukkuisi neljän harvinaisen
 * sekaan — ja rivi olisi puhelimessa luettavaksi liian leveä.
 */
export function StatusActions({
  t,
  reservation,
}: {
  t: AdminText;
  reservation: Reservation;
}) {
  const [state, action] = useActionState(setStatus, initial);
  const steps = nextStatuses(reservation.status);

  const label: Record<ReservationStatus, string> = {
    pending: t.varaus.statusRestore,
    confirmed: t.varaus.statusRestore,
    arrived: t.varaus.statusArrived,
    completed: t.varaus.statusLeft,
    cancelled: t.varaus.statusCancel,
    no_show: t.varaus.statusNoShow,
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step) => (
        <form key={step} action={action}>
          <input type="hidden" name="id" value={reservation.id} />
          <input type="hidden" name="status" value={step} />
          <StepButton
            label={label[step]}
            tone={
              step === "arrived" || step === "completed" ? "primary" : "ghost"
            }
          />
        </form>
      ))}

      {state.error ? (
        <span
          role="alert"
          className="text-[12px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

function StepButton({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" tone={tone} disabled={pending}>
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Varauslomake
// ---------------------------------------------------------------------------

/**
 * Sama lomake luo ja muokkaa.
 *
 * Kentät ovat samat, ja kannassa on kaksi funktiota vain siksi että
 * luonti tarvitsee lukon ja muokkaus tarvitsee vanhan rivin. Kaksi
 * lomaketta ajautuisi erilleen juuri pöytävalinnassa, joka on tämän
 * ainoa hankala kohta.
 */
export function ReservationDialog({
  t,
  date,
  tables,
  slots,
  reservation,
  walkIn,
  trigger,
}: {
  t: AdminText;
  date: string;
  tables: RestaurantTable[];
  slots: string[];
  reservation?: Reservation;
  walkIn?: boolean;
  trigger: "add" | "walkIn" | "edit";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    reservation ? updateReservation : createReservation,
    initial,
  );

  /*
   * Valitut pöydät ovat komponentin tilassa.
   *
   * Ilman tätä lomake ei voisi erottaa "en koskenut pöytiin" ja
   * "poistin kaikki pöydät" toisistaan, ja tallennus siirtäisi
   * varauksen pois pöydästään aina kun muistiinpanoa korjataan.
   */
  const [chosen, setChosen] = useState<string[]>(reservation?.tableIds ?? []);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (state.notice && open) dialog.current?.close();
  }, [state.notice, open]);

  function show() {
    setChosen(reservation?.tableIds ?? []);
    setTouched(false);
    setOpen(true);
    dialog.current?.showModal();
  }

  const title = reservation
    ? t.varaus.editReservation
    : walkIn
      ? t.varaus.addWalkIn
      : t.varaus.addReservation;

  return (
    <>
      {trigger === "edit" ? (
        <button
          type="button"
          onClick={show}
          aria-label={fill(t.varaus.editNamed, { nimi: reservation?.guestName ?? "" })}
          className="rf-press rf-icon-btn rf-hit flex h-7 w-7 items-center justify-center rounded-[7px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          <RfIcon name="settings" size={14} />
        </button>
      ) : (
        <Button
          type="button"
          tone={trigger === "add" ? "primary" : "ghost"}
          onClick={show}
          icon={<RfIcon name="plus" size={16} />}
        >
          {title}
        </Button>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={title}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[16px] p-0 backdrop:bg-black/40"
        style={{ background: "var(--rf-card)", color: "var(--rf-text)" }}
      >
        {open ? (
          <form action={action} className="p-5">
            {reservation ? (
              <input type="hidden" name="id" value={reservation.id} />
            ) : (
              <input type="hidden" name="date" value={date} />
            )}
            {walkIn ? <input type="hidden" name="walkIn" value="1" /> : null}
            {touched ? (
              <input type="hidden" name="tablesTouched" value="1" />
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label={t.varaus.close}
                className="rf-press rf-icon-btn flex h-9 w-9 items-center justify-center rounded-[9px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                <RfIcon name="back" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <Field label={t.varaus.time} htmlFor="rv-time" required>
                  {/*
                    Walk-in ja muokkaus saavat vapaan kellonajan, uusi
                    varaus valitsee vapaista. Vapaa kenttä uudessa
                    varauksessa antaisi kirjoittaa ajan jolloin sali on
                    kiinni — kanta hylkäisi sen, mutta vasta lähetyksen
                    jälkeen.
                  */}
                  {trigger === "add" && slots.length > 0 ? (
                    <select
                      id="rv-time"
                      name="time"
                      required
                      defaultValue={slots[0]}
                      className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                      style={{
                        background: "var(--rf-inset)",
                        borderRadius: "var(--rf-r-control)",
                      }}
                    >
                      {slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="rv-time"
                      name="time"
                      type="time"
                      required
                      defaultValue={reservation?.time ?? nowTime()}
                      className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                      style={{
                        background: "var(--rf-inset)",
                        borderRadius: "var(--rf-r-control)",
                      }}
                    />
                  )}
                </Field>

                <Field label={t.varaus.partySize} htmlFor="rv-party" required>
                  <input
                    id="rv-party"
                    name="partySize"
                    type="number"
                    min={1}
                    max={200}
                    required
                    defaultValue={reservation?.partySize ?? 2}
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>
              </div>

              <Field label={t.varaus.guest} htmlFor="rv-name" required>
                <input
                  id="rv-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={reservation?.guestName ?? ""}
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label={t.varaus.phone} htmlFor="rv-phone">
                  <input
                    id="rv-phone"
                    name="phone"
                    type="tel"
                    maxLength={40}
                    defaultValue={reservation?.guestPhone ?? ""}
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>

                <Field label={t.varaus.email} htmlFor="rv-email">
                  <input
                    id="rv-email"
                    name="email"
                    type="email"
                    maxLength={160}
                    defaultValue={reservation?.guestEmail ?? ""}
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>
              </div>

              <Field label={t.varaus.note} htmlFor="rv-note">
                <input
                  id="rv-note"
                  name="note"
                  maxLength={500}
                  defaultValue={reservation?.note ?? ""}
                  placeholder={t.varaus.notePlaceholder}
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              {/* --- Pöydät --- */}
              <fieldset>
                <legend className="text-[13px] font-medium">
                  {t.varaus.tablesLabel}
                </legend>
                <p
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.varaus.tableAutoHint}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tables
                    .filter((table) => table.active)
                    .map((table) => {
                      const on = chosen.includes(table.id);
                      return (
                        <label
                          key={table.id}
                          className="rf-press cursor-pointer px-3 py-1.5 text-[13px] font-medium"
                          style={{
                            background: on
                              ? "var(--rf-accent)"
                              : "var(--rf-inset)",
                            color: on
                              ? "var(--rf-on-accent)"
                              : "var(--rf-text)",
                            borderRadius: "var(--rf-r-pill)",
                          }}
                        >
                          <input
                            type="checkbox"
                            name="tableId"
                            value={table.id}
                            checked={on}
                            onChange={(event) => {
                              setTouched(true);
                              setChosen((prev) =>
                                event.target.checked
                                  ? [...prev, table.id]
                                  : prev.filter((id) => id !== table.id),
                              );
                            }}
                            className="sr-only"
                          />
                          {table.name}
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <SaveButton t={t} />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="mt-3 text-[13px]"
                style={{ color: "var(--rf-red-text)" }}
              >
                {state.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </dialog>
    </>
  );
}

function SaveButton({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" disabled={pending}>
      {pending ? t.varaus.saving : t.varaus.save}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: "var(--rf-text-3)" }}>
            {" *"}
          </span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Kuluva tunti ja minuutti walk-inin oletukseksi. */
function nowTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
