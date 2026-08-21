import Link from "next/link";
import type { ReactNode } from "react";
import { RfIcon } from "./icons";

/**
 * Yleiskuvan omat rakennuspalat.
 *
 * Erillään yleisistä komponenteista, koska yleiskuvassa on tiukempi
 * sääntö kuin muualla: jokainen luku esittää myös johtopäätöksen, ja
 * puuttuva tieto sanotaan ääneen sen sijaan että näytettäisiin nolla.
 */

// ---------------------------------------------------------------------------

/**
 * Yleiskuvan KPI-kortti.
 *
 * Kevyempi kuin MetricCard: ohut raja varjon sijaan ja pienempi
 * pyöristys. Neljä korttia vierekkäin painavina laatikoina veisi
 * huomion siltä mikä niissä lukee.
 */
export function StatCard({
  label,
  value,
  conclusion,
  tone = "neutral",
  hint,
  href,
}: {
  label: string;
  value: string;
  /** Johtopäätös luvusta. Ilman tätä kortti on pelkkä numero. */
  conclusion?: ReactNode;
  tone?: "neutral" | "up" | "down" | "muted";
  hint?: string;
  href?: string;
}) {
  const body = (
    <div
      className="rf-card-lift h-full px-4 py-4"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-stat)",
      }}
    >
      <p className="text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </p>

      <p className="rf-tabular mt-2.5 text-[26px] font-semibold leading-none">
        {value}
      </p>

      {conclusion ? (
        <p
          className="rf-tabular mt-2 text-[13px]"
          style={{
            color:
              tone === "muted"
                ? "var(--rf-text-3)"
                : tone === "up"
                  ? "var(--rf-amber-text)"
                  : tone === "down"
                    ? "var(--rf-green-text)"
                    : "var(--rf-text-2)",
          }}
        >
          {tone === "up" ? <span aria-hidden="true">↑ </span> : null}
          {tone === "down" ? <span aria-hidden="true">↓ </span> : null}
          {conclusion}
        </p>
      ) : null}

      {hint ? (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
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

// ---------------------------------------------------------------------------

/** Yleiskuvan osiokortti: otsikko, valinnainen "Kaikki →" ja sisältö. */
export function Panel({
  title,
  subtitle,
  href,
  linkLabel = "Kaikki",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="flex h-full flex-col px-5 py-5"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {href ? (
          <Link
            href={href}
            className="shrink-0 whitespace-nowrap text-[13px] font-medium"
            style={{ color: "var(--rf-blue)" }}
          >
            {linkLabel} →
          </Link>
        ) : null}
      </div>

      <div className="flex-1">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Moduulin tyhjä tila.
 *
 * Aina selitys ja tarvittaessa polku eteenpäin. Pelkkä "0 €" jättää
 * käyttäjän arvailemaan onko kyse tyhjästä kuukaudesta vai rikkinäisestä
 * näkymästä.
 */
export function PanelEmpty({
  text,
  cta,
  href,
}: {
  text: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="py-2">
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        {text}
      </p>

      {cta && href ? (
        <Link
          href={href}
          className="rf-press mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: "var(--rf-blue)" }}
        >
          {cta}
          <RfIcon name="chevron" size={13} />
        </Link>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Hienovarainen vaakapalkki.
 *
 * Palkki on harmaa, ei värillinen: värillä on tässä sovelluksessa
 * merkitys, eikä "ruoka on suurin kategoria" ole tila josta pitäisi
 * hälyttää.
 */
export function ShareBar({ share }: { share: number }) {
  return (
    <div
      className="mt-2 h-[5px] w-full overflow-hidden"
      style={{ background: "var(--rf-inset)", borderRadius: 999 }}
    >
      <div
        className="rf-bar h-full"
        style={{
          width: `${Math.max(2, Math.min(100, share * 100))}%`,
          background: "var(--rf-text)",
          opacity: 0.75,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

/**
 * Budjettipalkki.
 *
 * Väri kertoo tilan, mutta ei yksin: prosentti ja sana ovat aina
 * vieressä. Värisokea käyttäjä lukee saman tiedon.
 */
export function BudgetBarLine({
  tone,
  ratio,
}: {
  tone: "normal" | "warning" | "critical" | "over";
  ratio: number;
}) {
  const color =
    tone === "over" || tone === "critical"
      ? "var(--rf-red)"
      : tone === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-text)";

  return (
    <div
      className="mt-2 h-[5px] w-full overflow-hidden"
      style={{ background: "var(--rf-inset)", borderRadius: 999 }}
    >
      <div
        className="rf-bar h-full"
        style={{
          width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
          background: color,
          opacity: tone === "normal" ? 0.75 : 1,
          borderRadius: 999,
        }}
      />
    </div>
  );
}
