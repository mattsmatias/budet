"use client";

import { useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { Button } from "@/components/restoflow/ui";

/**
 * Upotuskoodi verkkosivulle.
 *
 * Kaksi riviä ja yksi kopiointipainike. Ravintoloitsija vie ne
 * sivustonsa muokkaimeen — hän ei kirjoita niitä itse, joten koodi on
 * näkyvissä sellaisenaan eikä ohjeena.
 *
 * Osoite on täydellinen eikä suhteellinen. Se päätyy toiselle
 * sivustolle, jossa suhteellinen polku osoittaisi sinne eikä tänne.
 */
export function EmbedPanel({
  t,
  origin,
  slug,
}: {
  t: AdminText;
  origin: string;
  slug: string;
}) {
  const code =
    `<div id="kate-reservation"></div>\n` +
    `<script src="${origin}/widget.js" data-restaurant="${slug}"></script>`;

  const link = `${origin}/varaa/${slug}`;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-medium">{t.varausAsetus.embedCode}</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.varausAsetus.embedHint}
        </p>

        <pre
          className="mt-2 overflow-x-auto px-3 py-2.5 text-[12px] leading-relaxed"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
            color: "var(--rf-text-2)",
          }}
        >
          <code>{code}</code>
        </pre>

        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton
            text={code}
            label={t.varausAsetus.copyCode}
            copied={t.varausAsetus.copied}
          />
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="rf-press inline-flex items-center px-3.5 text-[13px] font-semibold"
            style={{
              minHeight: 36,
              background: "var(--rf-card)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {t.varausAsetus.previewWidget}
          </a>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium">{t.varausAsetus.bookingLink}</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.varausAsetus.bookingLinkHint}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate px-3 py-2 text-[12px]"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
              color: "var(--rf-text-2)",
            }}
          >
            {link}
          </code>
          <CopyButton
            text={link}
            label={t.varausAsetus.copyLink}
            copied={t.varausAsetus.copied}
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  text,
  label,
  copied: copiedLabel,
}: {
  text: string;
  label: string;
  copied: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      tone="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /*
           * Leikepöytä voi olla estetty. Teksti on näkyvissä yllä ja
           * valittavissa käsin — se on parempi kuin virheilmoitus
           * jolle ei voi tehdä mitään.
           */
          setCopied(false);
        }
      }}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
