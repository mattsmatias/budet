import Link from "next/link";
import { fetchAudit } from "@/lib/kehittaja/queries";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";

export const metadata = { title: "Toimintaloki" };

/**
 * Toiminnon nimi luettavaksi.
 *
 * Kannassa nimi on koneluettava ('restaurant.status'), koska sen on
 * pysyttävä samana kun käännös muuttuu. Käännös on tässä eikä
 * kannassa: vanha rivi näyttää silloin uuden sanamuodon eikä lokia
 * tarvitse kirjoittaa uusiksi.
 */
const TOIMINNOT: Record<string, string> = {
  "restaurant.created": "Ravintola luotiin",
  "restaurant.updated": "Ravintolan tietoja muutettiin",
  "restaurant.status": "Tila muuttui",
  "restaurant.plan": "Paketti muuttui",
  "restaurant.deleted": "Ravintola poistettiin",
  "user.invited": "Kutsu luotiin",
  "user.activated": "Käyttäjä aktivoitiin",
  "user.deactivated": "Käyttäjä poistettiin käytöstä",
  "user.role": "Rooli muuttui",
  "flag.global": "Feature flag kaikille",
  "flag.restaurant": "Feature flag ravintolalle",
};

function ikoni(action: string) {
  if (action.startsWith("flag.")) return "settings" as const;
  if (action.startsWith("user.")) return "staff" as const;
  if (action === "restaurant.deleted") return "trash" as const;
  if (action === "restaurant.created") return "plus" as const;
  return "suppliers" as const;
}

/**
 * Super Adminin oma toimintaloki.
 *
 * ERI LOKI KUIN RAVINTOLAN OMA.
 *
 * Ravintolan Toimintaloki näyttää mitä ravintolassa on tehty ja se
 * näkyy ravintolan omistajalle. Tämä näyttää mitä minä olen tehnyt
 * järjestelmätasolla, usein useaan ravintolaan kerralla. Yhteen
 * lokiin yhdistettynä toisen ravintolan omistaja näkisi mitä
 * toiselle on tehty.
 *
 * Rivejä ei voi muuttaa eikä poistaa: taululla on vain
 * lukukäytäntö, joten RLS hylkää päivityksen ja poiston kaikilta —
 * myös ylläpitäjältä itseltään.
 */
export default async function DevAuditPage({
  searchParams,
}: PageProps<"/kehittaja/loki">) {
  const params = await searchParams;
  const maara = params.maara === "500" ? 500 : 100;

  const rows = await fetchAudit(maara);
  const kriittiset = rows.filter((r) => r.critical);

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Toimintaloki
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Järjestelmän ylläpitäjän toimet. Rivejä ei voi muuttaa eikä poistaa.
        </p>
      </header>

      <section className="grid auto-rows-fr grid-cols-2 gap-3.5 sm:grid-cols-3">
        <MetricCard
          label="Tapahtumia"
          value={rows.length}
          icon={<RfIcon name="report" size={17} />}
          tileTone="muted"
        />
        <MetricCard
          label="Kriittisiä"
          value={kriittiset.length}
          icon={<RfIcon name="alert" size={17} />}
          tileTone={kriittiset.length > 0 ? "warn" : "muted"}
          hint="Oikeudet, paketit, poistot"
        />
        <MetricCard
          label="Ravintoloita koskien"
          value={
            new Set(
              rows
                .filter((r) => r.targetType === "restaurant")
                .map((r) => r.targetId),
            ).size
          }
          icon={<RfIcon name="suppliers" size={17} />}
          tileTone="muted"
        />
      </section>

      <nav aria-label="Määrä" className="flex flex-wrap gap-1.5">
        {[100, 500].map((n) => {
          const active = maara === n;
          return (
            <Link
              key={n}
              href={
                n === 100 ? "/kehittaja/loki" : `/kehittaja/loki?maara=${n}`
              }
              aria-current={active ? "page" : undefined}
              className="rf-press px-3 py-1.5 text-[12.5px]"
              style={{
                background: active
                  ? "var(--rf-accent-soft)"
                  : "var(--rf-inset)",
                color: active ? "var(--rf-accent)" : "var(--rf-text-2)",
                fontWeight: active ? 700 : 500,
                borderRadius: 980,
              }}
            >
              Viimeisimmät {n}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei vielä merkintöjä"
            description="Loki täyttyy kun luot ravintoloita, muutat tiloja tai hallitset käyttäjiä."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader title="Tapahtumat" subtitle="Uusin ensin" />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3.5 px-5 py-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center"
                  style={{
                    background: row.critical
                      ? "var(--rf-amber-bg)"
                      : "var(--rf-inset)",
                    color: row.critical
                      ? "var(--rf-amber-text)"
                      : "var(--rf-text-3)",
                    borderRadius: 999,
                  }}
                >
                  <RfIcon name={ikoni(row.action)} size={15} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug">
                    {row.summary}
                  </span>

                  <span
                    className="rf-tabular mt-0.5 block text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {new Date(row.createdAt).toLocaleString("fi-FI", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {row.actorEmail ?? "tuntematon"}
                    {" · "}
                    {TOIMINNOT[row.action] ?? row.action}
                  </span>
                </span>

                {row.targetType === "restaurant" && row.targetId ? (
                  <Link
                    href={`/kehittaja/ravintolat/${row.targetId}`}
                    className="rf-press shrink-0 text-[12.5px] font-bold"
                    style={{ color: "var(--rf-accent)" }}
                  >
                    Avaa →
                  </Link>
                ) : row.critical ? (
                  <Pill tone="warn" dot>
                    kriittinen
                  </Pill>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
