import { runChecks, type CheckState } from "@/lib/kehittaja/health";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Järjestelmän tila" };

/*
 * Tila mitataan joka latauksella.
 *
 * Välimuistista luettu tilanäyttö kertoisi menneestä. Sivu on
 * kevyt eikä sitä avata usein.
 */
export const dynamic = "force-dynamic";

const TILA: Record<
  CheckState,
  { label: string; tone: "ok" | "warn" | "risk" | "info" }
> = {
  ok: { label: "Toimii", tone: "ok" },
  warn: { label: "Hidas", tone: "warn" },
  down: { label: "Poikki", tone: "risk" },
  off: { label: "Ei käytössä", tone: "info" },
};

export default async function DevHealthPage() {
  const checks = await runChecks();

  const poikki = checks.filter((c) => c.state === "down");
  const hitaat = checks.filter((c) => c.state === "warn");

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Järjestelmän tila
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Jokainen rivi on oikea kokeilu, ei tallennettu tila. Mittaus tehtiin{" "}
          {new Date().toLocaleTimeString("fi-FI", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          .
        </p>
      </header>

      {/*
        Yhteenveto ennen listaa.

        Kysymys on "onko jokin poikki", ja siihen pitää saada vastaus
        lukematta seitsemää riviä.
      */}
      <Card>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            style={{
              background:
                poikki.length > 0
                  ? "var(--rf-red-bg)"
                  : hitaat.length > 0
                    ? "var(--rf-amber-bg)"
                    : "var(--rf-green-bg)",
              color:
                poikki.length > 0
                  ? "var(--rf-red-text)"
                  : hitaat.length > 0
                    ? "var(--rf-amber-text)"
                    : "var(--rf-green-text)",
              borderRadius: 999,
            }}
          >
            <RfIcon name={poikki.length > 0 ? "alert" : "check"} size={18} />
          </span>

          <div className="min-w-0">
            <h2 className="text-[16px] font-bold tracking-[-0.01em]">
              {poikki.length > 0
                ? `${poikki.length} ${poikki.length === 1 ? "palvelu" : "palvelua"} poikki`
                : hitaat.length > 0
                  ? "Kaikki vastaa, osa hitaasti"
                  : "Kaikki toimii"}
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {poikki.length > 0
                ? poikki.map((c) => c.label).join(", ")
                : "Tietokanta, tunnistautuminen ja tallennustila vastaavat normaalisti."}
            </p>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader title="Palvelut" subtitle="Vasteaika kertoo kuormasta" />
        </div>

        <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
          {checks.map((check) => {
            const tila = TILA[check.state];
            return (
              <li
                key={check.key}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">
                    {check.label}
                  </span>
                  <span
                    className="block text-[12.5px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {check.detail}
                  </span>
                </span>

                {check.ms !== null ? (
                  <span
                    className="rf-tabular text-[12.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {check.ms} ms
                  </span>
                ) : null}

                <Pill tone={tila.tone} dot>
                  {tila.label}
                </Pill>
              </li>
            );
          })}
        </ul>
      </Card>

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        Sähköpostia ja maksuintegraatiota ei ole otettu käyttöön, joten ne
        näkyvät tilassa &quot;ei käytössä&quot;. Vihreä väittäisi että ne
        toimivat, punainen että ne ovat rikki — kumpikaan ei olisi totta.
      </p>
    </div>
  );
}
