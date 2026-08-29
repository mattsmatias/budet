import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { fetchTasks } from "@/lib/restoflow/queries";
import { countTasks, isOpen, statusOf, type Task } from "@/lib/restoflow/tasks";
import { RfIcon } from "@/components/restoflow/icons";
import { MetricCard } from "@/components/restoflow/ui";
import { NewTask } from "./new-task";
import { TaskList } from "./task-list";
import { TaskCalendar } from "./task-calendar";

export const metadata = { title: "Tehtävät" };

/**
 * Tehtävät.
 *
 * KATE EI VAIN SÄILYTÄ TEHTÄVIÄ.
 *
 * Lista on väline, ei tarkoitus. Tarkoitus on että määräaika ei mene
 * ohi: siksi näkymä alkaa siitä mikä on myöhässä tai erääntyy tänään,
 * ja vasta sen jälkeen tulee kaikki muu.
 */
export default async function TasksPage({
  searchParams,
}: PageProps<"/admin/tehtavat">) {
  const { restaurant, role, users, today } =
    await adminContext("/admin/tehtavat");

  const params = await searchParams;
  const filter =
    typeof params.suodatin === "string" ? params.suodatin : "avoimet";
  const view = params.nakyma === "kalenteri" ? "kalenteri" : "lista";
  const search = typeof params.haku === "string" ? params.haku.trim() : "";

  const all = await fetchTasks(restaurant.id);
  const counts = countTasks(all, today);
  const canManage = can(role, "tasks.manage");

  const filtered = all
    .filter((task) => matchesFilter(task, filter, today))
    .filter((task) => matchesSearch(task, search));

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {counts.needsAttention === 0
            ? "Ei mitään erääntymässä tänään"
            : `${counts.needsAttention} vaatii huomiota`}
        </p>

        {canManage ? <NewTask users={users} today={today} /> : null}
      </div>

      {/*
        Kolme lukua ennen listaa.

        Ravintoloitsija kysyy "onko jotain hoitamatta", ei "mitä
        listalla on". Luvut vastaavat siihen ennen kuin listaa
        tarvitsee lukea, ja jokainen niistä on linkki omaan
        suodattimeensa.
      */}
      <section
        aria-label="Tehtävien tilanne"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-3"
      >
        <Luku
          label="Myöhässä"
          value={counts.overdue}
          tone="risk"
          href="/admin/tehtavat?suodatin=myohassa"
          hint={
            counts.overdue === 0 ? "Ei myöhässä olevia" : "Eräpäivä on mennyt"
          }
        />
        <Luku
          label="Erääntyy tänään"
          value={counts.dueToday}
          tone="warn"
          href="/admin/tehtavat?suodatin=tanaan"
          hint={
            counts.dueToday === 0
              ? "Ei tämän päivän tehtäviä"
              : "Hoidettava tänään"
          }
        />
        <Luku
          label="Tulevat"
          value={counts.upcoming}
          tone="info"
          href="/admin/tehtavat?suodatin=tulevat"
          hint="Eräpäivä edessä"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Suodattimet" className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <Suodatin
              key={item.key}
              label={item.label}
              href={`/admin/tehtavat?suodatin=${item.key}${
                view === "kalenteri" ? "&nakyma=kalenteri" : ""
              }`}
              active={filter === item.key}
            />
          ))}
        </nav>

        <div
          className="flex items-center gap-0.5 p-0.5"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <Valinta
            href={`/admin/tehtavat?suodatin=${filter}`}
            label="Lista"
            active={view === "lista"}
          />
          <Valinta
            href={`/admin/tehtavat?suodatin=${filter}&nakyma=kalenteri`}
            label="Kalenteri"
            active={view === "kalenteri"}
          />
        </div>
      </div>

      {/*
        Haku on lomake eikä kirjoittaessa suodattuva kenttä.

        Palvelin renderöi listan, joten jokainen näppäinpainallus olisi
        pyyntö. Enter riittää: hakua käytetään kun etsitään jotain
        tiettyä, ei selatessa.
      */}
      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="suodatin" value={filter} />
        {view === "kalenteri" ? (
          <input type="hidden" name="nakyma" value="kalenteri" />
        ) : null}

        <input
          type="search"
          name="haku"
          defaultValue={search}
          placeholder="Hae tehtävää…"
          aria-label="Hae tehtävää"
          className="min-w-0 flex-1 px-3.5 py-2 text-[13px]"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        />

        <button
          type="submit"
          className="rf-press px-3.5 py-2 text-[13px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Hae
        </button>

        {search !== "" ? (
          <Link
            href={`/admin/tehtavat?suodatin=${filter}`}
            className="rf-press px-2 py-2 text-[12.5px] font-semibold"
            style={{ color: "var(--rf-text-2)" }}
          >
            Tyhjennä
          </Link>
        ) : null}
      </form>

      {view === "kalenteri" ? (
        <TaskCalendar tasks={filtered} today={today} />
      ) : (
        <TaskList
          tasks={filtered}
          users={users}
          today={today}
          canManage={canManage}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const FILTERS = [
  { key: "avoimet", label: "Avoimet" },
  { key: "tanaan", label: "Tänään" },
  { key: "myohassa", label: "Myöhässä" },
  { key: "tulevat", label: "Tulevat" },
  { key: "tehdyt", label: "Tehdyt" },
  { key: "kaikki", label: "Kaikki" },
];

function matchesFilter(task: Task, filter: string, today: string): boolean {
  const status = statusOf(task, today);

  switch (filter) {
    case "tanaan":
      return status === "due_today";
    case "myohassa":
      return status === "overdue";
    case "tulevat":
      return status === "upcoming";
    case "tehdyt":
      return status === "completed" || status === "cancelled";
    case "kaikki":
      return true;
    default:
      // Avoimet on oletus: tehdyt ja perutut eivät vaadi mitään.
      return isOpen(task);
  }
}

function matchesSearch(task: Task, search: string): boolean {
  if (search === "") return true;

  const term = search.toLowerCase();

  return (
    task.title.toLowerCase().includes(term) ||
    (task.description ?? "").toLowerCase().includes(term)
  );
}

/**
 * Tehtävien avainluku.
 *
 * SAMA KORTTI KUIN MUUALLA.
 *
 * Tämä oli oma kappaleensa: MetricCardin typografia kopioituna
 * tavallisen Cardin sisään. Reunus, kulmasäde ja varjo tulivat siis
 * eri lähteestä kuin Kuluilla ja Palkoilla, ja ero näkyi sivua
 * vaihtaessa.
 *
 * Väri kertoo edelleen tilan, mutta samalla tavalla kuin muualla:
 * ikonilaatta ja jalkateksti, ei itse luku.
 */
function Luku({
  label,
  value,
  tone,
  hint,
  href,
}: {
  label: string;
  value: number;
  tone: "risk" | "warn" | "info";
  hint: string;
  href: string;
}) {
  /*
   * Väri vain kun luku on nollaa suurempi.
   *
   * Nolla myöhässä on hyvä uutinen, ja punainen nolla lukisi
   * hälytyksenä. Väri kertoo tilasta, ei kortin tunnisteesta.
   */
  const active = value > 0;
  const sävy = tone === "risk" ? "bad" : tone === "warn" ? "warn" : "blue";

  return (
    <MetricCard
      label={label}
      value={value}
      hint={hint}
      href={href}
      tone={active ? sävy : "neutral"}
      tileTone={active ? sävy : "muted"}
      icon={
        <RfIcon
          name={
            tone === "risk" ? "alert" : tone === "warn" ? "clock" : "calendar"
          }
          size={17}
        />
      }
    />
  );
}

function Suodatin({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--rf-accent-bg)" : "var(--rf-inset)",
        color: active ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {label}
    </Link>
  );
}

function Valinta({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--rf-card)" : "transparent",
        color: active ? "var(--rf-text)" : "var(--rf-text-2)",
        borderRadius: "calc(var(--rf-r-control) - 2px)",
        boxShadow: active ? "var(--rf-shadow-sm)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}
