import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";
import { SignInForm } from "./form";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.kirjaudu.metaTitle };
}

/**
 * Kirjautuminen.
 *
 * Tunnukset luodaan puolesta, joten sivulla ei ole rekisteröitymistä
 * eikä yhteydenottolinkkiä: tänne tullaan kirjautumaan. Kutsukoodilla
 * liittyvälle on oma polku lomakkeen alla, koska hän ei ole luomassa
 * yritystä vaan liittymässä olemassa olevaan.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/kirjaudu">) {
  const params = await searchParams;
  const raw = typeof params.seuraava === "string" ? params.seuraava : "/admin";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
  const linkError = typeof params.virhe === "string" ? params.virhe : null;

  const t = authText(await resolveLocale());

  return (
    <div>
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">
        {t.kirjaudu.title}
      </h1>
      <p
        className="mt-2 text-[14.5px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.kirjaudu.subtitle}
      </p>

      {linkError ? (
        <p
          role="alert"
          className="mt-5 px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {linkError}
        </p>
      ) : null}

      {isConfigured() ? (
        <SignInForm next={next} t={t} />
      ) : (
        <div
          className="mt-7 px-4 py-3.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p className="font-semibold">{t.kirjaudu.notConfiguredTitle}</p>
          <p className="mt-1.5">{t.kirjaudu.notConfiguredBody}</p>
        </div>
      )}

      {/* Kutsukoodilla liittyvä: oma, rauhallinen rivi lomakkeen alla. */}
      <div className="rf-auth-divider" />
      <p className="text-center text-[13.5px]" style={{ color: "var(--rf-text-2)" }}>
        {t.kirjaudu.gotCode}{" "}
        <Link
          href="/liity"
          className="font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          {t.kirjaudu.joinRestaurant} <span className="rf-dir" aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
