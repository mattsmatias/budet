/**
 * Latausnäkymä hallintasivuille.
 *
 * Palvelinkomponentit hakevat tietonsa ennen renderöintiä, joten
 * näkymän vaihto näytti pysähdykseltä: vanha sivu jäi ruutuun eikä
 * mikään kertonut että uutta ollaan hakemassa. Luuranko kertoo sen —
 * ja se on sivun oikean muotoinen, joten sisältö ei hyppää paikalleen
 * kun se saapuu.
 *
 * Muoto on tarkoituksella karkea. Pikselintarkka jäljitelmä lupaisi
 * enemmän kuin tietää: sivulla voi olla kolme korttia tai kymmenen.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-5 md:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      {/* Otsikko */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton-block h-7 w-56" />
          <div className="rf-skeleton-block h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <div className="rf-skeleton-block h-10 w-36" />
          <div className="rf-skeleton-block h-10 w-32" />
        </div>
      </div>

      {/* Avainluvut */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rf-skeleton-block h-[124px]" />
        ))}
      </div>

      {/* Laaja osio */}
      <div className="rf-skeleton-block h-28" />

      {/* Kaksi palstaa */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rf-skeleton-block h-64" />
        <div className="rf-skeleton-block h-64" />
      </div>
    </div>
  );
}
