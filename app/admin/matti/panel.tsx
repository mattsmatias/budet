"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  cancelMattiAction,
  confirmMattiAction,
  type MattiActionState,
} from "../matti-actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import { useDismiss } from "@/components/restoflow/use-dismiss";
import type { Briefing } from "@/lib/matti/briefing";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";

/**
 * Matti-paneeli.
 *
 * Työpöydällä oikealta liukuva paneeli, puhelimessa koko ruutu. Matti
 * ei vie käyttäjää pois siitä mitä hän oli tekemässä — se on koko
 * pointti: kysymys esitetään sen sivun päällä jota katsotaan, ja
 * sivun osoite lähtee mukana vihjeeksi.
 *
 * Vihjeeksi, ei valtuutukseksi. Palvelin ei luota siihen missä selain
 * väittää olevansa.
 */

interface Step {
  tool: string;
  summary: string;
}

interface ActionPreview {
  title: string;
  changes: { label: string; from?: string; to: string }[];
  warning?: string;
}

interface PendingAction {
  id: string;
  tool: string;
  preview: ActionPreview;
}

/** Sama muoto kuin työkalun palauttama kortti. */
interface ToolCard {
  title: string;
  value: string;
  meta?: string[];
  bars?: { label: string; value: string; percent: number }[];
  href?: string;
  linkLabel?: string;
}

interface Turn {
  role: "user" | "matti";
  text: string;
  steps?: Step[];
  actions?: PendingAction[];
  cards?: ToolCard[];
}

export function MattiPanel({
  enabled,
  compact,
  briefing,
  greeting,
  t,
}: {
  enabled: boolean;
  /** Hallinnan tekstit. */
  t: AdminText;
  /** Tilannekatsaus palvelimelta — samasta lähteestä kuin hälytykset. */
  briefing: Briefing;
  greeting: string;
  /** Yläpalkin pyöreä ikonipainike sivupalkin rivin sijaan. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);
  const container = useDismiss<HTMLDivElement>(open, close);

  /*
   * Näppäinoikotie. Ctrl/Cmd + J.
   *
   * K on varattu selaimen ja monen sovelluksen hakukentälle, joten
   * sen kaappaaminen olisi käyttäjän totutun toiminnon vientiä.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!enabled) return null;

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={t.matti.ariaLabel}
          title={t.matti.shortcut}
          className="rf-press flex h-10 w-10 items-center justify-center"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-accent)",
            borderRadius: "50%",
          }}
        >
          <RfIcon name="sparkle" size={17} />
        </button>

        {open ? (
          <Overlay
            t={t}
            container={container}
            pathname={pathname}
            close={close}
            briefing={briefing}
            greeting={greeting}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        /*
         * Sama mitta kuin kiskon muilla riveillä.
         *
         * Matti on kiskon pohjalla viivan alla, ja eri pehmuste teki
         * siitä irrallisen: rivi oli leveämpi ja teksti isompi kuin
         * yhdelläkään sen yläpuolella.
         */
        className="rf-rail-link rf-press flex w-full items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-left text-[13.5px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span style={{ color: "var(--rf-accent)" }}>
          <RfIcon name="sparkle" size={17} />
        </span>

        {/*
          Yksi rivi, ei kahta.

          Alarivi "BUDet AI" toisti sen minka ikoni ja nimi jo kertovat,
          ja se teki kiskon pohjasta 84 pikselia korkean — mika oli
          yksi syy siihen etta valikko vieritti lyhyella ruudulla.
          Nyt rivi on saman korkuinen kuin kaikki muutkin.
        */}
        <span
          className="min-w-0 flex-1 font-bold"
          style={{ color: "var(--rf-text)" }}
        >
          {t.matti.name}
        </span>

        <kbd
          className="hidden shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium lg:block"
          style={{ background: "var(--rf-inset)", color: "var(--rf-text-3)" }}
        >
          ⌘J
        </kbd>
      </button>

      {open ? (
        <Overlay
          t={t}
          container={container}
          pathname={pathname}
          close={close}
          briefing={briefing}
          greeting={greeting}
        />
      ) : null}
    </>
  );
}

