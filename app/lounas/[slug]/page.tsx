import { notFound } from "next/navigation";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
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
 * Julkinen lounassivu.
 *
 * Ei kirjautumista. Kaikki tulee yhdestä security definer -funktiosta
 * joka palauttaa vain julkaistun viikon — anon-roolilla ei ole
 * lukuoikeutta yhteenkään lounastauluun, joten tämän funktion
 * ulkopuolelta ei pääse mihinkään.
 *
 * YKSI ARKKI, EI VIITTÄ KORTTIA.
 *
 * Päivät olivat aiemmin omina kortteinaan. Se on hallintanäkymän
 * rakenne: siellä päivää muokataan yksi kerrallaan. Asiakas ei muokkaa
 * mitään — hän etsii tämän päivän rivin ja vilkaisee muut. Ravintolan
 * ovessa oleva lounaslista on yksi paperi, ja tämä on sen sähköinen
 * muoto.
 *
 * Yksittäisten ruokien hintoja ei ole eikä näytetä. Lounas on
 * kokonaisuus jonka hintaan kaikki päivän ruoat sisältyvät.
 */

interface PublicPrice {
  name: string;
  cents: number;
}

interface PublicDiet {
  label: string;
  short: string | null;
}

interface PublicItem {
  name: string;
  description: string | null;
  diets: PublicDiet[];
  allergens: string[];
}

interface PublicDay {
  date: string;
  items: PublicItem[];
}

interface PublicWeek {
  restaurantName: string;
  theme: string;
  weekStart: string;
  published: boolean;
  publishedAt?: string | null;
  prices: PublicPrice[];
  includesDessert: boolean;
  includesCoffee: boolean;
  days: PublicDay[];
}

/**
 * Näytettävät lyhenteet.
 *
 * Ruokavalio ilman lyhennettä jätetään pois merkinnöistä: tyhjä väli
 * nimen perässä näyttäisi kirjoitusvirheeltä. Koko sana on silti
 * selitteessä.
 */
function shortDiets(diets: PublicDiet[]): string[] {
  return diets.map((d) => d.short).filter((s): s is string => Boolean(s));
}

async function loadWeek(
  slug: string,
  weekStart: string | null,
): Promise<PublicWeek | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("public_lunch_week", {
    p_slug: slug,
    p_week_start: weekStart,
  });

  if (error || !data) return null;
  return data as unknown as PublicWeek;
}

export async function generateMetadata({ params }: PageProps<"/lounas/[slug]">) {
  const { slug } = await params;
  const week = await loadWeek(slug, null);

  if (!week) return { title: "Lounas" };

  return {
    title: `${week.restaurantName} – Lounas`,
    description: `${week.restaurantName}n viikon lounaslista ja hinnat.`,
    openGraph: {
      title: `${week.restaurantName} – Lounas`,
      description: `${week.restaurantName}n viikon lounaslista ja hinnat.`,
    },
  };
}

