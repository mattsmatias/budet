/**
 * Verran jaetut UI-primitiivit (§41).
 *
 * Nämä ovat esitystason komponentteja: ne eivät laske veroa, eivät kutsu
 * palveluita eivätkä tiedä mistä data tulee. Liiketoimintalogiikka on
 * lib/-hakemistossa (§39).
 */

import type { ReactNode } from "react";
import type { ConfidenceBand } from "@/lib/tax/types";
import { formatRate } from "@/lib/money";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Merkit
// ---------------------------------------------------------------------------

const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function VatBadge({
  code,
  rate,
  reverseCharge,
}: {
  code?: string;
  rate?: number;
  reverseCharge?: boolean;
}) {
  if (!code) {
    return (
      <span className={cx(BADGE_BASE, "bg-navy-100 text-navy-600")}>
        Ei ALV-koodia
      </span>
    );
  }
  return (
    <span className={cx(BADGE_BASE, "bg-navy-800 text-navy-100 tabular")}>
      <span className="font-mono">{code}</span>
      {reverseCharge ? (
        <span className="text-gold-300">käännetty</span>
      ) : rate !== undefined ? (
        <span className="text-navy-200">{formatRate(rate)}</span>
      ) : null}
    </span>
  );
}

const CONFIDENCE_STYLES: Record<ConfidenceBand, { cls: string; label: string }> = {
  high: { cls: "bg-ok-100 text-ok-600", label: "Korkea" },
  medium: { cls: "bg-warn-100 text-warn-600", label: "Keskitaso" },
  low: { cls: "bg-risk-100 text-risk-600", label: "Matala" },
};

/**
 * Luottamus näytetään kolmiportaisena, ei prosenttina. Numeerinen arvo
 * lasketaan sisäisesti mutta sitä ei esitetä tarkkuutena jota sillä ei ole (§24).
 */
export function ConfidenceBadge({ band }: { band: ConfidenceBand }) {
  const style = CONFIDENCE_STYLES[band];
  return (
    <span className={cx(BADGE_BASE, style.cls)}>
      <span aria-hidden="true">●</span>
      <span>
        <span className="sr-only">Luottamus: </span>
        {style.label}
      </span>
    </span>
  );
}

export function RuleBadge({
  ruleId,
  version,
}: {
  ruleId?: string;
  version?: string;
}) {
  if (!ruleId) return null;
  return (
    <span className={cx(BADGE_BASE, "bg-navy-50 text-navy-700 font-mono")}>
      {ruleId}
      {version ? <span className="text-navy-400">v{version}</span> : null}
    </span>
  );
}

/** Demo-aineisto on aina merkittävä näkyvästi (§47, §74). */
export function DemoBadge({ children = "Demo" }: { children?: ReactNode }) {
  return (
    <span
      className={cx(
        BADGE_BASE,
        "border border-gold-400/50 bg-gold-100 text-gold-600",
      )}
    >
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  received: { label: "Vastaanotettu", cls: "bg-navy-100 text-navy-700" },
  processing: { label: "Käsitellään", cls: "bg-navy-100 text-navy-700" },
  processed: { label: "Käsitelty", cls: "bg-navy-100 text-navy-700" },
  needs_review: { label: "Tarkistettava", cls: "bg-warn-100 text-warn-600" },
  approved: { label: "Hyväksytty", cls: "bg-ok-100 text-ok-600" },
  rejected: { label: "Hylätty", cls: "bg-risk-100 text-risk-600" },
  exported: { label: "Viety", cls: "bg-ok-100 text-ok-600" },
  error: { label: "Virhe", cls: "bg-risk-100 text-risk-600" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? {
    label: status,
    cls: "bg-navy-100 text-navy-700",
  };
  return <span className={cx(BADGE_BASE, s.cls)}>{s.label}</span>;
}

// ---------------------------------------------------------------------------
// Rakenne
// ---------------------------------------------------------------------------

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warn" | "ok";
}) {
  const toneCls =
    tone === "warn"
      ? "text-warn-600"
      : tone === "ok"
        ? "text-ok-600"
        : "text-foreground";

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={cx("mt-1.5 text-2xl font-semibold tabular", toneCls)}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
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
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Ilmoitus tilanteesta jota ei voitu ratkaista. Teksti on aina
 * ihmisluettava, ei koodi (§73).
 */
export function Notice({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "risk" | "info";
  title: string;
  children?: ReactNode;
}) {
  const cls =
    tone === "risk"
      ? "border-risk-500/30 bg-risk-100 text-risk-600"
      : tone === "info"
        ? "border-navy-300/40 bg-navy-50 text-navy-700"
        : "border-warn-500/30 bg-warn-100 text-warn-600";

  return (
    <div className={cx("rounded-md border px-3 py-2.5 text-sm", cls)} role="status">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 opacity-90">{children}</div> : null}
    </div>
  );
}
