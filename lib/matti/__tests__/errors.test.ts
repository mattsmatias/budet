import { describe, expect, it } from "vitest";
import { explainAiError } from "../errors";

/**
 * Virheiden kääntäminen.
 *
 * Nämä testit syntyivät oikeasta tilanteesta: Anthropicin saldo loppui
 * kesken käytön, ja Matti sanoi "En saanut yhteyttä. Yritä hetken
 * päästä uudelleen." Neuvo oli väärä — uudelleen yrittäminen ei olisi
 * auttanut kertaakaan.
 *
 * Virheet eroavat siinä mitä ihmisen pitää tehdä. Sen erottamisen on
 * oltava testattua, koska se on ainoa syy tämän tiedoston olemassaoloon.
 */

/** Kuten SDK sen antaa: saldo loppu tulee 400-virheenä. */
function apiError(status: number, message: string) {
  const error = new Error(`${status} ${message}`) as Error & {
    status: number;
    error: { error: { message: string } };
  };
  error.status = status;
  error.error = { error: { message } };
  return error;
}

describe("saldo loppu", () => {
  /*
   * Tämä on se tapaus jota varten koko tiedosto on. Tilakoodi on 400,
   * sama kuin kelvottomalla pyynnöllä, joten numerosta ei voi päätellä
   * mitään — viesti on ainoa tunnistettava kohta.
   */
  it("tunnistaa saldon loppumisen 400-virheestä", () => {
    const failure = explainAiError(
      apiError(
        400,
        "Your credit balance is too low to access the Anthropic API. " +
          "Please go to Plans & Billing to upgrade or purchase credits.",
      ),
    );

    expect(failure.reason).toBe("out_of_credit");
    expect(failure.retryable).toBe(false);
    expect(failure.message).toMatch(/saldo/i);
  });

  it("ei kehota yrittämään uudelleen", () => {
    const failure = explainAiError(apiError(400, "credit balance is too low"));

    expect(failure.retryable).toBe(false);
    expect(failure.message).not.toMatch(/uudelleen/i);
  });
});

describe("muut virheet", () => {
  it("tunnistaa kelvottoman avaimen", () => {
    const failure = explainAiError(apiError(401, "invalid x-api-key"));

    expect(failure.reason).toBe("invalid_key");
    expect(failure.retryable).toBe(false);
    expect(failure.message).toMatch(/API-avain/);
  });

  it("pitää ruuhkan ohimenevänä", () => {
    const failure = explainAiError(apiError(429, "rate limit exceeded"));

    expect(failure.reason).toBe("rate_limited");
    expect(failure.retryable).toBe(true);
  });

  it("pitää palvelinvirheen ohimenevänä", () => {
    expect(explainAiError(apiError(529, "overloaded")).retryable).toBe(true);
    expect(explainAiError(apiError(500, "internal")).retryable).toBe(true);
  });

  it("kestää tuntemattoman virheen", () => {
    const failure = explainAiError(new Error("socket hang up"));

    expect(failure.retryable).toBe(true);
    expect(failure.status).toBe(502);
    expect(failure.message.length).toBeGreaterThan(10);
  });

  it("kestää sen ettei virhe ole Error", () => {
    const failure = explainAiError("jotain meni pieleen");

    expect(failure.retryable).toBe(true);
    expect(failure.reason).toBe("unknown");
  });
});

describe("viestin sisältö", () => {
  // Käyttäjälle ei näytetä tilakoodeja eikä englanninkielistä
  // alkuperäisviestiä. Ne kuuluvat lokiin.
  it("ei vuoda teknistä viestiä käyttäjälle", () => {
    const failure = explainAiError(
      apiError(400, "Your credit balance is too low to access the Anthropic API."),
    );

    expect(failure.message).not.toMatch(/credit balance/i);
    expect(failure.message).not.toMatch(/400/);
  });
});
