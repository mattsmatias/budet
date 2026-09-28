"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { Customer } from "@/lib/restoflow/customers";
import type { AdminState } from "../actions";
import { saveCustomer, searchRecipients, type HakuTulos } from "./actions";
import { CONTROL, CONTROL_STYLE, Field } from "../asetukset/form-parts";

const initial: AdminState = {};

/** Tyhjä tulos: sama muoto kuin haulta, jottei erikoistapausta tarvita. */
const TYHJA: HakuTulos = { omat: [], ytj: [], ytjVirhe: false };

/**
 * Vastaanottajan haku ja lisäys.
 *
 * KAKSI NÄKYMÄÄ, YKSI TEHTÄVÄ.
 *
 * Ensin haku: useimmiten asiakas on joko jo rekisterissä tai löytyy
 * YTJ:stä nimellä, ja silloin kenttiä ei täytetä lainkaan. Vasta kun
 * kumpikaan ei tuota osumaa, avataan lomake — ja silloinkin se on jo
 * esitäytetty sillä mitä haku ehti löytää.
 *
 * Järjestys on tämä eikä toisinpäin siksi että käsin kirjoitettu
 * osoite on se jossa virhe on. Rekisteristä poimittu on oikein
 * määritelmän mukaan.
 */
export function CustomerPicker({ t }: { t: AdminText }) {
  const [hakusana, setHakusana] = useState("");
  /*
   * Tulos kantaa hakusanan jolle se kuuluu.
   *
   * Pelkka tulos ilman sanaa tarkoitti kahta asiaa: efektin rungossa
   * piti tyhjentaa se kun kentta tyhjennettiin, ja sita ennen edellisen
   * sanan osumat nakyivat hetken uuden sanan alla. Kun sana on mukana,
   * kumpikin katoaa - naytetaan vain se tulos joka vastaa sita mita
   * kentassa nyt lukee.
   */
  const [tallennettu, setTallennettu] = useState<{
    sana: string;
    data: HakuTulos;
  }>({ sana: "", data: TYHJA });
  const [haetaan, aloitaHaku] = useTransition();
  const [lomake, setLomake] = useState<Partial<Customer> | null>(null);

  /*
   * Haku viiveellä.
   *
   * Jokaisen kirjaimen jälkeen lähtevä kutsu tarkoittaisi kymmentä
   * kutsua yhdestä hakusanasta, ja niistä yhdeksän vastaus on jo
   * vanhentunut ennen kuin se saapuu. Kolmesataa millisekuntia on
   * lyhyempi kuin tauko sanojen välissä.
   */
  useEffect(() => {
    const sana = hakusana.trim();
    if (sana.length < 2) return;

    const ajastin = setTimeout(() => {
      aloitaHaku(async () => {
        setTallennettu({ sana, data: await searchRecipients(sana) });
      });
    }, 300);

    return () => clearTimeout(ajastin);
  }, [hakusana]);

  const sana = hakusana.trim();
  const tulos =
    sana.length >= 2 && tallennettu.sana === sana ? tallennettu.data : TYHJA;

  if (lomake !== null) {
    return (
      <CustomerForm
        t={t}
        arvot={lomake}
        peruuta={() => setLomake(null)}
      />
    );
  }

  /*
   * Omat asiakkaat vain haettaessa.
   *
   * Rekisteri on jo sivulla tämän kortin alla. Jos kortti listaisi ne
   * myös ennen hakua, sama otsikko ja samat nimet olisivat sivulla
   * kahdesti — ja lukija etsisi eroa jota ei ole.
   */
  const naytaOmat = sana.length < 2 ? [] : tulos.omat;

  return (
    <div className="space-y-4">
      <div>
        <input
          type="search"
          value={hakusana}
          onChange={(e) => setHakusana(e.target.value)}
          placeholder={t.asiakkaat.searchPlaceholder}
          aria-label={t.asiakkaat.search}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
        <p
          className="mt-1.5 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.asiakkaat.searchHint}
        </p>
      </div>

      {naytaOmat.length > 0 ? (
        <Ryhma otsikko={t.asiakkaat.mine}>
          {naytaOmat.map((asiakas) => (
            <Rivi
              key={asiakas.id}
              nimi={asiakas.name}
              alarivi={osoiteRivi(asiakas)}
              onClick={() => setLomake(asiakas)}
            />
          ))}
        </Ryhma>
      ) : null}

      {tulos.ytj.length > 0 ? (
        <Ryhma otsikko={t.asiakkaat.fromYtj}>
          {tulos.ytj.map((osuma) => (
            <Rivi
              key={osuma.businessId}
              nimi={osuma.name}
              alarivi={[osuma.businessId, osoiteRivi(osuma)]
                .filter(Boolean)
                .join(" · ")}
              onClick={() =>
                setLomake({
                  name: osuma.name,
                  businessId: osuma.businessId,
                  careOf: osuma.careOf,
                  street: osuma.street,
                  postalCode: osuma.postalCode,
                  city: osuma.city,
                  country: "FI",
                })
              }
            />
          ))}
        </Ryhma>
      ) : null}

      {tulos.ytjVirhe ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-amber-text)" }}>
          {t.asiakkaat.ytjDown}
        </p>
      ) : null}

      {sana.length >= 2 &&
      !haetaan &&
      tulos.omat.length === 0 &&
      tulos.ytj.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.asiakkaat.noResults}
        </p>
      ) : null}

      {/*
        Käsin lisääminen on aina näkyvissä, ei vasta kun haku epäonnistuu.

        Yksityishenkilöä ja ulkomaista yritystä ei löydy YTJ:stä
        lainkaan, eikä heidän laskuttajansa kuulu etsiä turhaan ensin.
      */}
      <button
        type="button"
        onClick={() =>
          setLomake({ name: sana, country: "FI" })
        }
        className="rf-press rf-touch w-full text-[13px] font-bold"
        style={{
          borderRadius: 980,
          background: "var(--rf-inset)",
          color: "var(--rf-accent)",
        }}
      >
        {t.asiakkaat.addManually}
      </button>
    </div>
  );
}

