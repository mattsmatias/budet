import Link from "next/link";
import { labels } from "@/lib/i18n/labels";
import { isConfigured } from "@/utils/supabase/server";
import { readInvite } from "../liity/actions";
import type { Role } from "@/lib/restoflow/types";
import { SignUpForm } from "./form";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.rekisteroidy.metaTitle };
}

export default async function SignUpPage({
  searchParams,
}: PageProps<"/rekisteroidy">) {
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const params = await searchParams;

  // Kutsulinkistä tullut ei ole perustamassa ravintolaa vaan
  // liittymässä olemassa olevaan. Tieto kulkee tunnuksen luonnin läpi,
  // jotta hän päätyy oikealle välilehdelle eikä perusta vahingossa
  // omaa ravintolaa.
  const joining = params.tila === "liity";

  /*
   * Kutsu luetaan evästeestä, ei osoitteesta.
   *
   * Käyttäjä on jo syöttänyt koodin edellisellä sivulla. Tässä näytetään
   * mihin hän on liittymässä, jotta hän tietää sen ennen kuin antaa
   * sähköpostinsa ja salasanansa.
   */
  const invite = await readInvite();
  const t = authText(await resolveLocale());

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">
        {t.rekisteroidy.title}
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {t.rekisteroidy.haveAccount}{" "}
        <Link
          href="/kirjaudu"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.rekisteroidy.signIn}
        </Link>
      </p>

      {invite ? (
        <div
          className="mt-4 px-4 py-3.5"
          style={{
            background: "var(--rf-accent-bg)",
            color: "var(--rf-accent-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p className="text-[13px]">{t.rekisteroidy.joiningLabel}</p>
          <p className="mt-0.5 text-[17px] font-semibold">
            {invite.preview.restaurantName}
          </p>
          <p className="mt-0.5 text-[13px]">
            {nimet.roles[invite.preview.role as Role]}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed">
            {t.rekisteroidy.joiningNote}
          </p>
        </div>
      ) : (
        <p
          className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {joining ? t.rekisteroidy.inviteMissing : t.rekisteroidy.inviteRequired}{" "}
          <Link
            href="/liity"
            className="font-medium underline underline-offset-4"
          >
            {joining ? t.rekisteroidy.enterCodeAgain : t.rekisteroidy.enterCode}
          </Link>
        </p>
      )}

      {/* Lomake vain kun kutsu on voimassa: ilman sitä tunnusta ei voi luoda. */}
      {!invite ? null : isConfigured() ? (
        <SignUpForm joining={joining} t={t} />
      ) : (
        <div
          className="mt-7 px-4 py-3.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {t.rekisteroidy.notConfigured}
        </div>
      )}
    </div>
  );
}
