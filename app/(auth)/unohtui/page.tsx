import Link from "next/link";
import { ResetRequestForm } from "./form";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.unohtui.metaTitle };
}

export default async function ForgotPasswordPage() {
  const t = authText(await resolveLocale());

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">
        {t.unohtui.title}
      </h1>
      <p
        className="mt-2 text-[14px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.unohtui.body}
      </p>

      <ResetRequestForm t={t} />

      <p
        className="mt-6 text-center text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.unohtui.remembered}{" "}
        <Link
          href="/kirjaudu"
          className="font-medium underline underline-offset-4"
        >
          {t.unohtui.signIn}
        </Link>
      </p>
    </div>
  );
}
