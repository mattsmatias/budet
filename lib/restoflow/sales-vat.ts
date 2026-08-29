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

import { formatMoney, formatRate, vatFromGross, vatFromNet } from "@/lib/money";

export interface SalesGroup {
  id: string;
  name: string;
  /** Verokanta osuutena: 0.135 = 13,5 %. */
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

/**
 * Kassan oma ALV-erittely yhdelle kannalle.
 *
 * Z-raportin ALV-taulukko sellaisenaan: kanta, vero, veroton ja
 * verollinen. Nämä ovat kassan lukuja eikä niitä lasketa uudelleen —
 * juuri ne ilmoitetaan kirjanpitoon.
 *
 * TÄMÄ EI OLE SAMA JAKO KUIN MYYNTIRIVIT.
 *
 * Myyntirivit jakavat päivän tuoteryhmiin ja johtavat veron ryhmän
 * kannasta. Kassa jakaa saman päivän verokantoihin. Useimmiten jaot
 * osuvat yksiin, mutta eivät aina: yksittäinen tuote tuoteryhmän
 * sisällä voi olla eri kannalla. Silloin kassan taulukko on oikeassa.
 */
export interface PosVatRate {
  vatRate: number;

  /**
   * Vero. Ainoa pakollinen luku.
   *
   * Osa kassoista tulostaa kannoittain vain veron: "ALV 14 % 12,34".
   * Silloin veroton ja verollinen ovat null. Ne ovat vertailun
   * tarkkuutta, eivät sen edellytys — kassan ilmoittama vero on yhä
   * kassan ilmoittama vero.
   */
  vatCents: number;
  grossCents: number | null;
  netCents: number | null;
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
  const vatCents = vatFromNet(netCents, vatRate);
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
 * Kassa pyöristää ryhmittäin ja Kate kannoittain, joten sentin heitto
 * on odotettavissa eikä se ole virhe. Raja kasvaa kantojen mukana:
 * jokainen kanta on oma pyöristyksensä.
 */
export function toleranceFor(rateCount: number): number {
  return 1 + rateCount;
}

/**
 * Vertailun tulos.
 *
 * NELJÄS TILA ON "HUOMIO", EI VIRHE.
 *
 * Kassan tuoteryhmäjako ja sen verokantajako eivät ole sama jako:
 * yksittäinen tuote ryhmän sisällä voi olla eri kannalla kuin ryhmä.
 * Silloin luvut eroavat, mutta mikään ei ole väärin — ei kassassa
 * eikä asetuksissa. Punainen hälytys asiasta jota ei voi korjata
 * opettaa ohittamaan hälytykset.
 */
export type MatchStatus = "match" | "note" | "mismatch" | "unknown";

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

