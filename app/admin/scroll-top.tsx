"use client";

import { useEffect } from "react";

/**
 * Sovellus avautuu ylhäältä.
 *
 * SELAIN PALAUTTAA VIERITYKSEN, VAIKKA KÄYTTÄJÄ VASTA TULI.
 *
 * Selaimen oletus on `history.scrollRestoration = "auto"`: kun sama
 * osoite avataan uudestaan samaan historiamerkintään — esimerkiksi
 * istunnon vanhennuttua kirjautumisen jälkeen — se palauttaa
 * edellisen vierityskohdan. Yleiskatsaus avautui siksi muutaman sadan
 * pikselin päästä ylälaidasta, ja sivun ylin rivi jäi näkemättä.
 *
 * PAITSI TAKAISIN-NAPILLA.
 *
 * Takaisin palaava haluaa juuri sen kohdan josta lähti: pitkä
 * kuittilista olisi muuten selattava alusta joka kerta. Siksi
 * back_forward jätetään rauhaan ja vain uusi avaus viedään ylös.
 *
 * Tämä ajetaan kerran asiakirjaa kohti. Sivulta toiselle siirtyminen
 * sovelluksen sisällä ei luo uutta asiakirjaa, joten reitin vaihto ei
 * kulje tästä — sen hoitaa reititin itse.
 */
export function ScrollTop() {
  useEffect(() => {
    const [nav] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];

    if (nav?.type === "back_forward") return;

    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return null;
}
