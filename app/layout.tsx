import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { localeInfo } from "@/lib/i18n/app-locales";
import { resolveLocale } from "@/lib/i18n/resolve";
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

/**
 * IBM Plex Mono luvuille.
 *
 * Tabular-nums riitti pitämään sarakkeet suorassa, mutta luku näytti
 * silti leipätekstiltä: sama kirjasin, sama muoto, vain leveys
 * lukittuna. Suunnitelmassa jokainen luku on omalla kirjasimellaan, ja
 * ero on juuri se joka tekee avainluvusta luvun eikä otsikon.
 *
 * Vain kolme lihavuutta: 400 taulukoihin ja akseleihin, 600
 * korostettuihin sarakkeisiin, 700 avainlukuihin. Jokainen paino on
 * oma latauksensa, ja kirjasin jota käytetään vain numeroihin ei
 * ansaitse viittä.
 */
const mono = IBM_Plex_Mono({
  variable: "--font-num",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /*
   * Kieli ja kirjoitussuunta juuressa.
   *
   * <html> on ainoa paikka jossa dir voi olla: se periytyy koko
   * puuhun, ja RTL tarkoittaa muutakin kuin tekstin tasausta -
   * sivupalkki, nuolet ja marginaalit kaantyvat sen mukana.
   *
   * Ratkaisu tehdaan samalla ketjulla kuin muualla: kayttajan valinta,
   * ravintolan oletus, selaimen toive, suomi.
   */
  const locale = await resolveLocale();
  const { tag, dir } = localeInfo(locale);

  return (
    <html lang={tag} dir={dir} className={`${jakarta.variable} ${mono.variable} h-full`}>
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
