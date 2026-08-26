import Link from "next/link";
import { fetchAudit, fetchOverview, fetchRestaurants } from "@/lib/kehittaja/queries";
import { STATUS_LABELS, healthOf, statusTone } from "@/lib/kehittaja/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, EmptyState, MetricCard, Pill } from "@/components/restoflow/ui";

/*
 * absolute, koska title.template koskee lapsisegmenttejä eikä
 * segmentin omaa sivua: ilman tätä juurisivu perisi juurilayoutin
 * mallin ja lukisi "Yleiskatsaus · Budet" kuten ravintolan oma
 * yleiskatsaus.
 */
export const metadata = { title: { absolute: "Budet Developer Console" } };

/**
 * Järjestelmän yleiskatsaus.
 *
 * KYSYMYS ON "ONKO KAIKKI KUNNOSSA", EI "PALJONKO RIVEJÄ ON".
 *
 * Luvut ovat tässä siksi että niistä näkee poikkeaman: montako
 * kokeilua on päättymässä, montako asiakkuutta on keskeytettynä ja
 * ketkä eivät ole kirjautuneet pitkään aikaan. Pelkkä kokonaismäärä
 * ei kerro mitään jota kannattaisi tehdä.
 *
 * Testiravintolat on rajattu luvuista pois. Muuten omat kokeilut
 * kasvattaisivat asiakasmäärää eikä luku kertoisi liiketoiminnasta.
 */
