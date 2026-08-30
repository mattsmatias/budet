"use client";

/**
 * Tiedostokaapin selain.
 *
 * Yksi lista, jossa kansiot ovat ensin ja tiedostot perässä. Kortteja
 * ei ole: kaapissa on satoja tiedostoja, ja jokainen niistä omana
 * korttinaan olisi näkymä jota joutuu vierittämään löytääkseen sen
 * mikä listassa näkyisi kerralla.
 *
 * ---------------------------------------------------------------------
 * RAAHAUS ON TYÖPÖYDÄN TAPA, VALIKKO PUHELIMEN
 * ---------------------------------------------------------------------
 *
 * Raahaus käyttää selaimen omaa vetotapahtumaa. Se ei toimi
 * kosketuksella — mikä on tässä oikein, koska pitkä painallus ja veto
 * pienellä ruudulla osuisi väärään riviin useammin kuin oikeaan.
 * Puhelimessa sama asia tehdään rivin valikon Siirrä-kohdasta, ja se
 * on molemmilla laitteilla saatavilla.
 *
 * Sama vetotapahtuma ottaa vastaan myös käyttöjärjestelmästä pudotetut
 * tiedostot: niiden pudottaminen kansioon lataa ne sinne.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import {
  checkFile,
  fileKind,
  folderPath,
  formatFileSize,
  isPreviewable,
  mimeFor,
  movableTargets,
  type FileRow,
  type FileSort,
  type FolderRow,
  type FolderSort,
} from "@/lib/restoflow/files";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import { Button, EmptyState } from "@/components/restoflow/ui";
import { useDismiss } from "@/components/restoflow/use-dismiss";
import { createClient } from "@/utils/supabase/client";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  fileUrl,
  moveFile,
  moveFolder,
  registerFile,
  renameFile,
  renameFolder,
  toggleFavorite,
} from "./actions";

type View = "all" | "favorites" | "recent" | "search";

interface Props {
  t: AdminText;
  /** Intl-tunniste lajitteluun ja kokoihin. */
  tag: string;
  canManage: boolean;
  restaurantId: string;
  folderId: string | null;
  folders: FolderRow[];
  visibleFolders: FolderRow[];
  files: FileRow[];
  view: View;
  term: string;
  fileSort: FileSort;
  folderSort: FolderSort;
}

/** Raahattavana oleva kohde. */
type Dragged =
  | { kind: "folder"; id: string }
  | { kind: "file"; id: string }
  | null;

const KIND_ICONS: Record<string, IconName> = {
  pdf: "file",
  doc: "file",
  sheet: "sales",
  image: "image",
  text: "file",
  other: "file",
};

