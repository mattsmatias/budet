import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { MerchantBadge } from "@/components/restoflow/merchant-badge";
import { RfIcon } from "@/components/restoflow/icons";
import { seriesColor } from "@/components/restoflow/dashboard-ui";
import type { Merchant } from "@/lib/restoflow/merchants";

/**
 * Ostot.
 *
 * Mihin raha meni ja keneltä ostettiin — samassa lohkossa.
 *
 * NÄMÄ OLIVAT KAKSI PANEELIA VIERETYSTEN.
 *
 * Ne vastasivat kysymyksiin "mihin rahat menevät" ja "kenelle rahat
 * menevät", mutta se on yksi kysymys kahdesta suunnasta: ruoka-aineet
 * ovat Kesproa. Kaksi paneelia pakotti lukemaan saman kuukauden
 * kahdesti eri järjestyksessä.
 *
 * HINNANMUUTOS ON TÄRKEIN LUKU TOIMITTAJARIVILLÄ.
 *
 * Kuukauden summa kertoo paljonko ostettiin; muutos kertoo nousiko
 * hinta. Ravintolassa jälkimmäinen on se johon voi reagoida — ja se on
 * siksi nostettu omaksi merkinnäkseen eikä piilotettu pieneen tekstiin.
 */

export interface CategoryRow {
  key: string;
  name: string;
  baseCategory: string;
  totalCents: number;
  share: number;
}

export interface SupplierRow {
  supplierId: string;
  name: string;
  totalCents: number;
  share: number;
  /** Muutos edelliseen kuukauteen, tai null jos vertailukohtaa ei ole. */
  change: number | null;
}

export function Purchases({
  categories,
  suppliers,
  merchantOf,
  totalCents,
  empty,
}: {
  categories: CategoryRow[];
  suppliers: SupplierRow[];
  merchantOf: (supplierId: string) => Merchant | null;
  totalCents: number;
  /** Selitys ja polku kun kuukausi on tyhjä. */
  empty: { text: string; cta?: string; href?: string } | null;
}) {
  const hasData = categories.length > 0 || suppliers.length > 0;

  return (
    <section
      aria-label="Ostot"
      className="overflow-hidden"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <h3 className="text-[16px] font-bold tracking-[-0.02em]">Ostot</h3>
        <Link
          href="/admin/kulut"
          className="rf-press rf-hit text-[13px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          Kaikki kulut →
        </Link>
      </div>

      {!hasData ? (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            {empty?.text ?? "Lisää kuitteja nähdäksesi mihin raha menee."}
          </p>
          {empty?.cta && empty.href ? (
            <Link
              href={empty.href}
              className="rf-press mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-bold"
              style={{
                background: "var(--rf-accent)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {empty.cta}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-x-8 gap-y-7 px-5 pb-6 pt-5 sm:px-6 lg:grid-cols-2">
          <div>
            <p
              className="mb-3 text-[10.5px] font-bold uppercase"
              style={{ color: "var(--rf-text-3)", letterSpacing: "0.08em" }}
            >
              Mihin
            </p>

            {/*
              Yksi pinottu palkki ympyrädiagrammin sijaan.

              Ympyrä vaatii vertaamaan sektorien kulmia, palkki vain
              pituuksia. Ja koska sama palkki toistuu koko sovelluksessa
              — budjeteissa, kulurytmissä — se on jo opittu muoto.
            */}
            <div
              className="flex h-2.5 w-full overflow-hidden"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-pill)" }}
            >
              {categories.slice(0, 5).map((row, index) => (
                <span
                  key={row.key}
                  className="rf-bar-grow h-full"
                  style={{
                    width: `${row.share * 100}%`,
                    background: seriesColor(index),
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              ))}
            </div>

            <ul className="mt-3 space-y-0.5">
              {categories.slice(0, 5).map((row, index) => (
                <li key={row.key}>
                  <Link
                    href={`/admin/kuitit?suodatin=${row.baseCategory}`}
                    className="rf-press flex items-center justify-between gap-3 rounded-[10px] px-1.5 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-[13.5px]">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: seriesColor(index) }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>

                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="rf-tabular text-[13.5px] font-bold">
                        {formatMoney(row.totalCents)}
                      </span>
                      <span
                        className="rf-tabular w-9 text-right text-[12.5px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {Math.round(row.share * 100)} %
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-2 px-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              Yhteensä{" "}
              <span className="rf-tabular font-semibold">{formatMoney(totalCents)}</span>
            </p>
          </div>

          <div>
            <p
              className="mb-3 text-[10.5px] font-bold uppercase"
              style={{ color: "var(--rf-text-3)", letterSpacing: "0.08em" }}
            >
              Keneltä
            </p>

            <ul className="space-y-1">
              {suppliers.map((supplier) => (
                <li key={supplier.supplierId}>
                  <Link
                    href={`/admin/toimittajat/${supplier.supplierId}`}
                    className="rf-press flex items-center gap-3 rounded-[10px] px-1.5 py-2"
                  >
                    <MerchantBadge
                      merchant={merchantOf(supplier.supplierId)}
                      fallbackName={supplier.name}
                      size={30}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {merchantOf(supplier.supplierId)?.name ?? supplier.name}
                      </span>
                      <span
                        className="rf-tabular block text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {(supplier.share * 100).toFixed(1).replace(".", ",")} % ostoista
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2.5">
                      <Change value={supplier.change} />
                      <span className="rf-tabular text-[13.5px] font-bold">
                        {formatMoney(supplier.totalCents)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Hinnanmuutos merkintänä.
 *
 * Nousu on keltainen ja lasku vihreä — toisin kuin kokonaiskuluissa,
 * joissa suunta ei ole hyvä eikä huono. Yksittäisen toimittajan
 * kohdalla se on: sama toimittaja, sama tarve, suurempi lasku.
 *
 * Alle viiden prosentin muutos on kohinaa eikä merkintää. Tilausten
 * koko vaihtelee viikoittain, ja kolmen prosentin nuoli opettaisi
 * ohittamaan myös kolmenkymmenen prosentin nuolen.
 */
function Change({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.05) return null;

  const up = value > 0;
  const text = `${up ? "+" : "−"}${Math.round(Math.abs(value) * 100)} %`;

  return (
    <span
      className="rf-tabular inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-bold"
      style={{
        background: up ? "var(--rf-amber-bg)" : "var(--rf-green-bg)",
        color: up ? "var(--rf-amber-text)" : "var(--rf-green-text)",
        borderRadius: "var(--rf-r-pill)",
      }}
      title={`${text} edelliseen kuukauteen`}
    >
      <RfIcon name="trend" size={11} />
      {text}
    </span>
  );
}
