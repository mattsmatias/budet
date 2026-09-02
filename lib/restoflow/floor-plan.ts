/**
 * Salin pöytäkartta.
 *
 * Pöytälista kertoo että pöytiä on kaksitoista. Se ei kerro kumpi
 * niistä on ikkunan vieressä, mitkä kaksi ovat vierekkäin, tai mihin
 * kuuden hengen seurue mahtuu. Salissa se nähdään yhdellä silmäyksellä.
 *
 * Tämä tiedosto ei tuo mitään. Sijainti, koko ja varaustilanne ovat
 * laskentaa, ja laskenta on testattavissa vain jos se ei tarvitse
 * selainta eikä kantaa.
 *
 * ---------------------------------------------------------------------
 * KOORDINAATTI ON PROSENTTI, EI PIKSELI
 * ---------------------------------------------------------------------
 *
 * Sama kartta piirretään puhelimen ruudulle ja työpöydän näytölle.
 * Pikselikoordinaatti tarkoittaisi eri paikkaa kummallakin, ja
 * puhelimessa puolet pöydistä olisi ruudun ulkopuolella.
 *
 * Piste on pöydän keskikohta eikä vasen yläkulma. Kun käyttäjä raahaa
 * pöytää, hän ajattelee pöytää eikä sen kulmaa — ja keskikohta pysyy
 * paikallaan myös silloin kun pöydän koko muuttuu paikkaluvun mukana.
 */

export type TableShape = "round" | "square" | "rect";

export interface PlanTable {
  id: string;
  name: string;
  areaId: string | null;
  seatsMin: number;
  seatsMax: number;
  active: boolean;
  /** Keskikohta prosentteina. Null = ei vielä asetettu. */
  posX: number | null;
  posY: number | null;
  shape: TableShape;
  rotation: number;
}

