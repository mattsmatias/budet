import { describe, expect, it } from "vitest";
import { matchDetections, type DetectedTable } from "../floor-plan-ai";
import type { PlanTable } from "../floor-plan";

function poyta(id: string, name: string): PlanTable {
  return {
    id,
    name,
    areaId: null,
    seatsMin: 2,
    seatsMax: 4,
    active: true,
    posX: null,
    posY: null,
    shape: "round",
    rotation: 0,
  };
}

function loydetty(osat: Partial<DetectedTable> = {}): DetectedTable {
  return {
    x: 50,
    y: 50,
    shape: "round",
    label: null,
    seats: null,
    ...osat,
  };
}

describe("matchDetections", () => {
  it("sitoo pöydän nimen mukaan", () => {
    const tulos = matchDetections(
      [
        loydetty({ label: "12", x: 20, y: 30 }),
        loydetty({ label: "13", x: 40, y: 30 }),
      ],
      [poyta("a", "Pöytä 12"), poyta("b", "Pöytä 13")],
    );

    expect(tulos.matched.map((m) => [m.name, m.x])).toEqual([
      ["Pöytä 12", 20],
      ["Pöytä 13", 40],
    ]);
    expect(tulos.matched.every((m) => m.by === "label")).toBe(true);
    expect(tulos.missing).toEqual([]);
    expect(tulos.extra).toEqual([]);
  });

  it("lukee nimen samaksi vaikka muoto eroaa", () => {
    /* "Pöytä 12", "12" ja "TABLE 12" ovat sama pöytä. */
    const tulos = matchDetections(
      [loydetty({ label: "Table 12" })],
      [poyta("a", "Pöytä 12")],
    );

    expect(tulos.matched).toHaveLength(1);
    expect(tulos.matched[0].by).toBe("label");
  });

  it("ei sido samaa pöytää kahdesti", () => {
    /*
     * Kuvassa lukee 12 kahdesti — esimerkiksi pöytä ja sen viereinen
     * merkintä. Toinen jää ylimääräiseksi eikä vie toisen paikkaa.
     */
    const tulos = matchDetections(
      [loydetty({ label: "12", x: 10 }), loydetty({ label: "12", x: 80 })],
      [poyta("a", "Pöytä 12"), poyta("b", "Pöytä 13")],
    );

    expect(tulos.matched).toHaveLength(1);
    expect(tulos.matched[0].x).toBe(10);
    expect(tulos.extra).toHaveLength(1);
    expect(tulos.missing.map((m) => m.name)).toEqual(["Pöytä 13"]);
  });

  it("sitoo järjestyksessä kun nimiä ei ole", () => {
    /* Luetaan kuten salia katsotaan: ylhäältä alas, vasemmalta oikealle. */
    const tulos = matchDetections(
      [
        loydetty({ x: 80, y: 80 }),
        loydetty({ x: 20, y: 10 }),
        loydetty({ x: 60, y: 10 }),
      ],
      [poyta("a", "1"), poyta("b", "2"), poyta("c", "3")],
    );

    expect(tulos.matched.map((m) => [m.name, m.x, m.y])).toEqual([
      ["1", 20, 10],
      ["2", 60, 10],
      ["3", 80, 80],
    ]);
    expect(tulos.matched.every((m) => m.by === "order")).toBe(true);
  });

  it("pitää saman rivin pöydät samalla rivillä", () => {
    /*
     * Kolmen prosentin ero korkeudessa ei ole uusi rivi. Ilman
     * toleranssia hieman ylempi oikeanpuoleinen pöytä hyppäisi
     * vasemmanpuoleisen edelle.
     */
    const tulos = matchDetections(
      [loydetty({ x: 70, y: 28 }), loydetty({ x: 20, y: 31 })],
      [poyta("a", "1"), poyta("b", "2")],
    );

    expect(tulos.matched.map((m) => [m.name, m.x])).toEqual([
      ["1", 20],
      ["2", 70],
    ]);
  });

  it("ei sido järjestyksessä kun määrät eroavat", () => {
    /*
     * Kolme kuvassa, neljä listalla. Järjestykseen sitominen siirtäisi
     * pöydät toistensa paikoille, ja se on huonompi kuin olla
     * siirtämättä mitään.
     */
    const tulos = matchDetections(
      [loydetty({ x: 10 }), loydetty({ x: 20 }), loydetty({ x: 30 })],
      [poyta("a", "1"), poyta("b", "2"), poyta("c", "3"), poyta("d", "4")],
    );

    expect(tulos.matched).toEqual([]);
    expect(tulos.extra).toHaveLength(3);
    expect(tulos.missing).toHaveLength(4);
  });

  it("yhdistää nimillä ja järjestyksellä samassa kuvassa", () => {
    /*
     * Kaksi numeroitua ja kaksi numeroimatonta. Numeroidut menevät
     * omille paikoilleen, ja loput kaksi jäävät jäljelle jääneille
     * kahdelle pöydälle järjestyksessä.
     */
    const tulos = matchDetections(
      [
        loydetty({ label: "3", x: 90, y: 90 }),
        loydetty({ x: 10, y: 10 }),
        loydetty({ x: 50, y: 10 }),
      ],
      [poyta("a", "1"), poyta("b", "2"), poyta("c", "3")],
    );

    const nimella = tulos.matched.find((m) => m.by === "label")!;
    expect(nimella.name).toBe("3");
    expect(nimella.x).toBe(90);

    const jarjestyksessa = tulos.matched
      .filter((m) => m.by === "order")
      .map((m) => [m.name, m.x]);
    expect(jarjestyksessa).toEqual([
      ["1", 10],
      ["2", 50],
    ]);
    expect(tulos.missing).toEqual([]);
  });

  it("kertoo kuvan ylimääräiset pöydät", () => {
    const tulos = matchDetections(
      [loydetty({ label: "1" }), loydetty({ label: "9" })],
      [poyta("a", "1")],
    );

    expect(tulos.matched.map((m) => m.name)).toEqual(["1"]);
    expect(tulos.extra).toHaveLength(1);
    expect(tulos.extra[0].label).toBe("9");
  });

  it("välittää muodon ja kuvasta luetun paikkaluvun", () => {
    const tulos = matchDetections(
      [loydetty({ label: "1", shape: "rect", seats: 6 })],
      [poyta("a", "1")],
    );

    expect(tulos.matched[0].shape).toBe("rect");
    expect(tulos.matched[0].seats).toBe(6);
  });

  it("kestää tyhjän tunnistuksen", () => {
    const tulos = matchDetections([], [poyta("a", "1")]);

    expect(tulos.matched).toEqual([]);
    expect(tulos.extra).toEqual([]);
    expect(tulos.missing.map((m) => m.name)).toEqual(["1"]);
  });

  it("kestää tyhjän pöytälistan", () => {
    const tulos = matchDetections([loydetty({ label: "1" })], []);

    expect(tulos.matched).toEqual([]);
    expect(tulos.extra).toHaveLength(1);
    expect(tulos.missing).toEqual([]);
  });
});
