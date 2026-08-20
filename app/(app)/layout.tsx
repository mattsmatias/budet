/**
 * Sovelluskuori (§5).
 *
 * Navigaatio riippuu roolista. Rooli tulee myöhemmin istunnosta; nyt
 * käytetään demo-roolia, ja rajaus tehdään samalla funktiolla jota
 * oikea istuntokin käyttää — näin logiikkaa ei tarvitse kirjoittaa
 * uudelleen kun autentikointi kytketään.
 */

import Link from "next/link";
import { DemoBadge } from "@/components/ui";
import { navigationFor, type Role } from "@/lib/navigation";

// Vaihdetaan istunnon rooliin kun Supabase Auth on kytketty.
const DEMO_ROLE: Role = "accountant";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const nav = navigationFor(DEMO_ROLE);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-navy-800 bg-navy-900 text-navy-100 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-navy-50">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <rect width="24" height="24" rx="5" fill="#E9AE3B" />
              <path
                d="M6 7.5l4.6 9.5L18 6"
                stroke="#051226"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-semibold">Verra</span>
          </Link>
          <DemoBadge>Demo</DemoBadge>
        </div>

        <nav aria-label="Sovellusnavigaatio" className="px-2 pb-4">
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-navy-50"
                >
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded bg-gold-400 px-1.5 text-xs font-semibold text-navy-900 tabular">
                      {item.badge}
                    </span>
                  ) : null}
                  {item.comingSoon ? (
                    <span className="text-[10px] uppercase tracking-wide text-navy-400">
                      pian
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <p className="text-sm text-muted">
            Lehtinen Tilitoimisto · Pizzeria Linnea Oy
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">
              Haku: <kbd className="rounded border border-line px-1">Ctrl</kbd>+
              <kbd className="rounded border border-line px-1">K</kbd>
            </span>
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-gold-400"
            >
              AL
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
