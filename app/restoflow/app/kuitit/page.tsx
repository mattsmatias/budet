import Link from "next/link";
import { RECEIPTS } from "@/lib/restoflow/data";
import {
  filterReceipts,
  searchReceipts,
  sortByDateDesc,
  type ReceiptFilter,
} from "@/lib/restoflow/expenses";
import { CATEGORY_LABELS, REVIEW_REASON_LABELS } from "@/lib/restoflow/types";
import {
  Card,
  EmptyState,
  Icon,
  ICONS,
  Money,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Kuitit" };

const FILTERS: { key: ReceiptFilter; label: string }[] = [
  { key: "all", label: "Kaikki" },
  { key: "needs_review", label: "Tarkistettavat" },
  { key: "food", label: "Ruoka" },
  { key: "drinks", label: "Juomat" },
  { key: "supplies", label: "Tarvikkeet" },
  { key: "other", label: "Muut" },
];

export default async function ReceiptsPage({
  searchParams,
}: PageProps<"/restoflow/app/kuitit">) {
  const params = await searchParams;
  const query = typeof params.haku === "string" ? params.haku : "";
  const filter = (typeof params.suodatin === "string" ? params.suodatin : "all") as ReceiptFilter;

  const receipts = sortByDateDesc(
    filterReceipts(searchReceipts(RECEIPTS, query), filter),
  );

  const reviewCount = RECEIPTS.filter((r) => r.status === "needs_review").length;

  return (
    <div className="rf-enter space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Kuitit</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {receipts.length} kuittia
          {reviewCount > 0 && filter === "all" ? ` · ${reviewCount} tarkistettavaa` : ""}
        </p>
      </header>

      {/* Haku */}
      <form action="/restoflow/app/kuitit">
        {filter !== "all" ? <input type="hidden" name="suodatin" value={filter} /> : null}
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--rf-text-3)" }}
          >
            <Icon path={ICONS.search} size={18} />
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

      {/* Suodattimet */}
      <nav aria-label="Suodattimet" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const href = buildHref(f.key, query);
            return (
              <li key={f.key}>
                <Link
                  href={href}
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

      {receipts.length === 0 ? (
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
            {receipts.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/restoflow/app/kuitit/${receipt.id}`}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{receipt.supplier}</p>
                    <p
                      className="rf-tabular mt-0.5 text-[13px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatDate(receipt.date)} · {CATEGORY_LABELS[receipt.category]}
                    </p>
                    {receipt.status === "needs_review" ? (
                      <div className="mt-1.5">
                        <Pill tone="warn" dot>
                          {REVIEW_REASON_LABELS[receipt.reviewReasons[0]]}
                        </Pill>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Money cents={receipt.totalCents} className="text-[15px] font-semibold" />
                    <span style={{ color: "var(--rf-text-3)" }}>
                      <Icon path={ICONS.chevron} size={16} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Kelluva lisäyspainike */}
      <Link
        href="/restoflow/app/kuitit/uusi"
        aria-label="Lisää uusi kuitti"
        className="rf-press fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center"
        style={{
          background: "var(--rf-blue)",
          color: "#fff",
          borderRadius: "50%",
          boxShadow: "0 4px 16px rgba(0,113,227,0.4)",
        }}
      >
        <Icon path={ICONS.plus} size={26} />
      </Link>
    </div>
  );
}

function buildHref(filter: ReceiptFilter, query: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("suodatin", filter);
  if (query) params.set("haku", query);
  const qs = params.toString();
  return qs ? `/restoflow/app/kuitit?${qs}` : "/restoflow/app/kuitit";
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
