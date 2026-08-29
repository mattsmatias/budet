import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";
import { SignInForm } from "./form";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.kirjaudu.metaTitle };
}

export default async function SignInPage({ searchParams }: PageProps<"/kirjaudu">) {
  const params = await searchParams;
  const raw = typeof params.seuraava === "string" ? params.seuraava : "/admin";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
  const linkError = typeof params.virhe === "string" ? params.virhe : null;

  const t = authText(await resolveLocale());

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">{t.kirjaudu.title}</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {t.kirjaudu.noAccount}{" "}
        <Link
          href="/rekisteroidy"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.kirjaudu.createAccount}
        </Link>
      </p>

      {/*
        Kutsuttu ei ole luomassa tunnusta vaan liittymässä. Ilman omaa
        riviä hän valitsisi "Luo tunnus" ja päätyisi perustamaan
        ravintolan johon ei ole tulossa.
      */}
      <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {t.kirjaudu.gotCode}{" "}
        <Link
          href="/liity"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.kirjaudu.joinRestaurant}
        </Link>
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

      {isConfigured() ? (
        <p className="mt-5 text-center text-[13px]">
          <Link
            href="/unohtui"
            className="font-medium underline underline-offset-4"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.kirjaudu.forgot}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
