import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { CountUp } from "@/components/restoflow/count-up";
import { Sparkline } from "@/components/restoflow/dashboard-ui";

/**
 * Kuukauden pääluku.
 *
 * Tumma kortti, ja se on ainoa tumma pinta koko näkymässä. Se on
 * hierarkia eikä koriste: yleiskuvassa on kahdeksan lukua, ja yhden on
 * oltava se joka nähdään ensin.
 *
 * KAKSI TOIMINTOA, EI VALIKKOA.
 *
 * Kuitin lisääminen ja kulujen avaaminen ovat ne kaksi asiaa joita
 * tästä luvusta seuraa. Kolmas painike tekisi kortista työkalupalkin,
 * ja neljäs siitä valikon.
 */
export function Hero({
  label,
  cents,
  delta,
  deltaTone,
  footnote,
  trend,
  canAddReceipt,
}: {
  label: string;
  cents: number;
  /** "+12,4 %" tai null kun vertailukohtaa ei ole. */
  delta: string | null;
  deltaTone: "up" | "down" | "flat";
  /** Vertailulause pienellä luvun alla. */
  footnote: string;
  /** Kuukausien kehitys. Null kun historiaa ei ole tarpeeksi. */
  trend: number[] | null;
  canAddReceipt: boolean;
}) {
  return (
    <section
      aria-label={label}
      className="relative overflow-hidden px-6 py-6 sm:px-7 sm:py-7"
      style={{
        background: "var(--rf-ink)",
        color: "#fff",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.62)" }}>
            {label}
          </p>

          <p className="rf-tabular mt-2 text-[32px] font-extrabold leading-none tracking-[-0.03em] sm:text-[38px]">
            <CountUp to={cents} format="money" />
          </p>

          <p className="mt-2.5 text-[12.5px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            {footnote}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          {trend ? (
            <Sparkline values={trend} width={116} height={38} stroke="rgba(255,255,255,0.72)" />
          ) : null}

          {delta ? (
          <span
            className="rf-tabular inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-[12px] font-bold"
            style={{
              /*
               * Kulujen kasvu ei ole hyvä eikä huono ilman kontekstia,
               * joten neutraali on läpikuultava valkoinen. Vihreä
               * laskeville kuluille olisi arvostelma jota ohjelma ei voi
               * tehdä.
               */
              background:
                deltaTone === "up"
                  ? "rgba(245,158,11,0.22)"
                  : deltaTone === "down"
                    ? "rgba(22,163,106,0.24)"
                    : "rgba(255,255,255,0.14)",
              color:
                deltaTone === "up"
                  ? "#ffd79a"
                  : deltaTone === "down"
                    ? "#8ceec1"
                    : "rgba(255,255,255,0.8)",
              borderRadius: "var(--rf-r-pill)",
            }}
          >
            {deltaTone === "up" ? "↑" : deltaTone === "down" ? "↓" : ""} {delta}
          </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {canAddReceipt ? (
          <Link
            href="/admin/kuitit/uusi"
            className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-bold"
            style={{ background: "#fff", color: "var(--rf-ink)", borderRadius: "var(--rf-r-pill)" }}
          >
            <RfIcon name="plus" size={15} />
            Lisää kuitti
          </Link>
        ) : null}

        <Link
          href="/admin/kulut"
          className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-bold"
          style={{
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            borderRadius: "var(--rf-r-pill)",
          }}
        >
          <RfIcon name="expenses" size={15} />
          Avaa kulut
        </Link>
      </div>
    </section>
  );
}
