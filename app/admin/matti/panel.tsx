"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
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

export function MattiPanel({ enabled }: { enabled: boolean }) {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="rf-press flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span style={{ color: "var(--rf-accent)" }}>
          <RfIcon name="sparkle" size={19} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium" style={{ color: "var(--rf-text)" }}>
            Matti
          </span>
          <span className="block text-[11px]" style={{ color: "var(--rf-text-3)" }}>
            BUDet AI
          </span>
        </span>

        <kbd
          className="hidden shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium lg:block"
          style={{ background: "var(--rf-inset)", color: "var(--rf-text-3)" }}
        >
          ⌘J
        </kbd>
      </button>

      {open ? <Overlay container={container} pathname={pathname} close={close} /> : null}
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
}: {
  container: React.RefObject<HTMLDivElement | null>;
  pathname: string;
  close: () => void;
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
        aria-label="Matti, BUDet AI -työkaveri"
        className="rf-z-panel rf-enter fixed inset-0 flex flex-col sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l"
        style={{
          background: "var(--rf-card)",
          borderColor: "var(--rf-line)",
          boxShadow: "var(--rf-shadow-lg)",
        }}
      >
        <Conversation currentPage={pathname} onClose={close} />
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
}: {
  currentPage: string;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; retryable: boolean } | null>(
    null,
  );
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
            text: payload.error ?? "En saanut tällä kertaa vastausta.",
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
        setError({ text: "En saanut tällä kertaa vastausta.", retryable: true });
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, currentPage],
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
          <p className="text-[15px] font-semibold">Matti</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Sulje Matti"
          className="rf-press rf-icon-btn flex h-9 w-9 items-center justify-center rounded-[9px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={18} />
        </button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {turns.length === 0 ? (
          <Welcome currentPage={currentPage} onPick={send} />
        ) : (
          <div className="space-y-6">
            {turns.map((turn, index) => (
              <TurnView key={index} turn={turn} />
            ))}
          </div>
        )}

        {busy ? <Working /> : null}

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
                Yritä uudelleen
              </Button>
            ) : null}
          </div>
        ) : null}

        <div ref={bottom} />
      </div>

      <Composer onSend={send} busy={busy} inputRef={input} />
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
function Working() {
  return (
    <p
      className="mt-5 flex items-center gap-2 text-[13px]"
      style={{ color: "var(--rf-text-3)" }}
    >
      <span className="rf-thinking" style={{ color: "var(--rf-accent)" }}>
        <RfIcon name="sparkle" size={14} />
      </span>
      Matti selvittää…
    </p>
  );
}

// ---------------------------------------------------------------------------

/**
 * Pikatoiminnot sen mukaan missä käyttäjä on.
 *
 * Lounassivulla lounas on ensimmäisenä. Se ei ole älykkyyttä vaan
 * kohteliaisuutta: jos ihminen katsoo lounaslistaa, hän ei ensimmäisenä
 * halua tarkistaa budjettia.
 */
function quickActions(currentPage: string): { label: string; prompt: string }[] {
  const lunch = {
    label: "Tee ensi viikon lounaslista",
    prompt: "Tee ensi viikon lounaslista.",
  };
  const expenses = {
    label: "Analysoi tämän kuun kulut",
    prompt: "Analysoi tämän kuun kulut.",
  };
  const budgets = { label: "Tarkista budjetit", prompt: "Tarkista budjettien tilanne." };
  const receipts = {
    label: "Käsittele kuitit",
    prompt: "Onko käsittelemättömiä kuitteja?",
  };
  const report = {
    label: "Tee kuukausiraportti",
    prompt: "Tiivistä tämän kuukauden talous.",
  };

  if (currentPage.startsWith("/admin/lounas")) {
    return [lunch, expenses, budgets, receipts];
  }
  if (currentPage.startsWith("/admin/kuitit")) {
    return [receipts, expenses, budgets, lunch];
  }
  if (currentPage.startsWith("/admin/budjetit")) {
    return [budgets, expenses, report, lunch];
  }
  if (currentPage.startsWith("/admin/raportit")) {
    return [report, expenses, budgets, lunch];
  }

  return [expenses, budgets, lunch, receipts, report];
}

