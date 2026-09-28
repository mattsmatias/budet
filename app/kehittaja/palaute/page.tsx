import Link from "next/link";
import { fetchDevFeedback, type DevFeedback } from "@/lib/kehittaja/queries";
import { Card, EmptyState, Pill, type Tone } from "@/components/restoflow/ui";
import { RespondForm } from "./forms";

export const metadata = { title: "Palaute" };

/**
 * Asiakkaiden ilmoitukset.
 *
 * TÄMÄ ON SE SIVU JOTA KATSOTAAN ENNEN KUIN ASIAKAS SOITTAA.
 *
 * Virheet-sivu kertoo mikä hajosi, tämä kertoo kuka siihen törmäsi ja
 * mitä hän oli tekemässä. Kaksi puoliskoa samasta tapauksesta: virheen
 * pino on siellä, ihmisen lause täällä, ja polku on molemmissa.
 *
 * AVOIMET ENSIN, MUTTA SAMASSA LISTASSA.
 *
 * Erillinen "hoidetut"-välilehti tarkoittaa että toista ei avata. Tila
 * on pilleri rivillä, ja järjestys on aikajärjestys — sama kuin
 * Yhteydenotoissa, jotta kahta samannäköistä listaa ei lueta eri
 * tavoin.
 */

const LAJI: Record<DevFeedback["kind"], { nimi: string; tone: Tone }> = {
  bug: { nimi: "Vika", tone: "risk" },
  idea: { nimi: "Ehdotus", tone: "info" },
  contact: { nimi: "Yhteydenotto", tone: "neutral" },
};

const TILA: Record<DevFeedback["status"], { nimi: string; tone: Tone }> = {
  new: { nimi: "Uusi", tone: "warn" },
  in_progress: { nimi: "Työn alla", tone: "info" },
  done: { nimi: "Korjattu", tone: "ok" },
  declined: { nimi: "Ei toteuteta", tone: "neutral" },
};

function hetki(iso: string): string {
  return new Date(iso).toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DevFeedbackPage() {
  const items = await fetchDevFeedback();
  const uudet = items.filter((i) => i.status === "new").length;
  const viat = items.filter(
    (i) => i.kind === "bug" && i.status !== "done" && i.status !== "declined",
  ).length;

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Palaute</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Asiakkaiden ilmoitukset sovelluksen sisältä.{" "}
          {items.length === 0
            ? "Ei vielä yhtään."
            : `${uudet} uutta${viat > 0 ? `, ${viat} avointa vikaa` : ""}.`}{" "}
          Vastaus näkyy ilmoittajalle hänen omalla Palaute-sivullaan.
        </p>
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei ilmoituksia"
            description="Kun yritys lähettää bugi-ilmoituksen, ehdotuksen tai yhteydenoton, se näkyy täällä yrityksineen ja näkymineen."
          />
        </Card>
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={LAJI[item.kind].tone}>
                      {LAJI[item.kind].nimi}
                    </Pill>
                    <Pill tone={TILA[item.status].tone}>
                      {TILA[item.status].nimi}
                    </Pill>
                  </div>

                  <h2 className="mt-2 text-[15px] font-bold tracking-[-0.0075em]">
                    {item.title}
                  </h2>

                  <p
                    className="mt-1 text-[12.5px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    <Link
                      href={`/kehittaja/yritykset/${item.restaurantId}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {item.restaurantName}
                    </Link>
                    {item.reporter ? ` · ${item.reporter}` : ""}
                    {item.reporterEmail ? ` · ${item.reporterEmail}` : ""}
                    {` · ${hetki(item.createdAt)}`}
                  </p>

                  {/*
                    Polku on se kohta jossa tämä eroaa sähköpostista.

                    Sen kanssa vian etsiminen alkaa oikeasta tiedostosta;
                    ilman sitä ensimmäinen työ on kysyä missä oltiin.
                  */}
                  {item.path ? (
                    <p
                      className="rf-tabular mt-1 text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {item.path}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed">
                {item.body}
              </p>

              <RespondForm
                id={item.id}
                status={item.status}
                reply={item.reply}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
