import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  formatMonth,
  periodTotals,
  previousMonth,
} from "@/lib/restoflow/expenses";
import { MonthPicker } from "../month-picker";
import { formatMoney } from "@/lib/money";
import {
  Card,
  Icon,
  ICONS,
  Avatar,
} from "@/components/restoflow/ui";
import { SendToAccountant } from "./send-to-accountant";

export const metadata = { title: "Raportointi" };

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

export default async function ReportsPage({
  searchParams,
}: PageProps<"/admin/raportit">) {
  const params = await searchParams;
  const { receipts, users, month, restaurant } = await adminContext(
    "/admin/raportit",
  );

  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth =
    /^d{4}-d{2}$/.test(requested) && requested <= month ? requested : month;

  const totals = periodTotals(receipts, viewMonth);

  // Kutsuttu kirjanpitäjä näkee raportit itse eikä tarvitse tiedostoja.
  const accountants = users.filter((user) => user.role === "accountant");

  // Kaksitoista kuukautta taaksepäin, kuten yleiskuvassa.
  const selectable: string[] = [];
  let cursor = month;
  for (let i = 0; i < 13; i++) {
    selectable.push(cursor);
    cursor = previousMonth(cursor);
  }

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="rf-z-page relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
            Raportointi
          </h1>
          <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            {formatMonth(viewMonth)} · {totals.receiptCount} kuittia ·{" "}
            {formatMoney(totals.totalCents)} kirjattuja kuluja
          </p>
        </div>

        <MonthPicker value={viewMonth} months={selectable} />
      </div>

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
                href={`/admin/raportit/csv?tyyppi=${report.kind}&kuukausi=${viewMonth}`}
                className="rf-press inline-flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-accent)",
                  color: "var(--rf-on-accent)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <Icon path={ICONS.download} size={16} />
                Lataa CSV
              </a>

              <a
                href={`/admin/raportit/xlsx?tyyppi=${report.kind}&kuukausi=${viewMonth}`}
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
                href={`/admin/raportit/tulosta?kuukausi=${viewMonth}`}
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

        {accountants.length > 0 ? (
          <>
            <p
              className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              {accountants.length === 1
                ? "Kirjanpitäjä on jo mukana."
                : `${accountants.length} kirjanpitäjää on jo mukana.`}{" "}
              He näkevät nämä samat luvut itse ja aina ajantasaisina, joten
              tiedostoja ei tarvitse lähettää lainkaan. Tuntipalkat ja
              henkilöstön yksityiskohdat eivät näy heille.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {accountants.map((accountant) => (
                <span
                  key={accountant.id}
                  className="inline-flex items-center gap-2 py-1.5 pl-1.5 pr-3 text-[13px]"
                  style={{ background: "var(--rf-inset)", borderRadius: 999 }}
                >
                  <Avatar initials={accountant.initials} size={24} />
                  {accountant.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p
            className="mt-1.5 max-w-2xl text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            Kutsu kirjanpitäjä käyttäjäksi roolilla <strong>Kirjanpitäjä</strong>,
            niin hän näkee kulut, ALV:t ja raportit itse eikä tiedostoja tarvitse
            lähettää. Hän ei näe tuntipalkkoja eikä henkilöstön yksityiskohtia.
          </p>
        )}

        <p
          className="mt-2 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Excel-tiedostossa summat ovat lukuja, joten niillä voi laskea heti.
          CSV:ssä kaikki on tekstiä, ja se käyttää puolipistettä erottimena
          sekä UTF-8-tunnistetta — suomalainen Excel avaa sen suoraan oikein.
          Molemmat rakennetaan samasta lähteestä, joten luvut eivät voi erota
          toisistaan.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/admin/raportit/xlsx?kuukausi=${viewMonth}`}
            className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <Icon path={ICONS.download} size={16} />
            Lataa koko kuukausi Excelinä
          </a>

          {accountants.length === 0 ? (
            <Link
              href="/admin/tyontekijat"
              className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Kutsu kirjanpitäjä
            </Link>
          ) : null}
        </div>

        <SendToAccountant
          restaurantName={restaurant.name}
          monthLabel={formatMonth(viewMonth)}
          receiptCount={totals.receiptCount}
          totalLabel={formatMoney(totals.totalCents)}
        />
      </Card>
    </div>
  );
}
