"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { removeShifts } from "../planning-actions";
import type { AdminState } from "../../actions";
import { publicationOf, removalOutcome } from "@/lib/restoflow/shift-planning";
import type { Shift, User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, Pill } from "@/components/restoflow/ui";

const initial: AdminState = {};

/**
 * Monen vuoron valinta ja poisto.
 *
 * Vuoro kerrallaan poistaminen on kaksi klikkausta per rivi. Kun
 * kopiointi tai toistuva vuoro on tehnyt kuukauden verran vääriä
 * rivejä, se on satoja klikkauksia — ja käytännössä se tarkoittaa
 * että virheelliset rivit jäävät kantaan.
 *
 * VAHVISTUS KERTOO MITÄ TAPAHTUU, EI VAIN MONTAKO.
 *
 * Valinnassa on lähes aina sekaisin luonnoksia, julkaistuja ja
 * koskemattomia. "Poistetaanko 14 vuoroa?" olisi väärä kysymys:
 * julkaistut perutaan eikä poisteta, ja mennyt nimetty vuoro on
 * suojattu. Luvut lasketaan samoilla säännöillä kuin kanta käyttää,
 * ja ne näytetään ennen painallusta.
 */
export function BulkShifts({
  shifts,
  users,
  today,
  monthLabel,
}: {
  shifts: Shift[];
  users: User[];
  today: string;
  monthLabel: string;
}) {
  const [state, action] = useActionState(removeShifts, initial);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const sorted = useMemo(
    () =>
      [...shifts].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      ),
    [shifts],
  );

  /*
   * Päättely on jaetussa moduulissa, ei tässä.
   *
   * Kanta noudattaa samoja sääntöjä. Kaksi toteutusta samasta
   * säännöstä ajautuisi erilleen, ja silloin vahvistus lupaisi eri
   * asian kuin mitä tapahtuu.
   */
  const outcome = useMemo(
    () =>
      removalOutcome(
        sorted.filter((shift) => selected.has(shift.id)),
        today,
      ),
    [selected, sorted, today],
  );

  if (state.notice) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 px-3.5 py-3 text-[13px] font-medium"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span className="mt-px shrink-0">
          <RfIcon name="check" size={16} />
        </span>
        {state.notice}
      </p>
    );
  }

  if (sorted.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="trash" size={15} />
        Valitse ja poista
      </button>
    );
  }

  function pick(matcher: (shift: Shift) => boolean) {
    setSelected(new Set(sorted.filter(matcher).map((shift) => shift.id)));
    setConfirming(false);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader
          title="Valitse ja poista"
          subtitle={`${monthLabel} · ${sorted.length} vuoroa`}
        />

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected(new Set());
            setConfirming(false);
          }}
          aria-label="Sulje"
          className="rf-press -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
          style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
        >
          <span style={{ transform: "rotate(45deg)", display: "block" }}>
            <RfIcon name="plus" size={18} />
          </span>
        </button>
      </div>

      {/*
        Pikavalinnat ovat se mikä tekee tästä nopean.

        Yksitellen ruksiminen olisi sama työmäärä kuin yksitellen
        poistaminen. Nämä kolme kattavat sen mitä siivotaan:
        vahingossa luodut luonnokset, täyttämättä jääneet avoimet
        vuorot ja koko kuukausi.
      */}
      <div className="flex flex-wrap gap-1.5">
        <Pika label="Kaikki" onClick={() => pick(() => true)} />
        <Pika
          label="Luonnokset"
          onClick={() => pick((shift) => publicationOf(shift) === "draft")}
        />
        <Pika
          label="Avoimet"
          onClick={() => pick((shift) => shift.userId === "")}
        />
        <Pika label="Tyhjennä" onClick={() => pick(() => false)} />
      </div>

      <form action={action} className="mt-3">
        <ul
          className="max-h-[22rem] space-y-1 overflow-y-auto pr-1"
          style={{ overscrollBehavior: "contain" }}
        >
          {sorted.map((shift) => {
            const user = users.find((u) => u.id === shift.userId);
            const tila = publicationOf(shift);
            const checked = selected.has(shift.id);

            return (
              <li key={shift.id}>
                <label
                  className="flex cursor-pointer items-center gap-3 px-2.5 py-2"
                  style={{
                    background: checked ? "var(--rf-accent-bg)" : "transparent",
                    borderRadius: "var(--rf-r-control)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="id"
                    value={shift.id}
                    checked={checked}
                    onChange={() => toggle(shift.id)}
                    className="h-4 w-4 shrink-0"
                  />

                  <span
                    className="rf-tabular w-16 shrink-0 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {lyhytPaiva(shift.date)}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    <span className="font-medium">
                      {user?.name ?? "Avoin vuoro"}
                    </span>{" "}
                    <span
                      className="rf-tabular"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {shift.startTime}–{shift.endTime}
                    </span>
                  </span>

                  <span className="shrink-0">
                    {tila === "draft" ? (
                      <Pill tone="warn" dot>
                        luonnos
                      </Pill>
                    ) : tila === "cancelled" ? (
                      <Pill tone="risk" dot>
                        peruttu
                      </Pill>
                    ) : (
                      <Pill tone="ok" dot>
                        julkaistu
                      </Pill>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {state.error ? (
          <p
            role="alert"
            className="mt-3 text-[12.5px]"
            style={{ color: "var(--rf-red-text)" }}
          >
            {state.error}
          </p>
        ) : null}

        {selected.size > 0 ? (
          <div
            className="mt-3 border-t pt-3"
            style={{ borderColor: "var(--rf-line)" }}
          >
            {confirming ? (
              <>
                <p className="text-[13px] font-bold">
                  {selected.size} {selected.size === 1 ? "vuoro" : "vuoroa"}{" "}
                  valittu. Mitä tapahtuu:
                </p>

                <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
                  {outcome.removed > 0 ? (
                    <li>
                      {outcome.removed} luonnosta poistetaan lopullisesti.
                    </li>
                  ) : null}
                  {outcome.cancelled > 0 ? (
                    <li>
                      {outcome.cancelled} julkaistua perutaan — työntekijä saa
                      tiedon ja rivi jää historiaan.
                    </li>
                  ) : null}
                  {outcome.blocked > 0 ? (
                    <li style={{ color: "var(--rf-text-3)" }}>
                      {outcome.blocked} jää koskematta: mennyt nimetty vuoro tai
                      jo peruttu.
                    </li>
                  ) : null}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Poista
                    disabled={outcome.removed + outcome.cancelled === 0}
                  />
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rf-press px-3.5 py-2 text-[13px] font-medium"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    Peruuta
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rf-press inline-flex items-center gap-2 px-4 py-2 text-[13px] font-bold"
                style={{
                  background: "var(--rf-red-bg)",
                  color: "var(--rf-red-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <RfIcon name="trash" size={15} />
                Poista valitut ({selected.size})
              </button>
            )}
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function Pika({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {label}
    </button>
  );
}

function Poista({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rf-press px-4 py-2 text-[13px] font-bold"
      style={{
        background: "var(--rf-red)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending || disabled ? 0.5 : 1,
      }}
    >
      {pending ? "Poistetaan…" : "Vahvista"}
    </button>
  );
}

/** "2026-08-05" → "ke 5.8.". Listassa päivä on tunniste, ei otsikko. */
function lyhytPaiva(isoDate: string): string {
  const nimet = ["su", "ma", "ti", "ke", "to", "pe", "la"];
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${nimet[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}
