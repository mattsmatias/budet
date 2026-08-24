import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { fetchDailySales } from "@/lib/restoflow/queries";
import { compareSales, type DailySales } from "@/lib/restoflow/sales";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";
import { SalesForm } from "./form";

export const metadata = { title: "Myynti" };

/**
 * Päivän myynti.
 *
 * Yksi luku päivässä, ja se on kaiken myyntiin liittyvän lähde:
 * yleiskuvan vertailu, työvoiman osuus, karkea tulos ja raportit.
 *
 * Sivu ei ole valikossa. Myynti kirjataan illan päätteeksi, ja tie
 * tänne on yleiskuvan kortti joka huomauttaa puuttuvasta päivästä —
 * valikkokohta muistuttaisi joka kerta myös silloin kun ei ole mitään
 * kirjattavaa.
 */
export default async function SalesPage() {
  const { restaurant, role, today } = await adminContext("/admin/myynti");

  const sales = await fetchDailySales(restaurant.id);
  const canManage = can(role, "sales.manage");

  const todayRow = sales.find((s) => s.date === today);
  const yesterday = addDays(today, -1);
  const missingYesterday = !sales.some((s) => s.date === yesterday);

  return (
    <div className="rf-stagger space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Päivän veroton myynti kassan päiväraportista
          </p>
        </div>
      </header>

      {canManage ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {todayRow ? "Muuta tämän päivän myyntiä" : "Kirjaa päivän myynti"}
          </h2>
          <SalesForm
            defaultDate={today}
            defaultNet={todayRow ? centsToInput(todayRow.netCents) : ""}
            defaultTarget={
              todayRow?.targetCents ? centsToInput(todayRow.targetCents) : ""
            }
          />
        </Card>
      ) : null}

      {/*
        Eilinen puuttuu useammin kuin tämä päivä: myynti kirjataan illan
        päätteeksi, ja unohtuminen huomataan vasta seuraavana aamuna.
      */}
      {canManage && missingYesterday ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-amber-text)" }}>
              <RfIcon name="alert" size={18} />
            </span>
            <div>
              <p className="text-[15px] font-medium">Eiliseltä puuttuu myynti</p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                {formatDay(yesterday)} on kirjaamatta. Ilman sitä viikon
                vertailut ja työvoiman osuus jäävät vajaiksi.
              </p>
              <div className="mt-3">
                <SalesForm defaultDate={yesterday} defaultNet="" defaultTarget="" compact />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <section>
        <h2 className="px-1 text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.05em", color: "var(--rf-text-3)" }}>
          Kirjatut päivät
        </h2>

        {sales.length === 0 ? (
          <Card className="mt-2">
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei vielä kirjattua myyntiä. Ensimmäisen päivän jälkeen Budet
              alkaa verrata päiviä toisiinsa.
            </p>
          </Card>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <Card padded={false}>
              <table className="rf-table w-full min-w-[34rem] text-[14px]">
                <thead>
                  <tr>
                    <th>Päivä</th>
                    <th className="text-right">Myynti</th>
                    <th className="text-right">Tavoite</th>
                    <th>Vertailu</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 30).map((row) => (
                    <Row key={row.date} row={row} history={sales} today={today} />
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </section>

      <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Veroton summa, koska työvoiman osuus myynnistä lasketaan siitä.
        Verollisella luvulla suhde olisi järjestelmällisesti liian pieni.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({
  row,
  history,
  today,
}: {
  row: DailySales;
  history: DailySales[];
  today: string;
}) {
  const comparison = compareSales(row, history);

  return (
    <tr className="border-b last:border-0" style={{ borderColor: "var(--rf-line)" }}>
      <td>
        {formatDay(row.date)}
        {row.date === today ? (
          <span className="ml-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            tänään
          </span>
        ) : null}
      </td>
      <td className="num">
        {formatMoney(row.netCents)}
      </td>
      <td className="rf-tabular px-5 py-3 text-right" style={{ color: "var(--rf-text-3)" }}>
        {row.targetCents ? formatMoney(row.targetCents) : "—"}
      </td>
      <td>
        {comparison.kind === "none" ? (
          <span className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            Ei vertailukohtaa
          </span>
        ) : (
          <Pill tone={comparison.ratio >= 1 ? "ok" : comparison.ratio >= 0.9 ? "warn" : "risk"}>
            {percent(comparison.ratio)}{" "}
            {comparison.kind === "target" ? "tavoitteesta" : "vs. sama viikonpäivä"}
          </Pill>
        )}
      </td>
    </tr>
  );
}

/** "+7 %" / "−9 %" */
function percent(ratio: number): string {
  const change = Math.round((ratio - 1) * 100);
  if (change === 0) return "tasan";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)} %`;
}

const DAYS = ["su", "ma", "ti", "ke", "to", "pe", "la"];

function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sentit lomakkeen tekstikenttään suomalaisittain. */
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