/**
 * Paneeli piirretään bodyyn, ei sivupalkin sisään.
 *
 * Painike on sivupalkissa, joten ilman portaalia paneelikin olisi
 * siellä. position: fixed ei silloin riitä: mikä tahansa esivanhemman
 * transform, filter tai will-change tekee siitä uuden sijoituskehyksen
 * ja vangitsee paneelin sivupalkin pinoamiskontekstiin. Nyt yksikään
 * tuleva tyylimuutos sivupalkissa ei voi rikkoa tätä.
 *
 * Liitostilaa ei tarvita. Overlay renderöidään vain kun open on tosi,
 * ja open voi muuttua vain käyttäjän painalluksesta — palvelimella
 * renderöitäessä se on aina epätosi, joten tänne ei päädytä ilman
 * documenttia. Varmistus on silti tallessa alla.
 */
function Overlay({
  container,
  pathname,
  close,
  briefing,
  greeting,
  t,
}: {
  t: AdminText;
  container: React.RefObject<HTMLDivElement | null>;
  pathname: string;
  close: () => void;
  briefing: Briefing;
  greeting: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="rf-z-panel-backdrop fixed inset-0"
        style={{ background: "rgba(17, 19, 24, 0.35)" }}
      />

      <div
        ref={container}
        role="dialog"
        aria-label={t.matti.ariaLabel}
        className="rf-z-panel rf-enter fixed inset-0 flex flex-col sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l"
        style={{
          background: "var(--rf-card)",
          borderColor: "var(--rf-line)",
          boxShadow: "var(--rf-shadow-lg)",
        }}
      >
        <Conversation
          t={t}
          currentPage={pathname}
          onClose={close}
          briefing={briefing}
          greeting={greeting}
        />
      </div>
    </>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

/**
 * Keskustelu.
 *
 * Matin vastaus ei ole kupla. Kupla tekee jokaisesta vastauksesta
 * viestin, ja Matti ei lähetä viestejä vaan tekee työtä ja kertoo
 * tuloksen. Käyttäjän oma viesti on kupla, koska se erottaa hänen
 * sanansa Matin työstä.
 */
function Conversation({
  currentPage,
  onClose,
  briefing,
  greeting,
  t,
}: {
  briefing: Briefing;
  greeting: string;
  currentPage: string;
  onClose: () => void;
  t: AdminText;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    retryable: boolean;
  } | null>(null);
  const [lastAsked, setLastAsked] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  /*
   * Vieritetään alas vain jos käyttäjä oli jo siellä.
   *
   * Pakotettu vieritys keskeyttäisi vanhojen viestien selaamisen
   * kesken lukemisen — ja juuri silloin kun uusi vastaus saapuu,
   * eli silloin kun se on kaikkein ärsyttävintä.
   */
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;

    const nearBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight < 120;

    if (nearBottom) {
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns, busy]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (text === "" || busy) return;

      setLastAsked(text);
      setTurns((current) => [...current, { role: "user", text }]);
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/matti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, conversationId, currentPage }),
        });

        const payload = await response.json();

        if (!response.ok) {
          setError({
            text: payload.error ?? t.matti.noAnswer,
            // Palvelin kertoo auttaako uudelleen yrittäminen. Saldon
            // loppuessa ei auta, eikä painiketta silloin näytetä.
            retryable: payload.retryable !== false,
          });
          return;
        }

        setConversationId(payload.conversationId);
        setTurns((current) => [
          ...current,
          {
            role: "matti",
            text: payload.text,
            steps: payload.steps,
            actions: payload.actions,
            cards: payload.cards,
          },
        ]);
      } catch {
        // Verkkokatkos selaimessa. Tämä menee ohi itsestään.
        setError({ text: t.matti.noAnswer, retryable: true });
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, currentPage, t.matti.noAnswer],
  );

  return (
    <>
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: "var(--rf-accent)" }}>
            <RfIcon name="sparkle" size={18} />
          </span>
          <p className="text-[15px] font-semibold">{t.matti.name}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t.matti.close}
          className="rf-press rf-icon-btn flex h-9 w-9 items-center justify-center rounded-[9px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={18} />
        </button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {turns.length === 0 ? (
          <Welcome
            t={t}
            currentPage={currentPage}
            onPick={send}
            briefing={briefing}
            greeting={greeting}
          />
        ) : (
          <div className="space-y-6">
            {turns.map((turn, index) => (
              <TurnView t={t} key={index} turn={turn} />
            ))}
          </div>
        )}

        {busy ? <Working t={t} /> : null}

        {error ? (
          <div className="mt-5">
            <p className="text-[14px] leading-relaxed">{error.text}</p>
            {error.retryable && lastAsked ? (
              <Button
                type="button"
                tone="ghost"
                size="sm"
                onClick={() => {
                  // Toistettu kysymys ei saa jäädä listaan kahdesti.
                  setTurns((current) => current.slice(0, -1));
                  void send(lastAsked);
                }}
              >
                {t.matti.retry}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div ref={bottom} />
      </div>

      <Composer onSend={send} busy={busy} inputRef={input} t={t} />
    </>
  );
}

/**
 * Työn tila.
 *
 * Yksi rivi, ei luetteloa työkaluista. Käyttäjä ei tilaa
 * tietokantakyselyitä vaan vastauksen; tieto siitä että
 * get_top_suppliers ajettiin on kehittäjän tieto.
 */
function Working({ t }: { t: AdminText }) {
  return (
    <p
      className="mt-5 flex items-center gap-2 text-[13px]"
      style={{ color: "var(--rf-text-3)" }}
    >
      <span className="rf-thinking" style={{ color: "var(--rf-accent)" }}>
        <RfIcon name="sparkle" size={14} />
      </span>
      {t.matti.thinking}
    </p>
  );
}

// ---------------------------------------------------------------------------

/**
 * Ehdotukset sen mukaan missä käyttäjä on.
 *
 * SIVU KERTOO MITÄ IHMINEN ON TEKEMÄSSÄ.
 *
 * Sama viisi nappia joka sivulla on lista jonka lukemisen lopettaa
 * kolmannella kerralla. Kuittisivulla oleva ei ensimmäisenä halua
 * tehdä lounaslistaa, ja budjettisivulla oleva kysyy budjetista.
 *
 * Ehdotukset ovat kysymyksiä eivätkä komentoja. "Miksi työvoimakulut
 * ovat yli budjetin" johtaa vastaukseen jota voi käyttää; "tarkista
 * budjetit" johtaa lukuun jonka näkee jo ruudulta.
 */
function quickActions(
  currentPage: string,
  t: AdminText,
): { label: string; prompt: string }[] {
  const yleiset = [
    { label: t.mattiKysy.todayShort, prompt: t.mattiKysy.todayShort },
    { label: t.mattiKysy.weekWrongShort, prompt: t.mattiKysy.weekWrongShort },
    { label: t.mattiKysy.profitShort, prompt: t.mattiKysy.profitFull },
  ];

  const sivukohtaiset: Record<string, { label: string; prompt: string }[]> = {
    "/admin/budjetit": [
      {
        label: t.mattiKysy.overBudgetShort,
        prompt: t.mattiKysy.overBudgetFull,
      },
      {
        label: t.mattiKysy.budgetLeftShort,
        prompt: t.mattiKysy.budgetLeftShort,
      },
    ],
    "/admin/kuitit": [
      { label: t.mattiKysy.biggestShort, prompt: t.mattiKysy.biggestFull },
      { label: t.mattiKysy.unhandledShort, prompt: t.mattiKysy.unhandledShort },
    ],
    "/admin/kulut": [
      { label: t.mattiKysy.grewMostShort, prompt: t.mattiKysy.grewMostFull },
      { label: t.mattiKysy.expensesShort, prompt: t.mattiKysy.expensesFull },
    ],
    "/admin/tyovuorot": [
      {
        label: t.mattiKysy.rosterCostShort,
        prompt: t.mattiKysy.rosterCostFull,
      },
      {
        label: t.mattiKysy.openShiftsShort,
        prompt: t.mattiKysy.openShiftsFull,
      },
    ],
    "/admin/lounas": [
      { label: t.mattiKysy.lunchListShort, prompt: t.mattiKysy.lunchListFull },
      { label: t.mattiKysy.lunchMostShort, prompt: t.mattiKysy.lunchMostFull },
    ],
    "/admin/myynti": [
      {
        label: t.mattiKysy.salesTrendShort,
        prompt: t.mattiKysy.salesTrendShort,
      },
      {
        label: t.mattiKysy.salesTargetShort,
        prompt: t.mattiKysy.salesTargetFull,
      },
    ],
    "/admin/palkat": [
      {
        label: t.mattiKysy.labourCostShort,
        prompt: t.mattiKysy.labourCostShort,
      },
    ],
    "/admin/tehtavat": [
      { label: t.mattiKysy.lateTasksShort, prompt: t.mattiKysy.lateTasksShort },
    ],
    "/admin/raportit": [
      { label: t.mattiKysy.summariseShort, prompt: t.mattiKysy.summariseFull },
    ],
  };

  const osuma = Object.keys(sivukohtaiset).find((polku) =>
    currentPage.startsWith(polku),
  );
  return osuma ? [...sivukohtaiset[osuma], ...yleiset.slice(0, 1)] : yleiset;
}

/**
 * Aloitusnäkymä.
 *
 * MATTI KERTOO HETI MIKSI SE ON AUKI.
 *
 * Tässä luki aiemmin "BUDet AI -työkaveri" ja kappale siitä että Matti
 * voi auttaa hoitamaan asioita. Se vei neljänneksen ruudusta eikä
 * kertonut ravintolasta mitään — teksti oli sama tyhjänä päivänä ja
 * silloin kun kaksi asiaa oli pielessä.
 *
 * Nyt ensimmäisenä on tilanne. Se on johdettu samasta buildAlerts-
 * kutsusta kuin kellon merkki ja Ilmoitukset, joten Matti ei voi
 * kertoa eri tilannetta kuin muu sovellus.
 */
function Welcome({
  t,
  currentPage,
  onPick,
  briefing,
  greeting,
}: {
  currentPage: string;
  onPick: (prompt: string) => void;
  briefing: Briefing;
  greeting: string;
  t: AdminText;
}) {
  const { critical, warnings, observations } = briefing;
  const kaikkiKunnossa = critical.length === 0 && warnings.length === 0;

  return (
    <div className="space-y-6 pt-2">
      {/*
        Tervehdys aloittaa, ei nimi.

        Tässä oli oma otsikkonsa: sama kipinäikoni ja sama sana "Matti"
        kuin paneelin kiinteässä yläpalkissa kolmenkymmenen pikselin
        päässä, ja alla rivi "AI-työkaverisi ravintolan arkeen".
        Nimi kahdesti samalla ruudulla ei kerro toisella kerralla
        mitään, ja kuvausrivi oli sama joka päivä — myös silloin kun
        kaksi asiaa oli pielessä.

        Sama perustelu kuin sille tekstille joka poistettiin täältä
        aiemmin: ensimmäisenä on tilanne.
      */}
      <p className="text-[14px] leading-relaxed">
        {greeting} 👋{" "}
        {kaikkiKunnossa ? t.matti.nothingToNote : t.matti.hereAreTheMain}
      </p>

      {/*
        Tilanne kolmessa tasossa.

        Kiireelliset ensin, koska lista luetaan ylhäältä ja se katkeaa
        siihen mihin aika loppuu.
      */}
      {critical.length > 0 ? (
        <Tilanne
          tone="risk"
          title={`${critical.length} ${critical.length === 1 ? "asia vaatii" : "asiaa vaatii"} huomiota`}
          alerts={critical}
        />
      ) : null}

      {warnings.length > 0 ? (
        <Tilanne
          tone="warn"
          title={`${warnings.length} ${warnings.length === 1 ? "asia kannattaa" : "asiaa kannattaa"} tarkistaa`}
          alerts={warnings}
        />
      ) : null}

      {kaikkiKunnossa ? (
        <p
          className="flex items-center gap-2 text-[13.5px]"
          style={{ color: "var(--rf-green-text)" }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0"
            style={{ background: "var(--rf-green-text)", borderRadius: 999 }}
          />
          {t.matti.allGood}
        </p>
      ) : null}

      {/*
        Havainnot.

        Nämä eivät ole hälytyksiä vaan poikkeamia joita kukaan ei ole
        pyytänyt etsimään. Jokainen on laskettu Katen datasta ja
        jokaisella on kynnys — kolmen prosentin heilahdus ei ole
        havainto vaan kohinaa.
      */}
      {observations.map((havainto) => (
        <div
          key={havainto.id}
          className="px-3.5 py-3"
          style={{
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p
            className="flex items-center gap-1.5 text-[12px] font-bold uppercase"
            style={{ color: "var(--rf-accent)", letterSpacing: "0.06em" }}
          >
            <RfIcon name="sparkle" size={13} />
            {t.matti.noticed}
          </p>

          <p className="mt-1.5 text-[13.5px] leading-relaxed">
            {havainto.text}
          </p>

          <button
            type="button"
            onClick={() =>
              onPick(fill(t.matti.whyIsThat, { asia: havainto.text }))
            }
            className="rf-press mt-2 text-[12.5px] font-bold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.matti.whyLink}
          </button>
        </div>
      ))}

      <div>
        <p
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.matti.whatToDo}
        </p>

        <div className="mt-2 space-y-1.5">
          {quickActions(currentPage, t).map((action) => (
            <button
              key={action.prompt}
              type="button"
              onClick={() => onPick(action.prompt)}
              className="rf-press flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-[13px] font-medium"
              style={{
                background: "var(--rf-card)",
                border: "1px solid var(--rf-line)",
                color: "var(--rf-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {action.label}
              <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
                <RfIcon name="chevron" size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.matti.changesShown}
      </p>
    </div>
  );
}

/**
 * Yksi tilanneryhmä.
 *
 * Enintään kolme riviä ja loput lukumääränä. Paneeli on kapea, ja
 * kymmenen riviä työntäisi ehdotukset näkymän ulkopuolelle — juuri ne
 * joiden takia Matti avattiin.
 */
function Tilanne({
  tone,
  title,
  alerts,
}: {
  tone: "risk" | "warn";
  title: string;
  alerts: { id: string; title: string; detail: string; href: string }[];
}) {
  const nayta = alerts.slice(0, 3);
  const loput = alerts.length - nayta.length;

  const vari = tone === "risk" ? "var(--rf-red-text)" : "var(--rf-amber-text)";

  return (
    <div>
      <p
        className="flex items-center gap-2 text-[13.5px] font-semibold"
        style={{ color: vari }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0"
          style={{ background: vari, borderRadius: 999 }}
        />
        {title}
      </p>

      <ul className="mt-2 space-y-1.5">
        {nayta.map((alert) => (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className="rf-press block px-3.5 py-2.5"
              style={{
                background: "var(--rf-card)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="block text-[13.5px] font-medium">
                {alert.title}
              </span>
              <span
                className="mt-0.5 block text-[12.5px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {alert.detail}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {loput > 0 ? (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          ja {loput} muuta
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TurnView({ turn, t }: { turn: Turn; t: AdminText }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p
          className="max-w-[75%] px-3.5 py-2 text-[14px] leading-relaxed"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: 14,
          }}
        >
          {turn.text}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Ei kuplaa. Matin vastaus on sisältöä, ei viesti. */}
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
        {turn.text}
      </p>

      {turn.cards?.map((card, index) => (
        <DataCard key={index} card={card} />
      ))}

      {turn.actions?.map((action) => (
        <ActionCard key={action.id} action={action} t={t} />
      ))}

      {turn.steps && turn.steps.length > 0 ? (
        <Steps steps={turn.steps} t={t} />
      ) : null}
    </div>
  );
}

/**
 * Työvaiheet piiloon, mutta ei pois.
 *
 * Luku on tarkistettavissa vain jos sen lähteen voi nähdä. Avaaminen
 * on kuitenkin harvinaista, joten se on yhden rivin takana eikä
 * vastauksen päällä.
 */
function Steps({ steps, t }: { steps: Step[]; t: AdminText }) {
  return (
    <details className="mt-3">
      <summary
        className="cursor-pointer list-none text-[12px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.matti.howSolved}
      </summary>

      <ul className="mt-2 space-y-1">
        {steps.map((step, index) => (
          <li
            key={index}
            className="flex items-start gap-1.5 text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            <span className="mt-0.5 shrink-0">
              <RfIcon name="check" size={11} />
            </span>
            {tyokalut(t)[step.tool] ?? step.tool}
          </li>
        ))}
      </ul>
    </details>
  );
}

const tyokalut = (t: AdminText): Record<string, string> => ({
  get_dashboard_summary: t.mattiTyo.monthSummary,
  get_expenses_by_category: t.mattiTyo.byCategory,
  get_top_suppliers: t.mattiTyo.topSuppliers,
  search_receipts: t.mattiTyo.receipts,
  get_budget_status: t.mattiTyo.budgets,
  get_lunch_week: t.mattiTyo.lunchWeek,
  get_staff: t.mattiTyo.staff,
  get_shifts: t.mattiTyo.shifts,
  propose_lunch_items: t.mattiTyo.preparedLunch,
  propose_lunch_price: t.mattiTyo.preparedPrice,
  propose_copy_lunch_week: t.mattiTyo.preparedCopy,
  propose_publish_lunch_week: t.mattiTyo.preparedPublish,
});

// ---------------------------------------------------------------------------

/**
 * Datakortti.
 *
 * Luvut tulevat työkalulta valmiiksi muotoiltuina. Matin ei tarvitse
 * toistaa niitä tekstissä, eikä käyttöliittymä jäsennä niitä
 * vastauksesta — kumpikin tapa tuottaisi ennen pitkää luvun joka ei
 * vastaa kantaa.
 */
function DataCard({ card }: { card: ToolCard }) {
  return (
    <div
      className="mt-3 px-4 py-3.5"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {card.title}
      </p>

      <p className="rf-tabular mt-0.5 text-[24px] font-semibold leading-tight">
        {card.value}
      </p>

      {card.meta && card.meta.length > 0 ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-2)" }}>
          {card.meta.join(" · ")}
        </p>
      ) : null}

      {card.bars && card.bars.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {card.bars.map((bar, index) => (
            <li key={index}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[12px]">{bar.label}</span>
                <span
                  className="rf-tabular shrink-0 text-[12px] font-medium"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {bar.value}
                </span>
              </div>

              <div
                className="mt-1 h-1 overflow-hidden"
                style={{ background: "var(--rf-inset)", borderRadius: 999 }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, bar.percent))}%`,
                    background: "var(--rf-line-strong)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {card.href && card.linkLabel ? (
        <Link
          href={card.href}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          {card.linkLabel}
          <RfIcon name="chevron" size={13} />
        </Link>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

const initialAction: MattiActionState = {};

/**
 * Toimintokortti.
 *
 * Muutos ei ole tekstiä vaan kortti jossa näkyy mitä tapahtuu. Vasta
 * Hyväksy suorittaa sen — ja palvelin lukee argumentit kannasta, ei
 * tästä kortista.
 */
function ActionCard({ action, t }: { action: PendingAction; t: AdminText }) {
  const [confirmState, confirm] = useActionState(
    confirmMattiAction,
    initialAction,
  );
  const [cancelState, cancel] = useActionState(
    cancelMattiAction,
    initialAction,
  );
  const router = useRouter();

  const done = confirmState.ok || confirmState.error || cancelState.message;

  useEffect(() => {
    if (confirmState.ok) router.refresh();
  }, [confirmState.ok, router]);

  return (
    <div
      className="mt-3 overflow-hidden"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="px-4 py-3.5">
        <p className="text-[13px] font-semibold">{action.preview.title}</p>

        <dl className="mt-2.5 space-y-2">
          {action.preview.changes.map((change, index) => (
            <div key={index}>
              <dt className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                {change.label}
              </dt>
              <dd className="rf-tabular text-[14px] font-medium">
                {change.from ? (
                  <>
                    <span
                      style={{
                        color: "var(--rf-text-3)",
                        textDecoration: "line-through",
                      }}
                    >
                      {change.from}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {" → "}
                    </span>
                  </>
                ) : null}
                {change.to}
              </dd>
            </div>
          ))}
        </dl>

        {action.preview.warning ? (
          <p
            className="mt-3 px-3 py-2 text-[12px] leading-relaxed"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {action.preview.warning}
          </p>
        ) : null}
      </div>

      {done ? (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <p
            role="status"
            className="text-[13px] font-medium"
            style={{
              color: confirmState.error
                ? "var(--rf-red-text)"
                : "var(--rf-green-text)",
            }}
          >
            {confirmState.error ?? confirmState.message ?? cancelState.message}
          </p>

          {/*
           * Linkki tulokseen.
           *
           * Ilman tätä Matti sanoi "Valmis, lisäsin 25 ruokaa" eikä
           * kertonut mihin. Lista meni ensi viikolle, käyttäjä katsoi
           * kuluvaa viikkoa, ja joutui etsimään sen historiasta.
           */}
          {confirmState.ok && confirmState.href && confirmState.linkLabel ? (
            <Link
              href={confirmState.href}
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: "var(--rf-accent)" }}
            >
              {confirmState.linkLabel}
              <RfIcon name="chevron" size={13} />
            </Link>
          ) : null}
        </div>
      ) : (
        <div
          className="flex gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <form action={confirm}>
            <input type="hidden" name="actionId" value={action.id} />
            <ConfirmButton t={t} />
          </form>

          <form action={cancel}>
            <input type="hidden" name="actionId" value={action.id} />
            <Button type="submit" tone="ghost" size="sm">
              {t.matti.cancel}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfirmButton({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" size="sm" disabled={pending}>
      {pending ? t.matti.working : t.matti.approve}
    </Button>
  );
}

// ---------------------------------------------------------------------------

function Composer({
  t,
  onSend,
  busy,
  inputRef,
}: {
  onSend: (message: string) => void;
  busy: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  t: AdminText;
}) {
  const [value, setValue] = useState("");

  function submit() {
    if (value.trim() === "" || busy) return;
    onSend(value);
    setValue("");
  }

  const ready = value.trim() !== "" && !busy;

  return (
    <div
      className="shrink-0 border-t px-4 py-3"
      style={{
        borderColor: "var(--rf-line)",
        background: "var(--rf-card)",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="flex items-end gap-2 px-3 py-2"
        style={{
          background: "var(--rf-inset)",
          borderRadius: 14,
          minHeight: 48,
        }}
      >
        <label htmlFor="matti-input" className="sr-only">
          {t.matti.placeholder}
        </label>

        <textarea
          id="matti-input"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter lähettää, vaihto+Enter tekee rivinvaihdon. Sama
            // sopimus kuin muissa viestikentissä.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t.matti.shortPlaceholder}
          className="max-h-32 min-h-[2rem] w-full resize-none bg-transparent py-1 text-[15px] outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label={t.matti.send}
          className="rf-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] disabled:opacity-25"
          style={{
            background: ready ? "var(--rf-accent)" : "var(--rf-line-strong)",
            color: "var(--rf-on-accent)",
            transition: "background 160ms ease",
          }}
        >
          <span aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
            <RfIcon name="chevron" size={15} />
          </span>
        </button>
      </div>
    </div>
  );
}
