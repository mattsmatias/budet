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

  /*
   * Esikatselu näyttää paperin, ei verkkosivua.
   *
   * Lounaslista päätyy ravintolan oveen tulostettuna, joten
   * esikatselun on oltava A4: oikeat mitat ja oikea suhde. Verkkosivun
   * levyinen esikatselu näyttäisi hyvältä ja tulostuisi toisin.
   *
   * Asiakkaan näkemä sivu on edelleen tavallinen sivu — hän lukee sen
   * puhelimesta eikä paperilta.
   */
  const preview = query.esikatselu === "1";

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
      className={
        preview ? "rf-a4-stage min-h-screen" : "min-h-screen px-4 py-8 sm:px-6 sm:py-12"
      }
      style={
        {
          background: preview ? "#e9eaee" : t.bg,
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
        className={
          preview
            ? "rf-a4 px-[18mm] py-[16mm]"
            : "mx-auto w-full max-w-2xl px-5 py-8 sm:px-9 sm:py-10"
        }
        style={{
          // Esikatselussa arkin tausta on teeman sivutausta: paperi on
          // koko sivu, ei kortti sivun päällä.
          background: preview ? t.bg : t.card,
          border: preview ? "0" : `1px solid ${t.cardBorder}`,
          boxShadow: preview
            ? "0 2px 18px rgba(17, 19, 24, 0.16)"
            : t.cardShadow,
          borderRadius: preview ? 0 : "var(--rf-r-card)",
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
            <dl className={preview ? "mt-7" : "mt-9"}>
              {days.map((day, index) => (
                <div
                  key={day.date}
                  className={
                    preview
                      ? "grid grid-cols-[3rem_1fr] gap-x-5 py-2.5"
                      : "grid grid-cols-[2.5rem_1fr] gap-x-4 py-4 sm:grid-cols-[3.5rem_1fr] sm:gap-x-6"
                  }
                  style={index > 0 ? { borderTop: `1px solid ${t.line}` } : undefined}
                >
                  <dt
                    className="text-[15px] font-bold uppercase sm:text-[17px]"
                    style={{ fontFamily: t.headingFont, letterSpacing: "0.02em" }}
                  >
                    {weekdayShort(day.date)}
                  </dt>

                  <dd className="min-w-0">
                    {preview ? (
                      /*
                       * Arkilla ruoat samalla rivillä, kuten painetussa
                       * listassa.
                       *
                       * Rivi per ruoka ei mahtunut A4:lle: mitattuna
                       * 458 mm eli kaksi sivua. Ovessa oleva lista ei
                       * voi olla kaksi paperia, ja toiselle sivulle
                       * jäävä perjantai on sama kuin ei perjantaita.
                       *
                       * Kuvaukset ja allergeenit jäävät pois arkilta.
                       * Ne ovat verkkosivulla, jonka asiakas avaa
                       * QR-koodista — paperi on tiivistelmä, puhelin
                       * täysi lista.
                       */
                      <p className="text-[13.5px] leading-relaxed">
                        {day.items.map((item, i) => (
                          <span key={i}>
                            {i > 0 ? (
                              <span style={{ color: t.text3 }}> · </span>
                            ) : null}
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
                      </p>
                    ) : (
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
                    )}
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
          {preview
            ? "Kerrothan henkilökunnalle ruoka-aineallergiat. Tarkat " +
              "allergeenitiedot löytyvät verkkosivulta."
            : "Kysy henkilökunnalta jos tarvitset tarkempia tietoja raaka-aineista."}
        </p>
      </div>

      {/*
        Ohje ei kuulu paperille. rf-no-print piilottaa sen
        tulostettaessa, jotta esikatselu ja tuloste ovat sama asia.
      */}
      {preview ? (
        <p
          className="rf-no-print fixed inset-x-0 bottom-0 py-3 text-center text-[12px]"
          style={{ background: "rgba(233, 234, 238, 0.92)", color: "#4b5563" }}
        >
          A4-esikatselu. Tulosta selaimesta (Ctrl/Cmd + P) — asettelu on
          sama kuin tässä.
        </p>
      ) : null}
    </main>
  );
}
