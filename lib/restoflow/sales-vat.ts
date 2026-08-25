/**
 * Myynnin verolaskenta ja kassan täsmäytys.
 *
 * BRUTTO ON SYÖTE, MUU ON JOHDETTUA.
 *
 * Kassan päiväraportti antaa ryhmän myynnin verollisena. Vero
 * irrotetaan siitä takaperin ja veroton on erotus. Toisin päin
 * laskeminen — verottomasta bruttoon — antaisi eri sentin, koska
 * pyöristys tapahtuu eri kohdassa.
 *
 * KANTA ON RIVILLÄ, EI RYHMÄSSÄ.
 *
 * Ryhmän asetus kertoo mitä kantaa uusi rivi käyttää. Kirjattu rivi
 * kantaa oman kantansa mukanaan eikä muutu, vaikka ryhmän asetusta
 * myöhemmin muutettaisiin. Muuten viime vuoden raportti näyttäisi eri
 * luvut kuin silloin kun se lähetettiin kirjanpitoon.
 *
 * PYÖRISTYS TULEE YHDESTÄ PAIKASTA.
 *
 * lib/money.ts. Kaksi eri pyöristystä samasta luvusta tuottaa eron
 * jota ei voi selittää, ja täsmäytys on juuri erojen selittämistä.
 */

import { formatMoney, formatRate, vatFromGross } from "@/lib/money";

export interface SalesGroup {
  id: string;
  name: string;
  /** Verokanta osuutena: 0.14 = 14 %. */
  vatRate: number;
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
}

/** Kassajärjestelmän ryhmänimen kohdistus myyntiryhmään. */
export interface PosMapping {
  id: string;
  posName: string;
  salesGroupId: string;
}

/** Päivän myyntirivi: yksi myyntiryhmä yhtenä päivänä. */
export interface SalesLine {
  salesGroupId: string;
  /** Kanta tapahtumahetkellä. Ei ryhmän nykyinen kanta. */
  vatRate: number;
  grossCents: number;
  vatCents: number;
  netCents: number;
  /** Kassan oma ryhmänimi, jos rivi tuli raportista. */
  posName: string | null;
  /** Kassan ilmoittama ALV tälle kannalle, jos raportti eritteli sen. */
  posVatCents: number | null;
}

/**
 * Brutosta rivi.
 *
 * Ainoa paikka jossa myyntirivin vero ja veroton syntyvät. Kaikki muu
 * lukee tuloksen — laskenta kahdessa paikassa on kaksi laskentaa jotka
 * eroavat toisistaan ennemmin tai myöhemmin.
 */
export function lineFromGross(
  grossCents: number,
  vatRate: number,
): { grossCents: number; vatCents: number; netCents: number } {
  const vatCents = vatFromGross(grossCents, vatRate);

  return {
    grossCents,
    vatCents,
    // Erotuksena eikä netFromGrossilla laskettuna: näin brutto = vero +
    // veroton pitää aina, myös kun pyöristys osuu puolikkaaseen.
    netCents: grossCents - vatCents,
  };
}

/** Sama luku toista tietä. Käytössä kun syöte on veroton summa. */
export function lineFromNet(
  netCents: number,
  vatRate: number,
): { grossCents: number; vatCents: number; netCents: number } {
  const vatCents = Math.round(netCents * vatRate);
  return { grossCents: netCents + vatCents, vatCents, netCents };
}

// ---------------------------------------------------------------------------
// Yhteenveto
// ---------------------------------------------------------------------------

export interface RateTotal {
  vatRate: number;
  grossCents: number;
  vatCents: number;
  netCents: number;
  /** Kassan ilmoittama ALV tälle kannalle, jos se oli raportissa. */
  posVatCents: number | null;
}

export interface SalesSummary {
  grossCents: number;
  vatCents: number;
  netCents: number;
  /** Kannoittain, suurin kanta ensin. */
  byRate: RateTotal[];
}

/**
 * Päivän summat riveistä.
 *
 * Kannoittain eikä ryhmittäin: kaksi ryhmää samalla kannalla on
 * verotuksessa sama asia, ja kassan raportti erittelee ALV:n kannoittain
 * eikä ryhmittäin. Ryhmä on ravintolan oma jäsennys, kanta on verottajan.
 */
export function summarise(lines: SalesLine[]): SalesSummary {
  const rates = new Map<number, RateTotal>();

  for (const line of lines) {
    const current = rates.get(line.vatRate) ?? {
      vatRate: line.vatRate,
      grossCents: 0,
      vatCents: 0,
      netCents: 0,
      posVatCents: null,
    };

    current.grossCents += line.grossCents;
    current.vatCents += line.vatCents;
    current.netCents += line.netCents;

    /*
     * Kassan luku summautuu vain jos se on kaikilla saman kannan
     * riveillä. Yksi puuttuva tekisi summasta vajaan, ja vajaa summa
     * näyttäisi täsmäytyksessä erolta joka ei ole ero.
     */
    if (line.posVatCents !== null) {
      current.posVatCents = (current.posVatCents ?? 0) + line.posVatCents;
    }

    rates.set(line.vatRate, current);
  }

  const byRate = [...rates.values()]
    .map((total) => {
      const complete = lines
        .filter((l) => l.vatRate === total.vatRate)
        .every((l) => l.posVatCents !== null);

      return complete ? total : { ...total, posVatCents: null };
    })
    .sort((a, b) => b.vatRate - a.vatRate);

  return {
    grossCents: sum(lines, (l) => l.grossCents),
    vatCents: sum(lines, (l) => l.vatCents),
    netCents: sum(lines, (l) => l.netCents),
    byRate,
  };
}

