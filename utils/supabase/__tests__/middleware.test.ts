import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/*
 * Väliohjelmiston evästeet.
 *
 * Nämä testit ovat olemassa yhden tuotantovian takia: sivu jäi
 * lataamaan loputtomiin, koska uudelleenohjaus heitti menemään
 * evästeet jotka Supabase oli juuri kirjoittanut. Vanha pääsytoken
 * oli tällöin mitätöity palvelimella mutta selain piti sitä yhä
 * kädessään, eikä istunto voinut toipua itsestään.
 *
 * Supabase-client korvataan tynkällä. Oikea client tekisi
 * verkkopyynnön, ja testin kohde ei ole se mitä Supabase vastaa vaan
 * se mitä väliohjelmisto tekee vastauksen jälkeen.
 */

/** Mitä tynkä tekee kun sitä kutsutaan. */
let scenario: {
  user: { id: string } | null;
  /** Evästeet jotka Supabase kirjoittaa tällä pyynnöllä. */
  writes: { name: string; value: string; options: Record<string, unknown> }[];
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    config: {
      cookies: {
        setAll: (
          cookies: { name: string; value: string; options: Record<string, unknown> }[],
        ) => void;
      };
    },
  ) => ({
    auth: {
      /*
       * Istunnon luku kirjoittaa evästeet samalla tavalla kuin oikea
       * kirjasto: kierrätys tapahtuu tämän kutsun sisällä.
       */
      getClaims: async () => {
        if (scenario.writes.length > 0) config.cookies.setAll(scenario.writes);

        return scenario.user
          ? { data: { claims: { sub: scenario.user.id, email: "oktay@esimerkki.fi" } }, error: null }
          : { data: null, error: null };
      },
    },
  }),
}));

/*
 * Avainjoukko tyngätään, jotta testi ei mene verkkoon. Ilman tätä
 * jokainen testi yrittäisi hakea julkisen avaimen olemattomasta
 * osoitteesta ja ajo olisi sekä hidas että epävakaa.
 */
vi.stubGlobal(
  "fetch",
  async () =>
    new Response(JSON.stringify({ keys: [{ kid: "testi", kty: "EC" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
);

const { updateSession } = await import("../middleware");

/** Evästeen nimi ja arvo vastauksen Set-Cookie-otsikoista. */
function cookieValue(response: Response, name: string): string | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;

  const match = header.match(new RegExp(`${name}=([^;,]*)`));
  return match ? match[1] : null;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://esimerkki.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "avain";

  scenario = { user: null, writes: [] };
});

function request(path: string): NextRequest {
  return new NextRequest(new URL(`https://budet.fi${path}`));
}

describe("kirjautunut kirjautumissivulla", () => {
  /*
   * Tämä on se tapaus joka rikkoi tuotannon. Kirjautunut käyttäjä osuu
   * /kirjaudu-sivulle, Supabase kiertää tokenin, ja hänet ohjataan
   * /admin-sivulle. Jos uusi eväste ei tule mukana, seuraava pyyntö
   * lähtee kuolleella tokenilla.
   */
  it("vie kierretyn tokenin uudelleenohjaukseen", async () => {
    scenario = {
      user: { id: "oktay" },
      writes: [{ name: "sb-auth-token", value: "uusi", options: { path: "/" } }],
    };

    const response = await updateSession(request("/kirjaudu"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin");
    expect(cookieValue(response, "sb-auth-token")).toBe("uusi");
  });

  it("ohjaa /admin-sivulle myös ilman evästekirjoitusta", async () => {
    scenario = { user: { id: "oktay" }, writes: [] };

    const response = await updateSession(request("/kirjaudu"));

    expect(response.headers.get("location")).toContain("/admin");
  });
});

describe("kirjautumaton suojatulla sivulla", () => {
  /*
   * Kun istunto on mennyt, Supabase tyhjentää evästeet kirjoittamalla
   * niihin tyhjän arvon. Ilman tätä otsikkoa selain ei saa koskaan
   * tietää asiaa, vaan lähettää saman kuolleen evästeen uudelleen ja
   * uudelleen.
   */
  it("vie tyhjennetyt evästeet uudelleenohjaukseen", async () => {
    scenario = {
      user: null,
      writes: [{ name: "sb-auth-token", value: "", options: { path: "/", maxAge: 0 } }],
    };

    const response = await updateSession(request("/admin/kuitit"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/kirjaudu");
    expect(response.headers.get("set-cookie")).toContain("sb-auth-token=");
  });

  it("muistaa mihin oltiin menossa", async () => {
    const response = await updateSession(request("/admin/lounas"));

    expect(response.headers.get("location")).toContain(
      `seuraava=${encodeURIComponent("/admin/lounas")}`,
    );
  });
});

describe("läpi menevät pyynnöt", () => {
  it("päästää julkisen sivun läpi ilman ohjausta", async () => {
    const response = await updateSession(request("/lounas/cafe-monami"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("kirjoittaa evästeet myös silloin kun ei ohjata", async () => {
    scenario = {
      user: { id: "oktay" },
      writes: [{ name: "sb-auth-token", value: "uusi", options: { path: "/" } }],
    };

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBeNull();
    expect(cookieValue(response, "sb-auth-token")).toBe("uusi");
  });
});

describe("ilman konfiguraatiota", () => {
  /*
   * Ympäristö ilman Supabasea ei saa kaataa pyyntöä. Sivut kertovat
   * itse ettei kirjautuminen ole käytössä.
   */
  it("ei ohjaa mihinkään", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBeNull();
  });
});
