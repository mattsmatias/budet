"use client";

import { useState } from "react";
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

const LABELS: Record<Channel, string> = {
  print: "Tulosteet",
  web: "Kotisivut",
  facebook: "Facebook",
  display: "Infonäytöt",
};

export function LunchChannels({
  publicUrl,
  previewUrl,
  embedUrl,
  displayUrl,
  shareText,
}: {
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
        Vie lista eteenpäin
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
              background: open === channel ? "var(--rf-accent-bg)" : "var(--rf-card)",
              color: open === channel ? "var(--rf-accent-strong)" : "var(--rf-text)",
              border: `1px solid ${open === channel ? "var(--rf-accent)" : "var(--rf-line)"}`,
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name={ICONS[channel]} size={18} />
            {LABELS[channel]}
          </button>
        ))}
      </div>

      {open === "print" ? (
        <Panel title="Tulosteet">
          <p>
            Esikatselu on A4-kokoinen ja tulostuu samanlaisena. Avaa se ja
            paina Ctrl/Cmd + P.
          </p>
          <ExternalLink href={previewUrl}>Avaa A4-esikatselu</ExternalLink>
          <Hint>
            Kuvaukset ja ruokakohtaiset allergeenit eivät mahdu arkille. Ne
            ovat verkkosivulla, jonka asiakas avaa QR-koodista.
          </Hint>
        </Panel>
      ) : null}

      {open === "web" ? (
        <Panel title="Kotisivut">
          <p>
            Liitä tämä omalle sivullesi. Lista päivittyy itsestään kun
            julkaiset uuden viikon — koodia ei tarvitse vaihtaa.
          </p>
          <CopyBox
            label="Upotuskoodi"
            value={`<iframe src="${embedUrl}" title="Lounaslista" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>`}
          />
          <Hint>
            Tausta on läpinäkyvä, joten se ottaa oman sivusi värin. Lisää
            osoitteen perään <code>&amp;tausta=1</code> jos haluat teeman
            oman taustan.
          </Hint>
          <ExternalLink href={embedUrl}>Katso miltä upotus näyttää</ExternalLink>
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
          <p>
            Budet ei julkaise Facebookiin puolestasi — se vaatisi
            Facebook-sovelluksen ja sivun käyttöoikeuden. Tässä on lista
            valmiina tekstinä: kopioi ja liitä.
          </p>
          <CopyBox label="Julkaisun teksti" value={shareText} multiline />
          <ExternalLink
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
          >
            Avaa Facebookin jakoikkuna
          </ExternalLink>
          <Hint>
            Jakoikkuna jakaa linkin esikatselukuvineen. Teksti kannattaa
            liittää mukaan, koska moni lukee sen avaamatta linkkiä.
          </Hint>
        </Panel>
      ) : null}

      {open === "display" ? (
        <Panel title="Infonäytöt">
          <p>
            Näyttötila on suurella tekstillä ja lataa itsensä uudelleen
            kymmenen minuutin välein. Avaa tämä osoite näytön selaimessa
            koko ruudun tilassa.
          </p>
          <CopyBox label="Näytön osoite" value={displayUrl} />
          <ExternalLink href={displayUrl}>Avaa näyttötila</ExternalLink>
          <Hint>
            Kuvaukset ja allergeenit jäävät pois: metrin päästä niitä ei
            lue kukaan, ja ne veisivät tilan siltä mitä luetaan.
          </Hint>
        </Panel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
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
    <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
      {children}
    </p>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
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
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
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
          {copied ? "Kopioitu" : "Kopioi"}
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
