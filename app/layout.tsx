import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./theme.css";

/**
 * Plus Jakarta Sans.
 *
 * Geometrinen ja korkea x-korkeus: numerot erottuvat toisistaan myös
 * pienessä koossa, mikä on tämän sovelluksen tärkein vaatimus
 * kirjasimelle. Järjestelmäfontti oli neutraali muttei mitään — ja kun
 * koko näkymä on lukuja, kirjasin on osa sitä miltä ne näyttävät.
 *
 * Lihavuudet 400–800, koska otsikot ovat selvästi lihavia eikä
 * puolilihava riitä niihin.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-app",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="fi" className={`${jakarta.variable} h-full`}>
      <body className="restoflow min-h-full" suppressHydrationWarning>
        {/*
          Teema ennen ensimmäistä piirtoa.

          Ilman tätä sivu välähtäisi vaaleana ennen kuin React ehtii
          lukea valinnan. Skripti on tarkoituksella pieni ja
          synkroninen: se ajetaan ennen kuin mitään on maalattu.
        */}
        {children}
      </body>
    </html>
  );
}
