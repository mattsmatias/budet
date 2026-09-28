import Link from "next/link";
import { notFound } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { fetchInvoice, type InvoiceStatus } from "@/lib/restoflow/invoices";
import { onMyohassa } from "@/lib/restoflow/invoice-math";
import { todayIn } from "@/lib/restoflow/local-time";
import { formatMoney } from "@/lib/money";
import { Card, Pill, type Tone } from "@/components/restoflow/ui";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.laskut.title };
}

/**
 * Yksi lasku.
 *
 * RIVILLÄ EI NÄY VEROA.
 *
 * Rivin vero on jako-osuus, ja laskun vero lasketaan kannoittain —
 * rivien verojen summa voi poiketa siitä sentin. Jos molemmat
 * näytettäisiin, ne näyttäisivät olevan ristiriidassa, vaikka
 * kumpikin on oikein omassa tehtävässään. Siksi rivi näyttää
 * verottoman ja erittely kertoo veron kannoittain, kuten laki vaatii.
 */
export default async function InvoicePage({
  params,
}: PageProps<"/admin/laskut/[id]">) {
  const { id } = await params;
  const { restaurant } = await adminContext("/admin/laskut");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;

  const lasku = await fetchInvoice(id, restaurant.id);
  if (!lasku) notFound();

  const tanaan = todayIn(restaurant.timezone);
  const myohassa = onMyohassa(lasku, tanaan);

  const tilaTeksti: Record<InvoiceStatus, string> = {
    draft: t.laskut.statusDraft,
    sent: t.laskut.statusSent,
    paid: t.laskut.statusPaid,
    cancelled: t.laskut.statusCancelled,
  };

  const tilaVari: Record<InvoiceStatus, Tone> = {
    draft: "neutral",
    sent: "info",
    paid: "ok",
    cancelled: "neutral",
  };

  const pvm = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(tag, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="rf-enter space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">
            {lasku.recipientName}
          </h1>
          <p
            className="rf-tabular mt-1 text-[13px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.laskut.invoiceNumber} {lasku.number} · {t.laskut.reference}{" "}
            {lasku.reference}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {myohassa ? (
            <Pill tone="risk">{t.laskut.overdue}</Pill>
          ) : (
            <Pill tone={tilaVari[lasku.status]}>{tilaTeksti[lasku.status]}</Pill>
          )}

          <Link
            href={`/admin/laskut/${lasku.id}/tulosta`}
            className="rf-press rf-touch px-4 text-[13px] font-bold"
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 980,
              background: "var(--rf-inset)",
            }}
          >
            {t.laskut.print}
          </Link>
        </div>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tieto
            otsikko={t.laskut.invoiceDate}
            arvo={pvm(lasku.invoiceDate)}
          />
          <Tieto otsikko={t.laskut.dueDate} arvo={pvm(lasku.dueDate)} />
          <Tieto
            otsikko={t.laskut.total}
            arvo={formatMoney(lasku.totalCents)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-[13px] font-semibold">{t.laskut.rows}</h2>

        <ul className="mt-2 divide-y" style={{ borderColor: "var(--rf-line)" }}>
          {lasku.rows.map((rivi) => (
            <li key={rivi.id} className="flex justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">
                  {rivi.description}
                </span>
                <span
                  className="rf-tabular mt-0.5 block text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {rivi.quantity} {rivi.unit ?? ""} ×{" "}
                  {formatMoney(rivi.unitPriceCents)}
                </span>
              </span>
              <span className="rf-tabular shrink-0 text-[13.5px] font-semibold">
                {formatMoney(rivi.netCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
          <Rivi otsikko={t.laskut.net} arvo={formatMoney(lasku.netCents)} />
          <Rivi
            otsikko={t.laskut.vatTotal}
            arvo={formatMoney(lasku.vatCents)}
          />
          <Rivi
            otsikko={t.laskut.total}
            arvo={formatMoney(lasku.totalCents)}
            vahva
          />
        </div>
      </Card>

      {lasku.note ? (
        <Card>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {lasku.note}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Tieto({ otsikko, arvo }: { otsikko: string; arvo: string }) {
  return (
    <div>
      <p
        className="text-[11px] font-bold uppercase"
        style={{ color: "var(--rf-text-3)", letterSpacing: "0.06em" }}
      >
        {otsikko}
      </p>
      <p className="rf-tabular mt-0.5 text-[15px] font-bold">{arvo}</p>
    </div>
  );
}

function Rivi({
  otsikko,
  arvo,
  vahva,
}: {
  otsikko: string;
  arvo: string;
  vahva?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${vahva ? "mt-1 text-[15px] font-bold" : "text-[13px]"}`}
      style={vahva ? undefined : { color: "var(--rf-text-2)" }}
    >
      <span>{otsikko}</span>
      <span className="rf-tabular">{arvo}</span>
    </div>
  );
}
