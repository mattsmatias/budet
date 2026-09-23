/**
 * Työtunnit ja arvioitu palkkakulu.
 *
 * ARVIO EI OLE PALKKA.
 *
 * Tunnit kertaa tuntipalkka kertoo mitä työ suunnilleen maksoi. Se on
 * käytettävissä heti kuun aikana, kun palkkalaskelma tulee vasta
 * jälkikäteen. Siitä puuttuvat TES-lisät, sairausajan palkka,
 * lomakorvaukset ja työnantajan sivukulut — ne kuuluvat
 * palkkapalveluun, eikä Kate teeskentele laskevansa niitä.
 *
 * Tämän tiedoston funktiot ovat puhtaita: ne saavat rivit ja
 * palauttavat luvut. Kellonaika ja aikavyöhyke on ratkaistu jo
 * kannassa, jossa vuoron päivä lasketaan yrityksen ajassa.
 */

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
  /** Tuntipalkka sentteinä. */
  hourlyCents: number;
  active: boolean;
  /** Onko työntekijälle liitetty kirjautumistunnus. */
  linked: boolean;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  /** Vuoron päivä yrityksen aikavyöhykkeellä, ISO-muodossa. */
  date: string;
  clockIn: string;
  clockOut: string | null;
  /** Kesto minuutteina, tai null kun vuoro on kesken. */
  minutes: number | null;
}

/** Koko nimi listaukseen. */
export function fullName(employee: {
  firstName: string;
  lastName: string;
}): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

/**
 * Kesken oleva vuoro, tai null.
 *
 * Kantaan mahtuu vain yksi kesken oleva vuoro työntekijää kohti, joten
 * ensimmäinen löytynyt on se ainoa.
 */
export function openEntry(entries: TimeEntry[]): TimeEntry | null {
  return entries.find((e) => e.clockOut === null) ?? null;
}

/**
 * Kertyneet minuutit.
 *
 * Kesken oleva vuoro ei ole mukana: sen kesto kasvaa joka sekunti, ja
 * luku joka muuttuu itsestään ei ole sama luku kahdella laitteella.
 * Vuoro lasketaan kun se on päättynyt.
 */
export function totalMinutes(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
}

/**
 * Arvioitu palkkakulu sentteinä.
 *
 * Pyöristetään vasta lopussa: minuutti kerrallaan pyöristäminen
 * kerryttäisi virhettä, ja kuukauden lopussa se näkyisi euroina.
 */
export function estimatedPayCents(
  minutes: number,
  hourlyCents: number,
): number {
  if (minutes <= 0 || hourlyCents <= 0) return 0;
  return Math.round((minutes / 60) * hourlyCents);
}

/**
 * Tunnit ja minuutit: 450 minuuttia on "7 h 30 min".
 *
 * PYÖRISTETTY TUNTI EI TÄSMÄÄ KUSTANNUKSEN KANSSA.
 *
 * Aiemmin tässä näytettiin yksi desimaali. 23 minuutin vuoro näkyi
 * silloin muodossa "0,4 h", ja sen vieressä luki kustannus 7,63 € ja
 * 19,90 €/h — kertolasku ei täsmännyt, koska näytetty tuntimäärä oli
 * pyöristetty ja kustannus laskettu oikeista minuuteista. Tarkka
 * kesto poistaa ristiriidan ilman että laskentaa muutetaan.
 */
export function formatHours(minutes: number, locale: string): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (hours === 0) return `${rest.toLocaleString(locale)} min`;
  if (rest === 0) return `${hours.toLocaleString(locale)} h`;

  return `${hours.toLocaleString(locale)} h ${rest.toLocaleString(locale)} min`;
}

/** Kellonaika hh:mm yrityksen ajassa. */
export function formatClock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

export interface EmployeeSummary {
  employee: Employee;
  minutes: number;
  payCents: number;
  /** Onko vuoro käynnissä juuri nyt. */
  working: boolean;
}

/**
 * Työntekijät kuukauden tunteineen.
 *
 * Passiivinen työntekijä pysyy listassa jos hänellä on kuukauden
 * tunteja: tehty työ ei katoa siitä että joku merkitään
 * ei-aktiiviseksi. Ilman tunteja hän jää pois.
 */
export function summarise(
  employees: Employee[],
  entries: TimeEntry[],
  month: string,
): EmployeeSummary[] {
  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const working = new Set(
    entries.filter((e) => e.clockOut === null).map((e) => e.employeeId),
  );

  return employees
    .map((employee) => {
      const mine = inMonth.filter((e) => e.employeeId === employee.id);
      const minutes = totalMinutes(mine);

      return {
        employee,
        minutes,
        payCents: estimatedPayCents(minutes, employee.hourlyCents),
        working: working.has(employee.id),
      };
    })
    .filter((row) => row.employee.active || row.minutes > 0)
    .sort((a, b) => {
      if (a.working !== b.working) return a.working ? -1 : 1;
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      return fullName(a.employee).localeCompare(fullName(b.employee), "fi");
    });
}

export interface StaffTotals {
  minutes: number;
  payCents: number;
  /** Montako on vuorossa juuri nyt. */
  working: number;
}

export function totals(rows: EmployeeSummary[]): StaffTotals {
  return {
    minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
    payCents: rows.reduce((sum, r) => sum + r.payCents, 0),
    working: rows.filter((r) => r.working).length,
  };
}

/**
 * Tuntipalkka tekstistä sentteinä, tai null.
 *
 * Suomalainen pilkku ja kansainvälinen piste kelpaavat molemmat:
 * puhelimen näppäimistö tarjoaa jompaakumpaa eikä käyttäjä valitse
 * kumpaa.
 */
export function parseHourly(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > 100000) return null;

  return cents;
}
