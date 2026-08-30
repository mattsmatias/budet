"use client";

import { useActionState, useEffect, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { Labels } from "@/lib/i18n/labels";
import { useFormStatus } from "react-dom";
import { saveTask } from "./actions";
import type { AdminState } from "../actions";
import { type Task } from "@/lib/restoflow/tasks";
import type { User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";
import { CONTROL, CONTROL_STYLE } from "@/app/admin/asetukset/form-parts";

const initial: AdminState = {};

/**
 * Tehtävän lomake.
 *
 * NIMI JA ERÄPÄIVÄ RIITTÄVÄT.
 *
 * Kaikki muu on avattavan osion takana. Kymmenen kenttää putkeen on
 * lomake jota ei täytetä kesken illan; kaksi kenttää ja tallennus on
 * tehtävä joka syntyy siinä hetkessä kun se muistetaan.
 */
export function TaskForm({
  t,
  nimet,
  users,
  task,
  onClose,
  today,
}: {
  t: AdminText;
  nimet: Labels;
  users: User[];
  task?: Task;
  onClose: () => void;
  today: string;
}) {
  const [state, action] = useActionState(saveTask, initial);
  const [showMore, setShowMore] = useState(task !== undefined);

  /*
   * Sulkeminen on sivuvaikutus, ei renderin osa.
   *
   * onClose muuttaa vanhemman tilaa. Renderin aikana kutsuttuna React
   * varoittaa "Cannot update a component while rendering a different
   * component" — ja varoitus on oikeassa: sulkeminen tapahtuu
   * tallennuksen seurauksena, ei piirtämisen.
   */
  useEffect(() => {
    if (state.notice) onClose();
  }, [state.notice, onClose]);

  return (
    <Card>
      <form action={action} className="space-y-3.5">
        {task ? <input type="hidden" name="id" value={task.id} /> : null}

        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-bold">
            {task ? t.tiimi.editTask : t.tiimi.newTask}
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.tiimi.close}
            className="rf-press -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
            style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
          >
            <span style={{ transform: "rotate(45deg)", display: "block" }}>
              <RfIcon name="plus" size={18} />
            </span>
          </button>
        </div>

        <label className="block">
          <span className="block text-[12.5px] font-semibold">
            {t.tiimi.position}
          </span>
          <input
            name="title"
            required
            maxLength={200}
            autoFocus
            defaultValue={task?.title ?? ""}
            placeholder={t.tiimi.taskPlaceholder}
            className={`${CONTROL} mt-1.5`}
            style={CONTROL_STYLE}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="block">
            <span className="block text-[12.5px] font-semibold">
              {t.tiimi.dueDate}
            </span>
            <input
              type="date"
              name="dueOn"
              required
              defaultValue={task?.dueOn ?? today}
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            />
          </label>

          <label className="block">
            <span className="block text-[12.5px] font-semibold">
              {t.tiimi.clock}
              <span
                className="ml-1 font-normal"
                style={{ color: "var(--rf-text-3)" }}
              >
                valinnainen
              </span>
            </span>
            <input
              type="time"
              name="dueTime"
              defaultValue={task?.dueTime ?? ""}
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            />
          </label>
        </div>

        {showMore ? (
          <>
            <label className="block">
              <span className="block text-[12.5px] font-semibold">
                {t.tiimi.description}
                <span
                  className="ml-1 font-normal"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  valinnainen
                </span>
              </span>
              <textarea
                name="description"
                rows={2}
                maxLength={2000}
                defaultValue={task?.description ?? ""}
                className={`${CONTROL} mt-1.5`}
                style={{ ...CONTROL_STYLE, height: "auto" }}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[12.5px] font-semibold">
                  {t.tiimi.assignee}
                </span>
                <select
                  name="assignedTo"
                  defaultValue={task?.assignedTo ?? ""}
                  className={`${CONTROL} mt-1.5`}
                  style={CONTROL_STYLE}
                >
                  <option value="">{t.tiimi.nobodySpecific}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[12.5px] font-semibold">
                  {t.tiimi.priority}
                </span>
                <select
                  name="priority"
                  defaultValue={task?.priority ?? "normal"}
                  className={`${CONTROL} mt-1.5`}
                  style={CONTROL_STYLE}
                >
                  {Object.entries(nimet.taskPriority).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[12.5px] font-semibold">
                  {t.tiimi.whoSees}
                </span>
                <select
                  name="visibility"
                  defaultValue={task?.visibility ?? "managers"}
                  className={`${CONTROL} mt-1.5`}
                  style={CONTROL_STYLE}
                >
                  {Object.entries(nimet.taskVisibility).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span className="block text-[12.5px] font-semibold">
                  {t.tiimi.repeats}
                </span>
                <select
                  name="recurrence"
                  defaultValue={task?.recurrence ?? "none"}
                  className={`${CONTROL} mt-1.5`}
                  style={CONTROL_STYLE}
                >
                  {Object.entries(nimet.taskRecurrence).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            {/*
              Muistutukset ovat asetus, eivät tapahtumia.

              Ne lasketaan eräpäivästä joka kerta uudelleen, joten sama
              päivä tuottaa saman muistutuksen eikä kahta. Lähetetyistä
              ei tarvitse pitää kirjaa.
            */}
            <fieldset>
              <legend className="text-[12.5px] font-semibold">
                {t.tiimi.remind}
              </legend>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {[7, 3, 2, 1].map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      name="remindDays"
                      value={day}
                      defaultChecked={(task?.remindDaysBefore ?? [1]).includes(
                        day,
                      )}
                      className="h-4 w-4"
                    />
                    {day} pv ennen
                  </label>
                ))}

                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="remindOnDue"
                    defaultChecked={task?.remindOnDue ?? true}
                    className="h-4 w-4"
                  />
                  {t.tiimi.onDueDate}
                </label>

                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="remindOverdue"
                    defaultChecked={task?.remindWhenOverdue ?? true}
                    className="h-4 w-4"
                  />
                  {t.tiimi.whenOverdue}
                </label>
              </div>
            </fieldset>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="rf-press text-[12.5px] font-semibold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.tiimi.addDetails}
          </button>
        )}

        {state.error ? (
          <p
            role="alert"
            className="text-[12.5px]"
            style={{ color: "var(--rf-red-text)" }}
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Submit t={t} label={task ? t.tiimi.save : t.tiimi.createTask} />

          <button
            type="button"
            onClick={onClose}
            className="rf-press px-3.5 py-2 text-[13px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.tiimi.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Submit({ t, label }: { t: AdminText; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2 text-[13px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? t.tiimi.savingEllipsis : label}
    </button>
  );
}
