import { notFound } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { fetchInvoice } from "@/lib/restoflow/invoices";
import { fetchInvoicingSettings } from "@/lib/restoflow/invoicing";
import { alvNumero, muotoileIban } from "@/lib/restoflow/yritystunnus";
import { formatMoney, formatRate } from "@/lib/money";
import { PrintButton } from "../../../raportit/tulosta/print-button";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.laskut.title };
}

/**
 * Tulostettava lasku.
 *
 * TÄMÄ ON SE PAPERI JOKA LÄHTEE ASIAKKAALLE.
 *
 * Arvonlisäverolaki 209 e § luettelee mitä laskussa on oltava:
 * päivämäärä, juokseva numero, myyjän ALV-tunniste, ostajan nimi ja
 * osoite, tavaroiden tai palvelujen kuvaus ja määrä, veron peruste
 * verokannoittain, verokanta ja veron määrä. Jokainen niistä on
 * tässä, ja siksi mitään ei saa poistaa "siistimisen" vuoksi.
 *
 * Viitenumero ja tilinumero eivät ole lain vaatimia mutta ilman niitä
 * maksu ei kohdistu: pankki tunnistaa suorituksen viitteestä, ja ilman
 * sitä joku lukee tiliotetta rivi riviltä.
 *
 * EI OMAA PDF-KIRJASTOA.
 *
 * Selain osaa sivutuksen, marginaalit ja fontit paremmin kuin mikään
 * kirjasto jonka voisi lisätä — ja ääkköset toimivat ilman fonttien
 * upottamista. Sama ratkaisu kuin raporttien tulosteessa.
 */
