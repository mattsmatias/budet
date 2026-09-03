/**
 * Varausvahvistuksen sisältö.
 *
 * Erillään lähetyksestä tarkoituksella: tämä on puhdas funktio, joka
 * ottaa varauksen tiedot ja palauttaa kolme merkkijonoa. Sen voi
 * testata ilman verkkoa, ilman avainta ja ilman palvelinta — ja juuri
 * sisältö on se osa joka menee helposti rikki, kun kieliä on kuusi.
 *
 * ---------------------------------------------------------------------
 * MIKSI TÄMÄ VIESTI YLIPÄÄTÄÄN LÄHETETÄÄN
 * ---------------------------------------------------------------------
 *
 * Peruutuslinkki näytettiin ennen tätä täsmälleen kerran: widgetin
 * vahvistusruudussa, tekstillä "tallenna tämä linkki". Kannassa on
 * vain tunnuksen tiiviste, joten suljetun välilehden jälkeen linkkiä
 * ei voinut palauttaa kukaan — ei asiakas eikä ravintola. Asiakkaan
 * ainoa keino perua oli soittaa.
 *
 * Sähköposti on se paikka josta linkki löytyy vielä viikon päästä.
 * Siksi viestin tärkein osa ei ole vahvistus vaan peruutuslinkki.
 *
 * ---------------------------------------------------------------------
 * TEKSTIVERSIO EI OLE MUODOLLISUUS
 * ---------------------------------------------------------------------
 *
 * Osa asiakkaista lukee postinsa ilman HTML:ää, ja moni roskapostin
 * suodatin pitää pelkkää HTML:ää epäilyttävänä. Molemmat versiot
 * sisältävät saman tiedon ja saman linkin.
 */

export type EmailLocale = "fi" | "en" | "sv" | "da" | "tr" | "et";

export const EMAIL_LOCALES: EmailLocale[] = ["fi", "en", "sv", "da", "tr", "et"];

export function toEmailLocale(value: string | null | undefined): EmailLocale {
  const short = (value ?? "").slice(0, 2).toLowerCase();
  return (EMAIL_LOCALES as string[]).includes(short)
    ? (short as EmailLocale)
    : "fi";
}

