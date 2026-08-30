"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AdminText } from "@/lib/i18n/admin-text";
import { useEffect, useRef, useState, useTransition } from "react";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Kuittien haku.
 *
 * Oli tavallinen lomake, joka haki vasta Enterillä. Kirjain kerrallaan
 * kirjoittava ei nähnyt mitään ennen kuin arvasi painaa Enteriä, ja
 * hakukenttä joka ei hae kirjoittaessa näyttää rikkinäiseltä.
 *
 * Nyt osoiterivi päivittyy kirjoittaessa. Suodatus tehdään edelleen
 * palvelimella samalla funktiolla kuin ennen — siirtämällä se selaimeen
 * olisi syntynyt toinen totuus siitä mikä osuu hakuun.
 *
 * Kaksi asiaa on hoidettava:
 *
 *   Viive. Jokainen näppäily ei saa lähettää pyyntöä. 250 ms on
 *   tarpeeksi lyhyt tuntuakseen välittömältä ja tarpeeksi pitkä
 *   estääkseen pyyntöjonon.
 *
 *   Historia. router.replace eikä push, jottei jokainen kirjain jätä
 *   omaa merkintäänsä selaimen historiaan — muuten paluunuoli kävisi
 *   hakusanan läpi kirjain kerrallaan.
 */
export function ReceiptSearch({
  t,
  initial,
}: {
  t: AdminText;
  initial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  // Ensimmäinen ajo ei saa navigoida: se pyyhkisi muut hakuparametrit
  // heti sivun avautuessa.
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());

      if (value.trim() === "") next.delete("haku");
      else next.set("haku", value);

      const query = next.toString();

      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, pathname, params, router]);

  return (
    <div className="relative w-full md:w-auto">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--rf-text-3)" }}
      >
        <RfIcon name="search" size={17} />
      </span>

      <label htmlFor="admin-search" className="sr-only">
        {t.viimeiset.searchReceipts}
      </label>

      <input
        id="admin-search"
        type="search"
        name="haku"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.viimeiset.searchReceiptsHint}
        className="w-full py-2.5 pl-10 pr-3 text-[16px] outline-none md:w-72 md:py-2 md:text-[14px]"
        style={{
          background: "var(--rf-card)",
          borderRadius: "var(--rf-r-control)",
          boxShadow: "var(--rf-shadow-sm)",
          opacity: pending ? 0.7 : 1,
          transition: "opacity 160ms ease",
        }}
      />
    </div>
  );
}
