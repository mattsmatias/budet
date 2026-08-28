import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../../landing.css";

export const metadata: Metadata = marketingMetadata("sv", "about");

/** Meistä kielellä sv. Osoite on osa käännöstä: /sv/om-oss. */
export default async function Page() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="sv"
      t={dictionary("sv")}
    />
  );
}
