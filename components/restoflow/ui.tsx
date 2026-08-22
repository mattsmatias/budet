/**
 * Budet'n jaetut esityskomponentit.
 *
 * Apple-henkinen pintakieli yhdessä paikassa: valkoinen kortti, suuri
 * pyöristys, hienovarainen varjo. Väriä käytetään vain tilaan.
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

export type Tone = "neutral" | "ok" | "info" | "warn" | "risk";

const TONE_STYLES: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: { bg: "var(--rf-inset)", text: "var(--rf-text-2)", dot: "var(--rf-text-3)" },
  ok: { bg: "var(--rf-green-bg)", text: "var(--rf-green-text)", dot: "var(--rf-green)" },
  info: { bg: "var(--rf-blue-bg)", text: "var(--rf-blue-text)", dot: "var(--rf-blue)" },
  warn: { bg: "var(--rf-amber-bg)", text: "var(--rf-amber-text)", dot: "var(--rf-amber)" },
  risk: { bg: "var(--rf-red-bg)", text: "var(--rf-red-text)", dot: "var(--rf-red)" },
};

export function Card({
  children,
  className = "",
  hover,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`${hover ? "rf-card-hover" : ""} ${padded ? "p-5" : ""} ${className}`}
      style={{
        background: "var(--rf-card)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: "var(--rf-shadow)",
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"
      style={{
        background: s.bg,
        color: s.text,
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      ) : null}
      {children}
    </span>
  );
}

/**
 * KPI-kortti.
 *
 * `hint` on tarkoitettu kertomaan mitä luku tarkoittaa. Kulukorteissa se
 * sanoo aina "kirjatut kulut", jottei lukua lueta ravintolan tuloksena.
 */
/**
 * Avainluku.
 *
 * Yksi kortti koko sovellukselle. Aiemmin näitä oli kaksi rinnakkain,
 * ja sama luku näytti eri sivuilla eri tuotteelta.
 *
 * Järjestys on tarkoituksellinen: ikoni ja otsikko pieninä ylhäällä,
 * luku suurena, johtopäätös sen alla. Silmä osuu ensin lukuun, ja
 * otsikko kertoo vasta sitten mistä on kyse — juuri niin päin kuin
 * numeroita luetaan.
 */
