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
import { CloseMonthForm, SyncButton } from "./controls";
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
 * Sivu ei ota vastaan myyntejä, kuitteja eikä kuluja, eikä se pyydä
 * hakemaan niitä. Kirjaus syntyy sillä hetkellä kun lähde
 * tallennetaan: kuitti tarkistetaan, ja se on kirjanpidossa.
 *
 * Tämä sivu on siis näkymä eikä työvaihe. Käyttäjän työ on tarkistaa
 * poikkeamat ja sulkea kuukausi — ei kopioida rivejä eikä painaa
 * painiketta joka tekee sen mikä on jo tehty.
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
      {/*
        Kuukausi on yläpalkissa eikä tässä.

        Sivulla oli oma valitsimensa ja yläpalkissa toinen — kaksi
        säädintä jotka näyttivät samaa kuukautta. Yläpalkin valitsin on
        jokaisella kuukausisivulla sama, joten se on oikea paikka; sivun
        oma olisi ollut poikkeus vain tällä sivulla.

        Tämä rivi kertoo siis vain määrät. Kuukauden nimen toistaminen
        säätimen alapuolella olisi ollut sama tieto kahdesti.
      */}
      <div className="rf-z-page relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {state.posted} kirjattua · {state.proposed} odottaa
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

  // Lahteet jotka eivat viela ole kirjanpidossa.
  const jaljessa = state.receiptsMissing + state.salesDaysMissing;

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
          /*
           * Nolla ei ole "kaikki kirjattu".
           *
           * Tyhjä kuukausi näytti samalta kuin valmis kuukausi: molemmissa
           * luki "Kaikki kirjattu". Ensimmäisessä ei ole kirjattu mitään,
           * eikä sitä saa kehua valmiiksi.
           */
          hint={
            state.posted + state.proposed === 0
              ? "Ei vielä kirjanpidossa"
              : state.proposed > 0
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
      {/*
        PAINIKE VAIN KUN SITÄ TARVITAAN.

        Kirjaus syntyy nyt sillä hetkellä kun kuitti tai päivän myynti
        tallennetaan, joten tavallisessa käytössä täällä ei ole mitään
        painettavaa. Painike joka ei tee mitään uutta opettaa
        painamaan sitä varmuuden vuoksi.

        Jäljessä olevat tapahtumat ovat poikkeus: kannassa oli dataa jo
        ennen automatiikkaa, ja tilikartan puuttuminen voi jättää
        yksittäisen tapahtuman odottamaan. Silloin painike on
        paikallaan ja se kertoo montako on kyseessä.
      */}
      {saaKirjata && jaljessa > 0 ? (
        <Card>
          {/*
            Syytä ei väitetä.

            Tapahtuma voi olla jäljessä kahdesta syystä: se on kirjattu
            ennen kuin kirjanpito otettiin käyttöön, tai siltä puuttuu
            tietoja. Kortti ei tiedä kumpi, joten se ei arvaa — "Mitä
            sinun pitää tehdä" kertoo sen tarkasti.
          */}
          <CardHeader
            title="Osa tapahtumista ei ole vielä kirjanpidossa"
            subtitle={`${jaljessa} ${jaljessa === 1 ? "tapahtuma odottaa" : "tapahtumaa odottaa"} · yritä hakea ne uudelleen`}
          />

          <div className="mt-4">
            <SyncButton month={month} />
          </div>

          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            Tavallisesti tätä ei tarvita: kirjaus syntyy itsestään kun
            tallennat kuitin tai päivän myynnin. Jos tapahtuma jää tähän
            haun jälkeenkin, siltä puuttuu tietoja — yllä lukee mitä.
          </p>
        </Card>
      ) : null}

      {!saaKirjata ? (
        <Card>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Näet kirjanpidon mutta et voi kirjata. Kirjaaminen on omistajan ja
            vuoropäällikön oikeus.
          </p>
        </Card>
      ) : null}

      {/* Kuukauden sulku */}
      {onOmistaja && state.status !== "locked" ? (
        <Card>
          <CardHeader
            title="Sulje kuukausi"
            subtitle={
              state.proposed > 0
                ? `Kirjaa ${state.proposed} ${state.proposed === 1 ? "tositteen" : "tositetta"} ja lukitsee kuukauden`
                : "Suljettuun kuukauteen ei voi kirjata ilman korjaustositetta"
            }
          />
          <div className="mt-4">
            <CloseMonthForm month={month} />
          </div>
          {/*
            Sulku kirjaa itse.

            Aiemmin sulku kieltäytyi jos esityksiä oli hyväksymättä, joten
            piti painaa ensin "Kirjaa kaikki" ja sitten "Sulje kuukausi".
            Ensimmäinen oli pelkkä esiehto toiselle, eikä esiehto ansaitse
            omaa painiketta. Täsmäytys estää yhä — se ei ole esiehto vaan
            syy olla sulkematta.
          */}
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Sulkeminen kirjaa kuukauden tositteet ja lukitsee ne. Se ei onnistu
            jos täsmäytys ei mene läpi — painike kertoo silloin mikä estää.
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