export default async function DevOverviewPage() {
  const [overview, restaurants, audit] = await Promise.all([
    fetchOverview(),
    fetchRestaurants(),
    fetchAudit(6),
  ]);

  const now = new Date();

  /*
   * Huomiota vaativat asiakkuudet.
   *
   * Arkistoidut on rajattu pois: ne eivät ole aktiivisia eikä niiden
   * kuulukaan kirjautua. Testiravintolat samoin — ne ovat minun omia.
   */
  const huomio = restaurants
    .filter((r) => !r.isTestAccount && r.status !== "archived")
    .map((r) => ({ r, health: healthOf(r.lastSignInAt, r.status, now) }))
    .filter((x) => x.health.level !== "healthy")
    .sort((a, b) => Number(b.health.level === "risk") - Number(a.health.level === "risk"))
    .slice(0, 6);

  return (
    <div className="rf-stagger space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Budet System Overview</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {overview.restaurants.test === 0
              ? "Koko järjestelmä yhdellä silmäyksellä."
              : `Koko järjestelmä yhdellä silmäyksellä. Luvuista on rajattu pois ${
                  overview.restaurants.test === 1
                    ? "1 testiravintola"
                    : `${overview.restaurants.test} testiravintolaa`
                }.`}
          </p>
        </div>

        <Link
          href="/kehittaja/ravintolat/uusi"
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={15} />
          Luo ravintola
        </Link>
      </header>

      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Ravintolat"
          value={overview.restaurants.total}
          icon={<RfIcon name="suppliers" size={17} />}
          tileTone="brand"
          hint={`${overview.restaurants.active} aktiivista · ${overview.restaurants.trial} kokeilua`}
          href="/kehittaja/ravintolat"
          linkLabel="Kaikki"
        />

        <MetricCard
          label="Käyttäjät"
          value={overview.users.total}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="blue"
          hint={`${overview.users.owners} omistajaa · ${overview.users.managers} esihenkilöä · ${overview.users.employees} työntekijää`}
          href="/kehittaja/kayttajat"
          linkLabel="Kaikki"
        />

        {/*
          Keskeytetyt omana lukunaan.

          Se on ainoa tilaluku jonka takana on aina päätös: joku on
          katkaissut asiakkaan käytön, ja se pitää muistaa purkaa.
        */}
        <MetricCard
          label="Keskeytetyt"
          value={overview.restaurants.suspended}
          icon={<RfIcon name="alert" size={17} />}
          tone={overview.restaurants.suspended > 0 ? "warn" : "neutral"}
          tileTone={overview.restaurants.suspended > 0 ? "warn" : "muted"}
          hint={
            overview.restaurants.suspended === 0 ? "Ei keskeytyksiä" : "Käyttö on katkaistu"
          }
        />

        <MetricCard
          label="Aktiivisia tänään"
          value={overview.today.activeUsers}
          icon={<RfIcon name="trend" size={17} />}
          tileTone="green"
          hint={`${overview.restaurants.newToday} uutta ravintolaa · ${overview.today.newUsers} uutta käyttäjää`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/*
          Huomiota vaativat asiakkuudet.

          Tämä on koko sivun tarkoitus. Lista on lyhyt tarkoituksella:
          kuusi riviä luetaan, kolmekymmentä selataan.
        */}
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title="Huomiota vaativat asiakkuudet"
              subtitle={
                huomio.length === 0
                  ? "Kaikki näyttävät terveiltä"
                  : `${huomio.length} ${
                      huomio.length === 1 ? "asiakkuus" : "asiakkuutta"
                    } kannattaa tarkistaa`
              }
            />
          </div>

          {huomio.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                title="Ei huomautettavaa"
                description="Jokainen aktiivinen ravintola on kirjautunut viime aikoina eikä yhtään asiakkuutta ole keskeytetty."
              />
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {huomio.map(({ r, health }) => (
                <li key={r.id}>
                  <Link
                    href={`/kehittaja/ravintolat/${r.id}`}
                    className="rf-press flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{r.name}</span>
                      <span
                        className="mt-0.5 block truncate text-[12.5px]"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {health.reason}
                        {r.ownerName ? ` · ${r.ownerName}` : ""}
                      </span>
                    </span>

                    <Pill tone={health.level === "risk" ? "risk" : "warn"} dot>
                      {STATUS_LABELS[r.status]}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Asiakkuudet" subtitle="Tiloittain" />

            <ul className="mt-1 space-y-2">
              {(
                [
                  ["active", overview.restaurants.active],
                  ["trial", overview.restaurants.trial],
                  ["suspended", overview.restaurants.suspended],
                  ["cancelled", overview.restaurants.cancelled],
                  ["archived", overview.restaurants.archived],
                ] as const
              ).map(([status, count]) => {
                const tone = statusTone(status);
                return (
                  <li
                    key={status}
                    className="flex items-center justify-between gap-4 text-[13.5px]"
                  >
                    <Pill tone={tone === "muted" ? "info" : tone} dot>
                      {STATUS_LABELS[status]}
                    </Pill>
                    <span className="rf-tabular font-semibold">{count}</span>
                  </li>
                );
              })}
            </ul>

            {overview.trialsEndingSoon > 0 ? (
              <p
                className="mt-3 border-t pt-3 text-[12.5px]"
                style={{ borderColor: "var(--rf-line)", color: "var(--rf-amber-text)" }}
              >
                {overview.trialsEndingSoon === 1
                  ? "1 kokeilu päättyy viikon sisällä."
                  : `${overview.trialsEndingSoon} kokeilua päättyy viikon sisällä.`}
              </p>
            ) : null}
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-4">
              <CardHeader title="Viimeisimmät toimet" subtitle="Developer Consolen loki" />
            </div>

            {audit.length === 0 ? (
              <p className="px-5 pb-5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                Ei vielä yhtään merkintää.
              </p>
            ) : (
              <>
                <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                  {audit.map((row) => (
                    <li key={row.id} className="px-5 py-2.5">
                      <p className="text-[13px] leading-snug">{row.summary}</p>
                      <p
                        className="rf-tabular mt-0.5 text-[11.5px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {new Date(row.createdAt).toLocaleString("fi-FI", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="px-5 py-3">
                  <Link
                    href="/kehittaja/loki"
                    className="rf-press text-[12.5px] font-bold"
                    style={{ color: "var(--rf-accent)" }}
                  >
                    Koko loki →
                  </Link>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
