import { LoadingLabel } from "@/components/restoflow/loading-label";

/**
 * Lounassivun latausnäkymä.
 *
 * Viikon haku on viisi kyselyä, ja ilman luurankoa viikkoa vaihtaessa
 * vanha viikko jäisi ruutuun kunnes uusi saapuu — mikä näyttää siltä
 * ettei painallus rekisteröitynyt.
 *
 * Muoto on viisi korttia, koska niin monta arkipäivää siellä aina on.
 */
export default function LunchLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <LoadingLabel kind="lounas" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton-block h-8 w-32" />
          <div className="rf-skeleton-block h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <div className="rf-skeleton-block h-10 w-36" />
          <div className="rf-skeleton-block h-10 w-28" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rf-skeleton-block h-[260px]" />
        ))}
      </div>

      <div className="rf-skeleton-block h-48" />
    </div>
  );
}
