/**
 * Työvuorosuunnittelun laskenta.
 *
 * SUUNNITELTU EI OLE TOTEUTUNUT.
 *
 * Kaikki tässä on suunnitelmaa: mitä on luvattu ja mitä se maksaisi.
 * Toteutunut aika syntyy leimauksista ja lasketaan muualla. Jos nämä
 * kaksi sekoittuisivat, suunnitelman muuttaminen muuttaisi jo tehtyä
 * työtä — ja juuri sitä lukua tarvitaan palkanmaksussa.
 *
 * JULKAISU JA VASTAUS OVAT ERI AKSELIT.
 *
 * status kertoo mitä työntekijä vastasi. Julkaisu kertoo onko vuoro
 * ylipäätään luvattu hänelle. Vuoro voi olla julkaistu ja odottaa
 * vastausta, ja juuri se on tavallisin tila — yhteen kenttään pakattuna
 * ne sulkisivat toisensa pois.
 */

import { shiftDurationMinutes, timeToMinutes } from "./shifts";
import { staffCostCents } from "./timeclock";
import type { Shift, User } from "./types";

export type Publication = "draft" | "published" | "cancelled";

export const PUBLICATION_LABELS: Record<Publication, string> = {
  draft: "Luonnos",
  published: "Julkaistu",
  cancelled: "Peruttu",
};

/**
 * Vuoron julkaisutila.
 *
 * Peruutus voittaa julkaisun: peruttu vuoro on ollut julkaistu, mutta
 * sitä ei enää tehdä. Lukijalle olennaisin tieto on peruutus.
 */
export function publicationOf(shift: Shift): Publication {
  if (shift.cancelledAt !== null) return "cancelled";
  return shift.publishedAt === null ? "draft" : "published";
}

/** Onko vuoro voimassa: julkaistu eikä peruttu. */
export function isLive(shift: Shift): boolean {
  return publicationOf(shift) === "published";
}

/**
 * Suunniteltu työaika minuutteina.
 *
 * Tauko vähennetään: 10–18 puolen tunnin tauolla on seitsemän ja puoli
 * tuntia työtä, ei kahdeksaa. Palkkakulu ja työvoiman osuus lasketaan
 * tästä, joten tauon unohtaminen näkyisi suoraan euroina.
 *
 * Tauko ei voi syödä vuoroa negatiiviseksi. Kahdeksan tunnin tauko
 * neljän tunnin vuorolla on kirjausvirhe, ja negatiivinen työaika
 * leviäisi siitä jokaiseen summaan.
 */
export function plannedMinutes(shift: Shift): number {
  return Math.max(
    0,
    shiftDurationMinutes(shift) - Math.max(0, shift.breakMinutes),
  );
}

/**
 * Vuoron minuuttiväli vuorokauden alusta.
 *
 * Yön yli menevä vuoro päättyy yli 1440 minuutin kohdalla. Näin
 * päällekkäisyyden voi tarkistaa suoraan lukuja vertaamalla, ilman
 * että keskiyö on erikoistapaus joka pitää muistaa joka kerta.
 */
function span(shift: Shift): { start: number; end: number } {
  const start = timeToMinutes(shift.startTime);
  return { start, end: start + shiftDurationMinutes(shift) };
}

/** Päivien ero. Molemmat "2026-08-24"-muodossa. */
function dayGap(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/**
 * Menevätkö kaksi vuoroa päällekkäin.
 *
 * Vuorot voivat olla eri päiviltä: perjantain 22–02 ja lauantain 01–09
 * ovat päällekkäin, vaikka päivämäärä on eri. Siksi vertailu tehdään
 * yhteisellä aikajanalla eikä päivän sisällä.
 *
 * Kosketus ei ole päällekkäisyys. Vuoro 10–18 ja vuoro 18–22 ovat
 * peräkkäisiä, ja niitä tehdään joka ilta.
 */
export function overlaps(a: Shift, b: Shift): boolean {
  const gap = dayGap(a.date, b.date);
  if (Math.abs(gap) > 1) return false;

  const first = span(a);
  const second = span(b);
  const shifted = {
    start: second.start + gap * 1440,
    end: second.end + gap * 1440,
  };

  return first.start < shifted.end && shifted.start < first.end;
}

export interface OverlapPair {
  user: User | null;
  a: Shift;
  b: Shift;
}

/**
 * Saman ihmisen päällekkäiset vuorot.
 *
 * Peruttuja ei tutkita: peruttu vuoro ei vie kenenkään aikaa, ja
 * varoitus siitä lähettäisi korjaamaan jotain mitä ei ole.
 *
 * Avoimet vuorot jäävät myös pois. Niillä ei ole tekijää, eikä kahden
 * avoimen vuoron päällekkäisyys ole ongelma vaan kaksi eri paikkaa
 * jotka pitää täyttää.
 */
export function findOverlaps(shifts: Shift[], users: User[]): OverlapPair[] {
  const live = shifts.filter(
    (shift) =>
      shift.cancelledAt === null &&
      shift.userId !== null &&
      shift.userId !== "",
  );

  const byUser = new Map<string, Shift[]>();
  for (const shift of live) {
    byUser.set(shift.userId, [...(byUser.get(shift.userId) ?? []), shift]);
  }

  const pairs: OverlapPair[] = [];

  for (const [userId, list] of byUser) {
    const sorted = list
      .slice()
      .sort((x, y) =>
        `${x.date}${x.startTime}`.localeCompare(`${y.date}${y.startTime}`),
      );

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        // Järjestetty lista: kun seuraava alkaa yli vuorokauden
        // myöhemmin, loputkin alkavat, eikä vertailua tarvita.
        if (dayGap(sorted[i].date, sorted[j].date) > 1) break;

        if (overlaps(sorted[i], sorted[j])) {
          pairs.push({
            user: users.find((u) => u.id === userId) ?? null,
            a: sorted[i],
            b: sorted[j],
          });
        }
      }
    }
  }

  return pairs;
}

