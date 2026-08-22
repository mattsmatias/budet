import Anthropic from "@anthropic-ai/sdk";

/**
 * AI-palveluntarjoajan abstraktio.
 *
 * Sovellus ei tunne yhtäkään palveluntarjoajaa nimeltä tämän tiedoston
 * ulkopuolella. Vaihto tarkoittaa uuden toteutuksen kirjoittamista
 * tähän rajapintaan, ei muutoksia työkaluihin, reitteihin tai
 * käyttöliittymään.
 *
 * Rajapinta on tarkoituksella kapea. Vain se mitä Matti oikeasti
 * tarvitsee: yksi kierros mallille, työkalut mukana, ja vastaus joko
 * tekstinä tai työkalukutsuina.
 */

export interface AiToolSpec {
  name: string;
  description: string;
  /** JSON Schema mallille. */
  input: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  input: unknown;
}

/** Yksi viesti keskustelussa mallin näkökulmasta. */
export type AiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AiToolCall[] }
  | { role: "tool"; callId: string; content: string };

export interface AiTurn {
  /** Mallin teksti. Tyhjä jos se vain kutsui työkaluja. */
  text: string;
  toolCalls: AiToolCall[];
  /** Käytetyt tokenit kustannusseurantaa varten. */
  usage: { input: number; output: number };
}

export interface AiProvider {
  readonly name: string;
  /** Onko palvelu käytettävissä? Ilman avainta ei ole. */
  available(): boolean;
  turn(input: {
    system: string;
    messages: AiMessage[];
    tools: AiToolSpec[];
  }): Promise<AiTurn>;
}

/** Malli jota Matti käyttää ellei toisin määrätä. */
const DEFAULT_MODEL = "claude-opus-5";

/**
 * Vastauksen enimmäispituus.
 *
 * Ei mitoitettu tekstin vaan työkalukutsun mukaan. Viikon
 * lounaslistaehdotus on 25 ruokaa nimineen, kuvauksineen,
 * ruokavalioineen ja allergeeneineen, ja se mitattiin 1347–1433
 * tokeniksi. Raja oli 1400: ehdotus katkesi kesken jäsentämättömään
 * JSONiin sen mukaan kuinka pitkiä ruokien nimet sattuivat olemaan.
 *
 * Katkeaminen ei näy virheenä. Malli vain jättää työkalun kutsumatta
 * ja kertoo tekstissä mitä olisi tehnyt — eli väittää tehneensä työn
 * jota ei tehty.
 *
 * Neljä tuhatta antaa kaksinkertaisen varan mitattuun huippuun.
 * Vastausten lyhyys hoidetaan kehotteella, ei tällä rajalla.
 */
const MAX_TOKENS = 4000;

class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async turn({
    system,
    messages,
    tools,
  }: {
    system: string;
    messages: AiMessage[];
    tools: AiToolSpec[];
  }): Promise<AiTurn> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: process.env.MATTI_MODEL ?? DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input as Anthropic.Tool["input_schema"],
      })),
      messages: toAnthropicMessages(messages),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const toolCalls = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name, input: block.input }));

    return {
      text,
      toolCalls,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }
}

/**
 * Muunnos rajapinnan viesteistä palveluntarjoajan muotoon.
 *
 * Työkalutulokset kuuluvat Anthropicin mallissa käyttäjän vuoroon.
 * Peräkkäiset tulokset yhdistetään samaan viestiin, koska
 * vuorottelun on säilyttävä: kaksi peräkkäistä user-viestiä on virhe.
 */
function toAnthropicMessages(messages: AiMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];

      if (message.content) content.push({ type: "text", text: message.content });

      for (const call of message.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.input as Record<string, unknown>,
        });
      }

      if (content.length > 0) out.push({ role: "assistant", content });
      continue;
    }

    const block: Anthropic.ToolResultBlockParam = {
      type: "tool_result",
      tool_use_id: message.callId,
      content: message.content,
    };

    const last = out[out.length - 1];

    if (last?.role === "user" && Array.isArray(last.content)) {
      last.content.push(block);
    } else {
      out.push({ role: "user", content: [block] });
    }
  }

  return out;
}

let provider: AiProvider | null = null;

export function aiProvider(): AiProvider {
  provider ??= new AnthropicProvider();
  return provider;
}
