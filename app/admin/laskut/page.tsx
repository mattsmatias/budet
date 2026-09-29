import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  avoimetSaatavat,
  fetchInvoices,
  type InvoiceStatus,
} from "@/lib/restoflow/invoices";
import {
  fetchInvoicingSettings,
  voikoLaskuttaa,
} from "@/lib/restoflow/invoicing";
import { onMyohassa } from "@/lib/restoflow/invoice-math";
import { todayIn } from "@/lib/restoflow/local-time";
import { formatMoney } from "@/lib/money";
import { Card, EmptyState, Pill, type Tone } from "@/components/restoflow/ui";
import { LaskutTabs } from "./tabs";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.laskut.title };
}

/**
 * Myyntilaskut.
 *
 * AVOIMET SAATAVAT ON SIVUN TÄRKEIN LUKU.
 *
 * Laskulista kertoo mitä on tehty; avoimet saatavat kertovat mitä on
 * vielä tulossa — ja se on se luku jota yrittäjä katsoo. Myöhässä
 * olevat erottuvat omalla merkillään, koska niille on tehtävä jotain.
 */
export default async function InvoicesPage() {
  const { restaurant } = await adminContext("/admin/laskut");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;

  const [laskut, asetukset] = await Promise.all([
    fetchInvoices(restaurant.id),
    fetchInvoicingSettings(restaurant.id),
  ]);

  const tanaan = todayIn(restaurant.timezone);
  const avoimet = avoimetSaatavat(laskut);
  const valmis = voikoLaskuttaa(asetukset);

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
      <LaskutTabs t={t} nyt="laskut" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">
            {t.laskut.title}
          </h1>
          <p
            className="mt-1 text-[13.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.laskut.lead}
          </p>
        </div>

        {valmis ? (
          <Link
            href="/admin/laskut/uusi"
            className="rf-press rf-touch shrink-0 px-4 text-[13px] font-bold"
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 980,
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
            }}
          >
            {t.laskut.newOne}
          </Link>
        ) : null}
      </header>

      {/*
        Puuttuvat myyjän tiedot kerrotaan ennen kuin laskua aletaan
        tehdä, ei sen jälkeen. Ilman Y-tunnusta ja tilinumeroa syntyisi
        lasku jota ei voi lähettää.
      */}
      {valmis ? null : (
        <Card>
          <p
            className="text-[13.5px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {t.laskut.needSettings}
          </p>
          <Link
            href="/admin/asetukset?osio=laskutus"
            className="rf-press mt-2 inline-flex text-[13px] font-semibold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.laskut.needSettingsLink} →
          </Link>
        </Card>
      )}

      {avoimet > 0 ? (
        <Card>
          <p
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--rf-text-3)", letterSpacing: "0.06em" }}
          >
            {t.laskut.open}
          </p>
          <p className="rf-tabular mt-1 text-[26px] font-extrabold tracking-[-0.02em]">
            {formatMoney(avoimet)}
          </p>
          <p
            className="mt-0.5 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.laskut.openHint}
          </p>
        </Card>
      ) : null}

      {laskut.length === 0 ? (
        <Card>
          <EmptyState title={t.laskut.empty} description={t.laskut.emptyHint} />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {laskut.map((lasku) => {
            const myohassa = onMyohassa(lasku, tanaan);

            return (
              <Link key={lasku.id} href={`/admin/laskut/${lasku.id}`}>
                <Card hover>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[14.5px] font-bold tracking-[-0.0075em]">
                        {lasku.recipientName}
                      </h2>
                      <p
                        className="rf-tabular mt-0.5 text-[12.5px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {t.laskut.invoiceNumber} {lasku.number} ·{" "}
                        {pvm(lasku.invoiceDate)} · {t.laskut.dueDate}{" "}
                        {pvm(lasku.dueDate)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {myohassa ? (
                        <Pill tone="risk">{t.laskut.overdue}</Pill>
                      ) : (
                        <Pill tone={tilaVari[lasku.status]}>
                          {tilaTeksti[lasku.status]}
                        </Pill>
                      )}
                      <span className="rf-tabular text-[15px] font-bold">
                        {formatMoney(lasku.totalCents)}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
