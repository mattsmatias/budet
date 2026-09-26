/**
 * Muotoilijat talteen.
 *
 * KALLIS RAKENTAA, HALPA KÄYTTÄÄ.
 *
 * `new Intl.DateTimeFormat(...)` lataa aikavyöhyke- ja kielitiedot ja
 * on mittauksissa noin kolmetoista kertaa kalliimpi kuin valmiin
 * muotoilijan kutsuminen. Työajan laskenta käy vuoron läpi minuutti
 * kerrallaan, joten kuukauden palkkakulut rakensivat muotoilijan
 * satojatuhansia kertoja — kahdenkymmenen työntekijän kuukaudessa se
 * on kaksikymmentä sekuntia palvelinaikaa sivun latausta kohti.
 *
 * Muotoilijat ovat tilattomia ja säikeettömiä: sama olio kelpaa
 * kaikille kutsuille samoilla asetuksilla, joten ne voi pitää
 * moduulin muistissa palvelimen eliniän.
 *
 * AVAIN ON ASETUKSET ITSE.
 *
 * Avain muodostetaan kielestä ja asetuksista, joten kaksi eri
 * muotoilua ei voi vahingossa jakaa samaa oliota. Väärä muotoilija
 * olisi pahempi vika kuin hidas muotoilija.
 */

const PAIVAT = new Map<string, Intl.DateTimeFormat>();
const LUVUT = new Map<string, Intl.NumberFormat>();

/** Päivämäärämuotoilija välimuistista. */
export function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const avain = `${locale}|${JSON.stringify(options)}`;
  const valmis = PAIVAT.get(avain);
  if (valmis) return valmis;

  const uusi = new Intl.DateTimeFormat(locale, options);
  PAIVAT.set(avain, uusi);
  return uusi;
}

/** Lukumuotoilija välimuistista. */
export function numberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const avain = `${locale}|${JSON.stringify(options)}`;
  const valmis = LUVUT.get(avain);
  if (valmis) return valmis;

  const uusi = new Intl.NumberFormat(locale, options);
  LUVUT.set(avain, uusi);
  return uusi;
}
