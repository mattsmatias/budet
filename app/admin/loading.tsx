/**
 * Latausnäkymä hallintasivuille.
 *
 * Palvelinkomponentit hakevat tietonsa ennen renderöintiä, joten
 * näkymän vaihto näytti pysähdykseltä: vanha sivu jäi ruutuun eikä
 * mikään kertonut että uutta ollaan hakemassa.
 *
 * LUURANGON ON OLTAVA SIVUN MUOTOINEN.
 *
 * Muuten sisältö hyppää paikalleen saapuessaan, ja hyppy on
 * häiritsevämpi kuin tyhjä ruutu olisi ollut. Tämä oli hetken
 * vanhan asettelun muotoinen — kaksi saraketta tasaleveinä ja
 * otsikkorivi vasemmalla — ja jokainen latautuminen päättyi
 * nytkähdykseen.
 *
 * Mitat ovat silti karkeita. Pikselintarkka jäljitelmä lupaisi
 * enemmän kuin tietää: korttien korkeus riippuu siitä mitä niissä on.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-5 md:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      {/*
        Neljä avainlukua.

        Kuukausivalitsin oli tässä omalla rivillään. Se siirtyi
        yläpalkkiin, ja luuranko jäi lupaamaan riviä jota ei enää
        tule — sisältö hyppäsi ylös joka latauksella.
      */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rf-skeleton-block h-[117px]" />
        ))}
      </div>

      {/* Kulujakauma ja kaavio: kapea vasemmalla, leveä oikealla */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="rf-skeleton-block h-[340px]" />
        <div className="rf-skeleton-block h-[340px]" />
      </div>

      {/* Huomiot ja kulurytmi samassa mitassa */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="rf-skeleton-block h-56" />
        <div className="rf-skeleton-block h-56" />
      </div>

      {/* Viimeisimmät kuitit */}
      <div className="rf-skeleton-block h-72" />
    </div>
  );
}
