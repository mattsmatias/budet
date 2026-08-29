/**
 * Kuitin sivut lomakkeelta.
 *
 * Sivulista tulee selaimesta piilokenttänä, joten sen sisältöä ei voi
 * pitää luotettavana: kentän voi kirjoittaa itse, ja rikkinäinen JSON
 * on aina mahdollinen. Tulkinta on siksi omassa funktiossaan eikä
 * tallennuksen seassa.
 *
 * RIKKINÄINEN SYÖTE EI KAADA TALLENNUSTA.
 *
 * Kuitti on tärkeämpi kuin sen sivutus. Kelvoton rivi jätetään pois ja
 * kuitti tallentuu; sivut voi liittää uudelleen, mutta hylätty kuitti
 * olisi kirjoitettava alusta kiireisimpään aikaan.
 */
export interface ReceiptPageInput {
  path: string;
  hash: string;
}

export function parseReceiptPages(raw: unknown): ReceiptPageInput[] {
  if (raw === null || raw === undefined) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();

  return (
    parsed
      .filter(
        (page): page is { path: string; hash?: unknown } =>
          typeof page?.path === "string" && page.path.trim() !== "",
      )
      .map((page) => ({
        path: page.path.trim(),
        hash: typeof page.hash === "string" ? page.hash : "",
      }))
      /*
       * Sama polku kahdesti tarkoittaisi samaa sivua kahdella numerolla.
       *
       * Kaksoiskappale syntyy helposti: sama sivu kuvataan uudelleen, ja
       * tiivisteeseen perustuva tallennuspolku on silloin identtinen.
       * Ensimmäinen esiintymä säilyttää paikkansa järjestyksessä.
       */
      .filter((page) => {
        if (seen.has(page.path)) return false;
        seen.add(page.path);
        return true;
      })
  );
}
