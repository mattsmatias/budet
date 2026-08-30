import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { formatDayIn } from "@/lib/i18n/labels";
import { adminContext } from "@/lib/restoflow/page-context";
import { metaConfigured } from "@/lib/restoflow/meta-api";
import { tokenKeyReady } from "@/lib/restoflow/meta-crypto";
import { takeUserToken } from "@/lib/restoflow/meta-oauth";
import { listPages } from "@/lib/restoflow/meta-api";
import {
  loadMetaConnection,
  loadPublications,
  type MetaStatus,
  type PublishStatus,
} from "@/lib/restoflow/meta-queries";
import { Card, CardHeader, Pill, type Tone } from "@/components/restoflow/ui";
import { ConnectLink, DisconnectButton, PageChooser } from "./forms";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.some.title };
}

/**
 * Facebook- ja Instagram-yhteys.
 *
 * Yksi kortti tilalle, yksi julkaisuhistorialle. Yhdistäminen on
 * linkki Metan kirjautumiseen; kaikki muu tapahtuu siellä ja
 * palautuu callback-reitille.
 */
export default async function SomePage({
  searchParams,
}: PageProps<"/admin/asetukset/some">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant } = await adminContext("/admin/asetukset/some");
  const params = await searchParams;

  const [connection, publications] = await Promise.all([
    loadMetaConnection(restaurant.id),
    loadPublications(restaurant.id, 20),
  ]);

  /*
   * Sivun valinta näytetään vain kun kierros on kesken.
   *
   * Odottava käyttäjätokeni on evästeessä kymmenen minuuttia. Jos sitä
   * ei ole, valintanäkymä olisi lista jota ei voi valita.
   */
  const valitsee = params.valitse === "1";
  const pending = valitsee ? await takeUserToken() : null;
  const pages = pending ? await listPages(pending).catch(() => []) : [];

  const virhe = typeof params.virhe === "string" ? params.virhe : null;
  const asennettu = metaConfigured() && tokenKeyReady();

  return (
    <div className="rf-enter space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {t.some.title}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.some.intro}
        </p>
      </header>

      {virhe ? (
        <p
          role="alert"
          className="px-4 py-3 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {virheteksti(virhe, t)}
        </p>
      ) : null}

      {/* --- Tila --- */}
      <Card>
        <CardHeader title={t.some.title} />

        {!asennettu ? (
          /*
           * Puuttuva ympäristömuuttuja ei ole käyttäjän virhe.
           * Kerrotaan se suoraan sen sijaan että yhdistämispainike
           * veisi virheilmoitukseen.
           */
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.some.errSetup}
          </p>
        ) : pages.length > 1 ? (
          <PageChooser
            t={t}
            pages={pages.map((p) => ({
              id: p.id,
              name: p.name,
              hasInstagram: Boolean(p.instagramId),
            }))}
          />
        ) : (
          <div className="space-y-4">
            <Kanava
              t={t}
              nimi={t.some.facebook}
              arvo={connection?.pageName ?? null}
              tila={connection?.status ?? null}
            />

            <Kanava
              t={t}
              nimi={t.some.instagram}
              arvo={
                connection?.instagramUsername
                  ? `@${connection.instagramUsername}`
                  : null
              }
              tila={
                connection?.instagramId
                  ? (connection.status ?? null)
                  : connection
                    ? "incomplete"
                    : null
              }
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ConnectLink t={t} again={Boolean(connection)} />
              {connection && connection.status !== "disconnected" ? (
                <DisconnectButton t={t} />
              ) : null}
            </div>

            {connection?.instagramId === null &&
            connection.status !== "disconnected" ? (
              <p
                className="text-[12.5px] leading-relaxed"
                style={{ color: "var(--rf-text-2)" }}
              >
                {t.some.errNoInstagram}
              </p>
            ) : null}
          </div>
        )}
      </Card>

      {/* --- Historia --- */}
      <Card padded={false}>
        <div className="px-[18px] pt-[15px]">
          <CardHeader title={t.some.historyTitle} />
        </div>

        {publications.length === 0 ? (
          <p
            className="px-[18px] pb-4 text-[13px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.some.historyEmpty}
          </p>
        ) : (
          <ul>
            {publications.map((row, index) => (
              <li
                key={row.id}
                className="px-[18px] py-3.5"
                style={{
                  borderTop:
                    index === 0 ? undefined : "1px solid var(--rf-line)",
                }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="rf-num text-[13px] font-semibold tabular-nums">
                    {formatDayIn(row.createdAt.slice(0, 10), locale)}
                  </span>

                  <Pill tone={tilaSavy(row.facebookStatus)}>
                    {`${t.some.facebook}: ${tilaTeksti(row.facebookStatus, t)}`}
                  </Pill>
                  <Pill tone={tilaSavy(row.instagramStatus)}>
                    {`${t.some.instagram}: ${tilaTeksti(row.instagramStatus, t)}`}
                  </Pill>

                  <span
                    className="text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {fill(t.some.publishedBy, { nimi: row.publishedByName })}
                  </span>
                </div>

                {row.facebookError || row.instagramError ? (
                  <p
                    className="mt-1 text-[12.5px]"
                    style={{ color: "var(--rf-red-text)" }}
                  >
                    {row.facebookError ?? row.instagramError}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Kanava({
  t,
  nimi,
  arvo,
  tila,
}: {
  t: AdminText;
  nimi: string;
  arvo: string | null;
  tila: MetaStatus | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[14px] font-semibold">{nimi}</p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {arvo ?? "—"}
        </p>
      </div>

      <Pill tone={yhteysSavy(tila)} dot>
        {yhteysTeksti(tila, t)}
      </Pill>
    </div>
  );
}

function yhteysSavy(tila: MetaStatus | null): Tone {
  if (tila === "connected") return "ok";
  if (tila === "expired") return "risk";
  if (tila === "incomplete") return "warn";
  return "neutral";
}

function yhteysTeksti(tila: MetaStatus | null, t: AdminText): string {
  switch (tila) {
    case "connected":
      return t.some.connectedLabel;
    case "expired":
      return t.some.expiredLabel;
    case "incomplete":
      return t.some.incompleteLabel;
    default:
      return t.some.notConnectedLabel;
  }
}

function tilaSavy(tila: PublishStatus): Tone {
  if (tila === "ok") return "ok";
  if (tila === "failed") return "risk";
  return "neutral";
}

function tilaTeksti(tila: PublishStatus, t: AdminText): string {
  if (tila === "ok") return t.some.statusOk;
  if (tila === "failed") return t.some.statusFailed;
  return t.some.statusSkipped;
}

/** Callback-reitin syykoodi luettavaksi lauseeksi. */
function virheteksti(syy: string, t: AdminText): string {
  switch (syy) {
    case "peruttu":
      return t.some.errCancelled;
    case "state":
    case "ravintola":
      return t.some.errState;
    case "ei-sivua":
      return t.some.errNoPage;
    case "oikeudet-puuttuu":
      return t.some.errPermission;
    case "oikeus":
      return t.some.errNoAccess;
    case "asetus":
      return t.some.errSetup;
    case "meta":
      return t.some.errMeta;
    default:
      return t.some.errGeneric;
  }
}
