"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteLunchItem,
  moveLunchItem,
  saveLunchItem,
  setLunchPrice,
  type LunchState,
} from "./actions";
import type { AllergenType, DietType, LunchItem } from "@/lib/restoflow/lunch";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";

const initial: LunchState = {};

// ---------------------------------------------------------------------------
// Ruoan lomake
// ---------------------------------------------------------------------------

/**
 * Ruoan lisäys ja muokkaus.
 *
 * Natiivi <dialog>, ei oma toteutus. Se antaa ilmaiseksi kolme asiaa
 * jotka omassa jäävät helposti tekemättä: kohdistus pysyy dialogin
 * sisällä, Esc sulkee, ja taustan sisältö merkitään avustavalle
 * teknologialle piilotetuksi.
 *
 * Sama komponentti luo ja muokkaa. Kaksi erillistä ajautuisi erilleen
 * juuri ruokavalioiden ja allergeenien käsittelyssä, joka on tämän
 * lomakkeen ainoa hankala osa.
 */
export function LunchItemDialog({
  dayId,
  dayLabel,
  item,
  diets,
  allergens,
  trigger,
}: {
  dayId: string;
  dayLabel: string;
  item?: LunchItem;
  diets: DietType[];
  allergens: AllergenType[];
  trigger: "add" | "edit";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(saveLunchItem, initial);
  const [open, setOpen] = useState(false);

  // Onnistunut tallennus sulkee dialogin. Ilman tätä lomake jäisi auki
  // ja käyttäjä ei tietäisi menikö tallennus läpi.
  useEffect(() => {
    if (state.notice && open) dialog.current?.close();
  }, [state.notice, open]);

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }

  function hide() {
    dialog.current?.close();
    setOpen(false);
  }

  return (
    <>
      {trigger === "add" ? (
        <button
          type="button"
          onClick={show}
          className="rf-press flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed py-2.5 text-[13px] font-medium"
          style={{ borderColor: "var(--rf-line-strong)", color: "var(--rf-text-2)" }}
        >
          <RfIcon name="plus" size={15} />
          Lisää lounasruoka
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          aria-label={`Muokkaa: ${item?.name ?? ""}`}
          className="rf-press rf-icon-btn flex h-8 w-8 items-center justify-center rounded-[8px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          <RfIcon name="settings" size={15} />
        </button>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={item ? "Muokkaa lounasruokaa" : "Lisää lounasruoka"}
        /*
         * m-auto keskittää dialogin.
         *
         * Selain keskittää modaalidialogin itse säännöllä margin: auto,
         * mutta Tailwindin preflight nollaa marginin kaikilta
         * elementeiltä. Ilman tätä dialogi liimautuu vasempaan
         * yläkulmaan.
         *
         * max-h ja sisäinen vieritys: lomake on pitkä, ja matalalla
         * ruudulla Lisää-painike jäisi muuten näkymän ulkopuolelle
         * ilman mitään tapaa päästä siihen.
         */
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[16px] p-0 backdrop:bg-black/40"
        style={{ background: "var(--rf-card)", color: "var(--rf-text)" }}
      >
        {/* Lomake renderöidään vasta auki: muuten jokainen päivä pitäisi
            kymmentä piilotettua lomaketta muistissa. */}
        {open ? (
          <form action={action} className="p-5">
            <input type="hidden" name="dayId" value={dayId} />
            {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold">
                  {item ? "Muokkaa lounasruokaa" : "Lisää lounasruoka"}
                </h2>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                  {dayLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={hide}
                aria-label="Sulje"
                className="rf-press rf-icon-btn flex h-9 w-9 items-center justify-center rounded-[9px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                <RfIcon name="back" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <Field label="Nimi" htmlFor="li-name" required>
                <input
                  id="li-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={item?.name ?? ""}
                  placeholder="Lohikeitto"
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              <Field label="Kuvaus" htmlFor="li-desc">
                <input
                  id="li-desc"
                  name="description"
                  maxLength={400}
                  defaultValue={item?.description ?? ""}
                  placeholder="Kermainen lohikeitto, saaristolaisleipää"
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              <CheckGroup
                legend="Ruokavaliot"
                name="diets"
                options={diets.map((d) => ({ id: d.id, label: d.label }))}
                selected={item?.diets ?? []}
              />

              <CheckGroup
                legend="Allergeenit"
                name="allergens"
                options={allergens.map((a) => ({ id: a.id, label: a.label }))}
                selected={item?.allergens ?? []}
              />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="mt-4 px-3.5 py-2.5 text-[13px]"
                style={{
                  background: "var(--rf-red-bg)",
                  color: "var(--rf-red-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                {state.error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2.5">
              <Submit label={item ? "Tallenna" : "Lisää"} />
              <Button type="button" tone="ghost" onClick={hide}>
                Peruuta
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
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

/**
 * Valintaryhmä.
 *
 * fieldset ja legend eivätkä pelkät otsikkorivit: ruudunlukija kertoo
 * silloin jokaisen valinnan yhteydessä mihin ryhmään se kuuluu.
 * Muuten "Maito" olisi irrallinen sana jonka merkitys on arvattava.
 */
function CheckGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  selected: string[];
}) {
  if (options.length === 0) return null;

  return (
    <fieldset>
      <legend className="text-[13px] font-medium">{legend}</legend>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.id}
            className="rf-press inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[13px]"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selected.includes(option.id)}
              className="h-4 w-4"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" disabled={pending}>
      {pending ? "Tallennetaan…" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Ruoan poisto
// ---------------------------------------------------------------------------

/**
 * Poisto vahvistuksella.
 *
 * Vahvistus on samassa napissa eikä erillisessä dialogissa: nimi
 * mainitaan kysymyksessä, jotta väärän rivin poistaminen huomataan
 * ennen kuin se tapahtuu.
 */
export function DeleteLunchItem({ item }: { item: LunchItem }) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Poista: ${item.name}`}
        className="rf-press rf-icon-btn flex h-8 w-8 items-center justify-center rounded-[8px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        <RfIcon name="alert" size={15} />
      </button>
    );
  }

  return (
    <form action={deleteLunchItem} className="flex items-center gap-1.5">
      <input type="hidden" name="itemId" value={item.id} />

      <span className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
        Poistetaanko?
      </span>

      <button
        type="submit"
        className="rf-press px-2.5 py-1 text-[12px] font-semibold"
        style={{
          background: "var(--rf-red-bg)",
          color: "var(--rf-red-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Poista
      </button>

      <button
        type="button"
        onClick={() => setAsking(false)}
        className="rf-press px-2.5 py-1 text-[12px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Järjestys
// ---------------------------------------------------------------------------

/**
 * Järjestyksen muutos ylös ja alas.
 *
 * Ei raahausta. Raahaus vaatii hiiren tai tarkan kosketuksen, ei toimi
 * näppäimistöllä ilman erillistä toteutusta, ja puhelimessa se
 * kilpailee sivun vierityksen kanssa. Kaksi painiketta toimii
 * kaikkialla ja on ruudunlukijalle ymmärrettävä.
 */
export function MoveLunchItem({
  item,
  first,
  last,
}: {
  item: LunchItem;
  first: boolean;
  last: boolean;
}) {
  return (
    <span className="flex flex-col">
      <MoveButton item={item} direction="up" disabled={first} />
      <MoveButton item={item} direction="down" disabled={last} />
    </span>
  );
}

function MoveButton({
  item,
  direction,
  disabled,
}: {
  item: LunchItem;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveLunchItem}>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="direction" value={direction} />

      <button
        type="submit"
        disabled={disabled}
        aria-label={
          direction === "up"
            ? `Siirrä ylemmäs: ${item.name}`
            : `Siirrä alemmas: ${item.name}`
        }
        className="rf-press flex h-4 w-6 items-center justify-center disabled:opacity-25"
        style={{ color: "var(--rf-text-3)" }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "block",
            transform: direction === "up" ? "rotate(-90deg)" : "rotate(90deg)",
          }}
        >
          <RfIcon name="chevron" size={13} />
        </span>
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Päivän hinta
// ---------------------------------------------------------------------------

/**
 * Viikon lounashinta.
 *
 * Hinta on viikossa eikä päivässä eikä ruoassa. Lounas maksaa saman
 * verran maanantaina ja perjantaina, ja päiväkohtainen hinta tarkoitti
 * viittä kenttää joihin kirjoitetaan viisi kertaa sama luku.
 *
 * Tallennus tapahtuu kentästä poistuttaessa. Erillinen tallennuspainike
 * olisi painike jota kukaan ei muista painaa — ja muistamatta jäänyt
 * hinta on pahempi kuin näkyvä virhe.
 */
export function LunchPriceField({
  menuId,
  name,
  cents,
}: {
  menuId: string;
  name: string;
  cents: number | null;
}) {
  const [state, action] = useActionState(setLunchPrice, initial);
  const form = useRef<HTMLFormElement>(null);
  const saved = cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");

  const [value, setValue] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);

  if (saved !== lastSaved) {
    setLastSaved(saved);
    setValue(saved);
  }

  return (
    <form ref={form} action={action} className="flex items-baseline gap-1.5">
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="priceName" value={name} />

      <label htmlFor={`price-${menuId}`} className="sr-only">
        {`${name}, hinta euroina koko viikolle`}
      </label>

      <input
        id={`price-${menuId}`}
        name="price"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (value !== saved) form.current?.requestSubmit();
        }}
        placeholder="0,00"
        className="w-[6rem] bg-transparent text-[24px] font-semibold outline-none"
        style={{ color: "var(--rf-text)" }}
      />

      <span className="text-[18px] font-semibold">€</span>

      {state.error ? (
        <span role="alert" className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
