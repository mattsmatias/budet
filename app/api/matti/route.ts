import { NextResponse } from "next/server";
import { z } from "zod";
import { toJSONSchema } from "zod";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { mattiContext } from "@/lib/matti/context";
import { systemPrompt } from "@/lib/matti/prompt";
import { aiProvider, type AiMessage } from "@/lib/matti/provider";
import { explainAiError } from "@/lib/matti/errors";
import {
  findTool,
  toolsFor,
  type ActionPreview,
  type ToolCard,
} from "@/lib/matti/tools";

/**
 * Matin keskustelureitti.
 *
 * Silmukka: malli vastaa → jos se kutsui työkaluja, ne ajetaan ja
 * tulokset syötetään takaisin → malli vastaa uudelleen. Enintään
 * MAX_ROUNDS kierrosta, jotta yksikään kysymys ei voi jäädä kiertämään.
 *
 * Kirjoittavat työkalut eivät kirjoita. Kun sellaista kutsutaan, sen
 * esikatselu tallennetaan ai_pending_actions-tauluun ja käyttäjä saa
 * tunnisteen. Suoritus tapahtuu vasta erillisessä palvelintoiminnossa
 * jonka ihminen laukaisee.
 */

export const maxDuration = 60;

/**
 * Kierrosraja.
 *
 * Viisi riittää monivaiheiseen tehtävään (hae viikko → hae edellinen →
 * ehdota kopiointia). Ilman rajaa väärin ymmärretty tehtävä voisi ajaa
 * työkaluja kunnes pyyntö aikakatkaistaan, ja lasku juoksisi.
 */
const MAX_ROUNDS = 5;

const requestSchema = z.object({
  message: z.string().trim().min(1, "Viesti on tyhjä.").max(2000),
  conversationId: z.string().uuid().nullable().optional(),
  currentPage: z.string().max(200).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  /*
   * Tunnistus ensin, vasta sitten kaikki muu.
   *
   * requireContext ohjaisi kirjautumissivulle, ja rajapinnasta
   * palautuva uudelleenohjaus näkyisi selaimessa HTML-vastauksena
   * jota JSON-jäsennys ei ymmärrä. Tässä kerrotaan suoraan.
   *
   * Järjestys on myös se että kirjautumaton ei saa tietää onko
   * palvelu kytketty: se ei kuulu hänelle.
   */
  const user = await getUser();
  const restaurant = await getActiveRestaurant();

  if (!user || !restaurant) {
    return NextResponse.json({ error: "Kirjaudu sisään." }, { status: 401 });
  }

  const provider = aiProvider();

  if (!provider.available()) {
    return NextResponse.json(
      {
        error:
          "Mattia ei ole vielä kytketty. Aseta ANTHROPIC_API_KEY ympäristömuuttujiin.",
      },
      { status: 503 },
    );
  }

  const ctx = await mattiContext(parsed.data.currentPage ?? null);

  // Rooliportti. Työkalut tarkistavat oikeutensa erikseen, mutta
  // ilman tätä väärä rooli saisi silti mallin vastaamaan.
  if (!can(ctx.role, "matti.use")) {
    return NextResponse.json(
      { error: "Ei oikeutta Mattiin." },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  // --- Keskustelu -----------------------------------------------------------

  const { data: conversationId, error: openError } = await supabase.rpc(
    "ai_open_conversation",
    {
      p_restaurant: ctx.restaurantId,
      p_conversation: parsed.data.conversationId ?? null,
    },
  );

  if (openError || !conversationId) {
    return NextResponse.json(
      { error: "Keskustelua ei saatu avattua." },
      { status: 500 },
    );
  }

  const history = await loadHistory(supabase, conversationId as string);

  await supabase.rpc("ai_add_message", {
    p_conversation: conversationId,
    p_role: "user",
    p_content: parsed.data.message,
    p_tool_calls: [],
  });

  // --- Työkalut -------------------------------------------------------------

  const tools = toolsFor(ctx.role);

  const specs = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: toJSONSchema(tool.schema) as Record<string, unknown>,
  }));

  const messages: AiMessage[] = [
    ...history,
    { role: "user", content: parsed.data.message },
  ];

  const steps: { tool: string; summary: string }[] = [];
  const actions: PendingAction[] = [];
  const cards: ToolCard[] = [];

  let text = "";
  let usedInput = 0;
  let usedOutput = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const turn = await provider.turn({
        system: systemPrompt(ctx),
        messages,
        tools: specs,
      });

      usedInput += turn.usage.input;
      usedOutput += turn.usage.output;

      if (turn.text) text = turn.text;

      if (turn.toolCalls.length === 0) break;

      messages.push({
        role: "assistant",
        content: turn.text,
        toolCalls: turn.toolCalls,
      });

      for (const call of turn.toolCalls) {
        const result = await runTool({
          supabase,
          ctx,
          conversationId: conversationId as string,
          call,
          actions,
          cards,
        });

        steps.push({ tool: call.name, summary: result.slice(0, 200) });
        messages.push({ role: "tool", callId: call.id, content: result });
      }
    }
  } catch (error) {
    const failure = explainAiError(error);

    console.error("matti: mallikutsu epäonnistui", {
      restaurantId: ctx.restaurantId,
      reason: failure.reason,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: failure.message, retryable: failure.retryable },
      { status: failure.status },
    );
  }

  if (!text) {
    text = "En osannut vastata tähän. Kokeile muotoilla kysymys toisin.";
  }

  await supabase.rpc("ai_add_message", {
    p_conversation: conversationId,
    p_role: "assistant",
    p_content: text,
    p_tool_calls: steps,
  });

  console.info("matti: vastaus", {
    restaurantId: ctx.restaurantId,
    tools: steps.map((s) => s.tool),
    actions: actions.length,
    tokens: { input: usedInput, output: usedOutput },
  });

  return NextResponse.json({
    conversationId,
    text,
    steps,
    actions,
    /*
     * Enintään kaksi korttia.
     *
     * Malli kutsuu usein kolmea työkalua yhteen kysymykseen. Kolme
     * korttia vastauksen alla on kojelauta, ei vastaus. Viimeiset
     * kaksi ovat ne joita malli haki tarkentaakseen — yleensä siis
     * ne jotka vastaavat kysymykseen.
     */
    cards: cards.slice(-2),
  });
}

