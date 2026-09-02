/**
 * Varauskalenterin laskenta.
 *
 * Lista kertoo kuka tulee ja milloin. Se ei kerro onko kello 19
 * ruuhkaa vai onko puoli salia tyhjänä, eikä sitä että pöytä 7 on
 * varattu kahdesti peräkkäin viidentoista minuutin välein.
 *
 * Aikajana kertoo molemmat yhdellä silmäyksellä, koska se piirtää
 * ajan pituutena eikä numerona.
 *
 * ---------------------------------------------------------------------
 * MINUUTTI ON YKSIKKÖ, PIKSELI ON PIIRTOA
 * ---------------------------------------------------------------------
 *
 * Kaikki tässä tiedostossa on minuutteja keskiyöstä. Sijainti
 * palautetaan prosentteina, koska sama kalenteri piirretään
 * puhelimeen ja työpöydälle — pikseli tarkoittaisi eri kohtaa
 * kummallakin.
 *
 * Tiedosto ei tuo mitään. Aikajana, päällekkäisyys ja siirron
 * kelpoisuus ovat laskentaa, ja laskenta on testattavissa vain jos se
 * ei tarvitse selainta.
 */

export interface CalendarReservation {
  id: string;
  /** "18:30" ravintolan aikavyöhykkeellä. */
  time: string;
  endTime: string;
  status: string;
  partySize: number;
  guestName: string;
  tableIds: string[];
}

export interface CalendarTable {
  id: string;
  name: string;
  areaId: string | null;
  active: boolean;
  seatsMax: number;
}

// ---------------------------------------------------------------------------
// Aika
// ---------------------------------------------------------------------------

/**
 * "18:30" → 1110.
 *
 * Kelvoton syöte palautuu nollana eikä NaN:na: NaN leviää joka
 * laskutoimitukseen ja päätyy tyyliattribuuttiin, jossa se katoaa
 * hiljaa. Nolla näkyy väärässä paikassa, ja väärässä paikassa oleva
 * palkki huomataan.
 */
export function minutesOf(time: string): number {
  const osat = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!osat) return 0;

  const tunnit = Number(osat[1]);
  const minuutit = Number(osat[2]);

  if (!Number.isFinite(tunnit) || !Number.isFinite(minuutit)) return 0;

  return Math.max(0, Math.min(24 * 60, tunnit * 60 + minuutit));
}

/** 1110 → "18:30". */
export function timeOf(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const tunnit = Math.floor(m / 60) % 24;
  const minuutit = m % 60;

  return `${String(tunnit).padStart(2, "0")}:${String(minuutit).padStart(2, "0")}`;
}

/**
 * Kesto minuutteina, keskiyön yli menevä mukaan lukien.
 *
 * Ravintola sulkee kello 01:00, ja silloin varaus 23:00–01:00 on
 * kaksi tuntia eikä miinus kaksikymmentäkaksi. Loppuaika joka on
 * alkuaikaa pienempi tarkoittaa seuraavaa päivää.
 */
export function durationOf(start: string, end: string): number {
  const alku = minutesOf(start);
  const loppu = minutesOf(end);

  return loppu >= alku ? loppu - alku : loppu + 24 * 60 - alku;
}

// ---------------------------------------------------------------------------
// Aikajana
// ---------------------------------------------------------------------------

export interface Axis {
  /** Ensimmäinen minuutti jonka kalenteri näyttää. */
  from: number;
  /** Viimeinen minuutti. */
  to: number;
  /** Tuntiviivojen minuutit. */
  ticks: number[];
}

/**
 * Kalenterin ylä- ja alaraja.
 *
 * Lähtökohta on aukioloaika, mutta se ei riitä: walk-in kirjataan
 * usein aukioloajan ulkopuolelle, ja varaus jota ei näy on pahempi
 * kuin liian pitkä aikajana.
 *
 * Rajat pyöristetään tasatunteihin, jotta viivat osuvat kohdalleen.
 * Tunnin marginaali molempiin päihin antaa tilaa raahata varausta
 * hieman aiemmaksi tai myöhemmäksi.
 */
