"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteCategory, saveCategory, type AdminState } from "../actions";
import {
  CATEGORY_LABELS,
  type CustomCategory,
  type ExpenseCategory,
} from "@/lib/restoflow/types";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { Pill } from "@/components/restoflow/ui";

const initial: AdminState = {};

const BASES = Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][];

/**
 * Omien kulukategorioiden hallinta.
 *
 * Jokainen oma kategoria kuuluu yhteen yhdeksästä perusluokasta.
 * Perusluokka ratkaisee ALV-odotuksen ja budjetin — omalla nimellä ei
 * ole niihin vaikutusta. Se sanotaan tässä ääneen, jottei kukaan luule
 * budjetoivansa "Viinit"-riviä erikseen.
 */
export function CategoryManager({ categories }: { categories: CustomCategory[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-4 space-y-3">
      {categories.length === 0 ? (
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Omia kategorioita ei ole. Ilman niitä kuitit näkyvät yhdeksällä
          perusluokalla.
        </p>
      ) : (
        <ul className="space-y-2">
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryRow category={category} />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div
          className="px-3.5 py-3"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <p className="mb-2 text-[13px] font-semibold">Uusi kategoria</p>
          <CategoryForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rf-press flex w-full items-center justify-center gap-2 py-2.5 text-[14px] font-semibold md:w-auto md:px-5"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={16} />
          Lisää kategoria
        </button>
      )}

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Oma kategoria on tarkennus perusluokkaan, ei sen korvaaja. ALV-tarkistus
        ja budjetit toimivat perusluokalla, koska keksitylle luokalle ei ole
        odotettua ALV-kantaa. Kategorian poisto ei poista kuitteja — ne
        palaavat perusluokkaan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CategoryRow({ category }: { category: CustomCategory }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <div
        className="px-3.5 py-3"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        <CategoryForm category={category} onDone={() => setEditing(false)} />

        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
          {confirming ? (
            <form action={deleteCategory} className="flex items-center gap-2">
              <input type="hidden" name="categoryId" value={category.id} />
              <button
                type="submit"
                className="rf-press px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: "var(--rf-red)", color: "#fff", borderRadius: "var(--rf-r-control)" }}
              >
                Poista kategoria
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                Peruuta
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[13px] underline underline-offset-4"
              style={{ color: "var(--rf-red-text)" }}
            >
              Poista kategoria
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
      style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
          <CategoryIcon category={category.baseCategory} size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium">
            {category.name}
          </span>
          <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {CATEGORY_LABELS[category.baseCategory]}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {category.active ? null : <Pill>pois käytöstä</Pill>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rf-press px-3 py-1.5 text-[13px] font-medium"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-text-2)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Muokkaa
        </button>
      </span>
    </div>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: CustomCategory;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveCategory, initial);

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.notice}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {category ? (
        <input type="hidden" name="categoryId" value={category.id} />
      ) : null}

      <div>
        <label htmlFor={`c-name-${category?.id ?? "new"}`} className="block text-[13px] font-medium">
          Nimi
        </label>
        <input
          id={`c-name-${category?.id ?? "new"}`}
          name="name"
          defaultValue={category?.name ?? ""}
          placeholder="esim. Viinit"
          required
          maxLength={60}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-card)", borderRadius: "var(--rf-r-control)" }}
        />
      </div>

      <div>
        <label htmlFor={`c-base-${category?.id ?? "new"}`} className="block text-[13px] font-medium">
          Kuuluu perusluokkaan
        </label>
        <select
          id={`c-base-${category?.id ?? "new"}`}
          name="base"
          defaultValue={category?.baseCategory ?? "food"}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-card)", borderRadius: "var(--rf-r-control)" }}
        >
          {BASES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Perusluokka ratkaisee ALV-odotuksen ja budjetin.
        </p>
      </div>

      <label className="flex items-center gap-2.5 text-[13px]">
        <input
          type="checkbox"
          name="active"
          defaultChecked={category?.active ?? true}
          className="h-4 w-4"
        />
        Käytössä uusissa kuiteissa
      </label>

      {state.error ? (
        <p
          role="alert"
          className="px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Save />
        <button
          type="button"
          onClick={onDone}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Peruuta
        </button>
      </div>
    </form>
  );
}

function Save() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{ background: "var(--rf-text)", color: "#fff", borderRadius: "var(--rf-r-control)" }}
    >
      {pending ? "Tallennetaan…" : "Tallenna"}
    </button>
  );
}