export function MetricCard({
  label,
  value,
  hint,
  trend,
  conclusion,
  tone = "neutral",
  icon,
  href,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Pieni trendiviiva oikeaan yläkulmaan. */
  trend?: ReactNode;
  /** Johtopäätös luvusta. Ilman tätä kortti on pelkkä numero. */
  conclusion?: ReactNode;
  tone?: "neutral" | "up" | "down" | "muted" | "warn";
  icon?: ReactNode;
  href?: string;
  /** Korostettu kortti: puhelimessa tärkein luku nostetaan esiin. */
  highlight?: boolean;
}) {
  const toneColor =
    tone === "muted"
      ? "var(--rf-text-3)"
      : tone === "up"
        ? "var(--rf-amber-text)"
        : tone === "down"
          ? "var(--rf-green-text)"
          : tone === "warn"
            ? "var(--rf-amber-text)"
            : "var(--rf-text-2)";

  const body = (
    <div
      className="rf-card-lift flex h-full flex-col px-4 py-4"
      style={{
        background: highlight ? "var(--rf-accent-bg)" : "var(--rf-card)",
        border: `1px solid ${highlight ? "transparent" : "var(--rf-line)"}`,
        borderRadius: "var(--rf-r-stat)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center"
              style={{
                background: highlight ? "var(--rf-card)" : "var(--rf-inset)",
                color: "var(--rf-text-2)",
                borderRadius: 8,
              }}
            >
              {icon}
            </span>
          ) : null}
          <p
            className="truncate text-[12px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            {label}
          </p>
        </div>

        {trend ? <div className="shrink-0">{trend}</div> : null}
      </div>

      <p className="rf-tabular mt-2.5 text-[24px] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </p>

      {conclusion ? (
        <p className="rf-tabular mt-2 text-[13px]" style={{ color: toneColor }}>
          {tone === "up" ? <span aria-hidden="true">↑ </span> : null}
          {tone === "down" ? <span aria-hidden="true">↓ </span> : null}
          {conclusion}
        </p>
      ) : null}

      {hint ? (
        <p
          className="mt-auto pt-2 text-[11px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

/**
 * Muutosindikaattori.
 *
 * Kulujen kasvu ei ole hyvä eikä huono ilman kontekstia, joten nuoli on
 * harmaa. Vihreä nuoli laskeville kuluille olisi arvostelma jota ohjelma ei
 * voi tehdä.
 */
export function TrendBadge({ text, direction }: { text: string; direction: "up" | "down" | "flat" | "none" }) {
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "";
  return (
    <span className="rf-tabular text-[13px]" style={{ color: "var(--rf-text-2)" }}>
      {arrow ? <span aria-hidden="true">{arrow} </span> : null}
      {text}
    </span>
  );
}


/**
 * Vaakapalkki kulujen jakaumaan.
 *
 * Yksi harmaa sävy kaikille kategorioille — värikoodattu palkki näyttäisi
 * että kategorioilla on eri merkitys, mitä niillä ei ole.
 */
export function BarRow({
  label,
  valueCents,
  share,
  meta,
  icon,
  muted,
  shareLabel,
}: {
  label: string;
  valueCents: number;
  share: number;
  meta?: string;
  icon?: ReactNode;
  /** Vaimennettu palkki: vertailukohta, ei tarkastelun kohde. */
  muted?: boolean;
  /** Mihin osuus suhteutuu. Oletus: kirjatut kulut. */
  shareLabel?: string;
}) {
  const pct = Math.round(share * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          {icon ? (
            <span className="shrink-0" style={{ color: "var(--rf-text-2)" }}>
              {icon}
            </span>
          ) : null}
          {label}
        </span>
        <span className="rf-tabular text-[14px] font-semibold">
          {formatMoney(valueCents)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="img"
        aria-label={`${label}: ${pct} prosenttia ${shareLabel ?? "kirjatuista kuluista"}`}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.max(1.5, share * 100)}%`,
            background: "var(--rf-text)",
            borderRadius: 999,
            opacity: muted ? 0.32 : 0.82,
          }}
        />
      </div>
      <p className="rf-tabular mt-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {pct} %{meta ? ` · ${meta}` : ""}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="py-12 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p
        className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

/**
 * Demo-huomautus.
 *
 * Näkyy jokaisessa näkymässä. Demo-aineistoa ei saa esittää oikeana, ja
 * kulujen merkitys on kerrottava: kirjatut kuitit, ei pankkitili.
 */
/**
 * Rajausilmoitus.
 *
 * Ei "demo-ilmoitus": sovellus lukee oikeaa aineistoa. Tämä kertoo mitä
 * luvut *eivät* sisällä. Väärä väite omasta aineistosta on pahempi kuin
 * puuttuva selite — kirjautunut käyttäjä ei saa lukea että hänen omat
 * numeronsa ovat keksittyjä.
 */
export function ScopeNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
      style={{
        background: "var(--rf-blue-bg)",
        color: "var(--rf-blue-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 font-semibold">
        i
      </span>
      <p>
        {children ?? (
          <>
            Luvut tarkoittavat{" "}
            <strong>Budetiin kirjattuja kuluja</strong> — sovellus ei
            näe kassaa eikä pankkitiliä.
          </>
        )}
      </p>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2
      className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-[0.04em]"
      style={{ color: "var(--rf-text-2)" }}
    >
      {children}
    </h2>
  );
}


export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </span>
  );
}

/** Ohut ikoni. Yhtenäinen viivanpaksuus koko sovelluksessa. */
export function Icon({
  path,
  size = 20,
  label,
}: {
  path: string;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <path d={path} />
    </svg>
  );
}

export const ICONS = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  receipt: "M6 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3zM9 8h6M9 12h6M9 16h3",
  calendar: "M3 8h18M7 3v3M17 3v3M4 6h16v15H4zM8 12h2M14 12h2M8 16h2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87M16 3.6a4 4 0 0 1 0 7.75",
  bell: "M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  camera: "M4 7h3l1.5-2h7L17 7h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  file: "M14 3v5h5M14 3H6v18h12V8zM9 13h6M9 17h4",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  chevron: "m9 6 6 6-6 6",
  back: "m14 6-6 6 6 6",
  download: "M12 3v12M8 11l4 4 4-4M4 21h16",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  check: "m5 13 4 4L19 7",
  alert: "M12 8v5M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  truck: "M3 7h10v9H3zM13 10h4l3 3v3h-7zM7.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM17.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
} as const;

// ---------------------------------------------------------------------------
// Kategoriat
// ---------------------------------------------------------------------------

import { CategoryIcon } from "./icons";
import type { ExpenseCategory } from "@/lib/restoflow/types";


/** Kategorian ikoni pyöreällä pohjalla — listojen alkuun. */
export function CategoryBubble({
  category,
  size = 34,
}: {
  category: ExpenseCategory;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
      }}
    >
      <CategoryIcon category={category} size={Math.round(size * 0.54)} />
    </span>
  );
}

/**
 * Budjettipalkki.
 *
 * Väri on tässä poikkeuksellisesti merkityksellinen: se kertoo tilan
 * (ok / lähestyy / ylitetty), ei kategoriaa.
 */
export function BudgetBar({
  ratio,
  status,
}: {
  ratio: number | null;
  status: "ok" | "warning" | "exceeded" | "none";
}) {
  if (ratio === null) {
    return (
      <div
        className="h-1.5 w-full"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="img"
        aria-label="Ei budjettia asetettu"
      />
    );
  }

  const color =
    status === "exceeded"
      ? "var(--rf-red)"
      : status === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-green)";

  return (
    <div
      className="relative h-1.5 w-full overflow-hidden"
      style={{ background: "var(--rf-inset)", borderRadius: 999 }}
      role="img"
      aria-label={`${Math.round(ratio * 100)} prosenttia budjetista`}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, Math.max(2, ratio * 100))}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

/** Vakavuusmerkki hälytyksille. */
export function SeverityDot({
  severity,
}: {
  severity: "info" | "warning" | "critical";
}) {
  const color =
    severity === "critical"
      ? "var(--rf-red)"
      : severity === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-blue)";

  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
    />
  );
}

// ---------------------------------------------------------------------------

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_TONES: Record<ButtonTone, { background: string; color: string; border?: string }> = {
  // Ensisijainen toiminto. Sininen tarkoittaa "tästä painetaan" —
  // se ei ole brändipinta eikä sitä käytetä koristeena.
  primary: { background: "var(--rf-accent)", color: "var(--rf-on-accent)" },
  secondary: { background: "var(--rf-inset)", color: "var(--rf-text)" },
  ghost: {
    background: "var(--rf-card)",
    color: "var(--rf-text)",
    border: "1px solid var(--rf-line)",
  },
  danger: { background: "var(--rf-red)", color: "var(--rf-on-accent)" },
};

/**
 * Painike.
 *
 * Aiemmin jokainen painike oli käsin kirjoitettu style-lohko
 * kutsupaikassa, ja niitä oli kymmeniä. Sama "tallenna" näytti eri
 * sivuilla eri kokoiselta. Hierarkia on nyt nimetty: yksi primary per
 * näkymä, muut secondary tai ghost.
 *
 * Kosketuskohde on vähintään 44 px korkea myös pienessä koossa —
 * pienempi on puhelimella ohi osumisen paikka.
 */
export function Button({
  tone = "secondary",
  size = "md",
  full,
  icon,
  children,
  ...rest
}: {
  tone?: ButtonTone;
  size?: "sm" | "md";
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const palette = BUTTON_TONES[tone];

  return (
    <button
      {...rest}
      className={`rf-press inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 ${
        size === "sm" ? "px-3.5 text-[13px]" : "px-4 text-[14px]"
      } ${full ? "w-full" : ""} ${rest.className ?? ""}`}
      style={{
        minHeight: size === "sm" ? 36 : 44,
        background: palette.background,
        color: palette.color,
        border: palette.border ?? "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
        ...rest.style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** Linkki joka näyttää painikkeelta. Sama hierarkia, eri elementti. */
export function ButtonLink({
  href,
  tone = "secondary",
  size = "md",
  full,
  icon,
  children,
}: {
  href: string;
  tone?: ButtonTone;
  size?: "sm" | "md";
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const palette = BUTTON_TONES[tone];

  return (
    <Link
      href={href}
      className={`rf-press inline-flex items-center justify-center gap-2 font-semibold ${
        size === "sm" ? "px-3.5 text-[13px]" : "px-4 text-[14px]"
      } ${full ? "w-full" : ""}`}
      style={{
        minHeight: size === "sm" ? 36 : 44,
        background: palette.background,
        color: palette.color,
        border: palette.border ?? "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
