import Link from "next/link";
import { getUser } from "@/lib/restoflow/session";
import { NewPasswordForm } from "./form";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText, fill } from "@/lib/i18n/auth-text";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.uusiSalasana.metaTitle };
}

/**
 * Uuden salasanan asetus.
 *
 * Sivulle päädytään palautuslinkistä, joka on jo vaihdettu istunnoksi
 * /auth/callback-reitillä. Ilman istuntoa lomaketta ei näytetä lainkaan:
 * tyhjä lomake joka ei voi tallentaa on harhaanjohtava.
 */
export default async function NewPasswordPage() {
  const user = await getUser();
  const t = authText(await resolveLocale());

  if (!user) {
    return (
      <div className="rf-enter">
        <h1 className="text-[26px] font-semibold tracking-tight">
          {t.uusiSalasana.invalidTitle}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          {t.uusiSalasana.invalidBody}
        </p>

        <Link
          href="/unohtui"
          className="rf-press mt-6 flex w-full items-center justify-center py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {t.uusiSalasana.requestNew}
        </Link>
      </div>
    );
  }

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">
        {t.uusiSalasana.title}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        {fill(t.uusiSalasana.forAccount, { email: user.email ?? "" })}
      </p>

      <NewPasswordForm t={t} />
    </div>
  );
}
