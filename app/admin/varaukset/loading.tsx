import { LoadingLabel } from "@/components/restoflow/loading-label";

/**
 * Salinäkymän latausnäkymä.
 *
 * Vapaiden aikojen haku käy koko päivän aikavälit läpi ja kysyy
 * jokaisesta onko pöytää, joten päivää vaihtaessa on hetki jolloin
 * mitään ei ole. Ilman luurankoa edellinen päivä jäisi ruutuun ja
 * näyttäisi siltä ettei nuoli rekisteröitynyt — mikä salissa
 * tarkoittaa että vuoropäällikkö lukee väärän illan varauksia.
 */
export default function ReservationsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <LoadingLabel />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="rf-skeleton-block h-7 w-40" />
          <div className="rf-skeleton-block h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <div className="rf-skeleton-block h-11 w-32" />
          <div className="rf-skeleton-block h-11 w-28" />
        </div>
      </div>

      {/* Pöytäkartta */}
      <div className="rf-skeleton-block h-40" />

      {/* Illan varaukset: viisi riviä on tavallisen illan mitta. */}
      <div className="rf-skeleton-block h-[320px]" />
    </div>
  );
}
