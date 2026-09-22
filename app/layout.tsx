import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Plus_Jakarta_Sans,
} from "next/font/google";
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

/**
 * IBM Plex Sans Arabic arabiankielisille merkeille.
 *
 * Plus Jakarta Sansissa ei ole arabialaisia kirjaimia, ja selaimen
 * oma varakirjasin vaihtelee laitteittain. Tämä on fonttipinossa heti
 * pääkirjasimen jälkeen, joten latinalaiset merkit tulevat edelleen
 * Jakartasta. Ei esilatausta: tiedosto haetaan vain sivulle jolla on
 * arabiaa, muut kielet eivät maksa siitä mitään.
 */
const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Kate — yrityksen myynti, kulut ja tulos",
    template: "%s · Kate",
  },
  description:
    "Näe paljonko ravintola tuottaa ja mihin raha menee: myynti, kuitit, " +
    "kulut ja kirjanpito yhdessä näkymässä.",
  metadataBase: new URL("https://budet-app.vercel.app"),
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Kate",
  },
  robots: { index: true, follow: true },
  /*
   * Kotinäytön sovellus iPhonella: aukeaa koko näytölle, yläpalkin väri
   * tulee sivulta ja nimi on lyhyt. Android lukee saman manifestista.
   */
  appleWebApp: {
    capable: true,
    title: "Kate",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Vanhemmat iPhonet lukevat tämän; uudemmat manifestin display-kentän.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* Selaimen ja tilarivin väri seuraa teemaa. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
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
    <html
      lang={tag}
      dir={dir}
      className={`${jakarta.variable} ${mono.variable} ${arabic.variable} h-full`}
    >
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
