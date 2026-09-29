import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";

export type LaskutValilehti = "laskut" | "asiakkaat";

/**
 * Laskujen välilehdet.
 *
 * MIKSI ASIAKKAAT OVAT LASKUJEN SISÄLLÄ.
 *
 * Asiakasrekisteri on olemassa vain laskutusta varten: se on lista
 * siitä keneltä laskutetaan. Omana valikkokohtanaan se oli erillään
 * ainoasta asiasta joka sitä käyttää, ja kun se vielä oli piilossa
 * ylivuotovalikossa, laskuttaja etsi vastaanottajaansa väärästä
 * paikasta. Saman kiskon kohdan alla ne ovat kaksi näkymää yhteen
 * tehtävään: mitä on laskutettu ja keneltä laskutetaan.
 *
 * Välilehdet eivätkä alasivut siksi, että kumpikin on yhtä tärkeä.
 * Alasivu olisi kertonut asiakkaiden olevan laskujen yksityiskohta.
 */
export function LaskutTabs({ t, nyt }: { t: AdminText; nyt: LaskutValilehti }) {
  const kohdat: { id: LaskutValilehti; label: string; href: string }[] = [
    { id: "laskut", label: t.laskut.title, href: "/admin/laskut" },
    {
      id: "asiakkaat",
      label: t.asiakkaat.title,
      href: "/admin/laskut/asiakkaat",
    },
  ];

  return (
    <nav className="rf-chip-row -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {kohdat.map((kohta) => {
        const on = kohta.id === nyt;
        return (
          <Link
            key={kohta.id}
            href={kohta.href}
            aria-current={on ? "page" : undefined}
            className="rf-press shrink-0 whitespace-nowrap px-3.5 py-1.5 text-[13px] font-semibold"
            style={{
              background: on ? "var(--rf-accent)" : "var(--rf-inset)",
              color: on ? "var(--rf-on-accent)" : "var(--rf-text-2)",
              borderRadius: "var(--rf-r-pill)",
            }}
          >
            {kohta.label}
          </Link>
        );
      })}
    </nav>
  );
}
