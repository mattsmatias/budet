/**
 * Varausanalytiikan laskenta.
 *
 * Kanta palauttaa lukumääriä, tämä tekee niistä osuuksia ja havaintoja.
 * Jako on siinä, että lukumäärä on tosiasia ja osuus on tulkinta:
 * "kaksi peruutusta" on sama luku aina, mutta "kahdeksan prosenttia"
 * riippuu siitä mitä jaetaan millä — ja se päätös kuuluu yhteen
 * paikkaan jossa sen voi lukea ja testata.
 *
 * ---------------------------------------------------------------------
 * HAVAINTO SANOO MIHIN LUKUUN SE PERUSTUU
 * ---------------------------------------------------------------------
 *
 * Havainnot lasketaan aineistosta eikä keksitä. Tämä moduuli palauttaa
 * niistä rakenteen — viikonpäivä, tunnit, luku — eikä valmista
 * lausetta, koska sama havainto näytetään kuudella kielellä.
 *
 * Havainto vaatii aina riittävän aineiston. Yhdestä perjantaista ei
 * seuraa "perjantaisin", ja kolmesta varauksesta ei seuraa
 * peruutusprosenttia. Kynnykset ovat alla vakioina ja perusteltuina.
 * Ilman niitä tämä olisi älykkään näköinen käyttöliittymä, joka
 * kertoo satunnaisvaihtelusta kuin se olisi ilmiö.
 */

// ---------------------------------------------------------------------------
// Kannan palauttama muoto
// ---------------------------------------------------------------------------

export interface StatsTotals {
  reservations: number;
  cancelled: number;
  noShow: number;
  realised: number;
  upcoming: number;
  guests: number;
  partySum: number;
  partyCount: number;
}

export interface StatsCapacity {
  seats: number;
  tables: number;
}

export interface StatsHour {
  hour: number;
  reservations: number;
  guests: number;
}

export interface StatsWeekday {
  /** 1 = maanantai, 7 = sunnuntai. */
  weekday: number;
  reservations: number;
  guests: number;
  /** Kalenteripäiviä jaksossa. */
  days: number;
  /** Niistä auki olleita. */
  openDays: number;
}

export interface StatsOccupancy {
  weekday: number;
  hour: number;
  /** Käytössä olleet paikat keskimäärin. */
  seats: number;
  /** Montako aukiolopäivää keskiarvossa on. */
  days: number;
}

export interface StatsSource {
  source: string;
  count: number;
}

export interface ReservationStats {
  from: string;
  to: string;
  days: number;
  capacity: StatsCapacity;
  totals: StatsTotals;
  bySource: StatsSource[];
  byHour: StatsHour[];
  byWeekday: StatsWeekday[];
  occupancy: StatsOccupancy[];
}

// ---------------------------------------------------------------------------
// Kynnykset
// ---------------------------------------------------------------------------

/**
 * Milloin luvusta saa puhua.
 *
 * MIN_FOR_RATE: kymmenen varausta. Yhdellä peruutuksella viidestä on
 * kahdenkymmenen prosentin peruutusaste, ja se on satunnaisuutta eikä
 * ilmiö.
 *
 * MIN_DAYS_FOR_PATTERN: kaksi samaa viikonpäivää. "Perjantaisin"
 * tarkoittaa useampaa perjantaita.
 *
 * QUIET_RATE: neljäsosa paikoista. Tätä tyhjempi aukiolotunti on
 * käyttämätöntä kapasiteettia siinä mielessä että siihen mahtuisi
 * kokonainen toinen palvelu.
 *
 * NEAR_PEAK: huipun ympärille otetaan tunnit jotka ovat vähintään
 * yhdeksän kymmenesosaa huipusta. Se tekee huipusta ajanjakson eikä
 * yksittäisen tunnin — ravintolassa ruuhka kestää, ei osu.
 */
export const MIN_FOR_RATE = 10;
export const MIN_DAYS_FOR_PATTERN = 2;
export const QUIET_RATE = 0.25;
export const NEAR_PEAK = 0.9;

