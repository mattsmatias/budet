/**
 * Laskun summat ja ALV.
 *
 * ALV LASKETAAN KANNOITTAIN, EI RIVEITTÄIN.
 *
 * Tämä on koko tiedoston tärkein päätös. Arvonlisäverolaki (209 e §)
 * vaatii laskulta veron perusteen ja veron määrän *verokannoittain* —
 * ei riveittäin. Ja juuri siinä on ero: jos vero pyöristetään joka
 * rivillä erikseen ja rivit lasketaan yhteen, tulos poikkeaa sentin
 * tai kaksi siitä mitä laki edellyttää.
 *
 * Esimerkki. Kolme riviä à 3,33 € nettona, kanta 25,5 %:
 *
 *   riveittäin   round(333 × 0,255) = 85 senttiä, kolme kertaa = 255
 *   kannoittain  round(999 × 0,255) = 255 senttiä
 *
 * Tässä ne osuvat yksiin, mutta 3,37 €:n riveillä eivät: riveittäin
 * 86 × 3 = 258, kannoittain round(1011 × 0,255) = 258 — ja 3,35 €:llä
 * riveittäin 85 × 3 = 255 mutta kannoittain 256. Yhden sentin ero
 * toistuu joka laskulla, ja kirjanpitäjä löytää sen ennen sinua.
 *
 * Siksi rivi kantaa oman nettonsa, ja vero lasketaan vasta kun saman
 * kannan rivit on laskettu yhteen.
 *
 * PYÖRISTYS POISPÄIN NOLLASTA.
 *
 * Math.round pyöristää −0,5:n nollaan mutta 0,5:n ykköseen. Hyvityslasku
 * on negatiivinen, ja epäsymmetrinen pyöristys tekisi hyvityksestä
 * sentin erisuuruisen kuin alkuperäisestä laskusta.
 */

/** Sentit kokonaisluvuksi, puolikkaat poispäin nollasta. */
export function senteiksi(arvo: number): number {
  return arvo < 0 ? -Math.round(-arvo) : Math.round(arvo);
}

export interface LaskuRivi {
  /** Määrä, voi olla murtoluku (esim. 7,5 tuntia). */
  quantity: number;
  unitPriceCents: number;
  /** Verokanta osuutena: 0,255 on 25,5 prosenttia. */
  vatRate: number;
}

export interface Kanta {
  vatRate: number;
  netCents: number;
  vatCents: number;
}

export interface LaskunSummat {
  netCents: number;
  vatCents: number;
  totalCents: number;
  /** Veron peruste ja määrä kannoittain — laskulla lain vaatimana. */
  kannat: Kanta[];
}

/**
 * Rivin veroton summa.
 *
 * Määrä kertaa yksikköhinta, pyöristettynä sentiksi. Pyöristys on
 * tässä eikä vasta lopussa, koska rivin summa on se joka laskulla
 * näkyy — ja näkyvän luvun on oltava sama kuin laskettu.
 */
export function rivinNetto(rivi: LaskuRivi): number {
  return senteiksi(rivi.quantity * rivi.unitPriceCents);
}

/**
 * Laskun summat riveistä.
 *
 * Kannat palautetaan verokannan mukaan nousevasti, jotta laskun
 * erittely on aina samassa järjestyksessä eikä rivien syöttöjärjestys
 * näy siinä.
 */
export function laskunSummat(rivit: LaskuRivi[]): LaskunSummat {
  const netotKannoittain = new Map<number, number>();

  for (const rivi of rivit) {
    const netto = rivinNetto(rivi);
    netotKannoittain.set(
      rivi.vatRate,
      (netotKannoittain.get(rivi.vatRate) ?? 0) + netto,
    );
  }

  const kannat: Kanta[] = [...netotKannoittain.entries()]
    .map(([vatRate, netCents]) => ({
      vatRate,
      netCents,
      vatCents: senteiksi(netCents * vatRate),
    }))
    .sort((a, b) => a.vatRate - b.vatRate);

  const netCents = kannat.reduce((summa, k) => summa + k.netCents, 0);
  const vatCents = kannat.reduce((summa, k) => summa + k.vatCents, 0);

  return { netCents, vatCents, totalCents: netCents + vatCents, kannat };
}

/**
 * Eräpäivä laskun päivästä ja maksuajasta.
 *
 * Päivät lasketaan UTC:ssä, jotta kesäaika ei siirrä eräpäivää
 * päivällä. Lasku on päivämäärä eikä hetki: sillä ei ole kellonaikaa
 * eikä aikavyöhykettä.
 */
export function erapaiva(laskunPaiva: string, maksuaikaPaivina: number): string {
  const [vuosi, kuukausi, paiva] = laskunPaiva.split("-").map(Number);
  const pohja = Date.UTC(vuosi, kuukausi - 1, paiva);
  const kohde = new Date(pohja + maksuaikaPaivina * 86400000);

  return kohde.toISOString().slice(0, 10);
}

/**
 * Onko lasku myöhässä.
 *
 * Eräpäivä on viimeinen maksupäivä, joten myöhässä ollaan vasta sen
 * jälkeen. Maksettu tai mitätöity ei ole myöhässä riippumatta
 * päivästä.
 */
export function onMyohassa(
  lasku: { status: string; dueDate: string },
  tanaan: string,
): boolean {
  return lasku.status === "sent" && lasku.dueDate < tanaan;
}
