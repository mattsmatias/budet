import Link from "next/link";
import { employeeContext } from "@/lib/restoflow/page-context";
import {
  filterReceipts,
  searchReceipts,
  sortByDateDesc,
  type ReceiptFilter,
} from "@/lib/restoflow/expenses";
import { CATEGORY_LABELS, REVIEW_REASON_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CategoryBubble,
  EmptyState,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Kuitit" };

const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: "all", label: "Kaikki" },
  { key: "needs_review", label: "Tarkistettavat" },
  { key: "food", label: "Ruoka" },
  { key: "alcohol", label: "Alkoholi" },
  { key: "soft_drinks", label: "Alkoholittomat" },
  { key: "kitchen_supplies", label: "Keittiö" },
  { key: "cleaning", label: "Siivous" },
  { key: "other", label: "Muut" },
];

export default async function ReceiptsPage({ searchParams }: PageProps<"/app/kuitit">) {
  const params = await searchParams;
  const { receipts, seesAllReceipts } = await employeeContext("/app/kuitit");

  const query = typeof params.haku === "string" ? params.haku : "";
  const filter = (typeof params.suodatin === "string" ? params.suodatin : "all") as ReceiptFilter;

  const visible = sortByDateDesc(filterReceipts(searchReceipts(receipts, query), filter));
  const reviewCount = receipts.filter((r) => r.status === "needs_review").length;

  return (
    <div className="rf-enter space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Kuitit</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {visible.length} kuittia
          {reviewCount > 0 && filter === "all" ? ` · ${reviewCount} tarkistettavaa` : ""}
          {seesAllReceipts ? "" : " · vain omat"}
        </p>
      </header>

      <form action="/app/kuitit">
        {filter !== "all" ? <input type="hidden" name="suodatin" value={filter} /> : null}
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--rf-text-3)" }}
          >
            <RfIcon name="search" size={18} />
          </span>
          <label htmlFor="rf-search" className="sr-only">
            Hae kuitteja
          </label>
          <input
            id="rf-search"
            type="search"
            name="haku"
            defaultValue={query}
            placeholder="Hae kuitteja"
            className="w-full py-2.5 pl-11 pr-4 text-[15px] outline-none"
            style={{
              background: "var(--rf-card)",
              borderRadius: "var(--rf-r-control)",
              boxShadow: "var(--rf-shadow-sm)",
            }}
          />
        </div>
      </form>

      <nav aria-label="Suodattimet" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const search = new URLSearchParams();
            if (f.key !== "all") search.set("suodatin", f.key);
            if (query) search.set("haku", query);
            const qs = search.toString();

            return (
              <li key={f.key}>
                <Link
                  href={qs ? `/app/kuitit?${qs}` : "/app/kuitit"}
                  aria-current={active ? "page" : undefined}
                  className="rf-press inline-block whitespace-nowrap px-3.5 py-1.5 text-[13px] font-medium"
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
          description={
            query
              ? "Kokeile toista hakusanaa."
              : "Lisää ensimmäinen kuitti oikean alakulman painikkeesta."
          }
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {visible.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/app/kuitit/${receipt.id}`}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <CategoryBubble category={receipt.category} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {receipt.supplierName}
                    </p>
                    <p
                      className="rf-tabular mt-0.5 text-[13px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatDate(receipt.date)} · {CATEGORY_LABELS[receipt.category]}
                    </p>
                    {receipt.status === "needs_review" && receipt.reviewReasons[0] ? (
                      <div className="mt-1.5">
                        <Pill tone="warn" dot>
                          {REVIEW_REASON_LABELS[receipt.reviewReasons[0]]}
                        </Pill>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rf-tabular text-[15px] font-semibold">
                      {formatMoney(receipt.totalCents)}
                    </span>
                    <span style={{ color: "var(--rf-text-3)" }}>
                      <RfIcon name="chevron" size={16} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link
        href="/app/kuitit/uusi"
        aria-label="Lisää uusi kuitti"
        className="rf-press fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center"
        style={{
          background: "var(--rf-blue)",
          color: "#fff",
          borderRadius: "50%",
          boxShadow: "0 4px 16px rgba(0,113,227,0.4)",
        }}
      >
        <RfIcon name="plus" size={26} />
      </Link>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
