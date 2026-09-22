import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../../landing.css";

export const metadata: Metadata = marketingMetadata("ar", "about");

/** Meistä kielellä ar. Osoite on osa käännöstä: /ar/man-nahnu (arabian "keitä olemme" latinalaisin kirjaimin). */
export default async function Page() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="ar"
      t={dictionary("ar")}
    />
  );
}
