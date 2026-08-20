import type { Metadata } from "next";
import { getAppMode } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { formatMoney } from "@/lib/money";
import { EmptyState, Notice, Panel } from "@/components/ui";
import { ModeNotice } from "@/components/mode-notice";
import { TripForm } from "./form";

export const metadata: Metadata = { title: "Matkat" };

interface TripRow {
  id: string;
  trip_date: string;
  origin: string | null;
  destination: string | null;
  purpose: string | null;
  kilometers: number | null;
  mileage_rule_id: string | null;
  mileage_rule_version: string | null;
  total_reimbursement_cents: number;
}

export default async function TripsPage() {
  const mode = await getAppMode();
  const trips = mode.kind === "live" ? await loadTrips(mode.org.id) : [];

  const total = trips.reduce((s, t) => s + t.total_reimbursement_cents, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Matkat</h1>
        <p className="mt-1 text-sm text-muted">
          {trips.length} matkaa · {formatMoney(total)} korvauksia
        </p>
      </div>

      <ModeNotice mode={mode} />

      <Notice tone="warn" title="Kilometrikorvaus ja päiväraha ovat demo-arvoja">
        Arvot on versioitu samalla tavalla kuin ALV-säännöt, mutta niitä ei ole
        validoitu Verohallinnon voimassa olevaa päätöstä vasten. Tarkista ne
        ennen kuin käytät laskelmaa oikeaan matkalaskuun.
      </Notice>

      <TripForm enabled={mode.kind === "live"} />

      {trips.length === 0 ? (
        <EmptyState
          title="Ei kirjattuja matkoja"
          description={
            mode.kind === "live"
              ? "Kuvaile matka yllä olevaan kenttään omin sanoin."
              : "Kirjaudu sisään kirjataksesi matkoja."
          }
        />
      ) : (
        <Panel title="Kirjatut matkat">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Kirjatut matkat</caption>
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium">Päivä</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Reitti</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tarkoitus</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">km</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sääntö</th>
                  <th scope="col" className="py-2 text-right font-medium">Korvaus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular">
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 pr-3">{t.trip_date}</td>
                    <td className="py-2.5 pr-3">
                      {t.origin && t.destination
                        ? `${t.origin} → ${t.destination}`
                        : (t.origin ?? t.destination ?? "—")}
                    </td>
                    <td className="py-2.5 pr-3">{t.purpose ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right">{t.kilometers ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted">
                      {t.mileage_rule_id
                        ? `${t.mileage_rule_id} v${t.mileage_rule_version}`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {formatMoney(t.total_reimbursement_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

async function loadTrips(orgId: string): Promise<TripRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("trips")
      .select(
        "id, trip_date, origin, destination, purpose, kilometers, mileage_rule_id, mileage_rule_version, total_reimbursement_cents",
      )
      .eq("org_id", orgId)
      .order("trip_date", { ascending: false })
      .limit(100);

    return (data ?? []) as unknown as TripRow[];
  } catch {
    return [];
  }
}
