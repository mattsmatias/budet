import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { labels } from "@/lib/i18n/labels";
import { adminContext } from "@/lib/restoflow/page-context";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { alertIcon } from "@/lib/restoflow/alert-icons";
import { needsReview, reviewReasonCounts } from "@/lib/restoflow/expenses";
import { type Alert } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Ilmoitukset" };

/**
 * Ilmoitukset.
 *
 * YKSI LÄHDE, EI KAHTA.
 *
 * Tämä sivu kokosi aiemmin oman listansa suoraan aineistosta: neljä
 * tyyppiä käsin poimittuna. Kellon merkki taas laski buildAlertsin
 * kaikki tyypit. Luvut eivät siis täsmänneet keskenään, ja
 * tehtävien määräajat puuttuivat tältä sivulta kokonaan vaikka ne
 * nostivat merkkiä.
 *
 * Nyt molemmat lukevat samaa funktiota. Uusi hälytystyyppi ilmestyy
 * tänne itsestään eikä sitä tarvitse muistaa lisätä kahteen paikkaan.
 *
 * EI ERILLISTÄ ILMOITUSTAULUA.
 *
 * Ilmoitukset johdetaan tilasta joka latauksella. Tallennettu
 * ilmoitus jäisi roikkumaan senkin jälkeen kun asia on hoidettu.
 */
export default async function NotificationsPage() {
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const data = await adminContext("/admin/ilmoitukset");

  const alerts = buildAlerts({
    receipts: data.receipts,
    budgets: data.budgets,
    shifts: data.shifts,
    users: data.users,
    clockEvents: data.clockEvents,
    absences: data.absences,
    month: data.month,
    today: data.today,
    now: data.now,
    timezone: data.restaurant.timezone,
    locale,
    openShifts: data.openShifts,
    sales: data.sales,
    tasks: data.tasks,
  });

  const critical = alerts.filter((alert) => alert.severity === "critical");
  const rest = alerts.filter((alert) => alert.severity !== "critical");

  const reasons = reviewReasonCounts(data.receipts);
  const review = needsReview(data.receipts);

  return (
    <div className="rf-enter space-y-5">
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {alerts.length === 0
          ? "Ei mitään huomautettavaa"
          : `${alerts.length} ${alerts.length === 1 ? "asia" : "asiaa"} vaatii huomiota` +
            (critical.length > 0 ? ` · ${critical.length} kiireellistä` : "")}
      </p>

      {alerts.length === 0 ? (
        <EmptyState
          title="Kaikki kunnossa"
          description="Kuitit on käsitelty, vuoroilla on tekijät eikä määräaikoja ole ohitettu. Ilmoitukset ilmestyvät tähän itsestään kun jotain vaatii huomiota."
        />
      ) : (
        <>
          {/*
            Kiireelliset omana ryhmänään.

            Lista luetaan ylhäältä ja se katkeaa siihen mihin aika
            loppuu. Silloin ylimmäisenä on oltava se joka pitää
            selvittää tänään.
          */}
          {critical.length > 0 ? (
            <Ryhma
              title="Vaatii huomiota nyt"
              subtitle="Nämä eivät odota huomiseen"
              alerts={critical}
            />
          ) : null}

          {rest.length > 0 ? (
            <Ryhma
              title="Muut huomiot"
              subtitle="Hoidettavissa kun ehtii"
              alerts={rest}
            />
          ) : null}
        </>
      )}

      {/*
        Kuittijonon syyt erikseen.

        Yksittäinen "odottaa tarkistusta" ei kerro mistä jono johtuu.
        Syiden määrät kertovat, ja niistä näkee onko kyse yhdestä
        toistuvasta puutteesta vai monesta eri asiasta.
      */}
      {reasons.length > 0 ? (
        <Card>
          <CardHeader
            title="Miksi kuitit ovat jonossa"
            subtitle={`${review.length} ${review.length === 1 ? "kuitti" : "kuittia"} odottaa tarkistusta`}
          />
          <ul className="space-y-2">
            {reasons.map(({ reason, count }) => (
              <li
                key={reason}
                className="flex items-baseline justify-between gap-4 text-[13.5px]"
              >
                <span style={{ color: "var(--rf-text-2)" }}>
                  {nimet.reviewReasons[reason]}
                </span>
                <span className="rf-tabular font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        Ilmoitukset johdetaan aineiston tilasta joka latauksella, eikä niitä
        tallenneta. Kun asia on hoidettu, ilmoitus katoaa itsestään.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Ryhma({
  title,
  subtitle,
  alerts,
}: {
  title: string;
  subtitle: string;
  alerts: Alert[];
}) {
  return (
    <Card padded={false}>
      <div className="px-5 pt-4">
        <CardHeader title={title} subtitle={subtitle} />
      </div>

      <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className="rf-press flex items-start gap-3.5 px-5 py-3.5"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center"
                style={{
                  background:
                    alert.severity === "critical"
                      ? "var(--rf-red-bg)"
                      : alert.severity === "warning"
                        ? "var(--rf-amber-bg)"
                        : "var(--rf-blue-bg)",
                  color:
                    alert.severity === "critical"
                      ? "var(--rf-red-text)"
                      : alert.severity === "warning"
                        ? "var(--rf-amber-text)"
                        : "var(--rf-blue-text)",
                  borderRadius: "50%",
                }}
              >
                <RfIcon name={alertIcon(alert.kind)} size={16} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">
                  {alert.title}
                </span>
                <span
                  className="mt-0.5 block text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {alert.detail}
                </span>
              </span>

              <span className="shrink-0">
                <Pill
                  tone={
                    alert.severity === "critical"
                      ? "risk"
                      : alert.severity === "warning"
                        ? "warn"
                        : "info"
                  }
                  dot
                >
                  {alert.severity === "critical"
                    ? "kiireellinen"
                    : alert.severity === "warning"
                      ? "tarkista"
                      : "info"}
                </Pill>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
