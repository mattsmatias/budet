/**
 * Huomion polku tunnisteineen.
 *
 * MIKSI TUNNISTE KULKEE OSOITTEESSA.
 *
 * Ilmoituksesta pääsi sivulle, mutta sivu ei tiennyt miksi sinne
 * tultiin. Osoiterivin ?huomio kertoo sen, ja kuori näyttää sen
 * perusteella bannerin josta asian voi merkitä tarkistetuksi.
 *
 * Tehtäville tunnistetta ei liitetä: tehtävä merkitään tehdyksi
 * tehtävälistassa, eikä samalle asialle tarvita kahta sulkemistapaa.
 */
export function alertHref(href: string, id: string): string {
  if (id.startsWith("task-")) return href;

  const erotin = href.includes("?") ? "&" : "?";
  return `${href}${erotin}huomio=${encodeURIComponent(id)}`;
}
