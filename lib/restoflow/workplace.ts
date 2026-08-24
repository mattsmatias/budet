/**
 * Työyhteisö.
 *
 * Kaksi kysymystä: ketkä ovat työkavereitani ja onko tänään jonkun
 * syntymäpäivä. Ei enempää — tämä ei ole sosiaalinen verkosto vaan
 * kaksi tietoa jotka tekevät työvuorolistasta työpaikan.
 */

import { dayIn } from "./clock-context";
import type { Colleague } from "./queries";

const MONTHS = [
  "tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta",
  "kesäkuuta", "heinäkuuta", "elokuuta", "syyskuuta", "lokakuuta",
  "marraskuuta", "joulukuuta",
];

/** "24. elokuuta". Ilman vuotta, koska vuotta ei ole tallennettu. */
export function formatBirthday(day: number, month: number): string {
  return `${day}. ${MONTHS[month - 1] ?? ""}`.trim();
}

/**
 * Tämän päivän syntymäpäiväsankarit ravintolan ajassa.
 *
 * Päivä luetaan vyöhykkeestä eikä palvelimen kellosta: Vercel on
 * UTC:ssä, ja klo 01:00 Helsingissä olisi vielä edellinen päivä.
 * Syntymäpäivä yhtenä vääränä päivänä on pieni asia, mutta se on juuri
 * se pieni asia jonka joku huomaa.
 */
export function birthdaysToday(
  colleagues: Colleague[],
  nowIso: string,
  timezone: string,
): Colleague[] {
  const today = dayIn(timezone, nowIso);
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));

  return colleagues.filter((c) => c.birthDay === day && c.birthMonth === month);
}

/**
 * Onnittelulause.
 *
 * NIMEÄ EI TAIVUTETA.
 *
 * "Tänään on Minnan syntymäpäivä" vaatisi genetiivin, ja suomen
 * astevaihtelu ei mahdu sääntöön: "Mikko" taipuu muotoon "Mikon" eikä
 * "Mikkon", jonka naiivi sääntö tuottaa. Väärin taivutettu nimi on
 * juuri se yksityiskohta jonka omistaja huomaa heti.
 *
 * "Minna täyttää tänään vuosia" on yhtä luonteva ja käyttää nimeä
 * perusmuodossa. Silloin sitä ei voi taivuttaa väärin.
 */
export function birthdaySentence(names: string[]): string {
  const first = names.map((n) => n.split(" ")[0]).filter(Boolean);

  if (first.length === 0) return "";
  if (first.length === 1) return `${first[0]} täyttää tänään vuosia!`;

  const head = first.slice(0, -1).join(", ");
  return `${head} ja ${first[first.length - 1]} täyttävät tänään vuosia!`;
}
