"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
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

interface Turn {
  role: "user" | "matti";
  text: string;
  steps?: Step[];
  actions?: PendingAction[];
}

const QUICK_ACTIONS = [
  { label: "Miten tämä kuukausi menee?", prompt: "Miten tämä kuukausi menee?" },
  { label: "Mihin rahat menivät?", prompt: "Mihin rahat menivät tässä kuussa?" },
  { label: "Tarkista budjetit", prompt: "Tarkista budjettien tilanne." },
  { label: "Ensi viikon lounas", prompt: "Onko ensi viikon lounaslista tehty?" },
];

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

      {open ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40"
            style={{ background: "rgba(17, 19, 24, 0.35)" }}
          />

          <div
            ref={container}
            role="dialog"
            aria-label="Matti, BUDet AI -työkaveri"
            className="rf-enter fixed inset-0 z-50 flex flex-col sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l"
            style={{
              background: "var(--rf-card)",
              borderColor: "var(--rf-line)",
              boxShadow: "var(--rf-shadow-lg)",
            }}
          >
            <Conversation currentPage={pathname} onClose={close} />
          </div>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

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
  const [error, setError] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (text === "" || busy) return;

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
          setError(payload.error ?? "Matti ei vastannut.");
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
          },
        ]);
      } catch {
        setError("En saanut yhteyttä Mattiin. Yritä hetken päästä uudelleen.");
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, currentPage],
  );

  return (
    <>
      <header
        className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: "var(--rf-accent)" }}>
            <RfIcon name="sparkle" size={20} />
          </span>
          <div>
            <p className="text-[15px] font-semibold">Matti</p>
            <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              BUDet AI -työkaveri
            </p>
          </div>
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <Welcome onPick={send} />
        ) : (
          <div className="space-y-4">
            {turns.map((turn, index) => (
              <TurnView key={index} turn={turn} />
            ))}
          </div>
        )}

        {busy ? (
          <p
            className="mt-4 flex items-center gap-2 text-[13px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            <span style={{ color: "var(--rf-accent)" }}>
              <RfIcon name="sparkle" size={14} />
            </span>
            Matti selvittää…
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed"
            style={{
              background: "var(--rf-red-bg)",
              color: "var(--rf-red-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {error}
          </p>
        ) : null}

        <div ref={bottom} />
      </div>

      <Composer onSend={send} busy={busy} inputRef={input} />
    </>
  );
}

function Welcome({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div>
      <p className="text-[15px] font-medium">Moi!</p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Voin hakea BUDetista lukuja ja valmistella muutoksia. Muutokset
        näytän sinulle ennen kuin mitään tapahtuu.
      </p>

      <p
        className="mt-5 text-[11px] font-semibold uppercase"
        style={{ color: "var(--rf-text-3)", letterSpacing: "0.05em" }}
      >
        Tee nopeasti
      </p>

      <div className="mt-2 space-y-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.prompt}
            type="button"
            onClick={() => onPick(action.prompt)}
            className="rf-press block w-full px-3.5 py-2.5 text-left text-[13px] font-medium"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p
          className="max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed"
          style={{
            background: "var(--rf-accent-bg)",
            color: "var(--rf-accent-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {turn.text}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/*
       * Työkalut näkyviin. Käyttäjän on voitava nähdä mihin vastaus
       * perustuu — "8 240 €" ilman lähdettä on väite, ei tieto.
       */}
      {turn.steps && turn.steps.length > 0 ? (
        <ul className="mb-2 space-y-0.5">
          {turn.steps.map((step, index) => (
            <li
              key={index}
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              <RfIcon name="check" size={11} />
              {TOOL_LABELS[step.tool] ?? step.tool}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{turn.text}</p>

      {turn.actions?.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
    </div>
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
  propose_lunch_price: "Valmisteli hinnanmuutoksen",
  propose_copy_lunch_week: "Valmisteli kopioinnin",
  propose_publish_lunch_week: "Valmisteli julkaisun",
};

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
      className="mt-3 px-4 py-3.5"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <p className="text-[13px] font-semibold">{action.preview.title}</p>

      <dl className="mt-2.5 space-y-1.5">
        {action.preview.changes.map((change, index) => (
          <div key={index} className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              {change.label}
            </dt>
            <dd className="rf-tabular text-[13px] font-medium">
              {change.from ? (
                <>
                  <span style={{ color: "var(--rf-text-3)", textDecoration: "line-through" }}>
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
          className="mt-2.5 px-3 py-2 text-[12px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {action.preview.warning}
        </p>
      ) : null}

      {done ? (
        <p
          role="status"
          className="mt-3 text-[13px] font-medium"
          style={{
            color: confirmState.error ? "var(--rf-red-text)" : "var(--rf-green-text)",
          }}
        >
          {confirmState.error ?? confirmState.message ?? cancelState.message}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
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

  return (
    <div
      className="shrink-0 border-t px-4 py-3"
      style={{
        borderColor: "var(--rf-line)",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="flex items-end gap-2 px-3 py-2"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        <label htmlFor="matti-input" className="sr-only">
          Kirjoita Matille
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
          placeholder="Kirjoita Matille…"
          className="max-h-32 min-h-[1.5rem] w-full resize-none bg-transparent text-[15px] outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim() === ""}
          aria-label="Lähetä"
          className="rf-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] disabled:opacity-30"
          style={{ background: "var(--rf-accent)", color: "var(--rf-on-accent)" }}
        >
          <span aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
            <RfIcon name="chevron" size={15} />
          </span>
        </button>
      </div>
    </div>
  );
}
