import { notFound } from "next/navigation";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_DATE } from "@/lib/restoflow/dates";
import {
  daysWithFood,
  loadPublicWeek,
  shortDiets,
  usedDietLegend,
} from "@/lib/restoflow/public-lunch";
import {
  formatWeekRange,
  includedSentence,
  isoWeekNumber,
  weekStartOf,
  weekdayShort,
} from "@/lib/restoflow/lunch";
import { lunchTheme } from "@/lib/restoflow/lunch-themes";
import { formatMoney } from "@/lib/money";
import { DisplayRefresh } from "./refresh";

/**
 * Lounaslista infonäytölle.
 *
 * Luetaan metrien päästä, joten kaikki on isompaa. Näyttö on myös
 * kiinni vuorokausia kerrallaan eikä kukaan päivitä sitä käsin, joten
 * sivu lataa itsensä uudelleen.
 *
 * Kuvaukset ja allergeenit jäävät pois. Metrin päästä niitä ei lue
 * kukaan, ja ne veisivät tilan siltä mitä luetaan.
 */

export const metadata = {
  title: "Lounas",
  robots: { index: false, follow: false },
};

/**
 * Palvelin ei saa tarjoilla eilistä listaa välimuistista.
 *
 * Sivun oma uudelleenlataus ei auta jos vastaus tulee välimuistista,
 * ja näytöllä se tarkoittaisi väärää päivää seinällä.
 */
export const revalidate = 300;

export default async function LunchDisplayPage({
  params,
  searchParams,
}: PageProps<"/lounas/[slug]/naytto">) {
  const locale = await resolveLocale();
  const { slug } = await params;
  const query = await searchParams;

  const requested = typeof query.viikko === "string" ? query.viikko : null;
  const weekStart =
    requested && ISO_DATE.test(requested) ? weekStartOf(requested) : null;

  const week = await loadPublicWeek(slug, weekStart);
  if (!week) notFound();

  const days = daysWithFood(week);
  const t = lunchTheme(week.theme);
  const legend = usedDietLegend(days);

  return (
    <main
      className="flex min-h-screen flex-col px-[4vw] py-[3vh]"
      style={{ background: t.bg, color: t.text }}
    >
      <DisplayRefresh />

      <header className="text-center">
        <p
          className="text-[1.4vw] font-medium uppercase"
          style={{ color: t.text2, letterSpacing: "0.15em" }}
        >
          {week.restaurantName}
        </p>

        <h1
          className="mt-[0.5vh] text-[4vw] font-bold leading-none"
          style={{
            fontFamily: t.headingFont,
            letterSpacing: t.headingTracking,
          }}
        >
          Lounas
        </h1>

        <p
          className="mt-[0.8vh] text-[1.5vw] font-semibold"
          style={{ color: t.text2 }}
        >
          Viikko {isoWeekNumber(week.weekStart)} ·{" "}
          {formatWeekRange(week.weekStart, locale)}
          {week.prices.length > 0 ? (
            <span style={{ color: t.text }}>
              {"  ·  "}
              {week.prices
                .map((p) =>
                  week.prices.length > 1
                    ? `${p.name} ${formatMoney(p.cents)}`
                    : formatMoney(p.cents),
                )
                .join("  ·  ")}
            </span>
          ) : null}
        </p>

        {includedSentence(week) ? (
          <p className="text-[1.2vw]" style={{ color: t.text2 }}>
            {includedSentence(week)}
          </p>
        ) : null}
      </header>

      {!week.published || days.length === 0 ? (
        <p
          className="flex flex-1 items-center justify-center text-[2vw]"
          style={{ color: t.text2 }}
        >
          Lounaslistaa ei ole julkaistu.
        </p>
      ) : (
        <>
          {/*
           * Päivät jakavat pystytilan tasan. Näyttö on kiinteän
           * kokoinen eikä sitä vieritetä — jos lista ei mahdu, se ei
           * mahdu, ja silloin on parempi että rivit kutistuvat kuin
           * että perjantai jää ruudun alapuolelle.
           */}
          <dl className="mt-[3vh] flex flex-1 flex-col justify-evenly">
            {days.map((day, index) => (
              <div
                key={day.date}
                className="grid grid-cols-[7vw_1fr] items-baseline gap-x-[2vw] py-[1vh]"
                style={
                  index > 0 ? { borderTop: `1px solid ${t.line}` } : undefined
                }
              >
                <dt
                  className="text-[2.6vw] font-bold uppercase leading-none"
                  style={{ fontFamily: t.headingFont }}
                >
                  {weekdayShort(day.date, locale)}
                </dt>

                <dd className="min-w-0 text-[1.7vw] leading-snug">
                  {day.items.map((item, i) => (
                    <span key={i}>
                      {i > 0 ? (
                        <span style={{ color: t.text3 }}> · </span>
                      ) : null}
                      {item.name}
                      {shortDiets(item.diets).length > 0 ? (
                        <span
                          className="text-[1.2vw] font-semibold"
                          style={{ color: t.text2 }}
                        >
                          {" "}
                          {shortDiets(item.diets).join(" ")}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          {legend.size > 0 ? (
            <p
              className="mt-[2vh] text-center text-[1.1vw]"
              style={{ color: t.text2 }}
            >
              {[...legend]
                .map(([short, label]) => `${short} ${label}`)
                .join("  ·  ")}
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
