"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  salesExtractor,
  SalesExtractionError,
  type SalesExtraction,
} from "@/lib/restoflow/sales-ai";
import { averageCheckCents, reconcile } from "@/lib/restoflow/sales-report";
import {
  mapReportGroups,
  reconcile as reconcileWithPos,
  type PosMapping,
  type SalesGroup,
} from "@/lib/restoflow/sales-vat";
import { formatRate } from "@/lib/money";
import { ReconciliationPanel } from "./reconciliation";
import { saveDailySales, type SalesState } from "./actions";

/**
 * Päiväraportin kuvaus.
 *
 * Kuitti kuvataan ja poimitaan; päiväraportti on sama paperi samasta
 * tulostimesta ja se on kirjattu käsin. Sama kulku molemmille:
 * kuvaa → tarkista → tallenna.
 *
 * KONE EHDOTTAA, IHMINEN VAHVISTAA.
 *
 * Poiminta ei tallenna mitään. Luvut menevät lomakkeeseen jossa ne
 * näkyvät ja jossa niitä voi muuttaa, ja epävarmaksi merkitty kenttä
 * kertoo siitä. Väärin luettu myyntiluku on pahempi kuin puuttuva:
 * puuttuvan huomaa, väärä jää kirjanpitoon.
 */

type Phase =
  | { at: "idle" }
  | { at: "reading" }
  | { at: "review"; result: SalesExtraction; fileName: string }
  | { at: "failed"; message: string; retryable: boolean };

const initial: SalesState = {};

