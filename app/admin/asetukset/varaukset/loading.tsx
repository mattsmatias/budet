import { LoadingLabel } from "@/components/restoflow/loading-label";

/**
 * Varausasetusten latausnäkymä.
 *
 * Sivu hakee seitsemän taulua rinnakkain. Luuranko on kahdeksan
 * korttia, koska niin monta osiota siellä on — ja väärän korkuinen
 * luuranko hyppäyttää sivun kun oikea sisältö saapuu.
 */
export default function ReservationSettingsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <LoadingLabel />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton-block h-7 w-44" />
          <div className="rf-skeleton-block h-4 w-64" />
        </div>
        <div className="rf-skeleton-block h-11 w-44" />
      </div>

      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="rf-skeleton-block h-40" />
      ))}
    </div>
  );
}
