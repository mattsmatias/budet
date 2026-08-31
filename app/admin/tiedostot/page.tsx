import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import {
  crumbsFor,
  loadExpiring,
  loadFavorites,
  loadFiles,
  loadFolders,
  loadRecent,
  loadTrash,
  purgeExpiredTrash,
  searchFiles,
} from "@/lib/restoflow/file-queries";
import {
  filesHref,
  folderLabel,
  sortFiles,
  sortFolders,
  type FileRow,
  type FileSort,
  type FolderRow,
  type FolderSort,
} from "@/lib/restoflow/files";
import { RfIcon } from "@/components/restoflow/icons";
import { EmptyState } from "@/components/restoflow/ui";
import { FileBrowser } from "./browser";
import { SearchBox } from "./search";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.nav.files };
}

type View = "all" | "favorites" | "recent" | "expiring" | "trash";

const VIEWS: View[] = ["all", "favorites", "recent", "expiring", "trash"];

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Ravintolan tiedostokaappi.
 *
 * Kansiot ja tiedostot ovat samaa järjestelmää: kansiolla ei ole
 * tyyppiä eikä tiedostolla kansiosidonnaista tarkoitusta. Kate luo
 * lähtökansiot, mutta rakenne on siitä hetkestä lähtien ravintolan oma
 * — yksi järjestää vuosittain, toinen aihepiireittäin, kolmas ei
 * ollenkaan, ja kaikkien on toimittava.
 *
 * ---------------------------------------------------------------------
 * TILA ON OSOITTEESSA
 * ---------------------------------------------------------------------
 *
 * Kansio, näkymä, haku ja lajittelu ovat kaikki osoiteparametreja.
 * Silloin kansioon voi linkittää, selaimen paluunappi toimii, ja
 * sivun päivitys ei vie takaisin juureen. Sama tila selaimen muistissa
 * olisi vähemmän koodia ja enemmän rikki.
 */
