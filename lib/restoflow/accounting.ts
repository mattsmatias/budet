/**
 * Kirjanpidon domain-tyypit ja johdettu tila.
 *
 * LASKENTA ON KANNASSA, TULKINTA TÄÄLLÄ.
 *
 * Summat, tasapaino ja täsmäytys lasketaan Postgresissa — ne ovat
 * kirjanpitoa ja niiden on oltava samat riippumatta siitä kuka kysyy.
 * Tämä tiedosto kääntää ne nimiksi, sävyiksi ja järjestykseksi.
 *
 * Mitään rahaa ei lasketa uudelleen täällä. Jos näkymä laskisi omat
 * summansa, raportti ja kirjanpito voisivat erota eikä kumpikaan
 * osaisi kertoa kumpi on oikeassa.
 */

// ---------------------------------------------------------------------------
// Tyypit
// ---------------------------------------------------------------------------

export type LedgerAccountType =
  "revenue" | "expense" | "asset" | "liability" | "equity";

export type LedgerSource = "receipt" | "daily_sales" | "manual" | "correction";

export type LedgerStatus = "proposed" | "posted" | "rejected";

/** Kuukauden tila. Sama neljä porrasta kuin vaatimuksessa. */
export type MonthStatus = "open" | "review" | "ready" | "locked";

export type IssueSeverity = "critical" | "warning" | "info";

export interface LedgerLine {
  accountNumber: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  vatRate: number | null;
  vatCents: number | null;
  description: string | null;
}

export interface LedgerEntry {
  id: string;
  entryNumber: number;
  entryDate: string;
  description: string;
  sourceType: LedgerSource;
  sourceId: string | null;
  status: LedgerStatus;
  correctsId: string | null;
  totalCents: number;
  lines: LedgerLine[];
}

export interface MonthIssue {
  kind: string;
  severity: IssueSeverity;
  count: number;
  title: string;
  detail: string;
  differenceCents?: number;
}

export interface VatRateRow {
  rate: number;
  grossCents: number;
  vatCents: number;
  netCents: number;
}

export interface VatSummary {
  month: string;
  byRate: VatRateRow[];
  salesVatSource: number;
  salesVatLedger: number;
  purchaseVatSource: number;
  purchaseVatLedger: number;
  payableCents: number;
  salesGrossSource: number;
  salesGrossLedger: number;
}

export interface MonthState {
  month: string;
  status: MonthStatus;
  proposed: number;
  posted: number;
  rejected: number;
  receiptsMissing: number;
  salesDaysMissing: number;
  vat: VatSummary;
  issues: MonthIssue[];
}

// ---------------------------------------------------------------------------
// Nimet
// ---------------------------------------------------------------------------

/**
 * Kuukauden tilan sävy.
 *
 * "Avoin" on harmaa eikä keltainen: kesken oleva kuukausi on normaali
 * tila kuun puolivälissä, ei huomautus. Keltainen varataan asioille
 * jotka oikeasti vaativat tekemistä.
 */
export function monthTone(
  status: MonthStatus,
): "neutral" | "warn" | "good" | "muted" {
  switch (status) {
    case "review":
      return "warn";
    case "ready":
      return "good";
    case "locked":
      return "muted";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Johdettu tila
// ---------------------------------------------------------------------------

/**
 * Onko tosite tasapainossa?
 *
 * Kanta ei päästä epätasapainoista riviä läpi, joten tämä ei ole
 * validointi vaan näytön varmistus: jos summat eroavat, jokin on
 * mennyt rikki matkalla eikä lukua saa esittää oikeana.
 */
export function isBalanced(entry: LedgerEntry): boolean {
  const debit = entry.lines.reduce((s, l) => s + l.debitCents, 0);
  const credit = entry.lines.reduce((s, l) => s + l.creditCents, 0);
  return debit === credit;
}

/** Tositteen loppusumma: debet-puolen summa. */
export function entryTotal(entry: LedgerEntry): number {
  return entry.lines.reduce((s, l) => s + l.debitCents, 0);
}

/**
 * Vaatiiko kuukausi huomiota ennen sulkemista?
 *
 * Kriittinen este on täsmäytysvirhe. Hyväksymättömät esitykset ovat
 * este mutta eivät virhe: ne odottavat ihmistä, eivät korjausta.
 */
export function blockingIssues(state: MonthState): MonthIssue[] {
  return state.issues.filter((i) => i.severity === "critical");
}

export function canClose(state: MonthState): boolean {
  return (
    state.status !== "locked" &&
    blockingIssues(state).length === 0 &&
    state.proposed === 0
  );
}

/**
 * Järjestys "Mitä sinun pitää tehdä" -listalle.
 *
 * Kriittinen ensin, sitten määrä. Lista luetaan ylhäältä ja se katkeaa
 * siihen mihin aika loppuu, joten ylimmäisenä on oltava se joka estää
 * kuukauden sulkemisen.
 */
export function sortIssues(issues: MonthIssue[]): MonthIssue[] {
  const rank: Record<IssueSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return [...issues].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count,
  );
}

/**
 * Synkronoinnin tila yhdelle lähdetapahtumalle.
 *
 * Kuittilistan merkki "kirjattu kirjanpitoon" luetaan tästä. Tuntematon
 * lähde on "ei käsitelty" eikä virhe: kuitti voi olla juuri lisätty.
 */
export type SourceState = "unprocessed" | "proposed" | "posted" | "rejected";

export function sourceState(
  entries: Pick<LedgerEntry, "sourceType" | "sourceId" | "status">[],
  sourceType: LedgerSource,
  sourceId: string,
): SourceState {
  const hit = entries.find(
    (e) => e.sourceType === sourceType && e.sourceId === sourceId,
  );
  if (!hit) return "unprocessed";
  return hit.status;
}

/**
 * Kuukauden ensimmäinen päivä ISO-muodossa.
 *
 * Kirjanpidon kuukausi määräytyy tapahtuman päivästä, joten "2026-08"
 * riittää valitsimeen mutta kanta haluaa päivän.
 */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/** "2026-08" → "Elokuu 2026". */
const KUUKAUDET = [
  "Tammikuu",
  "Helmikuu",
  "Maaliskuu",
  "Huhtikuu",
  "Toukokuu",
  "Kesäkuu",
  "Heinäkuu",
  "Elokuu",
  "Syyskuu",
  "Lokakuu",
  "Marraskuu",
  "Joulukuu",
];

export function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const index = Number(m) - 1;
  if (Number.isNaN(index) || index < 0 || index > 11) return month;
  return `${KUUKAUDET[index]} ${year}`;
}
