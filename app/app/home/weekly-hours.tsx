import { formatDuration } from "@/lib/restoflow/timeclock";
import type { WorkerText } from "@/lib/i18n/worker-text";

/**
 * Viikon työaika.
 *
 * Ei korttia vaan rivi. Luku on tärkeä muttei toiminto, ja jokainen
 * laatikko vie huomiota siltä joka on.
 *
 * TAVOITETUNTEJA EI KEKSITÄ.
 *
 * Kate ei tiedä työsopimuksen tuntimäärää, joten edistymispalkkia ei
 * ole. Keksitty 37,5 tuntia näyttäisi tavoitteelta jota kukaan ei ole
 * asettanut, ja osa-aikaiselle se olisi väärä joka viikko.
 */
export function WeeklyHours({
  workedMs,
  t,
}: {
  workedMs: number;
  t: WorkerText;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p
        className="text-[12px] font-semibold uppercase"
        style={{ letterSpacing: "0.07em", color: "var(--rf-text-3)" }}
      >
        {t.yleinen.thisWeek}
      </p>
      <p
        className="rf-tabular text-[20px] font-semibold"
        suppressHydrationWarning
      >
        {formatDuration(workedMs)}
      </p>
    </div>
  );
}
