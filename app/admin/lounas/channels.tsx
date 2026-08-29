"use client";

import { useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { RfIcon, type IconName } from "@/components/restoflow/icons";

/**
 * Jakelukanavat.
 *
 * Lounaslista ei ole valmis kun se on tallennettu. Se on valmis kun se
 * on siellä missä asiakas sen näkee: ovessa, verkkosivulla, somessa,
 * näytöllä. Nämä neljä ovat ne paikat joihin ravintola sen oikeasti
 * vie.
 *
 * Kolme neljästä on suora linkki tai valmis koodinpätkä. Facebook ei
 * ole, ja se sanotaan siinä kohdassa suoraan — painike joka näyttää
 * julkaisevan mutta ei julkaise on pahempi kuin ohje.
 */

type Channel = "print" | "web" | "facebook" | "display";

const ICONS: Record<Channel, IconName> = {
  print: "report",
  web: "search",
  facebook: "staff",
  display: "overview",
};

const otsikot = (t: AdminText): Record<Channel, string> => ({
  print: t.lounas.tabPrint,
  web: t.lounas.tabWeb,
  facebook: "Facebook",
  display: t.lounas.tabScreens,
});

export function LunchChannels({
  t,
  publicUrl,
  previewUrl,
  embedUrl,
  displayUrl,
  shareText,
}: {
  t: AdminText;
  publicUrl: string;
  previewUrl: string;
  embedUrl: string;
  displayUrl: string;
  shareText: string;
}) {
  const [open, setOpen] = useState<Channel | null>(null);

  const channels: Channel[] = ["print", "web", "facebook", "display"];

  return (
    <div>
      <p
        className="text-[11px] font-medium uppercase"
        style={{ color: "var(--rf-text-3)", letterSpacing: "0.05em" }}
      >
        {t.lounas.shareTitle}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {channels.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => setOpen(open === channel ? null : channel)}
            aria-expanded={open === channel}
            className="rf-press flex items-center gap-3 px-3.5 py-3 text-left text-[14px] font-medium"
            style={{
              background:
                open === channel ? "var(--rf-accent-bg)" : "var(--rf-card)",
              color:
                open === channel ? "var(--rf-accent-strong)" : "var(--rf-text)",
              border: `1px solid ${open === channel ? "var(--rf-accent)" : "var(--rf-line)"}`,
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name={ICONS[channel]} size={18} />
            {otsikot(t)[channel]}
          </button>
        ))}
      </div>

      {open === "print" ? (
        <Panel title={t.lounas.tabPrint}>
          <p>{t.lounas.printHint}</p>
          <ExternalLink href={previewUrl}>{t.lounas.openA4}</ExternalLink>
          <Hint>{t.lounas.printNote}</Hint>
        </Panel>
      ) : null}

      {open === "web" ? (
        <Panel title={t.lounas.tabWeb}>
          <p>{t.lounas.embedHint}</p>
          <CopyBox
            t={t}
            label={t.lounas.embedCode}
            value={`<iframe src="${embedUrl}" title={t.lounas.lunchList} style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>`}
          />
          <Hint>
            {t.lounas.embedNote}
            <code>&amp;tausta=1</code> jos haluat teeman oman taustan.
          </Hint>
          <ExternalLink href={embedUrl}>{t.lounas.seeEmbed}</ExternalLink>
        </Panel>
      ) : null}

      {open === "facebook" ? (
        <Panel title="Facebook">
          {/*
            Rehellisyys ennen mukavuutta.

            Automaattinen julkaisu vaatisi Facebook-sovelluksen, sivun
            käyttöoikeuden ja Metan tarkistuksen. Painike joka näyttää
            julkaisevan mutta avaa vain ikkunan olisi lupaus jota se ei
            pidä.
          */}
          <p>{t.lounas.facebookHint}</p>
          <CopyBox
            t={t}
            label={t.lounas.postText}
            value={shareText}
            multiline
          />
          <ExternalLink
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
          >
            {t.lounas.openFacebook}
          </ExternalLink>
          <Hint>{t.lounas.facebookNote}</Hint>
        </Panel>
      ) : null}

      {open === "display" ? (
        <Panel title={t.lounas.tabScreens}>
          <p>{t.lounas.screenHint}</p>
          <CopyBox t={t} label={t.lounas.screenUrl} value={displayUrl} />
          <ExternalLink href={displayUrl}>{t.lounas.openScreen}</ExternalLink>
          <Hint>{t.lounas.screenNote}</Hint>
        </Panel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rf-enter mt-2 space-y-3 px-4 py-3.5 text-[13px] leading-relaxed"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
      aria-label={title}
    >
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] leading-relaxed"
      style={{ color: "var(--rf-text-3)" }}
    >
      {children}
    </p>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
      style={{ color: "var(--rf-accent)" }}
    >
      {children}
      <RfIcon name="chevron" size={13} />
    </a>
  );
}

/**
 * Kopioitava arvo.
 *
 * Arvo on aina näkyvissä eikä painikkeen takana. Leikepöytä voi olla
 * estetty, ja silloin ainoa keino on valita teksti käsin — piilotettu
 * arvo tekisi siitä mahdotonta.
 */
function CopyBox({
  t,
  label,
  value,
  multiline,
}: {
  t: AdminText;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="text-[12px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          {label}
        </p>

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="rf-press text-[12px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          {copied ? t.lounas.copied : t.lounas.copy}
        </button>
      </div>

      <pre
        className="mt-1 max-h-52 overflow-auto px-3 py-2 text-[11px] leading-relaxed"
        style={{
          background: "var(--rf-card)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-control)",
          color: "var(--rf-text)",
          whiteSpace: multiline ? "pre-wrap" : "pre",
          wordBreak: multiline ? "break-word" : "normal",
        }}
      >
        {value}
      </pre>
    </div>
  );
}
