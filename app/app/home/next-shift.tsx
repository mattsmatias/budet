import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { SHIFT_STATUS_LABELS, type Shift } from "@/lib/restoflow/types";

/**
 * Seuraava työvuoro.
 *
 * Kompakti eikä hallitseva: leimauskortti on tämän näkymän pääasia, ja
 * kaksi yhtä suurta elementtiä tarkoittaisi ettei kumpikaan ole
 * tärkeämpi. Tässä riittää päivä, kellonaika, paikka ja tila.
 */
export function NextShift({ shift, today }: { shift: Shift | undefined; today: string }) {
  if (!shift) {
    return (
      <Section>
        <p className="text-[15px] font-medium">Ei tulevia työvuoroja</p>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Sinulle ei ole vielä lisätty tulevia työvuoroja.
        </p>
      </Section>
    );
  }

  const confirmed = shift.status === "accepted";

  return (
    <Section href="/app/vuorot">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            {shift.date === today ? "Tänään" : dayLabel(shift.date)}
          </p>
          <p className="rf-tabular mt-0.5 text-[20px] font-semibold tracking-tight">
            {shift.startTime}–{shift.endTime}
          </p>
          {shift.location ? (
            <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {shift.location}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: confirmed ? "var(--rf-green-bg)" : "var(--rf-inset)",
              color: confirmed ? "var(--rf-green-text)" : "var(--rf-text-2)",
              borderRadius: 8,
            }}
          >
            {SHIFT_STATUS_LABELS[shift.status]}
          </span>
          <span style={{ color: "var(--rf-text-3)" }}>
            <RfIcon name="chevron" size={16} />
          </span>
        </div>
      </div>
    </Section>
  );
}

/**
 * Osion pinta.
 *
 * Kevyempi kuin leimauskortti: ohut reuna, ei varjoa. Hierarkia syntyy
 * siitä että kaikki ei ole samannäköistä.
 */
function Section({ children, href }: { children: React.ReactNode; href?: string }) {
  const inner = (
    <div
      className="px-4 py-3.5"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: 14,
      }}
    >
      {children}
    </div>
  );

  return href ? (
    <Link href={href} className="rf-press block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const DAYS = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

/** "Ke 26.8." */
function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}
