import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { HeaderMenus } from "./header-menus";
import { MattiPanel } from "./matti/panel";
import { Search, type SearchItem } from "./search";
import type { Alert, Role } from "@/lib/restoflow/types";

/**
 * Työpöydän yläpalkki.
 *
 * Tervehdys vasemmalla, pyöreät toimintopainikkeet oikealla.
 *
 * NELJÄ PAINIKETTA, EI ENEMPÄÄ.
 *
 * Haku, Matti, ilmoitukset ja asetukset. Jokainen niistä on asia jota
 * tarvitaan miltä tahansa sivulta, ja juuri se erottaa ne
 * navigaatiosta: sivupalkki vie jonnekin, nämä tekevät jotain tässä.
 *
 * TERVEHDYS ON TÄSSÄ EIKÄ SIVULLA.
 *
 * Se oli aiemmin yleiskuvan otsikossa, jolloin se katosi heti kun
 * käyttäjä siirtyi Kuiteille — ja vei tilan siltä mitä sivulla
 * oikeasti on.
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
  matti,
  canOpenSettings,
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
  matti: boolean;
  canOpenSettings: boolean;
}) {
  return (
    <div className="rf-z-chrome relative hidden items-center justify-between gap-6 px-7 pt-6 md:flex">
      <div className="min-w-0">
        <h2 className="truncate text-[24px] font-extrabold tracking-[-0.025em]">
          {greeting}
          {firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
        </h2>
        <p className="mt-1 truncate text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          {date} · {restaurantName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Search items={search} />

        <MattiPanel enabled={matti} compact />

        <HeaderMenus
          alerts={alerts}
          userName={userName}
          restaurantName={restaurantName}
          role={role}
          canOpenSettings={false}
          showUser={false}
        />

        {canOpenSettings ? (
          <Link
            href="/admin/asetukset"
            aria-label="Asetukset"
            title="Asetukset"
            className="rf-press flex h-10 w-10 items-center justify-center"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "50%",
            }}
          >
            <RfIcon name="settings" size={17} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