export default async function FilesPage({
  searchParams,
}: PageProps<"/admin/tiedostot">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;
  const params = await searchParams;
  const { restaurant, role, today } = await adminContext("/admin/tiedostot");

  const canManage = can(role, "files.manage");

  const folderId = str(params.kansio) || null;
  const term = str(params.haku).trim();
  const requested = str(params.nakyma) as View;
  const view: View = VIEWS.includes(requested) ? requested : "all";

  const fileSort = (str(params.jarjesta) || "added") as FileSort;
  const folderSort = (str(params.kansiot) || "custom") as FolderSort;

  /*
   * Haku ohittaa näkymän.
   *
   * Kirjoitettu hakusana on aina tuoreempi aikomus kuin valittu
   * välilehti. Jos haku näyttäisi tulokset välilehden sisällä,
   * käyttäjä etsisi tiedostoa "tärkeistä" eikä löytäisi sitä, koska se
   * ei ole tähdellä.
   */
  const searching = term !== "";

  /*
   * Roskakori siivoaa itsensä avattaessa.
   *
   * Kysely eikä toiminto: toiminnot kutsuvat revalidatePathia, ja sen
   * kutsuminen kesken tämän sivun renderöinnin kaataa koko pyynnön.
   * Sivunlataus ei tarvitse mitätöintiä — se on jo lataamassa tuoretta
   * tietoa.
   */
  if (view === "trash" && canManage) await purgeExpiredTrash(restaurant.id, 30);

  const trash = view === "trash" ? await loadTrash(restaurant.id) : null;

  const [folders, files] = await Promise.all([
    loadFolders(restaurant.id),
    searching
      ? searchFiles(restaurant.id, term)
      : view === "favorites"
        ? loadFavorites(restaurant.id)
        : view === "recent"
          ? loadRecent(restaurant.id, 30)
          : view === "expiring"
            ? loadExpiring(restaurant.id)
            : view === "trash"
              ? Promise.resolve((trash?.files ?? []) as FileRow[])
              : loadFiles(restaurant.id, folderId),
  ]);

  /* Murupolku puusta: kannan nimi ei tiedä käyttäjän kieltä. */
  const crumbs = searching || view !== "all" ? [] : crumbsFor(folders, folderId);

  /*
   * Kansiot vain omassa näkymässään.
   *
   * Tähdet, viimeksi lisätyt ja haku kertovat tiedostoista eri
   * puolilta puuta. Kansiorivi niiden seassa tarkoittaisi eri asiaa
   * kuin listan muut rivit.
   */
  const visibleFolders =
    searching || view !== "all"
      ? []
      : sortFolders(
          folders.filter((folder) => folder.parentId === folderId),
          folderSort,
          tag,
          t.tiedosto,
        );

  const visibleFiles =
    searching || view === "expiring" || view === "trash"
      ? files
      : sortFiles(files, view === "all" ? fileSort : "added", tag);

  const current = folderId ? folders.find((f) => f.id === folderId) : undefined;

  /*
   * Poistettu kansio osoitteessa.
   *
   * Toinen käyttäjä on voinut poistaa kansion sillä välin kun tämä
   * sivu oli auki. Tyhjä lista näyttäisi siltä että kansio on tyhjä,
   * ja käyttäjä lataisi tiedoston paikkaan jota ei ole.
   */
  if (folderId && !current && !searching && view === "all") {
    return (
      <div className="rf-enter space-y-5">
        <Header
          t={t}
          term={term}
          canManage={canManage}
          folderId={folderId}
        />
        <EmptyState
          title={t.tiedosto.errorGeneric}
          description={t.tiedosto.emptyFolder}
        />
      </div>
    );
  }

  return (
    <div className="rf-enter space-y-5">
      <Header t={t} term={term} canManage={canManage} folderId={folderId} />

      {/* Välilehdet piiloon haun ajaksi: haku kattaa jo koko kaapin. */}
      {searching ? null : <Tabs t={t} view={view} folderId={folderId} />}

      {searching ? (
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {visibleFiles.length === 1
            ? t.tiedosto.searchHitOne
            : fill(t.tiedosto.searchHits, {
                maara: String(visibleFiles.length),
              })}
        </p>
      ) : view === "all" ? (
        <Breadcrumb
          t={t}
          crumbs={crumbs}
          fileSort={fileSort}
          folderSort={folderSort}
        />
      ) : null}

      <FileBrowser
        t={t}
        tag={tag}
        canManage={canManage}
        restaurantId={restaurant.id}
        folderId={folderId}
        folders={folders}
        visibleFolders={visibleFolders}
        files={visibleFiles}
        view={searching ? "search" : view}
        term={term}
        fileSort={fileSort}
        folderSort={folderSort}
        today={today}
        locale={locale}
        trashFolders={trash?.folders ?? []}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Haku
// ---------------------------------------------------------------------------

/**
 * Sivu ei kirjoita omaa otsikkoaan.
 *
 * Yläpalkki lukee nimen reitistä (page-title.tsx), joten sivun oma
 * otsikko oli sama sana kahdesti allekkain. Kaksi totuutta samasta
 * nimestä ajautuu myös erilleen: valikossa lukisi yhtä ja otsikossa
 * toista, eikä kumpikaan olisi väärin omalla tavallaan.
 *
 * ---------------------------------------------------------------------
 * HAKU ON TAVALLINEN GET-LOMAKE
 * ---------------------------------------------------------------------
 *
 * Se toimii ilman JavaScriptiä, tulos on linkitettävissä ja selaimen
 * paluunappi vie takaisin listaan. Näppäilyn mukana hakeva kenttä
 * olisi näyttävämpi ja tekisi kyselyn joka kirjaimesta.
 */
function Header({
  t,
  term,
  canManage,
  folderId,
}: {
  t: ReturnType<typeof adminText>;
  term: string;
  canManage: boolean;
  folderId: string | null;
}) {
  return (
    <div className="space-y-3">
      {/*
        Lukuoikeuden huomautus jää.

        Se ei ole sivun kuvaus vaan vastaus kysymykseen miksi
        painikkeita ei näy. Kirjanpitäjä on ainoa joka näkee tämän.
      */}
      {canManage ? null : (
        <p className="text-[13.5px]" style={{ color: "var(--rf-text-2)" }}>
          {t.tiedosto.readOnly}
        </p>
      )}

      <SearchBox t={t} term={term} folderId={folderId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Välilehdet
// ---------------------------------------------------------------------------

function Tabs({
  t,
  view,
  folderId,
}: {
  t: ReturnType<typeof adminText>;
  view: View;
  folderId: string | null;
}) {
  const items: { id: View; label: string; href: string }[] = [
    {
      id: "all",
      label: t.tiedosto.tabAll,
      /* Kaikki-välilehti palaa siihen kansioon jossa oltiin. */
      href: filesHref({ folderId }),
    },
    {
      id: "favorites",
      label: t.tiedosto.tabFavorites,
      href: filesHref({ view: "favorites" }),
    },
    {
      id: "recent",
      label: t.tiedosto.tabRecent,
      href: filesHref({ view: "recent" }),
    },
    {
      id: "expiring",
      label: t.tiedosto.tabExpiring,
      href: filesHref({ view: "expiring" }),
    },
    {
      id: "trash",
      label: t.tiedosto.tabTrash,
      href: filesHref({ view: "trash" }),
    },
  ];

  return (
    <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((item) => {
        const on = item.id === view;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className="rf-press px-3.5 py-1.5 text-[13px] font-semibold"
            style={{
              background: on ? "var(--rf-accent)" : "var(--rf-inset)",
              color: on ? "var(--rf-on-accent)" : "var(--rf-text-2)",
              borderRadius: "var(--rf-r-pill)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Murupolku
// ---------------------------------------------------------------------------

/**
 * Kaikki tasot ovat linkkejä.
 *
 * Neljän tason syvyydestä juureen pitäisi muuten palata neljä kertaa
 * takaisin — tai selaimen paluunapilla, joka veisi myös haun ja
 * välilehden taakse.
 */
function Breadcrumb({
  t,
  crumbs,
  fileSort,
  folderSort,
}: {
  t: ReturnType<typeof adminText>;
  crumbs: FolderRow[];
  fileSort: FileSort;
  folderSort: FolderSort;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-[13px]"
      style={{ color: "var(--rf-text-2)" }}
      aria-label={t.tiedosto.title}
    >
      <Link
        href={filesHref({ fileSort, folderSort })}
        className="rf-press font-semibold"
      >
        {t.tiedosto.root}
      </Link>

      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb.id} className="flex items-center gap-1">
            <span style={{ color: "var(--rf-text-3)" }}>
              <RfIcon name="chevron" size={13} />
            </span>
            {last ? (
              <span
                className="font-semibold"
                style={{ color: "var(--rf-text)" }}
                aria-current="page"
              >
                {folderLabel(crumb, t.tiedosto)}
              </span>
            ) : (
              <Link
                href={filesHref({
                  folderId: crumb.id,
                  fileSort,
                  folderSort,
                })}
                className="rf-press font-semibold"
              >
                {folderLabel(crumb, t.tiedosto)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
