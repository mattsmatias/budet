import Link from "next/link";
import { OPEN_SHIFTS, RECEIPTS, SHIFTS, userById } from "@/lib/restoflow/data";
import { needsReview, reviewReasonCounts } from "@/lib/restoflow/expenses";
import {
  POSITION_LABELS, REVIEW_REASON_LABELS } from "@/lib/restoflow/types";
import { Card, DemoNotice, Icon, ICONS, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Ilmoitukset" };

/**
 * Ilmoitukset.
 *
 * Ei erillistä ilmoitustaulua: nämä johdetaan tilasta. Ilmoitus joka ei
 * vastaa mitään todellista tilaa jäisi roikkumaan senkin jälkeen kun asia
 * on hoidettu.
 */
export default function NotificationsPage() {
  const review = needsReview(RECEIPTS);
  const reasons = reviewReasonCounts(RECEIPTS);
  const pendingShifts = SHIFTS.filter((s) => s.status === "pending");
  const changedShifts = SHIFTS.filter((s) => s.status === "changed");

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
      title: `${userById(s.userId)?.name ?? "Työntekijä"} — vuoro odottaa hyväksyntää`,
      body: `${formatShortDate(s.date)} · ${s.startTime}–${s.endTime}`,
      href: "/admin/tyovuorot",
      date: s.date,
    })),
    ...changedShifts.map((s) => ({
      id: `chg-${s.id}`,
      tone: "info" as const,
      icon: ICONS.calendar,
      title: `Vuoro muuttui — ${userById(s.userId)?.name ?? ""}`,
      body: `${s.previousStartTime}–${s.previousEndTime} → ${s.startTime}–${s.endTime}`,
      href: "/admin/tyovuorot",
      date: s.date,
    })),
    ...OPEN_SHIFTS.map((s) => ({
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
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Ilmoitukset</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {items.length} asiaa vaatii huomiota
        </p>
      </div>

      <DemoNotice>
        Ilmoitukset johdetaan aineiston tilasta. Sähköposti-ilmoitukset ja
        lukukuittaukset vaativat käyttäjätilit, joita ei ole vielä kytketty.
      </DemoNotice>

      {reasons.length > 0 ? (
        <Card>
          <h2 className="text-[16px] font-semibold">Miksi kuitit ovat jonossa</h2>
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
