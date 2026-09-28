import { HeaderMenus } from "./header-menus";
import type { Labels } from "@/lib/i18n/labels";
import { PageTitle } from "./page-title";
import { MonthScope } from "./month-scope";
import { LanguagePicker } from "@/components/i18n/language-picker";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { AdminText } from "@/lib/i18n/admin-text";
import { Search, type SearchItem } from "./search";
import type { Role } from "@/lib/restoflow/types";
import type { FocusItem } from "@/lib/restoflow/dashboard";

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
 * PÄÄTOIMINTO EI OLE PALKISSA.
 *
 * Tässä oli "Lisää kuitti" -painike. Kamerapainike oli samaan aikaan
 * näkyvissä oikeassa alakulmassa joka kokoluokassa, joten sama
 * toiminto oli ruudulla kahdesti — ja kahdesta napista toinen on aina
 * se jota ei painettu. Kuitin lisäys on nyt yhdessä paikassa, ja se
 * paikka on kamerapainike.
 */
export function TopBar({
  restaurantName,
  date,
  alerts,
  userName,
  role,
  search,
  canOpenSettings,
  months,
  month,
  locale,
  nimet,
  t,
}: {
  restaurantName: string;
  /** "MA 24.08.2026" — ravintolan ajassa. */
  date: string;
  /** Yhteinen huomiolista: sama jonka yleiskatsaus ja Ilmoitukset nayttavat. */
  alerts: FocusItem[];
  userName: string;
  role: Role;
  search: SearchItem[];
  /** Näkyykö Asetukset tunnusvalikossa. */
  canOpenSettings: boolean;
  /** Valittavat kuukaudet, uusin ensin. */
  months: string[];
  /** Kuluva kuukausi — valinta luetaan osoitteesta. */
  month: string;
  /** Kayttajan kieli kielivalitsinta varten. */
  locale: AppLocale;
  nimet: Labels;
  /** Kuoren tekstit. */
  t: AdminText;
}) {
  return (
    <header
      className="rf-no-print rf-z-chrome sticky top-0 hidden items-center gap-3.5 border-b px-[22px] py-3.5 lg:flex"
      style={{ background: "var(--rf-card)", borderColor: "var(--rf-line)" }}
    >
      {/*
        Otsikko ei kutistu nollaan.

        Se oli me-auto + min-w-0, ja oikean reunan säätimet söivät sen
        kokonaan kapealla työpöydällä: palkki alkoi hakukentästä eikä
        sivun nimestä.
      */}
      <div className="me-auto min-w-[128px] flex-1">
        {/*
          Yläpalkin ylärivillä on päiväys, ei yrityksen nimi.

          Nimi oli tässä vaihtajana, ja sama nimi luki kiskon
          tunnuslohkossa Katen alla. Kahdesta paikasta toinen on aina
          se väärä paikka etsiä. Vaihtaja on nyt siinä missä nimikin
          on — kiskossa — ja tähän jää päiväys, jota ei lue muualla.
        */}
        <p
          className="truncate text-[11.5px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {date}
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
      <MonthScope t={t} value={month} months={months} locale={locale} />

      {/* Kieli tunnusvalikon vieressa: se on tilin asetus. */}
      <LanguagePicker current={locale} />

      <HeaderMenus
        nimet={nimet}
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
