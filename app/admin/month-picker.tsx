"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { RfIcon } from "@/components/restoflow/icons";
import { useDismiss } from "@/components/restoflow/use-dismiss";

const MONTH_NAMES = [
  "Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
  "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu",
];

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
  value,
  months,
}: {
  value: string;
  months: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, months.indexOf(value)));
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

  return (
    <div ref={container} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => {
          setActive(Math.max(0, months.indexOf(value)));
          setOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Kuukausi: ${formatMonth(value)}`}
        className="rf-press flex items-center gap-2 py-2 pl-3 pr-2.5 text-[14px] font-medium"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text)",
          border: `1px solid ${open ? "var(--rf-accent)" : "var(--rf-line)"}`,
          borderRadius: "var(--rf-r-control)",
          minHeight: 40,
          opacity: pending ? 0.6 : 1,
          transition: "opacity 160ms ease, border-color 160ms ease",
        }}
      >
        <span style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name="calendar" size={16} />
        </span>

        <span className="whitespace-nowrap">{formatMonth(value)}</span>

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

      {open ? (
        <ul
          role="listbox"
          aria-label="Kuukausi"
          className="rf-enter absolute right-0 z-40 mt-2 max-h-[19rem] w-52 overflow-y-auto p-1.5"
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
                    color: selected ? "var(--rf-accent-strong)" : "var(--rf-text)",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {formatMonth(month)}

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

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${year}`;
}