export interface ConfirmationInput {
  locale: EmailLocale;
  restaurantName: string;
  /** ISO-muodossa, esimerkiksi 2026-08-31. */
  date: string;
  /** Kellonaika muodossa 18:30. */
  time: string;
  partySize: number;
  tables: string[];
  guestName: string;
  /**
   * Varausnumero.
   *
   * Sähköposti on se paikka josta se löytyy silloin kun asiakas
   * soittaa ravintolaan. Null vain siltä varalta ettei kanta
   * palauttanut sitä — viesti ei kaadu numeron puuttumiseen.
   */
  reference?: string | null;
  /**
   * Tunteja ennen varausta, jolloin peruutuslinkki vielä toimii.
   *
   * Nolla tarkoittaa alkuhetkeen asti. Raja sanotaan viestissä eikä
   * vasta siinä hetkessä jona linkki kieltäytyy: peruutuksen yrittäminen
   * tuntia ennen on liian myöhäistä myös ravintolalle.
   */
  cancelHours?: number;
  cancelUrl: string;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

interface Texts {
  subject: string;
  greeting: string;
  intro: string;
  date: string;
  time: string;
  guests: string;
  person: string;
  people: string;
  tables: string;
  reference: string;
  cancelUntil: string;
  cancelTitle: string;
  cancelBody: string;
  cancelAction: string;
  changeNote: string;
  signature: string;
}

const TEKSTIT: Record<EmailLocale, Texts> = {
  fi: {
    subject: "Varaus vahvistettu",
    greeting: "Hei",
    intro: "varauksesi on vahvistettu. Tässä tiedot:",
    date: "Päivä",
    time: "Kello",
    guests: "Seurue",
    person: "henkilö",
    people: "henkilöä",
    tables: "Pöytä",
    reference: "Varausnumero",
    cancelUntil: "Peruutuslinkki toimii {tunnit} tuntia ennen varausta.",
    cancelTitle: "Jos et pääsekään",
    cancelBody:
      "Peru varaus tästä linkistä. Säilytä tämä viesti — linkki toimii varaukseen asti.",
    cancelAction: "Peru varaus",
    changeNote:
      "Jos haluat muuttaa aikaa tai seurueen kokoa, ota yhteyttä ravintolaan.",
    signature: "Nähdään pian!",
  },
  en: {
    subject: "Booking confirmed",
    greeting: "Hello",
    intro: "your booking is confirmed. Here are the details:",
    date: "Date",
    time: "Time",
    guests: "Party",
    person: "person",
    people: "people",
    tables: "Table",
    reference: "Booking number",
    cancelUntil: "The cancellation link works until {tunnit} hours before the booking.",
    cancelTitle: "If your plans change",
    cancelBody:
      "Cancel your booking with this link. Keep this message — the link works until the booking.",
    cancelAction: "Cancel booking",
    changeNote:
      "To change the time or party size, please contact the restaurant.",
    signature: "See you soon!",
  },
  sv: {
    subject: "Bokning bekräftad",
    greeting: "Hej",
    intro: "din bokning är bekräftad. Här är detaljerna:",
    date: "Datum",
    time: "Tid",
    guests: "Sällskap",
    person: "person",
    people: "personer",
    tables: "Bord",
    reference: "Bokningsnummer",
    cancelUntil: "Avbokningslänken fungerar fram till {tunnit} timmar före bokningen.",
    cancelTitle: "Om planerna ändras",
    cancelBody:
      "Avboka med den här länken. Spara meddelandet — länken fungerar fram till bokningen.",
    cancelAction: "Avboka",
    changeNote:
      "Kontakta restaurangen om du vill ändra tid eller antal personer.",
    signature: "Vi ses snart!",
  },
  da: {
    subject: "Reservation bekræftet",
    greeting: "Hej",
    intro: "din reservation er bekræftet. Her er detaljerne:",
    date: "Dato",
    time: "Tid",
    guests: "Selskab",
    person: "person",
    people: "personer",
    tables: "Bord",
    reference: "Reservationsnummer",
    cancelUntil: "Afbestillingslinket virker indtil {tunnit} timer før reservationen.",
    cancelTitle: "Hvis planerne ændrer sig",
    cancelBody:
      "Afbestil med dette link. Gem beskeden — linket virker frem til reservationen.",
    cancelAction: "Afbestil",
    changeNote:
      "Kontakt restauranten, hvis du vil ændre tidspunkt eller antal personer.",
    signature: "Vi ses snart!",
  },
  tr: {
    subject: "Rezervasyon onaylandı",
    greeting: "Merhaba",
    intro: "rezervasyonunuz onaylandı. Ayrıntılar:",
    date: "Tarih",
    time: "Saat",
    guests: "Kişi sayısı",
    person: "kişi",
    people: "kişi",
    tables: "Masa",
    reference: "Rezervasyon numarası",
    cancelUntil: "İptal bağlantısı rezervasyondan {tunnit} saat öncesine kadar geçerlidir.",
    cancelTitle: "Planlarınız değişirse",
    cancelBody:
      "Rezervasyonu bu bağlantıdan iptal edebilirsiniz. Bu mesajı saklayın — bağlantı rezervasyona kadar geçerlidir.",
    cancelAction: "Rezervasyonu iptal et",
    changeNote:
      "Saati veya kişi sayısını değiştirmek için lütfen restoranla iletişime geçin.",
    signature: "Yakında görüşmek üzere!",
  },
  et: {
    subject: "Broneering kinnitatud",
    greeting: "Tere",
    intro: "sinu broneering on kinnitatud. Siin on üksikasjad:",
    date: "Kuupäev",
    time: "Kellaaeg",
    guests: "Seltskond",
    person: "inimene",
    people: "inimest",
    tables: "Laud",
    reference: "Broneeringu number",
    cancelUntil: "Tühistamise link töötab kuni {tunnit} tundi enne broneeringut.",
    cancelTitle: "Kui plaanid muutuvad",
    cancelBody:
      "Tühista broneering selle lingiga. Hoia see kiri alles — link töötab kuni broneeringuni.",
    cancelAction: "Tühista broneering",
    changeNote:
      "Aja või seltskonna suuruse muutmiseks võta palun restoraniga ühendust.",
    signature: "Kohtumiseni!",
  },
};

const INTL: Record<EmailLocale, string> = {
  fi: "fi-FI",
  en: "en-GB",
  sv: "sv-SE",
  da: "da-DK",
  tr: "tr-TR",
  et: "et-EE",
};

/**
 * Päivä asiakkaan kielellä.
 *
 * Pelkkä 2026-08-31 on luettavissa mutta ei tarkistettavissa: kukaan
 * ei huomaa siitä että päivä on maanantai. Viikonpäivä on juuri se
 * mitä vahvistuksesta katsotaan.
 */
function paiva(iso: string, locale: EmailLocale): string {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;

  return new Intl.DateTimeFormat(INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/**
 * HTML-merkitys pois.
 *
 * Asiakkaan nimi menee viestiin sellaisenaan, ja sen sisällön valitsee
 * kuka tahansa internetissä. Ilman tätä varauslomake olisi tapa
 * syöttää mitä tahansa merkintää postiin, joka lähtee ravintolan
 * nimissä.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function confirmationEmail(input: ConfirmationInput): EmailContent {
  const t = TEKSTIT[input.locale];
  const pvm = paiva(input.date, input.locale);
  const koko = `${input.partySize} ${input.partySize === 1 ? t.person : t.people}`;

  const rivit: [string, string][] = [
    [t.date, pvm],
    [t.time, input.time],
    [t.guests, koko],
  ];

  if (input.tables.length > 0) {
    rivit.push([t.tables, input.tables.join(", ")]);
  }

  /*
   * Varausnumero viimeisenä rivinä.
   *
   * Ensimmäisenä se olisi ensimmäinen asia jonka asiakas lukee, ja
   * hänen kysymyksensä on päivä ja kello. Numero tarvitaan vasta
   * silloin kun hän soittaa ravintolaan — ja silloin se etsitään
   * viestistä, ei muisteta ulkoa.
   */
  if (input.reference) {
    rivit.push([t.reference, input.reference]);
  }

  /*
   * Peruutusraja luetaan viestistä eikä linkin virheestä.
   *
   * Nolla tarkoittaa "alkuhetkeen asti", ja siitä ei kerrota erikseen:
   * lause "linkki toimii 0 tuntia ennen" on hämmentävämpi kuin
   * kertomatta jättäminen.
   */
  const raja =
    input.cancelHours && input.cancelHours > 0
      ? t.cancelUntil.replace("{tunnit}", String(input.cancelHours))
      : null;

  /*
   * Aihe kertoo ravintolan ja ajan.
   *
   * Postilaatikossa näkyy usein vain aihe. "Varaus vahvistettu" yksin
   * ei kerro mistä ravintolasta eikä milloin, ja juuri sitä viestistä
   * myöhemmin etsitään.
   */
  const subject = `${t.subject} — ${input.restaurantName}, ${pvm} ${input.time}`;

  const text = [
    `${t.greeting} ${input.guestName},`,
    "",
    `${input.restaurantName}: ${t.intro}`,
    "",
    ...rivit.map(([otsikko, arvo]) => `${otsikko}: ${arvo}`),
    "",
    `${t.cancelTitle}`,
    t.cancelBody,
    input.cancelUrl,
    ...(raja ? [raja] : []),
    "",
    t.changeNote,
    "",
    t.signature,
    input.restaurantName,
  ].join("\n");

  /*
   * Yksinkertainen HTML tarkoituksella.
   *
   * Postiohjelmat ovat selaimina vuodelta 2005: ulkoiset tyylitiedostot
   * karsitaan, moderni asettelu hajoaa. Sisennetyt tyylit ja tavalliset
   * elementit näkyvät kaikkialla samalta.
   */
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1b1b;max-width:520px">
<p>${esc(t.greeting)} ${esc(input.guestName)},</p>
<p><strong>${esc(input.restaurantName)}</strong>: ${esc(t.intro)}</p>
<table cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">
${rivit
  .map(
    ([otsikko, arvo]) =>
      `<tr><td style="padding:4px 16px 4px 0;color:#666">${esc(otsikko)}</td><td style="padding:4px 0;font-weight:600">${esc(arvo)}</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin-top:24px"><strong>${esc(t.cancelTitle)}</strong><br>${esc(t.cancelBody)}</p>
<p><a href="${esc(input.cancelUrl)}" style="display:inline-block;padding:10px 18px;background:#1b1b1b;color:#fff;text-decoration:none;border-radius:8px">${esc(t.cancelAction)}</a></p>
<p style="color:#666;font-size:13px">${esc(input.cancelUrl)}</p>
${raja ? `<p style="color:#666;font-size:13px">${esc(raja)}</p>` : ""}
<p style="color:#666;font-size:13px">${esc(t.changeNote)}</p>
<p style="margin-top:24px">${esc(t.signature)}<br>${esc(input.restaurantName)}</p>
</div>`;

  return { subject, text, html };
}