// ---------------------------------------------------------------------------

interface PendingAction {
  id: string;
  tool: string;
  preview: ActionPreview;
}

/**
 * Ajaa yhden työkalun ja palauttaa mallille menevän tuloksen.
 *
 * Virhe ei kaada keskustelua: se palautetaan mallille tekstinä, jotta
 * Matti voi kertoa siitä käyttäjälle tai yrittää toisin. Kaatuminen
 * jättäisi käyttäjän tyhjän ruudun ääreen.
 */
async function runTool({
  supabase,
  ctx,
  conversationId,
  call,
  actions,
  cards,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  ctx: Awaited<ReturnType<typeof mattiContext>>;
  conversationId: string;
  call: { id: string; name: string; input: unknown };
  actions: PendingAction[];
  cards: ToolCard[];
}): Promise<string> {
  const tool = findTool(call.name);

  if (!tool) return `Työkalua ${call.name} ei ole.`;

  // Oikeus tarkistetaan tässä eikä vain työkalulistaa rajaamalla.
  // Lista on vihje mallille; tämä on portti.
  if (!can(ctx.role, tool.requires)) {
    return "Ei oikeutta tähän toimintoon.";
  }

  const input = tool.schema.safeParse(call.input);

  if (!input.success) {
    return `Virheelliset argumentit: ${input.error.issues[0].message}`;
  }

  try {
    const result = await tool.run(ctx, input.data);

    if (result.card) cards.push(result.card);

    // Kirjoittava työkalu: esikatselu talteen, ei suoritusta.
    if (tool.level === "write" && result.preview) {
      const { data: actionId } = await supabase.rpc("ai_propose_action", {
        p_conversation: conversationId,
        p_tool: tool.name,
        p_arguments: input.data as Record<string, unknown>,
        p_preview: result.preview as unknown as Record<string, unknown>,
      });

      if (actionId) {
        actions.push({
          id: actionId as string,
          tool: tool.name,
          preview: result.preview,
        });
      }
    }

    /*
     * Työkalun tulos on DATAA eikä ohje.
     *
     * Kuitin toimittajanimessä tai lounasruoan kuvauksessa voi lukea
     * mitä tahansa, myös tekstiä joka on muotoiltu ohjeeksi mallille.
     * Rajaus tekee näkyväksi mistä teksti alkaa ja mihin se loppuu.
     */
    const payload =
      result.data === undefined
        ? result.summary
        : `${result.summary}\n\n${JSON.stringify(result.data)}`;

    return `<tyokalun-tulos tyokalu="${tool.name}">\n${payload}\n</tyokalun-tulos>`;
  } catch (error) {
    console.error("matti: työkalu epäonnistui", {
      tool: tool.name,
      error: error instanceof Error ? error.message : String(error),
    });

    return "Työkalu epäonnistui. Mitään ei muutettu.";
  }
}

/**
 * Keskustelun aiemmat viestit.
 *
 * Vain teksti, ei työkalutuloksia. Vanhat tulokset olisivat vanhentunutta
 * dataa jonka malli voisi esittää nykyisenä — ja ne kasvattaisivat
 * jokaisen kysymyksen hintaa ilman että ne auttavat.
 *
 * Kaksitoista viimeistä riittää siihen mihin historiaa tarvitaan:
 * "entä edelliskuussa" viittaa edelliseen kysymykseen, ei viime
 * viikon keskusteluun.
 */
async function loadHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
): Promise<AiMessage[]> {
  const { data } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (!data) return [];

  return data
    .reverse()
    .filter((row) => (row.content as string).trim() !== "")
    .map((row) =>
      row.role === "user"
        ? { role: "user" as const, content: row.content as string }
        : { role: "assistant" as const, content: row.content as string },
    );
}
