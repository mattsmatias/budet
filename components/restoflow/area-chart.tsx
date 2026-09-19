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
 * PUUTTUVA PISTE EI OLE NOLLA.
 *
 * Kohta jolta myyntiä ei ole kirjattu jätetään piirtämättä eikä
 * pudoteta nollaan. Nollaan putoava viiva kertoo että myynti loppui,
 * ja se on eri asia kuin se ettei kukaan ehtinyt kirjata sitä.
 *
 * LIIKE KERRAN, EI SILMUKKAA.
 *
 * Viivat piirtyvät vasemmalta oikealle (ajan suuntaan), pinta nousee
 * pohjaviivalta ja viimeinen piste ilmoittaa itsensä yhdellä
 * renkaalla. Mikään ei toistu: toistuva liike vie huomion luvuilta.
 *
 * LUKEMA OSOITTAMALLA ILMAN JAVASCRIPTIÄ.
 *
 * Jokaisella pisteellä on näkymätön sarake. Hiiri, kosketus tai
 * sarkain nostaa sen lukeman esiin CSS:llä, joten kaavio pysyy
 * palvelinkomponenttina eikä muotoilufunktiota tarvitse siirtää
 * selaimeen.
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
 * yläpuolelle ja akselin merkinnät jäävät pohjaviivan alle.
 */
const W = 760;
const H = 240;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 30;
const PAD_B = 42;

const TIP_W = 170;

