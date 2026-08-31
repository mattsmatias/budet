"use client";

/**
 * Tallennus Tiedostoihin, mistä tahansa Katen näkymästä.
 *
 * Yksi painike ja yksi kansiovalinta. Sama komponentti raporteille,
 * kuiteille ja kaikelle mitä Kate myöhemmin tuottaa — tallennettava
 * asia annetaan funktiona, joten tämä ei tiedä mitään raporteista eikä
 * kuiteista.
 *
 * ---------------------------------------------------------------------
 * KANSIOT HAETAAN VASTA AVATTAESSA
 * ---------------------------------------------------------------------
 *
 * Painike voi olla listassa kaksitoista kertaa. Kansiolistan hakeminen
 * jokaiselle valmiiksi olisi kaksitoista kyselyä sivunlatausta kohden,
 * ja käyttäjä avaa niistä yhden tai ei yhtään.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminText } from "@/lib/i18n/admin-text";
import { RfIcon } from "./icons";
import { Button } from "./ui";
import {
  folderChoices,
  saveReceiptToFiles,
  saveReportToFiles,
  type FolderChoice,
} from "@/app/admin/tiedostot/save-actions";
import type { ReportFormat } from "@/lib/restoflow/report-file";
import type { ReportKind } from "@/lib/restoflow/report-rows";

/**
 * Mitä ollaan tallentamassa.
 *
 * Kuvaus eikä funktio: palvelinkomponentti ei voi välittää funktiota
 * klientille, ja juuri palvelinkomponenteista tämä painike lisätään.
 * Uusi lähde on uusi vaihtoehto tähän ja uusi haara alla — ei uusi
 * komponentti.
 */
export type SaveSource =
  | {
      kind: "report";
      /** null = koko kuukausi yhtenä työkirjana. */
      reportKind: ReportKind | null;
      month: string;
      format: ReportFormat;
    }
  | { kind: "receipt"; receiptId: string };

export function SaveToFiles({
  t,
  label,
  title,
  source,
  size = "sm",
}: {
  t: AdminText;
  /** Painikkeen teksti. Lyhyt rivillä, pidempi omana toimintonaan. */
  label?: string;
  /** Mitä ollaan tallentamassa — näkyy dialogissa. */
  title: string;
  source: SaveSource;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<FolderChoice[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    dialog.current?.showModal();

    let voimassa = true;
    void folderChoices().then((list) => {
      if (voimassa) setChoices(list);
    });

    return () => {
      voimassa = false;
    };
  }, [open]);

  function close(): void {
    setOpen(false);
    setError(null);
    setDone(null);
  }

  return (
    <>
      <Button
        tone="ghost"
        size={size}
        type="button"
        onClick={() => setOpen(true)}
        icon={<RfIcon name="folder" size={15} />}
      >
        {label ?? t.tiedosto.title}
      </Button>

      {open ? (
        <dialog
          ref={dialog}
          onClose={close}
          onCancel={close}
          className="rf-enter m-auto max-h-[85dvh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto p-0 backdrop:bg-black/40"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          <div className="space-y-3 p-4">
            <h2 className="text-[16px] font-bold">{t.tiedosto.savedTo}</h2>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {title}
            </p>

            {done ? (
              <p
                className="px-3 py-2 text-[13px] font-medium"
                style={{
                  background: "var(--rf-green-bg)",
                  color: "var(--rf-green-text)",
                  borderRadius: "var(--rf-r-card)",
                }}
              >
                {done}
              </p>
            ) : (
              <label className="block">
                <span className="text-[13px] font-semibold">
                  {t.tiedosto.changeFolder}
                </span>
                <select
                  value={target ?? ""}
                  disabled={choices === null}
                  onChange={(event) => setTarget(event.target.value || null)}
                  className="mt-1 h-[42px] w-full px-2 text-[14px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    border: "1px solid var(--rf-line)",
                    borderRadius: "var(--rf-r-field)",
                    color: "var(--rf-text)",
                  }}
                >
                  <option value="">{t.tiedosto.root}</option>
                  {(choices ?? []).map((choice) => (
                    <option key={choice.id ?? "root"} value={choice.id ?? ""}>
                      {choice.path}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error ? (
              <p className="text-[13px]" style={{ color: "var(--rf-red-text)" }}>
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button tone="ghost" type="button" onClick={close}>
                {t.tiedosto.cancel}
              </Button>

              {done ? null : (
                <Button
                  tone="primary"
                  type="button"
                  disabled={busy || choices === null}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const result =
                        source.kind === "report"
                          ? await saveReportToFiles({
                              kind: source.reportKind,
                              month: source.month,
                              format: source.format,
                              folderId: target,
                            })
                          : await saveReceiptToFiles({
                              receiptId: source.receiptId,
                              folderId: target,
                            });

                      if (result.error) {
                        setError(result.error);
                        return;
                      }

                      /*
                       * Vahvistus jää näkyviin eikä dialogi sulkeudu itsestään.
                       *
                       * Tallennus vie tiedoston toiselle sivulle, joten
                       * ilman vahvistusta käyttäjä ei näe mitään
                       * tapahtuneen ja tallentaa uudelleen.
                       */
                      setDone(result.notice ?? t.tiedosto.title);
                      router.refresh();
                    })
                  }
                >
                  {busy ? t.tiedosto.uploading : t.tiedosto.save}
                </Button>
              )}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
