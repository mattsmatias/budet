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
      <Link
        href="/kirjaudu"
        className="rf-press -ms-1 mb-4 inline-flex items-center gap-1.5 rounded-[9px] px-1 py-1 text-[13px] font-semibold"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span className="rf-dir" aria-hidden="true">←</span>
        {t.liity.back}
      </Link>
      <h1 className="text-[26px] font-semibold tracking-tight">
        {t.liity.title}
      </h1>
      <p
        className="mt-2 text-[14px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.liity.body}
      </p>

      <CodeForm t={t} />

      <p className="mt-7 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.liity.ownRestaurant}{" "}
        {/* Tunnukset luodaan puolesta: uusi yritys ottaa yhteyttä. */}
        <Link
          href="/#yhteys"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          {t.kirjaudu.createAccount}
        </Link>
      </p>
    </div>
  );
}
