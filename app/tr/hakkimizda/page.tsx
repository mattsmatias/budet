import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../../landing.css";

export const metadata: Metadata = marketingMetadata("tr", "about");

/** Meistä kielellä tr. Osoite on osa käännöstä: /tr/hakkimizda. */
export default async function Page() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="tr"
      t={dictionary("tr")}
    />
  );
}
