"use server";

/**
 * Päivän myynnin kirjaus.
 *
 * Yksi luku päivässä. Kaikki muu ohjauspaneelin myyntipuoli — vertailu,
 * työvoiman osuus, karkea tulos — johdetaan tästä, joten tämä on ainoa
 * paikka jossa myynti syntyy.
 */

import { revalidatePath } from "next/cache";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import {
  lineFromGross,
  type PosVatRate,
  type SalesLine,
} from "@/lib/restoflow/sales-vat";
import { fetchSalesGroups } from "@/lib/restoflow/queries";

export interface SalesState {
  error?: string;
  notice?: string;
}

const PATH = "/admin/myynti";

/** "1 234,50" tai "1234.5" → 123450. Tyhjä → null. */
function parseEuros(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "")
    .replace(/\s| /g, "")
    .replace(",", ".");

  if (text === "") return null;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

/** "128" → 128. Tyhjä tai kelvoton → null. */
function parseCount(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;

  const count = Number(text);
  if (!Number.isInteger(count) || count < 0) return null;

  return count;
}

export async function saveDailySales(
  _prev: SalesState,
  formData: FormData,
): Promise<SalesState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "sales.manage")) return { error: "Ei oikeutta kirjata myyntiä." };

  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return { error: "Tarkista päivämäärä." };

  const net = parseEuros(formData.get("net"));
  if (net === null) return { error: "Syötä päivän veroton myynti." };

  const target = parseEuros(formData.get("target"));
  const note = String(formData.get("note") ?? "").trim() || null;

  /*
   * Päiväraportin lisätiedot.
   *
   * Kaikki vapaaehtoisia: käsin kirjattu päivä on yhä kelvollinen
   * yhdellä luvulla. Nämä täyttyvät kun raportti on kuvattu.
   */
  const gross = parseEuros(formData.get("gross"));
  const vat = parseEuros(formData.get("vat"));
  const transactions = parseCount(formData.get("transactions"));
  const fromReport = formData.get("source") === "report";

  /*
   * Verollinen ei voi olla verotonta pienempi.
   *
   * Kanta hylkäisi rivin rajoitteella, mutta virhe olisi silloin
   * rajoitteen nimi eikä lause. Sama tarkistus tässä antaa
   * käyttäjälle sen mitä hän voi korjata.
   */
  if (gross !== null && gross < net) {
    return { error: "Verollinen myynti ei voi olla verotonta pienempi. Tarkista luvut." };
  }

  /*
   * Kassan ilmoittamat luvut säilytetään erillään laskennasta.
   *
   * Jos ne korvattaisiin Budetin omalla laskelmalla, täsmäytys
   * vertaisi lukua itseensä ja täsmäisi aina.
   */
  const posGross = parseEuros(formData.get("posGross"));
  const posVat = parseEuros(formData.get("posVat"));

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("daily_sales")
    .upsert(
      {
        restaurant_id: restaurant.id,
        sales_date: date,
        net_sales_cents: net,
        gross_sales_cents: gross,
        vat_cents: vat,
        transactions,
        source: fromReport ? "report" : "manual",
        pos_gross_cents: posGross,
        pos_vat_cents: posVat,
        target_cents: target,
        note,
        created_by: user.id,
      },
      { onConflict: "restaurant_id,sales_date" },
    )
    .select("id")
    .single();

  if (error || !saved) {
    return { error: `Myynnin tallennus epäonnistui: ${error?.message ?? ""}` };
  }

  /*
   * Myyntirivit korvataan kokonaan.
   *
   * Päivä on yksi kokonaisuus: raportti kuvataan uudelleen kun siinä
   * oli virhe, ja silloin vanhojen rivien pitää kadota. Osittainen
   * päivitys jättäisi poistetun ryhmän riville ja loppusumma ei enää
   * täsmäisi omiin riveihinsä.
   */
  const linesJson = String(formData.get("lines") ?? "");
  const submitted = linesJson === "" ? [] : parseLines(linesJson);

  if (submitted === null) return { error: "Myyntirivit olivat virheellisiä." };

  const lines =
    submitted.length === 0
      ? []
      : resolveLines(submitted, await fetchSalesGroups(restaurant.id));

  if (lines === null) {
    return { error: "Tuntematon myyntiryhmä. Päivitä sivu ja yritä uudelleen." };
  }

  /*
   * PÄIVÄ ON YKSI TOTUUS.
   *
   * Vanhat rivit poistetaan aina, myös kun uusia ei ole. Aiemmin
   * poisto oli ehdon sisällä, ja silloin raportista kuvattu päivä
   * säilytti rivinsä kun se tallennettiin uudelleen käsin: otsikko
   * kertoi yhden summan ja rivit toisen, ja täsmäytys vertasi
   * vanhentuneita rivejä.
   *
   * Käsin tallennus on tietoinen korvaus. Jos se korvaa päivän
   * summan, sen on korvattava myös erittely.
   */
  {
    await supabase.from("daily_sales_lines").delete().eq("daily_sales_id", saved.id);

    if (lines.length > 0) {
      const { error: lineError } = await supabase.from("daily_sales_lines").insert(
        lines.map((line) => ({
          daily_sales_id: saved.id as string,
          sales_group_id: line.salesGroupId,
          vat_rate: line.vatRate,
          gross_cents: line.grossCents,
          vat_cents: line.vatCents,
          net_cents: line.netCents,
          pos_name: line.posName,
          pos_vat_cents: line.posVatCents,
        })),
      );

      if (lineError) {
        return { error: `Myyntirivien tallennus epäonnistui: ${lineError.message}` };
      }
    }
  }

  /*
   * Kassan ALV-erittely korvataan samoin kuin rivit.
   *
   * Erittely kuuluu siihen raporttiin josta se luettiin. Kun päivä
   * kirjataan uudelleen käsin, vanha erittely ei saa jäädä: se
   * väittäisi kertovansa päivän verot, vaikka päivän luvut ovat
   * vaihtuneet sen alta.
   */
  {
    await supabase.from("daily_sales_vat").delete().eq("daily_sales_id", saved.id);

    const rates = parseVatRates(formData.get("vatRates"));

    if (rates.length > 0) {
      const { error: vatError } = await supabase.from("daily_sales_vat").insert(
        rates.map((rate) => ({
          daily_sales_id: saved.id as string,
          vat_rate: rate.vatRate,
          gross_cents: rate.grossCents,
          vat_cents: rate.vatCents,
          net_cents: rate.netCents,
        })),
      );

      if (vatError) {
        return { error: `ALV-erittelyn tallennus epäonnistui: ${vatError.message}` };
      }
    }
  }

  // Myynti muuttaa yleiskuvan, raportit ja budjetin, joten koko
  // hallintapuoli on päivitettävä eikä vain tämä sivu.
  revalidatePath("/admin", "layout");
  return { notice: "Myynti tallennettu." };
}

