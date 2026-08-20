/**
 * Sovelluskuori (§5).
 *
 * Navigaatio määräytyy todellisesta roolista kun käyttäjä on kirjautunut.
 * Kirjautumattomana sovellus näyttää demo-aineiston selvästi merkittynä
 * sen sijaan että se olisi tyhjä tai kaatuisi.
 */

import Link from "next/link";
import { signOut, switchOrganization } from "@/app/(auth)/actions";
import { getAppMode, getMemberships } from "@/lib/auth";
import { navigationFor, type Role } from "@/lib/navigation";
import { DemoBadge } from "@/components/ui";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const mode = await getAppMode();
  const memberships = mode.kind === "live" ? await getMemberships() : [];

  const role: Role = mode.kind === "live" ? mode.org.role : "accountant";
  const nav = navigationFor(role);

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
          {mode.kind !== "live" ? <DemoBadge>Demo</DemoBadge> : null}
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
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          {mode.kind === "live" && memberships.length > 1 ? (
            <form action={switchOrganization}>
              <label htmlFor="org-switch" className="sr-only">
                Vaihda organisaatiota
              </label>
              <select
                id="org-switch"
                name="orgId"
                defaultValue={mode.org.id}
                className="rounded-md border border-line bg-background px-2.5 py-1.5 text-sm"
              >
                {memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-2 text-sm text-navy-600 underline underline-offset-4">
                Vaihda
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted">
              {mode.kind === "live"
                ? mode.org.name
                : mode.kind === "no-org"
                  ? "Ei organisaatiota"
                  : "Demo-tila · ei kirjautunut"}
            </p>
          )}

          <div className="flex items-center gap-3">
            {mode.kind === "demo" ? (
              <Link
                href="/login"
                className="rounded-md bg-gold-400 px-3 py-1.5 text-sm font-semibold text-navy-900 hover:bg-gold-300"
              >
                Kirjaudu
              </Link>
            ) : (
              <>
                <span className="hidden text-sm text-muted sm:inline">
                  {mode.kind === "live" ? mode.user.email : mode.user.email}
                </span>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-navy-300"
                  >
                    Kirjaudu ulos
                  </button>
                </form>
              </>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