function Welcome({
  currentPage,
  onPick,
}: {
  currentPage: string;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="pt-6">
      <span style={{ color: "var(--rf-accent)" }}>
        <RfIcon name="sparkle" size={26} />
      </span>

      <h2 className="mt-3 text-[19px] font-semibold tracking-tight">Matti</h2>
      <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        BUDet AI -työkaveri
      </p>

      <p className="mt-3 max-w-sm text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Voin auttaa sinua hoitamaan BUDetissa asioita. Muutokset näytän
        sinulle ennen kuin mitään tapahtuu.
      </p>

      <div className="mt-6 space-y-1.5">
        {quickActions(currentPage).map((action) => (
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
  );
}

// ---------------------------------------------------------------------------

function TurnView({ turn }: { turn: Turn }) {
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
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{turn.text}</p>

      {turn.cards?.map((card, index) => (
        <DataCard key={index} card={card} />
      ))}

      {turn.actions?.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}

      {turn.steps && turn.steps.length > 0 ? <Steps steps={turn.steps} /> : null}
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
function Steps({ steps }: { steps: Step[] }) {
  return (
    <details className="mt-3">
      <summary
        className="cursor-pointer list-none text-[12px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        Katso miten Matti selvitti tämän
      </summary>

      <ul className="mt-2 space-y-1">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            <span className="mt-0.5 shrink-0">
              <RfIcon name="check" size={11} />
            </span>
            {TOOL_LABELS[step.tool] ?? step.tool}
          </li>
        ))}
      </ul>
    </details>
  );
}

const TOOL_LABELS: Record<string, string> = {
  get_dashboard_summary: "Haki kuukauden yhteenvedon",
  get_expenses_by_category: "Haki kulut kategorioittain",
  get_top_suppliers: "Haki suurimmat toimittajat",
  search_receipts: "Haki kuitit",
  get_budget_status: "Tarkisti budjetit",
  get_lunch_week: "Haki lounasviikon",
  get_staff: "Haki työntekijät",
  get_shifts: "Haki työvuorot",
  propose_lunch_items: "Valmisteli lounaslistan",
  propose_lunch_price: "Valmisteli hinnanmuutoksen",
  propose_copy_lunch_week: "Valmisteli kopioinnin",
  propose_publish_lunch_week: "Valmisteli julkaisun",
};

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
function ActionCard({ action }: { action: PendingAction }) {
  const [confirmState, confirm] = useActionState(confirmMattiAction, initialAction);
  const [cancelState, cancel] = useActionState(cancelMattiAction, initialAction);
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
                    <span aria-hidden="true" style={{ color: "var(--rf-text-3)" }}>
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
        <p
          role="status"
          className="border-t px-4 py-3 text-[13px] font-medium"
          style={{
            borderColor: "var(--rf-line)",
            color: confirmState.error ? "var(--rf-red-text)" : "var(--rf-green-text)",
          }}
        >
          {confirmState.error ?? confirmState.message ?? cancelState.message}
        </p>
      ) : (
        <div
          className="flex gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <form action={confirm}>
            <input type="hidden" name="actionId" value={action.id} />
            <ConfirmButton />
          </form>

          <form action={cancel}>
            <input type="hidden" name="actionId" value={action.id} />
            <Button type="submit" tone="ghost" size="sm">
              Peruuta
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" size="sm" disabled={pending}>
      {pending ? "Tehdään…" : "Hyväksy"}
    </Button>
  );
}

// ---------------------------------------------------------------------------

function Composer({
  onSend,
  busy,
  inputRef,
}: {
  onSend: (message: string) => void;
  busy: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
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
          Kysy Matilta tai pyydä tekemään jotain
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
          placeholder="Kysy Matilta tai pyydä tekemään jotain…"
          className="max-h-32 min-h-[2rem] w-full resize-none bg-transparent py-1 text-[15px] outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label="Lähetä"
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
