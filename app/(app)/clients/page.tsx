import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { listClients } from "@/lib/data/queries";
import { EmptyState, Notice, Panel } from "@/components/ui";
import { ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Asiakkaat" };

/**
 * Tilitoimiston asiakasnäkymä (§21).
 *
 * Asiakasorganisaatiot ovat omia tenanttejaan. Pääsy kulkee ainoastaan
 * aktiivisen tilitoimistosuhteen kautta, ja RLS pakottaa sen — tämä sivu
 * ei voi näyttää asiakasta johon ei ole oikeutta.
 */
export default async function ClientsPage() {
  const mode = await getAppMode();

  if (mode.kind !== "live") {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">Asiakkaat</h1>
        <ModeNotice mode={mode} />
        <EmptyState
          title="Asiakasnäkymä vaatii kirjautumisen"
          description="Kirjaudu tilitoimiston tunnuksilla nähdäksesi asiakkaat."
          action={
            <Link href="/login" className="text-sm text-navy-600 underline underline-offset-4">
              Kirjaudu
            </Link>
          }
        />
      </div>
    );
  }

  if (mode.org.kind !== "accounting_firm") {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">Asiakkaat</h1>
        <Notice tone="info" title="Tämä näkymä on tilitoimistoille">
          Organisaatiosi {mode.org.name} on tavallinen yritys. Asiakashallinta
          on käytettävissä kun organisaation tyyppi on tilitoimisto.
        </Notice>
      </div>
    );
  }

  const result = await listClients(mode.org.id);
  const clients = result.ok ? result.data : [];

  const collecting = clients.filter((c) => c.pendingDocs > 0 && c.needsReview === 0);
  const inReview = clients.filter((c) => c.needsReview > 0);
  const done = clients.filter((c) => c.pendingDocs === 0 && c.needsReview === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Asiakkaat</h1>
        <p className="mt-1 text-sm text-muted">
          {mode.org.name} · {clients.length} asiakasta
        </p>
      </div>

      <section aria-label="Tilanne" className="grid gap-4 sm:grid-cols-3">
        <Stat label="Kerätään" value={collecting.length} />
        <Stat label="Tarkistuksessa" value={inReview.length} tone="warn" />
        <Stat label="Valmis" value={done.length} tone="ok" />
      </section>

      {clients.length === 0 ? (
        <EmptyState
          title="Ei asiakkaita"
          description="Asiakassuhde syntyy kun kutsut asiakkaan tai liität olemassa olevan organisaation tilitoimistoosi. Kutsutoiminto ei ole vielä toteutettu — suhde luodaan toistaiseksi suoraan tietokantaan."
        />
      ) : (
        <Panel title="Asiakaskortit">
          <ul className="grid gap-4 sm:grid-cols-2">
            {clients.map((client) => (
              <li key={client.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.name}</p>
                    <p className="text-xs text-muted">{client.country}</p>
                  </div>
                  {client.needsReview > 0 ? (
                    <span className="rounded bg-warn-100 px-2 py-0.5 text-xs font-medium text-warn-600">
                      {client.needsReview} tarkistettavaa
                    </span>
                  ) : null}
                </div>

                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Odottaa käsittelyä</dt>
                    <dd className="tabular">{client.pendingDocs}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Viimeisin tapahtuma</dt>
                    <dd className="tabular text-xs">
                      {client.lastActivity ? client.lastActivity.slice(0, 10) : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Notice tone="info" title="Kutsuminen ei ole vielä toteutettu">
        Kutsutaulu, tokenin tiiviste ja henkilökunnan asiakasrajaukset ovat
        kannassa valmiina. Käyttöliittymä kutsujen lähettämiseen puuttuu.
      </Notice>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "ok";
}) {
  const cls =
    tone === "warn" ? "text-warn-600" : tone === "ok" ? "text-ok-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular ${cls}`}>{value}</div>
    </div>
  );
}
