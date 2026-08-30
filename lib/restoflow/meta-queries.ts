/**
 * Meta-yhteyden ja julkaisujen luku.
 *
 * Tokeni ei kulje täältä. Se haetaan erikseen meta_page_token
 * -funktiolla vain silloin kun julkaistaan, jotta se ei päädy
 * vahingossa mihinkään näkymään tai lokiin.
 */

import { createClient } from "@/utils/supabase/server";

export type MetaStatus =
  | "connected"
  | "expired"
  | "disconnected"
  | "incomplete";

export type PublishStatus = "skipped" | "pending" | "ok" | "failed";

export interface MetaConnection {
  pageId: string;
  pageName: string;
  instagramId: string | null;
  instagramUsername: string | null;
  scopes: string[];
  status: MetaStatus;
  statusDetail: string | null;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export async function loadMetaConnection(
  restaurantId: string,
): Promise<MetaConnection | null> {
  const supabase = await createClient();

  /*
   * Sarakkeet luetellaan nimeltä.
   *
   * select * hakisi kaikki kentät, ja jos tokeni joskus siirtyisi
   * tähän tauluun, se lähtisi mukana huomaamatta. Nimetty lista ei
   * muutu vahingossa.
   */
  const { data, error } = await supabase
    .from("meta_connections")
    .select(
      "page_id, page_name, instagram_id, instagram_username, scopes, status, status_detail, token_expires_at, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    pageId: String(data.page_id),
    pageName: String(data.page_name),
    instagramId: data.instagram_id ? String(data.instagram_id) : null,
    instagramUsername: data.instagram_username
      ? String(data.instagram_username)
      : null,
    scopes: (data.scopes ?? []) as string[],
    status: data.status as MetaStatus,
    statusDetail: data.status_detail ? String(data.status_detail) : null,
    tokenExpiresAt: data.token_expires_at
      ? String(data.token_expires_at)
      : null,
    updatedAt: String(data.updated_at),
  };
}

/** Onko yhteys julkaisukelpoinen juuri nyt. */
export function canPublish(connection: MetaConnection | null): boolean {
  return connection !== null && connection.status !== "disconnected"
    && connection.status !== "expired";
}

export function instagramReady(connection: MetaConnection | null): boolean {
  return Boolean(connection?.instagramId) && canPublish(connection);
}

export interface Publication {
  id: string;
  menuId: string | null;
  weekStart: string | null;
  facebookStatus: PublishStatus;
  facebookPostId: string | null;
  facebookError: string | null;
  instagramStatus: PublishStatus;
  instagramPostId: string | null;
  instagramError: string | null;
  message: string;
  publishedByName: string;
  createdAt: string;
}

export async function loadPublications(
  restaurantId: string,
  limit = 20,
): Promise<Publication[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meta_publications")
    .select(
      "id, menu_id, week_start, facebook_status, facebook_post_id, facebook_error, instagram_status, instagram_post_id, instagram_error, message, published_by_name, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    menuId: row.menu_id ? String(row.menu_id) : null,
    weekStart: row.week_start ? String(row.week_start) : null,
    facebookStatus: row.facebook_status as PublishStatus,
    facebookPostId: row.facebook_post_id ? String(row.facebook_post_id) : null,
    facebookError: row.facebook_error ? String(row.facebook_error) : null,
    instagramStatus: row.instagram_status as PublishStatus,
    instagramPostId: row.instagram_post_id
      ? String(row.instagram_post_id)
      : null,
    instagramError: row.instagram_error ? String(row.instagram_error) : null,
    message: String(row.message),
    publishedByName: String(row.published_by_name),
    createdAt: String(row.created_at),
  }));
}

/**
 * Salattu sivutokeni julkaisua varten.
 *
 * Kulkee security definer -funktion kautta, joka tarkistaa
 * esihenkilöyden. Taulua ei voi lukea suoraan millään kyselyllä.
 */
export async function loadPageToken(
  restaurantId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("meta_page_token", {
    p_restaurant: restaurantId,
  });

  if (error || !data) return null;
  return String(data);
}
