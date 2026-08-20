/**
 * Segmenttisivujen sisältö (§4).
 *
 * Neljä sisääntuloa samaan tuotteeseen. Rakenne on jaettu, sisältö
 * segmenttikohtainen — näin uusi ovi on datamerkintä, ei uusi sivupohja.
 *
 * Tarinat ja lainaukset ovat havainnollistavia käyttötilanteita, EIVÄT
 * asiakkaiden lausuntoja. Verralla ei ole vielä julkaistavia referenssejä,
 * ja keksityn asiakkaan esittäminen todellisena on kiellettyä (§67).
 */

export interface TimelineMoment {
  time: string;
  text: string;
}

export interface SegmentFaq {
  question: string;
  answer: string;
  /** Jos vastaus koskee ominaisuutta jota ei ole, se sanotaan suoraan. */
  status?: "live" | "planned";
}

export interface Segment {
  slug: string;
  audience: string;
  /** Hero */
  title: string;
  titleAccent: string;
  lead: string;
  ctaNote: string;

  /** Ennen–jälkeen -aikajana */
  timelineIntro: string;
  beforeLabel: string;
  before: TimelineMoment[];
  afterLabel: string;
  after: TimelineMoment[];
  timelineOutro: string;

  /** Kolme asiaa */
  pillarsTitle: string;
  pillars: { title: string; body: string; status: "live" | "planned" }[];

  /** Havainnollistava tilanne */
  scenarioQuote: string;
  scenarioWho: string;

  faq: SegmentFaq[];
}