export function AreaChart({
  labels,
  series,
  format,
  formatTip = format,
  tipLabels = labels,
  ticks,
  highlight,
  ariaLabel,
}: {
  /** Vaaka-akselin merkinnät, yksi per piste. */
  labels: string[];
  series: [Series, Series] | [Series];
  /** Miten arvo muotoillaan akselille ja korostuksen lipukkeeseen. */
  format: (value: number) => string;
  /** Osoitetun pisteen lukema. Oletuksena sama kuin akselilla. */
  formatTip?: (value: number) => string;
  /** Osoitetun pisteen otsikko, jos se on pidempi kuin akselin merkintä. */
  tipLabels?: string[];
  /** Merkinnät vain näihin indekseihin. Oletuksena kaikki. */
  ticks?: number[];
  /** Korostettava piste, oletuksena viimeinen jolla on arvo. */
  highlight?: number;
  ariaLabel?: string;
}) {
  const all = series
    .flatMap((s) => s.points)
    .filter((v): v is number => v !== null);
  if (all.length < 2) return null;

  /*
   * Ruudukon väli on tasaluku (1, 2, 2,5 tai 5 kertaa kymmenen
   * potenssi), ja yläraja on neljä väliä. Pelkkä ylärajan pyöristys
   * jakoi sen neljään epätasaiseen osaan: akselilla luki 875 € ja 2,6 k.
   */
  const steps = 4;
  const top = niceStep(Math.max(...all) / steps) * steps;
  const count = labels.length;
  const step = (W - PAD_L - PAD_R) / Math.max(1, count - 1);

  const x = (i: number) => PAD_L + i * step;
  const y = (v: number) => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);

  const lastKnown = (points: (number | null)[]) =>
    points.reduce<number>((last, v, i) => (v !== null ? i : last), -1);

  const mark =
    highlight ??
    Math.max(...series.map((s) => lastKnown(s.points)), 0);

  const shownTicks = new Set(ticks ?? labels.map((_, i) => i));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel ?? series.map((s) => s.label).join(" ja ")}
      className="rf-chart"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        maxHeight: H,
        overflow: "visible",
      }}
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
            <stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
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
        const delay = { animationDelay: `${120 + i * 160}ms` };
        return (
          <g key={i}>
            <path
              d={`${path} ${closePath(s.points, x)}`}
              fill={`url(#rf-area-${i})`}
              className="rf-chart-area"
              style={delay}
            />
            <path
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="rf-chart-line"
              style={delay}
            />
          </g>
        );
      })}

      {/*
        Korostettu kohta: pystyviiva, pisteet ja arvot.

        Lipuke on tumma laatta eikä pelkkä teksti, koska se piirtyy
        viivan päälle — vaalea teksti vaalealla täytöllä katoaisi juuri
        siitä kohdasta jota katsotaan. Se väistyy kun jotain muuta
        pistettä osoitetaan.
      */}
      <g className="rf-chart-mark">
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
              <g className="rf-chart-badge">
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
              </g>
              <circle
                cx={x(mark)}
                cy={y(v)}
                r="4.5"
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                className="rf-chart-ring"
              />
              <circle
                cx={x(mark)}
                cy={y(v)}
                r="4.5"
                fill={s.color}
                stroke="var(--rf-card)"
                strokeWidth="2.5"
                className="rf-chart-dot"
              />
            </g>
          );
        })}
      </g>

      {labels.map((label, i) =>
        shownTicks.has(i) ? (
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
        ) : null,
      )}

      {/*
        Osoitettavat sarakkeet viimeisenä, jotta ne ovat kaiken päällä.
        Sarakkeen leveys on pisteväli: koko pinta vastaa osoitukseen,
        ei vain kapea viiva.
      */}
      {labels.map((_, i) => {
        const values = series.map((s) => s.points[i] ?? null);
        if (values.every((v) => v === null)) return null;

        const left = x(i) > W - PAD_R - TIP_W - 16;
        const tipX = left ? x(i) - TIP_W - 12 : x(i) + 12;
        const tipH = 26 + series.length * 18;
        const highest = Math.min(
          ...values.filter((v): v is number => v !== null).map(y),
        );
        const tipY = Math.max(
          4,
          Math.min(highest - tipH / 2, H - PAD_B - tipH),
        );

        const colX = Math.max(PAD_L - step / 2, x(i) - step / 2);
        const colW = Math.min(step, W - PAD_R - colX + step / 2);

        return (
          <g
            key={i}
            className="rf-chart-col"
            tabIndex={0}
            aria-label={
              tipLabels[i] +
              ": " +
              series
                .map((s, j) =>
                  values[j] === null
                    ? `${s.label} —`
                    : `${s.label} ${formatTip(values[j] as number)}`,
                )
                .join(", ")
            }
          >
            <rect
              x={colX}
              y={PAD_T}
              width={Math.max(8, colW)}
              height={H - PAD_T - PAD_B}
              fill="transparent"
            />
            <g className="rf-chart-tip" aria-hidden="true">
              <line
                x1={x(i)}
                y1={PAD_T}
                x2={x(i)}
                y2={H - PAD_B}
                stroke="var(--rf-text-2)"
                strokeWidth="1"
              />
              {series.map((s, j) =>
                values[j] === null ? null : (
                  <circle
                    key={j}
                    cx={x(i)}
                    cy={y(values[j] as number)}
                    r="4.5"
                    fill={s.color}
                    stroke="var(--rf-card)"
                    strokeWidth="2.5"
                  />
                ),
              )}
              <rect
                x={tipX}
                y={tipY}
                width={TIP_W}
                height={tipH}
                rx={8}
                fill="var(--rf-text)"
              />
              <text
                x={tipX + 10}
                y={tipY + 17}
                fontSize="10.5"
                fontWeight="600"
                fill="var(--rf-card)"
                opacity="0.7"
              >
                {tipLabels[i]}
              </text>
              {series.map((s, j) => (
                <g key={j}>
                  <rect
                    x={tipX + 10}
                    y={tipY + 27 + j * 18}
                    width={8}
                    height={8}
                    rx={2}
                    fill={s.color}
                  />
                  <text
                    x={tipX + 24}
                    y={tipY + 35 + j * 18}
                    fontSize="11"
                    fill="var(--rf-card)"
                  >
                    {s.label}
                  </text>
                  <text
                    x={tipX + TIP_W - 10}
                    y={tipY + 35 + j * 18}
                    textAnchor="end"
                    className="rf-tabular"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--rf-card)"
                  >
                    {values[j] === null ? "—" : formatTip(values[j] as number)}
                  </text>
                </g>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------

/**
 * Murtoviiva vain niistä pisteistä joilla on arvo.
 *
 * Aukko katkaisee viivan: yhdistetty viiva puuttuvan kohdan yli
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

/** 81 000 → 100 000, 60 000 → 100 000, 21 000 → 25 000. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const nice = [1, 2, 2.5, 5, 10].find((f) => f * magnitude >= value) ?? 10;
  return nice * magnitude;
}
