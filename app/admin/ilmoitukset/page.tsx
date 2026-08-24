import { adminContext } from "@/lib/restoflow/page-context";
import Link from "next/link";
import { needsReview, reviewReasonCounts } from "@/lib/restoflow/expenses";
import {
  POSITION_LABELS, REVIEW_REASON_LABELS } from "@/lib/restoflow/types";
import { Card, ScopeNotice, Icon, ICONS, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Ilmoitukset" };

/**
 * Ilmoitukset.
 *
 * Ei erillistä ilmoitustaulua: nämä johdetaan tilasta. Ilmoitus joka ei
 * vastaa mitään todellista tilaa jäisi roikkumaan senkin jälkeen kun asia
 * on hoidettu.
 */
export default async function NotificationsPage() {
  const {
    receipts, users, shifts, openShifts,
  } = await adminContext("/admin/ilmoitukset");

  const review = needsReview(receipts);
  const reasons = reviewReasonCounts(receipts);
  const pendingShifts = shifts.filter((s) => s.status === "pending");
  const changedShifts = shifts.filter((s) => s.status === "changed");

  const items = [
    ...review.map((r) => ({
      id: `rcp-${r.id}`,
      tone: "warn" as const,
      icon: ICONS.receipt,
      title: `${r.supplierName} odottaa tarkistusta`,
      body: r.reviewReasons.map((x) => REVIEW_REASON_LABELS[x]).join(" · "),
      href: `/admin/kuitit?korosta=${r.id}`,
      date: r.date,
    })),
    ...pendingShifts.map((s) => ({
      id: `shift-${s.id}`,
      tone: "info" as const,
      icon: ICONS.calendar,
      title: `${users.find((u) => u.id === s.userId)?.name ?? "Työntekijä"} — vuoro odottaa hyväksyntää`,
      body: `${formatShortDate(s.date)} · ${s.startTime}–${s.endTime}`,
      href: "/admin/tyovuorot",
      date: s.date,
    })),
    ...changedShifts.map((s) => ({
      id: `chg-${s.id}`,
      tone: "info" as const,
      icon: ICONS.calendar,
      title: `Vuoro muuttui — ${users.find((u) => u.id === s.userId)?.name ?? ""}`,
      body: `${s.previousStartTime}–${s.previousEndTime} → ${s.startTime}–${s.endTime}`,
      href: "/admin/tyovuorot",
      date: s.date,
    })),
    ...openShifts.map((s) => ({
      id: `open-${s.id}`,
      tone: "risk" as const,
      icon: ICONS.alert,
      title: `Avoin vuoro ${formatShortDate(s.date)}`,
      body: `${s.startTime}–${s.endTime} · ${POSITION_LABELS[s.position]} — ei tekijää`,
      href: "/admin/tyovuorot",
      date: s.date,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {items.length} asiaa vaatii huomiota
        </p>
      </div>

      <ScopeNotice>
        Ilmoitukset johdetaan aineiston tilasta joka latauksella, eikä niitä
        tallenneta. Kun asia on hoidettu, ilmoitus katoaa itsestään —
        tallennettu ilmoitus jäisi roikkumaan korjauksen jälkeenkin.
      </ScopeNotice>

      {reasons.length > 0 ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">Miksi kuitit ovat jonossa</h2>
          <ul className="mt-3 space-y-2">
            {reasons.map(({ reason, count }) => (
              <li key={reason} className="flex items-baseline justify-between gap-4 text-[14px]">
                <span style={{ color: "var(--rf-text-2)" }}>
                  {REVIEW_REASON_LABELS[reason]}
                </span>
                <span className="rf-tabular font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-start gap-3.5 px-5 py-4">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center"
                  style={{
                    background:
                      item.tone === "warn"
                        ? "var(--rf-amber-bg)"
                        : item.tone === "risk"
                          ? "var(--rf-red-bg)"
                          : "var(--rf-blue-bg)",
                    color:
                      item.tone === "warn"
                        ? "var(--rf-amber-text)"
                        : item.tone === "risk"
                          ? "var(--rf-red-text)"
                          : "var(--rf-blue-text)",
                    borderRadius: "50%",
                  }}
                >
                  <Icon path={item.icon} size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                    {item.body}
                  </p>
                </div>

                <Pill tone={item.tone}>
                  {item.tone === "risk" ? "avoin" : item.tone === "warn" ? "tarkista" : "info"}
                </Pill>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}
