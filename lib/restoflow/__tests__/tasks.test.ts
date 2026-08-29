import { describe, expect, it } from "vitest";
import {
  activeReminders,
  countTasks,
  daysLate,
  groupTasks,
  isOpen,
  nextDue,
  sortTasks,
  statusOf,
  type Task,
} from "../tasks";

const TODAY = "2026-08-26";

function task(partial: Partial<Task> = {}): Task {
  return {
    id: "t1",
    restaurantId: "r",
    title: "Maksa vuokra",
    description: null,
    dueOn: TODAY,
    dueTime: null,
    priority: "normal",
    visibility: "managers",
    assignedTo: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    recurrence: "none",
    parentTaskId: null,
    remindDaysBefore: [1],
    remindOnDue: true,
    remindWhenOverdue: true,
    createdBy: "u1",
    createdAt: "2026-08-01T10:00:00.000Z",
    ...partial,
  };
}

describe("statusOf", () => {
  it("tunnistaa tulevan", () => {
    expect(statusOf(task({ dueOn: "2026-08-30" }), TODAY)).toBe("upcoming");
  });

  it("tunnistaa tänään erääntyvän", () => {
    expect(statusOf(task({ dueOn: TODAY }), TODAY)).toBe("due_today");
  });

  it("tunnistaa myöhässä olevan", () => {
    expect(statusOf(task({ dueOn: "2026-08-25" }), TODAY)).toBe("overdue");
  });

  /*
   * Tehty ja peruttu voittavat päivämäärän.
   *
   * Peruttua tehtävää ei ole tarkoitus tehdä, eikä tehty muutu
   * myöhässä olevaksi seuraavana päivänä.
   */
  it("ei nosta tehtyä myöhässä olevaksi", () => {
    const done = task({
      dueOn: "2026-08-01",
      completedAt: "2026-08-01T12:00:00.000Z",
    });
    expect(statusOf(done, TODAY)).toBe("completed");
  });

  it("ei nosta peruttua myöhässä olevaksi", () => {
    const cancelled = task({
      dueOn: "2026-08-01",
      cancelledAt: "2026-08-01T12:00:00.000Z",
    });
    expect(statusOf(cancelled, TODAY)).toBe("cancelled");
  });

  /*
   * Kellonaika ratkaisee päivän sisällä.
   *
   * Ilman kellonaikaa tehtävä on ajallaan koko päivän. Kellonajan
   * kanssa se myöhästyy sinä hetkenä — muuten klo 15 määräaika ei
   * tarkoittaisi mitään.
   */
  it("myöhästyy kellonajan jälkeen samana päivänä", () => {
    const t = task({ dueOn: TODAY, dueTime: "15:00" });

    expect(statusOf(t, TODAY, "14:59")).toBe("due_today");
    expect(statusOf(t, TODAY, "15:01")).toBe("overdue");
  });

  it("on ajallaan koko päivän ilman kellonaikaa", () => {
    expect(statusOf(task({ dueOn: TODAY }), TODAY, "23:59")).toBe("due_today");
  });
});

describe("daysLate", () => {
  it("laskee myöhästymisen päivinä", () => {
    expect(daysLate(task({ dueOn: "2026-08-25" }), TODAY)).toBe(1);
    expect(daysLate(task({ dueOn: "2026-08-20" }), TODAY)).toBe(6);
  });

  it("on nolla kun ei ole myöhässä", () => {
    expect(daysLate(task({ dueOn: TODAY }), TODAY)).toBe(0);
    expect(daysLate(task({ dueOn: "2026-09-01" }), TODAY)).toBe(0);
  });

  it("on nolla tehdylle", () => {
    const done = task({
      dueOn: "2026-08-01",
      completedAt: "2026-08-02T10:00:00.000Z",
    });
    expect(daysLate(done, TODAY)).toBe(0);
    expect(isOpen(done)).toBe(false);
  });
});

describe("countTasks", () => {
  it("laskee tilat ja huomiota vaativat", () => {
    const counts = countTasks(
      [
        task({ id: "a", dueOn: "2026-08-24" }),
        task({ id: "b", dueOn: "2026-08-25" }),
        task({ id: "c", dueOn: TODAY }),
        task({ id: "d", dueOn: "2026-09-01" }),
        task({ id: "e", completedAt: "2026-08-20T10:00:00.000Z" }),
        task({ id: "f", cancelledAt: "2026-08-20T10:00:00.000Z" }),
      ],
      TODAY,
    );

    expect(counts.overdue).toBe(2);
    expect(counts.dueToday).toBe(1);
    expect(counts.upcoming).toBe(1);
    expect(counts.completed).toBe(1);
    expect(counts.cancelled).toBe(1);
    expect(counts.needsAttention).toBe(3);
  });
});

describe("sortTasks", () => {
  it("nostaa myöhässä olevat ensin ja vanhimman kärkeen", () => {
    const sorted = sortTasks(
      [
        task({ id: "tuleva", dueOn: "2026-09-01" }),
        task({ id: "tanaan", dueOn: TODAY }),
        task({ id: "myohassa-uusi", dueOn: "2026-08-25" }),
        task({ id: "myohassa-vanha", dueOn: "2026-08-10" }),
      ],
      TODAY,
    );

    expect(sorted.map((t) => t.id)).toEqual([
      "myohassa-vanha",
      "myohassa-uusi",
      "tanaan",
      "tuleva",
    ]);
  });

  it("nostaa kriittisen saman päivän normaalin edelle", () => {
    const sorted = sortTasks(
      [
        task({ id: "normaali", priority: "normal" }),
        task({ id: "kriittinen", priority: "critical" }),
        task({ id: "tarkea", priority: "important" }),
      ],
      TODAY,
    );

    expect(sorted.map((t) => t.id)).toEqual([
      "kriittinen",
      "tarkea",
      "normaali",
    ]);
  });
});