/** Poistaa päivän merkinnän. Väärin kirjattu luku on pahempi kuin puuttuva. */
export async function deleteDailySales(formData: FormData): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "sales.manage")) return;

  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return;

  const supabase = await createClient();
  await supabase
    .from("daily_sales")
    .delete()
    .eq("restaurant_id", restaurant.id)
    .eq("sales_date", date);

  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------

/**
 * Myyntirivit lomakkeen piilokentästä.
 *
 * VEROT LASKETAAN UUDELLEEN PALVELIMELLA.
 *
 * Selain lähettää ryhmän, kannan ja bruttosumman. Vero ja veroton
 * lasketaan tässä samasta funktiosta jota kaikki muukin käyttää —
 * selaimen lähettämään veroon ei luoteta, koska lomakkeen sisällön voi
 * kirjoittaa itse ja väärä vero päätyisi kirjanpitoon.
 *
 * Palauttaa null jos syöte on rikki. Osittainen tallennus olisi
 * pahempi kuin epäonnistunut.
 */
/**
 * Kassan ALV-erittely lomakkeen piilokentästä.
 *
 * NÄITÄ EI LASKETA UUDELLEEN.
 *
 * Myyntirivien vero lasketaan palvelimella, koska selaimen lähettämään
 * veroon ei voi luottaa. Tämä on eri asia: nämä ovat kassan omia
 * lukuja, ja niiden koko tarkoitus on olla juuri sitä mitä raportissa
 * luki. Uudelleen laskettuna ne olisivat Budetin laskelma ja
 * täsmäytys vertaisi lukua itseensä.
 *
 * Tarkistus on siksi sisäinen: vero plus veroton on verollinen.
 * Rikkinäinen rivi jätetään pois — päivä tallentuu ilman erittelyä ja
 * vero johdetaan ryhmistä kuten ennen erittelyä.
 */
