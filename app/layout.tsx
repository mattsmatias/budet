import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Verra — veropäätöksiä, jotka kone tekee ja tilintarkastaja voi toistaa",
    template: "%s | Verra",
  },
  description:
    "AI-pohjainen verotuksen compliance-moottori Euroopassa kauppaa käyville yrityksille. " +
    "Lähetä kuittisi — Verra luokittelee rivikohtaisen ALV:n, tarkistaa EU VIESin ja " +
    "tallentaa jokaisen päätöksen perustelun.",
  metadataBase: new URL("https://budet-app.vercel.app"),
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Verra",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fi" className={`${manrope.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