/**
 * Varauksia viikonpäivää kohti ennen kuin siitä puhutaan kuviona.
 *
 * Kahdesta varauksesta viiden sunnuntain jaksolla saa laskettua
 * täyttöasteen, ja se on laskuna oikein — mutta lause "sunnuntaisin"
 * väittää tavasta, ja tapaa ei näe kahdesta illasta. Ilman tätä rajaa
 * yhden seurueen päätös näyttäisi ravintolan rytmiltä.
 */
export const MIN_FOR_PATTERN = 5;

/** Peruutusaste josta kannattaa mainita. */
export const CANCEL_WATCH = 0.15;

/** No-show-aste josta kannattaa mainita. */
export const NO_SHOW_WATCH = 0.05;

// ---------------------------------------------------------------------------
// Osuudet
// ---------------------------------------------------------------------------

/**
 * Nolla jakajana on tyhjä eikä nolla.
 *
 * Nolla prosenttia ja "ei tiedetä" näyttävät käyttöliittymässä samalta
 * vain jos ne käsketään näyttää samalta. Tyhjä jakaja palautetaan
 * null:na, jotta näkymä voi jättää rivin väliin sen sijaan että se
 * väittäisi jotain.
 */
function osuus(osa: number, kokonaisuus: number): number | null {
  if (!Number.isFinite(osa) || !Number.isFinite(kokonaisuus)) return null;
  if (kokonaisuus <= 0) return null;
  return osa / kokonaisuus;
}

/** Keskimääräinen seuruekoko. Peruutetut eivät ole mukana. */
export function averageParty(totals: StatsTotals): number | null {
  return osuus(totals.partySum, totals.partyCount);
}

/** Peruutusaste kaikista varauksista. */
export function cancellationRate(totals: StatsTotals): number | null {
  return osuus(totals.cancelled, totals.reservations);
}

/**
 * No-show-aste.
 *
 * Jakaja on varaukset joita ei peruttu. Peruttu varaus ei voi jäädä
 * saapumatta — se peruttiin — ja jos peruutukset olisivat jakajassa,
 * hyvin toimiva peruutuslinkki laskisi no-show-prosenttia ilman että
 * yksikään pöytä jäi tyhjäksi vähemmän.
 */
export function noShowRate(totals: StatsTotals): number | null {
  return osuus(totals.noShow, totals.reservations - totals.cancelled);
}

/** Täyttöaste yhdelle tunnille. */
export function occupancyRate(
  row: StatsOccupancy,
  capacity: StatsCapacity,
): number | null {
  return osuus(row.seats, capacity.seats);
}

/** Varauksia keskimäärin yhtenä aukiolopäivänä. */
export function perOpenDay(row: StatsWeekday): number | null {
  return osuus(row.reservations, row.openDays);
}

// ---------------------------------------------------------------------------
// Järjestykset
// ---------------------------------------------------------------------------

/**
 * Suosituimmat kellonajat.
 *
 * Järjestys varausten määrän mukaan, tasatilanteessa aikaisempi ensin:
 * jos kello 18 ja 19 ovat yhtä suosittuja, illan kerrotaan alkavan
 * kuudelta.
 */
export function busiestHours(stats: ReservationStats, limit = 3): StatsHour[] {
  return [...stats.byHour]
    .filter((row) => row.reservations > 0)
    .sort((a, b) => b.reservations - a.reservations || a.hour - b.hour)
    .slice(0, Math.max(0, limit));
}

/**
 * Suosituimmat päivät.
 *
 * Vertailu on varauksia per aukiolopäivä eikä yhteismäärä. Kahden
 * kuukauden jaksossa perjantaita ja lauantaita on yhtä monta, mutta
 * jos toinen oli kesäkuun kiinni, yhteismäärä palkitsee sen päivän
 * joka sattui olemaan auki useammin.
 */
export function busiestWeekdays(
  stats: ReservationStats,
  limit = 3,
): StatsWeekday[] {
  return [...stats.byWeekday]
    .filter((row) => row.reservations > 0 && row.openDays > 0)
    .sort((a, b) => {
      const ka = perOpenDay(a) ?? 0;
      const kb = perOpenDay(b) ?? 0;
      return kb - ka || a.weekday - b.weekday;
    })
    .slice(0, Math.max(0, limit));
}

