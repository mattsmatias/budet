import { formatDuration } from "@/lib/restoflow/timeclock";

/**
 * Viikon työaika.
 *
 * Ei korttia vaan rivi. Luku on tärkeä muttei toiminto, ja jokainen
 * laatikko vie huomiota siltä joka on.
 *
 * TAVOITETUNTEJA EI KEKSITÄ.
 *
 * Budet ei tiedä työsopimuksen tuntimäärää, joten edistymispalkkia ei
 * ole. Keksitty 37,5 tuntia näyttäisi tavoitteelta jota kukaan ei ole
 * asettanut, ja osa-aikaiselle se olisi väärä joka viikko.
 */
export function WeeklyHours({ workedMs }: { workedMs: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p
        className="text-[12px] font-semibold uppercase"
        style={{ letterSpacing: "0.07em", color: "var(--rf-text-3)" }}
      >
        Tämä viikko
      </p>
      <p className="rf-tabular text-[20px] font-semibold" suppressHydrationWarning>
        {formatDuration(workedMs)}
      </p>
    </div>
  );
}
