import Link from "next/link";
import { type Labels } from "@/lib/i18n/labels";
import { RfIcon } from "@/components/restoflow/icons";
import { type Shift } from "@/lib/restoflow/types";
import { Empty, Surface, Tag, shortDay } from "../ui";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { WorkerText } from "@/lib/i18n/worker-text";

/**
 * Seuraava työvuoro.
 *
 * Kompakti eikä hallitseva: leimauskortti on tämän näkymän pääasia, ja
 * kaksi yhtä suurta elementtiä tarkoittaisi ettei kumpikaan ole
 * tärkeämpi. Tässä riittää päivä, kellonaika, paikka ja tila.
 *
 * Pinta ja tilamerkintä tulevat jaetusta kirjastosta, jotta tämä
 * näyttää samalta kuin Vuorot-sivun rivit.
 */
export function NextShift({
  nimet,
  shift,
  today,
  t,
  locale,
}: {
  nimet: Labels;
  shift: Shift | null;
  today: string;
  t: WorkerText;
  locale: AppLocale;
}) {
  if (!shift) {
    return (
      <Empty
        title={t.koti.nextShiftEmpty}
        description={t.koti.nextShiftEmptyBody}
      />
    );
  }

  return (
    <Link href="/app/vuorot" className="rf-press block">
      <Surface>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {shift.date === today
                ? t.yleinen.today
                : shortDay(shift.date, locale)}
            </p>
            <p className="rf-tabular mt-0.5 text-[20px] font-semibold tracking-tight">
              {shift.startTime}–{shift.endTime}
            </p>
            {shift.location ? (
              <p
                className="mt-0.5 truncate text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {shift.location}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {shift.status === "accepted" ? (
              <Tag tone="ok">
                <RfIcon name="check" size={12} />
                {t.vuorot.confirmed}
              </Tag>
            ) : (
              <Tag tone={shift.status === "changed" ? "info" : "neutral"}>
                {nimet.shiftStatus[shift.status]}
              </Tag>
            )}
            <span style={{ color: "var(--rf-text-3)" }}>
              <RfIcon name="chevron" size={16} />
            </span>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
