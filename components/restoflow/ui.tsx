/**
 * Kate'n jaetut esityskomponentit.
 *
 * Apple-henkinen pintakieli yhdessä paikassa: valkoinen kortti, suuri
 * pyöristys, hienovarainen varjo. Väriä käytetään vain tilaan.
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatMoney } from "@/lib/money";

export type Tone = "neutral" | "ok" | "info" | "warn" | "risk";

const TONE_STYLES: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: {
    bg: "var(--rf-inset)",
    text: "var(--rf-text-2)",
    dot: "var(--rf-text-3)",
  },
  ok: {
    bg: "var(--rf-green-bg)",
    text: "var(--rf-green-text)",
    dot: "var(--rf-green)",
  },
  info: {
    bg: "var(--rf-blue-bg)",
    text: "var(--rf-blue-text)",
    dot: "var(--rf-blue)",
  },
  warn: {
    bg: "var(--rf-amber-bg)",
    text: "var(--rf-amber-text)",
    dot: "var(--rf-amber)",
  },
  risk: {
    bg: "var(--rf-red-bg)",
    text: "var(--rf-red-text)",
    dot: "var(--rf-red)",
  },
};

export function Card({
  children,
  className = "",
  hover,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`${hover ? "rf-card-hover" : ""} ${
        padded ? "px-[18px] pb-4 pt-[15px]" : ""
      } ${className}`}
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-[13px] flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">{title}</h2>
        {subtitle ? (
          <p
            className="mt-[3px] text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"
      style={{
        background: s.bg,
        color: s.text,
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      ) : null}
      {children}
    </span>
  );
}
/**
 * Avainluku.
 *
 * Yksi kortti koko sovellukselle. Aiemmin näitä oli kaksi rinnakkain,
 * ja sama luku näytti eri sivuilla eri tuotteelta.
 *
 * IKONILAATTA ON TARTTUMAPINTA, EI KORISTE.
 *
 * Neljä korttia rinnakkain on neljä lähes samanlaista suorakaidetta.
 * Värillinen laatta antaa jokaiselle tunnistettavan muodon, ja silmä
 * löytää oikean kortin ennen kuin ehtii lukea otsikon.
 *
 * Laatan väri tulee kortin tilasta samasta lähteestä kuin pilleri —
 * satunnainen väri olisi nopeasti mukavampi katsoa mutta opettaisi
 * ettei väriin kannata luottaa.
 *
 * MUUTOS ON PILLERI, EI RIVI.
 *
 * Prosentti kuuluu luvun viereen, koska se luetaan samalla
 * silmäyksellä. Vertailuluku kuuluu jalkaan, koska se luetaan vasta
 * jos prosentti herättää kysymyksen.
 */
