/**
 * Pöytävarausten tietomalli ja johdettu tila.
 *
 * Tässä ei ole yhtään kyselyä eikä yhtään palvelimen tuontia, ja se on
 * ehto eikä sattuma: salinäkymän lomake on klientkomponentti ja tuo
 * nämä tyypit. Jos Supabase-asiakas olisi samassa moduulissa, se
 * päätyisi selainnippuun ja käännös kaatuisi next/headers-tuontiin.
 * Haut ovat reservation-queries.ts:ssä.
 *
 * Pöytäkartan tila lasketaan puhtaalla funktiolla eikä tallenneta:
 * tallennettu tila olisi neljäs paikka jossa sama asia on kirjattuna,
 * ja ainoa joka voi olla väärässä.
 */

export type ReservationStatus =
  "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";

export type ReservationSource = "widget" | "link" | "admin" | "walk_in";

/** Tilat jotka varaavat pöydän. Sama joukko kuin kannan blocking-lipussa. */
/**
 * Seurueen oletuskoko.
 *
 * Sivu laskee vapaat ajat valmiiksi tälle koolle ja lomake avautuu
 * samaan lukuun, joten dialogi näyttää oikeat ajat heti eikä hae
 * uudelleen turhaan. Jos nämä eriävät, esilaskettu lista on väärä
 * eikä mikään kerro siitä.
 *
 * Kaksi siksi että se on tavallisin varaus.
 */
export const OLETUS_SEURUE = 2;

export const BLOCKING_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "arrived",
];

import type { FloorElement, TableShape } from "./floor-plan";

export interface DiningArea {
  id: string;
  name: string;
}

export interface RestaurantTable {
  id: string;
  name: string;
  areaId: string | null;
  seatsMin: number;
  seatsMax: number;
  active: boolean;
  posX: number | null;
  posY: number | null;

  /**
   * Muoto ja kierto pöytäkartalla.
   *
   * Pyöreä kuuden hengen pöytä ja pitkä kuuden hengen pöytä ovat
   * salissa eri asioita, ja tarjoilija tunnistaa ne muodosta ennen
   * kuin lukee numeron.
   */
  shape: TableShape;
  rotation: number;

  /**
   * Oma leveys prosentteina, jos ravintola on säätänyt sen.
   *
   * Null tarkoittaa "käytä paikkaluvusta johdettua". Se ei ole sama
   * asia kuin nolla: johdettu koko seuraa paikkalukua, tallennettu ei.
   */
  width: number | null;
}

export interface Reservation {
  id: string;
  /**
   * Varausnumero jonka asiakas sai vahvistuksessa.
   *
   * Kuusi merkkiä, ei juokseva luku. Sen ainoa tehtävä on olla se
   * merkkijono jonka asiakas lukee puhelimessa ääneen ja jolla sali
   * löytää varauksen ilman nimen tavaamista.
   */
  reference: string | null;
  startsAt: string;
  endsAt: string;
  /** Kellonaika ravintolan vyöhykkeellä, kannan muotoilemana. */
  time: string;
  endTime: string;
  partySize: number;
  status: ReservationStatus;
  source: ReservationSource;
  guestName: string;
  /** Null työntekijälle: kanta jättää yhteystiedot pois. */
  guestPhone: string | null;
  guestEmail: string | null;
  note: string | null;

  /**
   * Allergiat erillään toiveista.
   *
   * Toive on pöytä ikkunan vieressä, allergia on se rivi jonka
   * lukematta jättäminen vie ihmisen sairaalaan. Siksi ne eivät ole
   * samassa kentässä eivätkä näytä samalta.
   */
  allergies: string | null;
  tableIds: string[];

  /** Milloin lasku pyydettiin. Null kun sitä ei ole pyydetty. */
  billRequestedAt: string | null;
}

export interface ReservationSettings {
  enabled: boolean;
  slotMinutes: number;
  defaultDurationMinutes: number;
  turnaroundMinutes: number;
  minParty: number;
  maxParty: number;
  /** Null kun rajaa ei ole asetettu. Ei sama asia kuin nolla. */
  kitchenCapacity?: number | null;
  kitchenWindowMinutes?: number;
}

export interface ReservationDay {
  date: string;
  timezone: string;
  canManage: boolean;
  settings: ReservationSettings | null;
  areas: DiningArea[];
  tables: RestaurantTable[];
  elements: FloorElement[];
  reservations: Reservation[];

