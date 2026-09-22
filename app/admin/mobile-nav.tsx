"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { can, moreNavFor, type NavEntry } from "@/lib/restoflow/permissions";
import type { Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import type { AdminText } from "@/lib/i18n/admin-text";
import { localesForMenu, type AppLocale } from "@/lib/i18n/app-locales";
import { chooseLocale } from "@/components/i18n/actions";
import { signOut } from "@/app/(auth)/actions";
import { InstallCard } from "./lisaa/install";

/**
 * Puhelimen navigaatio: välilehtipalkki ja Lisää-paneeli.
 *
 * SOVELLUKSEN TAPAAN.
 *
 * Lisää ei enää vaihda sivua vaan nostaa paneelin alhaalta, kuten
 * puhelinsovelluksissa: kaikki muut näkymät ruudukkona, tili, kieli ja
 * uloskirjautuminen samassa paikassa. Käyttäjä ei menetä sivua jolla
 * hän oli, ja paneelin saa pois pyyhkäisemällä alas. /admin/lisaa jää
 * olemaan suoraa linkkiä varten.
 *
 * Valittu välilehti saa pillerin ikonin taakse, ja välilehti näyttää
 * odottavien asioiden määrän. Valitun välilehden uusi napautus vierittää
 * sivun alkuun — sama ele kuin jokaisessa puhelimen sovelluksessa.
 */
export function MobileNav({
  items,
  role,
  counts,
  t,
  canAddReceipt,
  userName,
  roleLabel,
  restaurantName,
  locale,
}: {
  items: NavEntry[];
  role: Role;
  counts: Record<string, number>;
  t: AdminText;
  canAddReceipt: boolean;
  userName: string;
  roleLabel: string;
  restaurantName: string;
  locale: AppLocale;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeSheet = useCallback(() => setOpen(false), []);
  const more = moreNavFor(role);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const moreActive =
    open ||
    pathname.startsWith("/admin/lisaa") ||
    more.some((item) => isActive(item.href));
  const moreCount = more.reduce((sum, item) => sum + (counts[item.href] ?? 0), 0);

  /* Kamerapainike ei näy kuitin lisäyksessä itsessään. */
  const showCapture =
    canAddReceipt && !pathname.startsWith("/admin/kuitit/uusi");

  return (
    <>
      {/*
        Kuitin lisäys yhdellä napautuksella.

        Puhelimella kuitti kuvataan heti kun se on kädessä. Painike
        alapalkin yläpuolella on aina saman peukalon ulottuvilla, mistä
        sivusta tahansa, ja avaa kameran suoraan.
      */}
      {showCapture && !open ? (
        <Link
          href="/admin/kuitit/uusi"
          aria-label={t.kuori.addReceipt}
          className="rf-press rf-fab md:hidden"
        >
          <RfIcon name="camera" size={24} />
        </Link>
      ) : null}

      <nav
        aria-label={t.kuori2.adminNav}
        className="rf-mobile-bar rf-no-print fixed bottom-0 start-0 end-0 z-30 border-t md:hidden"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <ul className="mx-auto flex max-w-lg px-1.5">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    // Valittu välilehti uudelleen: takaisin sivun alkuun.
                    if (pathname === item.href) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="rf-tab"
                  data-active={active || undefined}
                >
                  <span className="rf-tab-pill">
                    <RfIcon
                      name={item.icon}
                      size={21}
                      strokeWidth={active ? 2 : 1.7}
                    />
                    <Badge count={counts[item.href] ?? 0} />
                  </span>
                  <span className="rf-tab-label">{t.nav[item.key]}</span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="rf-tab w-full"
              data-active={moreActive || undefined}
            >
              <span className="rf-tab-pill">
                <RfIcon name="more" size={21} strokeWidth={moreActive ? 2 : 1.7} />
                <Badge count={moreCount} />
              </span>
              <span className="rf-tab-label">{t.nav.more}</span>
            </button>
          </li>
        </ul>
      </nav>

      {open ? (
        <MoreSheet
          t={t}
          items={more}
          counts={counts}
          isActive={isActive}
          userName={userName}
          roleLabel={roleLabel}
          restaurantName={restaurantName}
          locale={locale}
          canOpenSettings={can(role, "settings.view")}
          onClose={closeSheet}
        />
      ) : null}
    </>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rf-tab-badge rf-tabular" aria-hidden="true">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------------------------------------------------------------------------

/**
 * Lisää-paneeli.
 *
 * Paneeli on modaali: tausta himmenee, sivu ei vieritä alla, Esc ja
 * taustan napautus sulkevat. Alas vetäminen kahvasta tai otsikosta
 * sulkee kun vetoa on tarpeeksi — pieni nykäisy palauttaa paikalleen.
 */
function MoreSheet({
  t,
  items,
  counts,
  isActive,
  userName,
  roleLabel,
  restaurantName,
  locale,
  canOpenSettings,
  onClose,
}: {
  t: AdminText;
  items: NavEntry[];
  counts: Record<string, number>;
  isActive: (href: string) => boolean;
  userName: string;
  roleLabel: string;
  restaurantName: string;
  locale: AppLocale;
  canOpenSettings: boolean;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; dy: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const close = useCallback(() => {
    setClosing(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(onClose, reduce ? 0 : 200);
  }, [onClose]);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    sheet.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  function onPointerDown(e: ReactPointerEvent) {
    // Sulkupainike otsikossa on napautus eikä veto.
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { start: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current || !sheet.current) return;
    const dy = Math.max(0, e.clientY - drag.current.start);
    drag.current.dy = dy;
    sheet.current.style.transition = "none";
    sheet.current.style.transform = `translateY(${dy}px)`;
  }

  function onPointerUp() {
    if (!drag.current || !sheet.current) return;
    const { dy } = drag.current;
    drag.current = null;
    sheet.current.style.transition = "";
    sheet.current.style.transform = "";
    if (dy > 90) close();
  }

  function pickLocale(code: AppLocale) {
    if (code === locale) return;
    startTransition(async () => {
      await chooseLocale(code);
      router.refresh();
    });
  }

  return (
    <div className="rf-sheet-root md:hidden" data-closing={closing || undefined}>
      <button
        type="button"
        className="rf-sheet-backdrop"
        aria-label={t.kuori.closeMenu}
        onClick={close}
        tabIndex={-1}
      />

      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-sheet-title"
        tabIndex={-1}
        className="rf-sheet"
      >
        {/* Kahva ja otsikko: tästä vedetään alas. */}
        <div
          className="rf-sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="rf-sheet-handle" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1">
            <h2
              id="rf-sheet-title"
              className="text-[19px] font-bold tracking-[-0.02em]"
            >
              {t.nav.more}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t.kuori.closeMenu}
              className="rf-press grid h-9 w-9 place-items-center rounded-full"
              style={{ background: "var(--rf-inset)", color: "var(--rf-text-2)" }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="rf-sheet-body">
          {/* Tili: kuka on kirjautunut ja mihin yritykseen. */}
          <div className="rf-sheet-card flex items-center gap-3">
            <span className="rf-sheet-avatar" aria-hidden="true">
              {initialsOf(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">
                {userName}
              </span>
              <span
                className="block truncate text-[12.5px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {roleLabel} · {restaurantName}
              </span>
            </span>
          </div>

          {items.length > 0 ? (
            <section>
              <p className="rf-sheet-label">{t.kuori.allViews}</p>
              <ul className="grid grid-cols-3 gap-2">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const count = counts[item.href] ?? 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className="rf-press rf-sheet-tile"
                        data-active={active || undefined}
                      >
                        <span className="rf-sheet-tile-icon">
                          <RfIcon name={item.icon} size={21} strokeWidth={1.8} />
                          <Badge count={count} />
                        </span>
                        <span className="rf-sheet-tile-label">
                          {t.nav[item.key]}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="rf-sheet-label">{t.kuori.account}</p>
            <div className="rf-sheet-card p-0">
              {/* Huomiot ovat ylapalkin kellossa: sama asia kahdessa
                  paikassa tarkoittaa kahta paikkaa joita pitaa etsia. */}
              {canOpenSettings ? (
                <Link
                  href="/admin/asetukset"
                  onClick={close}
                  className="rf-press rf-sheet-row"
                >
                  <RfIcon name="settings" size={19} />
                  <span className="flex-1">{t.kuori.settings}</span>
                  <RfIcon name="chevron" size={15} />
                </Link>
              ) : null}

              <div className="rf-sheet-row" style={{ alignItems: "flex-start" }}>
                <span className="pt-[3px]">
                  <Globe />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{t.kuori.language}</span>
                  <span
                    className="rf-sheet-langs"
                    role="radiogroup"
                    aria-label={t.kuori.language}
                    aria-busy={pending || undefined}
                  >
                    {localesForMenu().map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        role="radio"
                        aria-checked={l.code === locale}
                        onClick={() => pickLocale(l.code)}
                        disabled={pending}
                        className="rf-press rf-sheet-lang"
                        lang={l.code}
                      >
                        {l.name}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
            </div>
          </section>

          <InstallCard t={t} />

          <form action={signOut}>
            <button
              type="submit"
              className="rf-press rf-sheet-card flex w-full items-center justify-center gap-2 text-[14.5px] font-semibold"
              style={{ color: "var(--rf-red-text)" }}
            >
              <RfIcon name="logout" size={17} />
              {t.loput.signOut}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function Globe() {
  return (
    <svg width="19" height="19" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8c1.7 1.7 2.6 3.9 2.6 6.2S9.7 12.5 8 14.2C6.3 12.5 5.4 10.3 5.4 8S6.3 3.5 8 1.8ZM2 8h12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