export default async function InvoicePrintPage({
  params,
}: PageProps<"/admin/laskut/[id]/tulosta">) {
  const { id } = await params;
  const { restaurant } = await adminContext("/admin/laskut");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;

  const [lasku, myyja] = await Promise.all([
    fetchInvoice(id, restaurant.id),
    fetchInvoicingSettings(restaurant.id),
  ]);

  if (!lasku) notFound();

  const pvm = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(tag, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  const alv = myyja.businessId ? alvNumero(myyja.businessId) : null;

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <div className="rf-no-print mb-4 flex justify-end">
        <PrintButton t={t} />
      </div>

      <article
        className="rf-lasku p-8"
        style={{ background: "var(--rf-card)", color: "var(--rf-text)" }}
      >
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">
              {restaurant.name}
            </h1>
            <p className="rf-tabular mt-1 text-[12px] leading-relaxed"
               style={{ color: "var(--rf-text-2)" }}>
              {myyja.businessId ? `${t.laskut.businessId} ${myyja.businessId}` : ""}
              {alv ? <><br />{t.laskut.vatNumber} {alv}</> : null}
            </p>
          </div>

          <div className="text-end">
            <p className="text-[18px] font-bold">{t.laskut.one}</p>
            <p className="rf-tabular mt-1 text-[12.5px]">
              {t.laskut.invoiceNumber} {lasku.number}
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase"
               style={{ color: "var(--rf-text-3)", letterSpacing: "0.06em" }}>
              {t.laskut.recipient}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed">
              <strong>{lasku.recipientName}</strong>
              {lasku.recipientBusinessId ? <><br />{lasku.recipientBusinessId}</> : null}
              {lasku.recipientCareOf ? <><br />{lasku.recipientCareOf}</> : null}
              {lasku.recipientStreet ? <><br />{lasku.recipientStreet}</> : null}
              {lasku.recipientPostalCode || lasku.recipientCity ? (
                <><br />{[lasku.recipientPostalCode, lasku.recipientCity].filter(Boolean).join(" ")}</>
              ) : null}
            </p>
          </div>

          <dl className="rf-tabular space-y-1 text-[12.5px]">
            <Pari nimi={t.laskut.invoiceDate} arvo={pvm(lasku.invoiceDate)} />
            <Pari nimi={t.laskut.dueDate} arvo={pvm(lasku.dueDate)} />
            <Pari nimi={t.laskut.reference} arvo={lasku.reference} />
            {myyja.iban ? (
              <Pari nimi={t.laskut.payTo} arvo={muotoileIban(myyja.iban)} />
            ) : null}
          </dl>
        </section>

        <table className="mt-8 w-full text-[12.5px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--rf-line-strong)" }}>
              <th className="pb-2 text-start font-semibold">{t.laskut.description}</th>
              <th className="pb-2 text-end font-semibold">{t.laskut.quantity}</th>
              <th className="pb-2 text-end font-semibold">{t.laskut.unitPrice}</th>
              <th className="pb-2 text-end font-semibold">{t.laskut.vat}</th>
              <th className="pb-2 text-end font-semibold">{t.laskut.rowNet}</th>
            </tr>
          </thead>
          <tbody>
            {lasku.rows.map((rivi) => (
              <tr key={rivi.id} style={{ borderBottom: "1px solid var(--rf-line)" }}>
                <td className="py-2">{rivi.description}</td>
                <td className="rf-tabular py-2 text-end">
                  {rivi.quantity} {rivi.unit ?? ""}
                </td>
                <td className="rf-tabular py-2 text-end">
                  {formatMoney(rivi.unitPriceCents)}
                </td>
                <td className="rf-tabular py-2 text-end">
                  {formatRate(rivi.vatRate, tag)}
                </td>
                <td className="rf-tabular py-2 text-end">
                  {formatMoney(rivi.netCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/*
          Veron peruste ja määrä kannoittain.

          Tämä on se kohta jonka laki nimenomaan vaatii, ja se
          lasketaan kannoittain eikä riveittäin — siksi rivitaulukossa
          ei ole veroa lainkaan.
        */}
        <section className="mt-6 flex justify-end">
          <dl className="rf-tabular w-full max-w-[320px] space-y-1 text-[12.5px]">
            <p className="text-[11px] font-bold uppercase"
               style={{ color: "var(--rf-text-3)", letterSpacing: "0.06em" }}>
              {t.laskut.vatBreakdown}
            </p>

            {kannat(lasku.rows).map((k) => (
              <Pari
                key={k.vatRate}
                nimi={`${t.laskut.taxBase} ${formatRate(k.vatRate, tag)}`}
                arvo={`${formatMoney(k.netCents)} + ${formatMoney(k.vatCents)}`}
              />
            ))}

            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--rf-line)" }}>
              <Pari nimi={t.laskut.net} arvo={formatMoney(lasku.netCents)} />
              <Pari nimi={t.laskut.vatTotal} arvo={formatMoney(lasku.vatCents)} />
            </div>

            <div className="flex justify-between border-t pt-2 text-[15px] font-bold"
                 style={{ borderColor: "var(--rf-line-strong)" }}>
              <span>{t.laskut.total}</span>
              <span className="rf-tabular">{formatMoney(lasku.totalCents)}</span>
            </div>
          </dl>
        </section>

        {lasku.note || myyja.invoiceNote ? (
          <footer className="mt-8 border-t pt-4 text-[12px] leading-relaxed"
                  style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-2)" }}>
            {lasku.note ? <p className="whitespace-pre-wrap">{lasku.note}</p> : null}
            {myyja.invoiceNote ? (
              <p className="mt-2 whitespace-pre-wrap">{myyja.invoiceNote}</p>
            ) : null}
          </footer>
        ) : null}
      </article>
    </div>
  );
}

/**
 * Kannat laskun riveistä.
 *
 * Tallennetut summat ovat laskun omat, mutta erittely kootaan riveistä
 * samalla säännöllä jolla se kannassa laskettiin — näin tuloste ei voi
 * näyttää eri erittelyä kuin se mistä loppusumma syntyi.
 */
function kannat(
  rivit: { vatRate: number; netCents: number }[],
): { vatRate: number; netCents: number; vatCents: number }[] {
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
    <div className="flex justify-between gap-4">
      <dt style={{ color: "var(--rf-text-2)" }}>{nimi}</dt>
      <dd className="font-semibold">{arvo}</dd>
    </div>
  );
}
