import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toJSONSchema } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "../tools";

/**
 * Elävä tarkistus mallia vasten.
 *
 * Ajetaan käsin, ei osana testisarjaa: tämä kutsuu oikeaa rajapintaa
 * ja maksaa. Tarkoitus on todentaa kaksi asiaa joita rakennetestit
 * eivät voi todentaa:
 *
 *   Kelpaavatko Zodista generoidut skeemat rajapinnalle sellaisenaan.
 *   Osaako malli valita oikean työkalun suomenkielisestä kysymyksestä.
 *
 *   npx vitest run live.manual --no-coverage
 */

function loadKey(): string | null {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("ANTHROPIC_API_KEY="));

    const value = line?.slice("ANTHROPIC_API_KEY=".length).trim();
    return value || null;
  } catch {
    return null;
  }
}

const key = loadKey();

async function client() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: key! });
}

const CTX = {
  restaurantName: "Cafe Monami",
  userName: "Oktay",
  role: "owner" as const,
  today: "2026-08-23",
  month: "2026-08",
  currentPage: "/admin/lounas",
};

/**
 * Ajaa oikean työkalusilmukan.
 *
 * Yksi kierros ei riitä. Matti hakee ensin tilanteen — "onko tällä
 * viikolla jo lista, entä edellisellä" — ja vastaa tai ehdottaa vasta
 * sen jälkeen. Yhden kierroksen testi näkisi vain haun ja päättelisi
 * siitä väärin.
 *
 * Lukevien työkalujen tulokset ovat tynkiä: tarkoitus on todentaa
 * Matin päättely, ei kannan sisältöä. Tynkä kertoo ettei viikoilla ole
 * listaa, jolloin pohjakysymys on suljettu pois ja jäljelle jää vain
 * laajuus.
 */
async function converse(question: string) {
  const { systemPrompt } = await import("../prompt");
  const api = await client();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  const called: { name: string; input: unknown }[] = [];
  let text = "";

  for (let round = 0; round < 4; round++) {
    const response = await api.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      // Oikea kehote, ei testiä varten kirjoitettu. Muuten testi
      // todentaisi jotain mitä tuotannossa ei ole.
      system: systemPrompt(CTX as never),
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: toJSONSchema(tool.schema) as never,
      })),
      messages,
    });

    const calls = response.content.filter((b) => b.type === "tool_use");

    const said = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    if (said) text = said;

    if (calls.length === 0) break;

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: calls.map((call) => {
        called.push({ name: call.name, input: call.input });

        return {
          type: "tool_result" as const,
          tool_use_id: call.id,
          content: stubResult(call.name),
        };
      }),
    });
  }

  return { calls: called, text };
}

/** Tyngät. Ei listaa millään viikolla, jotta vain laajuus jää auki. */
function stubResult(tool: string): string {
  if (tool === "get_lunch_week") {
    return JSON.stringify({ exists: false, days: [] });
  }
  if (tool.startsWith("propose_")) {
    return "Ehdotus tallennettu odottamaan käyttäjän hyväksyntää.";
  }
  return JSON.stringify({ note: "ei dataa" });
}

describe.skipIf(!key)("Matti mallia vasten", () => {
  it("valitsee oikean työkalun suomenkielisestä kysymyksestä", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key! });

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 400,
      system:
        "Olet Matti, ravintolan avustaja. Käytä työkaluja tiedon hakemiseen. " +
        "Älä keksi lukuja. Tänään on 2026-08-23, kuluva kuukausi 2026-08.",
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: toJSONSchema(tool.schema) as never,
      })),
      messages: [
        { role: "user", content: "Paljonko meillä meni rahaa tässä kuussa?" },
      ],
    });

    const calls = response.content.filter((b) => b.type === "tool_use");

    console.log(
      "kutsut:",
      calls.map((c) => `${c.name} ${JSON.stringify(c.input)}`),
    );

    expect(calls.length).toBeGreaterThan(0);
    expect(
      calls.some(
        (c) =>
          c.name === "get_dashboard_summary" ||
          c.name === "get_expenses_by_category",
      ),
    ).toBe(true);
  }, 60_000);

  it("ehdottaa hinnanmuutosta eikä väitä tehneensä sitä", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key! });

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 400,
      system:
        "Olet Matti. propose_-työkalut EIVÄT tee muutosta, ne vain ehdottavat. " +
        "Tänään on 2026-08-23.",
      tools: TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: toJSONSchema(tool.schema) as never,
      })),
      messages: [
        {
          role: "user",
          content: "Muuta maanantain 24.8.2026 lounaan hinnaksi 16,50 euroa.",
        },
      ],
    });

    const calls = response.content.filter((b) => b.type === "tool_use");

    console.log(
      "kutsut:",
      calls.map((c) => `${c.name} ${JSON.stringify(c.input)}`),
    );

    const price = calls.find((c) => c.name === "propose_lunch_price");
    expect(price).toBeDefined();
    expect((price!.input as { euros: number }).euros).toBe(16.5);
  }, 60_000);

  /*
   * Laajuus: koko viikko.
   *
   * "Koko viikolle" on yksiselitteinen, joten Matin pitää tehdä
   * ehdotus eikä kysyä. Turha varmistuskysymys selvästä asiasta on
   * juuri se mikä tekee avustajasta hitaan.
   */
  it("tekee koko viikon kun sitä pyydetään", async () => {
    const { calls } = await converse(
      "Matti, voitko tehdä lounaslistan koko ensi viikolle?",
    );

    console.log("kutsut:", calls.map((c) => c.name).join(" → "));

    const items = calls.find((c) => c.name === "propose_lunch_items");
    expect(items).toBeDefined();

    const days = (items!.input as { days: unknown[] }).days;
    expect(days.length).toBeGreaterThanOrEqual(5);
  }, 90_000);

  /*
   * Laajuus auki: kysyttävä.
   *
   * Pelkkä "tee lounaslista" ei kerro onko kyse yhdestä päivästä vai
   * viikosta. Arvaaminen tuottaisi neljä ylimääräistä päivää tai
   * jättäisi neljä tekemättä, ja kumpikin huomataan vasta jälkikäteen.
   */
  it("kysyy laajuutta kun sitä ei ole kerrottu", async () => {
    const { calls, text } = await converse("Matti, tee lounaslista.");

    console.log("kutsut:", calls.map((c) => c.name).join(" → "));

    const proposed = calls.filter((c) => c.name.startsWith("propose_"));
    expect(proposed).toEqual([]);

    console.log("vastaus:", text);
    expect(text.toLowerCase()).toMatch(/päiväl|viikol/);
  }, 90_000);
});
