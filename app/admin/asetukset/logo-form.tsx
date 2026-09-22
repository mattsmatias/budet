"use client";

import { useActionState, useRef, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { removeRestaurantLogo, updateRestaurantLogo } from "./logo-actions";
import type { AdminState } from "../actions";
import { Feedback, Submit } from "./form-parts";
import { RestaurantAvatar } from "@/components/restoflow/restaurant-avatar";

const initial: AdminState = {};

/**
 * Yrityksen kuvan vaihto.
 *
 * KUVA PIENENNETÄÄN SELAIMESSA.
 *
 * Puhelimen kamerakuva on kymmenen megatavua ja kolmetuhatta pikseliä
 * leveä; laatta jossa se näkyy on neljäkymmentä. Piirto neliöön ennen
 * lähetystä tekee kolmesta asiasta kerralla oikean: verkkoon ei lähde
 * turhaa, tallennettu tiedosto on pieni, ja kuvan mukana kulkevat
 * EXIF-tiedot — myös kuvauspaikan sijainti — jäävät pois, koska
 * piirretty kuva ei peri niitä.
 *
 * Palvelin ei silti luota tähän. Se tarkistaa tyypin ja koon uudelleen,
 * ja kanta tarkistaa vielä kansion.
 *
 * MITTASUHTEET SÄILYVÄT.
 *
 * Kuva sovitetaan neliöön kokonaisena eikä rajata täyteen: logo jonka
 * reunat on leikattu pois on tunnistettavasti väärä, kun taas valkoinen
 * reunus sen ympärillä ei häiritse ketään.
 */
const LAATU = 0.92;
const SIVU = 512;

async function neliöksi(tiedosto: File): Promise<File | null> {
  try {
    const bittikartta = await createImageBitmap(tiedosto);

    const kangas = document.createElement("canvas");
    kangas.width = SIVU;
    kangas.height = SIVU;

    const piirto = kangas.getContext("2d");
    if (!piirto) return null;

    piirto.fillStyle = "#ffffff";
    piirto.fillRect(0, 0, SIVU, SIVU);

    const suhde = Math.min(
      SIVU / bittikartta.width,
      SIVU / bittikartta.height,
    );
    const leveys = bittikartta.width * suhde;
    const korkeus = bittikartta.height * suhde;

    piirto.imageSmoothingQuality = "high";
    piirto.drawImage(
      bittikartta,
      (SIVU - leveys) / 2,
      (SIVU - korkeus) / 2,
      leveys,
      korkeus,
    );
    bittikartta.close();

    const pala = await new Promise<Blob | null>((valmis) =>
      kangas.toBlob(valmis, "image/png", LAATU),
    );
    if (!pala) return null;

    return new File([pala], "logo.png", { type: "image/png" });
  } catch {
    return null;
  }
}

export function LogoForm({
  t,
  name,
  logoUrl,
}: {
  t: AdminText;
  name: string;
  logoUrl: string | null;
}) {
  const [state, action] = useActionState(updateRestaurantLogo, initial);
  const [poistoTila, poista] = useActionState(removeRestaurantLogo, initial);

  /* Esikatselu näyttää valitun kuvan ennen tallennusta. */
  const [esikatselu, setEsikatselu] = useState<string | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const kentta = useRef<HTMLInputElement>(null);
  const piilotettu = useRef<HTMLInputElement>(null);

  async function valittu(e: React.ChangeEvent<HTMLInputElement>) {
    const tiedosto = e.target.files?.[0];
    if (!tiedosto) return;

    setVirhe(null);
    const pienennetty = await neliöksi(tiedosto);

    if (!pienennetty) {
      setVirhe(t.asetus.logoUnreadable);
      setEsikatselu(null);
      return;
    }

    /*
     * Tiedosto siirretään piilotettuun kenttään.
     *
     * Lomake lähettää sen mitä kentässä on, ja kentässä on nyt
     * pienennetty neliö eikä alkuperäinen kamerakuva. DataTransfer on
     * ainoa tapa asettaa tiedostokentän arvo ohjelmallisesti.
     */
    const siirto = new DataTransfer();
    siirto.items.add(pienennetty);
    if (piilotettu.current) piilotettu.current.files = siirto.files;

    setEsikatselu(URL.createObjectURL(pienennetty));
  }

  /*
   * Poiston jälkeen kuva katoaa heti.
   *
   * Palvelin tyhjentää polun ja sivu päivittyy, mutta vasta seuraavalla
   * käynnillä: ilman tätä poistettu kuva jäisi ruudulle vaikka se on jo
   * poissa, ja käyttäjä painaisi nappia uudelleen.
   */
  const poistettu = Boolean(poistoTila.notice);
  const nykyinen = poistettu ? null : logoUrl;
  const näytettävä = esikatselu ?? nykyinen;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold">{t.asetus.logoTitle}</p>
        <p
          className="mt-1.5 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.asetus.logoHint}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <RestaurantAvatar name={name} logoUrl={näytettävä} size={72} />

        <div className="min-w-0 flex-1">
          <form action={action} className="flex flex-wrap items-center gap-3">
            {/* Kuvan valinta ja lähetettävä tiedosto ovat eri kentät:
                valittu kuva pienennetään ennen kuin se päätyy lomakkeeseen. */}
            <input
              ref={kentta}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={valittu}
              className="sr-only"
              id="rf-logo-valinta"
            />
            <input
              ref={piilotettu}
              type="file"
              name="logo"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />

            <label
              htmlFor="rf-logo-valinta"
              className="rf-press inline-flex cursor-pointer items-center justify-center whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
                minHeight: 36,
              }}
            >
              {nykyinen ? t.asetus.logoReplace : t.asetus.logoChoose}
            </label>

            {esikatselu ? <Submit t={t} label={t.asetus.save} /> : null}
            <Feedback state={state} />
          </form>

          <p
            className="mt-2 text-[12px]"
            style={{ color: virhe ? "var(--rf-red-text)" : "var(--rf-text-3)" }}
          >
            {virhe ?? (nykyinen ? t.asetus.logoFormats : t.asetus.logoNone)}
          </p>

          {/* Poiston kuittaus jää näkyviin vaikka nappi katoaa kuvan
              mukana: muuten toiminto näyttäisi jääneen tekemättä. */}
          <div className="mt-2.5 flex items-center gap-3">
            {nykyinen && !esikatselu ? (
              <form action={poista}>
                <button
                  type="submit"
                  className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
                  style={{ color: "var(--rf-red-text)" }}
                >
                  {t.asetus.logoRemove}
                </button>
              </form>
            ) : null}
            <Feedback state={poistoTila} />
          </div>
        </div>
      </div>
    </div>
  );
}
