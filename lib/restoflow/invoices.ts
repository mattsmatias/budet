import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * Myyntilaskujen luku.
 *
 * Lasku kantaa vastaanottajansa kopiona eikä viittauksena: kysely ei
 * siis liitä asiakasriviä mukaan, koska laskulla lukeva nimi ja osoite
 * ovat laskun omia kenttiä. Rekisteriviite on tallella vain siltä
 * varalta että halutaan tietää keneltä lasku on — se ei ole näytön
 * lähde.
 */

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface VatCode {
  id: string;
  code: string;
  name: string;
  /** Osuutena: 0,255 on 25,5 prosenttia. */
  rate: number;
}

export interface InvoiceRow {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPriceCents: number;
  vatCodeId: string;
  vatRate: number;
  netCents: number;
  vatCents: number;
  totalCents: number;
}

export interface Invoice {
  id: string;
  number: number;
  reference: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  netCents: number;
  vatCents: number;
  totalCents: number;
  note: string | null;
  recipientName: string;
  recipientBusinessId: string | null;
  recipientCareOf: string | null;
  recipientStreet: string | null;
  recipientPostalCode: string | null;
  recipientCity: string | null;
  recipientCountry: string;
  recipientEmail: string | null;
}

export interface InvoiceWithRows extends Invoice {
  rows: InvoiceRow[];
}

const teksti = (arvo: unknown) =>
  typeof arvo === "string" && arvo.trim() !== "" ? arvo : null;

/*
 * Kentat yhtena literaalina eika yhdistettyna.
 *
 * Supabasen tyypitys lukee select-merkkijonon literaalista; plussalla
 * yhdistetty on vain string, ja silloin rivin tyypiksi tulee virhe
 * eika tietue.
 */
const LASKU_KENTAT =
  "id, number, reference, status, invoice_date, due_date, sent_at, paid_at, net_cents, vat_cents, total_cents, note, recipient_name, recipient_business_id, recipient_care_of, recipient_street, recipient_postal_code, recipient_city, recipient_country, recipient_email" as const;

function lueLasku(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    number: row.number as number,
    reference: (row.reference as string) ?? "",
    status: (row.status as InvoiceStatus) ?? "draft",
    invoiceDate: row.invoice_date as string,
    dueDate: row.due_date as string,
    sentAt: teksti(row.sent_at),
    paidAt: teksti(row.paid_at),
    netCents: (row.net_cents as number) ?? 0,
    vatCents: (row.vat_cents as number) ?? 0,
    totalCents: (row.total_cents as number) ?? 0,
    note: teksti(row.note),
    recipientName: (row.recipient_name as string) ?? "",
    recipientBusinessId: teksti(row.recipient_business_id),
    recipientCareOf: teksti(row.recipient_care_of),
    recipientStreet: teksti(row.recipient_street),
    recipientPostalCode: teksti(row.recipient_postal_code),
    recipientCity: teksti(row.recipient_city),
    recipientCountry: (row.recipient_country as string) ?? "FI",
    recipientEmail: teksti(row.recipient_email),
  };
}

/**
 * Käytettävissä olevat verokannat.
 *
 * Vain ne joilla on numeerinen kanta: käännetty verovelvollisuus ja
 * OSS ovat omia tapauksiaan joita tämä lasku ei vielä osaa, ja
 * valikossa näkyvä vaihtoehto jota ei voi valita oikein on pahempi
 * kuin puuttuva vaihtoehto.
 *
 * Yleisin ensin, koska se on oletus useimmilla riveillä.
 */
export const fetchVatCodes = cache(async (): Promise<VatCode[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vat_codes")
      .select("id, code, name, rate")
      .eq("jurisdiction", "FI")
      .not("rate", "is", null)
      .order("rate", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      rate: Number(row.rate),
    }));
  } catch {
    return [];
  }
});

export const fetchInvoices = cache(
  async (restaurantId: string): Promise<Invoice[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select(LASKU_KENTAT)
        .eq("restaurant_id", restaurantId)
        .order("number", { ascending: false })
        .limit(200);

      if (error || !data) return [];
      return data.map(lueLasku);
    } catch {
      return [];
    }
  },
);

/**
 * Yksi lasku riveineen.
 *
 * Yrityksen tunnus on ehdossa mukana vaikka rivikäytäntö rajaa saman:
 * väärän yrityksen laskun id osoitteessa palauttaa tyhjän eikä
 * virhettä, ja tyhjä on oikea vastaus kysymykseen josta ei saa
 * paljastua onko laskua olemassa.
 */
export async function fetchInvoice(
  id: string,
  restaurantId: string,
): Promise<InvoiceWithRows | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("invoices")
      .select(LASKU_KENTAT)
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error || !data) return null;

    const { data: rivit } = await supabase
      .from("invoice_rows")
      .select(
        "id, line_number, description, quantity, unit, unit_price_cents, vat_code_id, net_cents, vat_cents, total_cents",
      )
      .eq("invoice_id", id)
      .order("line_number");

    /*
     * Verokanta erillisesta hausta eika liitoksesta.
     *
     * Kannat ovat lyhyt ja valimuistitettu lista, joten liitos joka
     * riville olisi tyota ilman hyotya - ja liitoksen tyypitys teki
     * rivista virheen tietueen sijaan.
     */
    const kannat = await fetchVatCodes();
    const kannanMukaan = new Map(kannat.map((k) => [k.id, k.rate]));

    const rows: InvoiceRow[] = (rivit ?? []).map((row) => {
      return {
        id: row.id as string,
        lineNumber: row.line_number as number,
        description: (row.description as string) ?? "",
        quantity: Number(row.quantity),
        unit: teksti(row.unit),
        unitPriceCents: (row.unit_price_cents as number) ?? 0,
        vatCodeId: row.vat_code_id as string,
        vatRate: kannanMukaan.get(row.vat_code_id as string) ?? 0,
        netCents: (row.net_cents as number) ?? 0,
        vatCents: (row.vat_cents as number) ?? 0,
        totalCents: (row.total_cents as number) ?? 0,
      };
    });

    return { ...lueLasku(data), rows };
  } catch {
    return null;
  }
}

/**
 * Avoimet saatavat: lähetetyt joita ei ole maksettu.
 *
 * Luonnos ei ole saatava — sitä ei ole lähetetty kenellekään — eikä
 * mitätöity ole enää saatava. Tämä on se luku joka kertoo paljonko
 * asiakkailta on tulossa.
 */
export function avoimetSaatavat(laskut: Invoice[]): number {
  return laskut
    .filter((l) => l.status === "sent")
    .reduce((summa, l) => summa + l.totalCents, 0);
}
