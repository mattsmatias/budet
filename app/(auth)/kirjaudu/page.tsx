import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { SignInForm } from "./form";

export const metadata = { title: "Kirjaudu" };

export default async function SignInPage({ searchParams }: PageProps<"/kirjaudu">) {
  const params = await searchParams;
  const raw = typeof params.seuraava === "string" ? params.seuraava : "/admin";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
  const linkError = typeof params.virhe === "string" ? params.virhe : null;

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">Kirjaudu sisään</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        Ei vielä tunnusta?{" "}
        <Link
          href="/rekisteroidy"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          Luo tunnus
        </Link>
      </p>

      {/*
        Kutsuttu ei ole luomassa tunnusta vaan liittymässä. Ilman omaa
        riviä hän valitsisi "Luo tunnus" ja päätyisi perustamaan
        ravintolan johon ei ole tulossa.
      */}
      <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        Saitko kutsukoodin?{" "}
        <Link
          href="/liity"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          Liity ravintolaan
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

      {isConfigured() ? <SignInForm next={next} /> : <NotConfigured />}

      {isConfigured() ? (
        <p className="mt-5 text-center text-[13px]">
          <Link
            href="/unohtui"
            className="font-medium underline underline-offset-4"
            style={{ color: "var(--rf-text-2)" }}
          >
            Unohtuiko salasana?
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function NotConfigured() {
  return (
    <div
      className="mt-7 px-4 py-3.5 text-[13px] leading-relaxed"
      style={{
        background: "var(--rf-amber-bg)",
        color: "var(--rf-amber-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <p className="font-semibold">Kirjautumista ei ole otettu käyttöön</p>
      <p className="mt-1.5">
        Ympäristömuuttujat <code>NEXT_PUBLIC_SUPABASE_URL</code> ja{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> puuttuvat tästä
        ympäristöstä.
      </p>
    </div>
  );
}
