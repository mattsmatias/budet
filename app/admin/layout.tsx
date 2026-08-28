import Link from "next/link";
import { requireContext } from "@/lib/restoflow/session";
import { fetchRestaurantData } from "@/lib/restoflow/queries";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { buildBriefing, greeting } from "@/lib/matti/briefing";
import { monthIn, nowIso, todayIn } from "@/lib/restoflow/clock-context";
import { needsReview } from "@/lib/restoflow/expenses";
import { NAV_SECTIONS, adminNavFor, can } from "@/lib/restoflow/permissions";
import { countTasks } from "@/lib/restoflow/tasks";
import { POSITION_LABELS } from "@/lib/restoflow/types";
import { AdminNav } from "./nav";
import { HeaderMenus } from "./header-menus";
import { TopBar } from "./topbar";
import { MobileMonthBar } from "./month-scope";
import { resolveLocale } from "@/lib/i18n/resolve";
import type { SearchItem } from "./search";
import type { StaffPosition } from "@/lib/restoflow/types";

/**
 * Managerin kuori.
 *
 * Sivupalkki työpöydällä, alapalkki puhelimessa. Puhelimessa on lisäksi
 * yläpalkki, koska muuten ravintolan nimi ja uloskirjautuminen jäisivät
 * kokonaan näkymättä.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, restaurant, role } = await requireContext("/admin");

  const data = await fetchRestaurantData(restaurant.id);
  const month = monthIn(restaurant.timezone);
  const today = todayIn(restaurant.timezone);
  const now = nowIso();

  const alerts = buildAlerts({
    receipts: data.receipts,
    budgets: data.budgets,
    shifts: data.shifts,
    users: data.users,
    clockEvents: data.clockEvents,
    absences: data.absences,
    month,
    today,
    now,
    timezone: restaurant.timezone,
    openShifts: data.openShifts,
    sales: data.sales,
    tasks: data.tasks,
  });

  /*
   * Matin tilannekatsaus.
   *
   * Samasta buildAlerts-tuloksesta kuin kellon merkki ja Ilmoitukset,
   * joten Matti ei voi kertoa eri tilannetta kuin muu sovellus.
   * Havainnot lasketaan tässä eikä selaimessa: koko aineisto on jo
   * palvelimella, eikä sitä kannata lähettää mukana.
   */
  const briefing = buildBriefing({
    alerts,
    receipts: data.receipts,
    sales: data.sales,
    shifts: data.shifts,
    today,
  });

  const userName = user.fullName ?? user.email ?? "Käyttäjä";

  /*
   * Valittavat kuukaudet: kuluvasta taaksepäin vuosi.
   *
   * Lista on kuoressa eikä sivulla, koska valitsin on nyt palkissa ja
   * palkki on kaikilla sivuilla sama.
   */
  const months: string[] = [];
  {
    let cursor = month;
    for (let i = 0; i < 13; i += 1) {
      months.push(cursor);
      const [year, m] = cursor.split("-").map(Number);
      cursor =
        m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, "0")}`;
    }
  }

  /*
   * Valikon luvut.
   *
   * Vain se mikä odottaa ihmistä. Kuittien kokonaismäärä ei kuulu
   * tähän: se ei vaadi mitään, ja luku joka ei vaadi mitään opettaa
   * ohittamaan myös ne jotka vaativat.
   */
  /*
   * Tehtävien merkki kertoo vain huomiota vaativista.
   *
   * Myöhässä olevat ja tänään erääntyvät. Tulevien määrä ei kuulu
   * merkkiin: se ei vaadi tänään mitään, ja luku joka ei vaadi
   * mitään opettaa ohittamaan myös ne jotka vaativat.
   */
  const counts: Record<string, number> = {
    "/admin/kuitit": needsReview(data.receipts).length,
    "/admin/tyovuorot": data.openShifts.filter((s) => s.date >= today).length,
    "/admin/tehtavat": countTasks(data.tasks, today).needsAttention,
  };

  return (
    /*
     * Kaksi saraketta: kisko ja työalue.
     *
     * Levykuori oli tässä hetken. Yläpalkki on nyt itse pinta, ja
     * kaksi reunusta sisäkkäin söi leveyttä ilman että kumpikaan
     * kertoi mitään.
     */
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <AdminNav
          role={role}
          counts={counts}
          restaurantName={restaurant.name}
          briefing={briefing}
          greeting={greeting(new Date(now), restaurant.timezone)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
        {/* Yläpalkki vain puhelimessa: työpöydällä sama tieto on sivupalkissa. */}
        <header
          className="rf-no-print rf-z-chrome sticky top-0 flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden"
          style={{
            borderColor: "var(--rf-line)",
            background: "rgba(255,255,255,0.86)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
          }}
        >
          <Link href="/admin" className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{restaurant.name}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {userName}
            </p>
          </Link>
          <HeaderMenus
            alerts={alerts}
            userName={userName}
            restaurantName={restaurant.name}
            role={role}
            canOpenSettings={can(role, "settings.view")}
          />
        </header>

        {/*
          Kuukausi puhelimessa.

          Työpöydän yläpalkki on md:flex, joten sen valitsin katosi
          kapealla ruudulla kokonaan — kuukautta ei päässyt vaihtamaan
          Kuluilla, Palkoilla, Raportoinnissa eikä millään muullakaan
          kuukausisivulla. Oma rivi näkyy vain niillä sivuilla joilla
          valitsin oikeasti tekee jotain.
        */}
        <MobileMonthBar value={month} months={months} />

        {/*
          Työpöydän yläpalkki.

          Palkki ja sisältö jakavat saman pehmusteen levyn reunasta,
          joten painikkeet ja korttien oikea reuna ovat samassa
          pystylinjassa.
        */}
        <TopBar
          restaurantName={restaurant.name}
          date={longDate(now, restaurant.timezone)}
          alerts={alerts}
          userName={userName}
          role={role}
          search={searchItems(role, data.suppliers, data.users)}
          canAddReceipt={can(role, "receipts.add")}
          canOpenSettings={can(role, "settings.view")}
          months={months}
          month={month}
          locale={await resolveLocale()}
        />

        <main className="w-full flex-1 px-4 py-5 pb-24 md:px-6 md:pb-10 md:pt-5">
          {children}
        </main>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * "MA 24.08.2026" — ravintolan ajassa.
 *
 * Murupolku oli "Maanantaina 24. elokuuta 2026", ja se vei puolet
 * palkin vasemmasta reunasta sivun nimeltä. Päivämäärä on palkissa
 * kiintopiste eikä luettava lause: lyhennetty viikonpäivä ja numerot
 * kertovat saman kahdessatoista merkissä.
 */
function longDate(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("fi-FI", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(iso));

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  // fi-FI antaa lyhyen viikonpäivän muodossa "ma" — pisteineen tai ilman.
  const weekday = get("weekday").replace(".", "").toUpperCase();

  return `${weekday} ${get("day")}.${get("month")}.${get("year")}`;
}


/**
 * Haun sisältö.
 *
 * Sivut roolin mukaan, toimittajat ja työntekijät. Kaikki on jo haettu
 * tähän näkymään, joten haku ei tee yhtään lisäkyselyä.
 *
 * Työntekijät vain jos rooli saa nähdä heidät. Kirjanpitäjä ei saa
 * löytää henkilöstöä haun kautta silloin kun hän ei näe sitä sivuakaan.
 */
function searchItems(
  role: Parameters<typeof adminNavFor>[0],
  suppliers: { id: string; name: string }[],
  users: { id: string; name: string; position: StaffPosition | null; active: boolean }[],
): SearchItem[] {
  const sectionLabel = new Map(NAV_SECTIONS.map((s) => [s.id, s.label]));

  const pages: SearchItem[] = adminNavFor(role).map((entry) => ({
    id: `page-${entry.href}`,
    label: entry.label,
    // Osaston nimi eikä polku: "/admin/kuitit" on osoite, ei selitys.
    detail: sectionLabel.get(entry.section) ?? "Hallinta",
    href: entry.href,
    icon: entry.icon,
    group: "Sivu",
  }));

  const supplierItems: SearchItem[] = can(role, "suppliers.view")
    ? suppliers.map((supplier) => ({
        id: `supplier-${supplier.id}`,
        label: supplier.name,
        detail: "Toimittaja",
        href: `/admin/toimittajat/${supplier.id}`,
        icon: "suppliers" as const,
        group: "Toimittaja",
      }))
    : [];

  const staffItems: SearchItem[] = can(role, "staff.view")
    ? users
        .filter((person) => person.active)
        .map((person) => ({
          id: `staff-${person.id}`,
          label: person.name,
          detail: person.position ? POSITION_LABELS[person.position] : "Työntekijä",
          href: "/admin/tyontekijat",
          icon: "staff" as const,
          group: "Henkilö",
        }))
    : [];

  return [...pages, ...supplierItems, ...staffItems];
}
