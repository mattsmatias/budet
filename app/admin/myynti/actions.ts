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
import { lineFromGross, type SalesLine } from "@/lib/restoflow/sales-vat";

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
  const lines = linesJson === "" ? [] : parseLines(linesJson);

  if (lines === null) return { error: "Myyntirivit olivat virheellisiä." };

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
function parseLines(json: string): SalesLine[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  if (!Array.isArray(raw)) return null;

  const lines: SalesLine[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;

    const row = entry as Record<string, unknown>;
    const salesGroupId = String(row.salesGroupId ?? "");
    const vatRate = Number(row.vatRate);
    const grossCents = Number(row.grossCents);

    if (!salesGroupId) return null;
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) return null;
    if (!Number.isInteger(grossCents) || grossCents < 0) return null;

    const amounts = lineFromGross(grossCents, vatRate);

    const posVat = row.posVatCents;
    const posVatCents =
      typeof posVat === "number" && Number.isInteger(posVat) && posVat >= 0
        ? posVat
        : null;

    lines.push({
      salesGroupId,
      vatRate,
      ...amounts,
      posName: typeof row.posName === "string" ? row.posName.slice(0, 200) : null,
      posVatCents,
    });
  }

  return lines;
}
