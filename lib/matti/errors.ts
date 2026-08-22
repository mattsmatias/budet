/**
 * AI-palvelun virheiden kääntäminen.
 *
 * "Yritä hetken päästä uudelleen" on hyvä neuvo ruuhkassa ja väärä
 * neuvo silloin kun tilin saldo on loppu. Jälkimmäisessä uudelleen
 * yrittäminen ei auta koskaan, ja käyttäjä kokeilee sitä silti
 * kymmenen kertaa ennen kuin arvaa katsoa laskutusta.
 *
 * Virheet eroavat siinä mitä ihmisen pitää tehdä, ei siinä minkä
 * numeron palvelin palautti. Siksi tässä palautetaan myös tieto siitä
 * kannattaako yrittää uudelleen — käyttöliittymä näyttää
 * Yritä uudelleen -painikkeen vain silloin kun se voi auttaa.
 */

export interface AiFailure {
  /** Käyttäjälle näytettävä teksti. */
  message: string;
  /** Auttaako uudelleen yrittäminen? */
  retryable: boolean;
  /** Palvelimen vastauksen tila. */
  status: number;
  /** Lokiin, ei käyttäjälle. */
  reason: string;
}

/**
 * Saldon loppuminen tulee 400-virheenä, ei 402:na.
 *
 * Tilakoodi on siis sama kuin kelvottomalla pyynnöllä, eikä niitä voi
 * erottaa numerosta. Viesti on ainoa tunnistettava kohta.
 */
function isOutOfCredit(text: string): boolean {
  return /credit balance is too low|insufficient.*credit/i.test(text);
}

export function explainAiError(error: unknown): AiFailure {
  const status = readStatus(error);
  const text = readMessage(error);

  if (isOutOfCredit(text)) {
    return {
      message:
        "Matti on tauolla: AI-palvelun saldo on loppu. Lisää krediittejä " +
        "Anthropic-tililtä, niin Matti herää heti.",
      retryable: false,
      status: 402,
      reason: "out_of_credit",
    };
  }

  if (status === 401 || status === 403) {
    return {
      message:
        "Mattia ei ole kytketty oikein: API-avain ei kelpaa. Tarkista " +
        "ANTHROPIC_API_KEY.",
      retryable: false,
      status: 401,
      reason: "invalid_key",
    };
  }

  if (status === 429) {
    return {
      message: "Matti on juuri nyt ruuhkautunut. Yritä hetken päästä uudelleen.",
      retryable: true,
      status: 429,
      reason: "rate_limited",
    };
  }

  // Loput ovat ohimeneviä: katkos, aikakatkaisu, palvelun ylikuormitus.
  return {
    message: "En saanut tällä kertaa vastausta. Yritä uudelleen.",
    retryable: true,
    status: 502,
    reason: status ? `http_${status}` : "unknown",
  };
}

function readStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

/**
 * Kaikki teksti mistä virheen voi tunnistaa.
 *
 * SDK asettaa viestin eri kohtiin sen mukaan tuliko virhe rajapinnasta
 * vai verkosta, joten ne katsotaan kaikki. Yhden kentän lukeminen
 * toimisi tänään ja rikkoutuisi seuraavassa versiossa.
 */
function readMessage(error: unknown): string {
  const parts: string[] = [];

  if (error instanceof Error) parts.push(error.message);

  if (typeof error === "object" && error !== null) {
    const body = (error as { error?: unknown }).error;

    if (typeof body === "object" && body !== null) {
      const inner = (body as { error?: unknown }).error;

      if (typeof inner === "object" && inner !== null) {
        const message = (inner as { message?: unknown }).message;
        if (typeof message === "string") parts.push(message);
      }
    }
  }

  return parts.join(" ");
}
