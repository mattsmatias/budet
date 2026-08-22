import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toJSONSchema } from "zod";
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
});
