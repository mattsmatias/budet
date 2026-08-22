import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import { formatMonth, periodTotals } from "@/lib/restoflow/expenses";
import { formatMoney } from "@/lib/money";
import {
  Card,
  ScopeNotice,
  Icon,
  ICONS,
} from "@/components/restoflow/ui";

export const metadata = { title: "Raportit" };

const REPORTS = [
  {
    kind: "kulut",
    title: "Kuluraportti",
    description:
      "Kuukauden kirjatut kulut kategorioittain, ALV eriteltynä ja tarkistettavien määrä.",
  },
  {
    kind: "kategoriat",
    title: "Kulut kategorioittain",
    description: "Ruoka, juomat, tarvikkeet, siivous ja muut — summat ja osuudet.",
  },
  {
    kind: "kuitit",
    title: "Kuitit",
    description:
      "Kaikki kuukauden kuitit riveittäin: toimittaja, kategoria, maksutapa, ALV ja tila.",
  },
  {
    kind: "tyoaika",
    title: "Työaikaraportti",
    description: "Työntekijöiden tehdyt tunnit kuukaudessa.",
  },
  {
    kind: "henkilostokulut",
    title: "Henkilöstökulut",
    description:
      "Työtuntien ja tuntipalkkojen perusteella laskettu henkilöstökulu työntekijöittäin.",
  },
] as const;

export default async function ReportsPage() {
  const {
    receipts, month,
  } = await adminContext("/admin/raportit");

  const totals = periodTotals(receipts, month);

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">Raportit</h1>
        <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(month)} · {totals.receiptCount} kuittia ·{" "}
          {formatMoney(totals.totalCents)} kirjattuja kuluja
        </p>
      </div>

      <ScopeNotice>
        CSV käyttää puolipistettä erottimena ja UTF-8-tunnistetta, joten
        suomalainen Excel avaa sen suoraan oikein. Luvut ovat kuittiaineistosta,
        eivät kassasta — raportti kertoo mitä on kirjattu, ei mitä on myyty.
      </ScopeNotice>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {REPORTS.map((report) => (
          <Card key={report.kind} hover>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold">{report.title}</h2>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {report.description}
                </p>
              </div>
              <span style={{ color: "var(--rf-text-3)" }}>
                <Icon path={ICONS.file} size={22} />
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <a
                href={`/admin/raportit/csv?tyyppi=${report.kind}&kuukausi=${month}`}
                className="rf-press inline-flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-text)",
                  color: "#fff",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <Icon path={ICONS.download} size={16} />
                Lataa CSV
              </a>

              <a
                href={`/admin/raportit/xlsx?tyyppi=${report.kind}&kuukausi=${month}`}
                className="rf-press inline-flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-inset)",
                  color: "var(--rf-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <Icon path={ICONS.download} size={16} />
                Excel
              </a>

              <Link
                href={`/admin/raportit/tulosta?kuukausi=${month}`}
                className="rf-press inline-flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-inset)",
                  color: "var(--rf-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <Icon path={ICONS.file} size={16} />
                PDF
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-[16px] font-semibold">Toimitus kirjanpitäjälle</h2>
        <p
          className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Kutsu kirjanpitäjä käyttäjäksi roolilla <strong>Kirjanpitäjä</strong>,
          niin hän näkee kulut, ALV:t ja raportit itse eikä tiedostoja tarvitse
          lähettää. Hän ei näe tuntipalkkoja eikä henkilöstön yksityiskohtia.
        </p>
        <p
          className="mt-2 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Excel-tiedostossa summat ovat lukuja, joten niillä voi laskea heti.
          CSV:ssä kaikki on tekstiä. Molemmat rakennetaan samasta lähteestä,
          joten luvut eivät voi erota toisistaan.
        </p>
        <a
          href={`/admin/raportit/xlsx?kuukausi=${month}`}
          className="rf-press mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-text)",
            color: "#fff",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <Icon path={ICONS.download} size={16} />
          Lataa koko kuukausi Excelinä
        </a>
        <Link
          href="/admin/tyontekijat"
          className="rf-press mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Kutsu kirjanpitäjä
        </Link>
      </Card>
    </div>
  );
}