export function FileBrowser(props: Props) {
  const { t, tag, canManage, files, view, visibleFolders } = props;
  const router = useRouter();

  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<Dragged>(null);
  const [over, setOver] = useState<string | null>(null);

  /* Dialogit. Yksi kerrallaan, joten yksi tila riittää. */
  const [dialog, setDialog] = useState<
    | { type: "newFolder" }
    | { type: "upload"; folderId: string | null; initial: File[] }
    | { type: "renameFolder"; folder: FolderRow }
    | { type: "renameFile"; file: FileRow }
    | { type: "move"; kind: "folder" | "file"; id: string; name: string }
    | { type: "deleteFolder"; folder: FolderRow }
    | null
  >(null);

  function run(action: () => Promise<{ error?: string }>): void {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  /*
   * Kansion sisältö rekursiivisesti.
   *
   * Poistodialogi kysyy tiedostoista vain jos niitä on — myös
   * alikansioissa. Puu on jo selaimessa, joten tätä ei kysytä
   * kannalta erikseen.
   */
  function contentsOf(folderId: string): number {
    let total = 0;
    const queue = [folderId];

    while (queue.length > 0) {
      const id = queue.pop() as string;
      const folder = props.folders.find((f) => f.id === id);
      if (folder) total += folder.fileCount;
      for (const child of props.folders) {
        if (child.parentId === id) queue.push(child.id);
      }
    }

    return total;
  }

  // -------------------------------------------------------------------------
  // Raahaus
  // -------------------------------------------------------------------------

  function dropOn(targetFolderId: string | null, event: React.DragEvent): void {
    event.preventDefault();
    setOver(null);

    /* Käyttöjärjestelmästä pudotetut tiedostot: lataus tähän kansioon. */
    if (event.dataTransfer.files.length > 0) {
      setDialog({
        type: "upload",
        folderId: targetFolderId,
        initial: Array.from(event.dataTransfer.files),
      });
      return;
    }

    const item = dragged;
    setDragged(null);
    if (!item) return;

    if (item.kind === "file") {
      run(() => moveFile(item.id, targetFolderId));
      return;
    }

    /* Kansiota ei raahata itseensä — kanta estäisi tämän joka tapauksessa. */
    if (item.id === targetFolderId) return;
    run(() => moveFolder(item.id, targetFolderId));
  }

  const empty = visibleFolders.length === 0 && files.length === 0;

  return (
    <div className="space-y-3">
      {canManage ? (
        <Toolbar
          t={t}
          busy={busy}
          fileSort={props.fileSort}
          folderSort={props.folderSort}
          folderId={props.folderId}
          showSort={view === "all"}
          onNewFolder={() => setDialog({ type: "newFolder" })}
          onUpload={() =>
            setDialog({ type: "upload", folderId: props.folderId, initial: [] })
          }
        />
      ) : null}

      {error ? (
        <p
          className="px-3 py-2 text-[13px] font-medium"
          style={{
            background: "var(--rf-red-soft)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-card)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {empty ? (
        <EmptyState
          title={
            view === "search"
              ? `${t.tiedosto.noResults} "${props.term}"`
              : view === "favorites"
                ? t.tiedosto.tabFavorites
                : view === "recent"
                  ? t.tiedosto.tabRecent
                  : t.tiedosto.emptyFolder
          }
          description={
            view === "favorites"
              ? t.tiedosto.emptyFavorites
              : view === "recent"
                ? t.tiedosto.emptyRecent
                : view === "search"
                  ? ""
                  : t.tiedosto.emptyFolder
          }
        />
      ) : (
        <ul
          className="overflow-hidden"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
          }}
          onDragOver={(event) => {
            if (canManage) event.preventDefault();
          }}
          onDrop={(event) => {
            if (canManage) dropOn(props.folderId, event);
          }}
        >
          {visibleFolders.map((folder) => (
            <FolderRowItem
              key={folder.id}
              t={t}
              folder={folder}
              canManage={canManage}
              highlighted={over === folder.id}
              onDragStart={() => setDragged({ kind: "folder", id: folder.id })}
              onDragEnd={() => {
                setDragged(null);
                setOver(null);
              }}
              onDragOver={(event) => {
                if (!canManage) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(folder.id);
              }}
              onDragLeave={() => setOver((id) => (id === folder.id ? null : id))}
              onDrop={(event) => {
                event.stopPropagation();
                dropOn(folder.id, event);
              }}
              onRename={() => setDialog({ type: "renameFolder", folder })}
              onMove={() =>
                setDialog({
                  type: "move",
                  kind: "folder",
                  id: folder.id,
                  name: folder.name,
                })
              }
              onDelete={() => setDialog({ type: "deleteFolder", folder })}
            />
          ))}

          {files.map((file) => (
            <FileRowItem
              key={file.id}
              t={t}
              tag={tag}
              file={file}
              canManage={canManage}
              showPath={view !== "all"}
              onDragStart={() => setDragged({ kind: "file", id: file.id })}
              onDragEnd={() => setDragged(null)}
              onRename={() => setDialog({ type: "renameFile", file })}
              onMove={() =>
                setDialog({
                  type: "move",
                  kind: "file",
                  id: file.id,
                  name: file.name,
                })
              }
              onFavorite={() => run(() => toggleFavorite(file.id, !file.isFavorite))}
              onDelete={() => {
                if (confirm(t.tiedosto.deleteFileConfirm)) {
                  run(() => deleteFile(file.id));
                }
              }}
            />
          ))}
        </ul>
      )}

      {/* --- Dialogit ------------------------------------------------------ */}

      {dialog?.type === "newFolder" ? (
        <NewFolderDialog
          t={t}
          folders={props.folders}
          folderId={props.folderId}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      ) : null}

      {dialog?.type === "upload" ? (
        <UploadDialog
          t={t}
          tag={tag}
          restaurantId={props.restaurantId}
          folders={props.folders}
          folderId={dialog.folderId}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      ) : null}

      {dialog?.type === "renameFolder" ? (
        <RenameDialog
          t={t}
          title={t.tiedosto.rename}
          label={t.tiedosto.folderName}
          value={dialog.folder.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            const form = new FormData();
            form.set("id", dialog.folder.id);
            form.set("name", name);
            run(() => renameFolder({}, form));
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "renameFile" ? (
        <RenameDialog
          t={t}
          title={t.tiedosto.rename}
          label={t.tiedosto.rename}
          value={dialog.file.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            const form = new FormData();
            form.set("id", dialog.file.id);
            form.set("name", name);
            run(() => renameFile({}, form));
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "move" ? (
        <MoveDialog
          t={t}
          folders={props.folders}
          name={dialog.name}
          excludeFolderId={dialog.kind === "folder" ? dialog.id : null}
          onClose={() => setDialog(null)}
          onPick={(targetId) => {
            const { kind, id } = dialog;
            run(() =>
              kind === "folder" ? moveFolder(id, targetId) : moveFile(id, targetId),
            );
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "deleteFolder" ? (
        <DeleteFolderDialog
          t={t}
          folder={dialog.folder}
          contents={contentsOf(dialog.folder.id)}
          onClose={() => setDialog(null)}
          onConfirm={(mode) => {
            run(() => deleteFolder(dialog.folder.id, mode));
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Työkalurivi
// ---------------------------------------------------------------------------

function Toolbar({
  t,
  busy,
  fileSort,
  folderSort,
  folderId,
  showSort,
  onNewFolder,
  onUpload,
}: {
  t: AdminText;
  busy: boolean;
  fileSort: FileSort;
  folderSort: FolderSort;
  folderId: string | null;
  showSort: boolean;
  onNewFolder: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        tone="secondary"
        size="sm"
        onClick={onNewFolder}
        disabled={busy}
        icon={<RfIcon name="plus" size={15} />}
      >
        {t.tiedosto.newFolder}
      </Button>

      <Button
        tone="primary"
        size="sm"
        onClick={onUpload}
        disabled={busy}
        icon={<RfIcon name="download" size={15} />}
      >
        {t.tiedosto.upload}
      </Button>

      {showSort ? (
        <SortMenu
          t={t}
          fileSort={fileSort}
          folderSort={folderSort}
          folderId={folderId}
        />
      ) : null}
    </div>
  );
}

/**
 * Lajittelu osoitteen kautta.
 *
 * Linkkejä eikä painikkeita: valinta säilyy kun sivu ladataan
 * uudelleen, ja lajiteltuun näkymään voi linkittää.
 */
function SortMenu({
  t,
  fileSort,
  folderSort,
  folderId,
}: {
  t: AdminText;
  fileSort: FileSort;
  folderSort: FolderSort;
  folderId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const box = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  function href(next: { jarjesta?: FileSort; kansiot?: FolderSort }): string {
    const params = new URLSearchParams();
    if (folderId) params.set("kansio", folderId);
    params.set("jarjesta", next.jarjesta ?? fileSort);
    params.set("kansiot", next.kansiot ?? folderSort);
    return `/admin/tiedostot?${params.toString()}`;
  }

  const files: [FileSort, string][] = [
    ["name", t.tiedosto.sortName],
    ["added", t.tiedosto.sortAdded],
    ["modified", t.tiedosto.sortModified],
    ["type", t.tiedosto.sortType],
    ["size", t.tiedosto.sortSize],
  ];

  const folders: [FolderSort, string][] = [
    ["custom", t.tiedosto.sortCustom],
    ["name", t.tiedosto.sortName],
    ["newest", t.tiedosto.sortNewest],
    ["oldest", t.tiedosto.sortOldest],
  ];

  return (
    <div ref={box} className="relative ml-auto">
      <Button
        tone="ghost"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t.tiedosto.sort}
      </Button>

      {open ? (
        <div
          role="menu"
          className="rf-enter absolute right-0 z-40 mt-2 w-56 overflow-hidden py-1"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          <MenuLabel>{t.tiedosto.title}</MenuLabel>
          {files.map(([key, label]) => (
            <MenuLink key={key} href={href({ jarjesta: key })} on={key === fileSort}>
              {label}
            </MenuLink>
          ))}

          <MenuLabel>{t.tiedosto.newFolder}</MenuLabel>
          {folders.map(([key, label]) => (
            <MenuLink key={key} href={href({ kansiot: key })} on={key === folderSort}>
              {label}
            </MenuLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide"
      style={{ color: "var(--rf-text-3)" }}
    >
      {children}
    </p>
  );
}

function MenuLink({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center justify-between px-3 py-2 text-[13.5px]"
      style={{ color: on ? "var(--rf-accent)" : "var(--rf-text)" }}
    >
      {children}
      {on ? <RfIcon name="check" size={14} /> : null}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Rivit
// ---------------------------------------------------------------------------

function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const box = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="rf-press flex h-9 w-9 items-center justify-center"
        style={{ borderRadius: "50%", color: "var(--rf-text-2)" }}
      >
        <RfIcon name="more" size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          className="rf-enter absolute right-0 z-40 mt-1 w-52 overflow-hidden py-1"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full px-3 py-2 text-left text-[13.5px]"
              style={{
                color: item.danger ? "var(--rf-red-text)" : "var(--rf-text)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FolderRowItem({
  t,
  folder,
  canManage,
  highlighted,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onRename,
  onMove,
  onDelete,
}: {
  t: AdminText;
  folder: FolderRow;
  canManage: boolean;
  highlighted: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const count =
    folder.fileCount === 0
      ? t.tiedosto.emptyLabel
      : folder.fileCount === 1
        ? t.tiedosto.oneFile
        : fill(t.tiedosto.fileCount, { maara: String(folder.fileCount) });

  return (
    <li
      draggable={canManage}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex items-center gap-3 px-3"
      style={{
        borderBottom: "1px solid var(--rf-line)",
        /* Korostus kertoo mihin pudotus osuu — ilman sitä veto on arvailua. */
        background: highlighted ? "var(--rf-inset)" : "transparent",
        outline: highlighted ? "2px solid var(--rf-accent)" : "none",
        outlineOffset: "-2px",
      }}
    >
      <Link
        href={`/admin/tiedostot?kansio=${folder.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3"
      >
        <span style={{ color: "var(--rf-accent)" }}>
          <RfIcon name="folder" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold">
            {folder.name}
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {count}
          </span>
        </span>
      </Link>

      {canManage ? (
        <RowMenu
          label={folder.name}
          items={[
            { label: t.tiedosto.rename, onClick: onRename },
            { label: t.tiedosto.move, onClick: onMove },
            { label: t.tiedosto.remove, onClick: onDelete, danger: true },
          ]}
        />
      ) : null}
    </li>
  );
}

function FileRowItem({
  t,
  tag,
  file,
  canManage,
  showPath,
  onDragStart,
  onDragEnd,
  onRename,
  onMove,
  onFavorite,
  onDelete,
}: {
  t: AdminText;
  tag: string;
  file: FileRow;
  canManage: boolean;
  showPath: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRename: () => void;
  onMove: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  const [opening, setOpening] = useState(false);

  /**
   * Avaus hakee osoitteen vasta klikattaessa.
   *
   * Bucket on yksityinen, joten jokainen avaus tarvitsee oman
   * allekirjoitetun osoitteen. Sadan rivin listalle niitä ei luoda
   * valmiiksi — käyttäjä avaa yhden.
   */
  async function open(download: boolean): Promise<void> {
    setOpening(true);
    const url = await fileUrl(file.id);
    setOpening(false);
    if (!url) return;

    if (download) {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const kind = fileKind(file.type, file.name);

  return (
    <li
      draggable={canManage}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-3 px-3"
      style={{ borderBottom: "1px solid var(--rf-line)" }}
    >
      <button
        type="button"
        onClick={() => void open(false)}
        disabled={opening}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
      >
        <span style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name={KIND_ICONS[kind] ?? "file"} size={20} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium">
            {file.name}
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {showPath && file.folderPath !== undefined
              ? `${t.tiedosto.location}: ${file.folderPath || t.tiedosto.root} · ${formatFileSize(file.size, tag)}`
              : formatFileSize(file.size, tag)}
          </span>
        </span>
      </button>

      {file.isFavorite ? (
        <span
          aria-label={t.tiedosto.tabFavorites}
          style={{ color: "var(--rf-amber)" }}
        >
          <RfIcon name="star" size={16} />
        </span>
      ) : null}

      <RowMenu
        label={file.name}
        items={[
          { label: t.tiedosto.open, onClick: () => void open(false) },
          ...(isPreviewable(file.type, file.name)
            ? [{ label: t.tiedosto.preview, onClick: () => void open(false) }]
            : []),
          { label: t.tiedosto.download, onClick: () => void open(true) },
          ...(canManage
            ? [
                { label: t.tiedosto.rename, onClick: onRename },
                { label: t.tiedosto.move, onClick: onMove },
                {
                  label: file.isFavorite
                    ? t.tiedosto.removeFavorite
                    : t.tiedosto.addFavorite,
                  onClick: onFavorite,
                },
                { label: t.tiedosto.remove, onClick: onDelete, danger: true },
              ]
            : []),
        ]}
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Dialogit
// ---------------------------------------------------------------------------

/**
 * Yhteinen kehys.
 *
 * Natiivi dialog-elementti hoitaa kohdistuksen, Escapen ja taustan
 * lukituksen ilman että niitä toteutetaan uudelleen.
 */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="rf-enter w-[min(30rem,calc(100vw-2rem))] p-0 backdrop:bg-black/40"
      style={{
        background: "var(--rf-card)",
        color: "var(--rf-text)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <div className="p-4">
        <h2 className="mb-3 text-[16px] font-bold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  hint,
  autoFocus,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required
        maxLength={200}
        className="mt-1 h-[42px] w-full px-3 text-[14px] outline-none"
        style={{
          background: "var(--rf-inset)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-field)",
          color: "var(--rf-text)",
        }}
      />
      {hint ? (
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function NewFolderDialog({
  t,
  folders,
  folderId,
  onClose,
  onDone,
}: {
  t: AdminText;
  folders: FolderRow[];
  folderId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const here = folderPath(folders, folderId) || t.tiedosto.root;

  return (
    <Modal title={t.tiedosto.newFolderTitle} onClose={onClose}>
      <form
        action={(form) => {
          form.set("parentId", folderId ?? "");
          start(async () => {
            const result = await createFolder({}, form);
            if (result.error) setError(result.error);
            else onDone();
          });
        }}
        className="space-y-3"
      >
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {`${t.tiedosto.createdIn}: ${here}`}
        </p>

        <TextField
          label={t.tiedosto.folderName}
          name="name"
          hint={t.tiedosto.folderNameHint}
          autoFocus
        />

        {error ? (
          <p className="text-[13px]" style={{ color: "var(--rf-red-text)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button tone="ghost" type="button" onClick={onClose}>
            {t.tiedosto.cancel}
          </Button>
          <Button tone="primary" type="submit" disabled={busy}>
            {t.tiedosto.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameDialog({
  t,
  title,
  label,
  value,
  onClose,
  onSubmit,
}: {
  t: AdminText;
  title: string;
  label: string;
  value: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <form
        action={(form) => {
          const name = String(form.get("name") ?? "").trim();
          if (name) onSubmit(name);
        }}
        className="space-y-3"
      >
        <TextField label={label} name="name" defaultValue={value} autoFocus />

        <div className="flex justify-end gap-2">
          <Button tone="ghost" type="button" onClick={onClose}>
            {t.tiedosto.cancel}
          </Button>
          <Button tone="primary" type="submit">
            {t.tiedosto.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Siirron kohde.
 *
 * Litteä lista koko polkuineen eikä avattava puu: "2026" yksinään ei
 * kerro kummasta vuodesta on kyse, jos niitä on kaksi eri haarassa.
 */
function MoveDialog({
  t,
  folders,
  name,
  excludeFolderId,
  onClose,
  onPick,
}: {
  t: AdminText;
  folders: FolderRow[];
  name: string;
  excludeFolderId: string | null;
  onClose: () => void;
  onPick: (targetId: string | null) => void;
}) {
  const targets = movableTargets(folders, excludeFolderId);

  return (
    <Modal title={t.tiedosto.moveTitle} onClose={onClose}>
      <p className="mb-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {name}
      </p>

      <ul
        className="max-h-72 overflow-y-auto"
        style={{
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-field)",
        }}
      >
        <li>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13.5px] font-semibold"
          >
            <RfIcon name="folder" size={16} />
            {t.tiedosto.root}
          </button>
        </li>

        {targets.map((folder) => (
          <li key={folder.id} style={{ borderTop: "1px solid var(--rf-line)" }}>
            <button
              type="button"
              onClick={() => onPick(folder.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13.5px]"
            >
              <RfIcon name="folder" size={16} />
              <span className="truncate">{folderPath(folders, folder.id)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-end">
        <Button tone="ghost" type="button" onClick={onClose}>
          {t.tiedosto.cancel}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Kansion poisto.
 *
 * Tyhjä kansio katoaa yhdellä vahvistuksella. Jos sisällä on
 * tiedostoja, käyttäjälle kerrotaan se ja annetaan kaksi eri tekoa —
 * eikä yhtä nappia jonka merkitys riippuu siitä mitä hän sattui
 * arvaamaan.
 */
function DeleteFolderDialog({
  t,
  folder,
  contents,
  onClose,
  onConfirm,
}: {
  t: AdminText;
  folder: FolderRow;
  contents: number;
  onClose: () => void;
  onConfirm: (mode: "keep" | "contents") => void;
}) {
  const [word, setWord] = useState("");
  const confirmed = word.trim().toUpperCase() === t.tiedosto.deleteAllWord;

  if (contents === 0) {
    return (
      <Modal title={t.tiedosto.deleteFolderTitle} onClose={onClose}>
        <p className="text-[13.5px]">{folder.name}</p>

        <div className="mt-4 flex justify-end gap-2">
          <Button tone="ghost" type="button" onClick={onClose}>
            {t.tiedosto.cancel}
          </Button>
          <Button tone="danger" type="button" onClick={() => onConfirm("keep")}>
            {t.tiedosto.remove}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t.tiedosto.folderNotEmpty} onClose={onClose}>
      <p className="text-[13.5px]" style={{ color: "var(--rf-text-2)" }}>
        {t.tiedosto.folderNotEmptyHelp}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        {`${folder.name} · ${fill(t.tiedosto.fileCount, { maara: String(contents) })}`}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Button tone="secondary" full type="button" onClick={() => onConfirm("keep")}>
            {t.tiedosto.keepFiles}
          </Button>
          <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {t.tiedosto.keepFilesHelp}
          </p>
        </div>

        <div>
          <label className="block">
            <span className="text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
              {t.tiedosto.deleteAllConfirm}
            </span>
            <input
              value={word}
              onChange={(event) => setWord(event.target.value)}
              className="mt-1 h-[42px] w-full px-3 text-[14px] outline-none"
              style={{
                background: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-field)",
                color: "var(--rf-text)",
              }}
            />
          </label>

          <div className="mt-2">
            <Button
              tone="danger"
              full
              type="button"
              disabled={!confirmed}
              onClick={() => onConfirm("contents")}
            >
              {t.tiedosto.deleteAll}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button tone="ghost" type="button" onClick={onClose}>
          {t.tiedosto.cancel}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Lataus
// ---------------------------------------------------------------------------

/**
 * Tiedoston lataus.
 *
 * Selain lataa suoraan storageen omalla istunnollaan, ja vasta sen
 * jälkeen palvelin kirjaa rivin. Kahdenkymmenenviiden megatavun
 * tiedoston kierrättäminen palvelinfunktion muistin kautta olisi
 * hitaampaa ja kaatuisi suurimpiin.
 *
 * Kohdekansio on valittavissa ennen latausta: oletus on se kansio jossa
 * käyttäjä on, mutta hän on voinut avata dialogin väärässä paikassa.
 */
function UploadDialog({
  t,
  tag,
  restaurantId,
  folders,
  folderId,
  initial,
  onClose,
  onDone,
}: {
  t: AdminText;
  tag: string;
  restaurantId: string;
  folders: FolderRow[];
  folderId: string | null;
  initial: File[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string | null>(folderId);
  const [chosen, setChosen] = useState<File[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(): Promise<void> {
    if (chosen.length === 0) return;

    setBusy(true);
    setError(null);

    const supabase = createClient();

    for (const file of chosen) {
      const problem = checkFile(file);
      if (problem) {
        setError(
          problem === "size"
            ? t.tiedosto.errorSize
            : problem === "empty"
              ? t.tiedosto.errorEmpty
              : t.tiedosto.errorType,
        );
        setBusy(false);
        return;
      }

      /*
       * Polku alkaa ravintolan tunnisteella, koska storage-käytäntö
       * lukee pääsyn juuri siitä. Nimenä tunniste eikä käyttäjän
       * antama nimi: kaksi samannimistä tiedostoa eivät korvaa
       * toisiaan, eikä polusta voi päätellä sisältöä.
       */
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;
      const type = mimeFor(file.name, file.type);

      const { error: uploadError } = await supabase.storage
        .from("files")
        .upload(path, file, { contentType: type, upsert: false });

      if (uploadError) {
        setError(t.tiedosto.errorUpload);
        setBusy(false);
        return;
      }

      const result = await registerFile({
        folderId: target,
        name: file.name,
        path,
        type,
        size: file.size,
      });

      if (result.error) {
        setError(result.error);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    onDone();
  }

  const here = folderPath(folders, target) || t.tiedosto.root;

  return (
    <Modal title={t.tiedosto.uploadTitle} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-[13px] font-semibold">{t.tiedosto.savedTo}</span>
          <select
            value={target ?? ""}
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
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderPath(folders, folder.id)}
              </option>
            ))}
          </select>
          <span
            className="mt-1 block text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {here}
          </span>
        </label>

        <label className="block">
          <span className="text-[13px] font-semibold">{t.tiedosto.chooseFile}</span>
          <input
            type="file"
            multiple
            onChange={(event) =>
              setChosen(Array.from(event.target.files ?? []))
            }
            className="mt-1 block w-full text-[13px]"
          />
          <span
            className="mt-1 block text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.tiedosto.allowedTypes}
          </span>
        </label>

        {chosen.length > 0 ? (
          <ul className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {chosen.map((file) => (
              <li key={file.name}>
                {`${file.name} · ${formatFileSize(file.size, tag)}`}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="text-[13px]" style={{ color: "var(--rf-red-text)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button tone="ghost" type="button" onClick={onClose} disabled={busy}>
            {t.tiedosto.cancel}
          </Button>
          <Button
            tone="primary"
            type="button"
            onClick={() => void send()}
            disabled={busy || chosen.length === 0}
          >
            {busy ? t.tiedosto.uploading : t.tiedosto.upload}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
