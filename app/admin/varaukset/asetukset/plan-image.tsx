"use client";

/**
 * Salin pohjapiirroksen lisääminen.
 *
 * Ravintolalla on pohjapiirros jo olemassa: arkkitehdin kuva,
 * paloturvallisuuden kaavio tai käsin piirretty luonnos. Pöytien
 * raahaaminen tyhjälle ruudukolle on arvailua siitä missä seinät ovat;
 * kuvan päälle raahattuna se on sen merkitsemistä mikä on jo tiedossa.
 *
 * ---------------------------------------------------------------------
 * TIEDOSTO MENEE SELAIMESTA SUORAAN TALLENNUKSEEN
 * ---------------------------------------------------------------------
 *
 * Kymmenen megatavun kierrätys Next-palvelimen läpi ei toisi mitään:
 * oikeuden ratkaisee tallennuksen käytäntö, joka vaatii esihenkilön, ja
 * se pätee riippumatta siitä kuka pyynnön lähettää. Palvelintoiminto
 * saa vain polun ja mitat.
 *
 * Mitat luetaan täällä, koska kuvan koko on selaimen tiedossa
 * valmiiksi. Palvelin joutuisi purkamaan tiedoston sen selvittääkseen.
 */

import { useRef, useState, useTransition } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/restoflow/ui";
import type { FloorPlanImage } from "@/lib/restoflow/reservations";
import {
  deleteFloorPlanImage,
  saveFloorPlanImage,
  setFloorPlanOpacity,
} from "./actions";

/** Sama raja kuin ämpärissä. Tarkistus täällä säästää turhan latauksen. */
const MAX_BYTES = 10 * 1024 * 1024;

const TYYPIT = ["image/jpeg", "image/png", "image/webp"];

export function PlanImagePanel({
  t,
  restaurantId,
  plan,
}: {
  t: AdminText;
  restaurantId: string;
  plan: FloorPlanImage | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, start] = useTransition();

  /*
   * Voimakkuus paikallisena tilana.
   *
   * Liuku päivittyy sormen mukana, mutta tallennus tapahtuu vasta kun
   * ote irtoaa. Jokainen välivaihe olisi oma kirjoituksensa kantaan —
   * sata riviä muutoslokia yhdestä säädöstä.
   */
  const [opacity, setOpacity] = useState(plan?.opacity ?? 0.45);
  const input = useRef<HTMLInputElement>(null);

  async function valitse(file: File): Promise<void> {
    setError(null);
    setNotice(null);

    if (!TYYPIT.includes(file.type)) {
      setError(t.pohjakuva.errType);
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(t.pohjakuva.errSize);
      return;
    }

    setUploading(true);

    try {
      const mitat = await lueMitat(file);
      if (!mitat) {
        setError(t.pohjakuva.errRead);
        return;
      }

      /*
       * Tiedostonimi on aikaleima eikä alkuperäinen nimi.
       *
       * Alkuperäinen voi olla mitä tahansa merkkejä, ja sama nimi
       * uudelleen ladattuna korvaisi vanhan kuvan välimuistissa
       * näkymättä uutena.
       */
      const supabase = createClient();
      const pate =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${restaurantId}/pohja-${Date.now()}.${pate}`;

      const { error: latausVirhe } = await supabase.storage
        .from("floorplans")
        .upload(path, file, { contentType: file.type });

      if (latausVirhe) {
        setError(t.pohjakuva.errUpload);
        return;
      }

      const tulos = await saveFloorPlanImage({
        path,
        width: mitat.width,
        height: mitat.height,
      });

      if (tulos.error) {
        /* Rivi jäi kytkemättä: tiedosto on turha, joten se pois. */
        await supabase.storage.from("floorplans").remove([path]);
        setError(tulos.error);
        return;
      }

      setOpacity(0.45);
      setNotice(tulos.notice ?? t.pohjakuva.saved);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
        {plan ? t.pohjakuva.privacy : t.pohjakuva.hint}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept={TYYPIT.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void valitse(file);
          }}
        />

        <Button
          type="button"
          tone="secondary"
          disabled={uploading || busy}
          onClick={() => input.current?.click()}
        >
          {uploading
            ? t.pohjakuva.uploading
            : plan
              ? t.pohjakuva.replace
              : t.pohjakuva.add}
        </Button>

        {plan ? (
          <Button
            type="button"
            tone="ghost"
            disabled={uploading || busy}
            onClick={() =>
              start(async () => {
                const tulos = await deleteFloorPlanImage();
                setError(tulos.error ?? null);
                setNotice(tulos.notice ?? null);
              })
            }
          >
            {t.pohjakuva.remove}
          </Button>
        ) : null}

        {plan ? (
          <label className="ml-auto flex items-center gap-2 text-[12.5px]">
            {t.pohjakuva.opacity}
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              disabled={busy}
              onChange={(event) => setOpacity(Number(event.target.value) / 100)}
              onPointerUp={() =>
                start(async () => {
                  const tulos = await setFloorPlanOpacity(opacity);
                  setError(tulos.error ?? null);
                })
              }
              onKeyUp={() =>
                start(async () => {
                  const tulos = await setFloorPlanOpacity(opacity);
                  setError(tulos.error ?? null);
                })
              }
              className="w-32"
              style={{ accentColor: "var(--rf-accent)" }}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
          {error}
        </p>
      ) : null}

      {notice && !error ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-green-text)" }}>
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Kuvan pikselimitat.
 *
 * Objektiosoite eikä data-URL: kymmenen megatavun kuva base64:nä on
 * kolmetoista megatavua merkkijonoa, ja se luetaan turhaan kun
 * tarvitaan vain kaksi lukua.
 */
function lueMitat(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    image.src = url;
  });
}
