import Link from "next/link";
import type { ReactNode } from "react";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import { dateShortWeekday } from "@/lib/i18n/format";
import type { AppLocale } from "@/lib/i18n/app-locales";

/**
 * Työntekijänäkymän rakennuspalikat.
 *
 * Neljä sivua, yksi ulkoasu. Tämä tiedosto on se paikka jossa mitat ja
 * sävyt päätetään: kun otsikko, osio tai rivi rakennetaan samasta
 * palasta, sivut eivät voi ajautua erinäköisiksi.
 *
 * Hallintapuolella on oma kirjastonsa (components/restoflow/ui.tsx).
 * Työntekijänäkymä ei käytä sitä, koska se on suunniteltu tiheälle
 * työpöytänäkymälle: samat kortit puhelimessa ovat liian ahtaita ja
 * liian monta.
 */

/** Sivun otsikko. Sama paikka ja sama koko joka sivulla. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-1 pt-1">
      <div className="min-w-0">
        {/*
          Otsikko on suurempi ja tiukempi kuin hallintanäkymässä.
          Etusivun typografia kantaa sivun, ja puhelimessa on tilaa vain
          yhdelle otsikolle kerrallaan — silloin se saa olla otsikko.
        */}
        <h1
          className="text-[28px] font-semibold"
          style={{ letterSpacing: "-0.025em" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/** Osion pieni otsikko. Ei laatikkoa — pelkkä teksti sisällön yllä. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-1">
      <h2
        className="text-[12px] font-semibold uppercase"
        style={{ letterSpacing: "0.07em", color: "var(--rf-text-3)" }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * Kevyt pinta.
 *
 * Ohut reuna ja hienovarainen varjo. Aiemmin varjoa ei ollut lainkaan
 * ja se oli varattu leimauskortille, mutta puhelimen ruudulla kortteja
 * on kerrallaan neljä eikä neljääkymmentä: silloin syvyys erottaa ne
 * toisistaan paremmin kuin pelkkä viiva, eikä näkymä muutu levottomaksi.
 * Leimauskortti erottuu yhä, koska sen varjo on isompi.
 *
 * Mitat tulevat worker.css:stä yhtenä luokkana. Ennen sama reuna ja
 * pyöristys kirjoitettiin käsin neljään paikkaan, ja ne olivat jo
 * ajautuneet erilleen.
 */
export function Surface({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`bd-app-card ${padded ? "px-4 py-4" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** Iso luku ja sen selite. Yhteenvetoihin. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </p>
      <p
        className="rf-tabular mt-1 text-[24px] font-semibold"
        suppressHydrationWarning
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Listarivi.
 *
 * Linkkinä painallettava, ilman href pelkkä rivi. Erottimet tulevat
 * listalta eikä riviltä, jotta viimeisen rivin alle ei jää viivaa.
 */
export function Row({
  title,
  meta,
  right,
  href,
  icon,
  muted,
}: {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  href?: string;
  icon?: IconName;
  /** Hiljaisempi rivi: vapaapäivä, menneisyys, ei-toiminto. */
  muted?: boolean;
}) {
  const body = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon ? (
        <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name={icon} size={19} />
        </span>
      ) : null}

      <div className="min-w-0 flex-1">
        <div
          className="text-[15px] font-medium"
          style={
            muted ? { color: "var(--rf-text-3)", fontWeight: 400 } : undefined
          }
        >
          {title}
        </div>
        {meta ? (
          <div
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {meta}
          </div>
        ) : null}
      </div>

      {right ? <div className="shrink-0 text-right">{right}</div> : null}

      {href ? (
        <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name="chevron" size={16} />
        </span>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="rf-press bd-app-row block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Rivilista pinnalla. Erottimet rivien väliin, ei reunoihin. */
export function List({ children }: { children: ReactNode }) {
  return (
    <Surface padded={false}>
      <div
        className="bd-app-list divide-y"
        style={{ borderColor: "var(--rf-line)" }}
      >
        {children}
      </div>
    </Surface>
  );
}

/**
 * Tyhjä tila.
 *
 * Kertoo mitä tähän tulee ja milloin. Pelkkä "ei tietoja" jättää
 * käyttäjän arvailemaan onko kyseessä tyhjyys vai vika.
 */
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Surface>
      <p className="text-[15px] font-medium">{title}</p>
      <p
        className="mt-1 text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {description}
      </p>
    </Surface>
  );
}

/** Tilamerkintä: vahvistettu, muuttunut, avoin. */
export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "info" | "warn";
  children: ReactNode;
}) {
  const colors = {
    neutral: { bg: "var(--rf-inset)", text: "var(--rf-text-2)" },
    ok: { bg: "var(--rf-green-bg)", text: "var(--rf-green-text)" },
    info: { bg: "var(--rf-blue-bg)", text: "var(--rf-blue-text)" },
    warn: { bg: "var(--rf-amber-bg)", text: "var(--rf-amber-text)" },
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium whitespace-nowrap"
      style={{ background: colors.bg, color: colors.text, borderRadius: 8 }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Päivämäärät
// ---------------------------------------------------------------------------

/**
 * "ma 24.8." kielen mukaan.
 *
 * Tässä oli kovakoodattu suomalainen viikonpäivälista. Se ei ollut
 * pelkkä käännöspuute vaan väärä tieto: englanniksi "Ma" ei ole
 * maanantai. Intl osaa lyhenteen jokaisella kielellä, eikä listaa
 * tarvitse ylläpitää.
 */
export function shortDay(isoDate: string, locale: AppLocale): string {
  return dateShortWeekday(isoDate, locale);
}

/** "24.8." */
export function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

// ---------------------------------------------------------------------------
// Latausluurangot
// ---------------------------------------------------------------------------
//
// Muoto vastaa oikeaa sisältöä, jotta mikään ei hyppää paikoilleen kun
// data saapuu. Väärän muotoinen luuranko on levottomampi kuin ei
// luurankoa lainkaan.

/** Otsikon paikka. */
export function HeaderSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2 px-1 pt-1">
      <div className={`rf-skeleton-block h-7 ${wide ? "w-44" : "w-32"}`} />
      <div className="rf-skeleton-block h-4 w-40" />
    </div>
  );
}

/** Rivilistan paikka. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="bd-app-card flex items-center justify-between gap-4 px-4 py-3.5"
        >
          <div className="space-y-1.5">
            <div className="rf-skeleton-block h-4 w-24" />
            <div className="rf-skeleton-block h-3 w-32" />
          </div>
          <div className="rf-skeleton-block h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