  /**
   * Huomio joka ei ole virhe.
   *
   * Kerrotaan silloinkin kun päivä täsmää: ilman selitystä lukija
   * näkee taulukossa eron eikä tiedä saako sen jättää.
   */
  note: string | null;
}

/**
 * Vertaa kassan raporttia Katen laskelmaan.
 *
 * Kassan luvut ovat sellaisena kuin ne raportissa lukivat. Katen
 * luvut on laskettu samoista bruttosummista keskitetyllä
 * pyöristyssäännöllä. Ero tarkoittaa että jokin brutto on kirjattu
 * väärin tai kanta on väärä — ja selitys kertoo kumpi on
 * todennäköisempi.
 */
export function reconcile(input: {
  posGrossCents: number | null;
  posVatCents: number | null;
  /**
   * Kassan oma ALV-erittely, tai tyhjä lista kun sitä ei ole.
   *
   * Kun erittely on olemassa, se on päivän verotieto. Ryhmistä johdettu
   * vero jää tarkistuslaskelmaksi, ja ero näiden välillä kertoo
   * kantajaon ja ryhmäjaon erosta — ei siitä että jompikumpi olisi
   * väärin.
   *
   * PAKOLLINEN, EI VALINNAINEN.
   *
   * Kenttä oli valinnainen, ja yksi näkymä jäi päivittämättä: se
   * käännettiin ja ajettiin ilman virhettä, mutta näytti vanhaa
   * varoitusta päivästä joka täsmäsi. Pakollisena kääntäjä pakottaa
   * jokaisen kutsupaikan päättämään, ja tyhjä lista on tietoinen
   * "erittelyä ei ole" eikä unohdus.
   */
  posVatRates: PosVatRate[];
  lines: SalesLine[];
}): Reconciliation {
  const summary = summarise(input.lines);
  const posRates = input.posVatRates
    .slice()
    .sort((a, b) => b.vatRate - a.vatRate);
  const tolerance = toleranceFor(summary.byRate.length);

  const total = compare(
    "Päivän myynti",
    input.posGrossCents,
    summary.grossCents,
    tolerance,
  );

  /*
   * Kassan ALV on Katen ALV kun erittely on luettu.
   *
   * Kassa on kirjanpidon lähde: sen ALV-taulukko on se luku joka
   * ilmoitetaan verottajalle. Katen oma laskelma on tarkistus eikä
   * korvaava — ja kun tarkistus asetetaan lähteen tilalle,
   * täsmäytyksestä tulee vertailu Katen ja Katen välillä.
   */
  const budetVat =
    posRates.length > 0 ? sum(posRates, (r) => r.vatCents) : summary.vatCents;

  const vat = compare("ALV yhteensä", input.posVatCents, budetVat, tolerance);

  /*
   * Kantarivit vertaavat MYYNTIÄ, eivät veroa.
   *
   * Verojen ero on seuraus; myynnin ero on syy. Kun kassan 25,5 %:n
   * myynti on 10,50 € ja ryhmistä johdettu 10,00 €, ero on 50 senttiä
   * myyntiä — ja se on luku jonka voi etsiä raportista. Kymmenen
   * sentin veroero ei kerro mistä etsiä.
   */
  const byRate =
    posRates.length > 0
      ? posRates.map((rate) => {
          const own = summary.byRate.find((r) => r.vatRate === rate.vatRate);

          /*
           * Myynti kun se tiedetään, muuten vero.
           *
           * Kaikki kassat eivät tulosta kannoittaista myyntiä. Silloin
           * verrataan sitä mitä on — vero on aina — ja raja lasketaan
           * samassa yksikössä: verona se on pienin muutos jonka väärä
           * kohdistus voisi aiheuttaa.
           */
          const byGross = rate.grossCents !== null;

          return compare(
            `${byGross ? "Myynti" : "ALV"} ${formatRate(rate.vatRate)}`,
            byGross ? rate.grossCents : rate.vatCents,
            byGross ? (own?.grossCents ?? 0) : (own?.vatCents ?? 0),
            tolerance,
            byGross
              ? wholeGroupFloor(input.lines)
              : (smallestRateSwapCents(summary) ?? 0),
          );
        })
      : summary.byRate.map((rate) =>
          compare(
            `ALV ${formatRate(rate.vatRate)}`,
            rate.posVatCents,
            rate.vatCents,
            1,
          ),
        );

  const off = [total, vat, ...byRate].filter((c) => c.status === "mismatch");
  const noted = byRate.filter((c) => c.status === "note");

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
    note: noted.length > 0 ? describeSplit(noted) : null,
  };
}

/**
 * Raja jonka yli ero on kokonainen ryhmä väärällä kannalla.
 *
 * Väärin kohdistettu ryhmä siirtää koko ryhmän myynnin toiselle
 * kannalle, joten ero on silloin vähintään pienimmän kirjatun ryhmän
 * kokoinen. Sitä pienempi ero ei voi olla kohdistusvirhe — se on
 * yksittäinen tuote ryhmän sisällä.
 *
 * Raja tulee päivän omista riveistä eikä vakiosta: pieni lounaspaikka
 * ja iso ravintola eivät jaa samaa käsitystä siitä mikä on pieni.
 */
function wholeGroupFloor(lines: SalesLine[]): number {
  const grosses = lines
    .map((line) => line.grossCents)
    .filter((cents) => cents > 0);
  if (grosses.length === 0) return 0;

  return Math.min(...grosses);
}

/**
 * Ryhmäjaon ja kantajaon ero sanoiksi.
 *
 * Neuvo on tarkoituksella se mitä käyttäjä voi tehdä: ei mitään.
 * Kassan luvut ovat oikein ja asetukset ovat oikein, joten kehotus
 * tarkistaa ryhmien kohdistuksia veisi illan hukkaan.
 */
