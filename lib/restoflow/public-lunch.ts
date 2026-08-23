import { createClient } from "@/utils/supabase/server";
import { formatWeekRange, isoWeekNumber, weekdayShort } from "./lunch";
import { formatMoney } from "@/lib/money";

/**
 * Julkisen lounaslistan aineisto.
 *
 * Kolme näkymää lukee saman listan: verkkosivu puhelimessa, A4-arkki
 * ovessa ja infonäyttö seinällä. Ne näyttävät eriltä koska niitä
 * luetaan eri etäisyydeltä, mutta data on sama.
 *
 * Haku on tässä eikä kolmesti. Kolme kopiota samasta kutsusta ajautuu
 * erilleen heti kun kenttä lisätään — ja yksi näkymä jäisi näyttämään
 * vanhaa tietoa ilman että kukaan huomaa.
 */

export interface PublicPrice {
  name: string;
  cents: number;
}

export interface PublicDiet {
  label: string;
  short: string | null;
}

export interface PublicItem {
  name: string;
  description: string | null;
  diets: PublicDiet[];
  allergens: string[];
}

export interface PublicDay {
  date: string;
  items: PublicItem[];
}

export interface PublicWeek {
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

export async function loadPublicWeek(
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

/** Päivät joilla on ruokia. Tyhjä päivä näyttäisi suljetulta. */
export function daysWithFood(week: PublicWeek): PublicDay[] {
  return week.days.filter((day) => day.items.length > 0);
}

/** Näytettävät lyhenteet. Ruokavalio ilman lyhennettä jätetään pois. */
export function shortDiets(diets: PublicDiet[]): string[] {
  return diets.map((d) => d.short).filter((s): s is string => Boolean(s));
}

/**
 * Selite vain käytetyistä lyhenteistä.
 *
 * Koko sanaston luetteleminen opettaisi ohittamaan selitteen. Jos
 * listalla ei ole yhtään gluteenitonta, "G Gluteeniton" on rivi jota
 * ei tarvita.
 */
export function usedDietLegend(days: PublicDay[]): Map<string, string> {
  const used = new Map<string, string>();

  for (const day of days) {
    for (const item of day.items) {
      for (const diet of item.diets) {
        if (diet.short) used.set(diet.short, diet.label);
      }
    }
  }

  return used;
}

/**
 * Lounaslista tekstinä.
 *
 * Facebookiin, sähköpostiin ja mihin tahansa mihin tekstin voi
 * liittää. Muotoilu on tarkoituksella karu: sosiaalisen median
 * tekstikentät eivät tue korostuksia, ja niissä kaikki taulukoksi
 * yritetty menee rikki puhelimessa.
 */
export function weekAsText(week: PublicWeek, publicUrl: string): string {
  const days = daysWithFood(week);
  const lines: string[] = [];

  lines.push(`${week.restaurantName} — lounas`);
  lines.push(
    `Viikko ${isoWeekNumber(week.weekStart)} (${formatWeekRange(week.weekStart)})`,
  );

  if (week.prices.length > 0) {
    lines.push(
      week.prices
        .map((p) =>
          week.prices.length > 1
            ? `${p.name} ${formatMoney(p.cents)}`
            : formatMoney(p.cents),
        )
        .join(" · "),
    );
  }

  const extras: string[] = [];
  if (week.includesDessert) extras.push("jälkiruoka");
  if (week.includesCoffee) extras.push("kahvi");
  if (extras.length > 0) lines.push(`Hintaan sisältyy ${extras.join(" ja ")}.`);

  lines.push("");

  for (const day of days) {
    const dishes = day.items
      .map((item) => {
        const codes = shortDiets(item.diets);
        return codes.length > 0 ? `${item.name} ${codes.join(" ")}` : item.name;
      })
      .join(", ");

    lines.push(`${weekdayShort(day.date)} ${dishes}`);
  }

  const legend = usedDietLegend(days);

  if (legend.size > 0) {
    lines.push("");
    lines.push([...legend].map(([short, label]) => `${short} = ${label}`).join(", "));
  }

  lines.push("");
  lines.push(publicUrl);

  return lines.join("\n");
}