// ---------------------------------------------------------------------------
// Täsmäytys
// ---------------------------------------------------------------------------

/**
 * Sallittu heitto.
 *
 * Kassa pyöristää ryhmittäin ja Budet kannoittain, joten sentin heitto
 * on odotettavissa eikä se ole virhe. Raja kasvaa kantojen mukana:
 * jokainen kanta on oma pyöristyksensä.
 */
export function toleranceFor(rateCount: number): number {
  return 1 + rateCount;
}

export type MatchStatus = "match" | "mismatch" | "unknown";

export interface Comparison {
  label: string;
  /** Kassan ilmoittama luku, tai null jos raportti ei kertonut sitä. */
  posCents: number | null;
  budetCents: number;
  diffCents: number | null;
  status: MatchStatus;
}

export interface Reconciliation {
  status: MatchStatus;
  total: Comparison;
  vat: Comparison;
  byRate: Comparison[];
  /**
   * Selitys erosta, tai null kun täsmää.
   *
   * Lause eikä punainen luku: "Erotus 30,00 €" kertoo että jokin on
   * pielessä muttei mistä aloittaa. Tämä kertoo mitä katsoa.
   */
  explanation: string | null;
}

/**
 * Vertaa kassan raporttia Budetin laskelmaan.
 *
 * Kassan luvut ovat sellaisena kuin ne raportissa lukivat. Budetin
 * luvut on laskettu samoista bruttosummista keskitetyllä
 * pyöristyssäännöllä. Ero tarkoittaa että jokin brutto on kirjattu
 * väärin tai kanta on väärä — ja selitys kertoo kumpi on
 * todennäköisempi.
 */
export function reconcile(input: {
  posGrossCents: number | null;
  posVatCents: number | null;
  lines: SalesLine[];
}): Reconciliation {
  const summary = summarise(input.lines);
  const tolerance = toleranceFor(summary.byRate.length);

  const total = compare(
    "Päivän myynti",
    input.posGrossCents,
    summary.grossCents,
    tolerance,
  );

  const vat = compare("ALV yhteensä", input.posVatCents, summary.vatCents, tolerance);

  const byRate = summary.byRate.map((rate) =>
    compare(formatRate(rate.vatRate), rate.posVatCents, rate.vatCents, 1),
  );

  const off = [total, vat, ...byRate].filter((c) => c.status === "mismatch");

  const status: MatchStatus =
    off.length > 0
      ? "mismatch"
      : total.status === "unknown" && vat.status === "unknown"
        ? "unknown"
        : "match";

  return {
    status,
    total,
    vat,
    byRate,
    explanation: status === "mismatch" ? explain(off, summary, input) : null,
  };
}

// ---------------------------------------------------------------------------

function compare(
  label: string,
  posCents: number | null,
  budetCents: number,
  tolerance: number,
): Comparison {
  if (posCents === null) {
    return { label, posCents: null, budetCents, diffCents: null, status: "unknown" };
  }

  const diffCents = posCents - budetCents;

  return {
    label,
    posCents,
    budetCents,
    diffCents,
    status: Math.abs(diffCents) <= tolerance ? "match" : "mismatch",
  };
}

/**
 * Mistä ero syntyy.
 *
 * Kolme tavallisinta syytä, tässä järjestyksessä:
 *
 * 1. Myynti täsmää mutta ALV ei — verokanta on väärä jollain ryhmällä.
 *    Tämä on yleisin ja korjattavin: brutto on luettu oikein, mutta
 *    ryhmä on kohdistettu kantaan johon se ei kuulu.
 *
 * 2. ALV täsmää mutta myynti ei — jokin ryhmä puuttuu riveiltä.
 *
 * 3. Kumpikaan ei täsmää — luku on luettu väärin.
 */
function explain(
  off: Comparison[],
  summary: SalesSummary,
  input: { posGrossCents: number | null; posVatCents: number | null },
): string {
  const totalOff = off.some((c) => c.label === "Päivän myynti");
  const vatOff = off.some((c) => c.label === "ALV yhteensä" || c.label.includes("%"));

  if (!totalOff && vatOff) {
    const rates = summary.byRate.map((r) => formatRate(r.vatRate)).join(" ja ");
    return (
      `Myynnin loppusumma täsmää, mutta ALV ei. Tarkista onko jokin ` +
      `myyntiryhmä kohdistettu väärään verokantaan — käytössä ${rates}.`
    );
  }

  if (totalOff && !vatOff) {
    const diff = Math.abs((input.posGrossCents ?? 0) - summary.grossCents);
    return (
      `ALV täsmää mutta loppusumma ei. Erotus ${formatMoney(diff)} viittaa ` +
      `siihen että jokin kassan myyntiryhmä puuttuu riveiltä.`
    );
  }

  const diff = Math.abs((input.posGrossCents ?? 0) - summary.grossCents);
  return (
    `Sekä myynti että ALV eroavat kassan raportista. Erotus ` +
    `${formatMoney(diff)} — tarkista että jokainen ryhmä on kirjattu ` +
    `raportin mukaisella summalla.`
  );
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
