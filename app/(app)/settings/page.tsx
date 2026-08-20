import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { listMembers, usageSummary } from "@/lib/data/queries";
import { EmptyState, MetricCard, Notice, Panel } from "@/components/ui";
import { ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Asetukset" };

const ROLE_LABELS: Record<string, string> = {
  business_owner: "Yrittäjä",
  accountant: "Kirjanpitäjä",
  firm_admin: "Tilitoimiston pääkäyttäjä",
  firm_staff: "Tilitoimiston työntekijä",
  company_admin: "Pääkäyttäjä",
  employee: "Työntekijä",
  super_admin: "Ylläpitäjä",
};

export default async function SettingsPage() {
  const mode = await getAppMode();

  if (mode.kind !== "live") {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">Asetukset</h1>
        <ModeNotice mode={mode} />
        <EmptyState
          title="Asetukset vaativat organisaation"
          description="Kirjaudu sisään ja luo organisaatio nähdäksesi asetukset."
          action={
            <Link href="/login" className="text-sm text-navy-600 underline underline-offset-4">
              Kirjaudu
            </Link>
          }
        />
      </div>
    );
  }

  const [membersResult, usageResult] = await Promise.all([
    listMembers(mode.org.id),
    usageSummary(mode.org.id),
  ]);

  const members = membersResult.ok ? membersResult.data : [];
  const usage = usageResult.ok ? usageResult.data : null;

  const remaining =
    usage?.documentsLimit === null || usage?.documentsLimit === undefined
      ? null
      : Math.max(0, usage.documentsLimit - usage.documentsUsed);

  const nearLimit =
    usage?.documentsLimit != null &&
    usage.documentsUsed / usage.documentsLimit >= 0.8;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Asetukset</h1>
        <p className="mt-1 text-sm text-muted">{mode.org.name}</p>
      </div>

      {nearLimit ? (
        <Notice tone="warn" title="Kuukauden dokumenttiraja lähestyy">
          {usage!.documentsUsed} / {usage!.documentsLimit} käytetty. Rajan
          täytyttyä lataus estyy kunnes suunnitelmaa päivitetään tai uusi
          laskutuskausi alkaa.
        </Notice>
      ) : null}

      <section aria-label="Käyttö" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Suunnitelma"
          value={usage?.planName ?? "—"}
          hint={usage?.subscriptionState ?? undefined}
        />
        <MetricCard
          label="Dokumentteja käytetty"
          value={String(usage?.documentsUsed ?? 0)}
          hint={usage?.periodStart ? `alkaen ${usage.periodStart}` : undefined}
        />
        <MetricCard
          label="Jäljellä"
          value={remaining === null ? "Rajaton" : String(remaining)}
          tone={nearLimit ? "warn" : "neutral"}
        />
        <MetricCard label="Käyttäjiä" value={String(members.length)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Organisaatio">
          <dl className="space-y-2.5 text-sm">
            <Row label="Nimi" value={mode.org.name} />
            <Row label="Maa" value={mode.org.country} />
            <Row
              label="Tyyppi"
              value={mode.org.kind === "accounting_firm" ? "Tilitoimisto" : "Yritys"}
            />
            <Row label="Roolisi" value={ROLE_LABELS[mode.org.role] ?? mode.org.role} />
            {usage?.trialEndsAt ? (
              <Row label="Kokeilu päättyy" value={usage.trialEndsAt.slice(0, 10)} />
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Organisaation tietojen muokkaus ei ole vielä toteutettu.
          </p>
        </Panel>

        <Panel title="Käyttäjät">
          {members.length === 0 ? (
            <p className="text-sm text-muted">Ei käyttäjiä.</p>
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">{m.name ?? m.userId.slice(0, 8)}</span>
                  <span className="text-xs text-muted">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Käyttäjien kutsuminen ei ole vielä toteutettu — kutsutaulu ja
            oikeustarkistukset ovat kannassa valmiina.
          </p>
        </Panel>

        <Panel title="Tietosi">
          <p className="text-sm text-muted">
            Saat aineistosi ulos milloin tahansa. Vienti sisältää dokumentit,
            rivit, verotuspäätökset perusteluineen ja sääntöversiot.
          </p>
          <Link
            href="/exports"
            className="mt-3 inline-block rounded-md border border-line px-3.5 py-2 text-sm font-semibold hover:border-navy-300"
          >
            Siirry vienteihin
          </Link>
        </Panel>

        <Panel title="Jäljitettävyys">
          <p className="text-sm text-muted">
            Jokainen lataus, hyväksyntä, hylkäys, uudelleenajo ja vienti
            kirjautuu muuttumattomaan audit trailiin.
          </p>
          <Link
            href="/audit"
            className="mt-3 inline-block rounded-md border border-line px-3.5 py-2 text-sm font-semibold hover:border-navy-300"
          >
            Avaa audit trail
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
