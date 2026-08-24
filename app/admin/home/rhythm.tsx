import { formatMoney } from "@/lib/money";
import {
  WEEKDAY_LABELS,
  type SpendDay,
  type SpendRhythm,
} from "@/lib/restoflow/spend-rhythm";

/**
 * Kuukauden kulurytmi.
 *
 * Yksi palkki per päivä, koko kuukausi yhdellä rivillä.
 *
 * KUUKAUDEN LOPPUSUMMA PIILOTTAA RYTMIN.
 *
 * "3 482,60 €" kertoo paljonko meni. Se ei kerro että kaksi
 * kolmasosaa meni torstaisin, eikä sitä että viime torstai oli
 * kaksinkertainen edellisiin nähden. Tukkutoimitukset tulevat
 * tiettyinä päivinä, ja juuri se on ainoa asia tässä luvussa johon
 * ravintoloitsija voi vaikuttaa.
 *
 * KOLME ERI TYHJÄÄ.
 *
 * Päivä ilman kuluja, tuleva päivä ja viikonloppu näyttävät kaikki
 * matalalta — mutta ne tarkoittavat eri asioita. Tuleva päivä on
 * pelkkä ääriviiva: siltä ei puutu mitään, se ei vain ole vielä
 * tullut.
 */
export function Rhythm({ rhythm }: { rhythm: SpendRhythm }) {
  /*
   * Tyhjä kuukausi piirretään silti.
   *
   * Komponentti palautti aiemmin null kun kuluja ei ollut, ja silloin
   * viereinen huomiokortti jäi yksin koko rivin leveydelle. Tyhjä
   * kuukausi on tuloskin — se kertoo ettei ostoja ole vielä kirjattu —
   * ja rivin muoto pysyy samana kuukaudesta toiseen.
   */
  const empty = rhythm.totalCents === 0;

  return (
    <section
      aria-label="Kulurytmi"
      className="px-[18px] pb-4 pt-[15px]"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold tracking-[-0.0075em]">Kulurytmi</h3>

        <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {empty
            ? "Ei ostoja tässä kuussa"
            : rhythm.activeDays === 1
              ? "Kuluja yhtenä päivänä"
              : `Kuluja ${rhythm.activeDays} päivänä`}
        </p>
      </div>

      {/*
        Palkit kasvavat ylöspäin ja porrastetusti vasemmalta oikealle.
        Suunta on sama kuin kuukauden kuluminen, joten liike lukee
        kuukauden läpi eikä vain herätä huomiota.
      */}
      <ol className="mt-5 flex h-[92px] items-end gap-[3px]">
        {rhythm.days.map((day, index) => (
          <Column key={day.date} day={day} max={rhythm.maxCents} index={index} />
        ))}
      </ol>

      {/* Viikonpäivät janan alle, vain joka toinen jottei rivi täyty. */}
      <ol className="mt-1.5 flex gap-[3px]">
        {rhythm.days.map((day) => (
          <li
            key={day.date}
            className="min-w-0 flex-1 text-center text-[9px] font-semibold"
            style={{
              color: day.isToday ? "var(--rf-text)" : "var(--rf-text-3)",
              opacity: day.day % 2 === 1 || day.isToday ? 1 : 0,
            }}
          >
            {day.day}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        {empty ? (
          <p style={{ color: "var(--rf-text-3)" }}>
            Rytmi näkyy kun kuukaudessa on ostoja useammalta päivältä.
          </p>
        ) : rhythm.peakWeekday ? (
          <p style={{ color: "var(--rf-text-2)" }}>
            <strong className="font-bold" style={{ color: "var(--rf-text)" }}>
              {Math.round(rhythm.peakWeekday.share * 100)} %
            </strong>{" "}
            kuluista osuu {WEEKDAY_LABELS[rhythm.peakWeekday.weekday - 1] === "la" ||
            WEEKDAY_LABELS[rhythm.peakWeekday.weekday - 1] === "su"
              ? "viikonlopulle"
              : `${rhythm.peakWeekday.label}sin`}
          </p>
        ) : (
          /*
           * Vaikeneminen on tulos sekin. Ilman tätä lausetta lukija
           * jäisi arvailemaan onko rytmiä etsitty vai ei.
           */
          <p style={{ color: "var(--rf-text-3)" }}>
            Kulut jakautuvat tasaisesti viikonpäiville
          </p>
        )}

        {rhythm.busiestDay && rhythm.busiestDay.cents > 0 ? (
          <p style={{ color: "var(--rf-text-2)" }}>
            Suurin päivä {rhythm.busiestDay.day}.{" "}
            <span className="rf-tabular font-semibold">
              {formatMoney(rhythm.busiestDay.cents)}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Column({
  day,
  max,
  index,
}: {
  day: SpendDay;
  max: number;
  index: number;
}) {
  /*
   * Vähimmäiskorkeus vain päiville joilla on kuluja.
   *
   * Ilman sitä pieni ostos katoaa kokonaan suuren toimituspäivän
   * rinnalla. Kuluton päivä sen sijaan saa jäädä olemattomaksi — se on
   * totta.
   */
  const share = max > 0 ? day.cents / max : 0;
  const height = day.cents > 0 ? Math.max(8, share * 100) : 0;
  const weekend = day.weekday >= 6;

  const label = day.isFuture
    ? `${day.day}. — ei vielä`
    : `${day.day}. ${formatMoney(day.cents)}${day.receipts > 0 ? ` · ${day.receipts} kuittia` : ""}`;

  return (
    <li className="relative flex h-full min-w-0 flex-1 flex-col justify-end" title={label}>
      {/* Tuleva päivä on ääriviiva: siltä ei puutu mitään, se ei ole tullut. */}
      {day.isFuture ? (
        <span
          aria-hidden="true"
          className="w-full"
          style={{
            height: 3,
            borderRadius: 3,
            background: "var(--rf-line)",
          }}
        />
      ) : day.cents === 0 ? (
        <span
          aria-hidden="true"
          className="w-full"
          style={{ height: 3, borderRadius: 3, background: "var(--rf-inset)" }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="rf-column-grow w-full"
          style={{
            height: `${height}%`,
            minHeight: 4,
            borderRadius: 4,
            background: day.isToday
              ? "var(--rf-ink)"
              : weekend
                ? "var(--rf-accent-2)"
                : "var(--rf-accent)",
            opacity: weekend && !day.isToday ? 0.55 : 1,
            animationDelay: `${Math.min(index * 22, 700)}ms`,
          }}
        />
      )}

      <span className="sr-only">{label}</span>
    </li>
  );
}
