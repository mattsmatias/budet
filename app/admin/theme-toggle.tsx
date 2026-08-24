"use client";

import { useState } from "react";

/**
 * Teemakytkin.
 *
 * VALINTA ON KOLMIARVOINEN, EI KAKSIARVOINEN.
 *
 * Käyttäjä voi valita vaalean, tumman tai olla valitsematta. Kolmas
 * on oletus, ja silloin ratkaisee käyttöjärjestelmän asetus — ilman
 * sitä sovellus olisi kirkas kello kahdelta yöllä vaikka kaikki muu
 * koneella on tummaa.
 *
 * Valinta luetaan ja kirjoitetaan document.body:n data-theme-määreeseen.
 * Ensimmäinen piirto tulee juuresta ennen tätä komponenttia (ks.
 * app/layout.tsx), jotta sivu ei välähdä väärässä teemassa.
 */
export function ThemeToggle() {
  /*
   * Alkuarvo luetaan DOM:ista eikä tilasta.
   *
   * Palvelin ei tiedä valintaa, joten se piirtää oletuksen. Selaimessa
   * juuren skripti on jo ehtinyt asettaa määreen, ja tämä lukee sen.
   */
  const [mode, setMode] = useState<"light" | "dark" | null>(() =>
    typeof document === "undefined"
      ? null
      : (document.body.dataset.theme as "light" | "dark") ?? null,
  );

  const choose = (next: "light" | "dark") => {
    document.body.dataset.theme = next;
    try {
      localStorage.setItem("budet-theme", next);
    } catch {
      // Yksityinen selausikkuna estää tallennuksen. Valinta toimii
      // silti tämän istunnon ajan, eikä virhe kuulu käyttäjälle.
    }
    setMode(next);
  };

  return (
    <div
      role="group"
      aria-label="Teema"
      suppressHydrationWarning
      className="mt-2.5 flex gap-[3px] p-[3px]"
      style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-pill)" }}
    >
      <Choice
        label="Vaalea"
        active={mode === "light"}
        onSelect={() => choose("light")}
        icon={
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
          </>
        }
      />
      <Choice
        label="Tumma"
        active={mode === "dark"}
        onSelect={() => choose("dark")}
        icon={<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />}
      />
    </div>
  );
}

function Choice({
  label,
  active,
  onSelect,
  icon,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      suppressHydrationWarning
      className="rf-press flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--rf-card)" : "transparent",
        color: active ? "var(--rf-text)" : "var(--rf-text-2)",
        boxShadow: active ? "var(--rf-shadow-sm)" : "none",
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
      {label}
    </button>
  );
}
