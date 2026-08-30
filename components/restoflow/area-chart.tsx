/**
 * Kahden sarjan pinta-alakaavio.
 *
 * Myynti ja kulut samalla akselilla. Ne kuuluvat samaan kuvaan, koska
 * kysymys ei ole kumpi kasvaa vaan kuinka kaukana ne ovat toisistaan —
 * ja kahdessa erillisessä kaaviossa etäisyyttä ei näe.
 *
 * MITTAKAAVA ALKAA NOLLASTA.
 *
 * Katkaistu akseli suurentaa pienen eron vuoreksi. Talousluvuissa se
 * ei ole tyylikysymys: sama kuva saa 5 % muutoksen näyttämään
 * romahdukselta.
 *
 * PUUTTUVA KUUKAUSI EI OLE NOLLA.
 *
 * Kuukausi jolta myyntiä ei ole kirjattu jätetään piirtämättä eikä
 * pudoteta nollaan. Nollaan putoava viiva kertoo että myynti loppui,
 * ja se on eri asia kuin se ettei kukaan ehtinyt kirjata sitä.
 */

export interface Series {
  label: string;
  color: string;
  /** Arvo per piste. Null = ei tietoa, ei nolla. */
  points: (number | null)[];
}

/*
 * Mitat suunnitelmasta.
 *
 * Ylä- ja alareunan väljyys ei ole koristetta: lipuke nousee pisteen
 * yläpuolelle ja kuukausien nimet jäävät pohjaviivan alle. Ahtaammalla
 * kaaviolla ylin lipuke leikkautui piirtoalueen reunaan.
 */
const W = 760;
const H = 240;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 30;
const PAD_B = 42;

export function AreaChart({
  labels,
  series,
  format,
  highlight,
}: {
  /** Vaaka-akselin merkinnät, yksi per piste. */
  labels: string[];
  series: [Series, Series] | [Series];
  /** Miten arvo muotoillaan lipukkeeseen ja akselille. */
  format: (value: number) => string;
  /** Korostettava piste, oletuksena viimeinen jolla on arvo. */
  highlight?: number;
}) {
  const all = series
    .flatMap((s) => s.points)
    .filter((v): v is number => v !== null);
  if (all.length < 2) return null;

  /*
   * Yläraja pyöristetään ylöspäin tasaluvuksi, jotta ruudukon viivat
   * osuvat luettaviin lukuihin. Ilman sitä akselilla lukisi 28 431 €.
   */
  const top = niceCeil(Math.max(...all));
  const steps = 4;

  const x = (i: number) =>
    PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, labels.length - 1);
  const y = (v: number) => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);

  const mark =
    highlight ??
    series[0].points.reduce<number>((last, v, i) => (v !== null ? i : last), 0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={series.map((s) => s.label).join(" ja ") + " kuukausittain"}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient
            key={i}
            id={`rf-area-${i}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Ruudukko katkoviivana: se on mitta-asteikko eikä sisältöä. */}
      {Array.from({ length: steps + 1 }, (_, i) => {
        const value = (top / steps) * i;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={y(value)}
              x2={W - PAD_R}
              y2={y(value)}
              stroke="var(--rf-line)"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
            <text
              x={PAD_L - 10}
              y={y(value) + 4}
              textAnchor="end"
              className="rf-tabular"
              fontSize="10"
              fill="var(--rf-text-3)"
            >
              {format(value)}
            </text>
          </g>
        );
      })}

      {series.map((s, i) => {
        const path = linePath(s.points, x, y);
        if (!path) return null;
        return (
          <g key={i}>
            <path
              d={`${path} ${closePath(s.points, x)}`}
              fill={`url(#rf-area-${i})`}
            />
            <path
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/*
        Korostettu kohta: pystyviiva, pisteet ja arvot.

        Lipuke on tumma laatta eikä pelkkä teksti, koska se piirtyy
        viivan päälle — vaalea teksti vaalealla täytöllä katoaisi juuri
        siitä kohdasta jota katsotaan.
      */}
      <line
        x1={x(mark)}
        y1={PAD_T}
        x2={x(mark)}
        y2={H - PAD_B}
        stroke="var(--rf-text-3)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      {series.map((s, i) => {
        const v = s.points[mark];
        if (v === null || v === undefined) return null;

        /* Lipuke kääntyy vasemmalle kun piste on oikeassa reunassa. */
        const right = x(mark) > W - 110;
        const boxX = right ? x(mark) - 78 : x(mark) + 12;

        return (
          <g key={i}>
            <rect
              x={boxX}
              y={y(v) - 9.5}
              width={66}
              height={19}
              rx={5}
              fill="var(--rf-text)"
            />
            <text
              x={boxX + 33}
              y={y(v) + 3.5}
              textAnchor="middle"
              className="rf-tabular"
              fontSize="10.5"
              fontWeight="600"
              fill="var(--rf-card)"
            >
              {format(v)}
            </text>
            <circle
              cx={x(mark)}
              cy={y(v)}
              r="4.5"
              fill={s.color}
              stroke="var(--rf-card)"
              strokeWidth="2.5"
            />
          </g>
        );
      })}

      {labels.map((label, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 18}
          textAnchor="middle"
          className="rf-tabular"
          fontSize="10.5"
          fill="var(--rf-text-3)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------

/**
 * Murtoviiva vain niistä pisteistä joilla on arvo.
 *
 * Aukko katkaisee viivan: yhdistetty viiva puuttuvan kuukauden yli
 * väittäisi että väliltä tiedetään jotain.
 */
function linePath(
  points: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = "";
  let open = false;

  points.forEach((value, i) => {
    if (value === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)} `;
    open = true;
  });

  return d.trim();
}

/** Täytön alareuna: viimeisestä pisteestä pohjaan ja takaisin alkuun. */
function closePath(
  points: (number | null)[],
  x: (i: number) => number,
): string {
  const known = points
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (known.length < 2) return "";

  const first = known[0].i;
  const last = known[known.length - 1].i;
  return `L${x(last).toFixed(1)} ${(H - PAD_B).toFixed(1)} L${x(first).toFixed(1)} ${(H - PAD_B).toFixed(1)} Z`;
}

/** 28 431 → 32 000. Ruudukon viivat osuvat luettaviin lukuihin. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}
