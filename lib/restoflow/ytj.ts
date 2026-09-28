import { siistiYTunnus } from "./yritystunnus";

/**
 * Yritysten haku YTJ:n avoimesta rekisteristä.
 *
 * VAIN PALVELIMELTA.
 *
 * Tata ei tuoda asiakaskomponenttiin. Projektissa ei ole server-only
 * -pakettia muuallakaan, joten rajaa ei vahvisteta tuonnilla vaan
 * silla etta ainoa kutsuja on palvelinteko.
 *
 * MIKSI PALVELIMELTA.
 *
 * Kutsu ei vaadi avainta, mutta se lähtee silti palvelimelta: selaimesta
 * lähtevä kutsu kertoisi PRH:lle jokaisen asiakkaan IP-osoitteen ja
 * hakusanan, eikä kukaan ole pyytänyt sitä. Samalla vastaus saadaan
 * muotoon jota käyttöliittymä osaa lukea, eikä rajapinnan rakenne
 * vuoda komponentteihin.
 *
 * VIRHE EI ESTÄ LASKUTUSTA.
 *
 * Jos PRH ei vastaa, haku palauttaa tyhjän listan ja tiedon siitä että
 * rekisteri ei vastannut. Vastaanottajan voi aina kirjoittaa käsin —
 * ulkoisen palvelun katko ei saa olla este oman laskun lähettämiselle.
 */

const YTJ = "https://avoindata.prh.fi/opendata-ytj-api/v3/companies";

/** Katkaisu: hakukenttä odottaa vastausta, eikä sitä odoteta kauan. */
const AIKAKATKAISU_MS = 6000;

export interface YtjOsuma {
  businessId: string;
  name: string;
  careOf: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
}

export interface YtjTulos {
  osumat: YtjOsuma[];
  /** Tosi jos rekisteri ei vastannut. Eri asia kuin "ei löytynyt". */
  virhe: boolean;
}

/**
 * Voimassa oleva päätoiminimi.
 *
 * Nimiä on listassa monta: vanhat nimet, aputoiminimet ja
 * vieraskieliset rinnakkaisnimet. Laskulle kuuluu se nimi jolla yritys
 * on nyt rekisterissä — aputoiminimellä lähetetty lasku menee kyllä
 * perille, mutta kirjanpidossa se ei vastaa mitään Y-tunnusta.
 *
 * type "1" on päätoiminimi, ja päättynyt nimi on se jolla on endDate.
 */
function paaNimi(names: unknown): string | null {
  if (!Array.isArray(names)) return null;

  const rivit = names.filter(
    (n): n is { name: string; type: string; endDate?: string | null } =>
      typeof n === "object" && n !== null && typeof (n as { name?: unknown }).name === "string",
  );

  const voimassa = rivit.find((n) => n.type === "1" && !n.endDate);
  if (voimassa) return voimassa.name;

  /* Ei voimassa olevaa päänimeä: näytetään viimeisin mitä on. */
  return rivit[0]?.name ?? null;
}

/**
 * Postiosoite, ja vasta sen puuttuessa käyntiosoite.
 *
 * type 2 on postiosoite ja 1 käyntiosoite. Lasku menee postiosoitteeseen
 * silloin kun sellainen on ilmoitettu — iso yritys ottaa postin
 * postilokeroon, ei toimiston ovelta.
 */
function osoite(addresses: unknown): {
  street: string | null;
  postalCode: string | null;
  city: string | null;
  careOf: string | null;
} {
  const tyhja = { street: null, postalCode: null, city: null, careOf: null };
  if (!Array.isArray(addresses)) return tyhja;

  const rivit = addresses.filter(
    (a): a is Record<string, unknown> => typeof a === "object" && a !== null,
  );

  const valittu =
    rivit.find((a) => a.type === 2) ?? rivit.find((a) => a.type === 1) ?? rivit[0];

  if (!valittu) return tyhja;

  const teksti = (arvo: unknown) =>
    typeof arvo === "string" && arvo.trim() !== "" ? arvo.trim() : null;

  const katu = teksti(valittu.street);
  const numero = teksti(valittu.buildingNumber);
  const lokero = teksti(valittu.postOfficeBox);

  /*
   * Katu ja numero ovat eri kentissä, postilokero kolmannessa.
   * Lokerollisella yrityksellä katuosa on tyhjä, joten se ei voi olla
   * pelkkä ehto vaan molemmat on osattava.
   */
  const rivi = lokero
    ? `PL ${lokero}`
    : katu && numero
      ? `${katu} ${numero}`
      : katu;

  /*
   * Kaupunki on listassa kielittäin: 1 suomi, 2 ruotsi. Suomenkielinen
   * ensin, koska sovelluksen oletuskieli on suomi ja osoite on
   * kirjekuoressa vain yhdellä kielellä.
   */
  const paikat = Array.isArray(valittu.postOffices) ? valittu.postOffices : [];
  const suomeksi = paikat.find(
    (p: unknown) =>
      typeof p === "object" &&
      p !== null &&
      (p as { languageCode?: unknown }).languageCode === "1",
  ) as { city?: unknown } | undefined;
  const eka = paikat[0] as { city?: unknown } | undefined;

  const kaupunki = teksti(suomeksi?.city ?? eka?.city);

  return {
    street: rivi,
    postalCode: teksti(valittu.postCode),
    city: kaupunki
      ? kaupunki.charAt(0) + kaupunki.slice(1).toLowerCase()
      : null,
    careOf: teksti(valittu.co),
  };
}

export function jasennaYtj(data: unknown): YtjOsuma[] {
  if (typeof data !== "object" || data === null) return [];
  const companies = (data as { companies?: unknown }).companies;
  if (!Array.isArray(companies)) return [];

  return companies
    .map((c): YtjOsuma | null => {
      if (typeof c !== "object" || c === null) return null;
      const rivi = c as Record<string, unknown>;

      const tunnus =
        typeof rivi.businessId === "object" && rivi.businessId !== null
          ? (rivi.businessId as { value?: unknown }).value
          : null;

      const nimi = paaNimi(rivi.names);
      if (typeof tunnus !== "string" || nimi === null) return null;

      return { businessId: tunnus, name: nimi, ...osoite(rivi.addresses) };
    })
    .filter((o): o is YtjOsuma => o !== null);
}

/**
 * Haku nimellä tai Y-tunnuksella.
 *
 * Y-tunnukselta näyttävä syöte haetaan tunnuksella, muu nimellä. Sama
 * kenttä molemmille, koska laskuttaja tietää joko nimen tai tunnuksen
 * eikä hänen kuulu valita kumpaa kenttää käyttää.
 */
export async function haeYtj(hakusana: string): Promise<YtjTulos> {
  const sana = hakusana.trim();
  if (sana.length < 3) return { osumat: [], virhe: false };

  const tunnus = siistiYTunnus(sana);
  const parametrit = new URLSearchParams(
    tunnus ? { businessId: tunnus } : { name: sana },
  );

  try {
    const vastaus = await fetch(`${YTJ}?${parametrit}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(AIKAKATKAISU_MS),
      /*
       * Rekisteri muuttuu päivittäin muttei tunneittain. Tunnin
       * välimuisti säästää PRH:n rajapintaa ilman että osoite ehtii
       * vanhentua laskun kannalta merkittävästi.
       */
      next: { revalidate: 3600 },
    });

    if (!vastaus.ok) return { osumat: [], virhe: true };

    const data: unknown = await vastaus.json();
    return { osumat: jasennaYtj(data).slice(0, 15), virhe: false };
  } catch {
    return { osumat: [], virhe: true };
  }
}
