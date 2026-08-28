import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../landing.css";

export const metadata: Metadata = marketingMetadata("en", "home");

/*
 * Kieliversiot ovat omia staattisia reittejään.
 *
 * Juuritason /[kieli] olisi ollut vähemmän tiedostoja, mutta se ottaa
 * vastaan minkä tahansa tuntemattoman polun: /admin ja /app alkoivat
 * osua siihen kaavaan, ja Nextin oma sääntö huomautti siitä kahdessa
 * koskemattomassa tiedostossa. Reitin nimeäminen ääneen on halvempaa
 * kuin catch-all jota pitää vahtia.
 *
 * Tiedostot on luotu lib/i18n/locales.ts:n listasta, joten kieli ja
 * osoite eivät voi olla eri mieltä.
 */
export default async function Page() {
  return (
    <Landing
      appHref={await appHrefForVisitor()}
      locale="en"
      t={dictionary("en")}
    />
  );
}
