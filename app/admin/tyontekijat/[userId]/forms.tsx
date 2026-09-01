"use client";

/**
 * Verokortin, luontoisetujen ja työsuhdetietojen lomakkeet.
 *
 * Kaikki kolme ovat avattavia osioita. Työntekijän lisääminen on
 * useimmiten kutsu ja tuntipalkka, ja verokortti tulee myöhemmin
 * omana hetkenään — auki oleva lomake kaikelle tekisi tavallisesta
 * tapauksesta raskaan.
 *
 * ---------------------------------------------------------------------
 * LASKENTAA EI TEHDÄ TÄÄLLÄ
 * ---------------------------------------------------------------------
 *
 * Tässä tiedostossa ei ole yhtään veroprosenttia eikä yhtään kaavaa.
 * Lomake ottaa vastaan sen mitä verokortissa lukee ja lähettää sen
 * palvelimelle. Selaimessa laskettu ennakonpidätys olisi luku jonka
 * kuka tahansa voi muuttaa kehittäjätyökaluilla.
 */

import { useActionState, useRef, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { Button } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import type { BenefitDefault } from "@/lib/restoflow/payroll-tax-queries";
import type {
  TaxCardRow,
  BenefitRow,
} from "@/lib/restoflow/payroll-tax-queries";
import { createClient } from "@/utils/supabase/client";
import type { TaxCardProposal } from "@/lib/restoflow/tax-card-ai";
import {
  attachTaxCardDocument,
  deleteBenefit,
  deleteTaxCard,
  saveBenefit,
  saveEmployment,
  saveTaxCard,
  type TaxState,
} from "../tax-actions";

const TYHJA: TaxState = {};

// ---------------------------------------------------------------------------
// Yhteiset palaset
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
      {hint ? (
        <span
          className="mt-0.5 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const KENTTA = "mt-1 h-[38px] w-full px-2.5 text-[14px] outline-none";

const KENTTA_TYYLI = {
  background: "var(--rf-inset)",
  border: "1px solid var(--rf-line)",
  borderRadius: "var(--rf-r-field)",
  color: "var(--rf-text)",
} as const;

function Notice({ state }: { state: TaxState }) {
  if (!state.error && !state.notice) return null;

  const virhe = Boolean(state.error);

  return (
    <p
      className="px-3 py-2 text-[13px] font-medium"
      role={virhe ? "alert" : "status"}
      style={{
        background: virhe ? "var(--rf-red-bg)" : "var(--rf-green-bg)",
        color: virhe ? "var(--rf-red-text)" : "var(--rf-green-text)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      {state.error ?? state.notice}
    </p>
  );
}

/**
 * Avattava osio.
 *
 * Auki jos siellä ei ole vielä mitään: tyhjä osio on juuri se jonka
 * takia sivulle tultiin. Täytetty osio on tila jonka näkee ilman että
 * sitä muokkaa.
 */
function Collapsible({
  label,
  openByDefault,
  children,
}: {
  label: string;
  openByDefault: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(openByDefault);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rf-press flex w-full items-center gap-2 py-2 text-left text-[13.5px] font-semibold"
        style={{ color: "var(--rf-accent)" }}
      >
        <RfIcon name={open ? "close" : "plus"} size={15} />
        {label}
      </button>

      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verokortti
// ---------------------------------------------------------------------------

/**
 * Verokortin lukeminen kuvasta.
 *
 * Kaksi asiaa tapahtuu kun tiedosto valitaan: se tallentuu
 * tiedostokaappiin (Työntekijät → nimi → Verokortit) ja se luetaan.
 * Rinnakkain, koska kumpikaan ei tarvitse toisen tulosta ja
 * peräkkäin ne olisivat kahden odotuksen mittainen tauko.
 *
 * Luettuja arvoja ei kirjoiteta kenttiin suoraan. Ne näytetään
 * listana jonka käyttäjä hyväksyy — veroprosentti vaikuttaa jokaiseen
 * palkkaan loppuvuoden, eikä kukaan huomaisi kahdeksikon ja kuutosen
 * eroa laskelmalta jonka oletetaan olevan oikein.
 */
function useTaxCardReader(employeeName: string) {
  const [reading, setReading] = useState(false);
  const [proposal, setProposal] = useState<TaxCardProposal | null>(null);
  const [rejected, setRejected] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState(false);

  async function read(file: File): Promise<void> {
    setReading(true);
    setProposal(null);
    setRejected(false);
    setFileError(null);
    setSavedTo(false);

    const supabase = createClient();

    /*
     * Polku alkaa ravintolan tunnisteella, koska storage-käytäntö
     * lukee pääsyn juuri siitä. Sama muoto kuin tiedostokaapissa:
     * kaksi eri polkumuotoa olisi kaksi eri käytäntöä muistettavana.
     */
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const type = file.type || "application/octet-stream";

    const lataus = (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: jasenyys } = await supabase
        .from("memberships")
        .select("restaurant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const restaurantId = (jasenyys as { restaurant_id: string } | null)
        ?.restaurant_id;
      if (!restaurantId) return;

      const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;

      const { error } = await supabase.storage
        .from("files")
        .upload(path, file, { contentType: type, upsert: false });

      if (error) {
        setFileError(null);
        return;
      }

      const tulos = await attachTaxCardDocument({
        employeeName,
        name: file.name,
        path,
        type,
        size: file.size,
      });

      if (tulos.fileId) {
        setFileId(tulos.fileId);
        setSavedTo(true);
      } else {
        setFileError(tulos.error ?? null);
      }
    })();

    const luku = (async () => {
      const form = new FormData();
      form.set("file", file);

      const response = await fetch("/api/verokortti/tunnista", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        setRejected(true);
        return;
      }

      const data = (await response.json()) as {
        proposal: TaxCardProposal | null;
      };

      if (data.proposal) setProposal(data.proposal);
      else setRejected(true);
    })();

    await Promise.all([lataus, luku]);
    setReading(false);
  }

  return {
    reading,
    proposal,
    rejected,
    fileId,
    fileError,
    savedTo,
    read,
    dismiss: () => {
      setProposal(null);
      setRejected(false);
    },
  };
}

export function TaxCardForm({
  t,
  userId,
  employeeName,
  card,
  hasCards,
  canRead,
}: {
  t: AdminText;
  userId: string;
  /** Kansion nimeksi tiedostokaapissa. */
  employeeName: string;
  /** Muokattava kortti, tai null kun lisätään uusi. */
  card: TaxCardRow | null;
  hasCards: boolean;
  /** Onko kuvantunnistus käytössä tässä asennuksessa. */
  canRead: boolean;
}) {
  const [state, action, pending] = useActionState(saveTaxCard, TYHJA);
  const lomake = useRef<HTMLFormElement>(null);
  const lukija = useTaxCardReader(employeeName);

  const otsikko = card ? t.verotus.taxCard : t.verotus.addTaxCard;

  /**
   * Luetut arvot kenttiin.
   *
   * Kentät ovat ohjaamattomia, joten arvot kirjoitetaan suoraan
   * DOM:iin. Ohjatut kentät vaatisivat tilan jokaiselle kentälle
   * vain tätä yhtä hetkeä varten.
   *
   * Tyhjäksi jäänyttä lukua ei kirjoiteta: se pyyhkisi käyttäjän
   * jo kirjoittaman arvon nollalla.
   */
  function accept(proposal: TaxCardProposal): void {
    const f = lomake.current;
    if (!f) return;

    const set = (nimi: string, arvo: string | null) => {
      if (arvo === null) return;
      const kentta = f.elements.namedItem(nimi);
      if (kentta instanceof HTMLInputElement) kentta.value = arvo;
    };

    set(
      "basePercent",
      proposal.basePercent === null ? null : String(proposal.basePercent),
    );
    set(
      "additionalPercent",
      proposal.additionalPercent === null
        ? null
        : String(proposal.additionalPercent),
    );
    set(
      "incomeLimit",
      proposal.incomeLimitCents === null
        ? null
        : String(proposal.incomeLimitCents / 100),
    );
    set("validFrom", proposal.validFrom);
    set("validTo", proposal.validTo);

    lukija.dismiss();
  }

  return (
    <Collapsible label={otsikko} openByDefault={!hasCards && !card}>
      <form ref={lomake} action={action} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        {card ? <input type="hidden" name="id" value={card.id} /> : null}

        {/*
          Luettu dokumentti liitetään korttiin.

          Ilman liitosta kaapissa olisi verokortin kuva ja kannassa
          neljä lukua, eikä mikään kertoisi että ne ovat samasta
          paperista.
        */}
        {lukija.fileId ? (
          <input type="hidden" name="fileId" value={lukija.fileId} />
        ) : null}

        {canRead && !card ? (
          <TaxCardReader t={t} lukija={lukija} onAccept={accept} />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`${t.verotus.basePercent} %`}>
            <input
              name="basePercent"
              inputMode="decimal"
              required
              defaultValue={card ? String(card.basePercent) : ""}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field label={`${t.verotus.additionalPercent} %`}>
            <input
              name="additionalPercent"
              inputMode="decimal"
              required
              defaultValue={card ? String(card.additionalPercent) : ""}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field label={`${t.verotus.incomeLimit} €`}>
            <input
              name="incomeLimit"
              inputMode="decimal"
              required
              defaultValue={card ? String(card.incomeLimitCents / 100) : ""}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field
            label={`${t.verotus.priorIncome} €`}
            hint={t.verotus.priorIncomeHelp}
          >
            <input
              name="priorIncome"
              inputMode="decimal"
              defaultValue={card ? String(card.priorIncomeCents / 100) : "0"}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field label={t.verotus.validFrom}>
            <input
              type="date"
              name="validFrom"
              required
              defaultValue={card?.validFrom ?? ""}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field label={t.verotus.validTo}>
            <input
              type="date"
              name="validTo"
              defaultValue={card?.validTo ?? ""}
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>
        </div>

        <Notice state={state} />

        <Button tone="primary" size="sm" type="submit" disabled={pending}>
          {t.verotus.save}
        </Button>
      </form>
    </Collapsible>
  );
}

/** Poisto omana lomakkeenaan: eri toiminto, eri painike. */
export function DeleteTaxCard({ t, id }: { t: AdminText; id: string }) {
  const [state, action, pending] = useActionState(deleteTaxCard, TYHJA);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button tone="ghost" size="sm" type="submit" disabled={pending}>
        {t.verotus.remove}
      </Button>
      {state.error ? (
        <span className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Luontoisetu
// ---------------------------------------------------------------------------

export function BenefitForm({
  t,
  userId,
  defaults,
  hasBenefits,
}: {
  t: AdminText;
  userId: string;
  /** Verohallinnon taulukkoarvot vuodelta. Ehdotus, ei laskennan lähde. */
  defaults: BenefitDefault[];
  hasBenefits: boolean;
}) {
  const [state, action, pending] = useActionState(saveBenefit, TYHJA);
  const [kind, setKind] = useState<BenefitDefault["kind"]>("meal");

  const nimet: Record<BenefitDefault["kind"], string> = {
    meal: t.verotus.benefitMeal,
    phone: t.verotus.benefitPhone,
    car: t.verotus.benefitCar,
    housing: t.verotus.benefitHousing,
    bicycle: t.verotus.benefitBicycle,
    other: t.verotus.benefitOther,
  };

  const valittu = defaults.find((row) => row.kind === kind);

  return (
    <Collapsible label={t.verotus.addBenefit} openByDefault={!hasBenefits}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.verotus.benefits}>
            <select
              name="kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as BenefitDefault["kind"])
              }
              className={KENTTA}
              style={KENTTA_TYYLI}
            >
              {(Object.keys(nimet) as BenefitDefault["kind"][]).map((laji) => (
                <option key={laji} value={laji}>
                  {nimet[laji]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={`${t.verotus.monthlyValue} €`}
            hint={
              valittu?.requiresManualValue
                ? t.verotus.manualValueNeeded
                : valittu?.note
            }
          >
            {/*
              Taulukkoarvo oletuksena, ei lukittuna.

              Ravintoedun arvo riippuu siitä paljonko ateria maksaa
              työnantajalle, eikä Kate tiedä sitä. Verohallinnon luku on
              oikea useimmiten ja siksi kentässä valmiina — mutta se on
              kenttä eikä vakio.

              key pakottaa kentän lukemaan uuden oletuksen kun laji
              vaihtuu: defaultValue luetaan vain kerran.
            */}
            <input
              key={kind}
              name="monthlyValue"
              inputMode="decimal"
              required
              defaultValue={
                valittu && !valittu.requiresManualValue
                  ? String(valittu.valueCents / 100)
                  : ""
              }
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          {kind === "other" ? (
            <Field label={t.verotus.benefitOther}>
              <input
                name="label"
                maxLength={60}
                className={KENTTA}
                style={KENTTA_TYYLI}
              />
            </Field>
          ) : null}

          <Field label={t.verotus.validFrom}>
            <input
              type="date"
              name="validFrom"
              required
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>

          <Field label={t.verotus.validTo}>
            <input
              type="date"
              name="validTo"
              className={KENTTA}
              style={KENTTA_TYYLI}
            />
          </Field>
        </div>

        <Notice state={state} />

        <Button tone="primary" size="sm" type="submit" disabled={pending}>
          {t.verotus.save}
        </Button>
      </form>
    </Collapsible>
  );
}

export function DeleteBenefit({ t, id }: { t: AdminText; id: string }) {
  const [, action, pending] = useActionState(deleteBenefit, TYHJA);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button tone="ghost" size="sm" type="submit" disabled={pending}>
        {t.verotus.remove}
      </Button>
    </form>
  );
}

/** Luontoisedun nimi käyttäjän kielellä. */
export function benefitName(
  t: AdminText,
  kind: BenefitRow["kind"],
  label: string,
): string {
  if (label) return label;

  const nimet: Record<BenefitRow["kind"], string> = {
    meal: t.verotus.benefitMeal,
    phone: t.verotus.benefitPhone,
    car: t.verotus.benefitCar,
    housing: t.verotus.benefitHousing,
    bicycle: t.verotus.benefitBicycle,
    other: t.verotus.benefitOther,
  };

  return nimet[kind];
}

// ---------------------------------------------------------------------------
// Työsuhde
// ---------------------------------------------------------------------------

export function EmploymentForm({
  t,
  userId,
  startsOn,
  endsOn,
  birthDate,
}: {
  t: AdminText;
  userId: string;
  startsOn: string | null;
  endsOn: string | null;
  birthDate: string | null;
}) {
  const [state, action, pending] = useActionState(saveEmployment, TYHJA);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.verotus.startsOn}>
          <input
            type="date"
            name="startsOn"
            defaultValue={startsOn ?? ""}
            className={KENTTA}
            style={KENTTA_TYYLI}
          />
        </Field>

        <Field label={t.verotus.endsOn}>
          <input
            type="date"
            name="endsOn"
            defaultValue={endsOn ?? ""}
            className={KENTTA}
            style={KENTTA_TYYLI}
          />
        </Field>

        <Field label={t.verotus.birthDate} hint={t.verotus.birthDateHelp}>
          <input
            type="date"
            name="birthDate"
            defaultValue={birthDate ?? ""}
            className={KENTTA}
            style={KENTTA_TYYLI}
          />
        </Field>
      </div>

      <Notice state={state} />

      <Button tone="ghost" size="sm" type="submit" disabled={pending}>
        {t.verotus.save}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tulorajan palkki
// ---------------------------------------------------------------------------

/**
 * Tuloraja näkyvänä, ei pelkkinä lukuina.
 *
 * "Käytetty 8 450 €, jäljellä 16 550 €" vaatii lukijalta
 * laskutoimituksen sen selvittämiseksi ollaanko lähellä rajaa.
 * Palkki vastaa siihen ennen kuin kysymys ehtii muodostua.
 */
export function LimitBar({
  t,
  limitCents,
  usedCents,
  remainingCents,
}: {
  t: AdminText;
  limitCents: number;
  usedCents: number;
  remainingCents: number;
}) {
  const osuus =
    limitCents === 0 ? 0 : Math.min(100, (usedCents / limitCents) * 100);

  const taynna = remainingCents === 0;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
        <span style={{ color: "var(--rf-text-2)" }}>
          {`${t.verotus.limitUsed} ${formatMoney(usedCents)} / ${formatMoney(limitCents)}`}
        </span>
        <span className="font-semibold">
          {`${t.verotus.limitLeft} ${formatMoney(remainingCents)}`}
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-pill)",
        }}
        role="img"
        aria-label={fill(t.verotus.limitUsed, {})}
      >
        <div
          className="rf-bar h-full"
          style={{
            width: `${osuus}%`,
            background: taynna ? "var(--rf-amber)" : "var(--rf-accent)",
            borderRadius: "var(--rf-r-pill)",
          }}
        />
      </div>

      {taynna ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-amber-text)" }}>
          {t.verotus.limitFull}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verokortin lukeminen
// ---------------------------------------------------------------------------

/**
 * Tiedoston valinta ja löydetyt tiedot.
 *
 * "Löydetyt tiedot" on lista eikä täytetty lomake. Ero on siinä että
 * lista pyytää katsomaan; täytetty lomake pyytää painamaan Tallenna.
 */
function TaxCardReader({
  t,
  lukija,
  onAccept,
}: {
  t: AdminText;
  lukija: ReturnType<typeof useTaxCardReader>;
  onAccept: (proposal: TaxCardProposal) => void;
}) {
  return (
    <div
      className="px-3 py-2.5"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <label className="block">
        <span className="text-[13px] font-semibold">{t.verotus.readCard}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void lukija.read(file);
          }}
          className="mt-1 block w-full text-[13px]"
        />
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.verotus.readCardHelp}
        </span>
      </label>

      {lukija.reading ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.verotus.reading}
        </p>
      ) : null}

      {lukija.savedTo ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {t.verotus.documentSaved.replace("{nimi}", "")}
        </p>
      ) : null}

      {lukija.fileError ? (
        <p
          className="mt-2 text-[12.5px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {t.verotus.uploadFailed}
        </p>
      ) : null}

      {lukija.rejected ? (
        <p
          className="mt-2 text-[13px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {t.verotus.notRecognised}
        </p>
      ) : null}

      {lukija.proposal ? (
        <div className="mt-3">
          <p className="text-[13px] font-semibold">{t.verotus.foundFields}</p>

          <dl className="mt-1.5 space-y-1 text-[13px]">
            <Found
              label={t.verotus.basePercent}
              value={
                lukija.proposal.basePercent === null
                  ? null
                  : `${lukija.proposal.basePercent} %`
              }
            />
            <Found
              label={t.verotus.additionalPercent}
              value={
                lukija.proposal.additionalPercent === null
                  ? null
                  : `${lukija.proposal.additionalPercent} %`
              }
            />
            <Found
              label={t.verotus.incomeLimit}
              value={
                lukija.proposal.incomeLimitCents === null
                  ? null
                  : formatMoney(lukija.proposal.incomeLimitCents)
              }
            />
            <Found
              label={t.verotus.validFrom}
              value={lukija.proposal.validFrom}
            />
            <Found label={t.verotus.validTo} value={lukija.proposal.validTo} />
            <Found
              label={t.verotus.holder}
              value={lukija.proposal.holderName}
            />
          </dl>

          {/*
            Epävarmuus sanotaan ennen Hyväksy-painiketta.

            Painikkeen jälkeen se olisi selitys sille mitä juuri
            tapahtui; ennen sitä se on syy katsoa vielä kerran.
          */}
          {lukija.proposal.sure ? null : (
            <p
              className="mt-2 text-[12.5px]"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {t.verotus.uncertain}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <Button
              tone="primary"
              size="sm"
              type="button"
              onClick={() => {
                if (lukija.proposal) onAccept(lukija.proposal);
              }}
            >
              {t.verotus.accept}
            </Button>

            <Button
              tone="ghost"
              size="sm"
              type="button"
              onClick={lukija.dismiss}
            >
              {t.verotus.editInstead}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Yksi löydetty kenttä. Tyhjä kenttä näytetään viivana. */
function Found({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0" style={{ color: "var(--rf-text-3)" }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-medium">{value ?? "—"}</dd>
    </div>
  );
}