  /**
   * Päivän aukioloikkuna kalenterin aikajanaa varten.
   *
   * Null kun ravintola on kiinni tai aukioloaikoja ei ole asetettu.
   * Kalenteri venyy silloin varausten mukaan — kiinni olevanakin
   * saliin voi kirjata walk-inin.
   *
   * spanMinutes on aukiolon pituus minuutteina. Se on eri tieto kuin
   * kahden kellonajan erotus: ilta 18:00–02:00 on kahdeksan tuntia
   * eikä miinus kuusitoista, ja aikajana piirretään pituuden mukaan.
   */
  hours: ReservationHours | null;
}

export interface ReservationHours {
  opens: string;
  lastSeating: string;
  spanMinutes: number;
}

// ---------------------------------------------------------------------------
// Asetusten aineisto
// ---------------------------------------------------------------------------

export interface ReservationHour {
  id: string;
  weekday: number;
  opens: string;
  lastSeating: string;
}

/**
 * Aukiolon pituus minuutteina.
 *
 * Viimeinen aika joka on avaamista pienempi tarkoittaa seuraavaa
 * päivää: 18:00–02:00 on kahdeksan tuntia. Sama sääntö kuin kannan
 * reservation_span_minutes-funktiossa, ja se on kirjoitettu tänne
 * uudelleen vain siksi, että lomake varoittaa ennen tallennusta —
 * päätöksen tekee silti kanta.
 */
export function hourSpanMinutes(opens: string, lastSeating: string): number {
  const alku = clockMinutes(opens);
  const loppu = clockMinutes(lastSeating);

  if (alku === null || loppu === null) return 0;
  return loppu > alku ? loppu - alku : loppu + 24 * 60 - alku;
}

/** "18:30" → 1110. Kelvoton syöte on null eikä nolla: 00:00 on aika. */
function clockMinutes(value: string): number | null {
  const osat = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!osat) return null;

  const tunnit = Number(osat[1]);
  const minuutit = Number(osat[2]);

  if (tunnit > 23 || minuutit > 59) return null;
  return tunnit * 60 + minuutit;
}

export interface HourConflict {
  /** Päivä jonka ilta jatkuu seuraavan päälle. */
  weekday: number;
  /** Päivä johon se ulottuu. */
  nextWeekday: number;
  /** Mihin asti edellinen ilta jatkuu. */
  until: string;
}

/**
 * Illat jotka menevät päällekkäin.
 *
 * Keskiyön yli jatkuva ilta on nyt mahdollinen, ja sen myötä myös
 * asetus jossa lauantai-ilta jatkuu kello kolmeen ja sunnuntai avautuu
 * kello kahdelta. Kanta ottaa molemmat vastaan — ne ovat kaksi
 * erillistä riviä eivätkä tiedä toisistaan — mutta salinäkymä joutuu
 * silloin päättämään kumpaan iltaan kello 02:30 alkava varaus kuuluu,
 * ja se päätös on aina toiselle väärä.
 *
 * Siksi tämä on varoitus eikä virhe: aukiolo on ravintolan asia, ja
 * järjestelmä kertoo mitä siitä seuraa. Ilman varoitusta seuraus
 * huomattaisiin vasta puuttuvasta varauksesta.
 */
export function hourConflicts(
  hours: { weekday: number; opens: string; lastSeating: string }[],
): HourConflict[] {
  const conflicts: HourConflict[] = [];

  for (const row of hours) {
    const alku = clockMinutes(row.opens);
    const loppu = clockMinutes(row.lastSeating);
    if (alku === null || loppu === null) continue;

    /* Ilta joka päättyy ennen keskiyötä ei voi osua seuraavaan. */
    if (loppu > alku) continue;

    const seuraava = (row.weekday % 7) + 1;
    const naapuri = hours.find((h) => h.weekday === seuraava);
    if (!naapuri) continue;

    const naapurinAlku = clockMinutes(naapuri.opens);
    if (naapurinAlku === null) continue;

    if (naapurinAlku < loppu) {
      conflicts.push({
        weekday: row.weekday,
        nextWeekday: seuraava,
        until: row.lastSeating,
      });
    }
  }

  return conflicts;
}

export interface ReservationDuration {
  id: string;
  minParty: number;
  maxParty: number | null;
  minutes: number;
}

export interface ReservationException {
  id: string;
  date: string;
  closed: boolean;
  opens: string | null;
  lastSeating: string | null;
  note: string | null;
}

export interface TableCombination {
  id: string;
  name: string | null;
  seatsMin: number;
  seatsMax: number;
  active: boolean;
  tableIds: string[];
}

export interface FullSettings {
  enabled: boolean;
  slotMinutes: number;
  defaultDurationMinutes: number;
  turnaroundMinutes: number;
  minParty: number;
  maxParty: number;
  maxDaysAhead: number;
  leadMinutes: number;
  themeColor: string;
  themeDark: boolean;
  themeRadius: number;

