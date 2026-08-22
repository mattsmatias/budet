"use client";

import { useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Raportin toimitus kirjanpitäjälle.
 *
 * Budet EI lähetä sähköpostia eikä teeskentele lähettävänsä. Painike
 * jonka teksti on "Lähetä" mutta joka vain avaa jotain muuta on
 * pahempi kuin rehellinen painike: raportti on kirjanpitoa, ja jos
 * lähetys ei oikeasti tapahtunut, sen huomaa vasta kun kirjanpitäjä
 * kysyy missä aineisto on.
 *
 * Tämä avaa laitteen oman sähköpostiohjelman valmiiksi kirjoitetulla
 * viestillä. Liitteen lisää käyttäjä itse — selain ei voi liittää
 * tiedostoa mailto-linkkiin, eikä sitä kannata luvata.
 */
export function SendToAccountant({
  restaurantName,
  monthLabel,
  receiptCount,
  totalLabel,
}: {
  restaurantName: string;
  monthLabel: string;
  receiptCount: number;
  totalLabel: string;
}) {
  const [opened, setOpened] = useState(false);

  const subject = `${restaurantName} — kulut ${monthLabel}`;

  const body = [
    "Hei,",
    "",
    `ohessa ${restaurantName}n kulut kuukaudelta ${monthLabel}.`,
    "",
    `Kuitteja: ${receiptCount}`,
    `Kirjatut kulut yhteensä: ${totalLabel}`,
    "",
    "Liitteenä Excel-tiedosto, jossa on kulut, kategoriat ja kuittierittely.",
    "",
    "Huom: luvut ovat järjestelmään kirjattuja kuluja. Ne eivät sisällä",
    "myyntiä eivätkä pankkitilin tapahtumia.",
    "",
    "Terveisin",
  ].join("\n");

  const mailto =
    `mailto:?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--rf-line)" }}>
      <p className="text-[13px] font-semibold">Jos haluat lähettää tiedostot</p>

      <p
        className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        Lataa ensin Excel yltä ja avaa sitten valmis viesti. Budet kirjoittaa
        aiheen ja tekstin — liitä tiedosto itse, sillä Budet ei lähetä
        sähköpostia eikä pääse käsiksi liitteisiin.
      </p>

      <a
        href={mailto}
        onClick={() => setOpened(true)}
        className="rf-press mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="file" size={16} />
        Avaa valmis sähköposti
      </a>

      {opened ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Jos mitään ei avautunut, laitteella ei ole oletussähköpostiohjelmaa.
        </p>
      ) : null}
    </div>
  );
}
