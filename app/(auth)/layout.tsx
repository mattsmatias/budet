import Link from "next/link";
import { Logo } from "@/components/brand/logo";
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
          <span className="text-[17px] font-semibold tracking-tight">Kate</span>
        </Link>

        <LanguagePicker current={locale} />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
