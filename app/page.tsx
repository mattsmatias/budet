import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "./landing.css";

export const metadata: Metadata = marketingMetadata("fi", "home");

/**
 * Etusivu suomeksi.
 *
 * SUOMI EI OLE ETULIITTEEN TAKANA.
 *
 * Muut kielet ovat /en, /sv, /da, /tr ja /et. Suomi on juuressa, koska
 * osoite on ollut olemassa ja jaossa — sen siirtäminen /fi:n taakse
 * rikkoisi jokaisen jaetun linkin eikä toisi mitään.
 */
export default async function Home() {
  return (
    <Landing
      appHref={await appHrefForVisitor()}
      locale="fi"
      t={dictionary("fi")}
    />
  );
}