function parseVatRates(raw: FormDataEntryValue | null): PosVatRate[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const seen = new Set<number>();

  return parsed
    .filter(
      (rate): rate is PosVatRate =>
        typeof rate?.vatRate === "number" &&
        rate.vatRate >= 0 &&
        rate.vatRate < 1 &&
        typeof rate.grossCents === "number" &&
        typeof rate.vatCents === "number" &&
        typeof rate.netCents === "number" &&
        rate.grossCents >= 0 &&
        rate.vatCents >= 0 &&
        rate.netCents >= 0 &&
        Math.abs(rate.vatCents + rate.netCents - rate.grossCents) <= 1,
    )
    .filter((rate) => {
      // Sama kanta kahdesti on kaksi totuutta samasta rivistä, ja
      // kanta on taulussa ainutkertainen — kanta hylkäisi koko lisäyksen.
      if (seen.has(rate.vatRate)) return false;
      seen.add(rate.vatRate);
      return true;
    })
    .map((rate) => ({
      vatRate: rate.vatRate,
      grossCents: Math.round(rate.grossCents),
      vatCents: Math.round(rate.vatCents),
      netCents: Math.round(rate.netCents),
    }));
}

/** Rivi sellaisena kuin lomake sen lähettää. Ilman verokantaa. */
interface SubmittedLine {
  salesGroupId: string;
  grossCents: number;
  posName: string | null;
  posVatCents: number | null;
}

/**
 * Myyntirivit lomakkeen piilokentästä.
 *
 * VEROKANTA EI TULE LOMAKKEESTA.
 *
 * Aiemmin se tuli, ja vain sen lukualue tarkistettiin. Lomakkeen
 * sisällön voi kirjoittaa itse, joten ruokamyynnin olisi voinut
 * tallentaa nollakannalla ja ALV olisi jäänyt kirjaamatta — juuri se
 * mitä tehtävänannon §11 kieltää.
 *
 * Nyt lomake kertoo vain ryhmän ja bruttosumman. Kanta luetaan
 * kannasta ryhmän mukaan, ja vero lasketaan siitä.
 *
 * Palauttaa null jos syöte on rikki. Osittainen tallennus olisi
 * pahempi kuin epäonnistunut.
 */
function parseLines(json: string): SubmittedLine[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  if (!Array.isArray(raw)) return null;

  const lines: SubmittedLine[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;

    const row = entry as Record<string, unknown>;
    const salesGroupId = String(row.salesGroupId ?? "");
    const grossCents = Number(row.grossCents);

    if (!salesGroupId) return null;
    if (!Number.isInteger(grossCents) || grossCents < 0) return null;

    const posVat = row.posVatCents;

    lines.push({
      salesGroupId,
      grossCents,
      posName: typeof row.posName === "string" ? row.posName.slice(0, 200) : null,
      posVatCents:
        typeof posVat === "number" && Number.isInteger(posVat) && posVat >= 0
          ? posVat
          : null,
    });
  }

  return lines;
}

/**
 * Ryhmän kanta rivin kannaksi.
 *
 * Ryhmän on oltava tämän ravintolan oma: kannan RLS tarkistaa rivin
 * oikeuden päivän kautta eikä ryhmän, joten ilman tätä väärennetty
 * pyyntö voisi viitata toisen ravintolan ryhmään.
 *
 * Kanta on ryhmän NYKYINEN kanta. Tämä on uusi tapahtuma, joten siihen
 * pätee nykyinen asetus — ja kun se on kerran kirjoitettu riville, se
 * ei enää muutu.
 */
function resolveLines(
  submitted: SubmittedLine[],
  groups: { id: string; vatRate: number }[],
): SalesLine[] | null {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const lines: SalesLine[] = [];

  for (const line of submitted) {
    const group = byId.get(line.salesGroupId);
    if (!group) return null;

    lines.push({
      salesGroupId: group.id,
      vatRate: group.vatRate,
      ...lineFromGross(line.grossCents, group.vatRate),
      posName: line.posName,
      posVatCents: line.posVatCents,
    });
  }

  return lines;
}
