import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { auditActionLabel, listAuditEvents, type AuditEvent } from "@/lib/data/queries";
import { EmptyState, Notice, Panel } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Audit trail" };

/**
 * Audit trail (§13).
 *
 * Vain luku. Taulu on lisäys-vain liipaisimen pakottamana, eikä
 * käyttöliittymässä ole mitään mikä voisi muuttaa tapahtumaa.
 */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const params = await searchParams;
  const action = typeof params.toiminto === "string" ? params.toiminto : undefined;

  const mode = await getAppMode();
  const result =
    mode.kind === "live"
      ? await listAuditEvents(mode.org.id, { action })
      : ({ ok: true as const, data: [], source: "live" as const });

  const events = result.ok ? result.data : [];
  const actions = [...new Set(events.map((e) => e.action))].sort();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Audit trail</h1>
        <p className="mt-1 text-sm text-muted">
          {events.length} tapahtumaa{action ? ` · suodatin: ${auditActionLabel(action)}` : ""}
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      <Notice tone="info" title="Tapahtumia ei voi muuttaa">
        Audit trail on lisäys-vain. Muokkaus ja poisto on estetty tietokannan
        liipaisimella, ei vain käyttöliittymässä.
      </Notice>

      {actions.length > 1 ? (
        <nav aria-label="Suodattimet" className="flex flex-wrap gap-2">
          <Link
            href="/audit"
            aria-current={!action ? "page" : undefined}
            className={filterCls(!action)}
          >
            Kaikki
          </Link>
          {actions.map((a) => (
            <Link
              key={a}
              href={`/audit?toiminto=${encodeURIComponent(a)}`}
              aria-current={action === a ? "page" : undefined}
              className={filterCls(action === a)}
            >
              {auditActionLabel(a)}
            </Link>
          ))}
        </nav>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          title="Ei tapahtumia"
          description={
            mode.kind === "live"
              ? "Tapahtumat kirjautuvat automaattisesti kun lähetät, hyväksyt tai viet dokumentteja."
              : "Kirjaudu sisään nähdäksesi organisaatiosi tapahtumat."
          }
        />
      ) : (
        <Panel title="Tapahtumat">
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <AuditRow event={event} />
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const entries = Object.entries(event.metadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className="flex gap-3 border-b border-line pb-3 last:border-0">
      <span
        aria-hidden="true"
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{auditActionLabel(event.action)}</p>
          <time className="text-xs text-muted tabular" dateTime={event.createdAt}>
            {formatStamp(event.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {event.entityType}
          {event.entityId ? (
            <>
              {" · "}
              {event.entityType === "document" ? (
                <Link
                  href={`/documents/${event.entityId}`}
                  className="font-mono underline underline-offset-4"
                >
                  {event.entityId.slice(0, 8)}
                </Link>
              ) : (
                <span className="font-mono">{event.entityId.slice(0, 8)}</span>
              )}
            </>
          ) : null}
          {event.actorName ? ` · ${event.actorName}` : ""}
          {` · ${event.source}`}
        </p>

        {entries.length > 0 ? (
          <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-1">
                <dt>{key}:</dt>
                <dd className="font-medium text-foreground">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

function filterCls(active: boolean): string {
  return [
    "rounded-md border px-3 py-1.5 text-sm",
    active
      ? "border-navy-900 bg-navy-900 text-navy-50"
      : "border-line hover:border-navy-300",
  ].join(" ");
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