describe("groupTasks", () => {
  it("jättää tyhjät ryhmät pois", () => {
    const groups = groupTasks([task({ dueOn: TODAY })], TODAY);

    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe("due_today");
  });

  it("järjestää ryhmät kiireellisyyden mukaan", () => {
    const groups = groupTasks(
      [
        task({ id: "a", dueOn: "2026-09-01" }),
        task({ id: "b", dueOn: "2026-08-20" }),
        task({ id: "c", dueOn: TODAY }),
      ],
      TODAY,
    );

    expect(groups.map((g) => g.status)).toEqual([
      "overdue",
      "due_today",
      "upcoming",
    ]);
  });
});

describe("activeReminders", () => {
  it("muistuttaa asetettuina päivinä ennen", () => {
    const reminders = activeReminders(
      [task({ dueOn: "2026-08-28", remindDaysBefore: [2, 1] })],
      TODAY,
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0].kind).toBe("before");
    expect(reminders[0].days).toBe(2);
    expect(reminders[0].text).toContain("2 päivän päästä");
  });

  it("sanoo huomenna eikä yhden päivän päästä", () => {
    const reminders = activeReminders(
      [task({ dueOn: "2026-08-27", remindDaysBefore: [1] })],
      TODAY,
    );

    expect(reminders[0].text).toContain("huomenna");
  });

  it("vaikenee päivinä joita ei ole valittu", () => {
    expect(
      activeReminders(
        [task({ dueOn: "2026-08-29", remindDaysBefore: [1] })],
        TODAY,
      ),
    ).toEqual([]);
  });

  it("muistuttaa eräpäivänä", () => {
    const reminders = activeReminders([task({ dueOn: TODAY })], TODAY);

    expect(reminders[0].kind).toBe("due");
    expect(reminders[0].text).toContain("erääntyy tänään");
  });

  it("muistuttaa myöhässä olevasta", () => {
    const reminders = activeReminders([task({ dueOn: "2026-08-24" })], TODAY);

    expect(reminders[0].kind).toBe("overdue");
    expect(reminders[0].days).toBe(-2);
    expect(reminders[0].text).toContain("myöhässä 2 päivää");
  });

  it("kunnioittaa käyttäjän asetuksia", () => {
    expect(
      activeReminders([task({ dueOn: TODAY, remindOnDue: false })], TODAY),
    ).toEqual([]);

    expect(
      activeReminders(
        [task({ dueOn: "2026-08-20", remindWhenOverdue: false })],
        TODAY,
      ),
    ).toEqual([]);
  });

  it("ei muistuta tehdystä eikä perutusta", () => {
    expect(
      activeReminders(
        [
          task({
            id: "a",
            dueOn: "2026-08-20",
            completedAt: "2026-08-20T10:00:00.000Z",
          }),
          task({
            id: "b",
            dueOn: "2026-08-20",
            cancelledAt: "2026-08-20T10:00:00.000Z",
          }),
        ],
        TODAY,
      ),
    ).toEqual([]);
  });

  it("järjestää myöhässä olevat ensin", () => {
    const reminders = activeReminders(
      [
        task({ id: "tuleva", dueOn: "2026-08-27", remindDaysBefore: [1] }),
        task({ id: "myohassa", dueOn: "2026-08-24" }),
        task({ id: "tanaan", dueOn: TODAY }),
      ],
      TODAY,
    );

    expect(reminders.map((r) => r.task.id)).toEqual([
      "myohassa",
      "tanaan",
      "tuleva",
    ]);
  });
});

describe("nextDue", () => {
  it("laskee päivittäisen ja viikoittaisen", () => {
    expect(nextDue("2026-08-26", "daily")).toBe("2026-08-27");
    expect(nextDue("2026-08-26", "weekly")).toBe("2026-09-02");
  });

  it("laskee kuukausittaisen samalle päivälle", () => {
    expect(nextDue("2026-08-05", "monthly")).toBe("2026-09-05");
  });

  /*
   * 31.1. + kuukausi ei ole 31.2.
   *
   * Postgresin interval-laskenta rajaa kuukauden viimeiseen päivään,
   * ja tämän on tehtävä sama — muuten näyttö ja kanta eroaisivat
   * juuri niinä kuukausina joina asia huomataan.
   */
  it("rajaa kuukauden viimeiseen päivään", () => {
    expect(nextDue("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDue("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  it("laskee vuosittaisen", () => {
    expect(nextDue("2026-08-26", "yearly")).toBe("2027-08-26");
  });

  it("ei anna seuraavaa kun tehtävä ei toistu", () => {
    expect(nextDue("2026-08-26", "none")).toBeNull();
  });

  it("kestää vuodenvaihteen", () => {
    expect(nextDue("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(nextDue("2026-12-31", "daily")).toBe("2027-01-01");
  });
});