  /**
   * Keittiön kapasiteetti ruokailijoina aikaikkunassa.
   *
   * Null tarkoittaa ettei rajaa ole asetettu. Se ei ole sama asia
   * kuin nolla: Kate ei keksi keittiölle kapasiteettia jota kukaan ei
   * ole kertonut.
   */
  kitchenCapacity: number | null;
  kitchenWindowMinutes: number;

  /**
   * Kuinka monta tuntia ennen varausta asiakas voi vielä perua itse.
   *
   * Nolla tarkoittaa alkuhetkeen asti. Raja koskee vain verkkoa: sali
   * peruu varauksen milloin tahansa, koska tieto siitä ettei seurue
   * tule on arvokas myös kymmenen minuuttia ennen.
   */
  cancelCutoffHours: number;
}

export const DEFAULT_SETTINGS: FullSettings = {
  kitchenCapacity: null,
  kitchenWindowMinutes: 60,
  cancelCutoffHours: 24,
  enabled: false,
  slotMinutes: 30,
  defaultDurationMinutes: 90,
  turnaroundMinutes: 0,
  minParty: 1,
  maxParty: 12,
  maxDaysAhead: 60,
  leadMinutes: 60,
  themeColor: "#1f6f5c",
  themeDark: false,
  themeRadius: 12,
};

/**
 * Salin pohjapiirros kuvana.
 *
 * Tiedosto on yksityisessä tallennustilassa: pohjapiirros kertoo missä
 * ovet ja hätäpoistumistiet ovat, eikä se kuulu julkiseen osoitteeseen.
 * Osoite on siksi allekirjoitettu ja vanheneva, ja se haetaan
 * palvelimella joka sivunlatauksella eikä tallenneta mihinkään.
 *
 * Leveys ja korkeus ovat kuvan omat pikselimitat. Vain niiden suhdetta
 * käytetään: kartan laatikko ottaa kuvan muodon, jottei pohjapiirros
 * veny.
 */
export interface FloorPlanImage {
  path: string;
  /** Allekirjoitettu osoite. Null jos linkin luonti epäonnistui. */
  url: string | null;
  width: number;
  height: number;
  opacity: number;
}

export interface ReservationSetup {
  settings: FullSettings;
  hours: ReservationHour[];
  durations: ReservationDuration[];
  exceptions: ReservationException[];
  areas: DiningArea[];
  tables: RestaurantTable[];
  elements: FloorElement[];
  combinations: TableCombination[];
  plan: FloorPlanImage | null;
}

// ---------------------------------------------------------------------------
// Pöytäkartan tila
// ---------------------------------------------------------------------------

/**
 * Pöydän tila juuri nyt.
 *
 * Johdettu varauksista, ei tallennettu. Tallennettu tila olisi neljäs
 * paikka jossa sama asia on kirjattuna — ja ainoa joka voi olla väärässä,
 * koska sitä pitäisi muistaa päivittää.
 */
export type TableState =
  /** Pois käytöstä. Ei oteta varauksia, ei näy kartalla käytettävänä. */
  | "disabled"
  /**
   * Seurue on syönyt ja pyytänyt laskun.
   *
   * Ei enää "asiakkaat pöydässä" eikä vielä "vapaa". Tämä on se pöytä
   * joka vapautuu kymmenessä minuutissa, ja se on eri tieto kuin
   * kumpikaan naapuritilansa — juuri sitä kysytään kun ovella seisoo
   * kaksi ihmistä.
   */
  | "billing"
  /** Seurue istuu pöydässä. */
  | "seated"
  /** Varausaika alkanut mutta seuruetta ei ole merkitty saapuneeksi. */
  | "late"
  /** Edellinen seurue lähti äsken, pöytä ei ole vielä valmis. */
  | "cleaning"
  /** Varaus myöhemmin samana päivänä. */
  | "reserved"
  | "free";

export interface TableStatus {
  table: RestaurantTable;
  state: TableState;
  /** Varaus joka määrää tilan, jos sellainen on. */
  reservation: Reservation | null;
  /** Päivän kaikki varaukset tähän pöytään, aikajärjestyksessä. */
  reservations: Reservation[];
}

/**
 * Pöytien tila annetulla hetkellä.
 *
 * Hetki annetaan parametrina eikä lueta kellosta, jotta funktio on
 * testattavissa. Kello funktion sisällä tekisi testistä sellaisen joka
 * menee läpi aamulla ja kaatuu illalla.
 */
