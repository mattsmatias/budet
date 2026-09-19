/**
 * Katen käyttöliittymä etusivulla.
 *
 * OIKEA KÄYTTÖLIITTYMÄ, ESIMERKKILUVUT.
 *
 * Nämä eivät ole kuvakaappauksia vaan sama komponenttikieli kuin
 * sovelluksessa: samat värit, samat kulmasäteet, sama numerokirjasin.
 * Kuvakaappaus olisi kahdesta syystä huonompi. Se sisältäisi oikean
 * ravintolan liikevaihdon ja toimittajat, eikä niitä julkaista
 * markkinointisivulla. Ja se vanhenisi hiljaa: käyttöliittymä muuttuu,
 * kuva ei.
 *
 * Luvut ovat esimerkkejä ja se sanotaan sivulla ääneen. Keksitty luku
 * jota esitellään todellisena on eri asia kuin esimerkki joka kertoo
 * olevansa esimerkki.
 */

import type { Dictionary } from "@/lib/i18n/dictionary";
import { Logo } from "@/components/brand/logo";
import { CountIn } from "./effects";

function Euro({ value }: { value: React.ReactNode }) {
  return (
    <span className="bd-num">
      {value}
      <span
        className="ml-[3px] font-medium"
        style={{ color: "var(--bd-text-3)" }}
      >
        €
      </span>
    </span>
  );
}

