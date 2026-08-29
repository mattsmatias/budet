import { HeaderSkeleton } from "../ui";

/** Vuorot-sivun luuranko: viikkolista seitsemällä rivillä. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <HeaderSkeleton />

      <div className="space-y-2">
        <div className="rf-skeleton-block mx-1 h-3 w-24" />

        <div className="bd-app-card">
          <div
            className="bd-app-list divide-y"
            style={{ borderColor: "var(--rf-line)" }}
          >
            {Array.from({ length: 7 }, (_, row) => (
              <div key={row} className="flex items-center gap-3 px-4 py-3">
                <div className="w-[3.25rem] shrink-0 space-y-1">
                  <div className="rf-skeleton-block h-3.5 w-7" />
                  <div className="rf-skeleton-block h-3 w-9" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="rf-skeleton-block h-4 w-28" />
                </div>
                <div className="rf-skeleton-block h-6 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
