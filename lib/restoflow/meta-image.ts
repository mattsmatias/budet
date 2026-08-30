/**
 * Julkaisukuvan tuottaminen lounaslistasta.
 *
 * ---------------------------------------------------------------------
 * KAKSI KUVASUHDETTA, EI YHTÄ
 * ---------------------------------------------------------------------
 *
 * Instagramin syöte hyväksyy välin 1.91:1 – 4:5, ja pystykuva 4:5 vie
 * eniten tilaa puhelimen ruudulla. Facebookin kuvajulkaisu näkyy
 * parhaiten vaakana. Sama kuva molempiin tarkoittaisi että toinen on
 * väärä: joko Instagram rajaa reunat tai Facebook näyttää kapean
 * pystykuvan keskellä harmaata.
 *
 * ---------------------------------------------------------------------
 * VAIN JPEG
 * ---------------------------------------------------------------------
 *
 * Instagram ei hyväksy muuta. ImageResponse tuottaa PNG:n, joten se
 * muunnetaan sharpilla — sharp on jo riippuvuutena, koska Next
 * käyttää sitä kuvien optimointiin.
 *
 * Muunnos on tässä eikä lähetyshetkellä: väärä muoto on parempi
 * huomata kuvaa tehdessä kuin Metan virheviestistä.
 */

import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatMoney } from "@/lib/money";
import { LUNCH_THEMES, type LunchTheme } from "./lunch-themes";
import type { LunchWeek } from "./lunch";
import { formatDayShortIn, weekdayLongIn } from "@/lib/i18n/labels";

export type ImageTarget = "instagram" | "facebook";

/*
 * Mitat.
 *
 * Instagram 1080×1350 on 4:5, syötteen suurin sallittu pystysuhde.
 * Facebook 1200×630 on sen vakiintunut vaakasuhde.
 */
const MITAT: Record<ImageTarget, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1350 },
  facebook: { width: 1200, height: 630 },
};

export interface ImageInput {
  week: LunchWeek;
  restaurantName: string;
  theme: LunchTheme;
  locale: AppLocale;
  target: ImageTarget;
  currency?: string;
}

/**
 * Kuva JPEG-tavuina.
 *
 * Laatu 88: silmällä erottamaton sadasta, mutta tiedosto on
 * kolmanneksen pienempi. Instagram pakkaa kuvan uudelleen joka
 * tapauksessa, joten maksimilaatu olisi tavuja joita kukaan ei näe.
 */
export async function renderLunchImage(input: ImageInput): Promise<Buffer> {
  const { width, height } = MITAT[input.target];

  const png = await new ImageResponse(kortti(input), { width, height }).arrayBuffer();

  return sharp(Buffer.from(png))
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * Montako päivää kuvaan mahtuu.
 *
 * Vaakakuvassa on puolet vähemmän korkeutta, joten viisi päivää
 * ruokineen ei mahdu luettavan kokoisena. Ylimenevä jää tekstiin,
 * joka on julkaisussa kuvan vieressä.
 */
function mahtuu(target: ImageTarget): number {
  return target === "instagram" ? 5 : 3;
}

function kortti({
  week,
  restaurantName,
  theme,
  locale,
  target,
  currency = "EUR",
}: ImageInput) {
  const t = LUNCH_THEMES[theme] ?? LUNCH_THEMES.light;
  const iso = target === "instagram";

  const paivat = week.days
    .filter((day) => day.items.length > 0)
    .slice(0, mahtuu(target));

  const hinta = week.prices[0];

  /*
   * Tyylit ovat objekteina eikä luokkina.
   *
   * ImageResponse ei tunne Tailwindia eikä muuttujia — se ymmärtää
   * vain suoraan annetut arvot. Siksi teema luetaan tokeneista tähän
   * eikä CSS:n kautta.
   */
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: t.bg,
        color: t.text,
        padding: iso ? 72 : 56,
        fontFamily: "sans-serif",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              marginBottom: iso ? 44 : 28,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: iso ? 30 : 24,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    color: t.text3,
                  },
                  children: "Viikon lounas",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: iso ? 62 : 48,
                    fontWeight: 700,
                    letterSpacing: -1,
                    marginTop: 8,
                  },
                  children: restaurantName,
                },
              },
            ],
          },
        },

        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: iso ? 26 : 16,
            },
            children: paivat.map((day) => ({
              type: "div",
              props: {
                style: { display: "flex", flexDirection: "column" },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: iso ? 28 : 22,
                        fontWeight: 600,
                        color: t.text3,
                        marginBottom: 6,
                      },
                      children: `${weekdayLongIn(day.date, locale)} ${formatDayShortIn(day.date, locale)}`,
                    },
                  },
                  ...day.items.slice(0, iso ? 4 : 3).map((item) => ({
                    type: "div",
                    props: {
                      style: {
                        fontSize: iso ? 34 : 26,
                        lineHeight: 1.35,
                      },
                      children: item.name,
                    },
                  })),
                ],
              },
            })),
          },
        },

        hinta
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  fontSize: iso ? 34 : 26,
                  fontWeight: 600,
                  borderTop: `2px solid ${t.line}`,
                  paddingTop: iso ? 26 : 18,
                  marginTop: iso ? 26 : 16,
                },
                children: `${hinta.name} ${formatMoney(hinta.cents, currency, locale)}`,
              },
            }
          : { type: "div", props: { style: { display: "flex" }, children: "" } },
      ],
    },
  } as unknown as React.ReactElement;
}