export const SEGMENTS: Segment[] = [
  {
    slug: "ravintoloille",
    audience: "Ravintoloille",
    title: "Sunnuntai-ilta,",
    titleAccent: "sinä ja kuitit.",
    lead:
      "Avasit ravintolan ruokkiaksesi ihmisiä. Et jakaaksesi päiväraportteja " +
      "kolmeen ALV-kantaan laskimella sunnuntai-iltana. Verra tekee sen osan.",
    ctaNote: "15 kuittia / kk ilmaiseksi · ei luottokorttia",

    timelineIntro:
      "Kahdeksan hetkeä, jotka moni ravintolanpitäjä tunnistaa. Oikealla sama " +
      "viikko, kun jako tapahtuu koneella.",
    beforeLabel: "Ilman Verraa · pino kasvaa",
    before: [
      { time: "22.18", text: "Viimeinen lasku maksettu. Tulostat päiväraportin." },
      { time: "22.47", text: "Tungat sen laatikkoon viime viikon papereiden kanssa." },
      { time: "23.30", text: "Ajat kotiin. Huomenna avaat lounaaksi." },
      { time: "Ti 09.14", text: "Kirjanpitäjä kysyy sähköpostilla päiväraporteista." },
      { time: "Pe 16.00", text: "Et ehtinyt. Pino on kasvanut." },
      { time: "Su 19.30", text: "Keittiön pöytä, laskin, kolme saraketta." },
      { time: "Su 22.14", text: "Lähetät koosteen. Pahoittelut liitteenä." },
      { time: "Ma 08.00", text: "Esivalmistelut. Sama uudelleen." },
    ],
    afterLabel: "Verran kanssa · ilta on sinun",
    after: [
      { time: "22.18", text: "Viimeinen lasku maksettu. Tulostat päiväraportin." },
      { time: "22.47", text: "Otat kuvan ja lähetät sen työtilaan." },
      {
        time: "22.48",
        text: "Verra jakaa rivit omiin ALV-kantoihinsa ja perustelee jokaisen.",
      },
      { time: "Su 19.30", text: "Ei mitään tehtävää. Ilta on vapaa." },
    ],
    timelineOutro:
      "Neljä riviä kahdeksan sijaan. Kirjanpitäjä näkee tilanteen itse, eikä " +
      "sinun tarvitse muistaa lähettää mitään.",

    pillarsTitle: "Kolme asiaa, kaikki kiireisimpänä päivänäsi.",
    pillars: [
      {
        title: "Päiväraportin sekakannat, automaattisesti",
        body:
          "Ruoka, alkoholi, palvelumaksu, pakkaukset — jokainen rivi saa oman " +
          "käsittelynsä ja sääntötunnuksen johon se perustuu. Tietomalli tukee " +
          "yhdeksää samanaikaista ALV-koodia yhdellä tositteella.",
        status: "live",
      },
      {
        title: "Ota kuva, me luemme sen",
        body:
          "JPG, PNG, PDF ja HEIC. Vedä ja pudota selaimessa tai kuvaa puhelimella. " +
          "Sama tiedosto ei mene kahdesti läpi: tiiviste tunnistaa duplikaatin " +
          "ennen kuin mitään tallennetaan.",
        status: "live",
      },
      {
        title: "Lähetä sähköpostilla työtilan omaan osoitteeseen",
        body:
          "Työtilakohtainen vastaanotto-osoite, johon voit lähettää kuitit " +
          "suoraan illan päätteeksi. Tietokantarakenteet ja duplikaattisuoja " +
          "ovat valmiina, mutta vastaanotto ei ole vielä kytketty.",
        status: "planned",
      },
    ],

    scenarioQuote:
      "Päiväraportissa on ruokaa yhdellä kannalla ja olutta toisella. Joka " +
      "kuukausi jaan sen käsin.",
    scenarioWho:
      "Havainnollistava tilanne ravintolanpitäjän arjesta — ei asiakkaan lausunto.",

    faq: [
      {
        question: "Toimiiko se kassajärjestelmäni päiväraportin kanssa?",
        answer:
          "Verra lukee tulostetun tai PDF-muotoisen päiväraportin kuvana, joten " +
          "kassajärjestelmällä ei ole väliä. Suoraa integraatiota kassaan ei ole.",
        status: "planned",
      },
      {
        question: "Kirjanpitäjäni käyttää Procountoria. Meneekö aineisto suoraan?",
        answer:
          "Ei vielä. CSV-vienti toimii ja sen saa tuotua Procountoriin käsin. " +
          "Procountor-, Netvisor- ja e-conomic-integraatioille on palvelurajapinta " +
          "määriteltynä, mutta yhteyttä ei ole rakennettu.",
        status: "planned",
      },
      {
        question: "Entä tipit ja lahjakortit?",
        answer:
          "Molemmille on oma sääntönsä, ja molemmat menevät aina tarkistukseen. " +
          "Tipin käsittely riippuu siitä onko se vapaaehtoinen ja kenelle se päätyy; " +
          "lahjakortilla on merkitystä onko se yksi- vai monikäyttöinen. Verra ei " +
          "ratkaise näitä automaattisesti eikä esitä varmuutta jota sillä ei ole.",
        status: "live",
      },
    ],
  },

  {
    slug: "kirjanpitajille",
    audience: "Kirjanpitäjille",
    title: "Kaikki asiakkaasi.",
    titleAccent: "Yhdessä näkymässä.",
    lead:
      "Aineiston perässä juokseminen ei ole kirjanpitoa. Verra näyttää mikä on " +
      "tullut, mikä odottaa tarkistusta ja mikä on valmis toimitettavaksi — " +
      "ilman että jokaista asiakasta pitää avata erikseen.",
    ctaNote: "Tilitoimistotaso · monen asiakkaan työtila",

    timelineIntro:
      "Kuukauden viimeinen viikko näyttää usein tältä. Oikealla sama viikko, " +
      "kun tilanne on nähtävissä yhdestä näkymästä.",
    beforeLabel: "Ilman Verraa · jahtaaminen",
    before: [
      { time: "Ma", text: "Muistutusviestit kahdellekymmenelle asiakkaalle." },
      { time: "Ti", text: "Kolme vastaa. Loput eivät." },
      { time: "Ke", text: "Soitat perään. Kuitit tulevat sekalaisina liitteinä." },
      { time: "To", text: "Puuttuvien selvittely: mikä on tullut, mikä ei." },
      { time: "Pe", text: "Kirjaus alkaa vasta nyt. Määräaika lähestyy." },
    ],
    afterLabel: "Verran kanssa · tilanne näkyy",
    after: [
      { time: "Ma", text: "Avaat asiakasnäkymän. Näet kenellä on aukkoja." },
      { time: "Ti", text: "Käyt tarkistusjonon läpi — jokainen merkintä kertoo syyn." },
      { time: "Ke", text: "Hyväksyt, viet ja siirryt seuraavaan asiakkaaseen." },
    ],
    timelineOutro:
      "Aineiston tila on jatkuvasti näkyvissä, joten kuukauden viimeinen viikko " +
      "ei ala tilanteen selvittämisestä.",

    pillarsTitle: "Kolme asiaa, jotka vievät eniten aikaa.",
    pillars: [
      {
        title: "Asiakasnäkymä",
        body:
          "Jokaiselle asiakkaalle: montako dokumenttia odottaa käsittelyä, montako " +
          "tarkistusta ja milloin viimeksi tapahtui jotain. Asiakkaat ovat omia " +
          "tenanttejaan ja pääsy kulkee nimenomaisen tilitoimistosuhteen kautta.",
        status: "live",
      },
      {
        title: "Tarkistusjono syineen",
        body:
          "Merkitty dokumentti kertoo miksi se on merkitty: heikko poiminta, " +
          "vahvistamaton ALV-tunniste, sääntöristiriita tai validoimaton sääntö. " +
          "Jono ilman syitä olisi vain lista töitä.",
        status: "live",
      },
      {
        title: "Asiakkaiden kutsuminen",
        body:
          "Kutsutaulu, tokenin tiiviste ja henkilökunnan asiakasrajaukset ovat " +
          "kannassa valmiina. Käyttöliittymä kutsujen lähettämiseen puuttuu, " +
          "joten suhde luodaan toistaiseksi käsin.",
        status: "planned",
      },
    ],

    scenarioQuote:
      "Käytän merkittävän osan viikosta kuittien perässä juoksemiseen. Jos sen " +
      "saisi murto-osaan, hinnoittelumallini muuttuisi.",
    scenarioWho:
      "Havainnollistava tilanne tilitoimiston arjesta — ei asiakkaan lausunto.",

    faq: [
      {
        question: "Näkeekö asiakas minun muiden asiakkaideni tietoja?",
        answer:
          "Ei. Jokainen asiakasorganisaatio on oma tenanttinsa, ja rajat " +
          "pakotetaan tietokannan Row Level Security -politiikoilla jokaisessa " +
          "kyselyssä — ei sovelluslogiikassa.",
        status: "live",
      },
      {
        question: "Voinko rajata työntekijän vain tiettyihin asiakkaisiin?",
        answer:
          "Kyllä. Rajaustaulu on olemassa ja politiikat huomioivat sen: " +
          "firm_staff näkee vain hänelle osoitetut asiakkaat. Käyttöliittymä " +
          "rajausten hallintaan puuttuu vielä.",
        status: "planned",
      },
      {
        question: "Missä muodossa aineisto tulee ulos?",
        answer:
          "CSV, jonka erotin on puolipiste ja jossa on UTF-8-tunniste — " +
          "suomalainen Excel avaa sen suoraan. Rivillä on tosite, päivä, " +
          "toimittaja, ALV-koodi, kanta, summat, sääntötunnus ja hyväksyntätila.",
        status: "live",
      },
    ],
  },

  {
    slug: "kevytyrittajille",
    audience: "Kevytyrittäjille",
    title: "Neljännesvuoden ALV,",
    titleAccent: "ilman iltatöitä.",
    lead:
      "Kuitit sisään pitkin kautta, ALV-erittely koodeittain ulos. Rivit jotka " +
      "eivät ratkea päätyvät jonoon perusteltuina, eivät hiljaa väärään koodiin.",
    ctaNote: "Free-taso riittää monelle · 15 kuittia / kk",

    timelineIntro:
      "Ilmoituskausi tuntuu usein tältä. Oikealla sama kausi, kun kuitit on " +
      "käsitelty sitä mukaa kun ne syntyvät.",
    beforeLabel: "Ilman Verraa · kaksi iltaa",
    before: [
      { time: "Kausi", text: "Kuitit kertyvät lompakkoon, sähköpostiin ja kuvakansioon." },
      { time: "-3 pv", text: "Etsit kaikki. Osa on kadonnut." },
      { time: "-2 pv", text: "Lajittelet käsin: mikä on vähennyskelpoista, mikä ei." },
      { time: "-1 pv", text: "Laskemista, epävarmuutta, arvailua rajatapauksista." },
      { time: "Määräpäivä", text: "Lähetät ja toivot että meni oikein." },
    ],
    afterLabel: "Verran kanssa · jatkuvaa",
    after: [
      { time: "Kausi", text: "Kuvaat kuitin heti. Se käsitellään saman tien." },
      { time: "-3 pv", text: "Avaat ALV-näkymän: erittely koodeittain on valmiina." },
      { time: "Määräpäivä", text: "Tarkistat ratkaisemattomat ja viet." },
    ],
    timelineOutro:
      "Ero ei ole nopeampi ilta vaan se, ettei iltaa tarvita. Työ tapahtuu " +
      "kymmenen sekunnin erissä pitkin kautta.",

    pillarsTitle: "Kolme asiaa, jotka poistavat arvailun.",
    pillars: [
      {
        title: "ALV-erittely koodeittain",
        body:
          "Yhteenveto lasketaan riveiltä, ei dokumenttitasolta. Monikantainen " +
          "tosite ei kirjaudu kokonaan yhteen koodiin, mikä on tavallisin " +
          "yksittäinen virhe.",
        status: "live",
      },
      {
        title: "Vähennyskelpoisuus perusteltuna",
        body:
          "Edustuskulu, henkilökunnan ateria ja työmatka saavat kukin oman " +
          "sääntönsä. Kun sääntö ei ratkaise asiaa turvallisesti, rivi menee " +
          "tarkistukseen sen sijaan että se arvattaisiin.",
        status: "live",
      },
      {
        title: "Matkalaskut yhdellä lauseella",
        body:
          "Kirjoita matka omin sanoin. Verra jäsentää reitin, kilometrit ja " +
          "ateriat, laskee korvauksen versioidusta säännöstä ja kertoo mitä se " +
          "ei tunnistanut.",
        status: "live",
      },
    ],

    scenarioQuote:
      "Neljännesvuoden ALV vie minulta kaksi iltaa joka kerta. Jos joku hoitaisi " +
      "sen, maksaisin siitä.",
    scenarioWho:
      "Havainnollistava tilanne yksinyrittäjän arjesta — ei asiakkaan lausunto.",

    faq: [
      {
        question: "Riittääkö ilmainen taso minulle?",
        answer:
          "Free-taso kattaa 15 dokumenttia kuukaudessa. Näet käytön ja jäljellä " +
          "olevan määrän asetuksista, ja saat varoituksen ennen kuin raja tulee " +
          "vastaan. Maksaminen ei ole vielä käytössä lainkaan.",
        status: "live",
      },
      {
        question: "Mitä tapahtuu jos Verra ei osaa luokitella kuittia?",
        answer:
          "Se merkitsee sen tarkistettavaksi ja kertoo syyn. Verra ei koskaan " +
          "arvaa eikä kirjaa epävarmaa riviä hiljaa johonkin koodiin.",
        status: "live",
      },
      {
        question: "Saanko tietoni ulos jos lopetan?",
        answer:
          "Saat. Vienti on ydinominaisuus, ei lisäosa, ja se sisältää " +
          "dokumentit, rivit ja verotuspäätökset perusteluineen.",
        status: "live",
      },
    ],
  },

  {
    slug: "perustajille",
    audience: "Kansainvälisille perustajille",
    title: "Suomen verokohtelu,",
    titleAccent: "perusteltuna.",
    lead:
      "Et tarvitse luottamusta siihen että kone tietää. Jokainen päätös kertoo " +
      "minkä säännön nojalla se tehtiin, mitä faktoja käytettiin ja milloin " +
      "sääntö on voimassa — voit tarkistaa sen itse tai antaa neuvonantajallesi.",
    ctaNote: "Käyttöliittymä on toistaiseksi vain suomeksi",

    timelineIntro:
      "Ulkomailta tulevan yrittäjän ensimmäinen vuosi näyttää usein tältä. " +
      "Oikealla sama vuosi, kun jokainen päätös on perusteltavissa.",
    beforeLabel: "Ilman Verraa · epävarmuus",
    before: [
      { time: "Kk 1", text: "Luet viranomaisohjeita käännöskoneen läpi." },
      { time: "Kk 2", text: "Et ole varma mikä on vähennyskelpoista." },
      { time: "Kk 4", text: "Rajat ylittävä lasku: käännetty verovelvollisuus vai ei?" },
      { time: "Kk 6", text: "Kirjanpitäjä kysyy perusteita. Et osaa vastata." },
      { time: "Kk 12", text: "Tilinpäätös. Osa kirjauksista joudutaan avaamaan." },
    ],
    afterLabel: "Verran kanssa · jäljitettävää",
    after: [
      { time: "Kk 1", text: "Jokainen päätös kertoo sääntönsä ja käytetyt faktat." },
      { time: "Kk 4", text: "Rajat ylittävä tapaus menee tarkistukseen, ei arvaukseen." },
      { time: "Kk 12", text: "Kysymykseen “miksi näin” on vastaus tallessa." },
    ],
    timelineOutro:
      "Kieli ei muuta päätöstä. Sääntömoottori on kielestä riippumaton, ja " +
      "perustelu on luettavissa myös vuosien päästä.",

    pillarsTitle: "Kolme asiaa, jotka poistavat sokean luottamuksen.",
    pillars: [
      {
        title: "Sääntöselain",
        body:
          "Näet kaikki säännöt, niiden versiot, voimassaoloajat ja statuksen. " +
          "Validoimaton sääntö on merkitty validoimattomaksi — mitään ei esitetä " +
          "vahvistettuna ennen kuin se on.",
        status: "live",
      },
      {
        title: "Rajat ylittävät tapaukset",
        body:
          "EU B2B, EU-kuluttajamyynti ja vienti EU:n ulkopuolelle ovat omia " +
          "sääntöjään. Käännetty verovelvollisuus edellyttää vahvistettua " +
          "ALV-tunnistetta — pelkkä muodollisesti oikea tunniste ei riitä.",
        status: "live",
      },
      {
        title: "Monikielisyys",
        body:
          "Käyttöliittymä on tällä hetkellä vain suomeksi. Käännöskerrosta ei " +
          "ole rakennettu, emmekä väitä muuta. Tietomalli on kielestä " +
          "riippumaton, joten lisäys ei vaadi päätöslogiikan muutosta.",
        status: "planned",
      },
    ],

    scenarioQuote:
      "Luen viranomaisohjeita käännöskoneella. Selitä minulle miksi tämä " +
      "kirjattiin näin, niin olen mukana.",
    scenarioWho:
      "Havainnollistava tilanne ulkomaalaistaustaisen perustajan arjesta — ei " +
      "asiakkaan lausunto.",

    faq: [
      {
        question: "Onko tuote saatavilla englanniksi?",
        answer:
          "Ei vielä. Käyttöliittymä on suomeksi. Verotuspäätös itsessään on " +
          "kielestä riippumaton ja tallennetaan rakenteisena, joten käännös ei " +
          "muuta päätöstä kun se aikanaan tehdään.",
        status: "planned",
      },
      {
        question: "Voinko luottaa siihen että säännöt ovat oikein?",
        answer:
          "Et vielä sokeasti — ja se on tarkoituksellista. Kaikki mukana olevat " +
          "säännöt ovat statukseltaan demo eikä niitä ole validoitu virallista " +
          "lähdettä vasten. Moottori merkitsee jokaisen niillä tehdyn päätöksen " +
          "tarkistettavaksi.",
        status: "live",
      },
      {
        question: "Voiko neuvonantajani tarkistaa päätökset?",
        answer:
          "Voi. Jokaisella päätöksellä on sääntötunnus, versio, voimassaoloaika " +
          "ja käytetyt faktat, ja päätös voidaan ajaa uudelleen samaan " +
          "tulokseen. Audit trail kirjaa jokaisen vaiheen.",
        status: "live",
      },
    ],
  },
];

export function segmentBySlug(slug: string): Segment | undefined {
  return SEGMENTS.find((s) => s.slug === slug);
}
