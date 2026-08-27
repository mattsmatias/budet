import type { Metadata } from "next";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { landingFor } from "@/lib/restoflow/permissions";
import { Landing } from "@/components/landing/landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "Budet – Ravintolan talous yhdessä paikassa",
  description:
    "Budet yhdistää ravintolan kuitit, kulut, myynnin, kassaraportit ja " +
    "kirjanpidon yhteen helppoon järjestelmään.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Budet – Ravintolan talous yhdessä paikassa",
    description:
      "Kuitit, kulut, myynti, kassaraportit ja kirjanpito ilman turhaa " +
      "käsityötä.",
    url: "/",
    type: "website",
    locale: "fi_FI",
    siteName: "Budet",
  },
};

/**
 * Sisääntulo.
 *
 * ETUSIVU ON MARKKINOINTISIVU, MUTTEI KIRJAUTUNEELLE UMPIKUJA.
 *
 * Sivu oli aiemmin pelkkä sisäänkäynti: kirjautuneelle kaksi korttia
 * (työntekijä / manager) ja kirjautumattomalle lyhyt esittely. Uusi
 * etusivu on oikea tuotesivu, mutta se ei saa katkaista kirjautuneen
 * reittiä sovellukseen.
 *
 * Siksi kohde lasketaan roolista samalla funktiolla jota
 * kirjautuminenkin käyttää: työntekijä päätyy mobiilinäkymään ja
 * esihenkilö hallintaan. Kaksi eri tapaa päätellä sama asia ajautuisi
 * ennen pitkää erilleen.
 */
export default async function Entry() {
  const user = await getUser();
  const restaurant = user ? await getActiveRestaurant() : null;

  /*
   * Kirjautunut ilman ravintolaa menee aloitukseen.
   *
   * Se on tunnus jolla ei vielä ole mitään avattavaa: /aloitus luo
   * ravintolan tai lunastaa kutsukoodin. Ilman tätä haaraa painike
   * veisi näkymään joka ohjaisi saman tien takaisin.
   */
  const appHref = user
    ? restaurant
      ? landingFor(restaurant.role)
      : "/aloitus"
    : null;

  return <Landing appHref={appHref} />;
}
