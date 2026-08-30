import Link from "next/link";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { Labels } from "@/lib/i18n/labels";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { formatMoney } from "@/lib/money";
import { formatRate } from "@/lib/restoflow/vat";
import {
  isBalanced,
  monthLabel,
  type LedgerEntry,
  type VatSummary,
} from "@/lib/restoflow/accounting";
import type {
  BalanceSheet,
  GeneralLedgerAccount,
  IncomeStatement,
  LedgerAccount,
  TaxGuide,
} from "@/lib/restoflow/accounting-queries";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";
import {
  CorrectEntryForm,
  PostEntryButton,
  RejectEntryButton,
} from "./controls";

// ---------------------------------------------------------------------------
// Päiväkirja
// ---------------------------------------------------------------------------

/**
 * Tapahtumat aikajärjestyksessä.
 *
 * TAULUKKO TYÖPÖYDÄLLE, KORTIT PUHELIMEEN.
 *
 * Yhdeksän saraketta ei mahdu puhelimeen luettavaksi, ja kutistettuna
 * ne olisivat siellä vain nimellisesti. Puhelimessa sama tosite on
 * kortti jossa viennit ovat allekkain — samat luvut, eri muoto.
 */
export function Paivakirja({
  nimet,
  t,
  entries,
  saaKirjata,
}: {
  nimet: Labels;
  t: AdminText;
  entries: LedgerEntry[];
  saaKirjata: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title={t.kirjanpito.noVouchers}
        description={t.kirjanpito2.fetchFirst}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Puhelin */}
      <ul className="space-y-3 md:hidden">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">
                    {entry.description}
                  </p>
                  <p
                    className="rf-tabular mt-0.5 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    Tosite {entry.entryNumber} · {suomiPvm(entry.entryDate)} ·{" "}
                    {nimet.ledgerSource[entry.sourceType]}
                  </p>
                </div>
                <TilaMerkki nimet={nimet} entry={entry} />
              </div>

              <ul className="mt-3 space-y-1.5">
                {entry.lines.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 text-[13px]"
                  >
                    <span
                      className="min-w-0 truncate"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {line.accountNumber} {line.accountName}
                    </span>
                    <span className="rf-tabular shrink-0 font-semibold">
                      {line.debitCents > 0
                        ? formatMoney(line.debitCents)
                        : `− ${formatMoney(line.creditCents)}`}
                    </span>
                  </li>
                ))}
              </ul>

              {saaKirjata && entry.status === "proposed" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <PostEntryButton t={t} id={entry.id} />
                  <RejectEntryButton t={t} id={entry.id} />
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {/* Työpöytä */}
      <Card padded={false} className="hidden md:block">
        <div className="px-5 pt-5">
          <CardHeader
            title={t.kirjanpito.journal}
            subtitle={fill(t.kirjanpito.voucherCount, {
              maara: String(entries.length),
            })}
          />
        </div>

        <div
          className="overflow-x-auto"
          style={{
            borderBottomLeftRadius: "var(--rf-r-card)",
            borderBottomRightRadius: "var(--rf-r-card)",
          }}
        >
          <table className="rf-table w-full min-w-[60rem] text-[14px]">
            <caption className="sr-only">{t.kirjanpito.journalTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{t.yleiskatsaus.day}</th>
                <th scope="col">{t.kirjanpito.voucher}</th>
                <th scope="col">{t.kirjanpito.description}</th>
                <th scope="col">{t.kirjanpito.account}</th>
                <th scope="col" className="text-right">
                  {t.kirjanpito.debit}
                </th>
                <th scope="col" className="text-right">
                  {t.kirjanpito.credit}
                </th>
                <th scope="col" className="text-right">
                  {t.kuitti2.vat}
                </th>
                <th scope="col">{t.kirjanpito.source}</th>
                <th scope="col">{t.sanat.status}</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) =>
                entry.lines.map((line, i) => (
                  <tr key={`${entry.id}-${i}`}>
                    <td className="rf-tabular">
                      {i === 0 ? suomiPvm(entry.entryDate) : ""}
                    </td>
                    <td className="rf-tabular">
                      {i === 0 ? entry.entryNumber : ""}
                    </td>
                    <td>
                      {i === 0 ? (
                        <span className="flex items-center gap-2">
                          {entry.description}
                          {!isBalanced(entry) ? (
                            <span
                              title={t.kirjanpito.voucherMismatch}
                              style={{ color: "var(--rf-red-text)" }}
                            >
                              <RfIcon name="alert" size={14} />
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td style={{ color: "var(--rf-text-2)" }}>
                      {line.accountNumber} {line.accountName}
                    </td>
                    <td className="num">
                      {line.debitCents > 0 ? formatMoney(line.debitCents) : ""}
                    </td>
                    <td className="num">
                      {line.creditCents > 0
                        ? formatMoney(line.creditCents)
                        : ""}
                    </td>
                    <td className="num" style={{ color: "var(--rf-text-3)" }}>
                      {line.vatRate !== null ? formatRate(line.vatRate) : ""}
                    </td>
                    <td style={{ color: "var(--rf-text-3)" }}>
                      {i === 0 ? nimet.ledgerSource[entry.sourceType] : ""}
                    </td>
                    <td>
                      {i === 0 ? (
                        <TilaMerkki nimet={nimet} entry={entry} />
                      ) : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Esitysten käsittely työpöydällä */}
      {saaKirjata ? (
        <div className="hidden md:block">
          {entries
            .filter((e) => e.status === "proposed")
            .slice(0, 20)
            .map((entry) => (
              <Card key={entry.id} className="mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13.5px]">
                    <span className="rf-tabular font-semibold">
                      Tosite {entry.entryNumber}
                    </span>{" "}
                    · {entry.description} ·{" "}
                    <span className="rf-tabular">
                      {formatMoney(entry.totalCents)}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <PostEntryButton t={t} id={entry.id} />
                    <RejectEntryButton t={t} id={entry.id} />
                  </div>
                </div>
              </Card>
            ))}

          {entries.filter((e) => e.status === "posted").length > 0 ? (
            <Card className="mt-3">
              <CardHeader
                title={t.kirjanpito.correction}
                subtitle={t.kirjanpito.correctionNote}
              />
              <div className="mt-3 space-y-2">
                {entries
                  .filter((e) => e.status === "posted")
                  .slice(0, 10)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <span className="rf-tabular min-w-0 flex-1 truncate text-[13px]">
                        Tosite {entry.entryNumber} · {entry.description}
                      </span>
                      <CorrectEntryForm t={t} id={entry.id} />
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TilaMerkki({ nimet, entry }: { nimet: Labels; entry: LedgerEntry }) {
  return (
    <Pill
      tone={
        entry.status === "posted"
          ? "ok"
          : entry.status === "rejected"
            ? "risk"
            : "warn"
      }
      dot
    >
      {nimet.ledgerStatus[entry.status]}
    </Pill>
  );
}

// ---------------------------------------------------------------------------
// Pääkirja
// ---------------------------------------------------------------------------

/**
 * Tapahtumat tileittäin.
 *
 * Jokainen rivi vie alkuperäiseen lähteeseen: kuittiin tai
 * myyntipäivään. Ilman sitä pääkirjan luku on vain luku, eikä
 * kysymykseen "mistä tämä tulee" voi vastata.
 */
export function Paakirja({
  nimet,
  accounts,
  t,
}: {
  nimet: Labels;
  accounts: GeneralLedgerAccount[];
  t: AdminText;
}) {
  const kaytossa = accounts.filter((a) => a.lineCount > 0);

  if (kaytossa.length === 0) {
    return (
      <EmptyState
        title={t.kirjanpito.noEntries}
        description={t.kirjanpito2.ledgerFills}
      />
    );
  }

  return (
    <div className="space-y-3">
      {kaytossa.map((account) => (
        <Card key={account.id} padded={false}>
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-[-0.0075em]">
                <span className="rf-tabular">{account.number}</span>{" "}
                {account.name}
              </p>
              <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                {nimet.accountType[account.type]} · {account.lineCount}{" "}
                {account.lineCount === 1 ? "vienti" : t.kirjanpito2.entry}
              </p>
            </div>
            <p className="rf-tabular text-[15px] font-bold">
              {formatMoney(Math.abs(account.balanceCents))}
            </p>
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {account.lines.map((line, i) => (
              <li key={`${line.entryId}-${i}`}>
                <LahdeLinkki line={line}>
                  <span className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      <span
                        className="rf-tabular"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {suomiPvm(line.date)}
                      </span>{" "}
                      {line.description}
                    </span>
                    <span className="rf-tabular shrink-0 font-semibold">
                      {line.debitCents > 0
                        ? formatMoney(line.debitCents)
                        : `− ${formatMoney(line.creditCents)}`}
                    </span>
                  </span>
                </LahdeLinkki>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/**
 * Vienti alkuperäiseen lähteeseen.
 *
 * Käsin tehdyllä tositteella ei ole lähdettä, joten se ei ole linkki.
 * Linkki joka ei vie mihinkään on pahempi kuin tavallinen rivi.
 */
function LahdeLinkki({
  line,
  children,
}: {
  line: GeneralLedgerAccount["lines"][number];
  children: React.ReactNode;
}) {
  const href =
    line.sourceType === "receipt" && line.sourceId
      ? `/admin/kuitit/${line.sourceId}`
      : line.sourceType === "daily_sales" && line.sourceId
        ? `/admin/myynti/${line.date}`
        : null;

  if (!href) return <span className="block">{children}</span>;

  return (
    <Link href={href} className="rf-press block">
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tilikartta
// ---------------------------------------------------------------------------

export function Tilikartta({
  nimet,
  accounts,
  t,
}: {
  nimet: Labels;
  accounts: LedgerAccount[];
  t: AdminText;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t.kirjanpito.noChart}
        description={t.kirjanpito2.chartAppears}
      />
    );
  }

  const ryhmat = (
    ["revenue", "expense", "asset", "liability", "equity"] as const
  )
    .map((type) => ({ type, rows: accounts.filter((a) => a.type === type) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-3">
      {ryhmat.map((ryhma) => (
        <Card key={ryhma.type} padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title={nimet.accountType[ryhma.type]}
              subtitle={fill(t.kirjanpito.accountCount, {
                maara: String(ryhma.rows.length),
              })}
            />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {ryhma.rows.map((account) => (
              <li
                key={account.id}
                className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-[13.5px]"
              >
                <span className="min-w-0">
                  <span
                    className="rf-tabular"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {account.number}
                  </span>{" "}
                  {account.name}
                </span>
                <span className="shrink-0">
                  {!account.active ? (
                    <Pill tone="info">{t.kirjanpito.unused}</Pill>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.kirjanpito.chartNote}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ALV
// ---------------------------------------------------------------------------

/**
 * ALV ja täsmäytys.
 *
 * NELJÄ LÄHDETTÄ, EI YKSI.
 *
 * Kassan ALV-erittely, myyntipäivien summat, kuittien verot ja
 * kirjanpito lasketaan erikseen ja näytetään vierekkäin. Jos ne
 * täsmäävät, sen näkee yhdellä silmäyksellä; jos eivät, erotus on
 * luettavissa eikä piilotettu.
 */
export function Alv({
  locale,
  vat,
  t,
}: {
  locale: AppLocale;
  vat: VatSummary;
  t: AdminText;
}) {
  const myyntiEro = vat.salesVatSource - vat.salesVatLedger;
  const ostoEro = vat.purchaseVatSource - vat.purchaseVatLedger;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t.kirjanpito.periodSummary}
          subtitle={monthLabel(vat.month, locale)}
        />

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Luku
            label={t.kirjanpito.salesVat}
            value={formatMoney(vat.salesVatLedger)}
          />
          <Luku
            label={t.kirjanpito.deductibleVat}
            value={formatMoney(vat.purchaseVatLedger)}
          />
          <Luku
            label={t.kirjanpito.payable}
            value={formatMoney(vat.payableCents)}
            korosta
          />
        </dl>
      </Card>

      {vat.byRate.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title={t.kirjanpito.salesByRate}
              subtitle={t.kirjanpito.tillVatBreakdown}
            />
          </div>

          <div
            className="overflow-x-auto"
            style={{
              borderBottomLeftRadius: "var(--rf-r-card)",
              borderBottomRightRadius: "var(--rf-r-card)",
            }}
          >
            <table className="rf-table w-full text-[14px]">
              <caption className="sr-only">{t.kirjanpito.salesByRate}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.kirjanpito.taxRate}</th>
                  <th scope="col" className="text-right">
                    {t.kirjanpito.taxable}
                  </th>
                  <th scope="col" className="text-right">
                    {t.kirjanpito.tax}
                  </th>
                  <th scope="col" className="text-right">
                    {t.kirjanpito.exclTax}
                  </th>
                </tr>
              </thead>
              <tbody>
                {vat.byRate.map((row) => (
                  <tr key={row.rate}>
                    <td className="rf-tabular">{formatRate(row.rate)}</td>
                    <td className="num">{formatMoney(row.grossCents)}</td>
                    <td className="num">{formatMoney(row.vatCents)}</td>
                    <td className="num">{formatMoney(row.netCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t.kuitit.total}</td>
                  <td className="num">
                    {formatMoney(
                      vat.byRate.reduce((s, r) => s + r.grossCents, 0),
                    )}
                  </td>
                  <td className="num">
                    {formatMoney(
                      vat.byRate.reduce((s, r) => s + r.vatCents, 0),
                    )}
                  </td>
                  <td className="num">
                    {formatMoney(
                      vat.byRate.reduce((s, r) => s + r.netCents, 0),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={t.kirjanpito.reconciliation}
          subtitle={t.kirjanpito.sideBySide}
        />

        <div className="mt-4 space-y-3">
          <Tasmays
            t={t}
            label={t.kirjanpito.salesVat}
            lahde={vat.salesVatSource}
            kirjanpito={vat.salesVatLedger}
            ero={myyntiEro}
          />
          <Tasmays
            t={t}
            label={t.kirjanpito.deductibleVat}
            lahde={vat.purchaseVatSource}
            kirjanpito={vat.purchaseVatLedger}
            ero={ostoEro}
          />
          <Tasmays
            t={t}
            label={t.kirjanpito.salesTotal}
            lahde={vat.salesGrossSource}
            kirjanpito={vat.salesGrossLedger}
            ero={vat.salesGrossSource - vat.salesGrossLedger}
          />
        </div>
      </Card>
    </div>
  );
}

function Tasmays({
  label,
  lahde,
  kirjanpito,
  ero,
  t,
}: {
  label: string;
  lahde: number;
  kirjanpito: number;
  ero: number;
  t: AdminText;
}) {
  const ok = ero === 0;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
      style={{
        background: ok ? "var(--rf-inset)" : "var(--rf-amber-bg)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span className="flex items-center gap-2 text-[13.5px] font-medium">
        <span
          style={{
            color: ok ? "var(--rf-green-text)" : "var(--rf-amber-text)",
          }}
        >
          <RfIcon name={ok ? "check" : "alert"} size={15} />
        </span>
        {label}
      </span>

      <span className="rf-tabular flex flex-wrap items-baseline gap-4 text-[13px]">
        <span style={{ color: "var(--rf-text-2)" }}>
          Lähde {formatMoney(lahde)}
        </span>
        <span style={{ color: "var(--rf-text-2)" }}>
          Kirjanpito {formatMoney(kirjanpito)}
        </span>
        <span
          className="font-bold"
          style={{ color: ok ? "var(--rf-text-3)" : "var(--rf-amber-text)" }}
        >
          {ok
            ? t.kirjanpito2.matches
            : fill(t.kirjanpito.difference, {
                summa: formatMoney(Math.abs(ero)),
              })}
        </span>
      </span>
    </div>
  );
}

function Luku({
  label,
  value,
  korosta,
}: {
  label: string;
  value: string;
  korosta?: boolean;
}) {
  return (
    <div>
      <dt
        className="text-[12px] font-medium"
        style={{ color: "var(--rf-text-2)" }}
      >
        {label}
      </dt>
      <dd
        className="rf-tabular mt-[3px] text-[22px] font-bold leading-[1.4] tracking-[-0.03em]"
        style={korosta ? { color: "var(--rf-accent)" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raportit
// ---------------------------------------------------------------------------

export function Raportit({
  locale,
  t,
  income,
  balance,
  month,
}: {
  locale: AppLocale;
  t: AdminText;
  income: IncomeStatement | null;
  balance: BalanceSheet | null;
  month: string;
}) {
  return (
    <div className="space-y-4">
      {/*
        Lataukset ylimpänä.

        Raportti katsotaan ruudulta kerran ja ladataan kirjanpitäjälle
        joka kuukausi. Jälkimmäinen on se toistuva työ, joten se ei saa
        olla sivun alalaidassa.

        Tiedostot sisältävät vain kirjatut tositteet, ruutu myös
        esitykset — siksi ero on sanottu ääneen eikä jätetty
        pääteltäväksi.
      */}
      <Card>
        <CardHeader
          title={t.kirjanpito.download}
          subtitle={t.kirjanpito.downloadNote}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { kind: "paivakirja", label: t.kirjanpito.journal },
            { kind: "paakirja", label: t.kirjanpito2.generalLedger },
            { kind: "tuloslaskelma", label: t.kirjanpito.incomeStatement },
            { kind: "tase", label: t.kirjanpito.balanceSheet },
          ].map((r) => (
            <div key={r.kind} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                {r.label}
              </span>
              <Lataus
                href={`/admin/raportit/csv?tyyppi=${r.kind}&kuukausi=${month}`}
                label="CSV"
              />
              <Lataus
                href={`/admin/raportit/xlsx?tyyppi=${r.kind}&kuukausi=${month}`}
                label="Excel"
              />
            </div>
          ))}
        </div>
      </Card>

      {income ? (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title={t.kirjanpito.incomeStatement}
              subtitle={`${monthLabel(month, locale)}${
                income.includesProposed
                  ? t.kirjanpito.withProposed
                  : t.kirjanpito.onlyBooked
              }`}
            />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {income.revenue.map((row) => (
              <Rivi
                key={row.number}
                number={row.number}
                name={row.name}
                cents={row.amountCents}
              />
            ))}
            <Summa
              label={t.kirjanpito.revenueTotal}
              cents={income.revenueTotalCents}
            />

            {income.expenses.map((row) => (
              <Rivi
                key={row.number}
                number={row.number}
                name={row.name}
                cents={row.amountCents}
              />
            ))}
            <Summa
              label={t.kirjanpito.expensesTotal}
              cents={income.expenseTotalCents}
            />
            <Summa
              label={t.kirjanpito.result}
              cents={income.resultCents}
              korosta
            />
          </ul>
        </Card>
      ) : null}

      {balance ? (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title={t.kirjanpito.balanceSheet}
              subtitle={fill(t.kirjanpito.asOf, {
                paiva: suomiPvm(balance.asOf),
              })}
            />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {balance.assets.map((row) => (
              <Rivi
                key={row.number}
                number={row.number}
                name={row.name}
                cents={row.amountCents}
              />
            ))}
            <Summa
              label={t.kirjanpito.assetsTotal}
              cents={balance.assetsTotalCents}
            />

            {balance.liabilities.map((row) => (
              <Rivi
                key={row.number}
                number={row.number}
                name={row.name}
                cents={row.amountCents}
              />
            ))}
            <Rivi
              number=""
              name={t.kirja.periodResult}
              cents={balance.resultCents}
            />
            <Summa
              label={t.kirjanpito.liabilitiesTotal}
              cents={balance.balancesTotalCents}
            />
          </ul>

          <div className="px-5 pb-4 pt-3">
            <Pill tone={balance.balanced ? "ok" : "risk"} dot>
              {balance.balanced
                ? t.kirjanpito2.balanceOk
                : t.kirjanpito2.balanceOff}
            </Pill>
          </div>
        </Card>
      ) : null}

      {!income && !balance ? (
        <EmptyState
          title={t.kirjanpito.nothingToReport}
          description={t.kirjanpito2.reportsAppear}
        />
      ) : null}
    </div>
  );
}

function Rivi({
  number,
  name,
  cents,
}: {
  number: string;
  name: string;
  cents: number;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-[13.5px]">
      <span className="min-w-0">
        {number ? (
          <span className="rf-tabular" style={{ color: "var(--rf-text-3)" }}>
            {number}
          </span>
        ) : null}{" "}
        {name}
      </span>
      <span className="rf-tabular shrink-0">{formatMoney(cents)}</span>
    </li>
  );
}

function Summa({
  label,
  cents,
  korosta,
}: {
  label: string;
  cents: number;
  korosta?: boolean;
}) {
  return (
    <li
      className="flex items-baseline justify-between gap-3 px-5 py-3 text-[14px] font-bold"
      style={{ background: "var(--rf-inset)" }}
    >
      <span>{label}</span>
      <span
        className="rf-tabular"
        style={korosta ? { color: "var(--rf-accent)" } : undefined}
      >
        {formatMoney(cents)}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------

/** "2026-08-26" → "26.08.2026". */
function suomiPvm(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Latauspainike.
 *
 * Sama mitta ja paino kuin Raportointi-sivulla: kaksi samanarvoista
 * tiedostomuotoa näyttävät samalta, koska ne tekevät saman asian.
 */
function Lataus({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rf-press inline-flex shrink-0 items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
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

// ---------------------------------------------------------------------------
// Veroasiat
// ---------------------------------------------------------------------------

/**
 * Veroasiat ja OmaVero.
 *
 * KATE EI LÄHETÄ MITÄÄN.
 *
 * Tämä on tärkein asia koko välilehdellä ja siksi se lukee ylimpänä.
 * Kate laskee luvut kirjanpidosta ja kertoo mitä niillä tehdään,
 * mutta ilmoituksen tekee ihminen OmaVerossa. Vihje siitä että
 * ohjelma olisi hoitanut asian olisi väärä ja vaarallinen.
 *
 * Ohjeet tulevat taulusta eivätkä tästä tiedostosta: viranomaisohje
 * muuttuu, eikä sen muuttaminen saa vaatia julkaisua.
 */
export function Veroasiat({
  locale,
  t,
  guides,
  vat,
  month,
}: {
  locale: AppLocale;
  t: AdminText;
  guides: TaxGuide[];
  vat: VatSummary;
  month: string;
}) {
  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
        style={{
          background: "var(--rf-amber-bg)",
          color: "var(--rf-amber-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          <RfIcon name="alert" size={16} />
        </span>
        <p>{t.kirjanpito.noFilingNote}</p>
      </div>

      <Card>
        <CardHeader
          title={t.kirjanpito.whatComputed}
          subtitle={fill(t.kirjanpito.figuresFromBooks, {
            kuukausi: monthLabel(month, locale),
          })}
        />

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Luku
            label={t.kirjanpito.salesVat}
            value={formatMoney(vat.salesVatLedger)}
          />
          <Luku
            label={t.kirjanpito.deductibleVat}
            value={formatMoney(vat.purchaseVatLedger)}
          />
          <Luku
            label={t.kirjanpito.payable}
            value={formatMoney(vat.payableCents)}
            korosta
          />
        </dl>

        <p
          className="mt-4 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.kirjanpito.figuresNote}
        </p>
      </Card>

      {guides.length === 0 ? (
        <EmptyState
          title={t.kirjanpito.noGuides}
          description={t.kirjanpito2.guidesNote}
        />
      ) : (
        guides.map((guide) => (
          <Card key={guide.key} padded={false}>
            <div className="px-5 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="info">{guide.taxType}</Pill>
              </div>
              <div className="mt-2">
                <CardHeader title={guide.title} subtitle={guide.summary} />
              </div>
            </div>

            <ol
              className="space-y-0 divide-y"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {guide.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-5 py-2.5 text-[13.5px]"
                >
                  <span
                    aria-hidden="true"
                    className="rf-tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold"
                    style={{
                      background: "var(--rf-inset)",
                      color: "var(--rf-text-2)",
                      borderRadius: "50%",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            {guide.source ? (
              <p
                className="px-5 pb-4 pt-3 text-[12px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                Lähde: {guide.source}
                {guide.sourceUrl ? (
                  <>
                    {" · "}
                    <a
                      href={guide.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--rf-accent)" }}
                    >
                      {guide.sourceUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
