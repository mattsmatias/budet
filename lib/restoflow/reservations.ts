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
  | "pending"
  | "confirmed"
  | "arrived"
  | "completed"
  | "cancelled"
  | "no_show";

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
}

export interface Reservation {
  id: string;
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
  tableIds: string[];
}

export interface ReservationSettings {
  enabled: boolean;
  slotMinutes: number;
  defaultDurationMinutes: number;
  turnaroundMinutes: number;
  minParty: number;
  maxParty: number;
}

export interface ReservationDay {
  date: string;
  timezone: string;
  canManage: boolean;
  settings: ReservationSettings | null;
  areas: DiningArea[];
  tables: RestaurantTable[];
  reservations: Reservation[];
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
}

export const DEFAULT_SETTINGS: FullSettings = {
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

export interface ReservationSetup {
  settings: FullSettings;
  hours: ReservationHour[];
  durations: ReservationDuration[];
  exceptions: ReservationException[];
  areas: DiningArea[];
  tables: RestaurantTable[];
  combinations: TableCombination[];
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
export function tableStates(
  day: ReservationDay,
  now: Date,
): TableStatus[] {
  const turnaroundMs = (day.settings?.turnaroundMinutes ?? 0) * 60_000;
  const nowMs = now.getTime();

  return day.tables.map((table) => {
    const mine = day.reservations
      .filter((r) => r.tableIds.includes(table.id))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    if (!table.active) {
      return { table, state: "disabled" as const, reservation: null, reservations: mine };
    }

    const blocking = mine.filter((r) => BLOCKING_STATUSES.includes(r.status));

    const current = blocking.find(
      (r) =>
        Date.parse(r.startsAt) <= nowMs && Date.parse(r.endsAt) > nowMs,
    );

    if (current) {
      return {
        table,
        state: current.status === "arrived" ? ("seated" as const) : ("late" as const),
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
        return { table, state: "cleaning" as const, reservation: null, reservations: mine };
      }
    }

    const next = blocking.find((r) => Date.parse(r.startsAt) > nowMs);
    if (next) {
      return { table, state: "reserved" as const, reservation: next, reservations: mine };
    }

    return { table, state: "free" as const, reservation: null, reservations: mine };
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
    return a.startsAt.localeCompare(b.startsAt) || a.guestName.localeCompare(b.guestName);
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
