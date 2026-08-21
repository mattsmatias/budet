import { DEMO_MONTH, RECEIPTS } from "@/lib/restoflow/data";
import { formatMonth, periodTotals } from "@/lib/restoflow/expenses";
import { formatMoney } from "@/lib/money";
import {
  Card,
  DemoNotice,
  Icon,
  ICONS,
  Pill,
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

export default function ReportsPage() {
  const month = DEMO_MONTH;
  const totals = periodTotals(RECEIPTS, month);

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Raportit</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(month)} · {totals.receiptCount} kuittia ·{" "}
          {formatMoney(totals.totalCents)} kirjattuja kuluja
        </p>
      </div>

      <DemoNotice>
        Raportit toimivat oikeasti ja lataavat CSV-tiedoston. Sisältö on
        demo-aineistoa. CSV käyttää puolipistettä erottimena ja UTF-8-tunnistetta,
        joten suomalainen Excel avaa sen suoraan oikein.
      </DemoNotice>

      <div className="grid gap-4 md:grid-cols-2">
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

              <span className="inline-flex items-center gap-1.5 opacity-55">
                <span
                  className="px-3.5 py-2 text-[14px] font-semibold"
                  style={{
                    background: "var(--rf-inset)",
                    color: "var(--rf-text-2)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                >
                  Vie PDF
                </span>
                <Pill>ei vielä</Pill>
              </span>

              <span className="inline-flex items-center gap-1.5 opacity-55">
                <span
                  className="px-3.5 py-2 text-[14px] font-semibold"
                  style={{
                    background: "var(--rf-inset)",
                    color: "var(--rf-text-2)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                >
                  Vie Excel
                </span>
                <Pill>ei vielä</Pill>
              </span>
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
          Raportin lähettäminen suoraan kirjanpitäjälle vaatii käyttäjätilit ja
          sähköpostiyhteyden, joita ei ole vielä kytketty. Toistaiseksi lataa
          CSV ja lähetä se itse. Emme näytä tässä painiketta joka ei tee mitään.
        </p>
      </Card>
    </div>
  );
}
