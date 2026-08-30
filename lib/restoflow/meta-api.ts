/**
 * Metan Graph-rajapinta.
 *
 * Kaikki kutsut Metalle kulkevat tästä. Yksi paikka tarkoittaa että
 * versio, virheiden luku ja tokenin käsittely ovat samat joka
 * kutsussa — ja että rajapinnan muuttuessa muutetaan yhtä tiedostoa.
 *
 * ---------------------------------------------------------------------
 * TARKISTETTU METAN DOKUMENTAATIOSTA
 * ---------------------------------------------------------------------
 *
 * Facebook-sivulle julkaisu
 *   POST /{page-id}/feed    teksti
 *   POST /{page-id}/photos  kuva + teksti (caption)
 *   Oikeudet: pages_manage_posts, pages_read_engagement, pages_show_list
 *   Tokeni: sivutokeni, ei käyttäjätokeni
 *
 * Instagram-julkaisu on kaksivaiheinen
 *   POST /{ig-user-id}/media          -> creation_id
 *   POST /{ig-user-id}/media_publish  -> julkaistu
 *   Oikeudet: instagram_basic, instagram_content_publish,
 *             pages_read_engagement, pages_show_list
 *   Kuva: VAIN JPEG, julkisesti noudettavassa osoitteessa
 *   Raja: 100 julkaisua liukuvan 24 tunnin aikana
 *
 * Tokenit
 *   GET /oauth/access_token?grant_type=fb_exchange_token
 *     lyhytikäinen käyttäjätokeni -> pitkäikäinen (60 vrk)
 *   GET /me/accounts
 *     pitkäikäisestä käyttäjätokenista sivutokenit, jotka EIVÄT vanhene
 *
 * Instagram-tilin löytäminen
 *   GET /{page-id}?fields=instagram_business_account
 *
 * Molemmat julkaisuoikeudet vaativat Metan App Review'n.
 */

/*
 * Graph-versio ympäristöstä.
 *
 * Meta julkaisee uuden version noin neljännesvuosittain ja vanhat
 * poistuvat käytöstä. Kovakoodattu versio olisi päivä jolloin
 * julkaisu lakkaa toimimasta ilman että kukaan muutti mitään.
 */
export const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v25.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Pyydettävät oikeudet.
 *
 * pages_show_list       sivujen listaus valintaa varten
 * pages_read_engagement sivun tietojen luku, IG-tilin löytäminen
 * pages_manage_posts    julkaisu sivulle
 * instagram_basic       IG-tilin perustiedot
 * instagram_content_publish  julkaisu Instagramiin
 *
 * business_management ei ole listalla. Se laajentaisi pyyntöä koko
 * Business Managerin hallintaan, eikä sitä tarvita kun käyttäjällä on
 * suora rooli sivulla. Turha oikeus on turha riski ja hidastaa
 * App Review'ta.
 */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
] as const;

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

// ---------------------------------------------------------------------------
// Virheet
// ---------------------------------------------------------------------------

/**
 * Metan virhe.
 *
 * Metan vastaus kertoo koodin, alakoodin ja tyypin. Ne ovat se mistä
 * päätellään onko kyse vanhentuneesta tokenista, puuttuvasta
 * oikeudesta vai ohimenevästä häiriöstä — ja siitä riippuu mitä
 * käyttäjälle sanotaan.
 */
export class MetaError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly type: string | null,
    readonly userMessage: string | null,
  ) {
    super(message);
    this.name = "MetaError";
  }

  /**
   * Onko tokeni käyttökelvoton.
   *
   * 190 on OAuthException tokenille. Alakoodit erottavat syyn:
   * 460 salasana vaihtui, 463 vanhentui, 467 mitätöity.
   */
  get tokenInvalid(): boolean {
    return this.code === 190 || this.code === 102;
  }

  /** Puuttuuko oikeus. 200 ja 10 ovat Metan lupavirheet. */
  get permissionMissing(): boolean {
    return this.code === 200 || this.code === 10 || this.code === 3;
  }

  /** Kannattaako yrittää uudelleen. */
  get retryable(): boolean {
    return this.code === 1 || this.code === 2 || this.code === 4 || this.code === 17;
  }
}

interface GraphVirhe {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
    error_user_msg?: string;
  };
}

async function lue<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & GraphVirhe;

  if (!response.ok || body.error) {
    const e = body.error ?? {};
    throw new MetaError(
      e.message ?? `Meta vastasi ${response.status}`,
      e.code ?? null,
      e.error_subcode ?? null,
      e.type ?? null,
      e.error_user_msg ?? null,
    );
  }

  return body as T;
}

/*
 * Tokeni menee otsakkeessa eikä osoitteessa.
 *
 * Kyselyparametrit päätyvät palvelinlokeihin ja välityspalvelimien
 * historiaan. Authorization-otsake ei.
 */
async function get<T>(polku: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(GRAPH + polku);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return lue<T>(
    await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
}

async function post<T>(polku: string, token: string, body: Record<string, string>) {
  return lue<T>(
    await fetch(GRAPH + polku, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
      cache: "no-store",
    }),
  );
}