export function ReportCapture({
  today,
  groups,
  mappings,
}: {
  today: string;
  groups: SalesGroup[];
  mappings: PosMapping[];
}) {
  const [phase, setPhase] = useState<Phase>({ at: "idle" });
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  /**
   * Lukee raportin, oli se yksi kuva tai monta.
   *
   * Z-raportti on pitkä liuska: tarkka kuva syntyy vain osissa, ja
   * loppusumma on viimeisessä. Sivut lähetetään yhtenä pyyntönä
   * järjestyksessä, koska ne ovat saman raportin osia — erillisinä
   * pyyntöinä kukin osa näyttäisi omalta vajaalta raportiltaan.
   */
  async function read(selected: FileList | File[] | null | undefined) {
    const pages = [...(selected ?? [])];
    if (pages.length === 0) return;

    const [file, ...extraPages] = pages;

    setPhase({ at: "reading" });

    const label =
      pages.length === 1
        ? file.name
        : `${file.name} + ${extraPages.length} ${extraPages.length === 1 ? "sivu" : "sivua"}`;

    try {
      const result = await salesExtractor.extract({
        fileName: file.name,
        file,
        extraPages,
      });
      setPhase({ at: "review", result, fileName: label });
    } catch (error) {
      setPhase({
        at: "failed",
        message:
          error instanceof SalesExtractionError
            ? error.message
            : "Raportin luku epäonnistui.",
        retryable: error instanceof SalesExtractionError ? error.retryable : true,
      });
    }
  }

  if (phase.at === "review") {
    return (
      <ReviewForm
        result={phase.result}
        today={today}
        groups={groups}
        mappings={mappings}
        onDiscard={() => setPhase({ at: "idle" })}
      />
    );
  }

  return (
    <div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(event) => void read(event.target.files)}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={(event) => void read(event.target.files)}
      />

      {phase.at === "reading" ? (
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <span className="rf-breathe shrink-0" style={{ color: "var(--rf-accent)" }}>
            <RfIcon name="sparkle" size={18} />
          </span>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Luetaan päiväraporttia…
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => camera.current?.click()}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="camera" size={16} />
            Kuvaa päiväraportti
          </button>

          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="file" size={16} />
            Valitse tiedostot
          </button>

          <p
            className="w-full text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            Pitkän raportin voi kuvata useampana kuvana kerralla — kuvaa ne
            järjestyksessä, niin ALV-erittely ja loppusumma tulevat mukaan.
          </p>
        </div>
      )}

      {phase.at === "failed" ? (
        <p
          role="alert"
          className="mt-3 px-3.5 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {phase.message}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Poimitut luvut tarkistettavaksi.
 *
 * Lomake eikä yhteenveto: jokainen kenttä on muokattavissa siinä
 * paikassa jossa se näkyy. Erillinen "muokkaa"-tila lisäisi askeleen
 * juuri siihen kohtaan jossa käyttäjä on jo huomannut virheen.
 */
function ReviewForm({
  result,
  today,
  groups,
  mappings,
  onDiscard,
}: {
  result: SalesExtraction;
  today: string;
  groups: SalesGroup[];
  mappings: PosMapping[];
  onDiscard: () => void;
}) {
  const [state, action] = useActionState(saveDailySales, initial);

  const amounts = reconcile({
    grossCents: result.grossCents.value,
    vatCents: result.vatCents.value,
    netCents: result.netCents.value,
  });

  const average = averageCheckCents(amounts.grossCents, result.transactions.value);

  /*
   * Ryhmät kohdistetaan heti eikä vasta tallennuksessa.
   *
   * Kohdistuksen tulos on osa sitä mitä käyttäjä tarkistaa: väärään
   * kantaan menevä ryhmä on juuri se virhe jonka täsmäytys myöhemmin
   * löytäisi, ja se on halvempi korjata nyt.
   */
  const mapped = mapReportGroups(result.groups, mappings, groups);

  /*
   * Täsmäytys lasketaan kassan omista luvuista.
   *
   * Loppusumma tulee raportista, ei riveistä. Jos se laskettaisiin
   * riveistä, vertailu vertaisi lukua itseensä ja täsmäisi aina.
   */
  const check = reconcileWithPos({
    posGrossCents: amounts.grossCents,
    posVatCents: amounts.vatCents,
    posVatRates: result.vatRates,
    lines: mapped.lines,
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="source" value="report" />

      {/*
        Rivit menevät palvelimelle ryhminä ja bruttosummina. Verokanta
        luetaan siellä ryhmän asetuksesta ja vero lasketaan siitä —
        lomakkeen sisällön voi kirjoittaa itse, eikä selaimen
        lähettämään kantaan voi luottaa.
      */}
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          mapped.lines.map((l) => ({
            salesGroupId: l.salesGroupId,
            grossCents: l.grossCents,
            posName: l.posName,
            posVatCents: l.posVatCents,
          })),
        )}
      />
      <input type="hidden" name="posGross" value={euros(amounts.grossCents)} />
      <input type="hidden" name="posVat" value={euros(amounts.vatCents)} />

      {/*
        Kassan ALV-erittely sellaisenaan.

        Tämä on päivän verotieto eikä Budetin laskelma: juuri nämä
        luvut menevät kirjanpitoon. Ne tallennetaan omaan tauluunsa,
        jotta ryhmistä johdettua veroa voi verrata niihin sen sijaan
        että se korvaisi ne.
      */}
      <input
        type="hidden"
        name="vatRates"
        value={JSON.stringify(result.vatRates)}
      />

      {result.imageQuality === "poor" ? (
        <Banner tone="warn">
          Kuva on epäselvä. Tarkista jokainen luku raportista ennen tallennusta.
        </Banner>
      ) : null}

      {amounts.mismatch ? <Banner tone="warn">{amounts.mismatch}</Banner> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Myyntipäivä"
          name="date"
          type="date"
          defaultValue={result.date.value ?? today}
          uncertain={result.date.value === null}
          hint={result.date.value === null ? "Ei löytynyt raportista" : undefined}
          required
        />

        <Field
          label="Kuitteja"
          name="transactions"
          inputMode="numeric"
          defaultValue={result.transactions.value?.toString() ?? ""}
          uncertain={result.transactions.confidence === "low"}
          hint={
            average !== null ? `Keskiostos ${formatMoney(average)}` : "Vapaaehtoinen"
          }
        />

        <Field
          label="Verollinen myynti"
          name="gross"
          inputMode="decimal"
          defaultValue={euros(amounts.grossCents)}
          uncertain={result.grossCents.confidence === "low"}
          hint={amounts.derived.includes("grossCents") ? "Laskettu: veroton + ALV" : undefined}
        />

        <Field
          label="ALV yhteensä"
          name="vat"
          inputMode="decimal"
          defaultValue={euros(amounts.vatCents)}
          uncertain={result.vatCents.confidence === "low"}
          hint={amounts.derived.includes("vatCents") ? "Laskettu: verollinen − veroton" : undefined}
        />

        <Field
          label="Veroton myynti"
          name="net"
          inputMode="decimal"
          defaultValue={euros(amounts.netCents)}
          uncertain={result.netCents.confidence === "low"}
          hint={
            amounts.derived.includes("netCents")
              ? "Laskettu: verollinen − ALV"
              : "Tästä lasketaan työvoiman osuus"
          }
          required
        />

        <Field
          label="Tavoite"
          name="target"
          inputMode="decimal"
          defaultValue=""
          hint="Vapaaehtoinen. Tyhjänä verrataan saman viikonpäivän historiaan."
        />
      </div>

      {mapped.lines.length > 0 ? (
        <div>
          <h3 className="text-[13.5px] font-bold">Myynti ryhmittäin</h3>
          <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Verokanta tulee myyntiryhmän asetuksesta. Rivi tallentaa käytetyn
            kannan, joten myöhempi asetusmuutos ei muuta tätä päivää.
          </p>

          <table className="rf-table mt-2.5 w-full">
            <caption className="sr-only">Myynti ryhmittäin</caption>
            <thead>
              <tr>
                <th scope="col">Ryhmä</th>
                <th scope="col">Kassan nimi</th>
                <th scope="col" className="text-right">ALV %</th>
                <th scope="col" className="text-right">Verollinen</th>
                <th scope="col" className="text-right">ALV</th>
                <th scope="col" className="text-right">Veroton</th>
              </tr>
            </thead>
            <tbody>
              {mapped.lines.map((l) => (
                <tr key={l.salesGroupId} className="rf-row">
                  <td className="font-semibold">{nameOf(groups, l.salesGroupId)}</td>
                  <td style={{ color: "var(--rf-text-2)" }}>{l.posName ?? "—"}</td>
                  <td className="rf-tabular text-right">{formatRate(l.vatRate)}</td>
                  <td className="rf-tabular text-right font-semibold">
                    {formatMoney(l.grossCents)}
                  </td>
                  <td className="rf-tabular text-right" style={{ color: "var(--rf-text-2)" }}>
                    {formatMoney(l.vatCents)}
                  </td>
                  <td className="rf-tabular text-right" style={{ color: "var(--rf-text-2)" }}>
                    {formatMoney(l.netCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {mapped.unmapped.length > 0 ? (
            <Banner tone="warn">
              Kohdistamaton kassaryhmä: {mapped.unmapped.join(", ")}. Myynti meni
              oletusryhmään, joten summa täsmää — mutta verokanta on arvattu.
              Lisää kohdistus asetuksista.
            </Banner>
          ) : null}

          {mapped.dropped.length > 0 ? (
            <Banner tone="warn">
              Ryhmää {mapped.dropped.join(", ")} ei voitu kirjata: kohdistusta ei
              ole eikä oletusryhmää ole määritetty. Päivän summa jää tältä osin
              vajaaksi.
            </Banner>
          ) : null}

          <div className="mt-4">
            <ReconciliationPanel result={check} />
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-[12.5px] font-semibold" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p role="status" className="text-[12.5px] font-semibold" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit />

        <button
          type="button"
          onClick={onDiscard}
          className="rf-press px-3 py-2 text-[13px] font-semibold"
          style={{ color: "var(--rf-text-2)" }}
        >
          Hylkää ja kuvaa uudelleen
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** Myyntiryhmän nimi tunnuksesta. */
function nameOf(groups: SalesGroup[], id: string): string {
  return groups.find((g) => g.id === id)?.name ?? "Tuntematon ryhmä";
}

/** Sentit lomakkeen euromuotoon. Tyhjä pysyy tyhjänä. */
function euros(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function Field({
  label,
  name,
  hint,
  uncertain,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  /** Epävarmaksi poimittu kenttä saa merkinnän, ei pelkkää väriä. */
  uncertain?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `rf-sales-${name}`;

  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-semibold">
        {label}
        {uncertain ? (
          <span
            className="px-1.5 py-px text-[10.5px] font-bold"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: 999,
            }}
          >
            Tarkista
          </span>
        ) : null}
      </label>

      <input
        id={id}
        name={name}
        autoComplete="off"
        className="rf-tabular mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{
          background: "var(--rf-inset)",
          border: `1px solid ${uncertain ? "var(--rf-amber)" : "var(--rf-line)"}`,
          borderRadius: "var(--rf-r-control)",
        }}
        {...rest}
      />

      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Banner({ tone, children }: { tone: "warn"; children: React.ReactNode }) {
  return (
    <p
      className="flex items-start gap-2.5 px-3.5 py-2.5 text-[12.5px] leading-relaxed"
      style={{
        background: tone === "warn" ? "var(--rf-amber-bg)" : "var(--rf-inset)",
        color: tone === "warn" ? "var(--rf-amber-text)" : "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span className="mt-px shrink-0">
        <RfIcon name="alert" size={15} />
      </span>
      {children}
    </p>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press inline-flex items-center justify-center gap-2 whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        minHeight: 36,
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna päivän myynti"}
    </button>
  );
}
