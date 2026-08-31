"use client";

/**
 * Haku joka etsii kirjoittaessa.
 *
 * Aiemmin tämä oli tavallinen GET-lomake: kirjoita ja paina Enter.
 * Se toimi, mutta kaappia selataan etsimällä — ja etsiminen on
 * arvailua, jossa jokainen välivastaus kertoo ollaanko oikeilla
 * jäljillä.
 *
 * ---------------------------------------------------------------------
 * OSOITE ON YHÄ TOTUUS
 * ---------------------------------------------------------------------
 *
 * Kenttä ei suodata listaa selaimessa vaan kirjoittaa hakusanan
 * osoitteeseen, ja palvelin piirtää tulokset. Siksi hakutulokseen voi
 * yhä linkittää, sivun päivitys ei tyhjennä hakua, eikä koko kaapin
 * tiedostoluetteloa tarvitse ladata selaimeen varmuuden vuoksi.
 *
 * router.replace eikä push: jokainen näppäily ei ole oma askeleensa
 * selaimen historiassa. Paluunappi vie sinne mistä haku alkoi, ei
 * kirjain kerrallaan taaksepäin.
 *
 * ---------------------------------------------------------------------
 * VIIVE ON PIENIN JOKA RIITTÄÄ
 * ---------------------------------------------------------------------
 *
 * Kaksisataa millisekuntia. Nopea kirjoittaja ehtii kirjoittaa sanan
 * loppuun yhdellä kyselyllä, ja hidas näkee tuloksen ennen kuin ehtii
 * ihmetellä. Ilman viivettä "myyntiraportti" olisi viisitoista
 * kyselyä joista neljätoista on jo vanhentunut ennen vastausta.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminText } from "@/lib/i18n/admin-text";
import { filesHref } from "@/lib/restoflow/files";
import { RfIcon } from "@/components/restoflow/icons";

const VIIVE_MS = 200;

export function SearchBox({
  t,
  term,
  folderId,
}: {
  t: AdminText;
  /** Osoitteessa oleva hakusana. */
  term: string;
  /** Kansio johon tyhjennys palaa. */
  folderId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(term);

  /*
   * Osoite voi muuttua muutenkin kuin kirjoittamalla.
   *
   * Paluunappi ja tyhjennys vaihtavat hakusanan, eikä kentässä saa
   * silloin lukea vanhaa. Vertailu edelliseen propsiin on Reactin oma
   * kuvio — efekti tekisi saman yhden ylimääräisen piirron jälkeen.
   */
  const [edellinen, setEdellinen] = useState(term);

  if (term !== edellinen) {
    setEdellinen(term);
    setValue(term);
  }

  /*
   * Vain kirjoittaminen ajastaa siirtymän.
   *
   * Ilman tätä lippua osoitteesta tuleva muutos käynnistäisi uuden
   * siirtymän samaan osoitteeseen, ja kaksi peräkkäistä hakua jäisi
   * pomppimaan toisiaan vasten.
   */
  const kirjoitettu = useRef(false);

  useEffect(() => {
    if (!kirjoitettu.current) return;
    if (value === term) return;

    const ajastin = setTimeout(() => {
      router.replace(
        filesHref(value.trim() === "" ? { folderId } : { term: value.trim() }),
        { scroll: false },
      );
    }, VIIVE_MS);

    return () => clearTimeout(ajastin);
  }, [value, term, folderId, router]);

  return (
    <form
      /*
       * Lomake jää, vaikka Enteriä ei enää tarvita.
       *
       * Ilman JavaScriptiä kenttä toimii yhä vanhalla tavalla, ja
       * puhelimen näppäimistössä "hae" tekee sen mitä se lupaa.
       */
      method="get"
      action="/admin/tiedostot"
      onSubmit={(event) => {
        event.preventDefault();
        router.replace(
          filesHref(value.trim() === "" ? { folderId } : { term: value.trim() }),
          { scroll: false },
        );
      }}
      className="flex items-center gap-2"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-pill)",
        padding: "0 12px",
      }}
    >
      <span style={{ color: "var(--rf-text-3)" }}>
        <RfIcon name="search" size={16} />
      </span>

      <input
        type="search"
        name="haku"
        value={value}
        onChange={(event) => {
          kirjoitettu.current = true;
          setValue(event.target.value);
        }}
        placeholder={t.tiedosto.search}
        aria-label={t.tiedosto.search}
        autoComplete="off"
        /*
         * Selaimen oma tyhjennysrasti pois.
         *
         * type="search" antaa Chromessa oman rastinsa, ja oman
         * painikkeen vieressa niita oli kaksi. Tyyppi sailyy, koska
         * puhelimen nappaimisto antaa silla "hae"-nappaimen.
         */
        className="rf-no-clear h-[42px] w-full bg-transparent text-[14px] outline-none"
      />

      {/*
        Tyhjennys näkyy vain kun on jotain tyhjennettävää.

        Selaimen oma rasti type="search"-kentässä puuttuu osasta
        selaimia ja katoaa kokonaan puhelimessa, joten paluu listaan
        jäisi paluunapin varaan.
      */}
      {value !== "" ? (
        <button
          type="button"
          aria-label={t.tiedosto.clearSearch}
          onClick={() => {
            kirjoitettu.current = true;
            setValue("");
          }}
          className="rf-press shrink-0 p-1"
          style={{ color: "var(--rf-text-3)" }}
        >
          <RfIcon name="close" size={14} />
        </button>
      ) : null}
    </form>
  );
}
