/**
 * Rahalaskenta kokonaislukuina (sentteinä).
 *
 * Liukulukuja ei käytetä missään verolaskennassa: 0.1 + 0.2 !== 0.3 riittää
 * rikkomaan täsmäytyksen, ja verotuspäätöksen pitää olla toistettavissa
 * bitilleen samana (§2).
 */

/** Pyöristys puolikkaat ylös, negatiiviset itseisarvon mukaan. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * ALV verottomasta summasta.
 *
 * @param netCents verottoman summan sentit
 * @param rate     verokanta osuutena, 0.1350 = 13,5 %
 */
export function vatFromNet(netCents: number, rate: number): number {
  assertInteger(netCents, "netCents");
  assertRate(rate);
  return roundHalfUp(netCents * rate);
}

/**
 * ALV verollisesta summasta. Kuiteilla loppusumma on usein ainoa varma luku,
 * joten veron osuus lasketaan takaperin.
 */
export function vatFromGross(grossCents: number, rate: number): number {
  assertInteger(grossCents, "grossCents");
  assertRate(rate);
  return roundHalfUp((grossCents * rate) / (1 + rate));
}

export function netFromGross(grossCents: number, rate: number): number {
  return grossCents - vatFromGross(grossCents, rate);
}

/** Muotoilee sentit näytettäväksi. Ei käytetä laskennassa. */
export function formatMoney(
  cents: number | null | undefined,
  currency = "EUR",
  locale = "fi-FI",
): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Muotoilee verokannan: 0.1350 → "13,5 %". */
export function formatRate(rate: number | null | undefined, locale = "fi-FI"): string {
  if (rate === null || rate === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate);
}

/** Jäsentää käyttäjän syöttämän summan sentteinä. Hyväksyy pilkun ja välilyönnit. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/\s| /g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return roundHalfUp(Number.parseFloat(cleaned) * 100);
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} on oltava kokonaisluku (senttejä), sai: ${value}`);
  }
}

function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`Verokanta on annettava osuutena välillä 0–1, sai: ${rate}`);
  }
}
