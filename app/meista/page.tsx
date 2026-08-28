import type { Metadata } from "next";
import { About } from "@/components/landing/about";
import { dictionary } from "@/lib/i18n/dictionary";
import { appHrefForVisitor, marketingMetadata } from "@/lib/i18n/page-setup";
import "../landing.css";

export const metadata: Metadata = marketingMetadata("fi", "about");

/** Meistä suomeksi. */
export default async function MeistaPage() {
  return (
    <About
      appHref={await appHrefForVisitor()}
      locale="fi"
      t={dictionary("fi")}
    />
  );
}
