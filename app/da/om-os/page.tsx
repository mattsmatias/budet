import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../../landing.css";

export const metadata: Metadata = marketingMetadata("da", "about");

/** Meistä kielellä da. Osoite on osa käännöstä: /da/om-os. */
export default async function Page() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="da"
      t={dictionary("da")}
    />
  );
}