export function tableStates(day: ReservationDay, now: Date): TableStatus[] {
  const turnaroundMs = (day.settings?.turnaroundMinutes ?? 0) * 60_000;
  const nowMs = now.getTime();

  return day.tables.map((table) => {
    const mine = day.reservations
      .filter((r) => r.tableIds.includes(table.id))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    if (!table.active) {
      return {
        table,
        state: "disabled" as const,
        reservation: null,
        reservations: mine,
      };
    }

    const blocking = mine.filter((r) => BLOCKING_STATUSES.includes(r.status));

    const current = blocking.find(
      (r) => Date.parse(r.startsAt) <= nowMs && Date.parse(r.endsAt) > nowMs,
    );

    if (current) {
      /*
       * Laskua odottava voittaa saapuneen.
       *
       * Molemmat ovat totta — seurue istuu yhä pöydässä — mutta
       * kartalta luetaan sitä mikä on seuraavaksi tapahtumassa, ei
       * sitä mikä on jo tapahtunut.
       */
      const tila =
        current.status !== "arrived"
          ? ("late" as const)
          : current.billRequestedAt
            ? ("billing" as const)
            : ("seated" as const);

      return {
        table,
        state: tila,
        reservation: current,
        reservations: mine,
      };
    }

    /*
     * Siivottavana: edellinen varaus päättyi tyhjennysvälin sisällä.
     *
     * Sama luku jolla varausmoottori jättää väliä kahden seurueen
     * välille. Jos väliä ei ole asetettu, tilaa ei ole olemassa —
     * pöytä on vapaa heti.
     */
    if (turnaroundMs > 0) {
      const justEnded = mine.some((r) => {
        if (r.status === "cancelled" || r.status === "no_show") return false;
        const ended = Date.parse(r.endsAt);
        return ended <= nowMs && nowMs - ended < turnaroundMs;
      });

      if (justEnded) {
        return {
          table,
          state: "cleaning" as const,
          reservation: null,
          reservations: mine,
        };
      }
    }

    const next = blocking.find((r) => Date.parse(r.startsAt) > nowMs);
    if (next) {
      return {
        table,
        state: "reserved" as const,
        reservation: next,
        reservations: mine,
      };
    }

    return {
      table,
      state: "free" as const,
      reservation: null,
      reservations: mine,
    };
  });
}

// ---------------------------------------------------------------------------
// Listan järjestys ja tiivistelmä
// ---------------------------------------------------------------------------

/**
 * Peruttu ja saapumatta jäänyt varaus listan loppuun.
 *
 * Ne kuuluvat listaan — vuoropäällikön on nähtävä että aika oli varattu
 * ja vapautui — mutta eivät illan kulkuun. Aikajärjestys ylhäällä on
 * se jota salissa luetaan.
 */
const STATUS_ORDER: Record<ReservationStatus, number> = {
  arrived: 0,
  confirmed: 0,
  pending: 0,
  completed: 1,
  no_show: 2,
  cancelled: 2,
};

export function sortForService(reservations: Reservation[]): Reservation[] {
  return [...reservations].sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (order !== 0) return order;
    return (
      a.startsAt.localeCompare(b.startsAt) ||
      a.guestName.localeCompare(b.guestName)
    );
  });
}

export interface DaySummary {
  /** Varauksia jotka vielä vaikuttavat iltaan. */
  active: number;
  /** Odotettuja vieraita yhteensä. */
  guests: number;
  arrived: number;
  cancelled: number;
  noShow: number;
  walkIns: number;
}

export function summarise(reservations: Reservation[]): DaySummary {
  const live = reservations.filter(
    (r) => r.status !== "cancelled" && r.status !== "no_show",
  );

  return {
    active: live.length,
    guests: live.reduce((sum, r) => sum + r.partySize, 0),
    arrived: reservations.filter(
      (r) => r.status === "arrived" || r.status === "completed",
    ).length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
    noShow: reservations.filter((r) => r.status === "no_show").length,
    walkIns: live.filter((r) => r.source === "walk_in").length,
  };
}

/**
 * Mitkä tilat ovat seuraava luonteva askel.
 *
 * Vuoropäällikkö ei tarvitse kuutta painiketta vaan sen yhden joka on
 * seuraavaksi vuorossa: tuleva seurue saapuu, saapunut lähtee. Loput
 * ovat poikkeuksia ja löytyvät muokkauksesta.
 */
export function nextStatuses(status: ReservationStatus): ReservationStatus[] {
  switch (status) {
    case "pending":
    case "confirmed":
      return ["arrived", "no_show", "cancelled"];
    case "arrived":
      return ["completed", "cancelled"];
    case "completed":
      return ["arrived"];
    case "no_show":
    case "cancelled":
      return ["confirmed"];
  }
}