export function axisFor(
  reservations: CalendarReservation[],
  hours: { opens: string; lastSeating: string } | null,
): Axis {
  const alut: number[] = [];
  const loput: number[] = [];

  if (hours) {
    alut.push(minutesOf(hours.opens));
    /* Viimeinen istumisaika ei ole sulkemisaika: illallinen jatkuu. */
    loput.push(minutesOf(hours.lastSeating) + 120);
  }

  for (const row of reservations) {
    const alku = minutesOf(row.time);
    alut.push(alku);
    loput.push(alku + durationOf(row.time, row.endTime));
  }

  /* Tyhjä päivä ilman aukioloaikoja: tavallinen ravintolailta. */
  if (alut.length === 0) {
    alut.push(11 * 60);
    loput.push(23 * 60);
  }

  const from = Math.max(0, Math.floor((Math.min(...alut) - 60) / 60) * 60);
  const to = Math.min(24 * 60, Math.ceil((Math.max(...loput) + 60) / 60) * 60);

  const ticks: number[] = [];
  for (let m = from; m <= to; m += 60) ticks.push(m);

  return { from, to: Math.max(to, from + 60), ticks };
}

/**
 * Palkin sijainti aikajanalla prosentteina.
 *
 * Aikajanan ulkopuolelle jäävä osa leikataan: varaus joka alkaa
 * ennen janan alkua piirretään janan alusta, ei sen yläpuolelta.
 * Ilman leikkausta palkki nousisi otsikkorivin päälle.
 *
 * Vähimmäiskorkeus on kaksi prosenttia. Viidentoista minuutin varaus
 * kymmenen tunnin janalla on kaksi ja puoli prosenttia, ja sitä
 * lyhyempi katoaisi kokonaan — myös hiiren alta.
 */
export function blockPosition(
  reservation: CalendarReservation,
  axis: Axis,
): { top: number; height: number } {
  const pituus = Math.max(1, axis.to - axis.from);

  const alku = minutesOf(reservation.time);
  const loppu = alku + durationOf(reservation.time, reservation.endTime);

  const rajattuAlku = Math.max(axis.from, Math.min(axis.to, alku));
  const rajattuLoppu = Math.max(axis.from, Math.min(axis.to, loppu));

  return {
    top: ((rajattuAlku - axis.from) / pituus) * 100,
    height: Math.max(2, ((rajattuLoppu - rajattuAlku) / pituus) * 100),
  };
}

/**
 * Osoittimen pystysijainti minuuteiksi.
 *
 * Pyöristys viiteen minuuttiin: raahaus ei osu pikselilleen, eikä
 * kukaan varaa pöytää kello 18:47. Karkeampi askel olisi tarkempi
 * mutta estäisi vartin siirron, joka on se mitä salissa tehdään.
 */
export function minutesAt(
  fraction: number,
  axis: Axis,
  stepMinutes = 5,
): number {
  const raaka = axis.from + fraction * (axis.to - axis.from);
  const askel = Math.max(1, stepMinutes);

  return Math.max(
    axis.from,
    Math.min(axis.to, Math.round(raaka / askel) * askel),
  );
}

// ---------------------------------------------------------------------------
// Päällekkäisyys
// ---------------------------------------------------------------------------

/**
 * Varaus joka ei varaa pöytää.
 *
 * Peruttu ja saapumatta jäänyt ovat merkintöjä siitä että joku aikoi
 * tulla. Ne näkyvät kalenterissa haaleina, mutta ne eivät estä
 * ketään.
 */
export function blocks(status: string): boolean {
  return status !== "cancelled" && status !== "no_show";
}

