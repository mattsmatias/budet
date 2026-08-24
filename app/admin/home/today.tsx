import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import { formatDuration } from "@/lib/restoflow/timeclock";
import type { Pulse } from "@/lib/restoflow/pulse";
import type { SalesComparison } from "@/lib/restoflow/sales";

/**
 * Tänään.
 *
 * Kolme lukua ja kuukauden tulos. Jokaisen luvun vieressä on
 * vertailukohta silloin kun sellainen on rehellisesti olemassa — ja
 * silloin kun ei ole, siitä sanotaan suoraan sen sijaan että kenttä
 * jätettäisiin tyhjäksi.
 */
export function Today({ pulse, canManageSales }: { pulse: Pulse; canManageSales: boolean }) {
  return (
    <section aria-label="Tänään" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Myynti"
          value={pulse.sales.cents === null ? "—" : formatMoney(pulse.sales.cents)}
          note={
            pulse.sales.cents === null
              ? "Ei vielä kirjattu"
              : comparisonText(pulse.sales.comparison)
          }
          tone={
            pulse.sales.cents === null
              ? "muted"
              : toneOf(pulse.sales.comparison)
          }
          href={canManageSales ? "/admin/myynti" : undefined}
        />

        <Figure
          label="Työvoima"
          value={formatMoney(pulse.labour.cents)}
          note={
            pulse.labour.shareOfSales === null
              ? formatDuration(pulse.labour.minutes * 60000)
              : `${Math.round(pulse.labour.shareOfSales * 100)} % myynnistä`
          }
          tone="muted"
          href="/admin/palkat"
        />

        <Figure
          label="Kulut tänään"
          value={formatMoney(pulse.expenses.cents)}
          note={
            pulse.expenses.receiptCount === 0
              ? "Ei kuitteja tänään"
              : `${pulse.expenses.receiptCount} ${pulse.expenses.receiptCount === 1 ? "kuitti" : "kuittia"}`
          }
          tone="muted"
          href="/admin/kuitit"
        />

        <Figure
          label="Kuukausi tähän asti"
          value={
            pulse.monthToDate.resultCents === null
              ? "—"
              : formatMoney(pulse.monthToDate.resultCents)
          }
          note={
            pulse.monthToDate.resultCents === null
              ? "Vaatii myyntitiedon"
              : "Myynti − kulut − työvoima"
          }
          tone={
            pulse.monthToDate.resultCents === null
              ? "muted"
              : pulse.monthToDate.resultCents >= 0
                ? "good"
                : "bad"
          }
        />
      </div>

      {/*
        Puuttuvat päivät kerrotaan vasta kun ominaisuus on otettu
        käyttöön. Ennen ensimmäistä kirjausta koko historia olisi
        "puuttuvaa", mikä on eri asia kuin unohtunut päivä.
      */}
      {canManageSales && pulse.monthToDate.missingSalesDays > 0 ? (
        <Link
          href="/admin/myynti"
          className="rf-press flex items-center gap-2.5 px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: 12,
          }}
        >
          <RfIcon name="alert" size={15} />
          {pulse.monthToDate.missingSalesDays === 1
            ? "Yhdeltä päivältä puuttuu myynti"
            : `${pulse.monthToDate.missingSalesDays} päivältä puuttuu myynti`}
          <span className="ml-auto">
            <RfIcon name="chevron" size={14} />
          </span>
        </Link>
      ) : null}

      <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Kuukauden luku on karkea: se sisältää vain sen mikä kulkee Budetin
        läpi. Ei vuokraa, sivukuluja eikä poistoja.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Figure({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  note: string;
  tone: "good" | "bad" | "muted";
  href?: string;
}) {
  const body = (
    <div
      className="h-full px-4 py-3.5"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: 14,
      }}
    >
      <p className="text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </p>
      <p className="rf-tabular mt-1.5 text-[22px] font-semibold tracking-tight">
        {value}
      </p>
      <p
        className="mt-0.5 text-[12px] leading-snug"
        style={{
          color:
            tone === "good"
              ? "var(--rf-green-text)"
              : tone === "bad"
                ? "var(--rf-red-text)"
                : "var(--rf-text-3)",
        }}
      >
        {note}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="rf-press block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** "+7 % tavoitteesta" / "−9 % vs. sama viikonpäivä" / "Ei vertailukohtaa" */
function comparisonText(comparison: SalesComparison): string {
  if (comparison.kind === "none") return "Ei vertailukohtaa";

  const change = Math.round((comparison.ratio - 1) * 100);
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const amount = change === 0 ? "tasan" : `${sign}${Math.abs(change)} %`;

  return comparison.kind === "target"
    ? `${amount} tavoitteesta`
    : `${amount} vs. sama viikonpäivä`;
}

function toneOf(comparison: SalesComparison): "good" | "bad" | "muted" {
  if (comparison.kind === "none") return "muted";
  if (comparison.ratio >= 1) return "good";
  return comparison.ratio < 0.9 ? "bad" : "muted";
}
