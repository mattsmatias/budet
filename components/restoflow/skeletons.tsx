/**
 * Latausluurangot.
 *
 * LUURANGON ON OLTAVA SIVUN MUOTOINEN.
 *
 * Yksi luuranko koko hallinnalle oli yleiskatsauksen muotoinen, ja se
 * näkyi jokaisella alasivulla: neljä korttia ja kaksi kaaviota, sitten
 * nytkähdys johonkin aivan muuhun. Hyppy on häiritsevämpi kuin tyhjä
 * ruutu olisi ollut.
 *
 * Mitat ovat karkeita. Pikselintarkka jäljitelmä lupaisi enemmän kuin
 * tietää: korttien korkeus riippuu siitä mitä niissä on.
 */

function Rivi({ height }: { height: string }) {
  return <div className={`rf-skeleton-block ${height}`} />;
}

/** Otsikkorivi: kuvausteksti vasemmalla, painike oikealla. */
function Otsikko() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="rf-skeleton-block h-4 w-48" />
      <div className="rf-skeleton-block h-[39px] w-36" />
    </div>
  );
}

/**
 * Avainluvut ja lista.
 *
 * Kulut, Toimittajat, Budjetit ja Palkat alkavat kaikki korttirivillä
 * ja jatkuvat listalla tai taulukolla.
 */
export function CardsAndListSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-5 md:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <Otsikko />

      <div
        className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${
          cards === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"
        }`}
      >
        {Array.from({ length: cards }, (_, i) => (
          <Rivi key={i} height="h-[110px]" />
        ))}
      </div>

      <Rivi height="h-72" />
    </div>
  );
}

/** Pelkkä lista: Kuitit, Tehtävät, Toimintaloki. */
export function ListSkeleton({ cards = 0 }: { cards?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <Otsikko />

      {cards > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <Rivi key={i} height="h-[110px]" />
          ))}
        </div>
      ) : null}

      {/* Suodatinrivi ja haku ovat molemmilla listasivuilla. */}
      <div className="flex flex-wrap gap-2">
        {[64, 72, 88, 68, 76].map((w, i) => (
          <div
            key={i}
            className="rf-skeleton-block h-[30px]"
            style={{ width: w }}
          />
        ))}
      </div>

      <Rivi height="h-[42px]" />
      <Rivi height="h-96" />
    </div>
  );
}

/** Kaksi saraketta: asetukset ja muut valikkosivut. */
export function TwoColumnSkeleton() {
  return (
    <div className="rf-enter space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,244px)_minmax(0,1fr)] lg:gap-6">
        <Rivi height="h-[320px]" />
        <Rivi height="h-[420px]" />
      </div>
    </div>
  );
}

/** Kalenteriruudukko: työvuorot ja tehtävien kalenterinäkymä. */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <Otsikko />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Rivi key={i} height="h-[110px]" />
        ))}
      </div>

      <Rivi height="h-[520px]" />
    </div>
  );
}

/**
 * Yksityiskohtasivu: leveä sisältö ja kapea sivupalsta.
 *
 * Kuitin sivu on `lg:grid-cols-[1fr_20rem]`, joten luurangon on
 * jaettava ruutu samassa suhteessa. Tasaleveä jako lupaisi väärän
 * asettelun ja sisältö hyppäisi saapuessaan.
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <div className="rf-skeleton-block h-5 w-56" />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Rivi height="h-64" />
          <Rivi height="h-80" />
        </div>
        <Rivi height="h-[420px]" />
      </div>
    </div>
  );
}

/** Päällekkäiset kortit: myyntipäivä ja työntekijän palkkasivu. */
export function StackSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <div className="rf-skeleton-block h-5 w-56" />

      {Array.from({ length: cards }, (_, i) => (
        <Rivi key={i} height={i === 0 ? "h-56" : "h-44"} />
      ))}
    </div>
  );
}

/** Yksi leveä taulukko: kuukauden työvuorolista. */
export function TableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Ladataan…</span>

      <Otsikko />
      <Rivi height="h-[620px]" />
    </div>
  );
}

/** Kapea lomake keskellä: uusi kuitti. */
export function NarrowSkeleton() {
  return (
    <div
      className="mx-auto max-w-lg space-y-5"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Ladataan…</span>

      <div className="rf-skeleton-block h-5 w-40" />
      <Rivi height="h-72" />
      <Rivi height="h-24" />
    </div>
  );
}
