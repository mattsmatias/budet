import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  filterReceipts,
  needsReview,
  searchReceipts,
  sortByDateDesc,
  type ReceiptFilter,
} from "@/lib/restoflow/expenses";
import { duplicateIds, findDuplicates } from "@/lib/restoflow/duplicates";
import { can, canAddReceipts } from "@/lib/restoflow/permissions";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
  type ExpenseCategory,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { ProductIcon, RfIcon, SupplierIcon } from "@/components/restoflow/icons";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";
import { DeleteReceipt, ReviewPanel } from "./review";
import { ReceiptSearch } from "./search";

export const metadata = { title: "Kuitit" };

const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: "all", label: "Kaikki" },
  { key: "needs_review", label: "Tarkistettavat" },
  { key: "food", label: "Ruoka" },
  { key: "alcohol", label: "Alkoholi" },
  { key: "soft_drinks", label: "Alkoholittomat" },
  { key: "kitchen_supplies", label: "Keittiö" },
  { key: "packaging", label: "Pakkaus" },
  { key: "cleaning", label: "Siivous" },
  { key: "transport", label: "Kuljetus" },
  { key: "other", label: "Muut" },
];

export default async function AdminReceiptsPage({
  searchParams,
}: PageProps<"/admin/kuitit">) {
  const params = await searchParams;
  const { receipts, users, role } = await adminContext("/admin/kuitit");

  const query = typeof params.haku === "string" ? params.haku : "";
  const filter = (typeof params.suodatin === "string" ? params.suodatin : "all") as ReceiptFilter;
  const highlight = typeof params.korosta === "string" ? params.korosta : null;

  const visible = sortByDateDesc(
    filterReceipts(searchReceipts(receipts, query), filter),
  );

  const total = visible.reduce((s, r) => s + r.totalCents, 0);
  const reviewCount = needsReview(receipts).length;
  const duplicates = duplicateIds(receipts);
  const duplicateGroups = findDuplicates(receipts);
  const canReview = can(role, "receipts.edit");
  const canAdd = canAddReceipts(role);

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
            Kuitit
          </h1>
          <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            {visible.length} kuittia · {formatMoney(total)}
            {reviewCount > 0 && filter === "all" ? ` · ${reviewCount} tarkistettavaa` : ""}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          {canAdd ? (
            <Link
              href="/admin/kuitit/uusi"
              className="rf-press flex items-center justify-center gap-2 py-3 text-[15px] font-semibold md:order-2 md:px-5 md:py-2.5 md:text-[14px]"
              style={{
                background: "var(--rf-accent)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <RfIcon name="plus" size={17} />
              Uusi kuitti
            </Link>
          ) : null}

          <div className="w-full md:order-1 md:w-auto">
            <ReceiptSearch initial={query} />
          </div>
        </div>
      </div>

      {duplicateGroups.length > 0 && canReview ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-red)" }}>
              <RfIcon name="alert" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {duplicateGroups.length === 1
                  ? "Mahdollinen kaksoiskappale"
                  : `${duplicateGroups.length} mahdollista kaksoiskappaletta`}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                Sama toimittaja, sama summa, sama tai viereinen päivä. Jos
                kyseessä on kaksi erillistä ostosta, jätä molemmat.
              </p>

              <ul className="mt-3 space-y-3">
                {duplicateGroups.map((group) => (
                  <li key={group.receipts[0].id}>
                    <p className="text-[14px] font-medium">
                      {group.supplierName} · {formatMoney(group.totalCents)}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {group.reason}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {group.receipts.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="rf-tabular text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                            {formatDate(r.date)} · lisännyt{" "}
                            {users.find((u) => u.id === r.addedByUserId)?.name ?? "—"}
                          </span>
                          <DeleteReceipt receiptId={r.id} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <nav aria-label="Suodattimet" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-2 pb-1 md:flex-wrap">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const search = new URLSearchParams();
            if (f.key !== "all") search.set("suodatin", f.key);
            if (query) search.set("haku", query);
            const qs = search.toString();

            return (
              <li key={f.key}>
                <Link
                  href={qs ? `/admin/kuitit?${qs}` : "/admin/kuitit"}
                  aria-current={active ? "page" : undefined}
                  className="rf-press inline-block whitespace-nowrap px-3.5 py-1.5 text-[13px] font-medium"
                  style={{
                    background: active ? "var(--rf-accent)" : "var(--rf-card)",
                    color: active ? "#fff" : "var(--rf-text-2)",
                    borderRadius: "var(--rf-r-pill)",
                    boxShadow: active ? "none" : "var(--rf-shadow-sm)",
                  }}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? "Ei osumia" : "Ei kuitteja"}
          description={
            query
              ? "Kokeile toista hakusanaa."
              : "Lisää ensimmäinen kuitti yllä olevasta painikkeesta."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((receipt) => {
            const isDuplicate = duplicates.has(receipt.id);
            const isHighlighted = receipt.id === highlight;

            return (
              <li key={receipt.id}>
                <Card
                  className={isHighlighted ? "ring-2" : ""}
                  {...(isHighlighted
                    ? { style: { boxShadow: "0 0 0 2px var(--rf-blue)" } }
                    : {})}
                >
                  <div className="flex items-start gap-3">
                    <SupplierBubble
                      name={receipt.supplierName}
                      category={receipt.category}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/admin/kuitit/${receipt.id}`}
                          className="text-[15px] font-semibold underline-offset-4 hover:underline"
                        >
                          {receipt.supplierName}
                        </Link>
                        <p className="rf-tabular text-[17px] font-semibold">
                          {formatMoney(receipt.totalCents)}
                        </p>
                      </div>

                      <p
                        className="rf-tabular mt-0.5 text-[13px]"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatDate(receipt.date)} · {CATEGORY_LABELS[receipt.category]} ·{" "}
                        {PAYMENT_LABELS[receipt.paymentMethod]}
                      </p>

                      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        ALV{" "}
                        {receipt.vatCents === null ? "puuttuu" : formatMoney(receipt.vatCents)}
                        {receipt.items.length > 0 ? ` · ${receipt.items.length} riviä` : ""} ·
                        lisännyt{" "}
                        {users.find((u) => u.id === receipt.addedByUserId)?.name ?? "—"}
                      </p>

                      {receipt.status === "needs_review" || isDuplicate ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {isDuplicate ? (
                            <Pill tone="risk" dot>
                              mahdollinen kaksoiskappale
                            </Pill>
                          ) : null}
                          {receipt.reviewReasons.map((r) => (
                            <Pill key={r} tone="warn" dot>
                              {REVIEW_REASON_LABELS[r]}
                            </Pill>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Pill tone="ok" dot>
                            tarkistettu
                          </Pill>
                        </div>
                      )}
                    </div>
                  </div>

                  {receipt.items.length > 0 ? (
                    <details
                      className="mt-3 border-t pt-3"
                      style={{ borderColor: "var(--rf-line)" }}
                    >
                      <summary className="rf-press flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
                        <span
                          className="rf-summary-chevron"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          <RfIcon name="chevron" size={14} />
                        </span>
                        <span style={{ color: "var(--rf-blue)" }}>
                          {receipt.items.length === 1
                            ? "Näytä 1 rivi"
                            : `Näytä ${receipt.items.length} riviä`}
                        </span>
                      </summary>

                      <ul className="mt-3 space-y-1.5">
                        {receipt.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
                                <ProductIcon
                                  description={item.description}
                                  category={item.category}
                                  size={15}
                                />
                              </span>
                              <span className="truncate">{item.description}</span>
                            </span>
                            <span className="rf-tabular shrink-0" style={{ color: "var(--rf-text-2)" }}>
                              {formatMoney(item.totalCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
                    <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {receipt.hasImage ? (
                        <>
                          <RfIcon name="image" size={14} />
                          Kuva liitetty
                        </>
                      ) : (
                        "Ei kuvaa"
                      )}
                    </span>
                    <Link
                      href={`/admin/kuitit/${receipt.id}`}
                      className="rf-press flex items-center gap-1 text-[13px] font-medium"
                      style={{ color: "var(--rf-blue)" }}
                    >
                      Avaa
                      <RfIcon name="chevron" size={14} />
                    </Link>
                  </div>

                  {canReview && receipt.status === "needs_review" ? (
                    <ReviewPanel receipt={receipt} />
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Toimittajan tunnus listassa.
 *
 * Sama pyöreä kupla kuin ennen, mutta sisällä toimittajan oma ikoni
 * kategorian sijaan. S-Market ja Alko näyttävät nyt eri asioilta, mikä
 * on koko listan silmäiltävyyden kannalta se olennainen ero.
 */
function SupplierBubble({
  name,
  category,
}: {
  name: string;
  category: ExpenseCategory;
}) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: "50%",
      }}
    >
      <SupplierIcon name={name} category={category} size={20} />
    </span>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
