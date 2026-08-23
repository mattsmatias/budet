"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setLunchTheme, type LunchState } from "./actions";
import {
  LUNCH_THEMES,
  LUNCH_THEME_HINTS,
  LUNCH_THEME_LABELS,
  type LunchTheme,
} from "@/lib/restoflow/lunch-themes";

const initial: LunchState = {};
const ORDER: LunchTheme[] = ["light", "dark", "classic"];

/**
 * Julkisen lounassivun teema.
 *
 * Kolme vaihtoehtoa, jokaisella oma käyttötarkoitus. Valinta näytetään
 * pienoiskuvana eikä nimenä: "Klassinen" ei kerro miltä se näyttää, ja
 * teeman valitseminen sokkona tarkoittaa että sivu käydään katsomassa
 * kolme kertaa.
 *
 * Pienoiskuva piirretään samoista arvoista kuin oikea sivu. Erillinen
 * kuva ajautuisi erilleen heti kun jokin sävy muuttuu.
 */
export function LunchThemePicker({ current }: { current: LunchTheme }) {
  const [state, action] = useActionState(setLunchTheme, initial);

  return (
    <div>
      <p
        className="text-[11px] font-medium uppercase"
        style={{ color: "var(--rf-text-3)", letterSpacing: "0.05em" }}
      >
        Julkisen sivun teema
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {ORDER.map((theme) => (
          <ThemeOption
            key={theme}
            theme={theme}
            selected={theme === current}
            action={action}
          />
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="mt-2 text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function ThemeOption({
  theme,
  selected,
  action,
}: {
  theme: LunchTheme;
  selected: boolean;
  action: (formData: FormData) => void;
}) {
  const tokens = LUNCH_THEMES[theme];

  return (
    <form action={action}>
      <input type="hidden" name="theme" value={theme} />

      <Choice selected={selected}>
        {/* Pienoiskuva samoista arvoista kuin oikea sivu. */}
        <span
          aria-hidden="true"
          className="block overflow-hidden rounded-[8px] p-2"
          style={{ background: tokens.bg }}
        >
          <span
            className="block rounded-[5px] px-2 py-1.5"
            style={{
              background: tokens.card,
              border: `1px solid ${tokens.cardBorder}`,
              boxShadow: tokens.cardShadow,
            }}
          >
            <span
              className="block text-[9px] font-semibold"
              style={{
                color: tokens.text,
                fontFamily: tokens.headingFont,
                letterSpacing: tokens.headingTracking,
              }}
            >
              MAANANTAI
            </span>
            <span className="mt-1 block h-1 w-full rounded-full" style={{ background: tokens.line }} />
            <span className="mt-1 block h-1 w-3/4 rounded-full" style={{ background: tokens.line }} />
          </span>
        </span>

        <span className="mt-2 block text-[13px] font-semibold">
          {LUNCH_THEME_LABELS[theme]}
        </span>
        <span
          className="mt-0.5 block text-[11px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {LUNCH_THEME_HINTS[theme]}
        </span>
      </Choice>
    </form>
  );
}

/**
 * Painike joka näyttää valitun.
 *
 * Valinta merkitään sekä reunalla että aria-pressedillä: pelkkä väri
 * ei kerro ruudunlukijalle kumpi on käytössä.
 */
function Choice({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-pressed={selected}
      disabled={pending}
      className="rf-press w-full p-2 text-left disabled:opacity-60"
      style={{
        background: "var(--rf-card)",
        border: `1px solid ${selected ? "var(--rf-accent)" : "var(--rf-line)"}`,
        boxShadow: selected ? "0 0 0 1px var(--rf-accent)" : "none",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {children}
    </button>
  );
}