function osoiteRivi(a: {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string {
  return [a.street, [a.postalCode, a.city].filter(Boolean).join(" ")]
    .filter((osa) => osa && osa.trim() !== "")
    .join(", ");
}

function Ryhma({
  otsikko,
  children,
}: {
  otsikko: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="pb-1 text-[10.5px] font-bold uppercase"
        style={{ color: "var(--rf-text-3)", letterSpacing: "0.07em" }}
      >
        {otsikko}
      </p>
      <ul
        className="divide-y"
        style={{ borderColor: "var(--rf-line)" }}
      >
        {children}
      </ul>
    </div>
  );
}

function Rivi({
  nimi,
  alarivi,
  onClick,
}: {
  nimi: string;
  alarivi: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="rf-press w-full py-2.5 text-start"
      >
        <span className="block text-[14px] font-semibold">{nimi}</span>
        {alarivi ? (
          <span
            className="mt-0.5 block text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {alarivi}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * Vastaanottajan tiedot.
 *
 * Kentät ovat samat riippumatta siitä tulivatko ne YTJ:stä vai
 * kirjoitetaanko ne itse. Rekisteristä poimitut näkyvät valmiiksi
 * täytettyinä eivätkä lukittuina: rekisterin osoite on toisinaan
 * vanha, ja laskuttaja tietää sen paremmin kuin rekisteri.
 */
function CustomerForm({
  t,
  arvot,
  peruuta,
}: {
  t: AdminText;
  arvot: Partial<Customer>;
  peruuta: () => void;
}) {
  const [state, action, pending] = useActionState(saveCustomer, initial);
  const id = useId();

  return (
    <form action={action} className="space-y-4">
      {arvot.id ? <input type="hidden" name="id" value={arvot.id} /> : null}

      <Field label={t.asiakkaat.name} htmlFor={`${id}-name`}>
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={200}
          defaultValue={arvot.name ?? ""}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label={t.asiakkaat.businessId} htmlFor={`${id}-bid`}>
        <input
          id={`${id}-bid`}
          name="businessId"
          inputMode="numeric"
          placeholder="1234567-8"
          defaultValue={arvot.businessId ?? ""}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field
        label={t.asiakkaat.careOf}
        hint={t.asiakkaat.careOfHint}
        htmlFor={`${id}-co`}
      >
        <input
          id={`${id}-co`}
          name="careOf"
          maxLength={120}
          defaultValue={arvot.careOf ?? ""}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label={t.asiakkaat.street} htmlFor={`${id}-street`}>
        <input
          id={`${id}-street`}
          name="street"
          maxLength={160}
          defaultValue={arvot.street ?? ""}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
        <Field label={t.asiakkaat.postalCode} htmlFor={`${id}-zip`}>
          <input
            id={`${id}-zip`}
            name="postalCode"
            inputMode="numeric"
            maxLength={12}
            defaultValue={arvot.postalCode ?? ""}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>

        <Field label={t.asiakkaat.city} htmlFor={`${id}-city`}>
          <input
            id={`${id}-city`}
            name="city"
            maxLength={80}
            defaultValue={arvot.city ?? ""}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>
      </div>

      <Field
        label={t.asiakkaat.email}
        hint={t.asiakkaat.emailHint}
        htmlFor={`${id}-email`}
      >
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          maxLength={200}
          defaultValue={arvot.email ?? ""}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <input type="hidden" name="country" value={arvot.country ?? "FI"} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rf-press rf-touch px-5 text-[13px] font-bold disabled:opacity-60"
          style={{
            borderRadius: 980,
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
          }}
        >
          {t.asiakkaat.save}
        </button>

        <button
          type="button"
          onClick={peruuta}
          className="rf-press rf-touch px-4 text-[13px] font-semibold"
          style={{ borderRadius: 980, background: "var(--rf-inset)" }}
        >
          {t.loput.cancel}
        </button>

        {state.error ? (
          <span className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
            {state.error}
          </span>
        ) : null}

        {state.notice ? (
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: "var(--rf-green-text)" }}
          >
            {state.notice}
          </span>
        ) : null}
      </div>
    </form>
  );
}
