/**
 * Nimen kirjainlaatta.
 *
 * Toimittajalistassa nimet ovat lyhyitä ja samankaltaisia — Kespro,
 * Kesko, Metro — ja pelkkä tekstisarake luetaan kirjain kerrallaan.
 * Sama nimi saa joka rivillä saman laatan, ja rivi tunnistuu ennen
 * lukemista.
 *
 * KAKSI KIRJAINTA, EI YKSI.
 *
 * Yhden kirjaimen laatta näyttää keskeneräiseltä ja törmää heti
 * toiseen samalla kirjaimella alkavaan nimeen.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  /*
   * Yksi sana antaa kaksi ensimmäistä kirjainta.
   *
   * "S-Market Kajaani" on kaksi sanaa ja antaa SK. "Wolt" on yksi ja
   * antaa WO — ei W, koska yksi kirjain ei erota mistään.
   */
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();
}
