import { fetchAppErrors } from "@/lib/kehittaja/queries";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";
import { MarkSeen } from "./forms";

export const metadata = { title: "Virheet" };

/**
 * Palvelinvirheet.
 *
 * TÄMÄ ON SE SIVU JOTA KATSOTAAN KUN ASIAKAS SOITTAA.
 *
 * Virhe kirjautuu kantaan siinä hetkessä kun se tapahtuu, ja tässä
 * se näkyy polkuineen ja pinoineen. Ilman tätä ainoa tieto oli
 * Vercelin loki, jota ei lueta ilman syytä — ja syy tuli silloin
 * puhelimessa.
 *
 * SAMA VIKA TOISTUU, EI ERI VIKA.
 *
 * Nextin virhetunniste on rivillä mukana: samasta viasta syntyneillä
 * riveillä on sama tunniste, joten kymmenen riviä voi olla yksi vika
 * eikä kymmenen.
 */

function hetki(iso: string): string {
  return new Date(iso).toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DevErrorsPage() {
  const errors = await fetchAppErrors();
  const uudet = errors.filter((e) => !e.seen).length;

  return (
    <div className="rf-stagger space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Virheet</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Palvelinvirheet uusin ensin.{" "}
            {uudet === 0
              ? "Ei uusia."
              : `${uudet} ${uudet === 1 ? "uusi" : "uutta"}.`}{" "}
            Sama tunniste tarkoittaa samaa vikaa.
          </p>
        </div>

        {uudet > 0 ? <MarkSeen /> : null}
      </header>

      {errors.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei virheitä"
            description="Palvelin ei ole kaatunut yhteenkään pyyntöön. Rivi ilmestyy tähän itsestään jos niin käy."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {errors.map((error) => (
            <Card key={error.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">
                      {error.path ?? "—"}
                    </span>
                    {error.seen ? null : <Pill tone="warn">Uusi</Pill>}
                  </div>

                  <p
                    className="mt-1 text-[13px] leading-relaxed"
                    style={{ color: "var(--rf-red-text)" }}
                  >
                    {error.message}
                  </p>

                  {error.stack ? (
                    <details className="mt-2">
                      <summary
                        className="cursor-pointer text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        Pino
                      </summary>
                      <pre
                        className="mt-1.5 overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {error.stack}
                      </pre>
                    </details>
                  ) : null}
                </div>

                <span
                  className="rf-tabular shrink-0 text-end text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {hetki(error.occurredAt)}
                  {error.digest ? (
                    <span className="mt-0.5 block">{error.digest}</span>
                  ) : null}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
