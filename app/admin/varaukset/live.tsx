"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Salinäkymä pysyy ajan tasalla itsestään.
 *
 * Pöytäkartta lupaa "tilanne juuri nyt", mutta palvelimella piirretty
 * sivu jäätyy latauksen hetkeen: kello käy, seurueet saapuvat ja
 * lähtevät, mutta ruudulla lukee sama. Vuoron aikana sivu on auki
 * tunteja, ja juuri silloin se on eniten väärässä.
 *
 * Päivitys hakee myös muiden tekemät muutokset: kun toinen
 * vuoropäällikkö merkitsee seurueen saapuneeksi puhelimellaan, se
 * näkyy tässä ilman että kukaan lataa sivua.
 *
 * ---------------------------------------------------------------------
 * MIKSI ROUTER.REFRESH EIKÄ KELLO SELAIMESSA
 * ---------------------------------------------------------------------
 *
 * Selaimessa tikittävä kello päivittäisi pöytien tilat mutta ei
 * varauksia — uusi verkkovaraus ei ilmestyisi listaan. refresh piirtää
 * palvelinkomponentit uudelleen ja tuo molemmat, ja se säilyttää
 * klientkomponenttien tilan: avoin dialogi ei sulkeudu kesken
 * kirjoittamisen.
 */
export function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    /*
     * Piilossa oleva välilehti ei päivity.
     *
     * Ravintoloitsijan puhelin on taskussa suurimman osan illasta.
     * Minuutin välein tehty turha kysely kolmen tunnin ajan on 180
     * kyselyä joita kukaan ei katso — ja akku on salissa se resurssi
     * joka loppuu ensin.
     */
    function tikki() {
      if (document.visibilityState === "visible") router.refresh();
    }

    const ajastin = setInterval(tikki, seconds * 1000);

    /* Takaisin välilehteen: päivitys heti, ei vasta minuutin päästä. */
    document.addEventListener("visibilitychange", tikki);

    return () => {
      clearInterval(ajastin);
      document.removeEventListener("visibilitychange", tikki);
    };
  }, [router, seconds]);

  return null;
}

/**
 * Päivän suora valinta.
 *
 * Natiivi päivämääräkenttä eikä oma kalenteri: selain osaa sen omalla
 * kielellään, se toimii kosketuksella ja näppäimistöllä, ja
 * puhelimessa se avaa järjestelmän oman valitsimen.
 *
 * Nuolilla ensi lauantaihin on kuusi painallusta, ja se on tavallisin
 * syy vaihtaa päivää: puhelimessa kysytään ajasta joka on viikon
 * päässä.
 */
export function DayPicker({ date, label }: { date: string; label: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      defaultValue={date}
      aria-label={label}
      className="rf-press h-[42px] cursor-pointer bg-transparent px-2 text-[13px] font-semibold outline-none"
      style={{ color: "var(--rf-text-2)" }}
      /*
       * Siirtymä heti valinnasta.
       *
       * Erillinen Siirry-painike olisi toinen painallus asialle jonka
       * käyttäjä on jo päättänyt valitessaan päivän.
       */
      onChange={(event) => {
        const arvo = event.target.value;
        if (arvo) router.push(`/admin/varaukset?pvm=${arvo}`);
      }}
    />
  );
}
