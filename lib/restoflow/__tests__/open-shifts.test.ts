import { describe, expect, it } from "vitest";
import { claimableShifts, overlapsAny, OPEN_SHIFT_HORIZON_DAYS } from "../open-shifts";
import type { OpenShift, Shift, StaffPosition } from "../types";

/*
 * Avoimet vuorot työntekijän näkökulmasta.
 *
 * Sama sääntö on claim_open_shift-funktiossa (migraatio 0034). Nämä
 * testit kuvaavat mitä käyttöliittymä näyttää; kanta on se joka
 * lopulta ratkaisee. Kumpikin voi olla väärässä yksin, ja siksi
 * molemmat ovat olemassa.
 *
 * Helsinki on elokuussa UTC+3, joten paikallinen 12:00 on 09:00Z.
 */

const ZONE = "Europe/Helsinki";
const TODAY = "2026-08-24";
const NOON = `${TODAY}T09:00:00.000Z`;

function open(partial: Partial<OpenShift> = {}): OpenShift {
  return {
    id: "o1",
    restaurantId: "r1",
    date: "2026-08-26",
    startTime: "10:00",
    endTime: "18:00",
    position: "waiter",
    status: "draft", breakMinutes: 0, note: null, publishedAt: "2026-08-01T00:00:00.000Z", cancelledAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function mine(partial: Partial<Shift> = {}): Shift {
  return {
    id: "s1",
    restaurantId: "r1",
    userId: "u1",
    date: "2026-08-26",
    startTime: "10:00",
    endTime: "18:00",
    location: "Sali",
    breakMinutes: 0, note: null, publishedAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z", cancelledAt: null,
    status: "accepted",
    ...partial,
  };
}

function claimable(input: {
  openShifts?: OpenShift[];
  myShifts?: Shift[];
  position?: StaffPosition | null;
  nowIso?: string;
}) {
  return claimableShifts({
    openShifts: input.openShifts ?? [open()],
    myShifts: input.myShifts ?? [],
    position: input.position === undefined ? "waiter" : input.position,
    nowIso: input.nowIso ?? NOON,
    timezone: ZONE,
  });
}

const ids = (shifts: OpenShift[]) => shifts.map((s) => s.id);

// ---------------------------------------------------------------------------

describe("asema", () => {
  it("näyttää oman aseman vuorot", () => {
    expect(ids(claimable({}))).toEqual(["o1"]);
  });

  /*
   * Kokki ei näe salin vuoroja. Näkyvyysrajaus on parempi kuin
   * virheilmoitus painalluksen jälkeen: sitä mitä ei näe, ei tarvitse
   * selittää.
   */
  it("ei näytä toisen aseman vuoroja", () => {
    expect(claimable({ position: "kitchen" })).toEqual([]);
  });

  /*
   * Omistaja joka ei ole työsuhteessa on jäsen ilman asemaa. Hän ei
   * kuulu vuorolistalle pelkän jäsenyyden perusteella — sama sääntö
   * kuin palkanlaskennassa.
   */
  it("ei näytä mitään jäsenelle jolla ei ole asemaa", () => {
    expect(claimable({ position: null })).toEqual([]);
  });
});

describe("aika", () => {
  it("ei näytä mennyttä vuoroa", () => {
    expect(claimable({ openShifts: [open({ date: "2026-08-20" })] })).toEqual([]);
  });

  it("ei näytä tänään jo päättynyttä vuoroa", () => {
    // Kello on 12:00 paikallista, vuoro päättyi 11:00.
    const done = open({ date: TODAY, startTime: "06:00", endTime: "11:00" });
    expect(claimable({ openShifts: [done] })).toEqual([]);
  });

  /*
   * Kesken olevan vuoron voi ottaa. Jos joku ei tullut, se vuoro on
   * juuri se joka pitää saada tehdyksi — eikä hälytys "vuorolle ei ole
   * tekijää" johda mihinkään jos vuoro katoaa listasta sillä
   * sekunnilla kun se alkaa.
   */
  it("näyttää kesken olevan vuoron", () => {
    const running = open({ date: TODAY, startTime: "10:00", endTime: "18:00" });
    expect(ids(claimable({ openShifts: [running] }))).toEqual(["o1"]);
  });

  it("ei näytä liian kaukaista vuoroa", () => {
    const far = open({ date: "2026-12-24" });
    expect(claimable({ openShifts: [far] })).toEqual([]);
  });

  it("näyttää vuoron aivan näköpiirin rajalla", () => {
    const edge = open({ date: addDays(TODAY, OPEN_SHIFT_HORIZON_DAYS) });
    expect(ids(claimable({ openShifts: [edge] }))).toEqual(["o1"]);
  });

  /*
   * Päivä luetaan ravintolan ajassa. 21:30Z on Helsingissä jo
   * seuraavan päivän puolella, ja UTC:stä luettuna tämän päivän vuoro
   * näyttäisi menneeltä.
   */
  it("lukee päivän ravintolan ajassa", () => {
    const tonight = open({ date: "2026-08-25", startTime: "10:00", endTime: "18:00" });
    // 2026-08-24T21:30Z = 25.8. klo 00:30 paikallista.
    const result = claimable({ openShifts: [tonight], nowIso: "2026-08-24T21:30:00.000Z" });

    expect(ids(result)).toEqual(["o1"]);
  });
});

describe("päällekkäisyys", () => {
  it("ei näytä vuoroa joka osuu oman vuoron päälle", () => {
    expect(claimable({ myShifts: [mine()] })).toEqual([]);
  });

  it("näyttää vuoron joka alkaa oman vuoron jälkeen", () => {
    const after = open({ startTime: "18:00", endTime: "22:00" });
    expect(ids(claimable({ openShifts: [after], myShifts: [mine()] }))).toEqual(["o1"]);
  });

  it("näyttää saman päivän vuoron eri aikaan", () => {
    const morning = mine({ startTime: "06:00", endTime: "10:00" });
    expect(ids(claimable({ myShifts: [morning] }))).toEqual(["o1"]);
  });

  /*
   * Hylätty vuoro ei varaa aikaa. Muuten "en pääse" -ilmoitus estäisi
   * työntekijää ottamasta korvaavaa vuoroa samalta päivältä.
   */
  it("ei anna hylätyn vuoron estää", () => {
    expect(ids(claimable({ myShifts: [mine({ status: "declined" })] }))).toEqual(["o1"]);
  });

  /*
   * Yön yli menevä vuoro ulottuu seuraavaan päivään. Pelkkä
   * päivävertailu ei näkisi tätä päällekkäisyyttä ollenkaan.
   */
  it("huomaa edellisen yön vuoron jatkumisen", () => {
    const nightBefore = mine({ date: "2026-08-25", startTime: "22:00", endTime: "06:00" });
    const early = open({ date: "2026-08-26", startTime: "05:00", endTime: "13:00" });

    expect(overlapsAny(early, [nightBefore])).toBe(true);
    expect(claimable({ openShifts: [early], myShifts: [nightBefore] })).toEqual([]);
  });

  it("ei sekoita kahden päivän päässä olevaa vuoroa", () => {
    const farAway = mine({ date: "2026-08-28" });
    expect(overlapsAny(open(), [farAway])).toBe(false);
  });

  // Raja on tiukka: vuoro joka alkaa täsmälleen edellisen päättyessä ei
  // ole päällekkäinen.
  it("sallii vuoron joka alkaa täsmälleen edellisen päättyessä", () => {
    const before = mine({ startTime: "06:00", endTime: "10:00" });
    expect(overlapsAny(open(), [before])).toBe(false);
  });
});

describe("järjestys", () => {
  it("järjestää päivän ja alkuajan mukaan", () => {
    const shifts = [
      open({ id: "myohemmin", date: "2026-08-27", startTime: "10:00" }),
      open({ id: "ilta", date: "2026-08-26", startTime: "17:00" }),
      open({ id: "aamu", date: "2026-08-26", startTime: "08:00", endTime: "12:00" }),
    ];

    expect(ids(claimable({ openShifts: shifts }))).toEqual([
      "aamu",
      "ilta",
      "myohemmin",
    ]);
  });
});

// ---------------------------------------------------------------------------

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
