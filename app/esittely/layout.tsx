import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { RfIcon } from "@/components/restoflow/icons";
import { requireKateStaff } from "@/lib/restoflow/session";
import { personInitials } from "@/lib/restoflow/initials";

export const metadata = {
  title: { default: "Esittely", template: "%s · Kate" },
};

/**
 * Katen työntekijän kuori.
 *
 * YKSI NÄKYMÄ, EI SIVUPALKKIA.
 *
 * Myyntitapaamiseen tuleva työntekijä tarvitsee tästä tunnuksesta
 * yhden asian: esittelyn. Sivupalkki jossa on yksi rivi näyttäisi
 * keskeneräiseltä sovellukselta ja veisi tilaa dialta, joka on koko
 * sivun sisältö. Kun näkymiä on joskus kaksi, palkki lisätään silloin.
 *
 * PÄÄSY TARKISTETAAN TÄSSÄ JA KANNASSA.
 *
 * Tämä ohjaa pois sen joka ei kuulu tänne. Varsinainen este on
 * kate_staff-taulussa: siihen ei ole yhtään kirjoituspolitiikkaa,
 * joten kukaan ei voi antaa itselleen tätä roolia. Esittely ei
 * myöskään sisällä yhdenkään asiakkaan tietoja — luvut siinä ovat
 * esimerkkejä ja sanotaan esimerkeiksi.
 */
export default async function EsittelyLayout({
  children,
}: LayoutProps<"/esittely">) {
  const { user } = await requireKateStaff();

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--rf-bg)" }}>
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: "var(--rf-card)",
          borderColor: "var(--rf-line)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-3 md:px-7">
          <Link href="/esittely" className="inline-flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[16px] font-bold tracking-[-0.02em]">
              Kate
            </span>
            <span
              className="ms-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text-3)",
                borderRadius: 980,
              }}
            >
              Tiimi
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Nimi kertoo kenen tunnuksilla ollaan — sama kuin hallinnassa. */}
            <span
              className="hidden items-center gap-2 sm:inline-flex"
              style={{ color: "var(--rf-text-2)" }}
            >
              <span
                className="inline-flex items-center justify-center text-[11px] font-bold"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 980,
                  background: "var(--rf-accent-soft)",
                  color: "var(--rf-accent)",
                }}
                aria-hidden="true"
              >
                {personInitials(user.fullName ?? user.email ?? "?")}
              </span>
              <span className="text-[13px] font-semibold">
                {user.fullName ?? user.email}
              </span>
            </span>

            <form action={signOut}>
              <button
                type="submit"
                className="rf-press inline-flex items-center gap-1.5 px-3 text-[12.5px] font-semibold"
                style={{
                  height: 34,
                  background: "var(--rf-inset)",
                  border: "1px solid var(--rf-line-strong)",
                  borderRadius: "var(--rf-r-control)",
                  color: "var(--rf-text-2)",
                }}
              >
                <RfIcon name="logout" size={15} />
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 md:px-7 md:py-7">
        {children}
      </main>
    </div>
  );
}
