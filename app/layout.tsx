import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./theme.css";

/**
 * SF Pro ei ole jaettavissa verkkofonttina, joten järjestelmäfontti tulee
 * ensin — Mac- ja iOS-käyttäjä saa aidon SF Pron. Inter on lähin vastine
 * muille alustoille.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RestoFlow — ravintolan kulut, kuitit ja työaika",
    template: "%s · RestoFlow",
  },
  description:
    "Ravintolan kuitit, kulut, työvuorot ja työaika yhdessä näkymässä. " +
    "Ei kassajärjestelmää, ei pankkiyhteyttä — vain se mitä kulujen ja " +
    "työajan hallintaan tarvitaan.",
  metadataBase: new URL("https://budet-app.vercel.app"),
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "RestoFlow",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fi" className={`${inter.variable} h-full`}>
      <body className="restoflow min-h-full">{children}</body>
    </html>
  );
}
