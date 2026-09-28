import { Resend } from "resend";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { InvoiceWithRows } from "./invoices";
import type { InvoicingSettings } from "./invoicing";
import { muotoileIban } from "./yritystunnus";
import { formatMoney } from "@/lib/money";
import { fill } from "@/lib/i18n/auth-text";

/**
 * Laskun lähetys sähköpostilla.
 *
 * SAATE JA LIITE, EI JOMPIKUMPI.
 *
 * Varsinainen lasku on PDF-liitteenä, koska vastaanottaja on
 * velvollinen arkistoimaan sen ja lähettää sen eteenpäin
 * kirjanpitäjälleen. Viestin rungossa on vain saate: summa, eräpäivä,
 * viite ja tilinumero. Näin maksaja näkee olennaisen avaamatta
 * liitettä, ja kirjanpitäjä saa tiedoston.
 *
 * RUNKO ON YKSINKERTAINEN TARKOITUKSELLA.
 *
 * Outlook renderöi sähköpostin Wordin moottorilla, jossa moderni CSS
 * hajoaa tavoilla joita ei voi testata etukäteen. Saate on tekstiä ja
 * muutama tyylitelty kappale — ei taulukkoja, ei kuvia, ei mitään
 * mikä voi mennä rikki matkalla.
 *
 * AVAIN LUETAAN VASTA KUTSUTTAESSA.
 *
 * Moduulitasolla luotu Resend-asiakas kaatuisi käännöksessä
 * ympäristössä jossa avainta ei ole — ja sellainen on jokainen
 * ympäristö ennen kuin avain on asetettu.
 */

/** Lähettäjä. Domain on verifioitava Resendissä, muuten viesti ei lähde. */
const LAHETTAJA = process.env.INVOICE_EMAIL_FROM ?? "laskut@kateapp.fi";

export type LahetysTulos =
  | { ok: true }
  | { ok: false; syy: "no-key" | "no-recipient" | "failed"; viesti?: string };

function pakene(teksti: string): string {
  return teksti
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvoiceEmail(args: {
  lasku: InvoiceWithRows;
  myyja: InvoicingSettings;
  myyjanNimi: string;
  /** Mihin asiakkaan vastaus menee. Ilman tätä vastaus katoaa. */
  vastausOsoite: string | null;
  pdf: Buffer;
  tiedostonimi: string;
  t: AdminText;
  tag: string;
}): Promise<LahetysTulos> {
  const avain = process.env.RESEND_API_KEY;
  if (!avain) return { ok: false, syy: "no-key" };

  const vastaanottaja = args.lasku.recipientEmail;
  if (!vastaanottaja) return { ok: false, syy: "no-recipient" };

  const { lasku, myyja, myyjanNimi, t, tag } = args;

  const pvm = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(tag, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  const otsikko = fill(t.laskut.mailSubject, {
    numero: String(lasku.number),
    myyja: myyjanNimi,
  });

  const rivit: [string, string][] = [
    [t.laskut.total, formatMoney(lasku.totalCents)],
    [t.laskut.dueDate, pvm(lasku.dueDate)],
    [t.laskut.reference, lasku.reference],
  ];

  if (myyja.iban) rivit.push([t.laskut.payTo, muotoileIban(myyja.iban)]);

  const teksti = [
    fill(t.laskut.mailGreeting, { myyja: myyjanNimi }),
    "",
    ...rivit.map(([nimi, arvo]) => `${nimi}: ${arvo}`),
    "",
    t.laskut.mailAttached,
    "",
    myyjanNimi,
  ].join("\n");

  const html = [
    `<p>${pakene(fill(t.laskut.mailGreeting, { myyja: myyjanNimi }))}</p>`,
    "<p>",
    rivit
      .map(
        ([nimi, arvo]) =>
          `<strong>${pakene(nimi)}:</strong> ${pakene(arvo)}`,
      )
      .join("<br>"),
    "</p>",
    `<p>${pakene(t.laskut.mailAttached)}</p>`,
    `<p>${pakene(myyjanNimi)}</p>`,
  ].join("");

  try {
    const resend = new Resend(avain);

    const { error } = await resend.emails.send({
      from: `${myyjanNimi} <${LAHETTAJA}>`,
      to: [vastaanottaja],
      /*
       * Vastaus myyjälle eikä lähettävään osoitteeseen.
       *
       * laskut@kateapp.fi on Katen osoite, ei asiakkaan myyjän. Ilman
       * tätä asiakkaan kysymys laskusta tulisi meille eikä sille joka
       * osaa vastata.
       */
      replyTo: args.vastausOsoite ?? undefined,
      subject: otsikko,
      text: teksti,
      html,
      attachments: [
        { filename: args.tiedostonimi, content: args.pdf.toString("base64") },
      ],
    });

    if (error) return { ok: false, syy: "failed", viesti: error.message };

    return { ok: true };
  } catch (virhe) {
    return {
      ok: false,
      syy: "failed",
      viesti: virhe instanceof Error ? virhe.message : undefined,
    };
  }
}
