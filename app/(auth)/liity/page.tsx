import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";
import { CodeForm } from "./form";

export async function generateMetadata() {
  const t = authText(await resolveLocale());
  return { title: t.liity.metaTitle };
}

/**
 * Kutsukoodi ensin.
 *
 * Aiemmin kutsuttu työntekijä joutui luomaan tunnuksen ennen kuin
 * pääsi syöttämään koodin. Hän antoi siis sähköpostinsa ja
 * salasanansa tietämättä mihin oli liittymässä, ja väärällä koodilla
 * jäljelle jäi tunnus joka ei kuulu mihinkään.
 *
 * Nyt koodi tarkistetaan ensin, ja seuraava näkymä kertoo ravintolan
 * nimen ennen kuin mitään omaa tarvitsee luovuttaa.
 */
export default async function JoinPage() {
  const t = authText(await resolveLocale());

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">{t.liity.title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        {t.liity.body}
      </p>

      <CodeForm t={t} />

      <p className="mt-7 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.liity.haveAccount}{" "}
        <Link
          href="/kirjaudu"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.liity.signIn}
        </Link>
      </p>

      <p className="mt-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.liity.ownRestaurant}{" "}
        <Link
          href="/rekisteroidy"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.rekisteroidy.title}
        </Link>
      </p>
    </div>
  );
}
