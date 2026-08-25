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

// ---------------------------------------------------------------------------

/**
 * Käyttäjän kirjoittama prosentti osuudeksi.
 *
 * "25,5" → 0.255. Tyhjä tai kelvoton → null.
 *
 * Ylin sallittu on 100 %: sitä suurempi vero tekisi verottomasta
 * summasta negatiivisen.
 *
 * Pyöristys viiteen desimaaliin kuten kannassa. Ilman sitä 25.5/100 on
 * 0.255000000000000004, ja se häntä päätyisi verokannaksi.
 */
export function parseRate(input: unknown): number | null {
  const text = String(input ?? "")
    .replace(/[s% ]/g, "")
    .replace(",", ".");

  if (text === "") return null;

  const percent = Number(text);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;

  return Math.round((percent / 100) * 1e5) / 1e5;
}

// ---------------------------------------------------------------------------
// Kassaraportin ryhmien kohdistus
// ---------------------------------------------------------------------------

/** Ryhmä sellaisena kuin se luettiin kassan päiväraportista. */
export interface ReportGroup {
  /** Nimi kassan raportissa: "Ruoka", "Viini", "Take away". */
  posName: string;
  /** Ryhmän myynti verollisena. */
  grossCents: number;
  /** Kassan ilmoittama ALV tälle ryhmälle, jos raportti eritteli sen. */
  vatCents: number | null;
}

export interface MappedReport {
  lines: SalesLine[];
  /**
   * Kassaryhmät joille ei löytynyt kohdistusta.
   *
   * Ne ovat riveillä oletusryhmässä — myynti ei katoa — mutta
   * verokanta on arvattu, ja käyttäjän on nähtävä mitkä.
   */
  unmapped: string[];
  /**
   * Ryhmät jotka jäivät kokonaan pois.
   *
   * Vain jos oletusryhmää ei ole määritetty. Silloin summa ei täsmää,
   * ja täsmäytys kertoo sen — mutta syy on parempi sanoa suoraan.
   */
  dropped: string[];
}

/**
 * Kassaraportin ryhmät Budetin myyntiriveiksi.
 *
 * KAKSI KASSARYHMÄÄ VOI OLLA YKSI MYYNTIRYHMÄ.
 *
 * "Viini" ja "Olut" ovat molemmat alkoholimyyntiä. Ne yhdistyvät
 * yhdeksi riviksi, koska päivällä voi olla vain yksi rivi per
 * myyntiryhmä — kaksi olisi kaksi totuutta samasta luvusta.
 *
 * VEROKANTA ON RYHMÄN NYKYINEN.
 *
 * Tämä on uusi tapahtuma, joten siihen pätee nykyinen asetus. Vanhat
 * rivit kantavat oman kantansa eikä tämä koske niitä.
 */
export function mapReportGroups(
  reportGroups: ReportGroup[],
  mappings: PosMapping[],
  groups: SalesGroup[],
): MappedReport {
  const byName = new Map(
    mappings.map((m) => [normalise(m.posName), m.salesGroupId]),
  );
  const byId = new Map(groups.map((g) => [g.id, g]));
  const fallback = groups.find((g) => g.isDefault && g.active) ?? null;

  const merged = new Map<
    string,
    { group: SalesGroup; grossCents: number; posVatCents: number | null; names: string[] }
  >();

  const unmapped: string[] = [];
  const dropped: string[] = [];

  for (const reported of reportGroups) {
    const mappedId = byName.get(normalise(reported.posName));
    const group = mappedId ? byId.get(mappedId) : undefined;

    const target = group ?? fallback;

    if (!target) {
      dropped.push(reported.posName);
      continue;
    }

    if (!group) unmapped.push(reported.posName);

    const current = merged.get(target.id) ?? {
      group: target,
      grossCents: 0,
      posVatCents: null,
      names: [],
    };

    current.grossCents += reported.grossCents;
    current.names.push(reported.posName);

    /*
     * Kassan ALV summautuu vain jos se on kaikilla yhdistyvillä
     * ryhmillä. Yhden puuttuminen tekisi summasta vajaan, ja vajaa
     * summa näyttäisi täsmäytyksessä erolta joka ei ole ero.
     */
    if (reported.vatCents !== null) {
      current.posVatCents = (current.posVatCents ?? 0) + reported.vatCents;
    } else {
      current.posVatCents = null;
    }

    merged.set(target.id, current);
  }

  const lines: SalesLine[] = [...merged.values()].map((entry) => {
    const amounts = lineFromGross(entry.grossCents, entry.group.vatRate);

    return {
      salesGroupId: entry.group.id,
      vatRate: entry.group.vatRate,
      grossCents: amounts.grossCents,
      vatCents: amounts.vatCents,
      netCents: amounts.netCents,
      posName: entry.names.join(", "),
      posVatCents: entry.posVatCents,
    };
  });

  return { lines, unmapped, dropped };
}

/**
 * Nimien vertailu.
 *
 * Kassa kirjoittaa "RUOKA", "Ruoka" ja "ruoka " eri raporteissa. Ne
 * ovat sama ryhmä, ja kohdistuksen pitäisi löytyä kaikilla.
 */
function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
