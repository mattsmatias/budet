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
 * KAKSI ERI RAAHAUSTA, KAKSI ERI TARKOITUSTA
 * ---------------------------------------------------------------------
 *
 * Kansion KAHVA järjestää: pointer-tapahtumilla, kuten lounaslistalla,
 * joten se toimii myös kosketuksella ja näppäimistön nuolilla.
 *
 * Tiedoston VETO siirtää kansioon: selaimen oma vetotapahtuma, joka ei
 * toimi kosketuksella. Puhelimessa sama tehdään rivin valikon
 * Siirrä-kohdasta.
 *
 * Aiemmin kansiorivi oli myös selaimen vedettävä, jolloin sama ele
 * tarkoitti kahta eri asiaa — paikan vaihtoa ja kansioon siirtoa — ja
 * lopputulos riippui siitä minkä rivin päälle sormi sattui osumaan.
 * Nyt järjestäminen on kahvassa ja siirto valikossa, jossa kohde
 * valitaan nimeltä.
 *
 * Tiedostojen vetotapahtuma ottaa vastaan myös käyttöjärjestelmästä
 * pudotetut tiedostot: niiden pudottaminen kansioon lataa ne sinne.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";
import { formatDayIn } from "@/lib/i18n/labels";
import {
  checkFile,
  expiryState,
  fileKind,
  filesHref,
  folderLabel,
  folderPath,
  ageText,
  extensionOf,
  formatFileSize,
  mimeFor,
  uniqueName,
  movableTargets,
  type ExpiryState,
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
  deleteFiles,
  deleteFolder,
  favoriteFiles,
  moveFile,
  moveFiles,
  moveFolder,
  purgeTrash,
  registerFile,
  renameFile,
  renameFolder,
  reorderFolders,
  restoreFile,
  restoreFolder,
  setExpiry,
  toggleFavorite,
} from "./actions";
import { supplierChoices, type SupplierChoice } from "./save-actions";
import { linkFile } from "./actions";

type View = "all" | "favorites" | "recent" | "search" | "expiring" | "trash";

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

  /** Tänään ravintolan aikavyöhykkeellä, ei selaimen. */
  today: string;

  /** Päivämäärien muotoiluun käyttäjän kielellä. */
  locale: AppLocale;

  /** Roskakorissa olevat kansiot. Tyhjä muissa näkymissä. */
  trashFolders: { id: string; name: string; deletedAt: string }[];

  /**
   * Viimeksi avatut. Vain kaapin juuressa, muualla tyhjä.
   *
   * Eri asia kuin viimeksi lisätyt: ravintoloitsija ei muista missä
   * kansiossa vuokrasopimus on, mutta muistaa katsoneensa sitä.
   */
  recentlyOpened: FileRow[];
}

/*
 * Raahattavana oleva tiedosto.
 *
 * Vain tiedosto: kansion paikkaa vaihdetaan kahvasta ja sen siirto
 * toiseen kansioon tehdään rivin valikosta. Sama ele ei saa tarkoittaa
 * kahta eri asiaa.
 */