export default async function PublicLunchPage({
  params,
  searchParams,
}: PageProps<"/lounas/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;

  const requested = typeof query.viikko === "string" ? query.viikko : null;
  const weekStart =
    requested && ISO_DATE.test(requested) ? weekStartOf(requested) : null;

  const week = await loadWeek(slug, weekStart);

  // Tuntematon ravintola on 404, ei tyhjä sivu. Tyhjä sivu antaisi
  // ymmärtää että osoite on oikea mutta lounasta ei ole.
  if (!week) notFound();

  // Tyhjät päivät pois: ne näyttäisivät siltä että ravintola on kiinni.
  const days = week.days.filter((day) => day.items.length > 0);

  const t = lunchTheme(week.theme);

  /*
   * Selite vain käytetyistä lyhenteistä.
   *
   * Koko sanaston luetteleminen opettaisi ohittamaan selitteen. Jos
   * listalla ei ole yhtään gluteenitonta, "G = Gluteeniton" on rivi
   * jota ei tarvita.
   */
  const usedDiets = new Map<string, string>();

  for (const day of days) {
    for (const item of day.items) {
      for (const diet of item.diets) {
        if (diet.short) usedDiets.set(diet.short, diet.label);
      }
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6 sm:py-12"
      style={
        {
          background: t.bg,
          color: t.text,
          "--rf-bg": t.bg,
          "--rf-card": t.card,
          "--rf-text": t.text,
          "--rf-text-2": t.text2,
          "--rf-text-3": t.text3,
          "--rf-line": t.line,
        } as React.CSSProperties
      }
    >
      <div
        className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-9 sm:py-10"
        style={{
          background: t.card,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.cardShadow,
          borderRadius: "var(--rf-r-card)",
        }}
      >
        <header className="text-center">
          <p
            className="text-[13px] font-medium uppercase"
            style={{ color: t.text2, letterSpacing: "0.12em" }}
          >
            {week.restaurantName}
          </p>

          <h1
            className="mt-2 text-[30px] font-bold sm:text-[38px]"
            style={{
              fontFamily: t.headingFont,
              letterSpacing: t.headingTracking,
            }}
          >
            Lounaslista
          </h1>

          <p
            className="mt-1 text-[13px] font-semibold uppercase"
            style={{ color: t.text2, letterSpacing: "0.08em" }}
          >
            Vko {isoWeekNumber(week.weekStart)} ({formatWeekRange(week.weekStart)})
          </p>

          {week.prices.length > 0 ? (
            <p className="rf-tabular mt-5 text-[22px] font-semibold">
              {week.prices.map((price, i) => (
                <span key={price.name}>
                  {i > 0 ? (
                    <span
                      className="mx-2 text-[14px] font-normal"
                      style={{ color: t.text3 }}
                    >
                      ·
                    </span>
                  ) : null}
                  {week.prices.length > 1 ? (
                    <span
                      className="mr-1.5 text-[13px] font-medium"
                      style={{ color: t.text2 }}
                    >
                      {price.name}
                    </span>
                  ) : null}
                  {formatMoney(price.cents)}
                </span>
              ))}
            </p>
          ) : null}

          {includedSentence(week) ? (
            <p className="mt-1 text-[13px]" style={{ color: t.text2 }}>
              {includedSentence(week)}
            </p>
          ) : null}
        </header>

        {!week.published || days.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-[15px] font-medium">Lounaslistaa ei ole julkaistu</p>
            <p
              className="mt-1.5 text-[13px] leading-relaxed"
              style={{ color: t.text2 }}
            >
              Tämän viikon lounaslista ei ole vielä saatavilla.
            </p>
          </div>
        ) : (
          <>
            {/*
             * Päivät saman arkin riveinä.
             *
             * Viikonpäivä omassa kapeassa sarakkeessaan, ruoat sen
             * vieressä. Silmä etsii ensin päivän ja liikkuu sitten
             * oikealle — sama liike kuin paperilla ovessa.
             */}
            <dl className="mt-9">
              {days.map((day, index) => (
                <div
                  key={day.date}
                  className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-4 sm:grid-cols-[3.5rem_1fr] sm:gap-x-6"
                  style={index > 0 ? { borderTop: `1px solid ${t.line}` } : undefined}
                >
                  <dt
                    className="text-[15px] font-bold uppercase sm:text-[17px]"
                    style={{ fontFamily: t.headingFont, letterSpacing: "0.02em" }}
                  >
                    {weekdayShort(day.date)}
                  </dt>

                  <dd className="min-w-0">
                    <ul className="space-y-2">
                      {day.items.map((item, i) => (
                        <li key={i}>
                          <p className="text-[15px] leading-snug break-words">
                            {item.name}

                            {/*
                              Lyhenteet nimen perässä, kuten painetussa
                              listassa. Koko sana toistuisi
                              kaksikymmentä kertaa samalla arkilla ja
                              veisi tilan ruokien nimiltä.

                              Väli on merkkinä eikä pelkkänä marginaalina.
                              Marginaali erottaa ne silmälle mutta ei
                              tekstinä: ruudunlukija ja leikepöytä
                              näkivät "JuureskeittoVEG".
                            */}
                            {shortDiets(item.diets).length > 0 ? (
                              <span
                                className="text-[12px] font-semibold"
                                style={{ color: t.text2 }}
                              >
                                {" "}
                                {shortDiets(item.diets).join(" ")}
                              </span>
                            ) : null}
                          </p>

                          {item.description ? (
                            <p
                              className="text-[13px] leading-relaxed break-words"
                              style={{ color: t.text2 }}
                            >
                              {item.description}
                            </p>
                          ) : null}

                          {item.allergens.length > 0 ? (
                            <p className="text-[12px]" style={{ color: t.text2 }}>
                              Sisältää: {item.allergens.join(", ")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>

            {usedDiets.size > 0 ? (
              <p
                className="mt-8 border-t pt-4 text-center text-[12px] leading-relaxed"
                style={{ borderColor: t.line, color: t.text2 }}
              >
                {[...usedDiets].map(([short, label], i) => (
                  <span key={short}>
                    {i > 0 ? "  ·  " : ""}
                    <span className="font-semibold">{short}</span> {label}
                  </span>
                ))}
              </p>
            ) : null}
          </>
        )}

        <p
          className="mt-6 text-center text-[12px] leading-relaxed"
          style={{ color: t.text3 }}
        >
          Kysy henkilökunnalta jos tarvitset tarkempia tietoja raaka-aineista.
        </p>
      </div>
    </main>
  );
}
