/**
 * Markkinointisivun jaetut osat.
 *
 * StatusPill on tämän tiedoston tärkein komponentti: jokainen luvattu
 * ominaisuus kantaa merkinnän siitä, onko se käytössä nyt vai ei. Ilman
 * sitä sivu lupaisi asioita joita tuote ei tee (§67, §74).
 */

import type { ReactNode } from "react";

export type FeatureStatus = "live" | "planned" | "unverified";

const STATUS: Record<FeatureStatus, { label: string; cls: string }> = {
  live: {
    label: "Käytössä",
    cls: "border-ok-500/40 bg-ok-100 text-ok-600",
  },
  planned: {
    label: "Ei vielä",
    cls: "border-navy-300/40 bg-navy-50 text-navy-700",
  },
  unverified: {
    label: "Ei vahvistettu",
    cls: "border-warn-500/40 bg-warn-100 text-warn-600",
  },
};

export function StatusPill({
  status,
  dark,
}: {
  status: FeatureStatus;
  dark?: boolean;
}) {
  const s = STATUS[status];
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-xs font-medium",
        dark && status === "planned"
          ? "border-navy-600 bg-navy-800 text-navy-300"
          : s.cls,
      ].join(" ")}
    >
      {s.label}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  dark,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p
        className={[
          "text-xs font-semibold uppercase tracking-wider",
          dark ? "text-gold-400" : "text-gold-600",
        ].join(" ")}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {lead ? (
        <p
          className={[
            "mt-4 text-base leading-relaxed",
            dark ? "text-navy-200" : "text-muted",
          ].join(" ")}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect width="24" height="24" rx="5" fill="#E9AE3B" />
      <path
        d="M6 7.5l4.6 9.5L18 6"
        stroke="#051226"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Card({
  title,
  status,
  children,
}: {
  title: string;
  status?: FeatureStatus;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {status ? <StatusPill status={status} /> : null}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}
