import type { Metadata } from "next";
import { listRules, type RuleRow } from "@/lib/data/queries";
import { ENGINE_VERSION } from "@/lib/tax/engine";
import { formatRate } from "@/lib/money";
import { Notice, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Säännöt" };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  demo: { label: "Demo", cls: "bg-gold-100 text-gold-600 border-gold-400/50" },
  draft: { label: "Luonnos", cls: "bg-navy-100 text-navy-700 border-navy-200" },
  review: { label: "Arvioitavana", cls: "bg-warn-100 text-warn-600 border-warn-500/30" },
  validated: { label: "Validoitu", cls: "bg-ok-100 text-ok-600 border-ok-500/30" },
  active: { label: "Käytössä", cls: "bg-ok-100 text-ok-600 border-ok-500/30" },
  deprecated: { label: "Poistettu", cls: "bg-risk-100 text-risk-600 border-risk-500/30" },
};

const CATEGORY_LABELS: Record<string, string> = {
  vat: "ALV",
  deductibility: "Vähennyskelpoisuus",
  mileage: "Kilometrikorvaus",
  per_diem: "Päiväraha",
};

/**
 * Sääntöselain (§12, §43).
 *
 * Vain luku. Sääntöjen julkaisu ja versiointi kuuluu admin-paneeliin, jota
 * ei ole vielä toteutettu — mutta sen mukaan mitä moottori ajaa, käyttäjän
 * on voitava nähdä nyt.
 */
export default async function RulesPage() {
  const result = await listRules();
  const rules = result.ok ? result.data : [];

  const byCategory = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    byCategory.set(rule.category, [...(byCategory.get(rule.category) ?? []), rule]);
  }

  const demoCount = rules.filter((r) => r.status === "demo").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Säännöt</h1>
        <p className="mt-1 text-sm text-muted">
          {rules.length} sääntöversiota · moottori {ENGINE_VERSION}
        </p>
      </div>

      {demoCount > 0 ? (
        <Notice tone="warn" title={`${demoCount} sääntöä on demo-tasoisia`}>
          Demo-sääntöä ei ole validoitu virallista lähdettä vasten. Moottori
          merkitsee jokaisen niillä tehdyn päätöksen tarkistettavaksi. Kun
          sääntö validoidaan, sille luodaan uusi versio — vanhaa ei muokata,
          jotta aiempi päätös pysyy toistettavana.
        </Notice>
      ) : null}

      {[...byCategory.entries()].map(([category, items]) => (
        <Panel key={category} title={CATEGORY_LABELS[category] ?? category}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">
                {CATEGORY_LABELS[category] ?? category} -säännöt
              </caption>
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium">Sääntö</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Versio</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Tila</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Prio</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Voimassa</th>
                  <th scope="col" className="py-2 font-medium">Vaikutus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((rule) => (
                  <tr key={`${rule.ruleId}-${rule.version}`} className="align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{rule.name}</p>
                      <p className="font-mono text-xs text-muted">{rule.ruleId}</p>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{rule.version}</td>
                    <td className="py-2.5 pr-3">
                      <StatusPill status={rule.status} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular">{rule.priority}</td>
                    <td className="py-2.5 pr-3 text-xs tabular">
                      {rule.effectiveFrom}
                      {rule.effectiveTo ? ` – ${rule.effectiveTo}` : " –"}
                    </td>
                    <td className="py-2.5">
                      <Effect actions={rule.actions} />
                      {rule.legalReference ? (
                        <p className="mt-1 text-xs text-ok-600">{rule.legalReference}</p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">ei validoitua lähdettä</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? {
    label: status,
    cls: "bg-navy-100 text-navy-700 border-navy-200",
  };
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

/** Näyttää säännön vaikutuksen ihmisluettavana, ei raakana JSONina. */
function Effect({ actions }: { actions: Record<string, unknown> }) {
  const parts: string[] = [];

  if (typeof actions.vatCode === "string") parts.push(actions.vatCode);
  if (typeof actions.vatRate === "number") parts.push(formatRate(actions.vatRate));
  if (actions.reverseCharge === true) parts.push("käännetty verovelvollisuus");
  if (actions.deductible === false) parts.push("ei vähennyskelpoinen");
  if (actions.requiresReview === true) parts.push("aina tarkistukseen");
  if (typeof actions.rateCents === "number") {
    parts.push(`${(actions.rateCents / 100).toFixed(2).replace(".", ",")} € / km`);
  }
  if (typeof actions.partialCents === "number" && typeof actions.fullCents === "number") {
    parts.push(
      `osa ${(actions.partialCents / 100).toFixed(2).replace(".", ",")} € · ` +
        `koko ${(actions.fullCents / 100).toFixed(2).replace(".", ",")} €`,
    );
  }

  return <span className="text-sm">{parts.length > 0 ? parts.join(" · ") : "—"}</span>;
}