/** Yhden viikonpäivän täyttöasterivit tunnin mukaan. */
export function occupancyForWeekday(
  stats: ReservationStats,
  weekday: number,
): StatsOccupancy[] {
  return stats.occupancy
    .filter((row) => row.weekday === weekday)
    .sort((a, b) => a.hour - b.hour);
}

// ---------------------------------------------------------------------------
// Ruuhka ja hiljaisuus
// ---------------------------------------------------------------------------

export interface Window {
  weekday: number;
  /** Ensimmäinen tunti mukaan lukien. */
  fromHour: number;
  /** Viimeinen tunti mukaan lukien. */
  toHour: number;
  /** Keskimääräinen täyttöaste ikkunassa, 0–1. */
  rate: number;
  /** Montako päivää keskiarvon takana on. */
  days: number;
}

/**
 * Viikonpäivän ruuhka-aika.
 *
 * Haetaan täysin tunti ja laajennetaan molempiin suuntiin niin kauan
 * kuin naapuritunti on vähintään NEAR_PEAK huipusta. Tulos on
 * ajanjakso — "klo 18–20" — koska ruuhka on ajanjakso.
 *
 * Palauttaa null jos päivää ei ollut auki tarpeeksi usein tai salissa
 * ei ole paikkoja: kumpikaan ei ole hiljainen ilta, vaan puuttuva
 * tieto.
 */
export function peakWindow(
  stats: ReservationStats,
  weekday: number,
): Window | null {
  if (stats.capacity.seats <= 0) return null;

  const rivit = occupancyForWeekday(stats, weekday).filter(
    (row) => row.days >= MIN_DAYS_FOR_PATTERN,
  );
  if (rivit.length === 0) return null;

  const asteet = rivit.map((row) => row.seats / stats.capacity.seats);
  let huippu = 0;
  for (let i = 1; i < asteet.length; i += 1) {
    if (asteet[i] > asteet[huippu]) huippu = i;
  }

  const raja = asteet[huippu] * NEAR_PEAK;
  if (asteet[huippu] <= 0) return null;

  let alku = huippu;
  while (alku > 0 && asteet[alku - 1] >= raja) alku -= 1;

  let loppu = huippu;
  while (loppu < asteet.length - 1 && asteet[loppu + 1] >= raja) loppu += 1;

  const mukana = asteet.slice(alku, loppu + 1);
  const keskiarvo = mukana.reduce((a, b) => a + b, 0) / mukana.length;

  return {
    weekday,
    fromHour: rivit[alku].hour,
    toHour: rivit[loppu].hour,
    rate: keskiarvo,
    days: Math.min(...rivit.slice(alku, loppu + 1).map((row) => row.days)),
  };
}

/**
 * Ruuhkan jälkeinen hiljainen aika.
 *
 * Vain huipun jälkeen: aukiolon alussa hiljaista on aina, eikä siitä
 * seuraa mitään. Illan loppupää sen sijaan on kapasiteettia jota
 * ravintola maksaa mutta ei myy.
 */
export function quietWindow(
  stats: ReservationStats,
  weekday: number,
): Window | null {
  const huippu = peakWindow(stats, weekday);
  if (!huippu) return null;

  const rivit = occupancyForWeekday(stats, weekday).filter(
    (row) => row.days >= MIN_DAYS_FOR_PATTERN && row.hour > huippu.toHour,
  );
  if (rivit.length === 0) return null;

  const hiljaiset = rivit.filter(
    (row) => row.seats / stats.capacity.seats <= QUIET_RATE,
  );
  if (hiljaiset.length === 0) return null;

  /* Yhtenäinen jakso hiljaisuuden alusta loppuun. */
  const alku = hiljaiset[0];
  const loppu = hiljaiset[hiljaiset.length - 1];
  const asteet = hiljaiset.map((row) => row.seats / stats.capacity.seats);

  return {
    weekday,
    fromHour: alku.hour,
    toHour: loppu.hour,
    rate: asteet.reduce((a, b) => a + b, 0) / asteet.length,
    days: Math.min(...hiljaiset.map((row) => row.days)),
  };
}

// ---------------------------------------------------------------------------
// Havainnot
// ---------------------------------------------------------------------------

export type FindingKind =
  "peak" | "quiet" | "noShow" | "cancelled" | "party" | "online";

