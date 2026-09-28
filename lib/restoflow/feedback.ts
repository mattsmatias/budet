import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * Asiakkaan omat ilmoitukset kehittäjille.
 *
 * KAKSISUUNTAINEN, EI POSTILAATIKKO.
 *
 * Ilman tilaa ja vastausta tämä olisi laatikko johon asiat katoavat,
 * ja "mitä sille kävi" kysyttäisiin lopulta puhelimessa — eli juuri
 * siinä kanavassa jonka tämän on tarkoitus korvata.
 *
 * Rajaus tulee kannasta eikä täältä: rivikäytäntö näyttää oman
 * ilmoituksen ja omistajalle koko yrityksen ilmoitukset. Tämä kysely
 * ei suodata mitään, koska suodatus täällä olisi toinen totuus saman
 * asian päällä.
 */

export type FeedbackKind = "bug" | "idea" | "contact";
export type FeedbackStatus = "new" | "in_progress" | "done" | "declined";

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  title: string;
  body: string;
  path: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

const KINDS: FeedbackKind[] = ["bug", "idea", "contact"];
const STATUSES: FeedbackStatus[] = ["new", "in_progress", "done", "declined"];

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && KINDS.includes(value as FeedbackKind);
}

export const fetchFeedback = cache(
  async (restaurantId: string): Promise<FeedbackItem[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("feedback")
        .select(
          "id, kind, status, title, body, path, reply, replied_at, created_at",
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id as string,
        kind: isFeedbackKind(row.kind) ? row.kind : "contact",
        status: STATUSES.includes(row.status as FeedbackStatus)
          ? (row.status as FeedbackStatus)
          : "new",
        title: (row.title as string) ?? "",
        body: (row.body as string) ?? "",
        path: (row.path as string | null) ?? null,
        reply: (row.reply as string | null) ?? null,
        repliedAt: (row.replied_at as string | null) ?? null,
        createdAt: row.created_at as string,
      }));
    } catch {
      return [];
    }
  },
);
