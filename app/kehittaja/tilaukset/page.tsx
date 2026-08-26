import Link from "next/link";
import { fetchRestaurants } from "@/lib/kehittaja/queries";
import { PLAN_LABELS, STATUS_LABELS, statusTone, type RestaurantPlan } from "@/lib/kehittaja/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, EmptyState, MetricCard, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Tilaukset" };

const PAKETIT: RestaurantPlan[] = ["free", "pro", "business", "enterprise"];

/**
 * Tilaukset ja paketit.
 *
 * LASKUTUS EI OLE TÄÄLLÄ.
 *
 * Budet ei säilytä maksukorttitietoja eikä laskurivejä — ne kuuluvat
 * maksupalvelulle, joka hoitaa myös vaatimustenmukaisuuden. Tässä on
 * vain se mitä Budetin pitää tietää: minkä tasoinen paketti kullakin
 * on ja milloin kokeilu päättyy.
 *
 * Paketti vaihdetaan ravintolan omalta sivulta, koska muutos koskee
 * yhtä asiakasta ja se pitää tehdä sen tiedot näkyvillä.
 */
export default async function DevPlansPage() {
  const restaurants = await fetchRestaurants();
  const elavat = restaurants.filter((r) => !r.isTestAccount && r.status !== "archived");

  const paketeittain = PAKETIT.map((plan) => ({
    plan,
    count: elavat.filter((r) => r.plan === plan).length,
  }));

  const today = new Date().toISOString().slice(0, 10);

  const kokeilut = elavat
    .filter((r) => r.status === "trial" && r.trialEndsOn)
    .sort((a, b) => (a.trialEndsOn ?? "").localeCompare(b.trialEndsOn ?? ""));

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Tilaukset</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Pakettien jakauma ja kokeilujen päättymiset. Laskutus hoidetaan
          maksupalvelussa — Budet säilyttää vain paketin tason.
        </p>
      </header>

      <section className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {paketeittain.map(({ plan, count }) => (
          <MetricCard
            key={plan}
            label={PLAN_LABELS[plan]}
            value={count}
            icon={<RfIcon name="budget" size={17} />}
            tileTone={
              plan === "enterprise"
                ? "violet"
                : plan === "business"
                  ? "blue"
                  : plan === "pro"
                    ? "brand"
                    : "muted"
            }
            hint={count === 1 ? "ravintola" : "ravintolaa"}
          />
        ))}
      </section>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader
            title="Kokeilut"
            subtitle={
              kokeilut.length === 0
                ? "Ei käynnissä olevia kokeiluja"
                : "Päättyvät ensin ylimpänä"
            }
          />
        </div>

        {kokeilut.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="Ei kokeiluja"
              description="Kokeilun voi aloittaa ravintolan Hallinta-välilehdeltä."
            />
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {kokeilut.map((r) => {
              const ohi = (r.trialEndsOn ?? "") < today;
              return (
                <li key={r.id}>
                  <Link
                    href={`/kehittaja/ravintolat/${r.id}?valilehti=hallinta`}
                    className="rf-press flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{r.name}</span>
                      <span className="block text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
                        {PLAN_LABELS[r.plan]} · {r.ownerName ?? "ei omistajaa"}
                      </span>
                    </span>

                    <Pill tone={ohi ? "risk" : "warn"} dot>
                      {ohi ? `Päättyi ${r.trialEndsOn}` : `Päättyy ${r.trialEndsOn}`}
                    </Pill>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader title="Kaikki asiakkuudet" subtitle="Paketti ja tila" />
        </div>

        <div className="overflow-x-auto">
          <table className="rf-table w-full" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th className="px-5 py-3 text-left">Ravintola</th>
                <th className="px-4 py-3 text-left">Paketti</th>
                <th className="px-4 py-3 text-left">Tila</th>
                <th className="px-5 py-3 text-right">Käyttäjiä</th>
              </tr>
            </thead>

            <tbody>
              {elavat.map((r) => {
                const tone = statusTone(r.status);
                return (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/kehittaja/ravintolat/${r.id}?valilehti=hallinta`}
                        className="rf-press font-semibold"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{PLAN_LABELS[r.plan]}</td>
                    <td className="px-4 py-3">
                      <Pill tone={tone === "muted" ? "info" : tone} dot>
                        {STATUS_LABELS[r.status]}
                      </Pill>
                    </td>
                    <td className="rf-tabular px-5 py-3 text-right">{r.userCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
