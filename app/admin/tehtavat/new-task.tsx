"use client";

import { useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { Labels } from "@/lib/i18n/labels";
import { TaskForm } from "./task-form";
import type { User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Uuden tehtävän avaaminen.
 *
 * Lomake aukeaa paikalleen eikä erilliseen ikkunaan: tehtävä
 * kirjoitetaan siihen näkymään jossa muutkin ovat, ja peruminen on
 * yksi painallus takaisin.
 */
export function NewTask({
  t,
  nimet,
  users,
  today,
}: {
  t: AdminText;
  nimet: Labels;
  users: User[];
  today: string;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <TaskForm
        t={t}
        nimet={nimet}
        users={users}
        today={today}
        onClose={() => setOpen(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        border: "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="plus" size={15} />
      {t.tiimi.newTask}
    </button>
  );
}
