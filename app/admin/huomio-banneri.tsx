"use client";

import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { RfIcon } from "@/components/restoflow/icons";
import { severityColor } from "@/components/restoflow/ui";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { FocusItem } from "@/lib/restoflow/dashboard";
import { acknowledgeAlert } from "./actions";

/**
 * Huomio sillä sivulla jonne se vei.
 *
 * MIKSI TÄMÄ ON OLEMASSA.
 *
 * Ilmoituksesta pääsi sivulle, mutta sivu ei kertonut miksi sinne
 * tultiin. "ALV-tieto ei täsmää" vei kuittilistaan, jossa oli
 * kaksikymmentä kuittia eikä mitään merkkiä siitä mikä niistä oli se
 * josta huomautettiin — ja kun asia oli katsottu, huomio jäi silti
 * listalle seuraavaksi päiväksi.
 *
 * Banneri kertoo kumpaakin: mistä huomiosta on kyse ja mistä sen saa
 * pois. "Tarkistettu" ei korjaa mitään eikä väitä korjaavansa; se on
 * omistajan merkintä siitä että asia on katsottu.
 *
 * YKSI PAIKKA, EI KAHTAKYMMENTÄ.
 *
 * Banneri on kuoressa eikä jokaisella sivulla erikseen: huomioita on
 * kymmentä lajia ja ne vievät kymmeneen eri näkymään. Osoiterivin
 * ?huomio kertoo mistä on kyse, ja kuori löytää sen samasta listasta
 * jonka se muutenkin rakentaa.
 *
 * TEHTÄVILLE EI NÄYTETÄ.
 *
 * Tehtävä merkitään tehdyksi tehtävälistassa. Kaksi eri tapaa sulkea
 * sama asia tarkoittaisi kahta eri totuutta siitä onko lasku maksettu.
 */
export function HuomioBanneri({
  huomiot,
  month,
  canAck,
  t,
}: {
  huomiot: FocusItem[];
  /** Kuukausi jota kuittaus koskee, "2026-09". */
  month: string;
  /** Vain esihenkilö voi kuitata; muille banneri on pelkkä selitys. */
  canAck: boolean;
  t: AdminText;
}) {
  const params = useSearchParams();
  const id = params.get("huomio");
  if (!id) return null;

  const huomio = huomiot.find((h) => h.id === id);
  if (!huomio || huomio.id.startsWith("task-")) return null;

  const vari = severityColor(huomio.severity);

  return (
    <div
      className="rf-enter rf-no-print mb-4 flex flex-wrap items-start gap-3 px-4 py-3"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderInlineStart: `3px solid ${vari}`,
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: vari }}>
        <RfIcon name={huomio.icon} size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">{huomio.title}</p>
        <p
          className="mt-0.5 text-[12.5px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {huomio.detail}
        </p>
      </div>

      {canAck ? (
        <form action={acknowledgeAlert} className="shrink-0">
          <input type="hidden" name="alertId" value={huomio.id} />
          <input type="hidden" name="month" value={month} />
          <KuittausNappi label={t.loput.markChecked} />
        </form>
      ) : null}
    </div>
  );
}

function KuittausNappi({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press rf-touch inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
      style={{
        background: "var(--rf-inset)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
        color: "var(--rf-text)",
      }}
    >
      <RfIcon name="check" size={15} />
      {label}
    </button>
  );
}
