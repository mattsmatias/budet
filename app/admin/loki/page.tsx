import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import { addDays, startOfDayIso } from "@/lib/restoflow/dates";
import { can } from "@/lib/restoflow/permissions";
import { fetchAuditLog } from "@/lib/restoflow/queries";
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  actionTone,
  fieldChanges,
  summarise,
  type AuditEvent,
} from "@/lib/restoflow/audit";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Toimintaloki" };

const PAGE_SIZE = 50;

/**
 * Toimintaloki.
 *
 * Kun myöhemmin kysytään "kuka muutti tämän ja mikä se oli ennen",
 * Katen on pystyttävä vastaamaan. Palkkatieto, työaikakorjaus,
 * verokanta ja käyttöoikeus ovat asioita joissa muistikuva ei riitä.
 *
 * LOKI EI SYNNY TÄSTÄ NÄKYMÄSTÄ.
 *
 * Rivit kirjoittaa kanta liipaisimilla, ja tekijä luetaan istunnosta.
 * Sovelluksen kautta kirjattu loki jäisi kirjaamatta joka kerta kun
 * joku kutsuu rajapintaa suoraan — ja juuri silloin sitä tarvittaisiin.
 *
 * SUODATUS TEHDÄÄN KANNASSA.
 *
 * Loki kasvaa nopeasti. Selaimessa suodattaminen vaatisi kaiken
 * lataamista ensin, mikä on juuri se mitä yritetään välttää.
 */