function describeSplit(noted: Comparison[]): string {
  const biggest = noted.reduce((worst, c) =>
    Math.abs(c.diffCents ?? 0) > Math.abs(worst.diffCents ?? 0) ? c : worst,
  );

  const size = formatMoney(Math.abs(biggest.diffCents ?? 0));
  const rate = biggest.label.replace(/^(Myynti|ALV) /, "");

  return (
    `Kassan verokantajako eroaa tuoteryhmien jaosta ${size} ` +
    `(${rate}). Ero on pienempi kuin yksikään kirjattu ryhmä, ` +
    `joten kyse ei ole väärästä kohdistuksesta vaan yksittäisestä ` +
    `tuotteesta ryhmän sisällä — pantti, pakkaus tai mukaan otettu ` +
    `annos. Kirjanpitoon menevä ALV on kassan oma erittely, joten ` +
    `luku on oikein.`
  );
}

// ---------------------------------------------------------------------------

function compare(
  label: string,
  posCents: number | null,
  budetCents: number,
  tolerance: number,
  /**
   * Raja jonka alapuolella ero on huomio eikä virhe.
   *
   * Oletuksena rajaa ei ole: kaikki toleranssin ylittävä on virhe.
   * Kantariveillä raja on olemassa, koska siellä pieni ero on kassan
   * raportin odotettava ominaisuus eikä vika.
   */
  noteBelow = 0,
): Comparison {
  if (posCents === null) {
    return {
      label,
      posCents: null,
      budetCents,
      diffCents: null,
      status: "unknown",
    };
  }

  const diffCents = posCents - budetCents;
  const size = Math.abs(diffCents);

  const status: MatchStatus =
    size <= tolerance ? "match" : size < noteBelow ? "note" : "mismatch";

  return { label, posCents, budetCents, diffCents, status };
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
  const vatOff = off.some(
    (c) => c.label === "ALV yhteensä" || c.label.includes("%"),
  );

  if (!totalOff && vatOff) {
    const vatDiff = Math.abs((input.posVatCents ?? 0) - summary.vatCents);
    const swap = smallestRateSwapCents(summary);

    /*
     * PIENI EROTUS EI OLE VÄÄRÄ VEROKANTA.
     *
     * Väärä kanta siirtää koko ryhmän myynnin toiselle kannalle, ja
     * pienimmälläkin ryhmällä se tarkoittaa euroja. Sentin erotus ei
     * voi syntyä siitä. Kehotus tarkistaa kohdistuksia veisi illan
     * hukkaan, ja neuvo joka ei johda mihinkään opettaa ohittamaan
     * neuvot.
     *
     * Todellinen syy on silloin kassan sisäinen jako: yksittäinen
     * tuote tuoteryhmän sisällä on eri kannalla kuin ryhmä. Sen näkee
     * raportin ALV-taulukosta, ja kuvattu raportti tuo taulukon
     * mukanaan — silloin tähän haaraan ei edes tulla.
     */
    if (swap !== null && vatDiff < swap) {
      return (
        `Myynti täsmää ja ALV eroaa ${formatMoney(vatDiff)}. Erotus on ` +
        `liian pieni ollakseen väärä verokanta: pienimmänkin ryhmän ` +
        `siirtyminen toiselle kannalle muuttaisi ALV:tä vähintään ` +
        `${formatMoney(swap)}. Kyse on yksittäisestä tuotteesta ryhmän ` +
        `sisällä. Kuvaa päiväraportti uudelleen, niin Kate lukee kassan ` +
        `oman ALV-erittelyn eikä johda veroa ryhmistä.`
      );
    }

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

/**
 * Pienin ALV-muutos jonka väärä kohdistus voisi aiheuttaa.
 *
 * Käydään läpi jokainen kanta ja lasketaan mitä sen myynnille
 * tapahtuisi toisella päivän kannalla. Pienin näistä on alaraja: sitä
 * pienempi erotus ei voi olla kohdistusvirhe.
 *
 * Palauttaa null kun päivässä on vain yksi kanta. Silloin ei ole
 * toista kantaa johon verrata, eikä alarajaa voi väittää tietävänsä.
 */
function smallestRateSwapCents(summary: SalesSummary): number | null {
  if (summary.byRate.length < 2) return null;

  const swaps: number[] = [];

  for (const own of summary.byRate) {
    for (const other of summary.byRate) {
      if (other.vatRate === own.vatRate) continue;

      swaps.push(
        Math.abs(vatFromGross(own.grossCents, other.vatRate) - own.vatCents),
      );
    }
  }

  const smallest = Math.min(...swaps);
  return smallest > 0 ? smallest : null;
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
 * Kassaraportin ryhmät Katen myyntiriveiksi.
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
    {
      group: SalesGroup;
      grossCents: number;
      posVatCents: number | null;
      names: string[];
    }
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