export interface PlanSummary {
  /** Montako eri ihmistä on vuorossa. */
  people: number;
  shiftCount: number;
  draftCount: number;
  publishedCount: number;
  cancelledCount: number;
  openCount: number;
  plannedMinutes: number;

  /**
   * Arvioitu työvoimakustannus sentteinä.
   *
   * Vain tuntipalkkaisista ja vain niistä joilla tuntipalkka on
   * tiedossa. Kuukausipalkkainen ei maksa enempää siitä että hänelle
   * suunnitellaan vuoro, joten hänen tuntinsa eivät kuulu tähän
   * lukuun.
   */
  labourCostCents: number;

  /**
   * Montako vuorossa olevaa ilman tuntipalkkaa.
   *
   * Arvio on vajaa juuri heidän osaltaan, ja vajaa arvio ilman
   * mainintaa näyttäisi täydeltä.
   */
  missingRates: number;
}

/**
 * Kuukauden suunnitelman yhteenveto.
 *
 * Peruttuja ei lasketa tunteihin eikä kustannukseen: ne eivät ole
 * enää suunnitelmaa. Ne näkyvät omana lukunaan, koska peruutusten
 * määrä kertoo suunnittelun osuvuudesta.
 */
export function planSummary(input: {
  shifts: Shift[];
  users: User[];
}): PlanSummary {
  const assigned = input.shifts.filter(
    (s) => s.userId !== null && s.userId !== "",
  );
  const open = input.shifts.filter((s) => s.userId === null || s.userId === "");

  const live = assigned.filter((s) => s.cancelledAt === null);

  const people = new Set(live.map((s) => s.userId)).size;
  const minutes = live.reduce((sum, shift) => sum + plannedMinutes(shift), 0);

  let cost = 0;
  const withoutRate = new Set<string>();

  for (const shift of live) {
    const user = input.users.find((u) => u.id === shift.userId);

    if (!user || user.hourlyRateCents === null || user.hourlyRateCents === 0) {
      if (user) withoutRate.add(user.id);
      continue;
    }

    cost += staffCostCents(plannedMinutes(shift) * 60000, user.hourlyRateCents);
  }

  return {
    people,
    shiftCount: assigned.length + open.length,
    draftCount: input.shifts.filter((s) => publicationOf(s) === "draft").length,
    publishedCount: input.shifts.filter((s) => publicationOf(s) === "published")
      .length,
    cancelledCount: input.shifts.filter((s) => publicationOf(s) === "cancelled")
      .length,
    openCount: open.filter((s) => s.cancelledAt === null).length,
    plannedMinutes: minutes,
    labourCostCents: cost,
    missingRates: withoutRate.size,
  };
}

export interface RemovalOutcome {
  /** Poistetaan lopullisesti: luonnos jota ei ole luvattu kenellekään. */
  removed: number;
  /** Perutaan: julkaistu vuoro säilyy peruttuna, työntekijä saa tiedon. */
  cancelled: number;
  /** Ei koskettavissa: mennyt nimetty vuoro tai jo peruttu. */
  blocked: number;
}

/**
 * Mitä valituille vuoroille tapahtuu jos ne poistetaan.
 *
 * SAMA PÄÄTTELY KUIN KANNASSA.
 *
 * Vahvistus lupaa mitä tapahtuu, ja juuri sen lupauksen takia
 * painiketta painetaan. Jos näkymä laskisi toisin kuin kanta, lupaus
 * olisi väärä — siksi säännöt ovat tässä yhdessä paikassa ja
 * bulk_remove_shifts noudattaa samoja.
 *
 * Menneen päivän suoja koskee vain nimettyjä vuoroja: tekijätön vuoro
 * ei ole kenenkään tehtyä työtä.
 */
export function removalOutcome(shifts: Shift[], today: string): RemovalOutcome {
  let removed = 0;
  let cancelled = 0;
  let blocked = 0;

  for (const shift of shifts) {
    const state = publicationOf(shift);

    if (state === "cancelled") blocked += 1;
    else if (state === "published") cancelled += 1;
    else if (shift.userId !== "" && shift.date < today) blocked += 1;
    else removed += 1;
  }

  return { removed, cancelled, blocked };
}

/** "450" → "7 h 30 min". Suunnitelmassa tunnit ja minuutit erikseen. */
export function formatPlanned(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