export default async function AuditLogPage({
  searchParams,
}: PageProps<"/admin/loki">) {
  const { restaurant, role, users, today } = await adminContext("/admin/loki");
  if (!can(role, "audit.view")) return null;

  const params = await searchParams;

  const entityType = str(params.moduuli);
  const action = str(params.toiminto);
  const actorId = str(params.kayttaja);
  const search = str(params.haku);
  const days = Number(str(params.jakso) || "30");
  const page = Math.max(0, Number(str(params.sivu) || "0"));

  /*
   * Rajaus alkaa paikallisen päivän alusta.
   *
   * "Tänään" tarkoittaa ravintolan päivää eikä viimeisiä 24 tuntia.
   * Rullaava ikkuna jättäisi aamun tapahtumat pois iltapäivällä.
   */
  const since =
    Number.isFinite(days) && days > 0
      ? startOfDayIso(addDays(today, -(days - 1)), restaurant.timezone)
      : undefined;

  const { events, hasMore } = await fetchAuditLog(restaurant.id, {
    entityType: entityType || undefined,
    action: action || undefined,
    actorId: actorId || undefined,
    search: search || undefined,
    since,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const summary = summarise(events);
  const query = (extra: Record<string, string>) =>
    buildQuery({
      moduuli: entityType,
      toiminto: action,
      kayttaja: actorId,
      haku: search,
      jakso: String(days),
      ...extra,
    });

  return (
    <div className="rf-enter space-y-5">
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        Seuraa mitä ravintolan Kateessa on tapahtunut ja kuka muutokset on
        tehnyt.
      </p>

      {/*
        Yhteenveto ennen listaa.

        Omistaja avaa lokin kysyäkseen "mitä täällä on tapahtunut", ei
        lukeakseen viittäkymmentä riviä. Luvut vastaavat siihen ennen
        kuin listaa tarvitsee selata.
      */}
      <section
        aria-label="Yhteenveto"
        className="grid auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <Luku label="Tapahtumia" value={summary.total} icon="report" />
        <Luku label="Lisäyksiä" value={summary.created} tone="ok" icon="plus" />
        <Luku
          label="Muutoksia"
          value={summary.updated}
          tone="info"
          icon="settings"
        />
        <Luku
          label="Poistoja"
          value={summary.deleted}
          tone="risk"
          icon="trash"
        />
      </section>

      {summary.latestCritical ? (
        <Card>
          <CardHeader
            title="Viimeisin kriittinen muutos"
            subtitle="Palkka, käyttöoikeus, työaikakorjaus tai verokanta"
          />
          <p className="text-[13.5px] font-semibold">
            {summary.latestCritical.summary}
          </p>
          <p
            className="rf-tabular mt-1 text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {summary.latestCritical.actorName} ·{" "}
            {formatMoment(
              summary.latestCritical.createdAt,
              restaurant.timezone,
            )}
          </p>
        </Card>
      ) : null}

      <Card>
        <form className="space-y-3">
          <input type="hidden" name="jakso" value={days} />

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="haku"
              defaultValue={search}
              placeholder="Hae käyttäjällä, toiminnolla tai kohteella…"
              aria-label="Hae lokista"
              className="min-w-0 flex-1 px-3.5 py-2 text-[13px]"
              style={{
                background: "var(--rf-card)",
                border: "1px solid var(--rf-line-strong)",
                borderRadius: "var(--rf-r-control)",
              }}
            />

            <button
              type="submit"
              className="rf-press px-3.5 py-2 text-[13px] font-semibold"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text)",
                border: "1px solid var(--rf-line-strong)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Hae
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Valitsin
              name="moduuli"
              label="Moduuli"
              value={entityType}
              options={ENTITY_LABELS}
            />
            <Valitsin
              name="toiminto"
              label="Toiminto"
              value={action}
              options={ACTION_LABELS}
            />

            <label className="block">
              <span
                className="block text-[12px] font-semibold"
                style={{ color: "var(--rf-text-2)" }}
              >
                Käyttäjä
              </span>
              <select
                name="kayttaja"
                defaultValue={actorId}
                className="mt-1 w-full px-3 py-2 text-[13px]"
                style={{
                  background: "var(--rf-card)",
                  border: "1px solid var(--rf-line-strong)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <option value="">Kaikki käyttäjät</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        <nav aria-label="Ajanjakso" className="mt-3 flex flex-wrap gap-1.5">
          {[
            { days: 1, label: "Tänään" },
            { days: 7, label: "7 päivää" },
            { days: 30, label: "30 päivää" },
            { days: 365, label: "Vuosi" },
          ].map((option) => (
            <Link
              key={option.days}
              href={`/admin/loki${query({ jakso: String(option.days), sivu: "0" })}`}
              aria-current={days === option.days ? "page" : undefined}
              className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
              style={{
                background:
                  days === option.days
                    ? "var(--rf-accent-bg)"
                    : "var(--rf-inset)",
                color:
                  days === option.days
                    ? "var(--rf-accent-strong)"
                    : "var(--rf-text-2)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </Card>

      {events.length === 0 ? (
        <EmptyState
          title="Ei tapahtumia"
          description="Tällä rajauksella ei ole tapahtumia. Kokeile pidempää ajanjaksoa tai poista suodattimet."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {events.map((event) => (
              <li key={event.id} className="px-5 py-3.5">
                <Tapahtuma event={event} timezone={restaurant.timezone} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(page > 0 || hasMore) && events.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          {page > 0 ? (
            <Link
              href={`/admin/loki${query({ sivu: String(page - 1) })}`}
              className="rf-press inline-flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: "var(--rf-text-2)" }}
            >
              <RfIcon name="back" size={14} />
              Uudemmat
            </Link>
          ) : (
            <span />
          )}

          {hasMore ? (
            <Link
              href={`/admin/loki${query({ sivu: String(page + 1) })}`}
              className="rf-press inline-flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: "var(--rf-text-2)" }}
            >
              Vanhemmat
              <RfIcon name="chevron" size={14} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Tapahtuma({
  event,
  timezone,
}: {
  event: AuditEvent;
  timezone: string;
}) {
  const tone = actionTone(event.action);
  const changes = fieldChanges(event);

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 inline-block h-2 w-2 shrink-0"
          style={{
            background:
              tone === "ok"
                ? "var(--rf-green-text)"
                : tone === "risk"
                  ? "var(--rf-red)"
                  : "var(--rf-blue-text)",
            borderRadius: "50%",
          }}
        />

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px]">
            <strong className="font-semibold">{event.actorName}</strong>{" "}
            {event.summary}
          </span>

          <span
            className="rf-tabular mt-0.5 block text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {formatMoment(event.createdAt, timezone)}
            {event.entityType in ENTITY_LABELS
              ? ` · ${ENTITY_LABELS[event.entityType]}`
              : ""}
          </span>
        </span>

        {event.critical ? (
          <Pill tone="risk" dot>
            kriittinen
          </Pill>
        ) : null}
      </summary>

      {changes.length > 0 ? (
        <div className="mt-3 pl-5">
          <table className="rf-table w-full" style={{ maxWidth: "34rem" }}>
            <caption className="sr-only">Muuttuneet tiedot</caption>
            <thead>
              <tr>
                <th scope="col">Kenttä</th>
                <th scope="col">Ennen</th>
                <th scope="col">Jälkeen</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.field} className="rf-row">
                  <td className="font-medium">{change.field}</td>
                  <td
                    className="rf-tabular"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {change.before}
                  </td>
                  <td className="rf-tabular font-semibold">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p
          className="mt-2 pl-5 text-[12.5px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          Tapahtumasta ei ole tallennettu kenttäkohtaisia arvoja.
        </p>
      )}
    </details>
  );
}

/**
 * Lokin avainluku.
 *
 * SAMA KORTTI KUIN MUUALLA.
 *
 * Luvut olivat MetricCardin typografia kopioituna tavallisen Cardin
 * sisään, joten reunus ja kulmasäde erosivat muiden sivujen
 * avainluvuista. Nyt kortti tulee samasta lähteestä, ja sävy näkyy
 * ikonilaatassa kuten Kuluilla ja Tehtävillä.
 */
function Luku({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: "ok" | "info" | "risk";
  icon: IconName;
}) {
  /*
   * Väri vain kun jotain tapahtui.
   *
   * Nolla poistoa on tavallinen tulos eikä ansaitse punaista laattaa.
   */
  const sävy =
    value === 0 || tone === undefined
      ? "muted"
      : tone === "ok"
        ? "green"
        : tone === "risk"
          ? "bad"
          : "blue";

  return (
    <MetricCard
      label={label}
      value={value}
      tileTone={sävy}
      icon={<RfIcon name={icon} size={17} />}
    />
  );
}

function Valitsin({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Record<string, string>;
}) {
  return (
    <label className="block">
      <span
        className="block text-[12px] font-semibold"
        style={{ color: "var(--rf-text-2)" }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 w-full px-3 py-2 text-[13px]"
        style={{
          background: "var(--rf-card)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <option value="">Kaikki</option>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== "" && value !== "0") search.set(key, value);
  }

  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * Aika Suomen kellossa.
 *
 * Aikaleimat tallennetaan UTC:nä ja näytetään ravintolan
 * aikavyöhykkeellä. Kesä- ja talviaika hoituvat samalla: Intl osaa
 * vyöhykkeen säännöt, eikä siirtymää tarvitse laskea käsin.
 */
function formatMoment(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("fi-FI", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
