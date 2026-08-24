import { HeaderMenus } from "./header-menus";
import { MattiPanel } from "./matti/panel";
import { PageTitle } from "./page-title";
import { MonthPicker } from "./month-picker";
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
  matti,
  canAddReceipt,
  months,
  month,
}: {
  restaurantName: string;
  /** "Maanantai 24. elokuuta 2026" — ravintolan ajassa. */
  date: string;
  alerts: Alert[];
  userName: string;
  role: Role;
  search: SearchItem[];
  matti: boolean;
  canAddReceipt: boolean;
  /** Valittavat kuukaudet, uusin ensin. */
  months: string[];
  /** Kuluva kuukausi — valinta luetaan osoitteesta. */
  month: string;
}) {
  return (
    <header
      className="rf-z-chrome sticky top-0 hidden items-center gap-4 border-b px-6 py-3.5 md:flex"
      style={{ background: "var(--rf-card)", borderColor: "var(--rf-line)" }}
    >
      <div className="mr-auto min-w-0">
        <p className="truncate text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
          {restaurantName} · {date}
        </p>
        <h1 className="mt-0.5 truncate text-[18px] font-extrabold tracking-[-0.025em]">
          <PageTitle fallback="Hallinta" />
        </h1>
      </div>

      <Search items={search} />

      {/*
        Kuukausi on palkissa eikä sivulla.

        Se oli sivun ensimmäinen rivi, ja se rivi oli ainoa asia joka
        erotti näkymän suunnitelmasta: sisältö alkoi säätimestä eikä
        luvuista. Kuukausi koskee useaa sivua, joten se kuuluu samaan
        palkkiin kuin haku.
      */}
      <MonthPicker value={month} months={months} />

      {canAddReceipt ? (
        <ButtonLink
          href="/admin/kuitit/uusi"
          tone="primary"
          size="sm"
          icon={<RfIcon name="plus" size={15} />}
        >
          Lisää kuitti
        </ButtonLink>
      ) : null}

      <MattiPanel enabled={matti} compact />

      <HeaderMenus
        alerts={alerts}
        userName={userName}
        restaurantName={restaurantName}
        role={role}
        canOpenSettings={false}
      />
    </header>
  );
}