// ---------------------------------------------------------------------------
// Kirjautuminen
// ---------------------------------------------------------------------------

export function authorizeUrl(state: string, redirectUri: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

/** Kertakäyttöinen koodi lyhytikäiseksi käyttäjätokeniksi. */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const data = await lue<{ access_token: string }>(
    await fetch(url, { cache: "no-store" }),
  );
  return data.access_token;
}

/** Lyhytikäinen käyttäjätokeni pitkäikäiseksi (noin 60 vrk). */
export async function longLivedUserToken(shortToken: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("fb_exchange_token", shortToken);

  const data = await lue<{ access_token: string }>(
    await fetch(url, { cache: "no-store" }),
  );
  return data.access_token;
}

/** Myönnetyt oikeudet. Käyttäjä voi hyväksyä osan ja kieltää osan. */
export async function grantedScopes(userToken: string): Promise<string[]> {
  const data = await get<{
    data?: { permission: string; status: string }[];
  }>("/me/permissions", userToken);

  return (data.data ?? [])
    .filter((p) => p.status === "granted")
    .map((p) => p.permission);
}

// ---------------------------------------------------------------------------
// Sivut ja Instagram
// ---------------------------------------------------------------------------

export interface MetaPage {
  id: string;
  name: string;
  /** Sivutokeni. EI vanhene, ja tämä on se joka tallennetaan. */
  accessToken: string;
  instagramId: string | null;
  instagramUsername: string | null;
}

/**
 * Käyttäjän sivut ja niihin liittyvät Instagram-tilit.
 *
 * instagram_business_account tulee samalla kutsulla, joten
 * Instagram-tilin olemassaolo tiedetään ennen kuin käyttäjä valitsee
 * sivun — ja valintanäkymä voi kertoa suoraan mikä sivu kelpaa
 * kumpaankin.
 */
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const data = await get<{
    data?: {
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }[];
  }>("/me/accounts", userToken, {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });

  return (data.data ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramId: page.instagram_business_account?.id ?? null,
    instagramUsername: page.instagram_business_account?.username ?? null,
  }));
}

/** Metan käyttäjätunniste. Sovelluskohtainen, ei henkilötieto sinänsä. */
export async function meId(userToken: string): Promise<string> {
  const data = await get<{ id: string }>("/me", userToken, { fields: "id" });
  return data.id;
}

// ---------------------------------------------------------------------------
// Facebook-julkaisu
// ---------------------------------------------------------------------------

/**
 * Julkaisu Facebook-sivulle.
 *
 * Kuvan kanssa /photos, ilman /feed. Kaksi eri päätepistettä, koska
 * Meta erottaa ne: /feed kuvaparametrilla ei liitä kuvaa vaan jättää
 * sen huomiotta.
 */
export async function publishToPage(
  pageId: string,
  pageToken: string,
  message: string,
  imageUrl: string | null,
): Promise<string> {
  if (imageUrl) {
    const data = await post<{ id?: string; post_id?: string }>(
      `/${pageId}/photos`,
      pageToken,
      { url: imageUrl, caption: message },
    );

    /*
     * /photos palauttaa kuvan id:n ja post_id:n. Historiaan halutaan
     * julkaisun tunniste, koska sillä pääsee itse julkaisuun.
     */
    const id = data.post_id ?? data.id;
    if (!id) throw new MetaError("Meta ei palauttanut julkaisun tunnistetta.", null, null, null, null);
    return id;
  }

  const data = await post<{ id?: string }>(`/${pageId}/feed`, pageToken, {
    message,
  });

  if (!data.id) {
    throw new MetaError("Meta ei palauttanut julkaisun tunnistetta.", null, null, null, null);
  }
  return data.id;
}

// ---------------------------------------------------------------------------
// Instagram-julkaisu
// ---------------------------------------------------------------------------

/**
 * Julkaisu Instagramiin.
 *
 * Kaksivaiheinen: ensin säiliö, sitten julkaisu. Meta noutaa kuvan
 * itse säiliötä luodessaan, joten osoitteen on oltava sillä hetkellä
 * julkisesti saavutettavissa.
 *
 * Instagram ei hyväksy muuta kuin JPEG:iä. Kuvan tuottaja huolehtii
 * siitä; tämä ei muunna mitään, koska hiljainen muunnos piilottaisi
 * virheen väärään paikkaan.
 */
export async function publishToInstagram(
  igUserId: string,
  pageToken: string,
  caption: string,
  imageUrl: string,
): Promise<string> {
  const container = await post<{ id?: string }>(
    `/${igUserId}/media`,
    pageToken,
    { image_url: imageUrl, caption },
  );

  if (!container.id) {
    throw new MetaError(
      "Instagram ei luonut julkaisusäiliötä.",
      null,
      null,
      null,
      null,
    );
  }

  const julkaistu = await post<{ id?: string }>(
    `/${igUserId}/media_publish`,
    pageToken,
    { creation_id: container.id },
  );

  if (!julkaistu.id) {
    throw new MetaError(
      "Instagram ei vahvistanut julkaisua.",
      null,
      null,
      null,
      null,
    );
  }

  return julkaistu.id;
}
