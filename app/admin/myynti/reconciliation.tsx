import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import type { Reconciliation } from "@/lib/restoflow/sales-vat";

/**
 * Kassan ja Budetin vertailu.
 *
 * KOLME TILAA, EI KAHTA.
 *
 * Täsmää, ei täsmää, ja ei voitu verrata. Kolmas on tärkein: jos
 * kassan lukuja ei ole, "täsmää" tarkoittaisi vain ettei mitään ole
 * verrattu — ja se on pahempi kuin epätietoisuus, koska se näyttää
 * vahvistukselta.
 *
 * EI PELKKÄÄ PUNAISTA LUKUA.
 *
 * Erotus kertoo että jokin on pielessä muttei mistä aloittaa. Selitys
 * tulee laskennasta ja kertoo mitä katsoa: onko ryhmä väärässä
 * kannassa, puuttuuko ryhmä, vai onko luku luettu väärin.
 */
export function ReconciliationPanel({ result }: { result: Reconciliation }) {
  if (result.status === "unknown") {
    return (
      <div
        className="flex items-start gap-2.5 px-3.5 py-3"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        <span className="mt-px shrink-0" style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name="info" size={15} />
        </span>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Kassan lukuja ei ole, joten päivää ei ole täsmäytetty. Kuvaa
          päiväraportti, niin Budet vertaa oman laskelmansa siihen.
        </p>
      </div>
    );
  }

  const ok = result.status === "match";

  /*
   * Otsikko kertoo mikä ei täsmää.
   *
   * "Myynti ei täsmää" loppusumman ollessa oikein on väärä väite, ja
   * väärä väite otsikossa saa epäilemään koko täsmäytystä. Kolme
   * tapausta, kolme otsikkoa.
   */
  const salesOff = result.total.status === "mismatch";
  const vatOff =
    result.vat.status === "mismatch" ||
    result.byRate.some((r) => r.status === "mismatch");

  const heading = ok
    ? "Täsmää kassan päiväraporttiin"
    : salesOff && vatOff
      ? "Myynti ja ALV eivät täsmää kassaan"
      : salesOff
        ? "Myynti ei täsmää kassaan"
        : "ALV ei täsmää kassaan";

  return (
    <div>
      <div
        className="flex items-start gap-2.5 px-3.5 py-3"
        style={{
          background: ok ? "var(--rf-green-bg)" : "var(--rf-red-bg)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span
          className="mt-px shrink-0"
          style={{ color: ok ? "var(--rf-green-text)" : "var(--rf-red-text)" }}
        >
          <RfIcon name={ok ? "check" : "alert"} size={16} />
        </span>

        <div className="min-w-0">
          <p
            className="text-[13px] font-bold"
            style={{ color: ok ? "var(--rf-green-text)" : "var(--rf-red-text)" }}
          >
            {heading}
          </p>

          {result.explanation ? (
            <p
              className="mt-1 text-[12.5px] leading-relaxed"
              style={{ color: "var(--rf-red-text)" }}
            >
              {result.explanation}
            </p>
          ) : null}
        </div>
      </div>

      {/*
        Rivit kertovat mitä verrattiin.

        Pelkkä "täsmää" pyytää uskomaan. Luvut vierekkäin antavat
        lukijan tarkistaa itse, ja juuri se on täsmäytyksen tarkoitus.
      */}
      <table className="rf-table mt-3 w-full">
        <caption className="sr-only">Kassan ja Budetin vertailu</caption>
        <thead>
          <tr>
            <th scope="col">Kohde</th>
            <th scope="col" className="text-right">Kassa</th>
            <th scope="col" className="text-right">Budet</th>
            <th scope="col" className="text-right">Ero</th>
          </tr>
        </thead>
        <tbody>
          <Row comparison={result.total} strong />
          <Row comparison={result.vat} strong />
          {result.byRate.map((rate) => (
            <Row key={rate.label} comparison={rate} indent />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  comparison,
  strong,
  indent,
}: {
  comparison: Reconciliation["total"];
  strong?: boolean;
  indent?: boolean;
}) {
  const { label, posCents, budetCents, diffCents, status } = comparison;

  return (
    <tr className="rf-row">
      <td style={{ paddingLeft: indent ? 32 : undefined }}>
        <span className={strong ? "font-semibold" : ""}>
          {indent ? `ALV ${label}` : label}
        </span>
      </td>

      <td className="rf-tabular text-right" style={{ color: "var(--rf-text-2)" }}>
        {posCents === null ? "—" : formatMoney(posCents)}
      </td>

      <td className="rf-tabular text-right font-semibold">{formatMoney(budetCents)}</td>

      <td
        className="rf-tabular text-right"
        style={{
          color:
            status === "mismatch"
              ? "var(--rf-red-text)"
              : status === "match"
                ? "var(--rf-green-text)"
                : "var(--rf-text-3)",
          fontWeight: status === "mismatch" ? 700 : 400,
        }}
      >
        {status === "unknown"
          ? "—"
          : status === "match"
            ? "✓"
            : `${diffCents! > 0 ? "+" : "−"}${formatMoney(Math.abs(diffCents!))}`}
      </td>
    </tr>
  );
}
