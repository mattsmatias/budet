import { HeaderMenus } from "./header-menus";
import { PageTitle } from "./page-title";
import { MonthScope } from "./month-scope";
import { LanguagePicker } from "@/components/i18n/language-picker";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { AdminText } from "@/lib/i18n/admin-text";
import { Search, type SearchItem } from "./search";
import { ButtonLink } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import type { Alert, Role } from "@/lib/restoflow/types";

/**
 * Työpöydän yläpalkki.
 *
 * Vasemmalla missä ollaan, oikealla mitä voi tehdä.
 *
 * OTSIKKO ON PALKISSA EIKÄ SIVULLA.
 *
 * Jokainen sivu kirjoitti aiemmin oman otsikkonsa, ja ne olivat eri
 * kokoisia ja eri kohdissa. Palkissa otsikko on aina samassa paikassa
 * ja sivun ensimmäinen rivi on sen sisältöä — ei toistoa siitä missä
 * käyttäjä jo tietää olevansa.
 *
 * Nimi tulee reitistä eikä propista: kaksi totuutta samasta nimestä
 * ajautuu ennen pitkää erilleen.
 *
 * PÄÄTOIMINTO ON PALKISSA.
 *
 * Kuitin lisääminen on se mitä ravintoloitsija tekee useimmin, ja se
 * on sama toiminto miltä tahansa sivulta. Sivukohtaiset toiminnot
 * ovat sivulla; tämä ei ole sivukohtainen.
 */
export function TopBar({
  restaurantName,
  date,
  alerts,
  userName,
  role,
  search,
  canAddReceipt,
  canOpenSettings,
  months,
  month,
  locale,
  t,
}: {
  restaurantName: string;
  /** "MA 24.08.2026" — ravintolan ajassa. */
  date: string;
  alerts: Alert[];
  userName: string;
  role: Role;
  search: SearchItem[];
  canAddReceipt: boolean;
  /** Näkyykö Asetukset tunnusvalikossa. */
  canOpenSettings: boolean;
  /** Valittavat kuukaudet, uusin ensin. */
  months: string[];
  /** Kuluva kuukausi — valinta luetaan osoitteesta. */
  month: string;
  /** Kayttajan kieli kielivalitsinta varten. */
  locale: AppLocale;
  /** Kuoren tekstit. */
  t: AdminText;
}) {
  return (
    <header
      className="rf-no-print rf-z-chrome sticky top-0 hidden items-center gap-3.5 border-b px-[22px] py-3.5 md:flex"
      style={{ background: "var(--rf-card)", borderColor: "var(--rf-line)" }}
    >
      {/*
        Otsikko ei kutistu nollaan.

        Se oli mr-auto + min-w-0, ja oikean reunan säätimet söivät sen
        kokonaan kapealla työpöydällä: palkki alkoi hakukentästä eikä
        sivun nimestä.
      */}
      <div className="mr-auto min-w-[128px] flex-1">
        <p className="truncate text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
          {restaurantName} · {date}
        </p>
        <h1 className="mt-0.5 truncate text-[18px] font-bold tracking-[-0.02em]">
          <PageTitle fallback={t.kuori.admin} t={t} />
        </h1>
      </div>

      <Search items={search} t={t} />

      {/*
        Kuukausi on palkissa eikä sivulla.

        Se oli sivun ensimmäinen rivi, ja se rivi oli ainoa asia joka
        erotti näkymän suunnitelmasta: sisältö alkoi säätimestä eikä
        luvuista. Kuukausi koskee useaa sivua, joten se kuuluu samaan
        palkkiin kuin haku.
      */}
      <MonthScope value={month} months={months} />

      {/* Kieli tunnusvalikon vieressa: se on tilin asetus. */}
      <LanguagePicker current={locale} />

      {canAddReceipt ? (
        <ButtonLink
          href="/admin/kuitit/uusi"
          tone="primary"
          size="sm"
          icon={<RfIcon name="plus" size={15} />}
        >
          {t.kuori.addReceipt}
        </ButtonLink>
      ) : null}

      <HeaderMenus
        t={t}
        alerts={alerts}
        userName={userName}
        restaurantName={restaurantName}
        role={role}
        canOpenSettings={canOpenSettings}
      />
    </header>
  );
}
