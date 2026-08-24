import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import type { FocusItem } from "@/lib/restoflow/dashboard";
import { FOCUS_LIMIT, type OverallStatus } from "@/lib/restoflow/status";

/**
 * Yleiskuvan ensimmäinen asia.
 *
 * Viisi sekuntia: onko kaikki kunnossa. Viisitoista: mikä vaatii
 * huomiota. Kolmekymmentä: mitä pitää tehdä. Sen takia tila, lista ja
 * toimintalinkki ovat samassa lohkossa eivätkä kolmessa eri paikassa.
 *
 * Väri on merkitys eikä koriste. Vihreä tarkoittaa että on tarkastettu
 * eikä löytynyt mitään; harmaa että ei ole voitu tarkastaa.
 */
export function StatusHeader({
  status,
  items,
}: {
  status: OverallStatus;
  items: FocusItem[];
}) {
  const shown = items.slice(0, FOCUS_LIMIT);
  const rest = items.length - shown.length;

  return (
    <section
      aria-label="Tilanne"
      className="px-5 py-5 sm:px-6 sm:py-6"
      style={{
        background: "var(--rf-card)",
        border: `1px solid ${borderOf(status.tone)}`,
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <Dot tone={status.tone} />

        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-tight sm:text-[21px]">
            {status.headline}
          </h2>
          {status.detail ? (
            <p
              className="mt-1 max-w-xl text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              {status.detail}
            </p>
          ) : null}
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {shown.map((focus) => (
            <li key={focus.id}>
              <Link
                href={focus.href}
                className="rf-press flex items-start gap-3 px-3.5 py-3"
                style={{ background: "var(--rf-inset)", borderRadius: 12 }}
              >
                <span className="mt-0.5 shrink-0" style={{ color: severityColor(focus.severity) }}>
                  <RfIcon
                    name={focus.severity === "info" ? "info" : "alert"}
                    size={16}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{focus.title}</span>
                  <span
                    className="mt-0.5 block text-[13px] leading-relaxed"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {focus.detail}
                  </span>
                </span>

                <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon name="chevron" size={15} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Loput eivät katoa mutta eivät myöskään täytä kärkeä.
        Neljä kohtaa luetaan, viisitoista selataan ohi.
      */}
      {rest > 0 ? (
        <Link
          href="/admin/havainnot"
          className="rf-press rf-hit mt-3 inline-flex items-center gap-1.5 px-1 text-[13px] font-medium"
          style={{ color: "var(--rf-blue)" }}
        >
          {rest === 1 ? "1 muu kohta" : `${rest} muuta kohtaa`}
          <RfIcon name="chevron" size={13} />
        </Link>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Dot({ tone }: { tone: OverallStatus["tone"] }) {
  return (
    <span
      aria-hidden="true"
      className="mt-1.5 shrink-0"
      style={{
        width: 11,
        height: 11,
        borderRadius: "50%",
        background: dotOf(tone),
        boxShadow: `0 0 0 4px ${haloOf(tone)}`,
      }}
    />
  );
}

function dotOf(tone: OverallStatus["tone"]): string {
  return tone === "good"
    ? "var(--rf-green)"
    : tone === "warn"
      ? "var(--rf-amber)"
      : tone === "bad"
        ? "var(--rf-red)"
        : "var(--rf-text-3)";
}

function haloOf(tone: OverallStatus["tone"]): string {
  return tone === "good"
    ? "var(--rf-green-bg)"
    : tone === "warn"
      ? "var(--rf-amber-bg)"
      : tone === "bad"
        ? "var(--rf-red-bg)"
        : "var(--rf-inset)";
}

function borderOf(tone: OverallStatus["tone"]): string {
  // Vain ongelmatila saa värillisen reunan. Vihreä kehys joka päivä
  // muuttuisi taustaksi, eikä poikkeus erottuisi enää mistään.
  return tone === "bad" ? "var(--rf-red)" : tone === "warn" ? "var(--rf-amber)" : "var(--rf-line)";
}

function severityColor(severity: FocusItem["severity"]): string {
  return severity === "critical"
    ? "var(--rf-red-text)"
    : severity === "warning"
      ? "var(--rf-amber-text)"
      : "var(--rf-blue)";
}
