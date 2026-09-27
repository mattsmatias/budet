"use client";

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { LOCALE_INFO, type AppLocale } from "@/lib/i18n/app-locales";
import { updateRestaurant, type AdminState } from "../actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";

const initial: AdminState = {};

/**
 * Aikavyöhykkeet joita ravintola voi valita.
 *
 * Lyhyt lista täydellisen IANA-luettelon sijaan: sadan vaihtoehdon
 * pudotusvalikosta oikean löytäminen on vaikeampaa kuin kahdeksan.
 * Kanta hyväksyy minkä tahansa kelvollisen vyöhykkeen, joten listaa voi
 * laajentaa ilman migraatiota.
 */
const TIMEZONES = [
  "Europe/Helsinki",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Tallinn",
  "Europe/Riga",
  "Europe/London",
  "Europe/Berlin",
] as const;

/**
 * Viikonpäivien nimet sivun kielellä.
 *
 * Intl eikä käännöstiedosto: seitsemän nimeä seitsemällä kielellä on
 * 49 riviä joita ei kukaan lue eikä muista päivittää, ja selain osaa
 * ne valmiiksi. Ankkuripäivä on maanantai 5.1.1970, joten indeksi 0 on
 * ISO-viikonpäivä 1 — sama numerointi kuin kannassa.
 */
function weekdayNames(tag: string): string[] {
  const muotoilu = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    timeZone: "UTC",
  });

  return Array.from({ length: 7 }, (_, i) =>
    muotoilu.format(new Date(Date.UTC(1970, 0, 5 + i))),
  );
}

/**
 * Kiinniolopäivät.
 *
 * Valintaruudut eikä monivalintalista: seitsemän vaihtoehtoa mahtuu
 * näkyviin kerralla, ja "mitä on valittu" on silloin luettavissa
 * avaamatta mitään. Rasti on oikea elementti myös siksi että lomake
 * toimii ilman javascriptiä.
 */
function ClosedDays({
  t,
  locale,
  closedWeekdays,
}: {
  t: AdminText;
  locale: AppLocale;
  closedWeekdays: number[];
}) {
  const nimet = weekdayNames(LOCALE_INFO[locale].tag);
  const [valitut, setValitut] = useState<number[]>(closedWeekdays);

  return (
    <div>
      <p className="block text-[13px] font-semibold">{t.asetus.closedDays}</p>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {nimet.map((nimi, i) => {
          const paiva = i + 1;
          const kiinni = valitut.includes(paiva);

          return (
            <label
              key={paiva}
              className="rf-press cursor-pointer select-none px-3 py-2 text-[13.5px] font-medium"
              style={{
                background: kiinni ? "var(--rf-accent-bg)" : "var(--rf-inset)",
                color: kiinni ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <input
                type="checkbox"
                name="closedWeekdays"
                value={paiva}
                checked={kiinni}
                onChange={(e) =>
                  setValitut((edelliset) =>
                    e.target.checked
                      ? [...edelliset, paiva].sort((a, b) => a - b)
                      : edelliset.filter((d) => d !== paiva),
                  )
                }
                className="sr-only"
              />
              {nimi}
            </label>
          );
        })}
      </div>

      <p
        className="mt-1.5 text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {valitut.length === 0
          ? t.asetus.closedDaysNone
          : t.asetus.closedDaysHint}
      </p>
    </div>
  );
}

export function RestaurantForm({
  t,
  locale,
  name,
  timezone,
  closedWeekdays,
}: {
  t: AdminText;
  locale: AppLocale;
  name: string;
  timezone: string;
  closedWeekdays: number[];
}) {
  const [state, action] = useActionState(updateRestaurant, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label={t.asetus.restaurantName} htmlFor="rf-name">
        <input
          id="rf-name"
          name="name"
          defaultValue={name}
          required
          maxLength={120}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field
        label={t.asetus.timezone}
        htmlFor="rf-tz"
        hint={t.asetus.timezoneHint}
      >
        <select
          id="rf-tz"
          name="timezone"
          defaultValue={timezone}
          className={CONTROL}
          style={CONTROL_STYLE}
        >
          {(TIMEZONES as readonly string[]).includes(timezone) ? null : (
            <option value={timezone}>{timezone}</option>
          )}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Field>

      <ClosedDays t={t} locale={locale} closedWeekdays={closedWeekdays} />

      <SaveRow t={t} state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
