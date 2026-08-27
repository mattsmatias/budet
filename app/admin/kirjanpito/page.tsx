import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { formatMoney } from "@/lib/money";
import {
  MONTH_STATUS_LABELS,
  monthLabel,
  monthTone,
  sortIssues,
  type MonthState,
} from "@/lib/restoflow/accounting";
import {
  fetchAccounts,
  fetchBalanceSheet,
  fetchGeneralLedger,
  fetchIncomeStatement,
  fetchJournal,
  fetchMonthState,
  fetchTaxGuides,
} from "@/lib/restoflow/accounting-queries";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import { CloseMonthForm, PostAllButton, SyncButton } from "./controls";
import { Alv, Paakirja, Paivakirja, Raportit, Tilikartta, Veroasiat } from "./views";

export const metadata = { title: "Kirjanpito" };

const TABS = [
  { key: "yhteenveto", label: "Yhteenveto" },
  { key: "paivakirja", label: "Päiväkirja" },
  { key: "paakirja", label: "Pääkirja" },
  { key: "tilikartta", label: "Tilikartta" },
  { key: "alv", label: "ALV" },
  { key: "raportit", label: "Raportit" },
  { key: "veroasiat", label: "Veroasiat" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Kirjanpito.
 *
 * EI KYSY MITÄÄN MITÄ BUDET JO TIETÄÄ.
 *
 * Sivu ei ota vastaan myyntejä, kuitteja eikä kuluja. Ne ovat jo
 * kannassa, ja "Hae tapahtumat" lukee ne sieltä. Käyttäjän työ on
 * tarkistaa poikkeamat, ei kopioida rivejä.
 *
 * VÄLILEHTI ON OSOITE, EI TILA.
 *
 * Näkymä valitaan hakuparametrilla, joten sivu renderöityy
 * palvelimella eikä lataa kaikkien välilehtien dataa varmuuden
 * vuoksi. Linkin voi myös jakaa ja selaimen paluunappi toimii.
 */
export default async function AccountingPage({
  searchParams,
}: PageProps<"/admin/kirjanpito">) {
  const params = await searchParams;
  const { restaurant, role, month: nykyinen } = await adminContext("/admin/kirjanpito");

  const pyydetty = typeof params.kuukausi === "string" ? params.kuukausi : nykyinen;
  const month = ISO_MONTH.test(pyydetty) ? pyydetty : nykyinen;

  const tab = (TABS.find((t) => t.key === params.nakyma)?.key ?? "yhteenveto") as TabKey;

  const state = await fetchMonthState(restaurant.id, month);
  const saaKirjata = can(role, "accounting.manage");

  // Kaksitoista kuukautta taaksepäin, kuten raportoinnissa.
  const valittavat: string[] = [];
  {
    let cursor = nykyinen;
    for (let i = 0; i < 13; i++) {
      valittavat.push(cursor);
      const [y, m] = cursor.split("-").map(Number);
      const edellinen = new Date(Date.UTC(y, m - 2, 1));
      cursor = `${edellinen.getUTCFullYear()}-${String(edellinen.getUTCMonth() + 1).padStart(2, "0")}`;
    }
  }

  if (!state) {
    return (
      <div className="rf-enter space-y-5">
        <EmptyState
          title="Kirjanpitoa ei voitu lukea"
          description="Tarkista että sinulla on oikeus talouden tietoihin. Jos ongelma toistuu, kyse on yhteydestä tietokantaan."
        />
      </div>
    );
  }

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      {/* Otsikkorivi: tilikausi, kuukausi ja tila */}
      <div className="rf-z-page relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {monthLabel(month)} · {state.posted} kirjattua ·{" "}
            {state.proposed} odottaa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill
            tone={
              monthTone(state.status) === "warn"
                ? "warn"
                : monthTone(state.status) === "good"
                  ? "ok"
                  : "info"
            }
            dot
          >
            {MONTH_STATUS_LABELS[state.status]}
          </Pill>

          <KuukausiValitsin month={month} tab={tab} months={valittavat} />
        </div>
      </div>

      {/* Välilehdet */}
      <nav aria-label="Kirjanpidon näkymät" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-2 pb-1 md:flex-wrap">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <li key={t.key}>
                <Link
                  href={`/admin/kirjanpito?nakyma=${t.key}&kuukausi=${month}`}
                  className="rf-press inline-flex items-center px-3.5 py-1.5 text-[13px] font-semibold"
                  style={{
                    background: active ? "var(--rf-accent-soft)" : "var(--rf-inset)",
                    color: active ? "var(--rf-accent)" : "var(--rf-text-2)",
                    borderRadius: 999,
                  }}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "yhteenveto" ? (
        <Yhteenveto
          restaurantId={restaurant.id}
          month={month}
          state={state}
          saaKirjata={saaKirjata}
          onOmistaja={role === "owner"}
        />
      ) : null}

      {tab === "paivakirja" ? (
        <Paivakirja
          entries={await fetchJournal(restaurant.id, month)}
          saaKirjata={saaKirjata}
        />
      ) : null}

      {tab === "paakirja" ? (
        <Paakirja accounts={await fetchGeneralLedger(restaurant.id, month)} />
      ) : null}

      {tab === "tilikartta" ? (
        <Tilikartta accounts={await fetchAccounts(restaurant.id)} />
      ) : null}

      {tab === "alv" ? <Alv vat={state.vat} /> : null}

      {tab === "veroasiat" ? (
        <Veroasiat guides={await fetchTaxGuides()} vat={state.vat} month={month} />
      ) : null}

      {tab === "raportit" ? (
        <Raportit
          income={await fetchIncomeStatement(restaurant.id, month, true)}
          balance={await fetchBalanceSheet(restaurant.id, month, true)}
          month={month}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function Yhteenveto({
  restaurantId,
  month,
  state,
  saaKirjata,
  onOmistaja,
}: {
  restaurantId: string;
  month: string;
  state: MonthState;
  saaKirjata: boolean;
  onOmistaja: boolean;
}) {
  /*
   * Yhteenvedon luvut näyttävät myös esitykset.
   *
   * Kesken kuukauden kirjaamattomat esitykset ovat suurin osa
   * summasta, ja pelkät kirjatut näyttäisivät nollaa vielä silloin
   * kun kuukausi on käytännössä valmis. Raportit-välilehti näyttää
   * saman ilman esityksiä, ja kumpikin kertoo kumpaa se näyttää.
   */
  const income = await fetchIncomeStatement(restaurantId, month, true);
  const issues = sortIssues(state.issues);

  return (
    <div className="space-y-5 md:space-y-6">
      <section
        aria-label="Kuukauden yhteenveto"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Myynti"
          icon={<RfIcon name="sales" size={17} />}
          tileTone="green"
          value={formatMoney(income?.revenueTotalCents ?? 0)}
          hint="Kirjanpidon tuotot"
        />
        <MetricCard
          label="Kulut"
          icon={<RfIcon name="expenses" size={17} />}
          tileTone="brand"
          value={formatMoney(income?.expenseTotalCents ?? 0)}
          hint="Kirjanpidon kulut"
        />
        <MetricCard
          label="Tulos"
          icon={<RfIcon name="trend" size={17} />}
          tileTone={(income?.resultCents ?? 0) >= 0 ? "green" : "bad"}
          tone={(income?.resultCents ?? 0) >= 0 ? "neutral" : "bad"}
          value={formatMoney(income?.resultCents ?? 0)}
          hint="Tuotot miinus kulut"
        />
        <MetricCard
          label="Tositteet"
          icon={<RfIcon name="report" size={17} />}
          tileTone={state.proposed > 0 ? "warn" : "muted"}
          tone={state.proposed > 0 ? "warn" : "neutral"}
          value={state.posted + state.proposed}
          hint={
            state.proposed > 0
              ? `${state.proposed} odottaa hyväksyntää`
              : "Kaikki kirjattu"
          }
        />
      </section>

      {/* Mitä sinun pitää tehdä */}
      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader
            title="Mitä sinun pitää tehdä"
            subtitle={
              issues.length === 0
                ? "Ei mitään — kuukausi on kunnossa"
                : "Ylimpänä se joka estää kuukauden sulkemisen"
            }
          />
        </div>

        {issues.length === 0 ? (
          <div className="px-5 pb-5">
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              Kaikki kuukauden tapahtumat on kirjattu ja täsmäytys menee läpi.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {issues.map((issue) => (
              <li key={issue.kind} className="flex items-start gap-3.5 px-5 py-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center"
                  style={{
                    background:
                      issue.severity === "critical"
                        ? "var(--rf-red-bg)"
                        : issue.severity === "warning"
                          ? "var(--rf-amber-bg)"
                          : "var(--rf-blue-bg)",
                    color:
                      issue.severity === "critical"
                        ? "var(--rf-red-text)"
                        : issue.severity === "warning"
                          ? "var(--rf-amber-text)"
                          : "var(--rf-blue-text)",
                    borderRadius: "50%",
                  }}
                >
                  <RfIcon
                    name={issue.severity === "critical" ? "alert" : "info"}
                    size={16}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{issue.title}</span>
                  <span
                    className="mt-0.5 block text-[13px] leading-relaxed"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {issue.detail}
                    {issue.differenceCents !== undefined
                      ? ` Erotus ${formatMoney(Math.abs(issue.differenceCents))}.`
                      : ""}
                  </span>
                </span>

                <span className="rf-tabular shrink-0 text-[13px] font-semibold">
                  {issue.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Toiminnot */}
      {saaKirjata ? (
        <Card>
          <CardHeader
            title="Hae ja kirjaa"
            subtitle="Budet lukee kuukauden kuitit ja myyntipäivät ja muodostaa kirjausesitykset"
          />

          <div className="mt-4 space-y-3">
            <SyncButton month={month} />
            <PostAllButton month={month} count={state.proposed} />
          </div>

          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            Haun voi tehdä niin monta kertaa kuin haluaa: sama tapahtuma ei
            kirjaudu kahdesti. Kesken oleva kuitti ja myyntipäivä jolta puuttuu
            tietoja jäävät odottamaan — Budet kertoo kumpi on kyseessä eikä
            arvaa puuttuvaa.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Näet kirjanpidon mutta et voi kirjata. Kirjaaminen on omistajan ja
            vuoropäällikön oikeus.
          </p>
        </Card>
      )}

      {/* Kuukauden sulku */}
      {onOmistaja && state.status !== "locked" ? (
        <Card>
          <CardHeader
            title="Sulje kuukausi"
            subtitle="Suljettuun kuukauteen ei voi kirjata ilman korjaustositetta"
          />
          <div className="mt-4">
            <CloseMonthForm month={month} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Sulkeminen ei onnistu jos täsmäytys ei mene läpi tai kirjausesityksiä
            on hyväksymättä. Painike kertoo kumpi estää.
          </p>
        </Card>
      ) : null}

      {state.status === "locked" ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
              <RfIcon name="check" size={20} />
            </span>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
              {monthLabel(month)} on suljettu. Tapahtumat säilyvät sellaisinaan;
              korjaus tehdään uudella tositteella joka viittaa alkuperäiseen.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Kuukauden valinta.
 *
 * Linkkejä eikä pudotusvalikkoa: valikko vaatisi JavaScriptin ja
 * lomakkeen lähetyksen, ja tässä riittää osoite.
 */
function KuukausiValitsin({
  month,
  tab,
  months,
}: {
  month: string;
  tab: string;
  months: string[];
}) {
  const nykyinenIndeksi = months.indexOf(month);
  const edellinen = months[nykyinenIndeksi + 1];
  const seuraava = nykyinenIndeksi > 0 ? months[nykyinenIndeksi - 1] : undefined;

  return (
    <div
      className="inline-flex items-center gap-1"
      style={{
        background: "var(--rf-inset)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <Siirto href={edellinen ? `/admin/kirjanpito?nakyma=${tab}&kuukausi=${edellinen}` : null} icon="back" label="Edellinen kuukausi" />
      <span className="rf-tabular px-2 text-[13px] font-semibold">{monthLabel(month)}</span>
      <Siirto href={seuraava ? `/admin/kirjanpito?nakyma=${tab}&kuukausi=${seuraava}` : null} icon="chevron" label="Seuraava kuukausi" />
    </div>
  );
}

function Siirto({
  href,
  icon,
  label,
}: {
  href: string | null;
  icon: "back" | "chevron";
  label: string;
}) {
  if (!href) {
    return (
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center"
        style={{ color: "var(--rf-text-3)", opacity: 0.35 }}
      >
        <RfIcon name={icon} size={15} />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rf-press flex h-8 w-8 items-center justify-center"
      style={{ color: "var(--rf-text-2)" }}
    >
      <RfIcon name={icon} size={15} />
    </Link>
  );
}
