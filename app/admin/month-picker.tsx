"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { useCallback, useState, useTransition } from "react";
import { RfIcon } from "@/components/restoflow/icons";
import { pickedMonth } from "@/lib/restoflow/dates";
import { useDismiss } from "@/components/restoflow/use-dismiss";
import { formatMonth } from "@/lib/restoflow/expenses";

/**
 * Kuukauden valinta.
 *
 * Oma valikko natiivin selectin sijaan. Natiivi oli aluksi tarkoituksella
 * valittu — puhelimessa se avaa järjestelmän oman valitsimen — mutta
 * työpöydällä selain piirtää vaihtoehdot omalla tyylillään, eikä sitä voi
 * CSS:llä muuttaa. Lopputulos oli harmaa järjestelmävalikko keskellä
 * muuten yhtenäistä näkymää.
 *
 * Toteutus on listbox-kuvio: valittu kohta on merkitty myös
 * aria-selectedillä eikä pelkällä värillä, ja nuolinäppäimet liikkuvat
 * listassa. Ilman niitä oma valikko olisi näppäimistökäyttäjälle
 * huonompi kuin natiivi, ja ulkonäkö ei ole sen arvoinen.
 */
export function MonthPicker({
  value: fallback,
  months,
  locale,
}: {
  /** Kayttoliittyman kieli: kuukauden nimi tulee siita. */
  locale: AppLocale;
  /**
   * Kuluva kuukausi. Vara, ei valinta.
   *
   * Kuori antaa tämän, eikä kuori näe osoitteen hakuparametreja —
   * valinta luetaan siis osoitteesta pickedMonth-funktiolla.
   */
  value: string;
  months: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const value = pickedMonth(params.get("kuukausi"), fallback, months);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, months.indexOf(value)),
  );
  const [pending, startTransition] = useTransition();

  const close = useCallback(() => setOpen(false), []);
  const container = useDismiss<HTMLDivElement>(open, close);

  function select(month: string) {
    setOpen(false);

    const next = new URLSearchParams(params.toString());
    next.set("kuukausi", month);

    // useTransition pitää vanhan sisällön näkyvissä siirtymän ajan,
    // jottei näkymä välähdä tyhjäksi kuukautta vaihdettaessa.
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      // Alanuoli avaa listan, kuten natiivissa valitsimessa.
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        setOpen(true);
        setActive(Math.max(0, months.indexOf(value)));
      }
      return;
    }

    const last = months.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => Math.min(current + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        select(months[active]);
        break;
      default:
        break;
    }
  }

  /*
   * Askellus valitsimen rinnalla.
   *
   * Kulut-sivulla oli oma edellinen/seuraava-parinsa ja sen vieressä
   * yläpalkin valitsin — kaksi säädintä jotka näyttivät samaa
   * kuukautta. Askellus kuuluu samaan säätimeen kuin valinta, ja
   * silloin se on käytettävissä joka sivulla eikä vain yhdellä.
   *
   * Lista on uusin ensin, joten edellinen kuukausi on seuraava
   * alkio.
   */
  const index = months.indexOf(value);
  const older =
    index >= 0 && index < months.length - 1 ? months[index + 1] : null;
  const newer = index > 0 ? months[index - 1] : null;

  return (
    <div
      ref={container}
      className="relative flex items-center gap-1"
      onKeyDown={onKeyDown}
    >
      <StepButton
        label="Edellinen kuukausi"
        icon="back"
        month={older}
        onSelect={select}
      />

      <button
        type="button"
        onClick={() => {
          setActive(Math.max(0, months.indexOf(value)));
          setOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Kuukausi: ${formatMonth(value, locale)}`}
        // Kiinteä korkeus eikä pehmuste: askelnapit ovat 40 px, ja
        // pehmusteesta laskettu korkeus jäi kolme pikseliä suuremmaksi.
        // Ero näkyi rivissä epätasaisuutena.
        className="rf-press flex h-10 items-center gap-2 pl-3 pr-2.5 text-[14px] font-medium"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text)",
          border: `1px solid ${open ? "var(--rf-accent)" : "var(--rf-line)"}`,
          borderRadius: "var(--rf-r-control)",
          opacity: pending ? 0.6 : 1,
          transition: "opacity 160ms ease, border-color 160ms ease",
        }}
      >
        <span style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name="calendar" size={16} />
        </span>

        <span className="whitespace-nowrap">{formatMonth(value, locale)}</span>

        <span
          aria-hidden="true"
          style={{
            color: "var(--rf-text-3)",
            display: "block",
            transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform 160ms ease",
          }}
        >
          <RfIcon name="chevron" size={14} />
        </span>
      </button>

      <StepButton
        label="Seuraava kuukausi"
        icon="chevron"
        month={newer}
        onSelect={select}
      />

      {open ? (
        <ul
          role="listbox"
          aria-label="Kuukausi"
          className="rf-enter absolute right-0 top-[calc(100%+8px)] z-40 max-h-[19rem] w-52 overflow-y-auto p-1.5"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          {months.map((month, index) => {
            const selected = month === value;
            const highlighted = index === active;

            return (
              <li key={month}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => select(month)}
                  className="rf-press flex w-full items-center justify-between gap-3 rounded-[9px] px-3 py-2.5 text-left text-[14px]"
                  onMouseEnter={() => setActive(index)}
                  style={{
                    background: selected
                      ? "var(--rf-accent-bg)"
                      : highlighted
                        ? "var(--rf-inset)"
                        : "transparent",
                    color: selected
                      ? "var(--rf-accent-strong)"
                      : "var(--rf-text)",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {formatMonth(month, locale)}

                  {/* Valinta ei näy pelkkänä värinä. */}
                  {selected ? <RfIcon name="check" size={15} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Askelnappi kuukaudesta toiseen.
 *
 * Poissa käytöstä eikä piilossa: nappi joka katoaa listan päässä
 * siirtäisi viereisiä painikkeita, ja rivi hyppäisi joka kerta kun
 * reunaan osuu.
 */
function StepButton({
  label,
  icon,
  month,
  onSelect,
}: {
  label: string;
  icon: "back" | "chevron";
  month: string | null;
  onSelect: (month: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => month && onSelect(month)}
      disabled={month === null}
      aria-label={label}
      title={label}
      className="rf-press flex h-10 w-9 shrink-0 items-center justify-center disabled:opacity-35"
      style={{
        background: "var(--rf-card)",
        color: "var(--rf-text-2)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name={icon} size={15} />
    </button>
  );
}