/** Sovelluksen avainlukukortti pienennettynä. */
function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "neutral" | "good";
}) {
  return (
    <div
      className="min-w-0 rounded-[12px] p-3"
      style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
    >
      <p
        className="truncate text-[10.5px] font-medium"
        style={{ color: "var(--bd-text-2)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-[19px] font-bold leading-tight tracking-[-0.03em]"
        style={{
          color: tone === "good" ? "var(--bd-green)" : "var(--bd-text)",
        }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 truncate text-[10px]"
        style={{ color: "var(--bd-text-3)" }}
      >
        {hint}
      </p>
    </div>
  );
}

/** Kehys: selainikkuna jossa sovellus on. */
function Frame({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    /*
      rf-light bd-shot: kuva pysyy vaaleana myös tummalla sivulla.
      Se on esitys sovelluksesta, ja esitys ei käänny katsojan teeman
      mukana. Ks. theme.css, .rf-light.
    */
    <div
      className="bd-shot rf-light overflow-hidden rounded-[16px]"
      style={{
        background: "#f4f6fa",
        border: "1px solid var(--bd-line-2)",
        boxShadow: "var(--bd-shadow-lg)",
      }}
    >
      {/* Ikkunapalkki. Kolme pistettä riittää kertomaan että kyse on sovelluksesta. */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ background: "#fff", borderBottom: "1px solid var(--bd-line)" }}
      >
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          <i
            className="block h-[9px] w-[9px] rounded-full"
            style={{ background: "#ff6159" }}
          />
          <i
            className="block h-[9px] w-[9px] rounded-full"
            style={{ background: "#ffbd2e" }}
          />
          <i
            className="block h-[9px] w-[9px] rounded-full"
            style={{ background: "#28c941" }}
          />
        </span>
        <span
          className="mx-auto flex min-w-0 items-center gap-1.5 truncate rounded-full px-3 py-[3px] text-[10.5px] font-medium"
          style={{ color: "var(--bd-text-3)", background: "#f1f3f7" }}
        >
          <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
            <path
              d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v6H4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          {title}
        </span>
        <span className="w-[39px] shrink-0" aria-hidden="true" />
      </div>

      {children}
    </div>
  );
}

/** Sivupalkki. Näkyy vasta kun tilaa on. */
function Rail({ t }: { t: Dictionary }) {
  const items = [
    t.preview.railOverview,
    t.preview.railSales,
    t.preview.railReceipts,
    t.preview.railExpenses,
    t.preview.railLedger,
    t.preview.railBudgets,
  ];

  return (
    <nav
      aria-hidden="true"
      className="hidden w-[132px] shrink-0 flex-col gap-0.5 border-r p-2.5 sm:flex"
      style={{ background: "#fff", borderColor: "var(--bd-line)" }}
    >
      <RailBrand />
      {items.map((item, i) => (
        <span
          key={item}
          className="truncate rounded-[8px] px-2.5 py-[7px] text-[11px] font-medium"
          style={
            i === 0
              ? {
                  background: "var(--bd-accent-bg)",
                  color: "var(--bd-accent-strong)",
                }
              : { color: "var(--bd-text-2)" }
          }
        >
          {item}
        </span>
      ))}
    </nav>
  );
}

/**
 * Hero-näkymä: päivän tilanne.
 *
 * Sama yleiskatsaus kuin sovelluksessa, pienennettynä: avainluvut,
 * myynnin ja kulujen kaavio, kulujakauma ja kuitin luku. Liike kertoo
 * mitä sovellus tekee eikä koristele: luvut kertyvät, kaavio piirtyy ja
 * lopuksi uusi kuitti luetaan ja luokitellaan — Katen tärkein työ
 * yhdessä eleessä.
 */
const WEEK_SALES = [62, 54, 58, 40, 46, 26, 30];
const WEEK_COSTS = [86, 82, 84, 76, 80, 72, 74];

function weekPath(points: number[]): string {
  return points
    .map((y, i) => `${i === 0 ? "M" : "L"}${i * 50} ${y}`)
    .join(" ");
}

export function HeroPreview({ t }: { t: Dictionary }) {
  const slices = [
    { label: t.preview.catFood, share: 46, color: "#f0913a" },
    { label: t.preview.catStaff, share: 32, color: "#4aa3f0" },
    { label: t.preview.catDrinks, share: 14, color: "#7b76e8" },
    { label: t.preview.catOther, share: 8, color: "#97a3b6" },
  ];

  /* Siivujen alkukohdat: ensimmäinen alkaa kello kahdestatoista. */
  const starts = slices.map(
    (_, i) => 25 - slices.slice(0, i).reduce((sum, s) => sum + s.share, 0),
  );

  return (
    <Frame title={t.preview.overview}>
      <div className="flex">
        <Rail t={t} />

        <div className="relative min-w-0 flex-1 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-bold tracking-[-0.01em]">
              {t.preview.today}
            </p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold"
              style={{
                background: "var(--bd-green-bg)",
                color: "var(--bd-green)",
              }}
            >
              <i
                className="bd-live-dot block h-[5px] w-[5px] rounded-full"
                style={{ background: "currentColor" }}
                aria-hidden="true"
              />
              {t.preview.synced}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric
              label={t.preview.sales}
              value={<Euro value={<CountIn to={5240} delay={500} />} />}
              hint={t.preview.salesHint}
            />
            <Metric
              label={t.preview.expenses}
              value={<Euro value={<CountIn to={1820} delay={600} />} />}
              hint={t.preview.expensesHint}
            />
            <Metric
              label={t.preview.result}
              value={<Euro value={<CountIn to={3420} delay={700} />} />}
              hint={t.preview.resultHint}
              tone="good"
            />
            <Metric
              label={t.preview.receipts}
              value={
                <span className="bd-num">
                  <CountIn to={24} delay={800} duration={1000} />
                </span>
              }
              hint={t.preview.receiptsHint}
            />
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.55fr_1fr]">
            {/* Myynti ja kulut viikolta. Sama värikoodi kuin sovelluksessa. */}
            <div
              className="rounded-[12px] p-3"
              style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[10.5px] font-medium"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {t.preview.salesAndCosts}
                </p>
                <span
                  className="flex items-center gap-2.5 text-[9.5px]"
                  style={{ color: "var(--bd-text-3)" }}
                >
                  <span className="flex items-center gap-1">
                    <i
                      className="block h-[3px] w-2 rounded-full"
                      style={{ background: "#4aa3f0" }}
                    />
                    {t.preview.sales}
                  </span>
                  <span className="flex items-center gap-1">
                    <i
                      className="block h-[3px] w-2 rounded-full"
                      style={{ background: "#f0913a" }}
                    />
                    {t.preview.expenses}
                  </span>
                </span>
              </div>

              <svg
                viewBox="0 0 300 100"
                className="mt-2 h-[92px] w-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="bd-sales-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4aa3f0" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#4aa3f0" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="bd-cost-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0913a" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#f0913a" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[25, 50, 75].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="300"
                    y1={y}
                    y2={y}
                    stroke="#eef1f6"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                <path
                  className="bd-hero-area"
                  d={`${weekPath(WEEK_SALES)} L300 100 L0 100 Z`}
                  fill="url(#bd-sales-area)"
                />
                <path
                  className="bd-hero-area bd-hero-area-2"
                  d={`${weekPath(WEEK_COSTS)} L300 100 L0 100 Z`}
                  fill="url(#bd-cost-area)"
                />
                <path
                  className="bd-hero-line"
                  d={weekPath(WEEK_SALES)}
                  pathLength={1}
                  fill="none"
                  stroke="#4aa3f0"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="bd-hero-line bd-hero-line-2"
                  d={weekPath(WEEK_COSTS)}
                  pathLength={1}
                  fill="none"
                  stroke="#f0913a"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Kulujakauma: donitsi kasvaa paikalleen siivu kerrallaan. */}
            <div
              className="hidden rounded-[12px] p-3 sm:block"
              style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
            >
              <p
                className="text-[10.5px] font-medium"
                style={{ color: "var(--bd-text-2)" }}
              >
                {t.preview.breakdown}
              </p>

              <div className="mt-2 flex items-center gap-3">
                <svg
                  viewBox="0 0 42 42"
                  className="h-[78px] w-[78px] shrink-0"
                  aria-hidden="true"
                >
                  <circle
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke="#eef1f6"
                    strokeWidth="5"
                  />
                  {slices.map((slice, i) => (
                    <circle
                      key={slice.label}
                      className="bd-hero-arc"
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="5"
                      strokeDasharray={`${slice.share - 1.2} ${100 - slice.share + 1.2}`}
                      strokeDashoffset={starts[i]}
                      style={{ animationDelay: `${900 + i * 140}ms` }}
                    />
                  ))}
                </svg>

                <ul className="min-w-0 flex-1 space-y-1">
                  {slices.map((slice) => (
                    <li
                      key={slice.label}
                      className="flex items-center gap-1.5 text-[10px]"
                    >
                      <i
                        className="block h-[7px] w-[7px] shrink-0 rounded-[2px]"
                        style={{ background: slice.color }}
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ color: "var(--bd-text-2)" }}
                      >
                        {slice.label}
                      </span>
                      <span className="bd-num shrink-0 font-semibold">
                        {slice.share} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/*
            Kuitin luku: ilmoitus liukuu sisään, luku etenee ja kuitti
            saa kategorian. Näyttää mitä kuvaaminen oikeasti tekee.
          */}
          <div className="bd-toast" aria-hidden="true">
            <span className="bd-toast-icon">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path
                  className="bd-toast-check"
                  d="M3.5 8.5l3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold leading-tight">
                {t.preview.receiptRead}
              </span>
              <span
                className="block truncate text-[10px] leading-tight"
                style={{ color: "var(--bd-text-2)" }}
              >
                {t.preview.receiptSupplier} ·{" "}
                <span className="bd-num">184,20 €</span> · {t.preview.catFood}
              </span>
            </span>
            <span className="bd-toast-bar" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Kelluvat kortit kehyksen reunoilla.
 *
 * Kaksi asiaa joita yleiskatsaus ei yksin kerro: Matti huomaa asioita
 * puolestasi, ja päivän tulos näkyy yhdellä silmäyksellä. Kortit ovat
 * eri syvyyksillä ja liikkuvat osoittimen mukaan (ParallaxStage).
 */
export function HeroFloaters({ t }: { t: Dictionary }) {
  return (
    <>
      <div className="bd-depth bd-floater-a" style={{ "--depth": 18 } as React.CSSProperties}>
        <div className="bd-floater bd-shot rf-light">
          <span className="bd-floater-matti" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path
                d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold">Matti</span>
            <span
              className="block text-[11.5px] leading-snug"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.preview.mattiText}
            </span>
          </span>
        </div>
      </div>

      <div className="bd-depth bd-floater-b" style={{ "--depth": 30 } as React.CSSProperties}>
        <div className="bd-floater bd-floater-float bd-shot rf-light">
          <span className="min-w-0">
            <span
              className="block text-[10.5px] font-medium"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.preview.resultToday}
            </span>
            <span
              className="bd-num block text-[22px] font-bold leading-tight tracking-[-0.03em]"
              style={{ color: "var(--bd-green)" }}
            >
              +<CountIn to={3420} delay={1500} /> €
            </span>
            <span
              className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-semibold"
              style={{ background: "var(--bd-green-bg)", color: "var(--bd-green)" }}
            >
              ↑ {t.preview.vsLastWeek}
            </span>
          </span>
          <svg
            viewBox="0 0 80 36"
            className="h-[36px] w-[80px] shrink-0"
            aria-hidden="true"
          >
            <path
              className="bd-hero-line bd-floater-spark"
              d="M2 30 L16 24 L30 27 L44 16 L58 19 L78 6"
              pathLength={1}
              fill="none"
              stroke="#17803d"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="bd-floater-dot" cx="78" cy="6" r="3" fill="#17803d" />
          </svg>
        </div>
      </div>
    </>
  );
}

