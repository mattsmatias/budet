"use client";

import { useState } from "react";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Raportin toimitus kirjanpitäjälle.
 *
 * Kate EI lähetä sähköpostia eikä teeskentele lähettävänsä. Painike
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
  t,
  restaurantName,
  monthLabel,
  receiptCount,
  totalLabel,
}: {
  t: AdminText;
  restaurantName: string;
  monthLabel: string;
  receiptCount: number;
  totalLabel: string;
}) {
  const [opened, setOpened] = useState(false);

  const subject = fill(t.raportti.mailSubject, {
    ravintola: restaurantName,
    kuukausi: monthLabel,
  });

  const body = [
    t.raportti.mailHello,
    "",
    fill(t.raportti.mailIntro, {
      ravintola: restaurantName,
      kuukausi: monthLabel,
    }),
    "",
    fill(t.raportti.mailReceipts, { maara: String(receiptCount) }),
    fill(t.raportti.mailTotal, { summa: totalLabel }),
    "",
    t.raportti.mailAttachment,
    "",
    t.raportti.mailNote1,
    t.raportti.mailNote2,
    "",
    t.raportti.mailRegards,
  ].join("\n");

  const mailto =
    `mailto:?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="mt-5 border-t pt-4"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <p className="text-[13px] font-semibold">{t.raportti.ifYouWantToSend}</p>

      <p
        className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.raportti.emailHint}
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
        {t.raportti.openReadyEmail}
      </a>

      {opened ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.raportti.noMailClient}
        </p>
      ) : null}
    </div>
  );
}
