import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  formatMonth,
  periodTotals,
  previousMonth,
} from "@/lib/restoflow/expenses";
import { formatMoney } from "@/lib/money";
import { Avatar, Card } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
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
    description:
      "Ruoka, juomat, tarvikkeet, siivous ja muut — summat ja osuudet.",
  },
  {
    kind: "kuitit",
    title: "Kuitit",
    description:
      "Kaikki kuukauden kuitit riveittäin: toimittaja, kategoria, maksutapa, ALV ja tila.",
  },
  {
    kind: "alv",
    title: "ALV-raportti",
    description:
      "Myynnin ALV verokannoittain: verollinen, vero ja veroton. Kanta on se joka oli voimassa kun päivä kirjattiin.",
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
  const locale = await resolveLocale();
  const params = await searchParams;
  const { receipts, users, month, restaurant } =
    await adminContext("/admin/raportit");

  const requested =
    typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth =
    ISO_MONTH.test(requested) && requested <= month ? requested : month;

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
      <div className="rf-z-page relative flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(viewMonth, locale)} · {totals.receiptCount} kuittia ·{" "}
          {formatMoney(totals.totalCents)} kirjattuja kuluja
        </p>

        {/*
          Kuukausiraportti on yksi raportti, ei kuusi.

          PDF-painike oli jokaisessa kortissa, mutta tulostettava sivu
          ei lue raporttityyppiä lainkaan: Työaikaraportin PDF antoi
          saman kuluraportin kuin ALV-raportin. Kuusi painiketta lupasi
          kuutta eri tiedostoa ja tuotti yhden.

          Nyt se on siellä missä se on totta: sivun tasolla, omalla
          nimellään.
        */}
        <Link
          href={`/admin/raportit/tulosta?kuukausi=${viewMonth}`}
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="report" size={15} />
          Kuukausiraportti
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {REPORTS.map((report) => (
          <Card key={report.kind} hover>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
                  {report.title}
                </h2>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {report.description}
                </p>
              </div>
              <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
                <RfIcon name="report" size={20} />
              </span>
            </div>

            {/*
              Kaksi samanarvoista muotoa, samannäköisinä.

              Painikkeet olivat kolmea eri kokoa ja painoa saman kortin
              sisällä, vaikka ne tekevät saman asian eri tiedostotyypillä.
              Korostusväri jäi pois molemmilta: kun kaikki on
              korostettu, mikään ei ole.
            */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Lataus
                href={`/admin/raportit/csv?tyyppi=${report.kind}&kuukausi=${viewMonth}`}
                label="CSV"
              />
              <Lataus
                href={`/admin/raportit/xlsx?tyyppi=${report.kind}&kuukausi=${viewMonth}`}
                label="Excel"
              />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          Toimitus kirjanpitäjälle
        </h2>

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
            Kutsu kirjanpitäjä käyttäjäksi roolilla{" "}
            <strong>Kirjanpitäjä</strong>, niin hän näkee kulut, ALV:t ja
            raportit itse eikä tiedostoja tarvitse lähettää. Hän ei näe
            tuntipalkkoja eikä henkilöstön yksityiskohtia.
          </p>
        )}

        <p
          className="mt-2 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Excel-tiedostossa summat ovat lukuja, joten niillä voi laskea heti.
          CSV:ssä kaikki on tekstiä, ja se käyttää puolipistettä erottimena sekä
          UTF-8-tunnistetta — suomalainen Excel avaa sen suoraan oikein.
          Molemmat rakennetaan samasta lähteestä, joten luvut eivät voi erota
          toisistaan.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/admin/raportit/xlsx?kuukausi=${viewMonth}`}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              border: "1px solid transparent",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="download" size={15} />
            Lataa koko kuukausi Excelinä
          </a>

          {accountants.length === 0 ? (
            <Link
              href="/admin/tyontekijat"
              className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text)",
                border: "1px solid var(--rf-line-strong)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Kutsu kirjanpitäjä
            </Link>
          ) : null}
        </div>

        <SendToAccountant
          restaurantName={restaurant.name}
          monthLabel={formatMonth(viewMonth, locale)}
          receiptCount={totals.receiptCount}
          totalLabel={formatMoney(totals.totalCents)}
        />
      </Card>
    </div>
  );
}

/**
 * Latauspainike.
 *
 * Kaikki raporttien latauspainikkeet samasta paikasta: kolme eri
 * kokoa saman kortin sisällä oli sattumaa, ei valintaa.
 */
function Lataus({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="download" size={15} />
      {label}
    </a>
  );
}