/** Tunnus sivupalkin yläreunaan, kuten sovelluksessa. */
function RailBrand() {
  return (
    <span className="mb-2 flex items-center gap-1.5 px-1.5 pt-0.5">
      <Logo size={18} />
      <span className="text-[11.5px] font-extrabold tracking-[-0.02em]">
        Kate
      </span>
    </span>
  );
}

/**
 * Kuukausinäkymä.
 *
 * Sama kehys, eri kysymys: hero vastaa "miten tänään meni", tämä
 * "miten kuukausi menee".
 */
export function MonthPreview({ t }: { t: Dictionary }) {
  const rows = [
    { name: t.preview.groupFood, value: "48 900", share: 84 },
    { name: t.preview.groupAlcohol, value: "7 120", share: 12 },
    { name: t.preview.groupOther, value: "2 400", share: 4 },
  ];

  return (
    <Frame title={t.preview.overview}>
      <div className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12.5px] font-bold tracking-[-0.01em]">
            {t.preview.month}
          </p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold"
            style={{
              background: "var(--bd-green-bg)",
              color: "var(--bd-green)",
            }}
          >
            <i
              className="block h-[5px] w-[5px] rounded-full"
              style={{ background: "currentColor" }}
              aria-hidden="true"
            />
            {t.preview.ready}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric
            label={t.preview.sales}
            value={<Euro value="58 420" />}
            hint={t.preview.ledgerRevenue}
          />
          <Metric
            label={t.preview.expenses}
            value={<Euro value="41 840" />}
            hint={t.preview.ledgerExpenses}
          />
          <Metric
            label={t.preview.result}
            value={<Euro value="16 580" />}
            hint={t.preview.resultHint}
            tone="good"
          />
          <Metric
            label={t.preview.vat}
            value={<Euro value="5 240" />}
            hint={t.preview.vatHint}
          />
        </div>

        <div
          className="mt-2.5 rounded-[12px] p-3"
          style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
        >
          <p
            className="text-[10.5px] font-medium"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.preview.salesByGroup}
          </p>

          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.name}>
                <div className="flex items-baseline justify-between gap-3 text-[11px]">
                  <span
                    className="truncate"
                    style={{ color: "var(--bd-text-2)" }}
                  >
                    {row.name}
                  </span>
                  <span className="bd-num shrink-0 font-semibold">
                    {row.value} €
                  </span>
                </div>
                <div
                  className="mt-1 h-[4px] w-full overflow-hidden rounded-full"
                  style={{ background: "#eef1f6" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.share}%`,
                      background: "#d13831",
                      opacity: 0.75,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

/**
 * "Mitä minun pitää tehdä?"
 *
 * Sovelluksen oma osio sellaisenaan. Se on Katen selkein yksittäinen
 * lupaus: ravintoloitsijan ei tarvitse muistaa mitä on kesken.
 */
export function TodoPreview({ t }: { t: Dictionary }) {
  const items = [
    { tone: "red" as const, text: t.todo.item1 },
    { tone: "amber" as const, text: t.todo.item2 },
    { tone: "amber" as const, text: t.todo.item3 },
  ];

  return (
    /* Sama vaalea saareke kuin muissakin kuvissa. */
    <div
      className="bd-shot rf-light rounded-[16px] p-4"
      style={{
        background: "#fff",
        border: "1px solid var(--bd-line)",
        boxShadow: "var(--bd-shadow)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-bold tracking-[-0.01em]">
          {t.todo.cardTitle}
        </p>
        <span
          className="bd-num text-[12px] font-bold"
          style={{ color: "var(--bd-accent)" }}
        >
          3
        </span>
      </div>

      <ul className="mt-3 space-y-0.5">
        {items.map((item) => (
          <li
            key={item.text}
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5"
            style={{ background: "var(--bd-bg-2)" }}
          >
            <i
              aria-hidden="true"
              className="block h-[7px] w-[7px] shrink-0 rounded-full"
              style={{
                background: item.tone === "red" ? "#d13831" : "#d98511",
              }}
            />
            <span className="min-w-0 flex-1 text-[12.5px]">{item.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--bd-text-3)" }}>
        {t.todo.cardNote}
      </p>
    </div>
  );
}
