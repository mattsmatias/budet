"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Puhelimen yläpalkin otsikko.
 *
 * SIVUN NIMI, EI AINA YRITYKSEN NIMI.
 *
 * Yläpalkissa luki joka sivulla ravintolan nimi, eikä sivuilla ole
 * puhelimessa omaa otsikkoa: Kuluilla ja Budjeteilla ei nähnyt missä
 * oli muuten kuin alapalkin korostuksesta. Nyt otsikkona on sivun nimi
 * ja yritys pienenä alla, kuten puhelinsovelluksissa. Yleiskatsaus on
 * poikkeus: se on yrityksen etusivu, joten siinä nimi on yrityksen.
 *
 * Nimi luetaan sivun omasta <title>-tunnisteesta. Jokainen sivu antaa
 * sen jo käyttäjän kielellä, myös yksittäisen kuitin tai toimittajan
 * sivu, joten toista nimiluetteloa ei tarvita eikä se voi ajautua
 * erilleen sivujen otsikoista.
 *
 * Alasivulla (kuitti, myyntipäivä, toimittaja) vasemmalla on paluunuoli
 * osion etusivulle.
 */

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.head, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => observer.disconnect();
}

const pageTitle = () => document.title.replace(/\s·\sKate$/, "");
const noTitle = () => "";

export function MobileTitle({
  restaurantName,
  userName,
  backLabel,
}: {
  restaurantName: string;
  userName: string;
  backLabel: string;
}) {
  const pathname = usePathname();
  const title = useSyncExternalStore(subscribe, pageTitle, noTitle);

  if (pathname === "/admin") {
    return (
      <Link href="/admin" className="min-w-0">
        <p className="truncate text-[16px] font-bold tracking-[-0.015em]">
          {restaurantName}
        </p>
        <p className="truncate text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {userName}
        </p>
      </Link>
    );
  }

  const parts = pathname.split("/").filter(Boolean);
  const parent = parts.length > 2 ? `/${parts.slice(0, 2).join("/")}` : null;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {parent ? (
        <Link
          href={parent}
          aria-label={backLabel}
          className="rf-press -ms-2 grid h-10 w-9 shrink-0 place-items-center"
          style={{ color: "var(--rf-text-2)" }}
        >
          <span className="rf-dir inline-flex">
            <RfIcon name="back" size={22} strokeWidth={2} />
          </span>
        </Link>
      ) : null}
      <div className="min-w-0">
        <p className="rf-mobile-title truncate text-[17px] font-bold tracking-[-0.02em]">
          {title || restaurantName}
        </p>
        <p className="truncate text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
          {restaurantName}
        </p>
      </div>
    </div>
  );
}
