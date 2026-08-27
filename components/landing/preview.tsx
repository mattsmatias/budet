/**
 * Budetin käyttöliittymä etusivulla.
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

function Euro({ value }: { value: string }) {
  return (
    <span className="bd-num">
      {value}
      <span className="ml-[3px] font-medium" style={{ color: "var(--bd-text-3)" }}>
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
      <p className="truncate text-[10.5px] font-medium" style={{ color: "var(--bd-text-2)" }}>
        {label}
      </p>
      <p
        className="mt-1 truncate text-[19px] font-bold leading-tight tracking-[-0.03em]"
        style={{ color: tone === "good" ? "var(--bd-green)" : "var(--bd-text)" }}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--bd-text-3)" }}>
        {hint}
      </p>
    </div>
  );
}

/** Kehys: selainikkuna jossa sovellus on. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[16px]"
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
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="block h-[9px] w-[9px] rounded-full" style={{ background: "#e8ebf1" }} />
          <i className="block h-[9px] w-[9px] rounded-full" style={{ background: "#e8ebf1" }} />
          <i className="block h-[9px] w-[9px] rounded-full" style={{ background: "#e8ebf1" }} />
        </span>
        <span
          className="ml-1 truncate text-[10.5px] font-medium"
          style={{ color: "var(--bd-text-3)" }}
        >
          Budet · Yleiskatsaus
        </span>
      </div>

      {children}
    </div>
  );
}

/** Sivupalkki. Näkyy vasta kun tilaa on. */
function Rail() {
  const items = [
    "Yleiskatsaus",
    "Myynti",
    "Kuitit",
    "Kulut",
    "Kirjanpito",
    "Työvuorot",
  ];

  return (
    <nav
      aria-hidden="true"
      className="hidden w-[132px] shrink-0 flex-col gap-0.5 border-r p-2.5 sm:flex"
      style={{ background: "#fff", borderColor: "var(--bd-line)" }}
    >
      {items.map((item, i) => (
        <span
          key={item}
          className="truncate rounded-[8px] px-2.5 py-[7px] text-[11px] font-medium"
          style={
            i === 0
              ? { background: "var(--bd-accent-bg)", color: "var(--bd-accent-strong)" }
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
 * Viisi lukua ja yksi tila. Enempää ei mahdu luettavaksi tässä koossa,
 * eikä enempää tarvita kertomaan mistä on kyse.
 */
export function HeroPreview() {
  return (
    <Frame>
      <div className="flex">
        <Rail />

        <div className="min-w-0 flex-1 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-bold tracking-[-0.01em]">Tämän päivän tilanne</p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold"
              style={{ background: "var(--bd-green-bg)", color: "var(--bd-green)" }}
            >
              <i
                className="block h-[5px] w-[5px] rounded-full"
                style={{ background: "currentColor" }}
                aria-hidden="true"
              />
              Kirjanpito synkronoitu
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label="Myynti" value={<Euro value="5 240" />} hint="Kassan päiväraportti" />
            <Metric label="Kulut" value={<Euro value="1 820" />} hint="Kirjatut kulut" />
            <Metric
              label="Tulos"
              value={<Euro value="3 420" />}
              hint="Myynti miinus kulut"
              tone="good"
            />
            <Metric label="Kuitit" value={<span className="bd-num">24</span>} hint="Kaikki käsitelty" />
          </div>

          {/* Viivakaavio. SVG eikä kirjasto: yksi polku ei tarvitse kolmeasataa kilotavua. */}
          <div
            className="mt-2.5 rounded-[12px] p-3"
            style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
          >
            <p className="text-[10.5px] font-medium" style={{ color: "var(--bd-text-2)" }}>
              Myynti · viikko
            </p>
            <svg
              viewBox="0 0 320 64"
              className="mt-2 h-[64px] w-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="bd-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d13831" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#d13831" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 46 L53 38 L107 44 L160 24 L213 30 L267 14 L320 18 L320 64 L0 64 Z"
                fill="url(#bd-spark)"
              />
              <path
                d="M0 46 L53 38 L107 44 L160 24 L213 30 L267 14 L320 18"
                fill="none"
                stroke="#d13831"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="320" cy="18" r="3.5" fill="#d13831" />
            </svg>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * Kuukausinäkymä.
 *
 * Sama kehys, eri kysymys: hero vastaa "miten tänään meni", tämä
 * "miten kuukausi menee".
 */
export function MonthPreview() {
  const rows = [
    { name: "Ravintolamyynti", value: "48 900", share: 84 },
    { name: "Alkoholimyynti", value: "7 120", share: 12 },
    { name: "Muu myynti", value: "2 400", share: 4 },
  ];

  return (
    <Frame>
      <div className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12.5px] font-bold tracking-[-0.01em]">Elokuu 2026</p>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-semibold"
            style={{ background: "var(--bd-green-bg)", color: "var(--bd-green)" }}
          >
            <i
              className="block h-[5px] w-[5px] rounded-full"
              style={{ background: "currentColor" }}
              aria-hidden="true"
            />
            Kirjanpito valmis
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Myynti" value={<Euro value="58 420" />} hint="Kirjanpidon tuotot" />
          <Metric label="Kulut" value={<Euro value="41 840" />} hint="Kirjanpidon kulut" />
          <Metric
            label="Tulos"
            value={<Euro value="16 580" />}
            hint="Tuotot miinus kulut"
            tone="good"
          />
          <Metric label="ALV" value={<Euro value="5 240" />} hint="Maksettava" />
        </div>

        <div
          className="mt-2.5 rounded-[12px] p-3"
          style={{ background: "#fff", border: "1px solid var(--bd-line)" }}
        >
          <p className="text-[10.5px] font-medium" style={{ color: "var(--bd-text-2)" }}>
            Myynti ryhmittäin
          </p>

          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.name}>
                <div className="flex items-baseline justify-between gap-3 text-[11px]">
                  <span className="truncate" style={{ color: "var(--bd-text-2)" }}>
                    {row.name}
                  </span>
                  <span className="bd-num shrink-0 font-semibold">{row.value} €</span>
                </div>
                <div
                  className="mt-1 h-[4px] w-full overflow-hidden rounded-full"
                  style={{ background: "#eef1f6" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.share}%`, background: "#d13831", opacity: 0.75 }}
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
 * Sovelluksen oma osio sellaisenaan. Se on Budetin selkein yksittäinen
 * lupaus: ravintoloitsijan ei tarvitse muistaa mitä on kesken.
 */
export function TodoPreview() {
  const items = [
    { tone: "red" as const, text: "3 kuittia ei ole kirjanpidossa" },
    { tone: "amber" as const, text: "ALV-täsmäytys tarkistettavana" },
    { tone: "amber" as const, text: "1 kirjausesitys odottaa hyväksyntää" },
  ];

  return (
    <div
      className="rounded-[16px] p-4"
      style={{
        background: "#fff",
        border: "1px solid var(--bd-line)",
        boxShadow: "var(--bd-shadow)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-bold tracking-[-0.01em]">Mitä sinun pitää tehdä</p>
        <span className="bd-num text-[12px] font-bold" style={{ color: "var(--bd-accent)" }}>
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
              style={{ background: item.tone === "red" ? "#d13831" : "#d98511" }}
            />
            <span className="min-w-0 flex-1 text-[12.5px]">{item.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--bd-text-3)" }}>
        Budet laskee nämä aineistosta joka latauksella. Kun asia on hoidettu,
        rivi katoaa itsestään.
      </p>
    </div>
  );
}
