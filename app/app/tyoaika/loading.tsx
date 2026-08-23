import { HeaderSkeleton, ListSkeleton } from "../ui";

/** Työaika-sivun luuranko: kaksi yhteenvetoa ja historialista. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <HeaderSkeleton />

      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((box) => (
          <div
            key={box}
            className="px-4 py-3.5"
            style={{
              background: "var(--rf-card)",
              border: "1px solid var(--rf-line)",
              borderRadius: 14,
            }}
          >
            <div className="rf-skeleton-block h-3.5 w-24" />
            <div className="rf-skeleton-block mt-2 h-6 w-20" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="rf-skeleton-block mx-1 h-3 w-20" />
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}
