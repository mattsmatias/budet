"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import type {
  Reservation,
  ReservationStatus,
  RestaurantTable,
} from "@/lib/restoflow/reservations";
import { nextStatuses, OLETUS_SEURUE } from "@/lib/restoflow/reservations";
import {
  createReservation,
  fetchFreeTables,
  fetchSlots,
  fetchTableOptions,
  setStatus,
  updateReservation,
  type ReservationState,
  type TableOption,
  type TablePlan,
} from "./actions";

const initial: ReservationState = {};

// ---------------------------------------------------------------------------
// Tilapainikkeet
// ---------------------------------------------------------------------------

/**
 * Seuraava askel, ei kuutta painiketta.
 *
 * Salissa vuoropäällikkö tekee kahta asiaa: merkitsee saapuneen ja
 * merkitsee lähteneen. Loput ovat poikkeuksia. Jos kaikki kuusi tilaa
 * olisivat rivillä, kaksi tavallisinta hukkuisi neljän harvinaisen
 * sekaan — ja rivi olisi puhelimessa luettavaksi liian leveä.
 */
export function StatusActions({
  t,
  reservation,
}: {
  t: AdminText;
  reservation: Reservation;
}) {
  const [state, action] = useActionState(setStatus, initial);
  const steps = nextStatuses(reservation.status);

  const label: Record<ReservationStatus, string> = {
    pending: t.varaus.statusRestore,
    confirmed: t.varaus.statusRestore,
    arrived: t.varaus.statusArrived,
    completed: t.varaus.statusLeft,
    cancelled: t.varaus.statusCancel,
    no_show: t.varaus.statusNoShow,
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step) => (
        <form key={step} action={action}>
          <input type="hidden" name="id" value={reservation.id} />
          <input type="hidden" name="status" value={step} />
          <StepButton
            label={label[step]}
            tone={
              step === "arrived" || step === "completed" ? "primary" : "ghost"
            }
          />
        </form>
      ))}

      {state.error ? (
        <span
          role="alert"
          className="text-[12px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

function StepButton({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" tone={tone} disabled={pending}>
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Varauslomake
// ---------------------------------------------------------------------------

/**
 * Sama lomake luo ja muokkaa.
 *
 * Kentät ovat samat, ja kannassa on kaksi funktiota vain siksi että
 * luonti tarvitsee lukon ja muokkaus tarvitsee vanhan rivin. Kaksi
 * lomaketta ajautuisi erilleen juuri pöytävalinnassa, joka on tämän
 * ainoa hankala kohta.
 */
export function ReservationDialog({
  t,
  date,
  tables,
  slots,
  reservation,
  walkIn,
  trigger,
}: {
  t: AdminText;
  date: string;
  tables: RestaurantTable[];
  slots: string[];
  reservation?: Reservation;
  walkIn?: boolean;
  trigger: "add" | "walkIn" | "edit";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    reservation ? updateReservation : createReservation,
    initial,
  );

  /*
   * Valitut pöydät ovat komponentin tilassa.
   *
   * Ilman tätä lomake ei voisi erottaa "en koskenut pöytiin" ja
   * "poistin kaikki pöydät" toisistaan, ja tallennus siirtäisi
   * varauksen pois pöydästään aina kun muistiinpanoa korjataan.
   */
  const [chosen, setChosen] = useState<string[]>(reservation?.tableIds ?? []);
  const [touched, setTouched] = useState(false);

  /*
   * Seurueen koko ohjaa vapaita aikoja.
   *
   * Kahdelle vapaa aika ei ole vapaa kuudelle, jos ainoa iso pöytä on
   * varattu. Lista haetaan siis uudelleen kun koko muuttuu — muuten
   * lomake tarjoaisi aikoja jotka moottori hylkää vasta lähetyksessä.
   */
  const [party, setParty] = useState(reservation?.partySize ?? OLETUS_SEURUE);

  /*
   * Kellonaika tilaan, jotta ehdotukset osaavat päivittyä.
   *
   * Kenttä oli ohjaamaton, ja se riitti kun aika luettiin vasta
   * lähetyksessä. Pöytäehdotus koskee tiettyä aikaväliä, joten sen on
   * tiedettävä aika samalla hetkellä kun käyttäjä valitsee sen.
   */
  const [time, setTime] = useState(reservation?.time ?? "");
  const [times, setTimes] = useState<string[]>(slots);

  /*
   * Lataustila johdetaan, ei aseteta.
   *
   * setState suoraan efektin alussa aiheuttaa ylimääräisen piirron ja
   * on juuri se kuvio jonka React-lint kieltää. Sama tieto saadaan
   * vertaamalla haettua avainta pyydettyyn: jos ne eroavat, haku on
   * kesken.
   *
   * Alkuarvo vastaa palvelimen valmiiksi laskemaa listaa, joten
   * dialogi ei välähdä latauksena auetessaan.
   */
  const avain = `${date}|${party}`;
  const [ladattu, setLadattu] = useState(
    `${date}|${reservation?.partySize ?? OLETUS_SEURUE}`,
  );
  const loadingTimes = trigger === "add" && ladattu !== avain;

  /* Vapaat pöydät haetaan vasta kun dialogi avataan muokkaukseen. */
  const [free, setFree] = useState<TableOption[] | null>(null);

  useEffect(() => {
    if (state.notice && open) dialog.current?.close();
  }, [state.notice, open]);

  /*
   * Aikojen haku.
   *
   * Vain uudelle varaukselle: walk-in ja muokkaus saavat vapaan
   * kellonajan, koska salissa istutetaan myös aikaan jota lista ei
   * tarjoa.
   *
   * Juokseva numero hylkää vanhentuneen vastauksen: käyttäjä ehtii
   * vaihtaa kokoa nopeammin kuin haku vastaa.
   */
  useEffect(() => {
    if (!open || trigger !== "add") return;

    if (ladattu === avain) return;

    let voimassa = true;

    fetchSlots(date, party).then((tulos) => {
      if (!voimassa) return;
      setTimes(tulos);
      setLadattu(avain);
    });

    return () => {
      voimassa = false;
    };
  }, [open, trigger, date, party, avain, ladattu]);

  /*
   * Sopivat pöydät ja yhdistelmät.
   *
   * Haetaan vasta kun aika ja seurueen koko ovat tiedossa: ilman
   * kumpaakaan kysymys on vailla vastausta, eikä tyhjä lista ole sama
   * asia kuin "ei vapaita pöytiä".
   *
   * null = ei haettu, [] = haettu eikä löytynyt. Ero näkyy
   * käyttöliittymässä: edellinen ei näytä mitään, jälkimmäinen kertoo
   * ettei sopivaa ole.
   */
  const [plan, setPlan] = useState<TablePlan | null>(null);

  /*
   * Lataustila johdetaan, ei aseteta.
   *
   * Sama kuvio kuin vapaiden aikojen haussa: tulos kantaa mukanaan
   * avaimen josta se haettiin, ja jos avain on muuttunut, haku on
   * kesken. setState efektin alussa olisi ylimääräinen piirto ja
   * juuri se kuvio jonka React-lint kieltää.
   *
   * Samalla vanhentunut tulos ei ehdi vilahtaa ruudulla: aikaa
   * vaihdettaessa ehdotukset katoavat siihen asti kunnes uudet
   * saapuvat, eivätkä näytä hetken edellisen ajan pöytiä.
   */
  const ehdotusAvain = `${date}|${time}|${party}`;
  const [ehdotusLahde, setEhdotusLahde] = useState<string | null>(null);

  const optionsLoading = open && time !== "" && ehdotusLahde !== ehdotusAvain;
  const nakyvaSuunnitelma = ehdotusLahde === ehdotusAvain ? plan : null;
  const nakyvatEhdotukset = nakyvaSuunnitelma?.options ?? null;

  useEffect(() => {
    if (!open || time === "" || ehdotusLahde === ehdotusAvain) return;

    let voimassa = true;

    fetchTableOptions({
      date,
      time,
      partySize: party,
      excludeId: reservation?.id,
    }).then((tulos) => {
      if (!voimassa) return;
      setPlan(tulos);
      setEhdotusLahde(ehdotusAvain);
    });

    return () => {
      voimassa = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ehdotusAvain, ehdotusLahde]);

  /* Vapaat pöydät muokattaessa. */
  useEffect(() => {
    if (!open || !reservation) return;

    let voimassa = true;
    fetchFreeTables(reservation.id).then((tulos) => {
      if (voimassa) setFree(tulos);
    });

    return () => {
      voimassa = false;
    };
  }, [open, reservation]);

  function show() {
    setChosen(reservation?.tableIds ?? []);
    setTouched(false);
    setEhdotusLahde(null);

    /*
     * Aika lähtötilaan avattaessa.
     *
     * Uudelle varaukselle se on listan ensimmäinen vapaa aika, sama
     * jonka valitsin näyttää. Jos tila jäisi tyhjäksi, ehdotuksia ei
     * haettaisi ennen kuin käyttäjä koskee aikavalitsimeen — vaikka
     * valinta on jo tehty hänen puolestaan.
     */
    setTime(
      reservation?.time ?? (trigger === "add" ? (times[0] ?? "") : nowTime()),
    );

    setOpen(true);
    dialog.current?.showModal();
  }

  const title = reservation
    ? t.varaus.editReservation
    : walkIn
      ? t.varaus.addWalkIn
      : t.varaus.addReservation;

  return (
    <>
      {trigger === "edit" ? (
        <button
          type="button"
          onClick={show}
          aria-label={fill(t.varaus.editNamed, {
            nimi: reservation?.guestName ?? "",
          })}
          className="rf-press rf-icon-btn rf-hit flex h-7 w-7 items-center justify-center rounded-[7px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          <RfIcon name="settings" size={14} />
        </button>
      ) : (
        <Button
          type="button"
          tone={trigger === "add" ? "primary" : "ghost"}
          onClick={show}
          icon={<RfIcon name="plus" size={16} />}
        >
          {title}
        </Button>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-label={title}
        className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-[16px] p-0 backdrop:bg-black/40"
        style={{ background: "var(--rf-card)", color: "var(--rf-text)" }}
      >
        {open ? (
          <form action={action} className="p-5">
            {reservation ? (
              <input type="hidden" name="id" value={reservation.id} />
            ) : (
              <input type="hidden" name="date" value={date} />
            )}
            {walkIn ? <input type="hidden" name="walkIn" value="1" /> : null}
            {touched ? (
              <input type="hidden" name="tablesTouched" value="1" />
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label={t.varaus.close}
                className="rf-press rf-icon-btn flex h-9 w-9 items-center justify-center rounded-[9px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                <RfIcon name="back" size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <Field label={t.varaus.time} htmlFor="rv-time" required>
                  {/*
                    Walk-in ja muokkaus saavat vapaan kellonajan, uusi
                    varaus valitsee vapaista. Vapaa kenttä uudessa
                    varauksessa antaisi kirjoittaa ajan jolloin sali on
                    kiinni — kanta hylkäisi sen, mutta vasta lähetyksen
                    jälkeen.
                  */}
                  {trigger === "add" && loadingTimes ? (
                    <p
                      className="py-2.5 text-[13px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {t.varaus.loadingTimes}
                    </p>
                  ) : trigger === "add" && times.length === 0 ? (
                    /*
                     * Ei aikoja tälle koolle.
                     *
                     * Tyhjä valikko näyttäisi rikkinäiseltä. Syy on
                     * seurueen koko tai päivä, ja se sanotaan.
                     */
                    <p
                      className="py-2.5 text-[13px]"
                      style={{ color: "var(--rf-amber-text)" }}
                    >
                      {t.varaus.noTimesForParty}
                    </p>
                  ) : trigger === "add" ? (
                    <select
                      id="rv-time"
                      name="time"
                      required
                      key={times.join(",")}
                      defaultValue={times[0]}
                      onChange={(event) => setTime(event.target.value)}
                      className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                      style={{
                        background: "var(--rf-inset)",
                        borderRadius: "var(--rf-r-control)",
                      }}
                    >
                      {times.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="rv-time"
                      name="time"
                      type="time"
                      required
                      defaultValue={reservation?.time ?? nowTime()}
                      onChange={(event) => setTime(event.target.value)}
                      className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                      style={{
                        background: "var(--rf-inset)",
                        borderRadius: "var(--rf-r-control)",
                      }}
                    />
                  )}
                </Field>

                <Field label={t.varaus.partySize} htmlFor="rv-party" required>
                  <input
                    id="rv-party"
                    name="partySize"
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={party}
                    onChange={(event) =>
                      setParty(Math.max(1, Number(event.target.value) || 1))
                    }
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>
              </div>

              <Field label={t.varaus.guest} htmlFor="rv-name" required>
                <input
                  id="rv-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={reservation?.guestName ?? ""}
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label={t.varaus.phone} htmlFor="rv-phone">
                  <input
                    id="rv-phone"
                    name="phone"
                    type="tel"
                    maxLength={40}
                    defaultValue={reservation?.guestPhone ?? ""}
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>

                <Field label={t.varaus.email} htmlFor="rv-email">
                  <input
                    id="rv-email"
                    name="email"
                    type="email"
                    maxLength={160}
                    defaultValue={reservation?.guestEmail ?? ""}
                    className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  />
                </Field>
              </div>

              <Field label={t.varaus.note} htmlFor="rv-note">
                <input
                  id="rv-note"
                  name="note"
                  maxLength={500}
                  defaultValue={reservation?.note ?? ""}
                  placeholder={t.varaus.notePlaceholder}
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              {/*
                Allergiat erillään toiveista.

                Sama kenttä olisi vähemmän täytettävää, ja juuri siksi
                allergia hukkuisi lauseeseen "ikkunapöytä jos mahdollista,
                yksi kasvis, Villellä synttärit". Keittiö lukee tämän
                kentän eikä sitä toista.
              */}
              <Field label={t.varaus.allergies} htmlFor="rv-allergies">
                <input
                  id="rv-allergies"
                  name="allergies"
                  maxLength={200}
                  defaultValue={reservation?.allergies ?? ""}
                  placeholder={t.varaus.allergiesPlaceholder}
                  className="w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </Field>

              {/* --- Keittiön kuorma ja seuraava varaus --- */}
              <KitchenNotice t={t} plan={nakyvaSuunnitelma} time={time} />

              {/* --- Pöydät --- */}
              <fieldset>
                <legend className="text-[13px] font-medium">
                  {t.varaus.tablesLabel}
                </legend>
                <p
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.varaus.tableAutoHint}
                </p>

                {/*
                  Ehdotukset ennen pöytälistaa.

                  Kahdeksan hengen seurue mahtuu harvoin yhteen
                  pöytään, ja ilman ehdotusta esihenkilön on
                  muistettava ulkoa mitkä pöydät saa yhdistää ja
                  kumpi pari on vapaa. Kate tietää molemmat.

                  Ehdotus ei tallenna mitään: se valitsee pöydät
                  lomakkeelle, ja tallennus on yhä oma painalluksensa.
                */}
                {optionsLoading ? (
                  <p
                    className="mt-2 text-[12.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {t.varaus.suggestLoading}
                  </p>
                ) : null}

                {!optionsLoading &&
                nakyvatEhdotukset !== null &&
                nakyvatEhdotukset.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[12.5px] font-semibold">
                      {t.varaus.suggestTitle}
                    </p>

                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {nakyvatEhdotukset.map((option) => {
                        const valittu =
                          option.tableIds.length === chosen.length &&
                          option.tableIds.every((id) => chosen.includes(id));

                        return (
                          <button
                            key={option.tableIds.join("-")}
                            type="button"
                            aria-pressed={valittu}
                            onClick={() => {
                              setTouched(true);
                              setChosen(option.tableIds);
                            }}
                            className="rf-press px-3 py-1.5 text-left text-[13px]"
                            style={{
                              background: valittu
                                ? "var(--rf-accent)"
                                : "var(--rf-inset)",
                              color: valittu
                                ? "var(--rf-on-accent)"
                                : "var(--rf-text)",
                              border: `1px solid ${
                                option.kind === "combination" && !valittu
                                  ? "var(--rf-accent)"
                                  : "transparent"
                              }`,
                              borderRadius: "var(--rf-r-control)",
                            }}
                          >
                            <span className="block font-semibold">
                              {option.label}
                            </span>
                            <span
                              className="block text-[11.5px]"
                              style={{ opacity: 0.8 }}
                            >
                              {option.wasted === 0
                                ? t.varaus.suggestExact
                                : fill(t.varaus.suggestSpare, {
                                    maara: String(option.wasted),
                                  })}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <p
                      className="mt-1.5 text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {t.varaus.suggestHint}
                    </p>
                  </div>
                ) : null}

                {!optionsLoading &&
                nakyvatEhdotukset !== null &&
                nakyvatEhdotukset.length === 0 ? (
                  <p
                    className="mt-2 text-[12.5px]"
                    style={{ color: "var(--rf-amber-text)" }}
                  >
                    {t.varaus.suggestNone}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tables
                    .filter((table) => table.active)
                    .map((table) => {
                      const on = chosen.includes(table.id);

                      /*
                       * Vapaus tiedetään vain muokattaessa: uudella
                       * varauksella ei ole vielä aikaa jota vasten
                       * verrata. Ennen listan saapumista mikään ei ole
                       * varattu — muuten lista välähtäisi punaisena.
                       */
                      const varattu =
                        free !== null && !free.some((f) => f.id === table.id);
                      const ahdas =
                        free?.find((f) => f.id === table.id)?.fits === false;

                      return (
                        <label
                          key={table.id}
                          title={
                            varattu
                              ? t.varaus.tableTaken
                              : ahdas
                                ? t.varaus.tableTight
                                : undefined
                          }
                          className="rf-press cursor-pointer px-3 py-1.5 text-[13px] font-medium"
                          style={{
                            background: on
                              ? "var(--rf-accent)"
                              : "var(--rf-inset)",
                            color: on
                              ? "var(--rf-on-accent)"
                              : varattu
                                ? "var(--rf-text-3)"
                                : "var(--rf-text)",
                            border:
                              ahdas && !on
                                ? "1px solid var(--rf-amber)"
                                : "1px solid transparent",
                            borderRadius: "var(--rf-r-pill)",
                            /* Varattu näkyy himmeänä muttei katoa: sen voi
                               yhä valita, ja kanta kertoo jos se ei käy. */
                            opacity: varattu && !on ? 0.45 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            name="tableId"
                            value={table.id}
                            checked={on}
                            onChange={(event) => {
                              setTouched(true);
                              setChosen((prev) =>
                                event.target.checked
                                  ? [...prev, table.id]
                                  : prev.filter((id) => id !== table.id),
                              );
                            }}
                            className="sr-only"
                          />
                          {table.name}
                          {varattu ? " ·" : ""}
                        </label>
                      );
                    })}
                </div>

                {free !== null ? (
                  <p
                    className="mt-1.5 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {t.varaus.tableLegend}
                  </p>
                ) : null}
              </fieldset>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <SaveButton t={t} />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="mt-3 text-[13px]"
                style={{ color: "var(--rf-red-text)" }}
              >
                {state.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </dialog>
    </>
  );
}

function SaveButton({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" disabled={pending}>
      {pending ? t.varaus.saving : t.varaus.save}
    </Button>
  );
}

/**
 * Keittiön kuorma ja seuraava varaus.
 *
 * KUMPIKAAN EI ESTÄ TALLENNUSTA.
 *
 * Keittiön raja pysäyttää verkkovarauksen, koska asiakas verkossa ei
 * voi neuvotella keittiön kanssa. Salissa sama raja olisi ohjelma joka
 * väittää tietävänsä keittiöstä paremmin kuin vuoropäällikkö: kymmenen
 * hengen seurue voi olla se joka tilaa kolme pizzaa.
 *
 * Kuorma näytetään silti aina kun raja on asetettu — myös silloin kun
 * mahtuu. Luku joka ilmestyy vasta ongelmassa on luku johon ei opita
 * luottamaan, ja "9/40" kertoo yhdellä silmäyksellä että illassa on
 * tilaa.
 */
function KitchenNotice({
  t,
  plan,
  time,
}: {
  t: AdminText;
  plan: TablePlan | null;
  time: string;
}) {
  if (!plan) return null;

  const kitchen = plan.kitchen;
  const rajattu = Boolean(kitchen?.limited);
  const taynna = rajattu && kitchen?.ok === false;

  if (!rajattu && !plan.next) return null;

  return (
    <div className="space-y-1">
      {rajattu ? (
        <p
          className="text-[12.5px]"
          style={{
            color: taynna ? "var(--rf-amber-text)" : "var(--rf-text-3)",
          }}
        >
          {fill(t.varaus.kitchenLoad, {
            aika: time,
            kuorma: String(kitchen?.load ?? 0),
            raja: String(kitchen?.capacity ?? 0),
          })}
          {taynna ? ` — ${t.varaus.kitchenFull}` : ""}
        </p>
      ) : null}

      {plan.next ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-amber-text)" }}>
          {fill(t.varaus.nextSoon, {
            maara: String(plan.next.minutes),
            nimi: plan.next.guestName,
          })}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: "var(--rf-text-3)" }}>
            {" *"}
          </span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Kuluva tunti ja minuutti walk-inin oletukseksi. */
function nowTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
