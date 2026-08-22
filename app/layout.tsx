import type { Metadata, Viewport } from "next";
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
    default: "Budet — ravintolan kulut, kuitit ja työaika",
    template: "%s · Budet",
  },
  description:
    "Ravintolan kuitit, kulut, työvuorot ja työaika yhdessä näkymässä. " +
    "Ei kassajärjestelmää, ei pankkiyhteyttä — vain se mitä kulujen ja " +
    "työajan hallintaan tarvitaan.",
  metadataBase: new URL("https://budet-app.vercel.app"),
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Budet",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fi" className={`${inter.variable} h-full`}>
      <body className="restoflow min-h-full">{children}</body>
    </html>
  );
}
