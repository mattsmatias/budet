import { notFound } from "next/navigation";
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

/**
 * Lounaslista upotettavaksi ravintolan omalle sivulle.
 *
 * Sama sisältö kuin julkisella sivulla, mutta ilman omaa taustaa ja
 * marginaaleja: upotus asetetaan toisen sivun sisään, ja siellä
 * kehyksen ympärillä on jo se sivun oma asettelu. Kahdet marginaalit
 * näyttäisivät virheeltä.
 *
 * Läpinäkyvä tausta oletuksena, jotta se istuu mihin tahansa sivuun.
 * Teeman tausta saadaan lisäämällä ?tausta=1.
 */

export const metadata = {
  title: "Lounas",
  // Upotus ei ole itsenäinen sivu. Hakukone löytäköön oikean.
  robots: { index: false, follow: false },
};

export default async function EmbeddedLunchPage({
  params,
  searchParams,
}: PageProps<"/lounas/[slug]/upota">) {
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

  // Oletuksena läpinäkyvä. Ravintolan oma sivu on jo jonkin värinen.
  const background = query.tausta === "1" ? t.bg : "transparent";

  return (
    <div
      className="px-4 py-5"
      style={
        {
          background,
          color: t.text,
          "--rf-text-2": t.text2,
          "--rf-text-3": t.text3,
        } as React.CSSProperties
      }
    >
      <header>
        <h2
          className="text-[20px] font-bold"
          style={{ fontFamily: t.headingFont, letterSpacing: t.headingTracking }}
        >
          Lounas
        </h2>

        <p className="text-[13px]" style={{ color: t.text2 }}>
          Viikko {isoWeekNumber(week.weekStart)} · {formatWeekRange(week.weekStart)}
        </p>

        {week.prices.length > 0 ? (
          <p className="rf-tabular mt-2 text-[18px] font-semibold">
            {week.prices
              .map((p) =>
                week.prices.length > 1
                  ? `${p.name} ${formatMoney(p.cents)}`
                  : formatMoney(p.cents),
              )
              .join("  ·  ")}
          </p>
        ) : null}

        {includedSentence(week) ? (
          <p className="text-[12px]" style={{ color: t.text2 }}>
            {includedSentence(week)}
          </p>
        ) : null}
      </header>

      {!week.published || days.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: t.text2 }}>
          Tämän viikon lounaslista ei ole vielä saatavilla.
        </p>
      ) : (
        <>
          <dl className="mt-4">
            {days.map((day, index) => (
              <div
                key={day.date}
                className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-2.5"
                style={index > 0 ? { borderTop: `1px solid ${t.line}` } : undefined}
              >
                <dt
                  className="text-[14px] font-bold uppercase"
                  style={{ fontFamily: t.headingFont }}
                >
                  {weekdayShort(day.date)}
                </dt>

                <dd className="min-w-0 text-[13.5px] leading-relaxed">
                  {day.items.map((item, i) => (
                    <span key={i}>
                      {i > 0 ? <span style={{ color: t.text3 }}> · </span> : null}
                      {item.name}
                      {shortDiets(item.diets).length > 0 ? (
                        <span
                          className="text-[11px] font-semibold"
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
            <p className="mt-3 text-[11px]" style={{ color: t.text2 }}>
              {[...legend]
                .map(([short, label]) => `${short} ${label}`)
                .join("  ·  ")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
