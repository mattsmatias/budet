import Link from "next/link";
import { labels } from "@/lib/i18n/labels";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { monthName } from "@/lib/i18n/format";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import {
  fetchMerchantCategories,
  fetchMerchants,
  fetchReceipt,
  fetchReceiptImageUrls,
  fetchReceipts,
  fetchSuppliers,
  fetchUsers,
} from "@/lib/restoflow/queries";
import { fetchSourceLink } from "@/lib/restoflow/accounting-queries";
import { MerchantBadge } from "@/components/restoflow/merchant-badge";
import {
  checkVat,
  formatRate,
  isMixedReceipt,
  vatByRate,
} from "@/lib/restoflow/vat";
import {} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { ReceiptImage } from "@/components/restoflow/receipt-image";
import { Card, Pill } from "@/components/restoflow/ui";
import { DeleteReceipt, ReviewPanel } from "../review";

export async function generateMetadata({
  params,
}: PageProps<"/admin/kuitit/[id]">) {
  const { id } = await params;
  const receipt = await fetchReceipt(id);
  return { title: receipt?.supplierName ?? "Kuitti" };
}

/**
 * Kuitin yksityiskohdat esihenkilölle.
 *
 * Kuva on tässä pääsisältöä eikä liite: tarkistuksessa luvut on
 * verrattava paperiin, ja ilman kuvaa tallennettu tiedosto on kuollutta
 * tavaraa.
 */
