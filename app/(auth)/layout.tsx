import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";

/**
 * Kirjautumisen kuori.
 *
 * KAKSI PUOLTA LEVEÄLLÄ RUUDULLA.
 *
 * Vasemmalla tumma brändipaneeli: Katen lupaus ja pari esimerkkikorttia
 * siitä mitä kirjautumisen jälkeen näkee. Oikealla lomake kortissa.
 * Puhelimella paneeli jää pois, jotta lomake on heti näkyvissä — se on
 * se syy miksi sivulle tultiin.
 *
 * KIELIVALITSIN ENNEN KIRJAUTUMISTA.
 *
 * Tässä sitä tarvitaan eniten: kirjautumaton ei voi vielä muuttaa
 * profiiliaan, ja jos hän ei ymmärrä lomaketta, hän ei pääse sisään
 * vaihtamaan kieltä. Valinta tallentuu evästeeseen ja siirtyy
 * profiiliin heti kun hän kirjautuu.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const locale = await resolveLocale();
  const t = authText(locale);

  return (
    <div className="restoflow rf-auth min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="rf-auth-brand hidden lg:flex" aria-hidden="true">
        <div className="rf-auth-aurora" />
        <div className="rf-auth-grid" />

        <Link href="/" className="relative inline-flex items-center gap-3">
          <Logo size={34} />
          <span className="text-[20px] font-bold tracking-[-0.02em]">Kate</span>
        </Link>

        <div className="relative">
          <p className="rf-auth-headline">
            {t.kirjaudu.brandA}
            <br />
            <span className="rf-auth-gradient">{t.kirjaudu.brandB}</span>
          </p>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-white/70">
            {t.kirjaudu.brandBody}
          </p>

          {/* Esimerkkikortit: mitä kirjautumisen jälkeen näkee. */}
          <div className="rf-auth-cards">
            <div className="rf-auth-card-float rf-auth-float-a">
              <span className="text-[12px] text-white/60">
                {t.kirjaudu.brandResult}
              </span>
              <span className="rf-tabular mt-1 block text-[28px] font-bold leading-none tracking-[-0.03em] text-[#5fd89a]">
                +3 420 €
              </span>
              <svg viewBox="0 0 120 34" className="mt-3 h-[34px] w-[120px]">
                <path
                  className="rf-auth-spark"
                  d="M2 28 L20 22 L38 25 L56 14 L74 17 L94 8 L118 4"
                  pathLength={1}
                  fill="none"
                  stroke="#5fd89a"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="rf-auth-card-float rf-auth-float-b">
              <span className="rf-auth-check">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-[13px] font-semibold">
                  {t.kirjaudu.brandReceipt}
                </span>
                <span className="rf-tabular block text-[12px] text-white/60">
                  {t.kirjaudu.brandReceiptBody}
                </span>
              </span>
            </div>
          </div>
        </div>

        <p className="relative text-[12px] text-white/40">
          {t.kirjaudu.brandNote}
        </p>
      </aside>

      <div className="rf-auth-side flex min-h-screen flex-col">
        <div className="rf-auth-side-glow" aria-hidden="true" />

        <header className="relative flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5 lg:invisible">
            <Logo />
            <span className="text-[17px] font-semibold tracking-tight">Kate</span>
          </Link>

          <LanguagePicker current={locale} />
        </header>

        <main className="relative flex flex-1 items-start justify-center px-5 pb-16 pt-4 sm:items-center sm:pb-24 sm:pt-0">
          <div className="rf-auth-panel w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