/** Pöydän sijainti kartalla. */
export interface Placement {
  id: string;
  x: number;
  y: number;
  shape: TableShape;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Mitat
// ---------------------------------------------------------------------------

/**
 * Pöydän leveys prosentteina salin leveydestä.
 *
 * Koko johdetaan paikkaluvusta eikä kysytä erikseen. Kahden hengen
 * pöytä on pieni ja kymmenen hengen iso — se on tosiasia salissa, ei
 * mielipide, eikä kukaan halua säätää leveyttä kahdelletoista
 * pöydälle erikseen.
 *
 * Rajat ovat tiukat kummastakin päästä. Alaraja pitää pöydän nimen
 * luettavana, yläraja estää kahdenkymmenen hengen juhlapöytää
 * peittämästä puolta salia.
 */
export function tableWidth(seatsMax: number): number {
  const paikkoja = Number.isFinite(seatsMax) ? seatsMax : 2;

  /* 2 → 8 %, 4 → 10 %, 6 → 12 %, 8 → 14 %, siitä ylöspäin loivemmin. */
  const perus = 7 + Math.sqrt(Math.max(1, paikkoja)) * 2.2;

  return Math.min(16, Math.max(8, Math.round(perus * 10) / 10));
}

/**
 * Leveyden suhde korkeuteen.
 *
 * Pyöreä ja neliö ovat yhtä leveitä kuin korkeita. Suorakaide on
 * pitkä — juuri se erottaa sen neliöstä kartalla, ja juuri siitä
 * tarjoilija tunnistaa pitkän pöydän.
 */
export function aspectFor(shape: TableShape): number {
  return shape === "rect" ? 1.9 : 1;
}

// ---------------------------------------------------------------------------
// Rajaus
// ---------------------------------------------------------------------------

/**
 * Pöydän ulottuvuudet prosentteina, kumpikin omalla akselillaan.
 *
 * Tämä on se kohta jossa on helpointa mennä metsään. Kymmenen
 * prosenttia leveydestä on eri määrä pikseleitä kuin kymmenen
 * prosenttia korkeudesta, joten pyöreä pöytä jonka kummallakin
 * akselilla on "10 %" olisi soikio.
 *
 * widthPerHeight on salin leveys jaettuna korkeudella: 3:2-kartalla
 * se on 1,5. Sillä muunnetaan leveysprosentti korkeusprosentiksi.
 *
 * Kierto vaihtaa ulottuvuudet keskenään. Neljänkymmenenviiden asteen
 * kulmassa kumpikaan ei ole oikein, mutta pöytiä ei käännetä vinoon:
 * käyttöliittymä kääntää neljänneksen kerrallaan.
 */
export function tableExtent(
  widthPercent: number,
  shape: TableShape,
  rotation: number,
  widthPerHeight: number,
): { width: number; height: number } {
  const leveys = widthPercent * aspectFor(shape);
  const korkeus = widthPercent * widthPerHeight;

  const kaannetty = rotation % 180 >= 45 && rotation % 180 < 135;

  return kaannetty
    ? { width: korkeus / widthPerHeight, height: leveys * widthPerHeight }
    : { width: leveys, height: korkeus };
}

/**
 * Pöytä pysyy salissa.
 *
 * Keskikohtaa rajataan pöydän puolikkaalla, jolloin reunimmainenkin
 * pöytä on kokonaan näkyvissä. Ilman rajausta raahaus reunan yli
 * jättäisi pöydän puoliksi ulos, eikä sitä saisi enää kiinni.
 */
export function clampToRoom(
  x: number,
  y: number,
  widthPercent: number,
  shape: TableShape,
  /** Salin leveys jaettuna korkeudella. 3:2-kartalla 1,5. */
  widthPerHeight: number,
  rotation = 0,
): { x: number; y: number } {
  const { width, height } = tableExtent(
    widthPercent,
    shape,
    rotation,
    widthPerHeight,
  );

  const puoliLeveys = width / 2;
  const puoliKorkeus = height / 2;

  /*
   * Jos pöytä on salia suurempi, keskitä se.
   *
   * Muuten Math.min ja Math.max menisivät ristiin ja pöytä
   * hyppäisi nurkkaan. Tätä ei pitäisi tapahtua — tableWidth
   * rajaa koon kuuteentoista prosenttiin — mutta rajaus joka
   * hajoaa mahdottomalla syötteellä hajoaa jonain päivänä.
   */
  return {
    x:
      puoliLeveys * 2 >= 100
        ? 50
        : Math.min(100 - puoliLeveys, Math.max(puoliLeveys, x)),
    y:
      puoliKorkeus * 2 >= 100
        ? 50
        : Math.min(100 - puoliKorkeus, Math.max(puoliKorkeus, y)),
  };
}

/** Prosentti kahden desimaalin tarkkuudella, 0–100. */
export function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

// ---------------------------------------------------------------------------
// Automaattinen asettelu
// ---------------------------------------------------------------------------

/**
 * Paikat pöydille joilla ei ole vielä paikkaa.
 *
 * Ravintola joka ei ole koskaan avannut karttaa näkee silti kartan.
 * Tyhjä ruutu ja kehotus "raahaa pöydät paikoilleen" olisi työ jonka
 * saa tehdä ennen kuin näkee siitä mitään hyötyä — ja siksi sitä ei
 * tehtäisi.
 *
 * Rivit ja sarakkeet eivät ole arvaus salin muodosta. Ne ovat
 * lähtöasetelma jonka päälle käyttäjä siirtää pöydät oikeille
 * paikoilleen, ja siihen ruudukko on paras: siinä on kaikki näkyvissä
 * eikä mikään ole toistensa päällä.
 */
export function autoLayout(
  tables: PlanTable[],
): Map<string, { x: number; y: number }> {
  const sijoitettavat = tables.filter(
    (table) => table.posX === null || table.posY === null,
  );

  const paikat = new Map<string, { x: number; y: number }>();
  if (sijoitettavat.length === 0) return paikat;

  /* Neliömäinen ruudukko: 4 pöytää → 2×2, 12 pöytää → 4×3. */
  const sarakkeita = Math.max(1, Math.ceil(Math.sqrt(sijoitettavat.length)));
  const riveja = Math.ceil(sijoitettavat.length / sarakkeita);

  sijoitettavat.forEach((table, index) => {
    const sarake = index % sarakkeita;
    const rivi = Math.floor(index / sarakkeita);

    paikat.set(table.id, {
      x: roundPercent(((sarake + 0.5) / sarakkeita) * 100),
      y: roundPercent(((rivi + 0.5) / riveja) * 100),
    });
  });

  return paikat;
}

/**
 * Kartan pöydät valmiina piirrettäviksi.
 *
 * Yhdistää tallennetut paikat ja automaattiset. Kutsuja ei tiedä
 * kummasta paikka tuli, eikä sen tarvitse: kartta näyttää samalta.
 */
export function placementsFor(tables: PlanTable[]): Placement[] {
  const automaattiset = autoLayout(tables);

  return tables.map((table) => {
    const auto = automaattiset.get(table.id);

    return {
      id: table.id,
      x: table.posX ?? auto?.x ?? 50,
      y: table.posY ?? auto?.y ?? 50,
      shape: table.shape,
      rotation: table.rotation,
    };
  });
}

// ---------------------------------------------------------------------------
// Varaustilanne
// ---------------------------------------------------------------------------

export type TableState = "free" | "reserved" | "seated" | "inactive";

export interface PlanReservation {
  id: string;
  time: string;
  endTime: string;
  status: string;
  partySize: number;
  guestName: string;
  tableIds: string[];
}

/**
 * Pöydän tila tiettynä hetkenä.
 *
 * Kolme tilaa kolmelle kysymykselle: onko vapaa, onko varattu, onko
 * seurue jo pöydässä. Neljäs — pois käytöstä — ei ole tila vaan
 * ravintolan päätös, ja se näkyy toisin.
 *
 * Peruttu varaus ei varaa pöytää. Se on merkintä siitä että joku
 * aikoi tulla, ja pöytä on vapaa.
 */
export function tableStateAt(
  table: PlanTable,
  reservations: PlanReservation[],
  time: string,
): TableState {
  if (!table.active) return "inactive";

  const osuvat = reservations.filter(
    (row) =>
      row.tableIds.includes(table.id) &&
      row.status !== "cancelled" &&
      row.status !== "no_show" &&
      overlaps(row, time),
  );

  if (osuvat.length === 0) return "free";

  /* Paikalla oleva seurue voittaa: se on se mitä salissa näkyy. */
  return osuvat.some((row) => row.status === "arrived") ? "seated" : "reserved";
}

/**
 * Onko varaus käynnissä annettuna kellonaikana.
 *
 * Alku mukaan, loppu ei. Kello 20:00 päättyvä varaus ei enää varaa
 * pöytää kello 20:00 alkavalta seurueelta — se on juuri se hetki
 * jolloin pöytä vaihtaa omistajaa.
 */
function overlaps(reservation: PlanReservation, time: string): boolean {
  return reservation.time <= time && time < reservation.endTime;
}

/** Varaukset jotka koskevat pöytää annettuna hetkenä. */
export function reservationsAt(
  tableId: string,
  reservations: PlanReservation[],
  time: string,
): PlanReservation[] {
  return reservations.filter(
    (row) =>
      row.tableIds.includes(tableId) &&
      row.status !== "cancelled" &&
      row.status !== "no_show" &&
      overlaps(row, time),
  );
}

/**
 * Illan kellonajat joina kartalla tapahtuu jotain.
 *
 * Aikajana rakennetaan varausten alkuajoista eikä tasatunneista:
 * ravintolassa on merkitystä sillä hetkellä kun pöytä vaihtuu, ei
 * sillä että kello on tasan.
 *
 * Järjestys ja kaksoiskappaleiden poisto tehdään täällä, koska
 * järjestämätön aikajana on aikajana vain nimeltä.
 */
export function planTimes(reservations: PlanReservation[]): string[] {
  const ajat = new Set<string>();

  for (const row of reservations) {
    if (row.status === "cancelled" || row.status === "no_show") continue;
    ajat.add(row.time);
  }

  return [...ajat].sort();
}

// ---------------------------------------------------------------------------
// Yhteenveto
// ---------------------------------------------------------------------------

export interface PlanSummary {
  tables: number;
  free: number;
  reserved: number;
  seated: number;
  /** Paikkoja vapaissa pöydissä. */
  freeSeats: number;
}

/**
 * Salin tilanne lukuina.
 *
 * "Kuusi pöytää vapaana, 22 paikkaa" vastaa siihen mitä puhelimeen
 * vastataan ennen kuin kartta ehditään katsoa.
 */
export function summarise(
  tables: PlanTable[],
  reservations: PlanReservation[],
  time: string,
): PlanSummary {
  let free = 0;
  let reserved = 0;
  let seated = 0;
  let freeSeats = 0;

  for (const table of tables) {
    const tila = tableStateAt(table, reservations, time);

    if (tila === "free") {
      free += 1;
      freeSeats += table.seatsMax;
    } else if (tila === "reserved") {
      reserved += 1;
    } else if (tila === "seated") {
      seated += 1;
    }
  }

  return {
    tables: tables.filter((table) => table.active).length,
    free,
    reserved,
    seated,
    freeSeats,
  };
}

// ---------------------------------------------------------------------------
// Kalusteet
// ---------------------------------------------------------------------------

export type ElementKind =
  "wall" | "bar" | "kitchen" | "wc" | "door" | "entrance" | "other";

export interface FloorElement {
  id: string;
  areaId: string | null;
  kind: ElementKind;
  label: string;
  /** Keskikohta prosentteina. */
  posX: number;
  posY: number;
  /** Leveys prosentteina salin leveydestä. */
  width: number;
  /** Korkeus prosentteina salin korkeudesta. */
  height: number;
  rotation: number;
}

/**
 * Uuden kalusteen lähtömitat.
 *
 * Seinä on pitkä ja ohut, baari leveä ja matala, vessa pieni laatikko.
 * Nämä eivät ole oikeita mittoja vaan tunnistettavia muotoja: käyttäjä
 * venyttää ne kohdalleen, ja lähtökoko on siinä auttamassa eikä
 * arvaamassa.
 */
export function defaultElementSize(kind: ElementKind): {
  width: number;
  height: number;
} {
  switch (kind) {
    case "wall":
      return { width: 40, height: 3 };
    case "bar":
      return { width: 30, height: 10 };
    case "kitchen":
      return { width: 25, height: 20 };
    case "wc":
      return { width: 12, height: 14 };
    case "door":
    case "entrance":
      return { width: 12, height: 4 };
    default:
      return { width: 18, height: 12 };
  }
}

/**
 * Kaluste pysyy salissa.
 *
 * Sama sääntö kuin pöydillä, mutta mitat ovat suoraan prosentteja
 * kummallakin akselilla — kalusteella ei ole kuvasuhdetta jota
 * pitäisi muuntaa.
 */
export function clampElement(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const puoliLeveys = Math.min(50, width / 2);
  const puoliKorkeus = Math.min(50, height / 2);

  return {
    x: Math.min(100 - puoliLeveys, Math.max(puoliLeveys, x)),
    y: Math.min(100 - puoliKorkeus, Math.max(puoliKorkeus, y)),
  };
}

// ---------------------------------------------------------------------------
// Tuolit
// ---------------------------------------------------------------------------

export interface ChairSpot {
  /** Sijainti pöydän laatikossa, 0–100 % pöydän omasta koosta. */
  x: number;
  y: number;
}

/**
 * Tuolien paikat pöydän ympärillä.
 *
 * Tuolit eivät ole tietoa vaan piirrosta: ne kertovat yhdellä
 * silmäyksellä montako henkeä pöytään mahtuu, ilman että lukua
 * tarvitsee lukea. Siksi ne johdetaan paikkaluvusta eikä tallenneta.
 *
 * Pyöreässä pöydässä tuolit ovat kehällä, kulmikkaassa sivuilla.
 * Kulmikkaan jako on pitkille sivuille painottuva, koska niin ne
 * salissakin asetetaan — kahdeksan hengen pöydässä istuu kolme
 * kummallakin pitkällä sivulla ja yksi kummassakin päässä.
 */
export function chairSpots(seats: number, shape: TableShape): ChairSpot[] {
  const maara = Math.max(0, Math.min(20, Math.round(seats)));
  if (maara === 0) return [];

  if (shape === "round") {
    return Array.from({ length: maara }, (_, i) => {
      const kulma = (i / maara) * Math.PI * 2 - Math.PI / 2;

      /*
       * Kehä hieman pöydän reunan ulkopuolella.
       *
       * Pöydän säde on 50, joten 58 asettaa tuolin reunaa vasten
       * mutta ei irralleen. Kauempana ne alkavat näyttää omilta
       * pöydiltään tiheässä salissa.
       */
      return {
        x: 50 + Math.cos(kulma) * 58,
        y: 50 + Math.sin(kulma) * 58,
      };
    });
  }

  /*
   * Kulmikas: ensin päädyt, loput jaetaan pitkille sivuille.
   *
   * Kahden hengen pöytä on kaksi tuolia vastakkain, ja se on
   * ravintolan yleisin pöytä — se on siis se tapaus jonka on
   * näytettävä oikealta.
   */
  if (maara <= 2) {
    return Array.from({ length: maara }, (_, i) => ({
      x: i === 0 ? -8 : 108,
      y: 50,
    }));
  }

  const paadyt = maara >= 6 ? 2 : 0;
  const sivuille = maara - paadyt;
  const ylos = Math.ceil(sivuille / 2);
  const alas = sivuille - ylos;

  const spots: ChairSpot[] = [];

  for (let i = 0; i < ylos; i++) {
    spots.push({ x: ((i + 0.5) / ylos) * 100, y: -10 });
  }
  for (let i = 0; i < alas; i++) {
    spots.push({ x: ((i + 0.5) / alas) * 100, y: 110 });
  }
  if (paadyt === 2) {
    spots.push({ x: -8, y: 50 });
    spots.push({ x: 108, y: 50 });
  }

  return spots;
}