export default async function AdminReceiptDetailPage({
  params,
}: PageProps<"/admin/kuitit/[id]">) {
  const { id } = await params;
  const { restaurant, role } = await requireContext("/admin/kuitit");
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);

  if (!can(role, "receipts.view")) redirect("/admin");

  const receipt = await fetchReceipt(id);
  // RLS palauttaa tyhjän jos oikeutta ei ole — 404 ei paljasta onko
  // kuitti olemassa toisessa ravintolassa.
  if (!receipt) notFound();

  /*
   * Sivut ovat totuus, image_path on peili.
   *
   * Sivutaulu on ensisijainen. Vanha sarake jää varalle niitä kuitteja
   * varten joiden sivuja ei jostain syystä ole — silloin näkyy edes
   * ensimmäinen sivu eikä tyhjä kortti.
   */
  const pagePaths =
    receipt.pages.length > 0
      ? receipt.pages.map((page) => page.storagePath)
      : receipt.imagePath
        ? [receipt.imagePath]
        : [];

  const [
    users,
    imageUrls,
    suppliers,
    merchants,
    merchantCategories,
    allReceipts,
    ledger,
  ] = await Promise.all([
    fetchUsers(restaurant.id),
    fetchReceiptImageUrls(pagePaths),
    fetchSuppliers(restaurant.id),
    fetchMerchants(),
    fetchMerchantCategories(),
    fetchReceipts(restaurant.id),
    fetchSourceLink(restaurant.id, "receipt", id),
  ]);

  const supplier =
    suppliers.find((row) => row.id === receipt.supplierId) ?? null;
  const merchant =
    merchants.find((row) => row.id === supplier?.merchantId) ?? null;
  const tradeLabel =
    merchantCategories.find((c) => c.id === merchant?.category)?.label ?? null;

  /*
   * Saman kaupan historia.
   *
   * Lasketaan brändin eikä toimipisteen mukaan: "K-Market Malmi" ja
   * "K-Market Pihlajisto" ovat sama kauppa kun kysytään paljonko
   * K-Marketiin on mennyt rahaa. Jos brändiä ei tunnisteta, jäljelle
   * jää toimipiste, mikä on sekin oikea vastaus.
   */
  const sameMerchantSupplierIds = new Set(
    merchant
      ? suppliers
          .filter((row) => row.merchantId === merchant.id)
          .map((r) => r.id)
      : [receipt.supplierId],
  );

  const merchantReceipts = allReceipts.filter((r) =>
    sameMerchantSupplierIds.has(r.supplierId ?? ""),
  );

  const month = receipt.date.slice(0, 7);
  const monthReceipts = merchantReceipts.filter((r) =>
    r.date.startsWith(month),
  );
  const monthTotal = monthReceipts.reduce((sum, r) => sum + r.totalCents, 0);
  const latestVisit = merchantReceipts
    .map((r) => r.date)
    .sort()
    .at(-1);

  const addedBy = users.find((u) => u.id === receipt.addedByUserId);
  const vat = checkVat(
    receipt.totalCents,
    receipt.vatCents,
    receipt.category,
    receipt.items,
  );
  const mixed = isMixedReceipt(receipt.items);
  const canReview = can(role, "receipts.edit");
  /* Kannoittainen erittely riveiltä. Sekakuitti ei pakotu yhteen kantaan. */
  const rateBreakdown = vatByRate(receipt.items);

  return (
    <div className="rf-enter mx-auto max-w-4xl space-y-4">
      <header className="flex items-center gap-2">
        <Link
          href="/admin/kuitit"
          aria-label={t.kuitti2.backToList}
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
        <h2 className="truncate text-[20px] font-bold tracking-[-0.02em]">
          {receipt.supplierName}
        </h2>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {vat.explanation ? (
            <div
              className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
              style={{
                background: "var(--rf-amber-bg)",
                color: "var(--rf-amber-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span aria-hidden="true" className="mt-0.5 shrink-0">
                <RfIcon name="alert" size={16} />
              </span>
              <p>{vat.explanation}</p>
            </div>
          ) : vat.rates.length > 1 ? (
            /*
             * Monta verokantaa ei ole virhe vaan tosiasia kuitista.
             * Se kerrotaan neutraalisti, koska koko kuitin
             * keskiarvokanta ei tässä tapauksessa tarkoita mitään —
             * ja koska kirjanpitäjä haluaa tietää jaon.
             */
            <p
              className="px-4 text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              Kuitilla on {vat.rates.length} verokantaa:{" "}
              {vat.rates.map(formatRate).join(" ja ")}. Rivien verot summautuvat
              kuittiin merkittyyn ALV:hen.
            </p>
          ) : null}

          <Card>
            <div className="flex items-start gap-3.5">
              <MerchantBadge
                merchant={merchant}
                fallbackName={receipt.supplierName}
                size={48}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <p className="truncate text-[17px] font-semibold">
                    {merchant?.name ?? receipt.supplierName}
                  </p>

                  {/* Summa tähän, koska tästä tuli sivun otsikkokortti.
                      Kuitin tärkein luku ei saa löytyä vasta alempaa
                      taulukosta. */}
                  <p className="rf-tabular shrink-0 text-[22px] font-semibold leading-tight">
                    {formatMoney(receipt.totalCents)}
                  </p>
                </div>

                {/* Toimipiste erikseen kun brändi tunnetaan. Molempien
                    näyttäminen samalla rivillä toistaisi nimen. */}
                {merchant ? (
                  <p
                    className="truncate text-[13px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {receipt.supplierName}
                  </p>
                ) : null}

                {tradeLabel ? (
                  <p
                    className="mt-1 text-[12px] font-medium"
                    style={{ color: merchant!.brandColor }}
                  >
                    {tradeLabel}
                  </p>
                ) : (
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {t.kuitit.merchantNotRecognised}
                  </p>
                )}
              </div>
            </div>

            {/* Tila ja Tarkista-painike. Nämä olivat poistetussa
                kortissa, eivätkä ne toistu missään muualla — tila ei ole
                Kuittitiedoissa, ja tarkistaminen on toiminto eikä tieto. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {receipt.status === "needs_review" ? (
                receipt.reviewReasons.map((r) => (
                  <Pill key={r} tone="warn" dot>
                    {nimet.reviewReasons[r]}
                  </Pill>
                ))
              ) : (
                <Pill tone="ok" dot>
                  {t.sanat.checked}
                </Pill>
              )}

              {/*
                Kirjanpidon tila samalla rivillä kuin tarkistuksen tila.
                Ne ovat saman kuitin kaksi eri elinkaarta: ensin se
                tarkistetaan, sitten se kirjataan. Erillisenä korttina
                jälkimmäinen jäisi huomaamatta.
              */}
              {can(role, "accounting.view") ? (
                <Pill
                  tone={
                    ledger.state === "posted"
                      ? "ok"
                      : ledger.state === "proposed"
                        ? "warn"
                        : ledger.state === "rejected"
                          ? "risk"
                          : "info"
                  }
                  dot
                >
                  {ledger.state === "posted"
                    ? `Kirjattu · tosite ${ledger.entryNumber}`
                    : ledger.state === "proposed"
                      ? "Odottaa kirjausta"
                      : ledger.state === "rejected"
                        ? t.kuitit.notBooked
                        : t.kuitit.notInAccounting}
                </Pill>
              ) : null}
            </div>

            {canReview && receipt.status === "needs_review" ? (
              <ReviewPanel t={t} nimet={nimet} receipt={receipt} />
            ) : null}

            <dl className="mt-4 grid grid-cols-3 gap-3">
              <Stat
                label={fill(t.kuitit.purchasesIn, {
                  kuukausi: monthWord(month, locale),
                })}
                value={formatMoney(monthTotal)}
              />
              <Stat
                label={t.sanat.receiptCount}
                value={String(merchantReceipts.length)}
              />
              <Stat
                label={t.kuitti2.latest}
                value={latestVisit ? formatDate(latestVisit) : "—"}
              />
            </dl>
          </Card>

          <Card>
            <p className="mb-1 text-[13px] font-semibold">
              {t.kuitti2.details}
            </p>
            <dl>
              <Row label={t.sanat.supplier} value={receipt.supplierName} />
              <Row label={t.kuitit.date} value={formatDate(receipt.date)} />
              <Row
                label={t.kuitit.total}
                value={formatMoney(receipt.totalCents)}
              />
              <Row
                label={t.kuitti2.vat}
                value={
                  receipt.vatCents === null
                    ? "—"
                    : formatMoney(receipt.vatCents)
                }
                warn={receipt.vatCents === null}
              />
              <Row
                label={t.sanat.category}
                value={nimet.categories[receipt.category]}
              />
              <Row
                label={t.kuitti2.paymentMethod}
                value={nimet.payments[receipt.paymentMethod]}
              />
              <Row
                label={t.kuitti2.receiptNumber}
                value={receipt.receiptNumber ?? "—"}
              />
              <Row label={t.kuitti2.note} value={receipt.note ?? "—"} />
              <Row label={t.kuitit.addedBy} value={addedBy?.name ?? "—"} />
              <Row
                label={t.kuitit.addedAt}
                value={formatDateTime(receipt.addedAt)}
                last
              />
            </dl>

            {/*
              ALV kannoittain kun kuitilla on useampi kanta.

              Sekakuitilla kokonais-ALV ei kerro kirjanpitäjälle sitä
              mitä hän tarvitsee: paljonko vähennettävää veroa on
              kummallakin kannalla. Yhden kannan kuitilla erittely
              toistaisi vain yllä olevan rivin.
            */}
            {rateBreakdown.length > 1 ? (
              <div
                className="mt-4 border-t pt-4"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <h3 className="text-[13.5px] font-bold">
                  {t.kuitti2.vatByRate}
                </h3>

                <table className="rf-table mt-2.5 w-full">
                  <caption className="sr-only">{t.kuitti2.vatByRate}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t.kuitti2.rate}</th>
                      <th scope="col" className="text-right">
                        {t.kuitti2.withVat}
                      </th>
                      <th scope="col" className="text-right">
                        {t.kuitti2.vat}
                      </th>
                      <th scope="col" className="text-right">
                        {t.kuitti2.withoutVat}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateBreakdown.map((rate) => (
                      <tr key={rate.rate ?? "tuntematon"} className="rf-row">
                        <td className="font-semibold">
                          {rate.rate === null
                            ? t.kuitit.noVatRate
                            : formatRate(rate.rate)}
                        </td>
                        <td className="rf-tabular text-right">
                          {formatMoney(rate.grossCents)}
                        </td>
                        <td className="rf-tabular text-right">
                          {rate.rate === null
                            ? "—"
                            : formatMoney(rate.vatCents)}
                        </td>
                        <td
                          className="rf-tabular text-right"
                          style={{ color: "var(--rf-text-2)" }}
                        >
                          {formatMoney(rate.netCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rateBreakdown.some((r) => r.rate === null) ? (
                  <p
                    className="mt-2.5 text-[12px] leading-relaxed"
                    style={{ color: "var(--rf-amber-text)" }}
                  >
                    {t.kuitit.missingVatNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          {receipt.items.length > 0 ? (
            <Card>
              <p className="mb-3 text-[13px] font-semibold">
                Rivit ({receipt.items.length})
              </p>
              <ul className="space-y-3">
                {receipt.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        <CategoryIcon category={item.category} size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px]">
                          {item.description}
                        </span>
                        <span
                          className="block text-[12px]"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          {nimet.categories[item.category]}
                          {item.quantity !== null
                            ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : " kpl"}`
                            : ""}
                          {item.vatRate !== null
                            ? ` · ALV ${(item.vatRate * 100).toFixed(1).replace(".", ",")} %`
                            : ""}
                        </span>
                      </span>
                    </span>
                    <span className="rf-tabular shrink-0 text-[14px] font-medium">
                      {formatMoney(item.totalCents)}
                    </span>
                  </li>
                ))}
              </ul>

              {mixed ? (
                <p
                  className="mt-4 text-[12px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.kuitit.multiCategoryNote}
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="mb-3 text-[13px] font-semibold">
              {imageUrls.length > 1
                ? `Kuitin sivut · ${imageUrls.length}`
                : "Kuitin kuva"}
            </p>

            {imageUrls.length > 0 ? (
              <ReceiptImage
                urls={imageUrls}
                alt={`Kuitti: ${receipt.supplierName}`}
              />
            ) : (
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {receipt.hasImage
                  ? t.kuitit.imageNotLoaded
                  : t.kuitit.noImageAttached}
              </p>
            )}

            {receipt.imageQuality === "poor" ? (
              <p
                className="mt-3 text-[12px] leading-relaxed"
                style={{ color: "var(--rf-amber-text)" }}
              >
                {t.kuitit.unclearImage}
              </p>
            ) : null}
          </Card>

          {canReview ? (
            <Card>
              <p className="mb-2 text-[13px] font-semibold">
                {t.kuitti2.deleteReceipt}
              </p>
              <p
                className="mb-3 text-[12px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {t.kuitit.deleteWarning}
              </p>
              <DeleteReceipt t={t} receiptId={receipt.id} />
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  warn,
  last,
}: {
  label: string;
  value: string;
  warn?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 ${last ? "" : "border-b"}`}
      style={{ borderColor: "var(--rf-line)" }}
    >
      <dt className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </dt>
      <dd
        className="rf-tabular text-right text-[14px] font-medium"
        style={{ color: warn ? "var(--rf-amber-text)" : "var(--rf-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Pieni luku otsikoineen. Käytetään kaupan yhteenvedossa. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-3 py-2.5"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <dt className="text-[11px]" style={{ color: "var(--rf-text-3)" }}>
        {label}
      </dt>
      <dd className="rf-tabular mt-0.5 text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

/*
 * Kuukauden nimi Intl:ltä, ei listasta.
 *
 * Tässä oli suomen inessiivimuodot ("kesäkuussa") kovakoodattuna.
 * Ne eivät ole vain kääntämättömiä vaan suomen kieliopin muoto, jota
 * muissa kielissä ei ole — englanniksi lause kuuluu "in June", ja
 * sijapääte katoaa. Nimi tulee nyt Intl:ltä ja lause sanakirjasta.
 */
function monthWord(month: string, locale: AppLocale): string {
  return monthName(month, locale);
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(iso.slice(0, 10))} klo ${iso.slice(11, 16)}`;
}
