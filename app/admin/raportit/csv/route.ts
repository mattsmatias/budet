/**
 * Raporttien CSV-vienti.
 *
 * Puolipiste erottimena ja UTF-8 BOM alkuun: suomalainen Excel avaa
 * tiedoston silloin suoraan oikein. Pilkku erottimena rikkoisi
 * desimaalipilkulliset summat.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  DEMO_MONTH,
  STAFF,
  MONTHLY_HOURS,
  RECEIPTS,
  userById,
} from "@/lib/restoflow/data";
import {
  receiptsInMonth,
  sortByDateDesc,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import {
  POSITION_LABELS,  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";

type ReportKind = "kulut" | "kategoriat" | "kuitit" | "tyoaika" | "henkilostokulut";

const KINDS: ReportKind[] = [
  "kulut",
  "kategoriat",
  "kuitit",
  "tyoaika",
  "henkilostokulut",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("tyyppi") as ReportKind | null;
  const month = searchParams.get("kuukausi") ?? DEMO_MONTH;

  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "Tuntematon raporttityyppi.", allowed: KINDS },
      { status: 400 },
    );
  }

  const rows = buildRows(kind, month);
  const csv = "﻿" + rows.map((r) => r.map(escapeCell).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="restoflow-${kind}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildRows(kind: ReportKind, month: string): string[][] {
  const inMonth = sortByDateDesc(receiptsInMonth(RECEIPTS, month));

  switch (kind) {
    case "kuitit":
      return [
        ["Päivä", "Toimittaja", "Kategoria", "Maksutapa", "Kuittinumero", "Netto", "ALV", "Yhteensä", "Tila", "Syyt", "Lisännyt"],
        ...inMonth.map((r) => [
          r.date,
          r.supplierName,
          CATEGORY_LABELS[r.category],
          PAYMENT_LABELS[r.paymentMethod],
          r.receiptNumber ?? "",
          money(r.totalCents - (r.vatCents ?? 0)),
          r.vatCents === null ? "" : money(r.vatCents),
          money(r.totalCents),
          r.status === "needs_review" ? "Tarkistettava" : "Tarkistettu",
          r.reviewReasons.map((x) => REVIEW_REASON_LABELS[x]).join(", "),
          userById(r.addedByUserId)?.name ?? "",
        ]),
      ];

    case "kategoriat": {
      const totals = totalsByCategory(inMonth);
      return [
        ["Kategoria", "Kuitteja", "Osuus", "Yhteensä"],
        ...totals.map((t) => [
          CATEGORY_LABELS[t.category],
          String(t.receiptCount),
          `${Math.round(t.share * 100)} %`,
          money(t.totalCents),
        ]),
        [],
        ["Yhteensä", String(inMonth.length), "100 %", money(inMonth.reduce((s, r) => s + r.totalCents, 0))],
      ];
    }

    case "kulut": {
      const totals = totalsByCategory(inMonth);
      const grand = inMonth.reduce((s, r) => s + r.totalCents, 0);
      const vat = inMonth.reduce((s, r) => s + (r.vatCents ?? 0), 0);

      return [
        ["RestoFlow — kuluraportti"],
        ["Kuukausi", month],
        ["Huom", "Luvut ovat järjestelmään kirjattuja kuluja, eivät pankkitilin tapahtumia"],
        [],
        ["Kategoria", "Kuitteja", "Yhteensä"],
        ...totals.map((t) => [
          CATEGORY_LABELS[t.category],
          String(t.receiptCount),
          money(t.totalCents),
        ]),
        [],
        ["Kirjatut kulut yhteensä", "", money(grand)],
        ["Josta ALV", "", money(vat)],
        ["Kuitteja", String(inMonth.length), ""],
        ["Tarkistettavia", String(inMonth.filter((r) => r.status === "needs_review").length), ""],
      ];
    }

    case "tyoaika":
      return [
        ["Työntekijä", "Rooli", "Tunnit"],
        ...STAFF.map((e) => [
          e.name,
          e.position ? POSITION_LABELS[e.position] : "—",
          String(MONTHLY_HOURS[e.id] ?? 0),
        ]),
        [],
        ["Yhteensä", "", String(Object.values(MONTHLY_HOURS).reduce((s, h) => s + h, 0))],
      ];

    case "henkilostokulut": {
      const rows = STAFF.map((e) => {
        const hours = MONTHLY_HOURS[e.id] ?? 0;
        return {
          e,
          hours,
          cost: staffCostCents(hours * 3600000, e.hourlyRateCents ?? 0),
        };
      });

      return [
        ["RestoFlow — henkilöstökuluraportti"],
        ["Kuukausi", month],
        ["Huom", "Laskennallinen. Ei sisällä lisiä, lomakorvauksia eikä sivukuluja"],
        [],
        ["Työntekijä", "Rooli", "Tunnit", "Tuntipalkka", "Kulu"],
        ...rows.map(({ e, hours, cost }) => [
          e.name,
          e.position ? POSITION_LABELS[e.position] : "—",
          String(hours),
          money(e.hourlyRateCents ?? 0),
          money(cost),
        ]),
        [],
        [
          "Yhteensä",
          "",
          String(rows.reduce((s, r) => s + r.hours, 0)),
          "",
          money(rows.reduce((s, r) => s + r.cost, 0)),
        ],
      ];
    }
  }
}

/** Sentit euroiksi desimaalipilkulla, ilman valuuttamerkkiä. */
function money(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function escapeCell(value: string): string {
  if (value === "") return "";
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
