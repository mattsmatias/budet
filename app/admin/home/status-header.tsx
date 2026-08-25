import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { severityColor } from "@/components/restoflow/ui";
import type { FocusItem } from "@/lib/restoflow/dashboard";
import { FOCUS_LIMIT, type OverallStatus } from "@/lib/restoflow/status";

/**
 * Yleiskuvan ensimmäinen asia.
 *
 * Viisi sekuntia: onko kaikki kunnossa. Viisitoista: mikä vaatii
 * huomiota. Kolmekymmentä: mitä pitää tehdä. Sen takia tila, lista ja
 * toimintalinkki ovat samassa lohkossa eivätkä kolmessa eri paikassa.
 *
 * VÄRI ON RIVIN REUNASSA EIKÄ KEHYKSESSÄ.
 *
 * Koko kortti sai aiemmin punaisen kehyksen kun yksi rivi oli
 * kriittinen, ja silloin kaikki rivit näyttivät yhtä kiireisiltä.
 * Vakavuus koskee riviä, joten se kuuluu rivin reunaan — kaksi eri
 * vakavuutta erottuu toisistaan samassa listassa.
 */
export function StatusHeader({
  status,
  items,
  canAddReceipt,
}: {
  status: OverallStatus;
  items: FocusItem[];
  /**
   * Tyhjä tila tarvitsee polun eteenpäin.
   *
   * "Ei vielä arvioitavaa" on tosi mutta hyödytön ilman seuraavaa
   * askelta. Painike on vain tässä tilassa: kun arvioitavaa on, kärjen
   * kohdat ovat itse ne askeleet.
   */
  canAddReceipt: boolean;
}) {
  const shown = items.slice(0, FOCUS_LIMIT);
  const rest = items.length - shown.length;

  return (
    <section
      aria-label="Tilanne"
      className="flex h-full flex-col px-[18px] pb-4 pt-[15px]"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      <div className="flex items-start gap-2.5">
        {/*
          Piste vain kun listaa ei ole.

          Kun rivejä on, jokainen kantaa oman värinsä eikä yhteinen
          piste kerro niistä mitään uutta. Kun rivejä ei ole, piste on
          ainoa asia joka erottaa "tarkastettu, kaikki kunnossa"
          tilasta "ei voitu tarkastaa".
        */}
        {shown.length === 0 ? <Dot tone={status.tone} /> : null}

        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {status.headline}
          </h2>
          {status.detail ? (
            <p
              className="mt-[3px] text-[12.5px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              {status.detail}
            </p>
          ) : null}
        </div>
      </div>

      {status.tone === "unknown" && canAddReceipt ? (
        <Link
          href="/admin/kuitit/uusi"
          className="rf-press mt-4 inline-flex items-center gap-2 self-start px-4 py-2.5 text-[13.5px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={16} />
          Lisää ensimmäinen kuitti
        </Link>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-[13px] flex flex-col gap-2">
          {shown.map((focus) => (
            <li key={focus.id}>
              <Link
                href={focus.href}
                className="rf-press flex items-start gap-[11px] py-[11px] pr-[13px] pl-[11px]"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                  borderLeft: `2.5px solid ${severityColor(focus.severity)}`,
                }}
              >
                <span
                  className="mt-px shrink-0"
                  style={{ color: severityColor(focus.severity) }}
                >
                  <RfIcon name={focus.icon} size={15} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{focus.title}</span>
                  <span
                    className="mt-0.5 block text-[12.5px] leading-relaxed"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {focus.detail}
                  </span>
                </span>

                <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon name="chevron" size={14} />
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
          className="rf-press rf-hit mt-3 inline-flex items-center gap-1.5 self-start text-[12.5px] font-bold"
          style={{ color: "var(--rf-accent)" }}
        >
          {rest === 1 ? "1 muu kohta" : `${rest} muuta kohtaa`}
          <RfIcon name="chevron" size={13} />
        </Link>
      ) : null}

      <div className="mt-auto" />
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
        width: 10,
        height: 10,
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
