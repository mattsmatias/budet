import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../../landing.css";

export const metadata: Metadata = marketingMetadata("en", "about");

/** Meistä kielellä en. Osoite on osa käännöstä: /en/about. */
export default async function Page() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="en"
      t={dictionary("en")}
    />
  );
}
