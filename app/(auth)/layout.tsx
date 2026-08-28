import Link from "next/link";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { resolveLocale } from "@/lib/i18n/resolve";

/**
 * Kirjautumisen kuori.
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

  return (
    <div className="restoflow flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">Budet</span>
        </Link>

        <LanguagePicker current={locale} />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7.5" fill="#1d1d1f" />
      <path
        d="M9 19V9.6c0-.3.3-.6.6-.6h4.6a3 3 0 0 1 0 6H11"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.4 15 4.6 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