export interface StatFinding {
  id: string;
  kind: FindingKind;
  tone: "good" | "neutral" | "watch";
  /** Havainnon luku sellaisenaan. Näkymä muotoilee sen. */
  value: number;
  weekday?: number;
  fromHour?: number;
  toHour?: number;
  /** Kuinka monta havaintoa luvun takana on. */
  sample: number;
}

/**
 * Havainnot aineistosta.
 *
 * Järjestys on merkitsevyys: ruuhka ja hiljaisuus ensin, koska ne
 * koskevat sitä mitä ravintola voi tehdä ensi viikolla. Prosentit
 * sitten, koska ne kertovat mitä on tapahtunut.
 *
 * Tyhjä lista on kelvollinen tulos. Jakso jossa on kolme varausta ei
 * kerro mitään, ja silloin oikea vastaus on olla sanomatta mitään.
 */
export function findingsFor(stats: ReservationStats): StatFinding[] {
  const havainnot: StatFinding[] = [];

  /*
   * Ruuhkaisin viikonpäivä täyttöasteen mukaan.
   *
   * Vain päivät joilla on tarpeeksi varauksia. Täyttöaste lasketaan
   * kaikille, mutta lause "perjantaisin" vaatii useamman perjantain
   * kuin yhden jolloin sattui olemaan seurue.
   */
  const ikkunat = stats.byWeekday
    .filter((row) => row.reservations >= MIN_FOR_PATTERN)
    .map((row) => peakWindow(stats, row.weekday))
    .filter((w): w is Window => w !== null)
    .sort((a, b) => b.rate - a.rate);

  const paras = ikkunat[0];
  if (paras && paras.rate > 0) {
    havainnot.push({
      id: `peak-${paras.weekday}`,
      kind: "peak",
      tone: "good",
      value: paras.rate,
      weekday: paras.weekday,
      fromHour: paras.fromHour,
      /* Loppu on tunnin loppu: 18–19 näytetään "18–20". */
      toHour: paras.toHour + 1,
      sample: paras.days,
    });

    const hiljainen = quietWindow(stats, paras.weekday);
    if (hiljainen) {
      havainnot.push({
        id: `quiet-${hiljainen.weekday}`,
        kind: "quiet",
        tone: "neutral",
        value: hiljainen.rate,
        weekday: hiljainen.weekday,
        fromHour: hiljainen.fromHour,
        toHour: hiljainen.toHour + 1,
        sample: hiljainen.days,
      });
    }
  }

  const t = stats.totals;

  if (t.reservations >= MIN_FOR_RATE) {
    const noShow = noShowRate(t);
    if (noShow !== null && noShow >= NO_SHOW_WATCH) {
      havainnot.push({
        id: "no-show",
        kind: "noShow",
        tone: "watch",
        value: noShow,
        sample: t.reservations - t.cancelled,
      });
    }

    const peruutus = cancellationRate(t);
    if (peruutus !== null && peruutus >= CANCEL_WATCH) {
      havainnot.push({
        id: "cancelled",
        kind: "cancelled",
        tone: "watch",
        value: peruutus,
        sample: t.reservations,
      });
    }

    /*
     * Verkkovarausten osuus.
     *
     * Kertoo kannattaako varauslinkkiä pitää esillä. widget ja link
     * ovat molemmat asiakkaan itse tekemiä: toinen sivun upotuksesta,
     * toinen suorasta osoitteesta.
     */
    const verkosta = stats.bySource
      .filter((row) => row.source === "widget" || row.source === "link")
      .reduce((sum, row) => sum + row.count, 0);

    const osuusVerkosta = osuus(verkosta, t.reservations);
    if (osuusVerkosta !== null && verkosta > 0) {
      havainnot.push({
        id: "online",
        kind: "online",
        tone: "neutral",
        value: osuusVerkosta,
        sample: t.reservations,
      });
    }
  }

  const koko = averageParty(t);
  if (koko !== null && t.partyCount >= MIN_FOR_RATE) {
    havainnot.push({
      id: "party",
      kind: "party",
      tone: "neutral",
      value: koko,
      sample: t.partyCount,
    });
  }

  return havainnot;
}
