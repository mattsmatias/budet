"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";

/**
 * Käynnistysnäyttö kotinäytöltä avattaessa.
 *
 * MIKSI TÄMÄ ON OLEMASSA.
 *
 * Kotinäytön kuvakkeesta avattuna käyttöjärjestelmä näyttää oman
 * aloitusruutunsa: Katen kuvake harmaalla taustalla, liikkumatta.
 * Sen jälkeen ruutu vaihtui kerralla harmaisiin luurankolaatikoihin,
 * ja niiden välissä ei ollut mitään joka olisi sanonut että sovellus
 * on auki ja tekee työtä. Käyttöjärjestelmän ruutua ei voi animoida —
 * se syntyy manifestin kuvakkeesta — mutta sen jälkeinen hetki on
 * meidän, ja se hetki on sovelluksen ensivaikutelma.
 *
 * MILLOIN NÄKYY.
 *
 * Kerran sivulatausta kohti. Komponentti on kuoressa, joka pysyy
 * pystyssä näkymästä toiseen siirryttäessä, joten sisäisillä
 * siirtymillä tätä ei tule uudelleen — vain kun sovellus oikeasti
 * käynnistyy.
 *
 * MILLOIN VÄISTYY.
 *
 * Kun selain on saanut sivun valmiiksi. Palvelin lähettää sivun
 * virtana, joten load-tapahtuma osuu siihen hetkeen jolloin
 * yleiskatsauksen sisältö on saapunut — ei sekuntiakaan ennen. Alin
 * kesto on silti sekunti, jotta tunnus ehtii piirtyä loppuun; muuten
 * nopealla yhteydellä ruutu välähtäisi ja välähdys on levottomampi
 * kuin odotus.
 *
 * Yläraja on 20 sekuntia. Jos lataus kestää sitä pidempään, jotain on
 * vialla eikä sitä pidä peittää tunnuksella: luuranko kertoo
 * enemmän, koska se on sivun muotoinen.
 *
 * VARMISTUS ILMAN JAVASCRIPTIÄ.
 *
 * Jos hydraatio ei koskaan tapahdu, tämä efekti ei aja eikä ruutu
 * väistyisi lainkaan — sovellus näyttäisi jumittuneen tunnukseen.
 * Siksi tyylissä on oma häivytys, joka laukeaa itsestään. Se on
 * turvaverkko eikä ajastus: normaalisti komponentti on jo poistunut
 * ennen sitä.
 */

/** Alin aika ruudulla, jotta tunnuksen piirto ehtii loppuun. */
const ALIN_MS = 1000;

/** Ylin aika: tämän jälkeen luuranko kertoo enemmän. */
const YLIN_MS = 20000;

/** Häivytyksen kesto — sama luku on tyylitiedostossa. */
const HAIVYTYS_MS = 620;

export function Kaynnistys({ teksti }: { teksti: string }) {
  const [tila, setTila] = useState<"nakyy" | "poistuu" | "poissa">("nakyy");

  useEffect(() => {
    let poistettu = false;
    const ajastimet: ReturnType<typeof setTimeout>[] = [];

    const poistu = () => {
      if (poistettu) return;
      poistettu = true;
      setTila("poistuu");
      ajastimet.push(setTimeout(() => setTila("poissa"), HAIVYTYS_MS));
    };

    /*
     * performance.now() on millisekunteja sivun avaamisesta, joten
     * alin kesto lasketaan käynnistyksestä eikä tämän komponentin
     * kiinnittymisestä. Muuten hidas palvelin venyttäisi ruutua
     * sekunnilla senkin jälkeen kun sisältö on jo valmiina.
     */
    const valmis = () => {
      const jaljella = Math.max(0, ALIN_MS - performance.now());
      ajastimet.push(setTimeout(poistu, jaljella));
    };

    if (document.readyState === "complete") {
      valmis();
    } else {
      window.addEventListener("load", valmis, { once: true });
    }

    ajastimet.push(setTimeout(poistu, YLIN_MS));

    return () => {
      window.removeEventListener("load", valmis);
      ajastimet.forEach(clearTimeout);
    };
  }, []);

  if (tila === "poissa") return null;

  return (
    <div className="rf-launch rf-z-launch" data-tila={tila} role="status">
      <div className="rf-launch-merkki" aria-hidden="true">
        <span className="rf-launch-hehku" />
        <span className="rf-launch-keha" />
        <Logo size={76} />
      </div>

      <p className="rf-launch-teksti">{teksti}</p>
    </div>
  );
}
