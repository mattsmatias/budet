"use client";

import { useActionState, useState } from "react";
import type { Labels } from "@/lib/i18n/labels";
import { useFormStatus } from "react-dom";
import { setBudget, type AdminState } from "../actions";
import { type ExpenseCategory } from "@/lib/restoflow/types";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";

const initial: AdminState = {};

/**
 * Budjetin asetus yhdelle kategorialle.
 *
 * Tyhjä tai nolla poistaa budjetin. Budjetoimaton kategoria näytetään eri
 * tavalla kuin kategoria jonka budjetti on nolla — jälkimmäinen olisi aina
 * ylitetty ja hälyttäisi turhaan.
 */
export function BudgetEditor({
  nimet,
  category,
  currentCents,
  spentCents,
}: {
  nimet: Labels;
  category: ExpenseCategory;
  currentCents: number | null;
  spentCents: number;
}) {
  const [state, action] = useActionState(setBudget, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Muokkaa budjettia: ${nimet.categories[category]}`}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {currentCents === null ? "Aseta" : "Muokkaa"}
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 w-full">
      <input type="hidden" name="category" value={category} />

      <label
        htmlFor={`budget-${category}`}
        className="block text-[13px] font-medium"
      >
        Kuukausibudjetti · {nimet.categories[category]}
      </label>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={`budget-${category}`}
          name="amount"
          inputMode="decimal"
          autoFocus
          defaultValue={
            currentCents === null ? "" : (currentCents / 100).toFixed(0)
          }
          placeholder="0"
          className="rf-tabular w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
        <span
          className="shrink-0 text-[14px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          € / kk
        </span>
      </div>

      <p className="mt-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Tässä kuussa käytetty {formatMoney(spentCents)}. Tyhjä tai nolla poistaa
        budjetin.
      </p>

      {state.error ? (
        <p
          role="alert"
          className="mt-2 px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Save />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
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

/**
 * Budjetin lisäys kategorialle jolla ei vielä ole sellaista.
 *
 * Erillinen komponentti, koska tyhjän kategorian rivi näyttää eri asian:
 * siinä ei ole palkkia eikä prosenttia, vain kulu ja kutsu asettaa raja.
 */
export function AddBudget({
  nimet,
  categories,
  spend,
}: {
  nimet: Labels;
  categories: ExpenseCategory[];
  spend: Record<string, number>;
}) {
  const [state, action] = useActionState(setBudget, initial);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory | "">("");

  if (categories.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={17} />
        Lisää budjetti
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label
          htmlFor="new-budget-category"
          className="block text-[13px] font-medium"
        >
          Kategoria
        </label>
        <select
          id="new-budget-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <option value="">Valitse…</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {nimet.categories[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="new-budget-amount"
          className="block text-[13px] font-medium"
        >
          Kuukausibudjetti
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="new-budget-amount"
            name="amount"
            inputMode="decimal"
            placeholder="2000"
            className="rf-tabular w-full px-3.5 py-2.5 text-[16px] outline-none"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          />
          <span
            className="shrink-0 text-[14px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            € / kk
          </span>
        </div>
        {category ? (
          <p
            className="mt-1.5 flex items-center gap-1.5 text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            <CategoryIcon category={category} size={13} />
            Tässä kuussa käytetty {formatMoney(spend[category] ?? 0)}
          </p>
        ) : null}
      </div>

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
          onClick={() => setOpen(false)}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
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
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna"}
    </button>
  );
}
