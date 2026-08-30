/**
 * Vahvistusviestin koelähetys.
 *
 * Käyttöönotossa vikoja on kolme ja ne näyttävät kaikki samalta:
 * viestiä ei tule. Avain voi puuttua, verkkotunnus voi olla
 * varmistamatta, tai vastaanottaja voi olla sellainen johon Resendin
 * testitunnus ei suostu lähettämään. Varauksen kautta testaaminen ei
 * erottele näitä — se sanoo vain että varaus onnistui, koska
 * lähetys tapahtuu vastauksen jälkeen eikä se saa kaataa varausta.
 *
 * Tämä lähettää saman viestin samalla koodilla ja kertoo mitä
 * palvelu vastasi.
 *
 * Käyttö:
 *   node scripts/posti-testi.mjs oma.osoite@example.fi
 */

import { readFileSync } from "node:fs";

/*
 * Ympäristö luetaan .env.localista käsin.
 *
 * Tämä ei ole Next-prosessi, joten se ei lataa tiedostoa itsestään —
 * ja juuri tästä tiedostosta arvot on tarkoituskin lukea, samoista
 * joita palvelin käyttää.
 */
function lataaYmparisto() {
  let sisalto;

  try {
    sisalto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    console.error("Tiedostoa .env.local ei löytynyt.");
    process.exit(1);
  }

  for (const rivi of sisalto.split(/\r?\n/)) {
    const trimmed = rivi.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const kohta = trimmed.indexOf("=");
    if (kohta < 1) continue;

    const nimi = trimmed.slice(0, kohta).trim();
    const arvo = trimmed.slice(kohta + 1).trim();

    if (!(nimi in process.env)) process.env[nimi] = arvo;
  }
}

lataaYmparisto();

const vastaanottaja = process.argv[2];

if (!vastaanottaja) {
  console.error("Anna vastaanottajan osoite:");
  console.error("  node scripts/posti-testi.mjs oma.osoite@example.fi");
  process.exit(1);
}

const avain = process.env.RESEND_API_KEY?.trim();
const lahettaja = process.env.RESERVATION_EMAIL_FROM?.trim();

/*
 * Puuttuvat asetukset nimeltä.
 *
 * "Ei toimi" on hyödytön viesti. Kumpi puuttuu, on korjattavissa.
 */
if (!avain || !lahettaja) {
  console.error("Asetukset puuttuvat .env.local-tiedostosta:");
  if (!avain) console.error("  RESEND_API_KEY on tyhjä");
  if (!lahettaja) console.error("  RESERVATION_EMAIL_FROM on tyhjä");
  process.exit(1);
}

console.log("Lähettäjä:     " + lahettaja);
console.log("Vastaanottaja: " + vastaanottaja);
console.log("Avain:         " + avain.slice(0, 6) + "… (" + avain.length + " merkkiä)");
console.log("");

const vastaus = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${avain}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: lahettaja,
    to: vastaanottaja,
    subject: "Kate — varausvahvistusten koelähetys",
    text: [
      "Tämä on koelähetys.",
      "",
      "Jos luet tätä, varausvahvistukset toimivat: avain kelpaa,",
      "verkkotunnus on varmistettu ja osoite vastaanottaa.",
      "",
      "Oikeassa vahvistuksessa tässä kohtaa on peruutuslinkki.",
    ].join("\n"),
  }),
});

const teksti = await vastaus.text();

if (vastaus.ok) {
  console.log("✓ Lähetetty. Tarkista postilaatikko (myös roskaposti).");
  console.log("  " + teksti);
  process.exit(0);
}

console.error(`✗ Lähetys epäonnistui — HTTP ${vastaus.status}`);
console.error("  " + teksti);
console.error("");

/*
 * Yleisimmät virheet selitettynä.
 *
 * Resendin oma viesti on tarkka mutta olettaa lukijan tuntevan
 * palvelun. Nämä kolme ovat ne joihin käyttöönotto kaatuu.
 */
if (vastaus.status === 403) {
  console.error("403 tarkoittaa lähes aina jompaakumpaa:");
  console.error("");
  console.error("  a) Verkkotunnusta ei ole varmistettu.");
  console.error("     Käy resend.com/domains ja lisää DNS-tietueet.");
  console.error("");
  console.error("  b) Lähettäjä on onboarding@resend.dev, joka lähettää");
  console.error("     vain Resend-tilisi omaan sähköpostiin. Anna se");
  console.error("     osoite vastaanottajaksi, tai varmista verkkotunnus.");
} else if (vastaus.status === 401) {
  console.error("401 tarkoittaa että avain ei kelpaa.");
  console.error("Luo uusi resend.com/api-keys ja korvaa RESEND_API_KEY.");
} else if (vastaus.status === 422 || vastaus.status === 400) {
  console.error("Muoto ei kelpaa. Tarkista RESERVATION_EMAIL_FROM:");
  console.error("  Cafe Monami <varaukset@verkkotunnus.fi>");
}

process.exit(1);
