import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { InvoiceWithRows } from "./invoices";
import type { InvoicingSettings } from "./invoicing";
import { alvNumero, muotoileIban } from "./yritystunnus";
import { formatMoney, formatRate } from "@/lib/money";

/**
 * Lasku PDF:nä.
 *
 * MIKSI PDF EIKÄ SÄHKÖPOSTIN RUNKO.
 *
 * Lasku ei pysähdy siihen ihmiseen joka sen avaa. Se on tosite, jonka
 * vastaanottaja on velvollinen säilyttämään kuusi vuotta, ja se
 * lähetetään eteenpäin kirjanpitäjälle. PDF on yksi tiedosto jonka voi
 * arkistoida ja välittää; sähköpostin runko ei ole, ja Outlookin läpi
 * välitettynä sen muotoilu hajoaa.
 *
 * FONTTIA EI UPOTETA.
 *
 * Oletusfontti Helvetica käyttää WinAnsi-koodausta, joka kattaa ä, ö
 * ja å. Suomenkielinen lasku toimii siis ilman omaa fonttitiedostoa —
 * upotus olisi kolme megatavua ja ylläpidettävä tiedosto vastineeksi
 * siitä ettei mikään näytä erilaiselta.
 *
 * SISÄLTÖ ON LAIN MÄÄRÄÄMÄ.
 *
 * Arvonlisäverolaki 209 e § luettelee mitä laskussa on oltava, ja
 * jokainen kohta on tässä. Siksi täältä ei poisteta mitään
 * "siistimisen" vuoksi.
 */

const V = "#0f1729";
const HARMAA = "#6b7280";
const VIIVA = "#d1d5db";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: V,
    lineHeight: 1.5,
  },
  ylatunniste: { flexDirection: "row", justifyContent: "space-between" },
  myyja: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  pieni: { fontSize: 8.5, color: HARMAA },
  otsikko: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  osiot: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  lohko: { width: "48%" },
  korostus: { fontSize: 8, color: HARMAA, letterSpacing: 0.6 },
  nimi: { fontFamily: "Helvetica-Bold", marginTop: 3 },
  pari: { flexDirection: "row", justifyContent: "space-between", marginTop: 1 },
  pariArvo: { fontFamily: "Helvetica-Bold" },
  taulukko: { marginTop: 28 },
  otsikkorivi: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: V,
    paddingBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  rivi: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: VIIVA,
    paddingVertical: 5,
  },
  sKuvaus: { width: "44%" },
  sMaara: { width: "14%", textAlign: "right" },
  sHinta: { width: "16%", textAlign: "right" },
  sAlv: { width: "12%", textAlign: "right" },
  sNetto: { width: "14%", textAlign: "right" },
  summat: { marginTop: 18, flexDirection: "row", justifyContent: "flex-end" },
  summalohko: { width: "52%" },
  loppusumma: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: V,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  alatunniste: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: VIIVA,
    paddingTop: 8,
    fontSize: 8,
    color: HARMAA,
  },
});

/** Kannat riveistä, samalla säännöllä kuin kannassa ja tulosteessa. */
function kannoittain(rivit: { vatRate: number; netCents: number }[]) {
  const netot = new Map<number, number>();

  for (const rivi of rivit) {
    netot.set(rivi.vatRate, (netot.get(rivi.vatRate) ?? 0) + rivi.netCents);
  }

  return [...netot.entries()]
    .map(([vatRate, netCents]) => ({
      vatRate,
      netCents,
      vatCents:
        netCents < 0
          ? -Math.round(-netCents * vatRate)
          : Math.round(netCents * vatRate),
    }))
    .sort((a, b) => a.vatRate - b.vatRate);
}

function Pari({ nimi, arvo }: { nimi: string; arvo: string }) {
  return (
    <View style={s.pari}>
      <Text style={{ color: HARMAA }}>{nimi}</Text>
      <Text style={s.pariArvo}>{arvo}</Text>
    </View>
  );
}

