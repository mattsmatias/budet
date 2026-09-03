"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import type {
  DiningArea,
  FullSettings,
  ReservationDuration,
  ReservationException,
  ReservationHour,
  RestaurantTable,
  TableCombination,
} from "@/lib/restoflow/reservations";
import { hourConflicts, hourSpanMinutes } from "@/lib/restoflow/reservations";
import {
  addArea,
  addDuration,
  addException,
  removeArea,
  removeCombination,
  removeDuration,
  removeException,
  removeTable,
  saveCombination,
  saveHours,
  saveSettings,
  saveTable,
  type SetupState,
} from "./actions";

const initial: SetupState = {};

// ---------------------------------------------------------------------------
// Yhteiset osat
// ---------------------------------------------------------------------------

function Notice({ state }: { state: SetupState }) {
  if (!state.error && !state.notice) return null;

  return (
    <p
      role={state.error ? "alert" : "status"}
      className="mt-3 text-[13px]"
      style={{
        color: state.error ? "var(--rf-red-text)" : "var(--rf-green-text)",
      }}
    >
      {state.error ?? state.notice}
    </p>
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
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
      </label>
      {hint ? (
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const INPUT = "w-full px-3.5 py-2.5 text-[16px] outline-none";
const INPUT_STYLE = {
  background: "var(--rf-inset)",
  borderRadius: "var(--rf-r-control)",
} as const;

/** Poistopainike joka kysyy varmistuksen ennen kuin poistaa. */
function DeleteButton({
  action,
  id,
  label,
  confirm,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  confirm: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={label}
        className="rf-press rf-icon-btn rf-hit flex h-7 w-7 items-center justify-center rounded-[7px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        <RfIcon name="trash" size={14} />
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" tone="danger">
        {confirm}
      </Button>
      <Button
        type="button"
        size="sm"
        tone="ghost"
        onClick={() => setAsking(false)}
      >
        ×
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Perusasetukset
// ---------------------------------------------------------------------------

/**
 * Avattava osio harvoin tarvittaville.
 *
 * details eikä oma tilansa: selain hoitaa avaamisen, ja kentät ovat
 * lomakkeen sisällä myös suljettuna — piilotettu kenttä lähtee
 * tallennuksessa mukana eikä nollaudu. Oma tila olisi tähän kolme
 * riviä koodia enemmän ja yksi tapa mennä rikki.
 */
function Advanced({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-5">
      <summary
        className="cursor-pointer text-[13px] font-semibold"
        style={{ color: "var(--rf-text-2)" }}
      >
        {label}
      </summary>
      <div className="mt-3.5">{children}</div>
    </details>
  );
}

/**
 * Verkkovarauksen käyttöönotto.
 *
 * NÄKYVISSÄ VAIN SE MITÄ JOKU OIKEASTI VAIHTAA.
 *
 * Käyttöönotto ja korostusväri. Loput kahdeksan asetusta ovat
 * Lisäasetusten takana, koska niiden oletukset ovat oikeat: puolen
 * tunnin välein, puolitoista tuntia pöytä, tunti ennen viimeistään.
 * Ravintola joka haluaa muuttaa niitä löytää ne; ravintola joka ei
 * halua ei joudu ohittamaan niitä päästäkseen upotuskoodiin.
 */
export function SettingsForm({
  t,
  settings,
}: {
  t: AdminText;
  settings: FullSettings;
}) {
  const [state, action] = useActionState(saveSettings, initial);
  const [enabled, setEnabled] = useState(settings.enabled);

  return (
    <form action={action}>
      <input type="hidden" name="enabled" value={enabled ? "1" : "0"} />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] shrink-0"
        />
        <span>
          <span className="block text-[14px] font-semibold">
            {t.varausAsetus.enabled}
          </span>
          <span
            className="mt-0.5 block text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.varausAsetus.enabledHint}
          </span>
        </span>
      </label>

      {/*
        Korostusväri on näkyvissä, koska se on ainoa asetus jonka
        asiakas näkee. Muut vaikuttavat siihen milloin varauksia
        otetaan, ja niissä oletus on oikea.
      */}
      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <Field label={t.varausAsetus.themeColor} htmlFor="rs-color">
          <input
            id="rs-color"
            name="themeColor"
            type="color"
            defaultValue={settings.themeColor}
            className="h-11 w-full cursor-pointer"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          />
        </Field>

        <Field label={t.varausAsetus.themeDark} htmlFor="rs-dark">
          <select
            id="rs-dark"
            name="themeDark"
            defaultValue={settings.themeDark ? "1" : "0"}
            className={INPUT}
            style={INPUT_STYLE}
          >
            <option value="0">{t.varausAsetus.themeLightOption}</option>
            <option value="1">{t.varausAsetus.themeDarkOption}</option>
          </select>
        </Field>
      </div>

      <Advanced label={t.varausAsetus.advanced}>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label={t.varausAsetus.slotMinutes}
            htmlFor="rs-slot"
            hint={t.varausAsetus.slotHint}
          >
            <select
              id="rs-slot"
              name="slotMinutes"
              defaultValue={String(settings.slotMinutes)}
              className={INPUT}
              style={INPUT_STYLE}
            >
              {[15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {fill(t.varausAsetus.minutes, { maara: String(n) })}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={t.varausAsetus.defaultDuration}
            htmlFor="rs-duration"
            hint={t.varausAsetus.defaultDurationHint}
          >
            <input
              id="rs-duration"
              name="defaultDurationMinutes"
              type="number"
              min={15}
              max={600}
              step={15}
              defaultValue={settings.defaultDurationMinutes}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label={t.varausAsetus.turnaround}
            htmlFor="rs-turn"
            hint={t.varausAsetus.turnaroundHint}
          >
            <input
              id="rs-turn"
              name="turnaroundMinutes"
              type="number"
              min={0}
              max={120}
              step={5}
              defaultValue={settings.turnaroundMinutes}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label={t.varausAsetus.leadMinutes}
            htmlFor="rs-lead"
            hint={t.varausAsetus.leadHint}
          >
            <input
              id="rs-lead"
              name="leadMinutes"
              type="number"
              min={0}
              max={10080}
              step={15}
              defaultValue={settings.leadMinutes}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          {/*
            Keittiön kapasiteetti pöytäkapasiteetin viereen.

            Ne ovat eri asioita ja vastaavat eri kysymyksiin: pöytiä
            voi olla vapaana vaikka keittiö ei ehdi. Vierekkäin ne
            kertovat sen ilman että kumpaakaan tarvitsee selittää.
          */}
          <Field
            label={t.varausAsetus.kitchenCapacity}
            htmlFor="rs-kitchen"
            hint={t.varausAsetus.kitchenCapacityHint}
          >
            <input
              id="rs-kitchen"
              name="kitchenCapacity"
              type="number"
              min={1}
              max={2000}
              /*
               * Tyhjä on sallittu arvo eikä puuttuva.
               *
               * Se tarkoittaa "ei rajaa", ja se on eri asia kuin
               * nolla — nolla estäisi kaikki varaukset.
               */
              defaultValue={settings.kitchenCapacity ?? ""}
              placeholder="—"
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label={t.varausAsetus.kitchenWindow}
            htmlFor="rs-kitchen-window"
            hint={t.varausAsetus.kitchenWindowHint}
          >
            <input
              id="rs-kitchen-window"
              name="kitchenWindowMinutes"
              type="number"
              min={15}
              max={240}
              step={15}
              defaultValue={settings.kitchenWindowMinutes}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          {/*
            Peruutusraja verkkoasetusten joukkoon.

            Se koskee vain asiakkaan omaa peruutuslinkkiä: sali peruu
            varauksen milloin tahansa, koska tieto siitä ettei seurue
            tule on arvokas myös kymmenen minuuttia ennen.
          */}
          <Field
            label={t.varausAsetus.cancelCutoff}
            htmlFor="rs-cutoff"
            hint={t.varausAsetus.cancelCutoffHint}
          >
            <input
              id="rs-cutoff"
              name="cancelCutoffHours"
              type="number"
              min={0}
              max={168}
              defaultValue={settings.cancelCutoffHours}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label={t.varausAsetus.minParty} htmlFor="rs-min">
            <input
              id="rs-min"
              name="minParty"
              type="number"
              min={1}
              defaultValue={settings.minParty}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label={t.varausAsetus.maxParty}
            htmlFor="rs-max"
            hint={t.varausAsetus.maxPartyHint}
          >
            <input
              id="rs-max"
              name="maxParty"
              type="number"
              min={1}
              defaultValue={settings.maxParty}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field
            label={t.varausAsetus.maxDaysAhead}
            htmlFor="rs-days"
            hint={t.varausAsetus.maxDaysHint}
          >
            <input
              id="rs-days"
              name="maxDaysAhead"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.maxDaysAhead}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>

          <Field label={t.varausAsetus.themeRadius} htmlFor="rs-radius">
            <input
              id="rs-radius"
              name="themeRadius"
              type="number"
              min={0}
              max={28}
              defaultValue={settings.themeRadius}
              className={INPUT}
              style={INPUT_STYLE}
            />
          </Field>
        </div>
      </Advanced>

      <div className="mt-5">
        <SaveButton t={t} />
      </div>
      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Aukioloajat
// ---------------------------------------------------------------------------

/**
 * Aukioloajat koko viikolle.
 *
 * ---------------------------------------------------------------------
 * KOPIOINTI ON SE MIKSI TÄMÄ EI OLE SEITSEMÄN LOMAKETTA
 * ---------------------------------------------------------------------
 *
 * Useimmilla ravintoloilla viikko on sama joka päivä paitsi
 * viikonloppuna. Käsin se on neljätoista kellonaikaa näpyteltynä
 * puhelimen aikavalitsimella, ja juuri siinä tehdään se virhe joka
 * huomataan vasta kun asiakas ei saa varattua.
 *
 * "Kopioi muille" ottaa rivin kellonajat ja asettaa ne kaikkiin
 * päiviin joissa on jo aika. Tyhjä päivä pysyy tyhjänä: tyhjä on
 * merkintä "kiinni", eikä kopiointi saa avata suljettua päivää
 * kysymättä.
 *
 * ---------------------------------------------------------------------
 * VAROITUS EIKÄ ESTO
 * ---------------------------------------------------------------------
 *
 * Kun ilta saa jatkua keskiyön yli, kaksi peräkkäistä päivää voi mennä
 * päällekkäin: lauantai kolmeen ja sunnuntai avautuu kahdelta. Kanta
 * ottaa molemmat vastaan, mutta salinäkymä joutuu silloin päättämään
 * kumpaan iltaan kello 02:30 alkava varaus kuuluu.
 *
 * Aukiolo on ravintolan päätös, joten tämä kertoo seurauksen eikä estä
 * tallennusta.
 */
export function HoursForm({
  t,
  hours,
  weekdayNames,
}: {
  t: AdminText;
  hours: ReservationHour[];
  weekdayNames: string[];
}) {
  const [state, action] = useActionState(saveHours, initial);

  /*
   * Kentät ovat komponentin tilassa eivätkä ohjaamattomia.
   *
   * Kopiointi kirjoittaa toisen rivin arvot, ja varoitus lasketaan
   * siitä mitä ruudulla lukee — kumpikaan ei onnistu ilman että
   * lomake tietää arvonsa.
   */
  const [rows, setRows] = useState(() =>
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const row = hours.find((h) => h.weekday === weekday);
      return {
        weekday,
        opens: row?.opens ?? "",
        lastSeating: row?.lastSeating ?? "",
      };
    }),
  );

  function aseta(weekday: number, kentta: "opens" | "lastSeating", arvo: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.weekday === weekday ? { ...row, [kentta]: arvo } : row,
      ),
    );
  }

  /** Rivin ajat kaikkiin päiviin joissa on jo aika. */
  function kopioi(weekday: number) {
    const lahde = rows.find((row) => row.weekday === weekday);
    if (!lahde || !lahde.opens || !lahde.lastSeating) return;

    setRows((prev) =>
      prev.map((row) =>
        row.opens || row.lastSeating
          ? { ...row, opens: lahde.opens, lastSeating: lahde.lastSeating }
          : row,
      ),
    );
  }

  const taytetyt = rows.filter((row) => row.opens && row.lastSeating);
  const conflicts = hourConflicts(taytetyt);

  return (
    <form action={action}>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.hoursHint}
      </p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
        {t.varausAsetus.hoursMidnight}
      </p>

      <div className="mt-4 space-y-2">
        {rows.map((row) => {
          const nimi = weekdayNames[row.weekday - 1];
          const span =
            row.opens && row.lastSeating
              ? hourSpanMinutes(row.opens, row.lastSeating)
              : 0;

          /* Ilta joka ylittää keskiyön saa merkinnän: se on harvinainen. */
          const yli =
            span > 0 && row.lastSeating <= row.opens
              ? fill(t.varausAsetus.hoursNextDay, {
                  tunnit: String(Math.round((span / 60) * 10) / 10),
                })
              : null;

          return (
            <div key={row.weekday} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[13px] font-medium">
                {nimi}
              </span>

              <input
                type="time"
                name={`opens-${row.weekday}`}
                value={row.opens}
                onChange={(event) =>
                  aseta(row.weekday, "opens", event.target.value)
                }
                aria-label={`${nimi} — ${t.varausAsetus.opens}`}
                className="min-w-0 flex-1 px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />
              <span
                aria-hidden="true"
                className="text-[13px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                –
              </span>
              <input
                type="time"
                name={`last-${row.weekday}`}
                value={row.lastSeating}
                onChange={(event) =>
                  aseta(row.weekday, "lastSeating", event.target.value)
                }
                aria-label={`${nimi} — ${t.varausAsetus.lastSeating}`}
                className="min-w-0 flex-1 px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />

              {yli ? (
                <span
                  className="shrink-0 text-[11.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {yli}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => kopioi(row.weekday)}
                disabled={!row.opens || !row.lastSeating}
                className="rf-press shrink-0 px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40"
                style={{
                  background: "var(--rf-inset)",
                  color: "var(--rf-text-2)",
                  borderRadius: "var(--rf-r-control)",
                }}
                title={t.varausAsetus.copyToOthers}
              >
                {t.varausAsetus.copyShort}
              </button>
            </div>
          );
        })}
      </div>

      {conflicts.length > 0 ? (
        <p
          role="status"
          className="mt-3 text-[12.5px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {conflicts
            .map((conflict) =>
              fill(t.varausAsetus.hoursOverlap, {
                paiva: weekdayNames[conflict.weekday - 1],
                seuraava: weekdayNames[conflict.nextWeekday - 1],
                aika: conflict.until,
              }),
            )
            .join(" ")}
        </p>
      ) : null}

      <div className="mt-5">
        <SaveButton t={t} />
      </div>
      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kestot
// ---------------------------------------------------------------------------

export function DurationList({
  t,
  durations,
}: {
  t: AdminText;
  durations: ReservationDuration[];
}) {
  const [state, action] = useActionState(addDuration, initial);

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.durationHint}
      </p>

      {durations.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {durations.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="text-[13px]">
                {fill(t.varausAsetus.durationRule, {
                  koko:
                    rule.maxParty === null
                      ? fill(t.varausAsetus.partyFrom, {
                          maara: String(rule.minParty),
                        })
                      : `${rule.minParty}–${rule.maxParty}`,
                  minuutit: String(rule.minutes),
                })}
              </span>
              <DeleteButton
                action={removeDuration}
                id={rule.id}
                label={t.varausAsetus.remove}
                confirm={t.varausAsetus.confirmRemove}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-20">
          <Field label={t.varausAsetus.fromParty} htmlFor="rd-min">
            <input
              id="rd-min"
              name="minParty"
              type="number"
              min={1}
              required
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
        <div className="w-20">
          <Field label={t.varausAsetus.toParty} htmlFor="rd-max">
            <input
              id="rd-max"
              name="maxParty"
              type="number"
              min={1}
              placeholder="—"
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
        <div className="w-28">
          <Field label={t.varausAsetus.minutesLabel} htmlFor="rd-minutes">
            <input
              id="rd-minutes"
              name="minutes"
              type="number"
              min={15}
              max={600}
              step={15}
              required
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
        <Button
          type="submit"
          tone="ghost"
          icon={<RfIcon name="plus" size={15} />}
        >
          {t.varausAsetus.add}
        </Button>
      </form>
      <Notice state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Poikkeukset
// ---------------------------------------------------------------------------

export function ExceptionList({
  t,
  exceptions,
}: {
  t: AdminText;
  /*
   * Päivämäärä tulee valmiiksi muotoiltuna.
   *
   * Muotoilufunktiota ei voi välittää palvelimelta clientille — sitä
   * ei voi sarjallistaa. Selaimessa muotoiltuna Intl käyttäisi
   * selaimen kieltä eikä käyttäjän valitsemaa, joten päivä on
   * muotoiltu siellä missä kieli tiedetään.
   */
  exceptions: (ReservationException & { label: string })[];
}) {
  const [state, action] = useActionState(addException, initial);
  const [closed, setClosed] = useState(true);

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.exceptionHint}
      </p>

      {exceptions.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {exceptions.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="text-[13px]">
                <span className="font-medium">{row.label}</span>
                {" · "}
                {row.closed
                  ? t.varausAsetus.exceptionClosed
                  : `${row.opens}–${row.lastSeating}`}
                {row.note ? ` · ${row.note}` : ""}
              </span>
              <DeleteButton
                action={removeException}
                id={row.id}
                label={t.varausAsetus.remove}
                confirm={t.varausAsetus.confirmRemove}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="closed" value={closed ? "1" : "0"} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Field label={t.varausAsetus.exceptionDate} htmlFor="re-date">
              <input
                id="re-date"
                name="date"
                type="date"
                required
                className="w-full px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />
            </Field>
          </div>

          {!closed ? (
            <>
              <div className="w-28">
                <Field label={t.varausAsetus.opens} htmlFor="re-opens">
                  <input
                    id="re-opens"
                    name="opens"
                    type="time"
                    className="w-full px-3 py-2 text-[15px] outline-none"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>
              <div className="w-28">
                <Field label={t.varausAsetus.lastSeating} htmlFor="re-last">
                  <input
                    id="re-last"
                    name="last"
                    type="time"
                    className="w-full px-3 py-2 text-[15px] outline-none"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>
            </>
          ) : null}

          <Button
            type="submit"
            tone="ghost"
            icon={<RfIcon name="plus" size={15} />}
          >
            {t.varausAsetus.add}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={closed}
            onChange={(event) => setClosed(event.target.checked)}
            className="h-[16px] w-[16px]"
          />
          {t.varausAsetus.exceptionClosedLabel}
        </label>
      </form>
      <Notice state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alueet
// ---------------------------------------------------------------------------

export function AreaList({ t, areas }: { t: AdminText; areas: DiningArea[] }) {
  const [state, action] = useActionState(addArea, initial);

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.areaHint}
      </p>

      {areas.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {areas.map((area) => (
            <li
              key={area.id}
              className="flex items-center gap-1 py-1 pl-3 pr-1 text-[13px]"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-pill)",
              }}
            >
              {area.name}
              <DeleteButton
                action={removeArea}
                id={area.id}
                label={t.varausAsetus.remove}
                confirm={t.varausAsetus.confirmRemove}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-3 flex items-end gap-2">
        <div className="max-w-xs flex-1">
          <Field label={t.varausAsetus.areaName} htmlFor="ra-name">
            <input
              id="ra-name"
              name="name"
              required
              maxLength={60}
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>
        <Button
          type="submit"
          tone="ghost"
          icon={<RfIcon name="plus" size={15} />}
        >
          {t.varausAsetus.add}
        </Button>
      </form>
      <Notice state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pöydät
// ---------------------------------------------------------------------------

export function TableList({
  t,
  tables,
  areas,
}: {
  t: AdminText;
  tables: RestaurantTable[];
  areas: DiningArea[];
}) {
  const [state, action] = useActionState(saveTable, initial);
  const [editing, setEditing] = useState<string | null>(null);

  const current = tables.find((table) => table.id === editing) ?? null;

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.tableHint}
      </p>

      {tables.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
                opacity: table.active ? 1 : 0.55,
              }}
            >
              <span className="text-[13px]">
                <span className="font-semibold">{table.name}</span>
                {" · "}
                {fill(t.varaus.seatsRange, {
                  min: String(table.seatsMin),
                  max: String(table.seatsMax),
                })}
                {table.areaId
                  ? ` · ${areas.find((a) => a.id === table.areaId)?.name ?? ""}`
                  : ""}
                {table.active ? "" : ` · ${t.varaus.stateDisabled}`}
              </span>

              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setEditing(table.id === editing ? null : table.id)
                  }
                  aria-label={fill(t.varaus.editNamed, { nimi: table.name })}
                  className="rf-press rf-icon-btn rf-hit flex h-7 w-7 items-center justify-center rounded-[7px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  <RfIcon name="settings" size={14} />
                </button>
                <DeleteButton
                  action={removeTable}
                  id={table.id}
                  label={t.varausAsetus.remove}
                  confirm={t.varausAsetus.confirmRemove}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Sama lomake lisää ja muokkaa. key pakottaa Reactin luomaan
        kentät uudelleen kun muokattava vaihtuu — muuten defaultValue
        jäisi edellisen pöydän arvoihin.
      */}
      <form
        key={current?.id ?? "uusi"}
        action={action}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        {current ? <input type="hidden" name="id" value={current.id} /> : null}
        <input
          type="hidden"
          name="active"
          value={current?.active === false ? "0" : "1"}
        />

        <div className="w-28">
          <Field label={t.varausAsetus.tableName} htmlFor="rt-name">
            <input
              id="rt-name"
              name="name"
              required
              maxLength={40}
              defaultValue={current?.name ?? ""}
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        <div className="w-20">
          <Field label={t.varausAsetus.seatsMin} htmlFor="rt-min">
            <input
              id="rt-min"
              name="seatsMin"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={current?.seatsMin ?? 1}
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        <div className="w-20">
          <Field label={t.varausAsetus.seatsMax} htmlFor="rt-max">
            <input
              id="rt-max"
              name="seatsMax"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={current?.seatsMax ?? 2}
              className="w-full px-3 py-2 text-[15px] outline-none"
              style={INPUT_STYLE}
            />
          </Field>
        </div>

        {areas.length > 0 ? (
          <div className="w-36">
            <Field label={t.varausAsetus.area} htmlFor="rt-area">
              <select
                id="rt-area"
                name="areaId"
                defaultValue={current?.areaId ?? ""}
                className="w-full px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              >
                <option value="">{t.varaus.noArea}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        <Button
          type="submit"
          tone="ghost"
          icon={<RfIcon name="plus" size={15} />}
        >
          {current ? t.varaus.save : t.varausAsetus.add}
        </Button>

        {current ? (
          <Button type="button" tone="ghost" onClick={() => setEditing(null)}>
            {t.varausAsetus.cancelEdit}
          </Button>
        ) : null}
      </form>
      <Notice state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yhdistelmät
// ---------------------------------------------------------------------------

export function CombinationList({
  t,
  combinations,
  tables,
}: {
  t: AdminText;
  combinations: TableCombination[];
  tables: RestaurantTable[];
}) {
  const [state, action] = useActionState(saveCombination, initial);
  const [chosen, setChosen] = useState<string[]>([]);

  const nimi = (id: string) =>
    tables.find((table) => table.id === id)?.name ?? "?";

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausAsetus.combinationHint}
      </p>

      {combinations.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {combinations.map((combo) => (
            <li
              key={combo.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="text-[13px]">
                <span className="font-semibold">
                  {combo.name ?? combo.tableIds.map(nimi).join(" + ")}
                </span>
                {" · "}
                {fill(t.varaus.seatsRange, {
                  min: String(combo.seatsMin),
                  max: String(combo.seatsMax),
                })}
              </span>
              <DeleteButton
                action={removeCombination}
                id={combo.id}
                label={t.varausAsetus.remove}
                confirm={t.varausAsetus.confirmRemove}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-4">
        <fieldset>
          <legend className="text-[13px] font-medium">
            {t.varausAsetus.combinationTables}
          </legend>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {tables.map((table) => {
              const on = chosen.includes(table.id);
              return (
                <label
                  key={table.id}
                  className="rf-press cursor-pointer px-3 py-1.5 text-[13px] font-medium"
                  style={{
                    background: on ? "var(--rf-accent)" : "var(--rf-inset)",
                    color: on ? "var(--rf-on-accent)" : "var(--rf-text)",
                    borderRadius: "var(--rf-r-pill)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="tableId"
                    value={table.id}
                    checked={on}
                    onChange={(event) =>
                      setChosen((prev) =>
                        event.target.checked
                          ? [...prev, table.id]
                          : prev.filter((id) => id !== table.id),
                      )
                    }
                    className="sr-only"
                  />
                  {table.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-20">
            <Field label={t.varausAsetus.seatsMin} htmlFor="rc-min">
              <input
                id="rc-min"
                name="seatsMin"
                type="number"
                min={1}
                required
                className="w-full px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />
            </Field>
          </div>
          <div className="w-20">
            <Field label={t.varausAsetus.seatsMax} htmlFor="rc-max">
              <input
                id="rc-max"
                name="seatsMax"
                type="number"
                min={1}
                required
                className="w-full px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />
            </Field>
          </div>
          <div className="w-40">
            <Field label={t.varausAsetus.combinationName} htmlFor="rc-name">
              <input
                id="rc-name"
                name="name"
                maxLength={60}
                className="w-full px-3 py-2 text-[15px] outline-none"
                style={INPUT_STYLE}
              />
            </Field>
          </div>
          <Button
            type="submit"
            tone="ghost"
            icon={<RfIcon name="plus" size={15} />}
          >
            {t.varausAsetus.add}
          </Button>
        </div>
      </form>
      <Notice state={state} />
    </div>
  );
}
