/**
 * Työntekijänäkymän latausluuranko.
 *
 * Nolla tuntia ja sitten oikea luku olisi pahempi kuin ei mitään:
 * ensimmäinen näkymä olisi väärä tieto, ja työaika on juuri se asia
 * jonka käyttäjä tuli tarkistamaan. Luuranko kertoo että tieto on
 * tulossa eikä väitä sen olevan nolla.
 *
 * Muodot vastaavat oikeaa asettelua, jotta sisältö ei hyppää
 * paikoilleen.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <header className="space-y-2 px-1 pt-1">
        <div className="rf-skeleton-block h-7 w-44" />
        <div className="rf-skeleton-block h-4 w-28" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div
          className="bd-app-card px-5 py-6 sm:px-7 sm:py-7"
          style={{ borderRadius: "var(--bd-app-r-lg)" }}
        >
          <div className="rf-skeleton-block h-3.5 w-32" />
          <div className="rf-skeleton-block mt-3 h-3 w-20" />
          <div className="rf-skeleton-block mt-5 h-12 w-52" />
          <div className="rf-skeleton-block mt-6 h-[60px] w-full" style={{ borderRadius: "var(--bd-app-r-btn)" }} />
        </div>

        <div className="space-y-4">
          <Panel>
            <div className="rf-skeleton-block h-3 w-16" />
            <div className="rf-skeleton-block mt-2 h-5 w-32" />
            <div className="rf-skeleton-block mt-2 h-3 w-20" />
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <div className="rf-skeleton-block h-3 w-24" />
              <div className="rf-skeleton-block h-5 w-20" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rf-skeleton-block h-3 w-40" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-4 py-1">
            <div className="space-y-1.5">
              <div className="rf-skeleton-block h-4 w-20" />
              <div className="rf-skeleton-block h-3 w-28" />
            </div>
            <div className="rf-skeleton-block h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bd-app-card px-4 py-4">
      {children}
    </div>
  );
}
