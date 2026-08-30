import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Pöytävarausten kaksi näkymää.
 *
 * Salinäkymä on päivittäinen työ, asetukset kertaluontoinen. Ne
 * kuuluvat silti yhteen: pöytä lisätään asetuksissa ja sitä katsotaan
 * salissa, ja aiemmin niiden välillä liikuttiin päävalikon ja
 * asetusten kautta eri puolilta sovellusta.
 *
 * Linkkejä eikä painikkeita, koska valinta on osoitteessa: näkymän voi
 * linkittää ja selaimen paluunappi vie edelliseen eikä ulos.
 */
export function ReservationTabs({
  t,
  current,
}: {
  t: AdminText;
  current: "sali" | "asetukset";
}) {
  const kohdat = [
    { id: "sali" as const, href: "/admin/varaukset", label: t.varaus.tabDay },
    {
      id: "asetukset" as const,
      href: "/admin/varaukset/asetukset",
      label: t.varaus.tabSettings,
    },
  ];

  return (
    <nav
      aria-label={t.nav.reservations}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
    >
      {kohdat.map((kohta) => {
        const valittu = kohta.id === current;

        return (
          <Link
            key={kohta.id}
            href={kohta.href}
            aria-current={valittu ? "page" : undefined}
            className="rf-press flex shrink-0 items-center whitespace-nowrap px-3.5 py-2 text-[13px] font-bold"
            style={{
              background: valittu ? "var(--rf-accent-bg)" : "var(--rf-card)",
              color: valittu ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
              border: "1px solid var(--rf-line)",
              borderRadius: 999,
            }}
          >
            {kohta.label}
          </Link>
        );
      })}
    </nav>
  );
}