/**
 * Menevätkö kaksi varausta päällekkäin ajallisesti.
 *
 * Loppuhetki ei ole päällekkäisyys: kello 20:00 päättyvä ja 20:00
 * alkava ovat peräkkäin, ja juuri niin pöydät kierrätetään.
 *
 * Tyhjennysväli on erikseen. Se on ravintolan toive siitä ettei
 * seuraava seurue istu edellisen lautasten päälle, eikä sitä pidä
 * sekoittaa siihen mikä on fyysisesti mahdotonta.
 */
export function timesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  turnaroundMinutes = 0,
): boolean {
  const vali = Math.max(0, turnaroundMinutes);
  return aStart < bEnd + vali && bStart < aEnd + vali;
}

export interface Conflict {
  reservationId: string;
  guestName: string;
  time: string;
}

/**
 * Estääkö jokin varaus siirron.
 *
 * Palauttaa esteen eikä pelkkää totuusarvoa: käyttöliittymän on
 * voitava sanoa kenen kanssa siirto menee päällekkäin. "Ei onnistu"
 * ilman syytä on virheilmoitus jota kokeillaan uudelleen.
 *
 * Varaus ei estä itseään. Se on koko siirron tarkoitus.
 */
export function conflictFor(input: {
  reservation: CalendarReservation;
  tableIds: string[];
  startMinutes: number;
  durationMinutes: number;
  others: CalendarReservation[];
  turnaroundMinutes?: number;
}): Conflict | null {
  const {
    reservation,
    tableIds,
    startMinutes,
    durationMinutes,
    others,
    turnaroundMinutes = 0,
  } = input;

  if (!blocks(reservation.status)) return null;

  const loppu = startMinutes + Math.max(1, durationMinutes);

  for (const other of others) {
    if (other.id === reservation.id) continue;
    if (!blocks(other.status)) continue;
    if (!other.tableIds.some((id) => tableIds.includes(id))) continue;

    const toinenAlku = minutesOf(other.time);
    const toinenLoppu = toinenAlku + durationOf(other.time, other.endTime);

    if (
      timesOverlap(
        startMinutes,
        loppu,
        toinenAlku,
        toinenLoppu,
        turnaroundMinutes,
      )
    ) {
      return {
        reservationId: other.id,
        guestName: other.guestName,
        time: other.time,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sarakkeet
// ---------------------------------------------------------------------------

/**
 * Kalenterin sarakkeet.
 *
 * Pöydät järjestyksessä, käytöstä poistetut viimeisinä. Ne eivät
 * katoa: niissä voi olla illan varauksia, jotka on tehty ennen kuin
 * pöytä poistettiin käytöstä.
 *
 * Varaus ilman pöytää saa oman sarakkeensa. Ilman sitä se katoaisi
 * kalenterista kokonaan — ja juuri sellainen varaus on se joka pitää
 * muistaa sijoittaa.
 */
export function columnsFor(
  tables: CalendarTable[],
  reservations: CalendarReservation[],
  areaId: string | null,
): { id: string | null; name: string; active: boolean }[] {
  const naytettavat = tables
    .filter((table) => areaId === null || table.areaId === areaId)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name, "fi", { numeric: true });
    })
    .map((table) => ({
      id: table.id as string | null,
      name: table.name,
      active: table.active,
    }));

  const sijoittamattomia = reservations.some(
    (row) => row.tableIds.length === 0 && blocks(row.status),
  );

  return sijoittamattomia
    ? [...naytettavat, { id: null, name: "", active: true }]
    : naytettavat;
}

/**
 * Varaukset sarakkeittain.
 *
 * Sama varaus näkyy jokaisessa pöydässään: yhdistetty 12+13 on kaksi
 * palkkia vierekkäin, ja se on totta — molemmat pöydät ovat varattuja.
 */
export function reservationsInColumn(
  reservations: CalendarReservation[],
  columnId: string | null,
): CalendarReservation[] {
  return reservations
    .filter((row) =>
      columnId === null
        ? row.tableIds.length === 0
        : row.tableIds.includes(columnId),
    )
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
}