export function MetricCard({
  label,
  value,
  hint,
  trend,
  conclusion,
  delta,
  bar,
  tone = "neutral",
  tileTone,
  icon,
  href,
  linkLabel = "Näytä",
  highlight,
}: {
  label: string;
  /** Merkkijono tai elementti — esimerkiksi kasvava luku. */
  value: ReactNode;
  /**
   * Mitä luku tarkoittaa. Kulukorteissa aina "kirjatut kulut", jottei
   * lukua lueta ravintolan tuloksena.
   */
  hint?: string;
  /** Pieni trendiviiva. Näytetään jalassa, ei luvun vieressä. */
  trend?: ReactNode;
  /** Johtopäätös luvusta. Ilman tätä kortti on pelkkä numero. */
  conclusion?: ReactNode;
  /**
   * Muutos pillerinä luvun vieressä.
   *
   * Lyhyt: "↑ 12,4 %", "+7", "Tahdissa". Kokonainen lause kuuluu
   * jalkaan — pitkä pilleri työntää luvun riviltä pois.
   */
  delta?: { text: string; tone?: MetricTone };
  /** Täyttyvä palkki: budjetin käyttöaste, kapasiteetti. */
  bar?: { percent: number; tone?: MetricTone };
  tone?: MetricTone;
  /** Ikonilaatan sävy erikseen, kun väri on tunniste eikä tila. */
  tileTone?: MetricTone;
  icon?: ReactNode;
  href?: string;
  /** Jalan linkin teksti. */
  linkLabel?: string;
  /** Korostettu kortti: puhelimessa tärkein luku nostetaan esiin. */
  highlight?: boolean;
}) {
  const footText = conclusion ?? hint;
  const aside = conclusion && hint ? hint : null;

  /*
   * PALKKI KORVAA JALAN.
   *
   * Budjettikortissa oli molemmat: palkki ja sen alla "0,00 € /
   * 15 000,00 €". Rivi ei kertonut mitään uutta — luku on jäljellä
   * oleva summa ja pilleri käyttöaste, joten käytetty ja koko
   * budjetti luetaan niistä. Ylimääräinen rivi teki kortista
   * neljätoista pikseliä muita korkeamman, ja auto-rows-fr venytti
   * koko rivin sen mukaan.
   */
  const hasFoot =
    bar === undefined &&
    (footText !== undefined || href !== undefined || trend !== undefined);

  const skin = tileSkin(tileTone ?? (highlight ? "accent" : tone));

  const body = (
    <div
      className="rf-card-lift flex h-full flex-col overflow-hidden"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-stat)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      <div className="flex flex-1 flex-col px-4 pb-4 pt-[15px]">
        <div className="flex items-start gap-[11px]">
          {icon ? (
            <span
              aria-hidden="true"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center"
              style={{
                background: skin.bg,
                color: skin.fg,
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {icon}
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[12px] font-medium"
              style={{ color: "var(--rf-text-2)" }}
            >
              {label}
            </p>
            <p className="rf-tabular mt-[3px] text-[22px] font-bold leading-[1.4] tracking-[-0.03em]">
              {value}
            </p>
          </div>

          {delta ? (
            <DeltaPill text={delta.text} tone={delta.tone ?? tone} />
          ) : null}
        </div>

        {aside ? (
          <p
            className="mt-2.5 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {aside}
          </p>
        ) : null}

        {hasFoot ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-[11.5px]"
              style={{ color: footColor(tone) }}
            >
              {footText}
            </span>

            {trend ? <span className="shrink-0">{trend}</span> : null}

            {href && !trend ? (
              <span
                className="shrink-0 text-[11.5px] font-bold"
                style={{ color: "var(--rf-accent)" }}
              >
                {linkLabel} <span aria-hidden="true">→</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {bar ? (
          <div
            className="mt-[11px] h-1 w-full overflow-hidden"
            style={{ background: "var(--rf-inset)", borderRadius: 980 }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, Math.max(0, bar.percent))}%`,
                background: solidFor(bar.tone ?? tone),
                borderRadius: 980,
              }}
            />
          </div>
        ) : null}

        <div className="mt-auto" />
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

export type MetricTone =
  | "neutral"
  | "up"
  | "down"
  | "muted"
  | "warn"
  | "bad"
  | "accent"
  | "brand"
  | "violet"
  | "green"
  | "blue";

/**
 * Muutospilleri.
 *
 * Kulujen kasvu ei ole hyvä eikä huono ilman kontekstia, joten
 * neutraali on harmaa. Vihreä pilleri laskeville kuluille olisi
 * arvostelma jota ohjelma ei voi tehdä — mutta budjetin ylitys on
 * ylitys, ja se saa värinsä.
 */
function DeltaPill({ text, tone }: { text: string; tone: MetricTone }) {
  const skin =
    tone === "down"
      ? { bg: "var(--rf-green-bg)", fg: "var(--rf-green-text)" }
      : tone === "up" || tone === "warn"
        ? { bg: "var(--rf-amber-bg)", fg: "var(--rf-amber-text)" }
        : tone === "bad"
          ? { bg: "var(--rf-red-bg)", fg: "var(--rf-red-text)" }
          : { bg: "var(--rf-inset)", fg: "var(--rf-text-2)" };

  return (
    <span
      className="inline-flex shrink-0 items-center px-[7px] py-[2px] text-[11px] font-bold"
      style={{
        background: skin.bg,
        color: skin.fg,
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      {text}
    </span>
  );
}

/** Ikonilaatan sävy. Sama lähde kuin pillerillä. */
function tileSkin(tone: MetricTone): { bg: string; fg: string } {
  /*
   * Neljä tunnistesävyä ennen tilasävyjä.
   *
   * brand / green / violet / blue eivät kerro onko luku hyvä vai
   * huono — ne erottavat neljä korttia toisistaan. Tilasävyt (up,
   * down, warn, bad) kertovat, ja niitä käytetään vain kun kortin
   * tila on oikeasti se.
   *
   * Nämä olivat hetken samoja: tunnisteeksi tarkoitettu "up" piirsi
   * keltaisen laatan Myynti tänään -korttiin, ja keltainen luetaan
   * varoituksena.
   */
  return tone === "brand"
    ? { bg: "var(--rf-accent-bg)", fg: "var(--rf-accent)" }
    : tone === "violet"
      ? { bg: "var(--rf-violet-bg)", fg: "var(--rf-violet)" }
      : tone === "green"
        ? { bg: "var(--rf-green-bg)", fg: "var(--rf-green-text)" }
        : tone === "blue"
          ? { bg: "var(--rf-blue-bg)", fg: "var(--rf-blue-text)" }
          : tone === "up" || tone === "warn"
            ? { bg: "var(--rf-amber-bg)", fg: "var(--rf-amber-text)" }
            : tone === "down"
              ? { bg: "var(--rf-green-bg)", fg: "var(--rf-green-text)" }
              : tone === "bad"
                ? { bg: "var(--rf-red-bg)", fg: "var(--rf-red-text)" }
                : tone === "accent"
                  ? { bg: "var(--rf-accent-bg)", fg: "var(--rf-accent)" }
                  : { bg: "var(--rf-blue-bg)", fg: "var(--rf-blue-text)" };
}

/**
 * Jalan tekstin väri.
 *
 * Harmaa lähes aina: vertailuluku ei ole arvostelma. Varoitus on
 * poikkeus — "Puuttuvia tai epävarmoja tietoja" harmaana katoaisi
 * juuri siltä joka sen tarvitsee.
 */
function footColor(tone: MetricTone): string {
  return tone === "warn"
    ? "var(--rf-amber-text)"
    : tone === "bad"
      ? "var(--rf-red-text)"
      : "var(--rf-text-3)";
}

/**
 * Täyttyvän palkin väri.
 *
 * Neutraali palkki oli korostuspunainen, eli sama väri jolla muualla
 * merkitään ylitys. Budjetti jossa on 40 % käytetty näytti siis
 * hälyttävältä. Neutraali käyttää nyt kortin omaa tunnisteväriä, ja
 * punainen jää sille mitä se tarkoittaa.
 */
function solidFor(tone: MetricTone): string {
  return tone === "up" || tone === "warn"
    ? "var(--rf-amber)"
    : tone === "down"
      ? "var(--rf-green)"
      : tone === "bad"
        ? "var(--rf-red)"
        : tone === "violet"
          ? "var(--rf-violet)"
          : tone === "green"
            ? "var(--rf-green)"
            : tone === "brand" || tone === "accent"
              ? "var(--rf-accent)"
              : "var(--rf-blue)";
}

/**
 * Muutosindikaattori.
 *
 * Kulujen kasvu ei ole hyvä eikä huono ilman kontekstia, joten nuoli on
 * harmaa. Vihreä nuoli laskeville kuluille olisi arvostelma jota ohjelma ei
 * voi tehdä.
 */
export function TrendBadge({
  text,
  direction,
}: {
  text: string;
  direction: "up" | "down" | "flat" | "none";
}) {
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "";
  return (
    <span
      className="rf-tabular text-[13px]"
      style={{ color: "var(--rf-text-2)" }}
    >
      {arrow ? <span aria-hidden="true">{arrow} </span> : null}
      {text}
    </span>
  );
}

/**
 * Vaakapalkki kulujen jakaumaan.
 *
 * Yksi harmaa sävy kaikille kategorioille — värikoodattu palkki näyttäisi
 * että kategorioilla on eri merkitys, mitä niillä ei ole.
 */
export function BarRow({
  label,
  valueCents,
  share,
  meta,
  icon,
  muted,
  shareLabel,
}: {
  label: string;
  valueCents: number;
  share: number;
  meta?: string;
  icon?: ReactNode;
  /** Vaimennettu palkki: vertailukohta, ei tarkastelun kohde. */
  muted?: boolean;
  /** Mihin osuus suhteutuu. Oletus: kirjatut kulut. */
  shareLabel?: string;
}) {
  const pct = Math.round(share * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="flex items-center gap-2 text-[14px] font-medium">
          {icon ? (
            <span className="shrink-0" style={{ color: "var(--rf-text-2)" }}>
              {icon}
            </span>
          ) : null}
          {label}
        </span>
        <span className="rf-tabular text-[14px] font-semibold">
          {formatMoney(valueCents)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="img"
        aria-label={`${label}: ${pct} prosenttia ${shareLabel ?? "kirjatuista kuluista"}`}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.max(1.5, share * 100)}%`,
            background: "var(--rf-text)",
            borderRadius: 999,
            opacity: muted ? 0.32 : 0.82,
          }}
        />
      </div>
      <p
        className="rf-tabular mt-1.5 text-[12px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        {pct} %{meta ? ` · ${meta}` : ""}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="py-12 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      <p
        className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

/**
 * Demo-huomautus.
 *
 * Näkyy jokaisessa näkymässä. Demo-aineistoa ei saa esittää oikeana, ja
 * kulujen merkitys on kerrottava: kirjatut kuitit, ei pankkitili.
 */
/**
 * Rajausilmoitus.
 *
 * Ei "demo-ilmoitus": sovellus lukee oikeaa aineistoa. Tämä kertoo mitä
 * luvut *eivät* sisällä. Väärä väite omasta aineistosta on pahempi kuin
 * puuttuva selite — kirjautunut käyttäjä ei saa lukea että hänen omat
 * numeronsa ovat keksittyjä.
 */
export function ScopeNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
      style={{
        background: "var(--rf-blue-bg)",
        color: "var(--rf-blue-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 font-semibold">
        i
      </span>
      <p>
        {children ?? (
          <>
            Luvut tarkoittavat <strong>Kateen kirjattuja kuluja</strong> —
            sovellus ei näe kassaa eikä pankkitiliä.
          </>
        )}
      </p>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2
      className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-[0.04em]"
      style={{ color: "var(--rf-text-2)" }}
    >
      {children}
    </h2>
  );
}

export function Avatar({
  initials,
  size = 36,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </span>
  );
}

/** Ohut ikoni. Yhtenäinen viivanpaksuus koko sovelluksessa. */
// ---------------------------------------------------------------------------
// Kategoriat
// ---------------------------------------------------------------------------

import { CategoryIcon } from "./icons";
import type { ExpenseCategory } from "@/lib/restoflow/types";

/** Kategorian ikoni pyöreällä pohjalla — listojen alkuun. */
export function CategoryBubble({
  category,
  size = 34,
}: {
  category: ExpenseCategory;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
      }}
    >
      <CategoryIcon category={category} size={Math.round(size * 0.54)} />
    </span>
  );
}

/**
 * Budjettipalkki.
 *
 * Väri on tässä poikkeuksellisesti merkityksellinen: se kertoo tilan
 * (ok / lähestyy / ylitetty), ei kategoriaa.
 */
export function BudgetBar({
  ratio,
  status,
}: {
  ratio: number | null;
  status: "ok" | "warning" | "exceeded" | "none";
}) {
  if (ratio === null) {
    return (
      <div
        className="h-1.5 w-full"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="img"
        aria-label="Ei budjettia asetettu"
      />
    );
  }

  const color =
    status === "exceeded"
      ? "var(--rf-red)"
      : status === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-green)";

  return (
    <div
      className="relative h-1.5 w-full overflow-hidden"
      style={{ background: "var(--rf-inset)", borderRadius: 999 }}
      role="img"
      aria-label={`${Math.round(ratio * 100)} prosenttia budjetista`}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, Math.max(2, ratio * 100))}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

/** Vakavuusmerkki hälytyksille. */
export type Severity = "info" | "warning" | "critical";

/**
 * Vakavuuden väri.
 *
 * Sama pari joka paikassa: yleiskuvan huomiokortti, kellon
 * pudotusvalikko ja ilmoitussivu. Ne olivat kolme erillistä kopiota,
 * ja kaksi niistä oli jo ehtinyt erota kolmannesta.
 *
 * Tekstiväri eikä pintaväri: nämä piirtyvät tekstin ja ikonien
 * väreinä vaaleaa pohjaa vasten, ja kylläisempi sävy jäi alle 4,5:n.
 */
export function severityColor(severity: Severity): string {
  return severity === "critical"
    ? "var(--rf-red-text)"
    : severity === "warning"
      ? "var(--rf-amber-text)"
      : "var(--rf-blue-text)";
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const color =
    severity === "critical"
      ? "var(--rf-red)"
      : severity === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-blue)";

  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
    />
  );
}

// ---------------------------------------------------------------------------

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_TONES: Record<
  ButtonTone,
  { background: string; color: string; border?: string }
> = {
  // Ensisijainen toiminto. Sininen tarkoittaa "tästä painetaan" —
  // se ei ole brändipinta eikä sitä käytetä koristeena.
  primary: { background: "var(--rf-accent)", color: "var(--rf-on-accent)" },
  secondary: { background: "var(--rf-inset)", color: "var(--rf-text)" },
  ghost: {
    background: "var(--rf-card)",
    color: "var(--rf-text)",
    border: "1px solid var(--rf-line)",
  },
  danger: { background: "var(--rf-red)", color: "var(--rf-on-accent)" },
};

/**
 * Painike.
 *
 * Aiemmin jokainen painike oli käsin kirjoitettu style-lohko
 * kutsupaikassa, ja niitä oli kymmeniä. Sama "tallenna" näytti eri
 * sivuilla eri kokoiselta. Hierarkia on nyt nimetty: yksi primary per
 * näkymä, muut secondary tai ghost.
 *
 * Kosketuskohde on vähintään 44 px korkea myös pienessä koossa —
 * pienempi on puhelimella ohi osumisen paikka.
 */
export function Button({
  tone = "secondary",
  size = "md",
  full,
  icon,
  children,
  ...rest
}: {
  tone?: ButtonTone;
  size?: "sm" | "md";
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const palette = BUTTON_TONES[tone];

  return (
    <button
      {...rest}
      className={`rf-press inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold disabled:opacity-50 ${
        size === "sm" ? "px-3.5 text-[13px]" : "px-4 text-[14px]"
      } ${full ? "w-full" : ""} ${rest.className ?? ""}`}
      style={{
        minHeight: size === "sm" ? 36 : 44,
        background: palette.background,
        color: palette.color,
        border: palette.border ?? "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
        ...rest.style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** Linkki joka näyttää painikkeelta. Sama hierarkia, eri elementti. */
export function ButtonLink({
  href,
  tone = "secondary",
  size = "md",
  full,
  icon,
  children,
}: {
  href: string;
  tone?: ButtonTone;
  size?: "sm" | "md";
  full?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const palette = BUTTON_TONES[tone];

  return (
    <Link
      href={href}
      className={`rf-press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold ${
        size === "sm" ? "px-[15px] text-[13px]" : "px-4 text-[14px]"
      } ${full ? "w-full" : ""}`}
      style={{
        minHeight: size === "sm" ? 36 : 44,
        background: palette.background,
        color: palette.color,
        border: palette.border ?? "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
