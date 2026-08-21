import Link from "next/link";
import { notFound } from "next/navigation";
import { RECEIPTS, employeeById, receiptById } from "@/lib/restoflow/data";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { Card, Icon, ICONS, Pill } from "@/components/restoflow/ui";

export function generateStaticParams() {
  return RECEIPTS.map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/app/kuitit/[id]">) {
  const { id } = await params;
  const receipt = receiptById(id);
  return { title: receipt ? receipt.supplier : "Kuitti" };
}

export default async function ReceiptDetailPage({
  params,
}: PageProps<"/app/kuitit/[id]">) {
  const { id } = await params;
  const receipt = receiptById(id);
  if (!receipt) notFound();

  const addedBy = employeeById(receipt.addedByUserId);

  return (
    <div className="rf-enter space-y-4">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href="/app/kuitit"
          aria-label="Takaisin"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <Icon path={ICONS.back} size={22} />
        </Link>
        <h1 className="truncate text-[22px] font-semibold tracking-tight">
          {receipt.supplier}
        </h1>
      </header>

      {/* Kuittikuva. Demossa paikanpitäjä — oikeaa kuvaa ei ole. */}
      <div
        className="flex h-52 flex-col items-center justify-center gap-2"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-card)",
          color: "var(--rf-text-3)",
        }}
      >
        <Icon path={ICONS.receipt} size={30} />
        <p className="text-[13px]">
          {receipt.hasImage ? "Kuittikuva (ei saatavilla demossa)" : "Ei kuvaa"}
        </p>
      </div>

      {/* Yhteenveto */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold">{receipt.supplier}</p>
            <p className="rf-tabular mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {formatDate(receipt.date)} · {PAYMENT_LABELS[receipt.paymentMethod]}
            </p>
          </div>
          <p className="rf-tabular text-[24px] font-semibold">
            {formatMoney(receipt.totalCents)}
          </p>
        </div>

        {receipt.status === "needs_review" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {receipt.reviewReasons.map((r) => (
              <Pill key={r} tone="warn" dot>
                {REVIEW_REASON_LABELS[r]}
              </Pill>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <Pill tone="ok" dot>
              Tarkistettu
            </Pill>
          </div>
        )}
      </Card>

      {/* Kentät */}
      <Card>
        <p className="mb-1 text-[13px] font-semibold">Kuittitiedot</p>
        <dl>
          <Row label="Toimittaja" value={receipt.supplier} />
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
          <Row label="Lisännyt" value={addedBy?.name ?? "—"} last />
        </dl>
      </Card>

      {receipt.lines.length > 0 ? (
        <Card>
          <p className="mb-3 text-[13px] font-semibold">Rivit</p>
          <ul className="space-y-2.5">
            {receipt.lines.map((line, i) => (
              <li key={i} className="flex justify-between gap-4 text-[14px]">
                <span style={{ color: "var(--rf-text-2)" }}>
                  {line.description}
                  {line.quantity !== null ? ` · ${line.quantity} kpl` : ""}
                </span>
                <span className="rf-tabular shrink-0 font-medium">
                  {formatMoney(line.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <button
        type="button"
        disabled
        className="w-full py-3.5 text-[16px] font-semibold opacity-40"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Muokkaa
      </button>
      <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Muokkaus vaatii tietokantayhteyden, jota ei ole vielä kytketty.
      </p>
    </div>
  );
}

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
