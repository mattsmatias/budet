/**
 * Kassan päiväraportin luvut.
 *
 * Raportti antaa kolme summaa jotka riippuvat toisistaan: verollinen,
 * veroton ja ALV. Poiminta lukee ne kuvasta, ja kuvasta luettu luku voi
 * olla väärin — numero hukkuu rypyssä, pilkku luetaan pisteeksi.
 *
 * KOLMESTA RIITTÄÄ KAKSI.
 *
 * Puuttuva kolmas lasketaan, koska laskettu luku on varmempi kuin
 * huonosti luettu. Jos kaikki kolme on luettu, ne tarkistetaan
 * toisiaan vasten — ja ristiriita kerrotaan sen sijaan että toinen
 * valittaisiin hiljaa.
 */

import { formatMoney } from "@/lib/money";

/** Sentin sivussa oleva raportti ei ole virhe vaan pyöristys. */
export const ROUNDING_TOLERANCE_CENTS = 2;

export interface ReportAmounts {
  /** Verollinen myynti. Mitä asiakas maksoi. */
  grossCents: number | null;
  /** ALV yhteensä. */
  vatCents: number | null;
  /** Veroton myynti. Tästä lasketaan työvoiman osuus. */
  netCents: number | null;
}

export interface Reconciled extends ReportAmounts {
  /**
   * Mitkä luvut on laskettu eikä luettu.
   *
   * Käyttöliittymä merkitsee ne, jottei laskettu luku näytä
   * raportista luetulta.
   */
  derived: ("grossCents" | "vatCents" | "netCents")[];
  /**
   * Ristiriita luettujen lukujen välillä, tai null.
   *
   * Lause eikä totuusarvo: "brutto 2 900,00 €, mutta netto + alv =
   * 2 850,00 €" kertoo mitä tarkistaa, "epätäsmäävä" ei.
   */
  mismatch: string | null;
}

/**
 * Täydentää puuttuvan summan ja tarkistaa luetut.
 *
 * Ei koskaan keksi lukua kahdesta puuttuvasta: yhdestä summasta ei voi
 * johtaa toista tuntematta ALV-kantaa, ja ravintolassa kantoja on
 * samassa päivässä kaksi tai kolme.
 */
export function reconcile(input: ReportAmounts): Reconciled {
  const { grossCents, vatCents, netCents } = input;
  const known = [grossCents, vatCents, netCents].filter(
    (v) => v !== null,
  ).length;

  if (known < 2) {
    return { ...input, derived: [], mismatch: null };
  }

  if (known === 3) {
    const sum = (netCents as number) + (vatCents as number);
    const off = Math.abs((grossCents as number) - sum);

    return {
      ...input,
      derived: [],
      mismatch:
        off > ROUNDING_TOLERANCE_CENTS
          ? `Verollinen ${formatMoney(grossCents as number)}, mutta veroton + ALV = ${formatMoney(sum)}. Tarkista luvut raportista.`
          : null,
    };
  }

  if (grossCents === null) {
    return {
      grossCents: (netCents as number) + (vatCents as number),
      vatCents,
      netCents,
      derived: ["grossCents"],
      mismatch: null,
    };
  }

  if (netCents === null) {
    return {
      grossCents,
      vatCents,
      netCents: grossCents - (vatCents as number),
      derived: ["netCents"],
      mismatch: null,
    };
  }

  return {
    grossCents,
    vatCents: grossCents - (netCents as number),
    netCents,
    derived: ["vatCents"],
    mismatch: null,
  };
}

/**
 * Keskiostos.
 *
 * Verollisesta summasta, koska se on se minkä asiakas maksoi.
 * Verottomasta laskettu keskiostos ei vastaisi mitään lukua jonka
 * ravintoloitsija näkee kassalla.
 *
 * Nolla tapahtumaa on avoinna ollut mutta myymätön päivä, ei
 * jakolaskuvirhe.
 */
export function averageCheckCents(
  grossCents: number | null,
  transactions: number | null,
): number | null {
  if (grossCents === null || transactions === null || transactions <= 0)
    return null;
  return Math.round(grossCents / transactions);
}

/**
 * Kelpaako poimittu päivämäärä.
 *
 * Tulevan päivän raporttia ei ole olemassa, ja vuotta vanhempi on
 * lähes varmasti väärin luettu vuosiluku. Molemmat on parempi jättää
 * käyttäjän täytettäväksi kuin tallentaa hiljaa.
 */
export function plausibleReportDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (date > today) return false;

  const year = Number(today.slice(0, 4));
  return date >= `${year - 1}-01-01`;
}
