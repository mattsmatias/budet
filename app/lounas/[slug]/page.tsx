import { notFound } from "next/navigation";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import {
  formatDayShort,
  formatWeekRange,
  includedSentence,
  isoWeekNumber,
  weekStartOf,
  weekdayName,
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
 * Yksittäisten ruokien hintoja ei ole eikä näytetä. Lounas on
 * kokonaisuus jonka hintaan kaikki päivän ruoat sisältyvät.
 */

interface PublicPrice {
  name: string;
  cents: number;
}

interface PublicItem {
  name: string;
  description: string | null;
  diets: string[];
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
  /** Hinta koskee koko viikkoa, ei yksittäistä päivää. */
  prices: PublicPrice[];
  includesDessert: boolean;
  includesCoffee: boolean;
  days: PublicDay[];
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

  /*
   * Teema konkreettisina arvoina, ei sovelluksen muuttujina.
   *
   * Sivu näkyy kirjautumattomalle, ja hänen järjestelmänsä tumma tila
   * ei saa muuttaa sitä minkä ravintola on valinnut. Arvot asetetaan
   * juureen muuttujiksi, joten sisältö käyttää samoja nimiä kuin
   * ennenkin.
   */
  const t = lunchTheme(week.theme);

  return (
    <main
      className="min-h-screen px-5 py-8 sm:px-6 sm:py-12"
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
      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <h1
            className="text-[26px] font-semibold sm:text-[32px]"
            style={{
              fontFamily: t.headingFont,
              letterSpacing: t.headingTracking,
            }}
          >
            {week.restaurantName}
          </h1>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            Viikon lounas
          </p>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            Viikko {isoWeekNumber(week.weekStart)} · {formatWeekRange(week.weekStart)}
          </p>

          {/*
           * Hinta kerran, ei joka päivän kohdalla. Sama luku viisi
           * kertaa allekkain on kohinaa, ja asiakas etsii sitä
           * ensimmäisenä.
           */}
          {week.prices.length > 0 ? (
            <p className="rf-tabular mt-4 text-[22px] font-semibold">
              {week.prices.map((price, i) => (
                <span key={price.name}>
                  {i > 0 ? (
                    <span
                      className="mx-2 text-[14px] font-normal"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      ·
                    </span>
                  ) : null}
                  {week.prices.length > 1 ? (
                    <span
                      className="mr-1.5 text-[13px] font-medium"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {price.name}
                    </span>
                  ) : null}
                  {formatMoney(price.cents)}
                </span>
              ))}
            </p>
          ) : null}

          {/*
           * Sisältyykö jälkiruoka ja kahvi.
           *
           * Tämä on hinnan jälkeen se mitä asiakas haluaa tietää, eikä
           * sitä voi päätellä ruokalistasta.
           */}
          {includedSentence(week) ? (
            <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {includedSentence(week)}
            </p>
          ) : null}
        </header>

        {!week.published || days.length === 0 ? (
          <div
            className="mt-8 px-5 py-8 text-center"
            style={{
              background: t.card,
              border: `1px solid ${t.cardBorder}`,
              boxShadow: t.cardShadow,
              borderRadius: "var(--rf-r-card)",
            }}
          >
            <p className="text-[15px] font-medium">Lounaslistaa ei ole julkaistu</p>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
              Tämän viikon lounaslista ei ole vielä saatavilla.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {days.map((day) => (
              <section
                key={day.date}
                aria-label={weekdayName(day.date)}
                className="px-5 py-5"
                style={{
                  background: t.card,
                  border: `1px solid ${t.cardBorder}`,
                  boxShadow: t.cardShadow,
                  borderRadius: "var(--rf-r-card)",
                }}
              >
                <h2
                  className="text-[15px] font-semibold uppercase"
                  style={{ fontFamily: t.headingFont, letterSpacing: "0.04em" }}
                >
                  {weekdayName(day.date)}
                  <span
                    className="rf-tabular ml-2 font-medium normal-case"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {formatDayShort(day.date)}
                  </span>
                </h2>

                <ul className="mt-3.5 space-y-2.5">
                  {day.items.map((item, index) => (
                    <li key={`${day.date}-${index}`}>
                      <p className="text-[15px] leading-snug">{item.name}</p>

                      {item.description ? (
                        <p
                          className="mt-0.5 text-[13px] leading-relaxed"
                          style={{ color: "var(--rf-text-2)" }}
                        >
                          {item.description}
                        </p>
                      ) : null}

                      {/*
                        Allergeenit eivät ole sivun hiljaisinta tekstiä.
                        Ne olivat, ja mitattuna se oli 2,4:1 — teksti
                        jonka joku lukee siksi ettei saa sairastua.
                      */}
                      {item.diets.length > 0 || item.allergens.length > 0 ? (
                        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-2)" }}>
                          {item.diets.join(" · ")}
                          {item.diets.length > 0 && item.allergens.length > 0 ? " — " : ""}
                          {item.allergens.length > 0
                            ? `Sisältää: ${item.allergens.join(", ")}`
                            : ""}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 text-center">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Kysy henkilökunnalta jos tarvitset tarkempia tietoja raaka-aineista.
          </p>
        </footer>
      </div>
    </main>
  );
}
