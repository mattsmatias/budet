import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import {
  fetchReceipt,
  fetchReceiptImageUrl,
  fetchUsers,
} from "@/lib/restoflow/queries";
import { checkVat, formatRate, isMixedReceipt } from "@/lib/restoflow/vat";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { ReceiptImage } from "@/components/restoflow/receipt-image";
import { Card, CategoryBubble, Pill } from "@/components/restoflow/ui";
import { DeleteReceipt, ReviewPanel } from "../review";

export async function generateMetadata({ params }: PageProps<"/admin/kuitit/[id]">) {
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

  if (!can(role, "receipts.view")) redirect("/admin");

  const receipt = await fetchReceipt(id);
  // RLS palauttaa tyhjän jos oikeutta ei ole — 404 ei paljasta onko
  // kuitti olemassa toisessa ravintolassa.
  if (!receipt) notFound();

  const [users, imageUrl] = await Promise.all([
    fetchUsers(restaurant.id),
    fetchReceiptImageUrl(receipt.imagePath),
  ]);

  const addedBy = users.find((u) => u.id === receipt.addedByUserId);
  const vat = checkVat(
    receipt.totalCents,
    receipt.vatCents,
    receipt.category,
    receipt.items,
  );
  const mixed = isMixedReceipt(receipt.items);
  const canReview = can(role, "receipts.edit");

  return (
    <div className="rf-enter mx-auto max-w-4xl space-y-4">
      <header className="flex items-center gap-2">
        <Link
          href="/admin/kuitit"
          aria-label="Takaisin kuittilistaan"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
        <h1 className="truncate text-[22px] font-semibold tracking-tight md:text-[26px]">
          {receipt.supplierName}
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <CategoryBubble category={receipt.category} size={40} />
                <div>
                  <p className="text-[15px] font-semibold">{receipt.supplierName}</p>
                  <p
                    className="rf-tabular mt-0.5 text-[13px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {formatDate(receipt.date)} · {PAYMENT_LABELS[receipt.paymentMethod]}
                  </p>
                </div>
              </div>
              <p className="rf-tabular text-[24px] font-semibold">
                {formatMoney(receipt.totalCents)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {receipt.status === "needs_review" ? (
                receipt.reviewReasons.map((r) => (
                  <Pill key={r} tone="warn" dot>
                    {REVIEW_REASON_LABELS[r]}
                  </Pill>
                ))
              ) : (
                <Pill tone="ok" dot>
                  Tarkistettu
                </Pill>
              )}
              {mixed ? <Pill tone="info">Sekakuitti</Pill> : null}
            </div>

            {canReview && receipt.status === "needs_review" ? (
              <ReviewPanel receipt={receipt} />
            ) : null}
          </Card>

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
              {vat.rates.map(formatRate).join(" ja ")}. Rivien verot
              summautuvat kuittiin merkittyyn ALV:hen.
            </p>
          ) : null}

          <Card>
            <p className="mb-1 text-[13px] font-semibold">Kuittitiedot</p>
            <dl>
              <Row label="Toimittaja" value={receipt.supplierName} />
              <Row label="Päivämäärä" value={formatDate(receipt.date)} />
              <Row label="Yhteensä" value={formatMoney(receipt.totalCents)} />
              <Row
                label="ALV"
                value={receipt.vatCents === null ? "—" : formatMoney(receipt.vatCents)}
                warn={receipt.vatCents === null}
              />
              <Row label="Kategoria" value={CATEGORY_LABELS[receipt.category]} />
              <Row label="Maksutapa" value={PAYMENT_LABELS[receipt.paymentMethod]} />
              <Row label="Kuittinumero" value={receipt.receiptNumber ?? "—"} />
              <Row label="Muistiinpano" value={receipt.note ?? "—"} />
              <Row label="Lisännyt" value={addedBy?.name ?? "—"} />
              <Row label="Lisätty" value={formatDateTime(receipt.addedAt)} last />
            </dl>
          </Card>

          {receipt.items.length > 0 ? (
            <Card>
              <p className="mb-3 text-[13px] font-semibold">
                Rivit ({receipt.items.length})
              </p>
              <ul className="space-y-3">
                {receipt.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                        <CategoryIcon category={item.category} size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px]">{item.description}</span>
                        <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                          {CATEGORY_LABELS[item.category]}
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
                <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
                  Tämä kuitti jakautuu useaan kategoriaan. Kulut kirjautuvat
                  rivikohtaisesti, ei koko summa yhteen kategoriaan.
                </p>
              ) : null}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="mb-3 text-[13px] font-semibold">Kuitin kuva</p>

            {imageUrl ? (
              <ReceiptImage url={imageUrl} alt={`Kuitti: ${receipt.supplierName}`} />
            ) : (
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
                {receipt.hasImage
                  ? "Kuva on tallennettu, mutta sitä ei juuri nyt saatu haettua."
                  : "Tähän kuittiin ei liitetty kuvaa."}
              </p>
            )}

            {receipt.imageQuality === "poor" ? (
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-amber-text)" }}>
                Kuva arvioitiin epäselväksi. Tarkista luvut erityisen
                huolellisesti.
              </p>
            ) : null}
          </Card>

          {canReview ? (
            <Card>
              <p className="mb-2 text-[13px] font-semibold">Poista kuitti</p>
              <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
                Poisto on peruuttamaton. Jos kyseessä on kaksoiskappale,
                poista se — jos erillinen ostos, jätä molemmat.
              </p>
              <DeleteReceipt receiptId={receipt.id} />
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

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(iso.slice(0, 10))} klo ${iso.slice(11, 16)}`;
}
