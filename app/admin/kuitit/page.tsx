import { adminContext } from "@/lib/restoflow/page-context";
import Link from "next/link";
import {
  filterReceipts,
  searchReceipts,
  sortByDateDesc,
  type ReceiptFilter,
} from "@/lib/restoflow/expenses";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { Card, EmptyState, Icon, ICONS, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Kuitit" };

const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: "all", label: "Kaikki" },
  { key: "needs_review", label: "Tarkistettavat" },
  { key: "food", label: "Ruoka" },
  { key: "alcohol", label: "Juomat" },
  { key: "kitchen_supplies", label: "Tarvikkeet" },
  { key: "cleaning", label: "Siivous" },
  { key: "other", label: "Muut" },
];

export default async function AdminReceiptsPage({
  searchParams,
}: PageProps<"/admin/kuitit">) {
  const {
    receipts, users,
  } = await adminContext("/admin/kuitit");

  const params = await searchParams;
  const query = typeof params.haku === "string" ? params.haku : "";
  const filter = (typeof params.suodatin === "string" ? params.suodatin : "all") as ReceiptFilter;
  const highlight = typeof params.korosta === "string" ? params.korosta : null;

  const visible = sortByDateDesc(
    filterReceipts(searchReceipts(receipts, query), filter),
  );

  const total = visible.reduce((s, r) => s + r.totalCents, 0);

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Kuitit</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            {visible.length} kuittia · {formatMoney(total)}
          </p>
        </div>
        <form action="/admin/kuitit" className="flex gap-2">
          {filter !== "all" ? <input type="hidden" name="suodatin" value={filter} /> : null}
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--rf-text-3)" }}
            >
              <Icon path={ICONS.search} size={17} />
            </span>
            <label htmlFor="admin-search" className="sr-only">
              Hae kuitteja
            </label>
            <input
              id="admin-search"
              type="search"
              name="haku"
              defaultValue={query}
              placeholder="Toimittaja, numero tai summa"
              className="w-72 py-2 pl-10 pr-3 text-[14px] outline-none"
              style={{
                background: "var(--rf-card)",
                borderRadius: "var(--rf-r-control)",
                boxShadow: "var(--rf-shadow-sm)",
              }}
            />
          </div>
        </form>
      </div>

      <nav aria-label="Suodattimet">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const params = new URLSearchParams();
            if (f.key !== "all") params.set("suodatin", f.key);
            if (query) params.set("haku", query);
            const qs = params.toString();

            return (
              <li key={f.key}>
                <Link
                  href={qs ? `/admin/kuitit?${qs}` : "/admin/kuitit"}
                  aria-current={active ? "page" : undefined}
                  className="rf-press inline-block px-3.5 py-1.5 text-[13px] font-medium"
                  style={{
                    background: active ? "var(--rf-text)" : "var(--rf-card)",
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
          description={query ? "Kokeile toista hakusanaa." : "Kuitteja ei ole vielä lisätty."}
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-[14px]">
              <caption className="sr-only">Kaikki kuitit</caption>
              <thead>
                <tr
                  className="border-b text-left text-[12px] uppercase tracking-[0.04em]"
                  style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
                >
                  <th scope="col" className="px-5 py-3 font-medium">Toimittaja</th>
                  <th scope="col" className="px-5 py-3 font-medium">Päivä</th>
                  <th scope="col" className="px-5 py-3 font-medium">Kategoria</th>
                  <th scope="col" className="px-5 py-3 font-medium">Maksutapa</th>
                  <th scope="col" className="px-5 py-3 font-medium">Lisännyt</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">ALV</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Yhteensä</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {visible.map((receipt) => {
                  const addedBy = users.find((u) => u.id === receipt.addedByUserId);
                  const isHighlighted = receipt.id === highlight;

                  return (
                    <tr
                      key={receipt.id}
                      style={{
                        background: isHighlighted ? "var(--rf-blue-bg)" : undefined,
                      }}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium">{receipt.supplierName}</p>
                        {receipt.status === "needs_review" ? (
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            {receipt.reviewReasons.map((r) => (
                              <Pill key={r} tone="warn" dot>
                                {REVIEW_REASON_LABELS[r]}
                              </Pill>
                            ))}
                          </p>
                        ) : null}
                      </td>
                      <td className="rf-tabular px-5 py-3">{formatDate(receipt.date)}</td>
                      <td className="px-5 py-3">{CATEGORY_LABELS[receipt.category]}</td>
                      <td className="px-5 py-3" style={{ color: "var(--rf-text-2)" }}>
                        {PAYMENT_LABELS[receipt.paymentMethod]}
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--rf-text-2)" }}>
                        {addedBy?.name.split(" ")[0] ?? "—"}
                      </td>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{
                          color:
                            receipt.vatCents === null
                              ? "var(--rf-amber-text)"
                              : "var(--rf-text-2)",
                        }}
                      >
                        {receipt.vatCents === null ? "puuttuu" : formatMoney(receipt.vatCents)}
                      </td>
                      <td className="rf-tabular px-5 py-3 text-right font-semibold">
                        {formatMoney(receipt.totalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