export function InvoiceDocument({
  lasku,
  myyja,
  myyjanNimi,
  t,
  tag,
}: {
  lasku: InvoiceWithRows;
  myyja: InvoicingSettings;
  myyjanNimi: string;
  t: AdminText;
  tag: string;
}) {
  const alv = myyja.businessId ? alvNumero(myyja.businessId) : null;
  const kannat = kannoittain(lasku.rows);

  const pvm = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(tag, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <Document
      title={`${t.laskut.one} ${lasku.number}`}
      author={myyjanNimi}
      language={tag}
    >
      <Page size="A4" style={s.page}>
        <View style={s.ylatunniste}>
          <View>
            <Text style={s.myyja}>{myyjanNimi}</Text>
            {myyja.businessId ? (
              <Text style={s.pieni}>
                {t.laskut.businessId} {myyja.businessId}
              </Text>
            ) : null}
            {alv ? (
              <Text style={s.pieni}>
                {t.laskut.vatNumber} {alv}
              </Text>
            ) : null}
          </View>

          <View>
            {/* Yksikko: tama on yksi lasku, ei laskulista. */}
            <Text style={s.otsikko}>{t.laskut.one}</Text>
            <Text style={[s.pieni, { textAlign: "right" }]}>
              {t.laskut.invoiceNumber} {lasku.number}
            </Text>
          </View>
        </View>

        <View style={s.osiot}>
          <View style={s.lohko}>
            <Text style={s.korostus}>{t.laskut.recipient.toUpperCase()}</Text>
            <Text style={s.nimi}>{lasku.recipientName}</Text>
            {lasku.recipientBusinessId ? (
              <Text>{lasku.recipientBusinessId}</Text>
            ) : null}
            {lasku.recipientCareOf ? <Text>{lasku.recipientCareOf}</Text> : null}
            {lasku.recipientStreet ? <Text>{lasku.recipientStreet}</Text> : null}
            {lasku.recipientPostalCode || lasku.recipientCity ? (
              <Text>
                {[lasku.recipientPostalCode, lasku.recipientCity]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
            ) : null}
          </View>

          <View style={s.lohko}>
            <Pari nimi={t.laskut.invoiceDate} arvo={pvm(lasku.invoiceDate)} />
            <Pari nimi={t.laskut.dueDate} arvo={pvm(lasku.dueDate)} />
            <Pari nimi={t.laskut.reference} arvo={lasku.reference} />
            {myyja.iban ? (
              <Pari nimi={t.laskut.payTo} arvo={muotoileIban(myyja.iban)} />
            ) : null}
          </View>
        </View>

        <View style={s.taulukko}>
          <View style={s.otsikkorivi}>
            <Text style={s.sKuvaus}>{t.laskut.description}</Text>
            <Text style={s.sMaara}>{t.laskut.quantity}</Text>
            <Text style={s.sHinta}>{t.laskut.unitPrice}</Text>
            <Text style={s.sAlv}>{t.laskut.vat}</Text>
            <Text style={s.sNetto}>{t.laskut.rowNet}</Text>
          </View>

          {lasku.rows.map((rivi) => (
            <View key={rivi.id} style={s.rivi} wrap={false}>
              <Text style={s.sKuvaus}>{rivi.description}</Text>
              <Text style={s.sMaara}>
                {rivi.quantity}
                {rivi.unit ? ` ${rivi.unit}` : ""}
              </Text>
              <Text style={s.sHinta}>{formatMoney(rivi.unitPriceCents)}</Text>
              <Text style={s.sAlv}>{formatRate(rivi.vatRate, tag)}</Text>
              <Text style={s.sNetto}>{formatMoney(rivi.netCents)}</Text>
            </View>
          ))}
        </View>

        {/*
          Veron peruste ja määrä kannoittain.

          Tämän laki nimenomaan vaatii, ja se lasketaan kannoittain
          eikä riveittäin — siksi rivitaulukon ALV-sarake kertoo vain
          kannan, ei euroa.
        */}
        <View style={s.summat}>
          <View style={s.summalohko}>
            <Text style={s.korostus}>
              {t.laskut.vatBreakdown.toUpperCase()}
            </Text>

            {kannat.map((k) => (
              <Pari
                key={k.vatRate}
                nimi={`${t.laskut.taxBase} ${formatRate(k.vatRate, tag)}`}
                arvo={`${formatMoney(k.netCents)} + ${formatMoney(k.vatCents)}`}
              />
            ))}

            <View style={{ marginTop: 6 }}>
              <Pari nimi={t.laskut.net} arvo={formatMoney(lasku.netCents)} />
              <Pari
                nimi={t.laskut.vatTotal}
                arvo={formatMoney(lasku.vatCents)}
              />
            </View>

            <View style={s.loppusumma}>
              <Text>{t.laskut.total}</Text>
              <Text>{formatMoney(lasku.totalCents)}</Text>
            </View>
          </View>
        </View>

        {lasku.note || myyja.invoiceNote ? (
          <View style={s.alatunniste} fixed>
            {lasku.note ? <Text>{lasku.note}</Text> : null}
            {myyja.invoiceNote ? <Text>{myyja.invoiceNote}</Text> : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Lasku tavuina: sähköpostin liite ja latauksen sisältö. */
export async function renderInvoicePdf(args: {
  lasku: InvoiceWithRows;
  myyja: InvoicingSettings;
  myyjanNimi: string;
  t: AdminText;
  tag: string;
}): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...args} />);
}

/** Tiedostonimi joka kertoo mikä lasku on kyseessä ilman avaamista. */
export function invoiceFileName(lasku: {
  number: number;
  recipientName: string;
}): string {
  const siisti = lasku.recipientName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `lasku-${lasku.number}${siisti ? `-${siisti}` : ""}.pdf`;
}
