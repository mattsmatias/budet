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
 * Sama komponentti kuin muualla sovelluksessa. Erillinen "dashboardin
 * oma" kortti oli virhe: se ajautui erilleen ja sama luku näytti eri
 * sivuilla eri tuotteelta.
 */
export { MetricCard as StatCard } from "./ui";

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

// ---------------------------------------------------------------------------

/**
 * Pieni trendiviiva KPI-kortin sisään.
 *
 * Tarkoituksella vaatimaton: ei akseleita, ei ruudukkoa, ei lukuja.
 * Se kertoo suunnan yhdellä silmäyksellä eikä yritä olla kaavio —
 * tarkat luvut ovat kulunäkymässä. Viiva piirretään vain jos pisteitä
 * on vähintään kolme; kahdesta ei näe suuntaa.
 */
export function Sparkline({
  values,
  width = 88,
  height = 26,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 3) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    // Marginaali ylä- ja alareunaan, jottei viiva leikkaudu.
    const y = height - 3 - ((value - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = values[values.length - 1];
  const previous = values[values.length - 2];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={points.join(" ")}
        stroke="var(--rf-text-3)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r="2.5"
        fill={last >= previous ? "var(--rf-amber)" : "var(--rf-green)"}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export interface DonutSlice {
  key: string;
  label: string;
  valueCents: number;
  share: number;
}

/**
 * Kulujakauman donitsi.
 *
 * Harmaasävyinen tarkoituksella. Värillinen piirakka näyttäisi
 * raportilta ja rikkoisi säännön jonka mukaan väri merkitsee tilaa —
 * "ruoka on suurin kategoria" ei ole tila josta pitäisi hälyttää.
 * Sävyero riittää erottamaan siivut, ja nimet lukevat vieressä.
 *
 * Keskellä on kokonaissumma: se on ainoa luku jonka donitsi kertoo
 * paremmin kuin lista.
 */
export function Donut({
  slices,
  total,
  size = 148,
}: {
  slices: DonutSlice[];
  total: string;
  size?: number;
}) {
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Siirtymät lasketaan valmiiksi: muuttujan kasvattaminen renderin
  // aikana tuottaa eri tuloksen eri renderöinneillä.
  const arcs = slices.reduce<{ slice: DonutSlice; length: number; offset: number }[]>(
    (all, slice) => {
      const previous = all[all.length - 1];
      const offset = previous ? previous.offset + previous.length : 0;
      return [...all, { slice, length: slice.share * circumference, offset }];
    },
    [],
  );

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--rf-inset)"
            strokeWidth={stroke}
          />

          {arcs.map(({ slice, length, offset }, index) => {
            const dash = `${Math.max(0, length - 2)} ${circumference}`;

            return (
              <circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--rf-text)"
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                // Sävyt tummasta vaaleaan suuruusjärjestyksessä.
                opacity={Math.max(0.18, 0.9 - index * 0.16)}
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="rf-tabular text-[17px] font-semibold tracking-[-0.02em]">
          {total}
        </span>
        <span className="text-[11px]" style={{ color: "var(--rf-text-3)" }}>
          yhteensä
        </span>
      </div>
    </div>
  );
}
