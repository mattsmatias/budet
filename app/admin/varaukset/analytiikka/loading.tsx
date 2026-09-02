import { LoadingLabel } from "@/components/restoflow/loading-label";

/**
 * Analytiikan latausnäkymä.
 *
 * Luuranko on sen muotoinen kuin sivu: neljä mittaria, havainnot,
 * täyttöasteruudukko ja kolme korttia. Väärän muotoinen luuranko
 * hyppäyttää sivun siinä hetkessä kun luvut saapuvat.
 */
export default function ReservationStatsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <LoadingLabel />

      <div className="rf-skeleton-block h-9 w-64" />

      <div className="space-y-2">
        <div className="rf-skeleton-block h-7 w-52" />
        <div className="rf-skeleton-block h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rf-skeleton-block h-24" />
        ))}
      </div>

      <div className="rf-skeleton-block h-40" />
      <div className="rf-skeleton-block h-56" />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rf-skeleton-block h-64" />
        <div className="rf-skeleton-block h-64" />
      </div>

      <div className="rf-skeleton-block h-40" />
    </div>
  );
}
