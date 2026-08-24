import { HeaderMenus } from "./header-menus";
import { Search, type SearchItem } from "./search";
import type { Alert, Role } from "@/lib/restoflow/types";

/**
 * Työpöydän yläpalkki.
 *
 * Kolme asiaa vasemmalta oikealle: kuka ja milloin, haku, ilmoitukset.
 *
 * TERVEHDYS ON TÄSSÄ EIKÄ SIVULLA.
 *
 * Se oli aiemmin yleiskuvan otsikossa, jolloin se katosi heti kun
 * käyttäjä siirtyi Kuiteille. Palkissa se on aina näkyvissä ja päivä
 * sen mukana — ja yleiskuvan otsikko vapautuu kertomaan mitä sivulla
 * on, mikä on sen oikea tehtävä.
 *
 * TUNNUS ON OIKEASSA YLÄKULMASSA.
 *
 * Siellä sitä on totuttu etsimään. Sivupalkin pohja on varattu
 * päätoiminnolle: siirtymiä on kymmenen, tekemistä yksi, eikä niiden
 * kuulu näyttää samalta.
 *
 * Asetukset eivät ole tunnusvalikossa vaan sivupalkin Tili-ryhmässä.
 * Kaksi paikkaa samalle asialle on kaksi paikkaa joita pitää etsiä.
 */
export function TopBar({
  greeting,
  firstName,
  date,
  alerts,
  userName,
  restaurantName,
  role,
  search,
}: {
  greeting: string;
  firstName: string;
  /** "Maanantai 24. elokuuta 2026" — ravintolan ajassa. */
  date: string;
  alerts: Alert[];
  userName: string;
  restaurantName: string;
  role: Role;
  search: SearchItem[];
}) {
  return (
    <div className="rf-z-chrome relative mx-auto hidden w-full max-w-6xl items-center gap-6 px-4 pt-5 md:flex md:px-6">
      <div className="min-w-0 shrink-0">
        <p className="truncate text-[16px] font-semibold tracking-tight">
          <span aria-hidden="true">👋</span> {greeting}
          {firstName ? `, ${firstName}` : ""}
        </p>
        <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {date}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 justify-center">
        <Search items={search} />
      </div>

      <div className="shrink-0">
        <HeaderMenus
          alerts={alerts}
          userName={userName}
          restaurantName={restaurantName}
          role={role}
          canOpenSettings={false}
        />
      </div>
    </div>
  );
}