type Dragged = string | null;

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

  /*
   * Vahvistus vain siitä mikä tapahtui muualla.
   *
   * Kansion luonti ja nimeäminen näkyvät listassa heti, eivätkä ne
   * tarvitse ilmoitusta. Tehtävän syntyminen Tehtävät-osioon ei näy
   * täältä mitenkään — ja hiljaa tehty tehtävä toisessa osiossa on
   * yllätys, ei palvelus.
   */
  const [notice, setNotice] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  /*
   * Tietopaneeli, sama kuin Matin paneeli.
   *
   * Sivun reuna eikä keskellä oleva ikkuna: lista jää näkyviin
   * taustalle, ja seuraavan tiedoston voi avata heti perään ilman
   * että näkymä katoaa välillä.
   */
  const [details, setDetails] = useState<FileRow | null>(null);

  /* Dialogit. Yksi kerrallaan, joten yksi tila riittää. */
  const [dialog, setDialog] = useState<
    | { type: "newFolder" }
    | { type: "upload"; folderId: string | null; initial: File[] }
    | { type: "renameFolder"; folder: FolderRow }
    | { type: "renameFile"; file: FileRow }
    | {
        type: "move";
        kind: "folder" | "file" | "files";
        id: string;
        name: string;
      }
    | { type: "expiry"; file: FileRow }
    | { type: "link"; file: FileRow }
    | { type: "deleteFolder"; folder: FolderRow }
    | null
  >(null);

  function run(
    action: () => Promise<{ error?: string; notice?: string }>,
  ): void {
    setError(null);
    setNotice(null);

    start(async () => {
      const result = await action();

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.notice) setNotice(result.notice);
      router.refresh();
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

    const fileId = dragged;
    setDragged(null);
    if (fileId) run(() => moveFile(fileId, targetFolderId));
  }

  // -------------------------------------------------------------------------
  // Kansioiden järjestäminen kahvasta
  // -------------------------------------------------------------------------
  //
  // Sama kuvio kuin lounaslistalla: pointer-tapahtumat kattavat hiiren,
  // kosketuksen ja kynän samalla koodilla, ja järjestys tallennetaan
  // vasta irrotettaessa. Jokainen ohitettu rivi ei ole oma
  // tallennuksensa — se olisi kymmenen kutsua yhdestä siirrosta, ja
  // niistä viimeinen voisi saapua ensimmäisenä.
  //
  // Kahva on erillään rivistä tarkoituksella. Aiemmin koko kansiorivi
  // oli vedettävä, jolloin sama ele tarkoitti kahta eri asiaa:
  // järjestyksen vaihtoa ja siirtoa toisen kansion sisään. Kansion
  // siirtäminen toiseen kansioon on nyt rivin valikossa, jossa kohde
  // valitaan nimeltä eikä osumatarkkuudella.

  const lista = useRef<HTMLUListElement>(null);

  /*
   * Palvelimen järjestys on totuus, paikallinen on sen kopio.
   *
   * Kun palvelin palauttaa uuden järjestyksen, tunnisteiden jono
   * muuttuu ja paikallinen tila nollataan sen mukaan.
   */
  const kansioTunnus = visibleFolders.map((f) => f.id).join(",");
  const [edellinen, setEdellinen] = useState(kansioTunnus);
  const [jarjestys, setJarjestys] = useState<string[]>(() =>
    visibleFolders.map((f) => f.id),
  );

  if (kansioTunnus !== edellinen) {
    setEdellinen(kansioTunnus);
    setJarjestys(visibleFolders.map((f) => f.id));
  }

  const [kahvassa, setKahvassa] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Monivalinta
  // -------------------------------------------------------------------------
  //
  // Kaksisataa kuittia väärässä kansiossa on ero käyttökelpoisen ja
  // käyttökelvottoman välillä. Valinta on tiedostoille eikä kansioille:
  // kansioita on kymmeniä ja niitä käsitellään yksitellen, tiedostoja
  // satoja ja niitä käsitellään joukkona.

  const [valitut, setValitut] = useState<string[]>([]);
  const nakyvat = files.map((file) => file.id);

  /*
   * Valinta nollautuu kun lista vaihtuu.
   *
   * Muuten toisessa kansiossa valittu tiedosto seuraisi mukana
   * näkymättömänä, ja "poista valitut" poistaisi jotain mitä käyttäjä
   * ei näe.
   */
  const listaTunnus = nakyvat.join(",");
  const [listaEdellinen, setListaEdellinen] = useState(listaTunnus);

  if (listaTunnus !== listaEdellinen) {
    setListaEdellinen(listaTunnus);
    if (valitut.length > 0) setValitut([]);
  }

  function vaihdaValinta(id: string): void {
    setValitut((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  /*
   * Järjestäminen vain omassa järjestyksessä.
   *
   * Nimen mukaan lajitellussa listassa rivin siirtäminen ei tarkoita
   * mitään: seuraava lataus palauttaisi sen takaisin aakkosiin.
   */
  const sortable =
    canManage && props.folderSort === "custom" && visibleFolders.length > 1;

  const byId = new Map(visibleFolders.map((folder) => [folder.id, folder]));
  const orderedFolders = sortable
    ? jarjestys
        .map((id) => byId.get(id))
        .filter((folder): folder is FolderRow => folder !== undefined)
    : visibleFolders;

  function siirraKohtaan(from: number, to: number): string[] {
    const kopio = [...jarjestys];
    const [poimittu] = kopio.splice(from, 1);
    kopio.splice(to, 0, poimittu);
    return kopio;
  }

  function kahvaLiikkuu(event: React.PointerEvent): void {
    if (!kahvassa || !lista.current) return;

    const rows = Array.from(
      lista.current.querySelectorAll<HTMLElement>("[data-kansio]"),
    );

    const from = jarjestys.indexOf(kahvassa);

    /*
     * Kohta luetaan riviltä jonka päällä sormi on, ei pikselisiirtymästä:
     * rivit ovat eri korkuisia nimen pituuden mukaan.
     */
    let to = from;
    rows.forEach((row, index) => {
      const box = row.getBoundingClientRect();
      if (event.clientY >= box.top && event.clientY <= box.bottom) to = index;
    });

    if (to !== from) setJarjestys(siirraKohtaan(from, to));
  }

  function kahvaIrtosi(): void {
    if (!kahvassa) return;
    setKahvassa(null);

    /* Tallennus vain jos järjestys oikeasti muuttui. */
    if (jarjestys.join(",") !== kansioTunnus) {
      const uusi = jarjestys;
      start(async () => {
        const result = await reorderFolders(props.folderId, uusi);
        if (result.error) setError(result.error);
        else router.refresh();
      });
    }
  }

  function kahvaNappaimisto(event: React.KeyboardEvent, id: string): void {
    const suunta =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (suunta === 0) return;

    const from = jarjestys.indexOf(id);
    const to = from + suunta;
    if (to < 0 || to >= jarjestys.length) return;

    event.preventDefault();
    const uusi = siirraKohtaan(from, to);
    setJarjestys(uusi);

    start(async () => {
      const result = await reorderFolders(props.folderId, uusi);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  /*
   * Roskakorissa voi olla pelkkiä kansioita.
   *
   * Tyhjän kansion poisto ei tuo mukanaan yhtään tiedostoa. Ilman
   * tätä ehtoa näkymä sanoisi roskakoria tyhjäksi, ja kansio jäisi
   * sinne ilman tapaa palauttaa se.
   */
  const empty =
    visibleFolders.length === 0 &&
    files.length === 0 &&
    props.trashFolders.length === 0;

  return (
    <div className="space-y-3">
      {/*
        Työkalurivi vain Kaikki-näkymässä.
        ------------------------------------------------------------------

        Kaikki on ainoa näkymä jossa ollaan jossakin: siinä on avoinna
        oleva kansio, ja uusi kansio tai ladattu tiedosto ilmestyy
        siihen näkyviin.

        Muut neljä ovat koontinäkymiä. Tärkeät, Voimassaolo, Roskakori
        ja haku kertovat tiedostoista eri puolilta puuta, eikä
        yhdessäkään ole paikkaa johon uusi tiedosto kuuluisi.
        Viimeksi lisätyt näyttäisi ladatun tiedoston, mutta se on
        katsausnäkymä eikä työtila — lataaminen kuuluu sinne minne
        tiedosto menee, ei sinne mistä sen näkee menneen.
      */}
      {canManage && view === "all" ? (
        <Toolbar
          t={t}
          busy={busy}
          fileSort={props.fileSort}
          folderSort={props.folderSort}
          folderId={props.folderId}
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
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-card)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className="px-3 py-2 text-[13px] font-medium"
          style={{
            background: "var(--rf-green-bg)",
            color: "var(--rf-green-text)",
            borderRadius: "var(--rf-r-card)",
          }}
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {/*
        Roskakorin ohje ja tyhjennys.

        Kolmenkymmenen päivän sääntö sanotaan ääneen: ilman sitä
        käyttäjä ei tiedä onko poistettu tallessa vai menossa pois, ja
        arvaa väärin kumpaan suuntaan tahansa.
      */}
      {view === "trash" && canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.tiedosto.trashNote}
          </p>

          {files.length > 0 || props.trashFolders.length > 0 ? (
            <div className="ml-auto">
              <Button
                tone="danger"
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(t.tiedosto.emptyTrashConfirm)) {
                    run(() => purgeTrash(0));
                  }
                }}
              >
                {t.tiedosto.emptyTrash}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        Joukkotoiminnot ilmestyvät vasta kun jotain on valittu.

        Aina näkyvä palkki veisi tilaa listalta joka kerta, myös
        silloin kun käyttäjä vain selaa.
      */}
      {valitut.length > 0 && canManage ? (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          <span className="text-[13px] font-semibold">
            {fill(t.tiedosto.selected, { maara: String(valitut.length) })}
          </span>

          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button
              tone="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() =>
                setDialog({
                  type: "move",
                  kind: "files",
                  id: "",
                  name: fill(t.tiedosto.selected, {
                    maara: String(valitut.length),
                  }),
                })
              }
            >
              {t.tiedosto.move}
            </Button>

            <Button
              tone="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => {
                const ids = valitut;
                setValitut([]);
                run(() => favoriteFiles(ids, true));
              }}
            >
              {t.tiedosto.addFavorite}
            </Button>

            <Button
              tone="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => {
                const ids = valitut;
                setValitut([]);
                run(() => deleteFiles(ids));
              }}
            >
              {t.tiedosto.remove}
            </Button>

            <Button
              tone="ghost"
              size="sm"
              type="button"
              onClick={() => setValitut([])}
            >
              {t.tiedosto.clearSelection}
            </Button>
          </div>
        </div>
      ) : null}

      {/*
        Viimeksi käytetyt vain juuressa ja vain jos niitä on.

        Tyhjä osio otsikoineen olisi lupaus jota mikään ei lunasta, ja
        uudessa kaapissa se olisi ensimmäinen asia jonka käyttäjä
        näkee.
      */}
      {props.recentlyOpened.length > 0 ? (
        <div className="space-y-1.5">
          <p
            className="text-[12px] font-semibold uppercase"
            style={{ color: "var(--rf-text-3)", letterSpacing: "0.04em" }}
          >
            {t.tiedosto.recentlyUsed}
          </p>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {props.recentlyOpened.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setDetails(file)}
                className="rf-press flex w-44 shrink-0 items-center gap-2 px-3 py-2 text-left"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-card)",
                }}
              >
                <span style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon
                    name={KIND_ICONS[fileKind(file.type, file.name)] ?? "file"}
                    size={18}
                  />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {file.name}
                  </span>
                  <span
                    className="block truncate text-[11.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {ageText(
                      file.lastOpenedAt,
                      props.today,
                      t.tiedosto,
                      (day) => formatDayIn(day, props.locale),
                    ) ?? ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          /*
            Otsikko ei toista välilehden nimeä.

            Välilehti on korostettuna ruudulla, joten "Roskakori" sen
            alla oli sama sana kolmesti: välilehdessä, otsikossa ja
            selityksessä.
          */
          title={
            view === "search"
              ? `${t.tiedosto.noResults} "${props.term}"`
              : view === "favorites"
                ? t.tiedosto.emptyFavoritesTitle
                : view === "recent"
                  ? t.tiedosto.emptyRecentTitle
                  : view === "expiring"
                    ? t.tiedosto.emptyExpiringTitle
                    : view === "trash"
                      ? t.tiedosto.trashEmpty
                      : t.tiedosto.emptyFolder
          }
          description={
            view === "favorites"
              ? t.tiedosto.emptyFavorites
              : view === "recent"
                ? t.tiedosto.emptyRecent
                : view === "expiring"
                  ? t.tiedosto.emptyExpiring
                  : ""
          }
        />
      ) : (
        <ul
          ref={lista}
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
          {/*
            Roskakorissa olevat kansiot.

            Palautus on eri toiminto kuin tiedoston palautus, ja se tuo
            takaisin kansion eikä sen sisältöä — sisältö palautetaan
            erikseen, koska käyttäjä ei aina halua molempia.
          */}
          {props.trashFolders.map((folder) => (
            <li
              key={folder.id}
              className="flex items-center gap-3 px-3 py-3"
              style={{ borderBottom: "1px solid var(--rf-line)" }}
            >
              <span style={{ color: "var(--rf-text-3)" }}>
                <RfIcon name="folder" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold">
                  {folder.name}
                </span>
                <span
                  className="text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {`${t.tiedosto.deletedOn} ${folder.deletedAt.slice(0, 10)}`}
                </span>
              </span>

              {canManage ? (
                <Button
                  tone="ghost"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => restoreFolder(folder.id))}
                >
                  {t.tiedosto.restore}
                </Button>
              ) : null}
            </li>
          ))}

          {orderedFolders.map((folder) => (
            <FolderRowItem
              key={folder.id}
              t={t}
              folder={folder}
              activity={ageText(
                folder.lastActivity,
                props.today,
                t.tiedosto,
                (day) => formatDayIn(day, props.locale),
              )}
              href={filesHref({
                folderId: folder.id,
                fileSort: props.fileSort,
                folderSort: props.folderSort,
              })}
              canManage={canManage}
              sortable={sortable}
              dragging={kahvassa === folder.id}
              highlighted={over === folder.id}
              onHandleDown={(event) => {
                event.preventDefault();

                /*
                 * Kaappaus try-lohkossa: setPointerCapture heittää jos
                 * osoitin ehtii irrota tapahtuman ja käsittelijän
                 * välissä. Ilman suojaa raahaus ei alkaisi lainkaan.
                 */
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* Ei kaappausta; liike toimii silti listan päällä. */
                }

                setKahvassa(folder.id);
              }}
              onHandleMove={kahvaLiikkuu}
              onHandleUp={kahvaIrtosi}
              onHandleKey={(event) => kahvaNappaimisto(event, folder.id)}
              onDragOver={(event) => {
                if (!canManage) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(folder.id);
              }}
              onDragLeave={() =>
                setOver((id) => (id === folder.id ? null : id))
              }
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
              path={folderPath(props.folders, file.folderId, t.tiedosto)}
              locale={props.locale}
              today={props.today}
              inTrash={view === "trash"}
              selected={valitut.includes(file.id)}
              onSelect={() => vaihdaValinta(file.id)}
              onDetails={() => setDetails(file)}
              onShowLocation={
                file.folderId
                  ? () =>
                      router.push(
                        filesHref({
                          folderId: file.folderId,
                          fileSort: props.fileSort,
                          folderSort: props.folderSort,
                        }),
                      )
                  : () => router.push(filesHref({}))
              }
              onRestore={() => run(() => restoreFile(file.id))}
              onExpiry={() => setDialog({ type: "expiry", file })}
              onLink={() => setDialog({ type: "link", file })}
              onDragStart={() => setDragged(file.id)}
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
              onFavorite={() =>
                run(() => toggleFavorite(file.id, !file.isFavorite))
              }
              onDelete={() => {
                if (confirm(t.tiedosto.deleteFileConfirm)) {
                  run(() => deleteFile(file.id));
                }
              }}
            />
          ))}
        </ul>
      )}

      {details ? (
        <DetailsPanel
          t={t}
          tag={tag}
          locale={props.locale}
          today={props.today}
          file={details}
          path={folderPath(props.folders, details.folderId, t.tiedosto)}
          onClose={() => setDetails(null)}
        />
      ) : null}

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
          /* Kentässä se nimi jonka käyttäjä näkee, ei kannan suomi. */
          value={folderLabel(dialog.folder, t.tiedosto)}
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
            const ids = valitut;

            run(() =>
              kind === "folder"
                ? moveFolder(id, targetId)
                : kind === "files"
                  ? moveFiles(ids, targetId)
                  : moveFile(id, targetId),
            );

            if (kind === "files") setValitut([]);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "expiry" ? (
        <ExpiryDialog
          t={t}
          file={dialog.file}
          onClose={() => setDialog(null)}
          onSave={(date) => {
            run(() => setExpiry(dialog.file.id, date));
            setDialog(null);
          }}
        />
      ) : null}

      {dialog?.type === "link" ? (
        <LinkDialog
          t={t}
          file={dialog.file}
          onClose={() => setDialog(null)}
          onPick={(supplierId) => {
            run(() =>
              linkFile(dialog.file.id, {
                supplierId,
                /* Kuittiliitos säilyy: se kertoo mistä tiedosto tuli,
                   eikä toimittajan valinta ole päätös siitä. */
                receiptId: dialog.file.receiptId,
              }),
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
  onNewFolder,
  onUpload,
}: {
  t: AdminText;
  busy: boolean;
  fileSort: FileSort;
  folderSort: FolderSort;
  folderId: string | null;
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

      <SortMenu
        t={t}
        fileSort={fileSort}
        folderSort={folderSort}
        folderId={folderId}
      />
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
    return filesHref({
      folderId,
      fileSort: next.jarjesta ?? fileSort,
      folderSort: next.kansiot ?? folderSort,
    });
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
          <MenuLabel>{t.tiedosto.filesWord}</MenuLabel>
          {files.map(([key, label]) => (
            <MenuLink
              key={key}
              href={href({ jarjesta: key })}
              on={key === fileSort}
              onPick={() => setOpen(false)}
            >
              {label}
            </MenuLink>
          ))}

          <MenuLabel>{t.tiedosto.foldersWord}</MenuLabel>
          {folders.map(([key, label]) => (
            <MenuLink
              key={key}
              href={href({ kansiot: key })}
              on={key === folderSort}
              onPick={() => setOpen(false)}
            >
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

/**
 * Valikkorivi joka sulkee valikon.
 *
 * useDismiss reagoi vain valikon ulkopuoliseen painallukseen, ja
 * pehmeä siirtymä ei irrota komponenttia. Ilman tätä valikko jäi auki
 * valinnan jälkeen ja peitti juuri sen listan jonka järjestystä
 * käyttäjä oli muuttamassa.
 */
function MenuLink({
  href,
  on,
  onPick,
  children,
}: {
  href: string;
  on: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
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
  activity,
  href,
  canManage,
  sortable,
  dragging,
  highlighted,
  onHandleDown,
  onHandleMove,
  onHandleUp,
  onHandleKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onRename,
  onMove,
  onDelete,
}: {
  t: AdminText;
  folder: FolderRow;
  /** "tänään", "3 pv sitten" tai null jos kansio on tyhjä. */
  activity: string | null;
  /** Valmis osoite: kantaa mukanaan valitun lajittelun. */
  href: string;
  canManage: boolean;
  sortable: boolean;
  dragging: boolean;
  highlighted: boolean;
  onHandleDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onHandleMove: (event: React.PointerEvent) => void;
  onHandleUp: () => void;
  onHandleKey: (event: React.KeyboardEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  /*
   * Määrä ja tuoreus samalla rivillä.
   *
   * "86 tiedostoa" kertoo että kansio on käytössä, "päivitetty tänään"
   * kertoo että se on käytössä nyt. Kumpikaan yksin ei erota elävää
   * kansiota arkistosta.
   */
  const count = [
    folder.fileCount === 0
      ? t.tiedosto.emptyLabel
      : folder.fileCount === 1
        ? t.tiedosto.oneFile
        : fill(t.tiedosto.fileCount, { maara: String(folder.fileCount) }),
    activity ? fill(t.tiedosto.updatedAgo, { aika: activity }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /* Katen luoma lähtökansio näytetään käyttäjän kielellä. */
  const nimi = folderLabel(folder, t.tiedosto);

  return (
    <li
      data-kansio=""
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex items-center gap-2 px-3"
      style={{
        borderBottom: "1px solid var(--rf-line)",
        /*
         * Kaksi eri korostusta kahdelle eri asialle.
         *
         * Reunus kertoo mihin pudotus osuu, kun tiedostoa raahataan
         * kansion päälle. Taustaväri kertoo mikä rivi on kahvassa
         * kiinni. Sama korostus molemmille tarkoittaisi kahta eri
         * asiaa samalla merkillä.
         */
        background: highlighted || dragging ? "var(--rf-inset)" : "transparent",
        outline: highlighted ? "2px solid var(--rf-accent)" : "none",
        outlineOffset: "-2px",
      }}
    >
      {sortable ? (
        <button
          type="button"
          /*
           * Kahva on painike eikä div: se saa kohdistuksen sarkaimella,
           * ja nuolinäppäimet siirtävät kansiota askeleen. Pelkkä
           * raahaus sulkisi ulos jokaisen joka ei käytä hiirtä.
           */
          aria-label={`${t.tiedosto.move}: ${nimi}`}
          className="rf-press flex h-8 w-6 shrink-0 cursor-grab items-center justify-center"
          style={{
            color: "var(--rf-text-3)",
            /* Ilman tätä selain vierittää sivua sormen mukana. */
            touchAction: "none",
          }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={onHandleKey}
        >
          <RfIcon name="drag" size={16} />
        </button>
      ) : null}

      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 py-3">
        <span style={{ color: "var(--rf-accent)" }}>
          <RfIcon name="folder" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold">
            {nimi}
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {count}
          </span>
        </span>
      </Link>

      {canManage ? (
        <RowMenu
          label={nimi}
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
  path,
  locale,
  today,
  inTrash,
  selected,
  onSelect,
  onDetails,
  onShowLocation,
  onRestore,
  onExpiry,
  onLink,
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
  /** Sijainti käyttäjän kielellä. Tyhjä = juuri. */
  path: string;
  /** Päivämäärien muotoiluun. */
  locale: AppLocale;
  today: string;
  inTrash: boolean;
  selected: boolean;
  onSelect: () => void;
  onDetails: () => void;
  /** null kun tiedosto on jo juuressa: sinne ei ole mihin siirtyä. */
  onShowLocation: (() => void) | null;
  onRestore: () => void;
  onExpiry: () => void;
  onLink: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRename: () => void;
  onMove: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  /**
   * Avaus Katen omasta osoitteesta.
   *
   * Ei allekirjoitettua storage-osoitetta: se paljastaisi
   * osoiterivillä Supabase-projektin, bucketin ja ravintolan
   * tunnisteen, ja olisi tunnin ajan toimiva linkki yksityiseen
   * asiakirjaan kenelle tahansa jolle osoite päätyy.
   *
   * /api/tiedostot/<tunnus> tarkistaa kirjautumisen ja jäsenyyden joka
   * kerta, joten sen jakaminen ei anna kenellekään mitään.
   */
  function open(download: boolean): void {
    const url = `/api/tiedostot/${file.id}${download ? "?lataa=1" : ""}`;

    if (download) {
      /* Lataus ei avaa välilehteä: otsake kertoo selaimelle mitä tehdä. */
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      link.click();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const kind = fileKind(file.type, file.name);
  const expiry = expiryState(file.expiresOn, today);

  return (
    <li
      /* Roskakorissa oleva ei ole siirrettävissä: se ei ole missään. */
      draggable={canManage && !inTrash}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 px-3"
      style={{
        borderBottom: "1px solid var(--rf-line)",
        background: selected ? "var(--rf-inset)" : "transparent",
      }}
    >
      {/*
        Valintaruutu on aina näkyvissä.

        Erillinen valintatila olisi yksi painallus lisää ennen kuin
        mitään voi valita, ja ruudun näkyminen vasta osoittimen alla ei
        toimi kosketuksella lainkaan.
      */}
      {canManage && !inTrash ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`${t.tiedosto.select}: ${file.name}`}
          className="h-4 w-4 shrink-0 cursor-pointer"
          style={{ accentColor: "var(--rf-accent)" }}
        />
      ) : null}

      <button
        type="button"
        onClick={() => open(false)}
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
            {inTrash
              ? `${t.tiedosto.deletedOn} ${(file.deletedAt ?? "").slice(0, 10)}`
              : [
                  showPath
                    ? `${t.tiedosto.location}: ${path || t.tiedosto.root}`
                    : null,
                  formatFileSize(file.size, tag),
                  file.expiresOn
                    ? fill(t.tiedosto.validUntilShort, {
                        pvm: formatDayIn(file.expiresOn, locale),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </span>
      </button>

      {/*
        Voimassaolo merkintänä eikä sarakkeena.

        Useimmilla tiedostoilla sitä ei ole, ja tyhjä sarake joka
        rivillä olisi tilaa jota mikään ei täytä.
      */}
      {expiry.state !== "none" && !inTrash ? (
        <ExpiryPill t={t} state={expiry.state} days={expiry.days} />
      ) : null}

      {file.isFavorite ? (
        <span
          aria-label={t.tiedosto.tabFavorites}
          style={{ color: "var(--rf-amber)" }}
        >
          <RfIcon name="star" size={16} />
        </span>
      ) : null}

      {inTrash ? (
        canManage ? (
          <Button tone="ghost" size="sm" type="button" onClick={onRestore}>
            {t.tiedosto.restore}
          </Button>
        ) : null
      ) : (
        <RowMenu
          label={file.name}
          items={[
            /*
             * Avaa ja Esikatsele olivat sama kutsu.
             *
             * Molemmat avasivat tiedoston uuteen välilehteen, eli
             * valikossa oli kaksi eri nimeä yhdelle teolle. Se opettaa
             * epäilemään koko valikkoa: jos nämä kaksi ovat sama, mitkä
             * muut ovat?
             *
             * Jäljelle jäi Avaa. Esikatselu olisi oma tekonsa vasta jos
             * se näyttäisi tiedoston sivulla poistumatta listasta —
             * kaksi nimeä samalle asialle ei ole esikatselu.
             */
            { label: t.tiedosto.open, onClick: () => open(false) },

            /*
             * Tiedot on nyt oikeasti eri teko kuin Avaa.
             *
             * Avaa vie tiedoston omaan välilehteensä ja pois listasta.
             * Tiedot näyttää sen sivun reunassa: kuka toi, kuinka iso,
             * milloin viimeksi katsottu, ja itse sisältö niin että
             * listaan jää sormi väliin.
             */
            { label: t.tiedosto.details, onClick: onDetails },

            { label: t.tiedosto.download, onClick: () => open(true) },

            /*
             * Sijainti vain silloin kun tiedosto näkyy kansionsa
             * ulkopuolella.
             *
             * Hakutuloksessa ja koontinäkymissä käyttäjä on löytänyt
             * tiedoston muttei tiedä missä se asuu. Kansiolistassa
             * kohta olisi tarjous siirtyä sinne missä ollaan jo.
             */
            ...(showPath && onShowLocation
              ? [{ label: t.tiedosto.showLocation, onClick: onShowLocation }]
              : []),
            ...(canManage
              ? [
                  { label: t.tiedosto.rename, onClick: onRename },
                  { label: t.tiedosto.move, onClick: onMove },
                  { label: t.tiedosto.expiry, onClick: onExpiry },
                  { label: t.tiedosto.linkSupplier, onClick: onLink },
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
      )}
    </li>
  );
}

/**
 * Voimassaolon merkintä.
 *
 * Kolme väriä kolmelle tilalle. Vanhentunut on punainen koska se on
 * ongelma nyt; pian vanheneva keltainen koska se on ongelma pian;
 * voimassa oleva harmaa koska se ei ole ongelma — mutta se näkyy silti,
 * jotta käyttäjä tietää merkinnän olevan tehty.
 */
function ExpiryPill({
  t,
  state,
  days,
}: {
  t: AdminText;
  state: ExpiryState;
  days: number;
}) {
  const label =
    state === "expired"
      ? t.tiedosto.expired
      : days === 0
        ? t.tiedosto.expiresToday
        : state === "soon"
          ? fill(t.tiedosto.expiresInDays, { maara: String(days) })
          : t.tiedosto.expiryValid;

  const palette =
    state === "expired"
      ? { bg: "var(--rf-red-bg)", fg: "var(--rf-red-text)" }
      : state === "soon"
        ? { bg: "var(--rf-amber-bg)", fg: "var(--rf-amber-text)" }
        : { bg: "var(--rf-inset)", fg: "var(--rf-text-3)" };

  return (
    <span
      className="shrink-0 whitespace-nowrap px-2 py-0.5 text-[11.5px] font-semibold"
      style={{
        background: palette.bg,
        color: palette.fg,
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      {label}
    </span>
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
      className="rf-enter m-auto max-h-[85dvh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto p-0 backdrop:bg-black/40"
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

  const here = folderPath(folders, folderId, t.tiedosto) || t.tiedosto.root;

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
              <span className="truncate">
                {folderPath(folders, folder.id, t.tiedosto)}
              </span>
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
        <p className="text-[13.5px]">{folderLabel(folder, t.tiedosto)}</p>

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
        {`${folderLabel(folder, t.tiedosto)} · ${fill(t.tiedosto.fileCount, { maara: String(contents) })}`}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Button
            tone="secondary"
            full
            type="button"
            onClick={() => onConfirm("keep")}
          >
            {t.tiedosto.keepFiles}
          </Button>
          <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {t.tiedosto.keepFilesHelp}
          </p>
        </div>

        <div>
          <label className="block">
            <span
              className="text-[12.5px]"
              style={{ color: "var(--rf-text-2)" }}
            >
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

/**
 * Voimassaolon asetus.
 *
 * Natiivi päivämääräkenttä: selain osaa sen omalla kielellään, ja
 * puhelimessa se avaa järjestelmän oman valitsimen.
 *
 * Tyhjentäminen on yhtä helppoa kuin asettaminen. Väärin merkitty
 * voimassaolo on huonompi kuin merkitsemätön: se varoittaa väärästä
 * asiasta ja opettaa ohittamaan varoitukset.
 */
function ExpiryDialog({
  t,
  file,
  onClose,
  onSave,
}: {
  t: AdminText;
  file: FileRow;
  onClose: () => void;
  onSave: (date: string | null) => void;
}) {
  const [date, setDate] = useState(file.expiresOn ?? "");

  return (
    <Modal title={t.tiedosto.expiry} onClose={onClose}>
      <p className="mb-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {file.name}
      </p>

      <label className="block">
        <span className="text-[13px] font-semibold">{t.tiedosto.expiry}</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 h-[42px] w-full px-3 text-[14px] outline-none"
          style={{
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-field)",
            color: "var(--rf-text)",
          }}
        />
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.tiedosto.expiryHint}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button tone="ghost" type="button" onClick={onClose}>
          {t.tiedosto.cancel}
        </Button>

        {file.expiresOn ? (
          <Button tone="ghost" type="button" onClick={() => onSave(null)}>
            {t.tiedosto.expiryNone}
          </Button>
        ) : null}

        <Button
          tone="primary"
          type="button"
          disabled={date === ""}
          onClick={() => onSave(date || null)}
        >
          {t.tiedosto.save}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Tiedoston liittäminen toimittajaan.
 *
 * Sopimus, hinnasto tai reklamaatio löytyy sen jälkeen toimittajan
 * omalta sivulta. Kaappi ei katoa mihinkään — tiedosto on yhä siellä
 * missä käyttäjä sen pani.
 *
 * Toimittajat haetaan vasta avattaessa: niitä voi olla satoja, eikä
 * niitä kannata kuljettaa jokaisen rivin mukana.
 */
function LinkDialog({
  t,
  file,
  onClose,
  onPick,
}: {
  t: AdminText;
  file: FileRow;
  onClose: () => void;
  onPick: (supplierId: string | null) => void;
}) {
  const [choices, setChoices] = useState<SupplierChoice[] | null>(null);

  useEffect(() => {
    let voimassa = true;
    void supplierChoices().then((list) => {
      if (voimassa) setChoices(list);
    });

    return () => {
      voimassa = false;
    };
  }, []);

  return (
    <Modal title={t.tiedosto.linkSupplier} onClose={onClose}>
      <p className="mb-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {file.name}
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
            className="w-full px-3 py-2.5 text-left text-[13.5px] font-semibold"
            style={{
              color: file.supplierId ? "var(--rf-text)" : "var(--rf-accent)",
            }}
          >
            {t.tiedosto.noSupplier}
          </button>
        </li>

        {(choices ?? []).map((choice) => (
          <li key={choice.id} style={{ borderTop: "1px solid var(--rf-line)" }}>
            <button
              type="button"
              onClick={() => onPick(choice.id)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13.5px]"
              style={{
                color:
                  choice.id === file.supplierId
                    ? "var(--rf-accent)"
                    : "var(--rf-text)",
              }}
            >
              <span className="truncate">{choice.name}</span>
              {choice.id === file.supplierId ? (
                <RfIcon name="check" size={14} />
              ) : null}
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

// ---------------------------------------------------------------------------
// Lataus
// ---------------------------------------------------------------------------

/**
 * Yksi rivi valittua tiedostoa kohden.
 *
 * folderId null tarkoittaa "sama kuin ylhaalla valittu": kayttaja voi
 * vaihtaa kohteen kaikille kerralla, eika tunnistamattomien rivien
 * tarvitse toistaa sita erikseen.
 */
interface UploadRow {
  name: string;
  folderId: string | null;
  /** Mita Kate arveli asiakirjan olevan. */
  title: string | null;
  supplierId: string | null;
  expiresOn: string | null;
  tila: "kesken" | "valmis" | "eiTunnistettu" | "ohitettu";
}
/**
 * Tiedoston lataus.
 *
 * Selain lataa suoraan storageen omalla istunnollaan, ja vasta sen
 * jälkeen palvelin kirjaa rivin. Kahdenkymmenenviiden megatavun
 * tiedoston kierrättäminen palvelinfunktion muistin kautta olisi
 * hitaampaa ja kaatuisi suurimpiin.
 *
 * ---------------------------------------------------------------------
 * YKSI JA MONTA OVAT SAMA POLKU
 * ---------------------------------------------------------------------
 *
 * Jokainen valittu tiedosto saa oman rivinsä: nimen, kansion ja tiedon
 * siitä mitä Kate arveli sen olevan. Yhden tiedoston lataus on lista
 * jossa on yksi rivi.
 *
 * Aiemmin tunnistus koski vain yhtä tiedostoa kerrallaan. Se oli
 * väärinpäin: yksi paperi on jo nyt helppo arkistoida, mutta
 * laatikollinen ei ole — ja juuri laatikollinen on se syy miksi paperit
 * jäävät laatikkoon.
 */
/*
 * Kuinka monta luetaan kerralla.
 *
 * Kolmekymmentä on kuukauden kuitit tai kansiollinen sopimuksia -- se
 * mita ravintoloitsija oikeasti kantaa kerralla koneelle. Rinnakkaisia
 * lukuja on kolme, joten se on noin minuutti odotusta.
 *
 * Sadan lukeminen kestaisi neljä minuuttia. Se ei ole odottamista vaan
 * poistumista koneelta, ja palatessa puolet olisi ehtinyt epaonnistua
 * ilman etta kukaan naki miksi.
 *
 * Raja ei estä lataamista. Loput menevat kaappiin omilla nimillaan,
 * kuten ennen tunnistusta kaikki menivat -- ja ne voi nimeta myohemmin
 * yksi kerrallaan.
 */
const READ_LIMIT = 30;

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

  const [rows, setRows] = useState<UploadRow[]>([]);

  /* Yhdelle tiedostolle voimassaolo on oma kenttänsä. */
  const [expires, setExpires] = useState("");

  const single = chosen.length === 1;

  /*
   * Automaattinen luku alkaa valinnasta.
   *
   * Tila johdetaan riveistä eikä aseteta efektissä: rivi on joko
   * luettu, epäonnistunut tai vielä kesken.
   */
  const chosenKey = chosen.map((file) => `${file.name}:${file.size}`).join("|");
  const [chosenBefore, setChosenBefore] = useState<string | null>(null);

  if (chosenKey !== chosenBefore) {
    setChosenBefore(chosenKey);
    setExpires("");
    setRows(
      chosen.map((file, index) => ({
        name: file.name,
        folderId: null,
        title: null,
        supplierId: null,
        expiresOn: null,
        tila: index < READ_LIMIT ? ("kesken" as const) : ("ohitettu" as const),
      })),
    );
  }

  const reading = rows.some((rivi) => rivi.tila === "kesken");

  /*
   * Edistyminen lasketaan vain luettavista.
   *
   * Rajan yli menevät rivit ovat valmiita heti, eikä "30 / 60 luettu"
   * heti alussa kerro edistymisestä vaan hämmennyksestä.
   */
  const luettavat = rows.filter((rivi) => rivi.tila !== "ohitettu");
  const readCount = luettavat.filter((rivi) => rivi.tila !== "kesken").length;

  useEffect(() => {
    if (!reading || chosen.length === 0) return;

    let voimassa = true;

    void (async () => {
      /* Jono: vain ne rivit joita ei ole vielä luettu. */
      const jono: number[] = [];
      for (let i = 0; i < Math.min(chosen.length, READ_LIMIT); i++)
        jono.push(i);

      let seuraava = 0;

      async function lue(index: number): Promise<void> {
        const file = chosen[index];
        if (!file) return;

        try {
          const body = new FormData();
          body.set("file", file);
          body.set("nimi", file.name);

          const response = await fetch("/api/tiedostot/ehdotus", {
            method: "POST",
            body,
          });

          const data = (await response.json()) as {
            proposal?: {
              title: string | null;
              name: string | null;
              folderId: string | null;
              expiresOn: string | null;
              supplierId: string | null;
              supplierName: string | null;
              sure: boolean;
            } | null;
          };

          if (!voimassa) return;

          const ehdotus = data.proposal;

          setRows((edelliset) => {
            /*
             * Nimi joka ei osu toisen rivin nimeen.
             *
             * Kaksi laskua samalta toimittajalta samana päivänä saa
             * mallilta saman nimen, ja ilman numerointia kaappiin
             * päätyisi kaksi tiedostoa joita ei voi erottaa.
             */
            const varatut = edelliset
              .filter((_, i) => i !== index)
              .map((rivi) => rivi.name);

            return edelliset.map((rivi, i) => {
              if (i !== index || rivi.tila !== "kesken") return rivi;
              if (!ehdotus) return { ...rivi, tila: "eiTunnistettu" as const };

              return {
                ...rivi,
                /*
                 * Käyttäjän oma kirjoitus voittaa.
                 *
                 * Luku kestää sekunteja, ja sinä aikana ehtii nimetä
                 * itse. Vastauksen ei pidä pyyhkiä sitä yli.
                 */
                name:
                  rivi.name === file.name
                    ? uniqueName(ehdotus.name ?? rivi.name, varatut)
                    : rivi.name,
                folderId: ehdotus.folderId ?? rivi.folderId,
                title: ehdotus.title,
                supplierId: ehdotus.supplierId,
                expiresOn: ehdotus.expiresOn,
                tila: "valmis" as const,
              };
            });
          });
        } catch {
          if (!voimassa) return;
          setRows((edelliset) =>
            edelliset.map((rivi, i) =>
              i === index && rivi.tila === "kesken"
                ? { ...rivi, tila: "eiTunnistettu" as const }
                : rivi,
            ),
          );
        }
      }

      /*
       * Enintään kolme lukua rinnakkain.
       *
       * Yksitellen kolmenkymmenen paperin lukeminen kestäisi
       * minuutteja. Kaikki kerralla kuormittaisi mallia ja verkkoa
       * turhaan, ja epäonnistuisi juuri silloin kun kuvia on eniten.
       */
      async function tyontekija(): Promise<void> {
        while (voimassa && seuraava < jono.length) {
          const index = jono[seuraava];
          seuraava += 1;
          await lue(index);
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(3, jono.length) }, () => tyontekija()),
      );
    })();

    return () => {
      voimassa = false;
    };
  }, [chosenKey, reading, chosen]);

  /*
   * Yhden tiedoston voimassaolo tulee luvusta.
   *
   * Monelle sitä ei kysytä: laatikollisella kuitteja ei ole yhteistä
   * voimassaoloa, ja jokaisen kysyminen erikseen tekisi
   * tarkistuslistasta lomakkeen.
   */
  const ehdotettuPaiva = single ? (rows[0]?.expiresOn ?? null) : null;
  const [expiryFrom, setExpiryFrom] = useState<string | null>(null);

  if (ehdotettuPaiva && expiryFrom !== chosenKey) {
    setExpiryFrom(chosenKey);
    if (expires === "") setExpires(ehdotettuPaiva);
  }

  async function send(): Promise<void> {
    if (chosen.length === 0) return;

    setBusy(true);
    setError(null);

    const supabase = createClient();

    for (const [index, file] of chosen.entries()) {
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
       * lukee pääsyn juuri siitä. Nimenä tunniste eikä käyttäjän antama
       * nimi: kaksi samannimistä tiedostoa eivät korvaa toisiaan, eikä
       * polusta voi päätellä sisältöä.
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

      const rivi = rows[index];

      const result = await registerFile({
        folderId: rivi?.folderId ?? target,
        name: rivi?.name.trim() || file.name,
        path,
        type,
        size: file.size,
        expiresOn: single && expires !== "" ? expires : null,
        supplierId: rivi?.supplierId ?? null,
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

  const here = folderPath(folders, target, t.tiedosto) || t.tiedosto.root;

  function paivitaRivi(index: number, muutos: Partial<UploadRow>): void {
    setRows((edelliset) =>
      edelliset.map((rivi, i) => (i === index ? { ...rivi, ...muutos } : rivi)),
    );
  }

  return (
    <Modal title={t.tiedosto.uploadTitle} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-[13px] font-semibold">
            {t.tiedosto.savedTo}
          </span>
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
                {folderPath(folders, folder.id, t.tiedosto)}
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
          <span className="text-[13px] font-semibold">
            {t.tiedosto.chooseFile}
          </span>
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

        {/*
          Kamera omana kenttänään.

          capture="environment" avaa puhelimessa takakameran suoraan.
          Paperi joka tulee keittiöön menee kaappiin siinä paikassa eikä
          "kunhan ehdin skannata".
        */}
        <label className="block">
          <span className="text-[13px] font-semibold">
            {t.tiedosto.takePhoto}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) =>
              setChosen(Array.from(event.target.files ?? []))
            }
            className="mt-1 block w-full text-[13px]"
          />
        </label>

        {/*
          Lukemisen edistyminen.

          Kolmenkymmenen paperin luku kestää, ja hiljaisuus näyttäisi
          siltä ettei mitään tapahdu. Luku kertoo missä mennään.
        */}
        {reading ? (
          <p
            className="px-3 py-2 text-[12.5px]"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "var(--rf-r-card)",
            }}
          >
            {single
              ? t.tiedosto.proposing
              : fill(t.tiedosto.readingCount, {
                  luettu: String(readCount),
                  kaikki: String(luettavat.length),
                })}
          </p>
        ) : null}

        {/*
          Raja sanotaan ääneen ennen kuin siihen törmää.

          Ilman tätä käyttäjä selaisi listaa ja ihmettelisi miksi
          loppupää on nimetty toisin kuin alkupää. Lause kertoo myös
          sen mikä ei mene pieleen: kaikki tallentuvat silti.
        */}
        {chosen.length > READ_LIMIT ? (
          <p
            className="px-3 py-2 text-[12.5px]"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "var(--rf-r-card)",
            }}
          >
            {fill(t.tiedosto.readLimit, { maara: String(READ_LIMIT) })}
          </p>
        ) : null}

        {rows.map((rivi, index) => {
          const file = chosen[index];
          if (!file) return null;

          return (
            <div
              key={`${file.name}-${index}`}
              className="space-y-1.5"
              style={
                single || index === 0
                  ? undefined
                  : {
                      borderTop: "1px solid var(--rf-line)",
                      paddingTop: "0.75rem",
                    }
              }
            >
              <label className="block">
                <span className="text-[13px] font-semibold">
                  {t.tiedosto.nameLabel}
                </span>
                <input
                  value={rivi.name}
                  onChange={(event) =>
                    paivitaRivi(index, { name: event.target.value })
                  }
                  maxLength={200}
                  className="mt-1 h-[42px] w-full px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    border: "1px solid var(--rf-line)",
                    borderRadius: "var(--rf-r-field)",
                    color: "var(--rf-text)",
                  }}
                />
              </label>

              {/*
                Kansio riveittäin vasta kun tiedostoja on monta.

                Yhdelle ylhäällä oleva valinta on jo kansio, eikä samaa
                asiaa kysytä kahdesti.
              */}
              {single ? null : (
                <select
                  value={rivi.folderId ?? ""}
                  aria-label={t.tiedosto.savedTo}
                  onChange={(event) =>
                    paivitaRivi(index, { folderId: event.target.value || null })
                  }
                  className="h-[38px] w-full px-2 text-[13px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    border: "1px solid var(--rf-line)",
                    borderRadius: "var(--rf-r-field)",
                    color: "var(--rf-text)",
                  }}
                >
                  <option value="">{here}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folderPath(folders, folder.id, t.tiedosto)}
                    </option>
                  ))}
                </select>
              )}

              <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                {[
                  formatFileSize(file.size, tag),
                  rivi.tila === "kesken"
                    ? t.tiedosto.proposing
                    : rivi.tila === "ohitettu"
                      ? t.tiedosto.notRead
                      : rivi.tila === "eiTunnistettu"
                        ? t.tiedosto.noProposal
                        : rivi.title
                          ? fill(t.tiedosto.looksLike, { mika: rivi.title })
                          : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          );
        })}

        {/*
          Voimassaolo vain yhdelle tiedostolle.

          Laatikollisella kuitteja ei ole yhteistä voimassaoloa, ja
          jokaisen kysyminen erikseen tekisi tarkistuslistasta lomakkeen.
          Yksittäiselle luvalle se on juuri se kenttä jonka takia
          tiedosto tallennetaan.
        */}
        {single ? (
          <label className="block">
            <span className="text-[13px] font-semibold">
              {t.tiedosto.expiry}
            </span>
            <input
              type="date"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
              className="mt-1 h-[42px] w-full px-3 text-[14px] outline-none"
              style={{
                background: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-field)",
                color: "var(--rf-text)",
              }}
            />
            <span
              className="mt-1 block text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {t.tiedosto.expiryHint}
            </span>
          </label>
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

          {/*
            Lataus odottaa lukemisen loppuun.

            Muuten tiedostot tallentuisivat alkuperäisillä nimillään
            juuri ennen kuin ehdotukset ehtivät kenttiin.
          */}
          <Button
            tone="primary"
            type="button"
            onClick={() => void send()}
            disabled={busy || reading || chosen.length === 0}
          >
            {busy ? t.tiedosto.uploading : t.tiedosto.upload}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tietopaneeli
// ---------------------------------------------------------------------------

/**
 * Tiedosto sivun reunassa.
 *
 * Ennen tätä ainoa tapa katsoa tiedostoa oli avata se uuteen
 * välilehteen. Kymmenen kuitin läpikäynti oli kymmenen välilehteä,
 * kymmenen paluuta ja kymmenen kertaa saman listan etsimistä
 * uudelleen. Nyt lista pysyy paikallaan ja sisältö vaihtuu viereen.
 *
 * ---------------------------------------------------------------------
 * ESIKATSELU KULKEE SAMASTA REITISTÄ KUIN AVAUS
 * ---------------------------------------------------------------------
 *
 * /api/tiedostot/<tunnus> tarkistaa kirjautumisen ja jäsenyyden joka
 * kerta. Erillinen esikatselureitti olisi toinen paikka jossa sama
 * tarkistus pitäisi muistaa tehdä — ja se on juuri se paikka josta se
 * jonain päivänä unohtuisi.
 *
 * Kuva ja PDF näytetään, muut eivät. Word-tiedostosta selain ei osaa
 * piirtää mitään, ja tyhjä harmaa laatikko on huonompi kuin rehellinen
 * lause siitä ettei esikatselua ole.
 */
function DetailsPanel({
  t,
  tag,
  locale,
  today,
  file,
  path,
  onClose,
}: {
  t: AdminText;
  tag: string;
  locale: AppLocale;
  today: string;
  file: FileRow;
  path: string;
  onClose: () => void;
}) {
  const kind = fileKind(file.type, file.name);
  const url = `/api/tiedostot/${file.id}`;

  /*
   * Escape sulkee.
   *
   * Paneeli ei ole dialogi, joten selain ei tee tätä puolesta. Ilman
   * sitä ainoa tapa sulkea olisi osua pieneen ruksiin.
   */
  useEffect(() => {
    function nappain(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", nappain);
    return () => window.removeEventListener("keydown", nappain);
  }, [onClose]);

  const rivit: { label: string; value: string }[] = [
    { label: t.tiedosto.location, value: path || t.tiedosto.root },
    { label: t.tiedosto.fileType, value: extensionOf(file.name) || file.type },
    { label: t.tiedosto.fileSize, value: formatFileSize(file.size, tag) },
    {
      label: t.tiedosto.addedOn,
      value: formatDayIn(file.createdAt.slice(0, 10), locale),
    },
    ...(file.uploadedBy
      ? [{ label: t.tiedosto.addedBy, value: file.uploadedBy }]
      : []),
    ...(file.expiresOn
      ? [
          {
            label: t.tiedosto.expiry,
            value: formatDayIn(file.expiresOn, locale),
          },
        ]
      : []),
  ];

  const avattu = ageText(file.lastOpenedAt, today, t.tiedosto, (day) =>
    formatDayIn(day, locale),
  );

  if (typeof document === "undefined") return null;

  /*
   * Portaali dokumentin juureen.
   *
   * Ilman sitä paneeli jäi sivun sisältölaatikon sisään: fixed
   * asemoituu lähimpään muunnettuun esivanhempaan, ja sivun
   * sisääntuloanimaatio on juuri sellainen. Paneeli näkyi keskellä
   * ruutua puolikkaana laatikkona.
   */
  return createPortal(
    <>
      <button
        type="button"
        aria-label={t.tiedosto.close}
        onClick={onClose}
        className="rf-z-panel-backdrop fixed inset-0"
        style={{ background: "rgba(17, 19, 24, 0.35)" }}
      />

      <aside
        className="rf-z-panel rf-enter fixed inset-0 flex flex-col sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l"
        style={{
          background: "var(--rf-card)",
          borderColor: "var(--rf-line)",
          boxShadow: "var(--rf-shadow-lg)",
        }}
        aria-label={t.tiedosto.details}
      >
        <div
          className="flex items-start gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--rf-line)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{file.name}</p>
            {avattu ? (
              <p
                className="text-[12.5px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {`${t.tiedosto.recentlyUsed}: ${avattu}`}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.tiedosto.close}
            className="rf-press flex h-9 w-9 shrink-0 items-center justify-center"
            style={{ borderRadius: "50%", color: "var(--rf-text-2)" }}
          >
            <RfIcon name="close" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/*
          Esikatselu ensin.

          Käyttäjä avasi paneelin nähdäkseen tiedoston, ei lukeakseen
          sen kokoa tavuina.
        */}
          <div
            className="flex items-center justify-center p-4"
            style={{ background: "var(--rf-inset)", minHeight: "220px" }}
          >
            {kind === "image" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={url}
                alt={file.name}
                className="max-h-[52vh] w-auto max-w-full"
                style={{ borderRadius: "var(--rf-r-card)" }}
              />
            ) : kind === "pdf" ? (
              <iframe
                src={url}
                title={file.name}
                className="h-[52vh] w-full"
                style={{
                  border: "1px solid var(--rf-line)",
                  borderRadius: "var(--rf-r-card)",
                  background: "var(--rf-card)",
                }}
              />
            ) : (
              <p
                className="max-w-xs text-center text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {t.tiedosto.noPreview}
              </p>
            )}
          </div>

          <dl className="px-4 py-3">
            {rivit.map((rivi) => (
              <div
                key={rivi.label}
                className="flex gap-3 py-1.5 text-[13.5px]"
                style={{ borderBottom: "1px solid var(--rf-line)" }}
              >
                <dt
                  className="w-32 shrink-0"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {rivi.label}
                </dt>
                <dd className="min-w-0 flex-1 break-words font-medium">
                  {rivi.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="flex gap-2 px-4 py-3"
          style={{ borderTop: "1px solid var(--rf-line)" }}
        >
          <Button
            tone="ghost"
            size="sm"
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            {t.tiedosto.openInTab}
          </Button>

          <Button
            tone="ghost"
            size="sm"
            type="button"
            onClick={() => {
              const link = document.createElement("a");
              link.href = `${url}?lataa=1`;
              link.rel = "noopener";
              link.click();
            }}
          >
            {t.tiedosto.download}
          </Button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
