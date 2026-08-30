import type { Locale } from "./locales";

/**
 * Julkisten sivujen tekstit.
 *
 * YKSI MUOTO, KUUSI KIELTÄ.
 *
 * Tyyppi johdetaan suomenkielisestä sanakirjasta, joten puuttuva
 * käännös on käännösvirhe eikä ajonaikainen yllätys: kääntämätön
 * avain ei mene läpi tyypintarkistuksesta.
 *
 * KÄÄNNÖS ON KÄÄNNÖS, EI KOPIO.
 *
 * Otsikot on kirjoitettu kullakin kielellä luonnollisiksi eikä
 * väännetty suomen rakenteesta. "Yhdessä paikassa" on suomeksi
 * itsenäinen lause; englanniksi sama ajatus kulkee luontevammin
 * yhtenä. Sanajärjestys on siis kielen eikä lähdetekstin mukainen.
 *
 * PITUUS ON OSA KÄÄNNÖSTÄ.
 *
 * Kortin otsikko joka on suomeksi yksi sana voi olla turkiksi kolme.
 * Käännökset on pidetty saman mittaisina kuin lähde niin pitkälle kuin
 * se on luontevaa, jotta korttiruudukko ei revi rivejä eri pituisiksi.
 */

const fi = {
  nav: {
    product: "Tuote",
    features: "Ominaisuudet",
    pricing: "Hinta",
    about: "Meistä",
    login: "Kirjaudu",
    start: "Aloita ilmaiseksi",
    openApp: "Avaa Kate",
    openMenu: "Avaa valikko",
    closeMenu: "Sulje valikko",
    sections: "Sivun osiot",
    language: "Kieli",
    home: "Kate, etusivu",
  },

  hero: {
    label: "Ravintolan talous. Yhdessä paikassa.",
    titleA: "Kaikki ravintolan talousasiat.",
    titleB: "Yhdessä paikassa.",
    body:
      "Kuitit, kulut, myynti, kassaraportit ja kirjanpito ilman turhaa " +
      "käsityötä. Kate pitää taloutesi järjestyksessä.",
    secondary: "Tutustu Kateen",
    previewNote: "Katen käyttöliittymä. Luvut ovat esimerkkejä.",
  },

  preview: {
    today: "Tämän päivän tilanne",
    synced: "Kirjanpito synkronoitu",
    ready: "Kirjanpito valmis",
    sales: "Myynti",
    expenses: "Kulut",
    result: "Tulos",
    receipts: "Kuitit",
    vat: "ALV",
    salesHint: "Kassan päiväraportti",
    expensesHint: "Kirjatut kulut",
    resultHint: "Myynti miinus kulut",
    receiptsHint: "Kaikki käsitelty",
    vatHint: "Maksettava",
    ledgerRevenue: "Kirjanpidon tuotot",
    ledgerExpenses: "Kirjanpidon kulut",
    salesWeek: "Myynti · viikko",
    salesByGroup: "Myynti ryhmittäin",
    groupFood: "Ravintolamyynti",
    groupAlcohol: "Alkoholimyynti",
    groupOther: "Muu myynti",
    month: "Elokuu 2026",
    overview: "Kate · Yleiskatsaus",
    railOverview: "Yleiskatsaus",
    railSales: "Myynti",
    railReceipts: "Kuitit",
    railExpenses: "Kulut",
    railLedger: "Kirjanpito",
    railShifts: "Työvuorot",
  },

  todo: {
    cardTitle: "Mitä sinun pitää tehdä",
    item1: "3 kuittia ei ole kirjanpidossa",
    item2: "ALV-täsmäytys tarkistettavana",
    item3: "1 kirjausesitys odottaa hyväksyntää",
    cardNote:
      "Kate laskee nämä aineistosta joka latauksella. Kun asia on hoidettu, " +
      "rivi katoaa itsestään.",
    heading: "Kate kertoo, mitä seuraavaksi.",
    body:
      "Sinun ei tarvitse muistaa kaikkea itse. Puuttuvat kuitit, " +
      "tarkistettavat kirjaukset ja täsmäämätön ALV nousevat esiin silloin " +
      "kun ne ovat ajankohtaisia.",
  },

  benefits: {
    headingA: "Sinä pyörität ravintolaa.",
    headingB: "Kate pitää numerot järjestyksessä.",
    body:
      "Myynti, kulut, kuitit ja kassaraportit kulkevat automaattisesti " +
      "samaan kokonaisuuteen.",
    receiptsTitle: "Kuitit",
    receiptsBody:
      "Kuvaa kuitti puhelimella. Rivit, ALV ja kategoria poimitaan valmiiksi.",
    financeTitle: "Talous",
    financeBody:
      "Näet mitä ravintola tienaa ja mihin raha menee — päivä ja kuukausi " +
      "kerrallaan.",
    ledgerTitle: "Kirjanpito",
    ledgerBody:
      "Kuitit ja myyntipäivät siirtyvät kirjanpitoon sitä mukaa kun ne " +
      "tallennetaan.",
  },

  flow: {
    heading: "Syötä tieto kerran.",
    body: "Kate yhdistää saman tiedon automaattisesti oikeisiin paikkoihin.",
    step1: "Myynti",
    step1Note: "Ilta päättyy",
    step2: "Kassaraportti",
    step2Note: "Kuvaa tai kirjaa",
    step3: "Kate",
    step3Note: "Yhdistää tiedot",
    step4: "Kirjanpito",
    step4Note: "Syntyy itsestään",
    step5: "Raportit & ALV",
    step5Note: "Valmiina",
  },

  month: {
    heading: "Tiedät aina missä mennään.",
    body: "Kuukauden myynti, kulut, tulos ja ALV samasta näkymästä.",
  },

  features: {
    heading: "Kaikki tärkeä yhdessä paikassa.",
    receipts: "Kuitit",
    receiptsBody: "Kuvaa, tarkista ja järjestä.",
    expenses: "Kulut",
    expensesBody: "Seuraa mihin raha menee.",
    sales: "Myynti",
    salesBody: "Päivä ja kuukausi kerrallaan.",
    till: "Kassaraportit",
    tillBody: "Päiväraportti kuvasta kirjanpitoon.",
    ledger: "Kirjanpito",
    ledgerBody: "Kaksinkertainen kirjanpito automaattisesti.",
    vat: "ALV & veroasiat",
    vatBody: "Luvut valmiina, ohjeet mukana.",
    reports: "Raportit",
    reportsBody: "Päiväkirja, pääkirja, tuloslaskelma ja tase.",
    staff: "Työntekijät",
    staffBody: "Työvuorot, työaika ja palkkalaskelmat.",
    taxNote:
      "Kate valmistelee ALV-luvut kirjanpidosta ja kertoo mitä sinun pitää " +
      "tehdä. Ilmoituksen teet itse OmaVerossa — Kate ei lähetä sitä " +
      "puolestasi.",
    lunch: "Lounaslista",
    lunchBody: "Viikko kerrallaan, oveen ja verkkoon.",
    reservations: "Pöytävaraukset",
    reservationsBody: "Varauslomake omalle sivulle, salinäkymä puhelimeen.",
  },

  pricing: {
    heading: "Yksi hinta. Kaikki mukana.",
    body: "Ei käyttäjäkohtaisia maksuja eikä lisäosia.",
    perMonth: "€ / kk",
    yearly: "790 € / vuosi · säästä 158 € vuodessa",
    incReceipts: "Kuitit",
    incExpenses: "Kulut",
    incSales: "Myynti & kassa",
    incLedger: "Kirjanpito",
    incVat: "ALV & veroasiat",
    incReports: "Raportit",
    incStaff: "Työntekijät",
    incAssistant: "Matti-avustaja",
    incLunch: "Lounaslista",
    incReservations: "Pöytävaraukset",
  },

  finalCta: {
    titleA: "Ravintolan talous.",
    titleB: "Yksinkertaisemmin.",
    body: "Kaikki tärkeä yhdessä paikassa.",
    secondary: "Katso miten Kate toimii",
  },

  footer: {
    tagline: "Ravintolan talous yhdessä paikassa.",
    sitemap: "Sivukartta",
  },

  about: {
    metaTitle: "Meistä – Kate",
    metaDescription:
      "Kate rakennetaan ihmisille, jotka pyörittävät ravintoloita joka " +
      "päivä. Yksi paikka ravintolan tärkeimmille asioille.",
    label: "Meistä",
    heading: "Rakennamme ravintoloille paremman tavan pyörittää arkea.",
    body:
      "Kate syntyi ajatuksesta, että ravintolan tärkeiden asioiden ei " +
      "pitäisi olla hajallaan eri järjestelmissä. Yksi paikka. Vähemmän " +
      "säätöä. Enemmän aikaa itse tekemiseen.",
    photoAlt: "Katen tiimi",
    photoPending: "Tiimikuva lisätään tähän.",
    captionA: "Pieni tiimi. Iso tavoite.",
    captionB:
      "Rakennamme Katea ihmisille, jotka pyörittävät ravintoloita joka päivä.",
    teamHeading: "Ihmiset Katen takana.",
    teamPending:
      "Tiimin esittelyt julkaistaan kun kuvat ovat valmiina. Paikat ovat " +
      "sivulla jo nyt, joten asettelu ei muutu kun tiedot lisätään.",
    whyLabel: "Miksi Kate?",
    whyHeading:
      "Ravintolan pyörittäminen ei saisi tuntua kymmenen eri järjestelmän " +
      "hallitsemiselta.",
    whyBody:
      "Ravintolan arjessa myynti, kuitit, kulut, työntekijät, työvuorot, " +
      "lounaslistat ja raportointi liittyvät kaikki toisiinsa. Silti niitä " +
      "hallitaan usein eri paikoissa.",
    whyEmphasis: "Katen tarkoitus on tuoda nämä yhteen.",
    beliefsLabel: "Mitä uskomme",
    belief1Title: "Yksinkertaisuus",
    belief1Body:
      "Hyvän ohjelmiston pitäisi tehdä työstä helpompaa, ei monimutkaisempaa.",
    belief2Title: "Yksi paikka",
    belief2Body: "Ravintolan tärkeät tiedot kuuluvat yhteen järjestelmään.",
    belief3Title: "Oikea hyöty",
    belief3Body:
      "Emme rakenna ominaisuuksia niiden itsensä vuoksi. Rakennamme asioita, " +
      "jotka säästävät aikaa ja rahaa.",
    ctaHeading: "Rakennetaan ravintoloiden arjesta vähän helpompaa.",
    ctaBody:
      "Tutustu Kateen ja katso, mitä kaikkea voit hallita yhdessä paikassa.",
    cta: "Tutustu Kateen",
  },
} as const;

/** Sanakirjan muoto. Puuttuva avain on käännösvirhe. */
export type Dictionary = {
  [K in keyof typeof fi]: { [P in keyof (typeof fi)[K]]: string };
};

// ---------------------------------------------------------------------------

const en: Dictionary = {
  nav: {
    product: "Product",
    features: "Features",
    pricing: "Pricing",
    about: "About",
    login: "Log in",
    start: "Start for free",
    openApp: "Open Kate",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    sections: "Page sections",
    language: "Language",
    home: "Kate, home",
  },
  hero: {
    label: "Restaurant finances. In one place.",
    titleA: "Every financial task in your restaurant.",
    titleB: "In one place.",
    body:
      "Receipts, expenses, sales, till reports and bookkeeping without the " +
      "busywork. Kate keeps your finances in order.",
    secondary: "See how it works",
    previewNote: "The Kate interface. Figures are examples.",
  },
  preview: {
    today: "Today at a glance",
    synced: "Bookkeeping synced",
    ready: "Bookkeeping done",
    sales: "Sales",
    expenses: "Expenses",
    result: "Result",
    receipts: "Receipts",
    vat: "VAT",
    salesHint: "From the till report",
    expensesHint: "Recorded expenses",
    resultHint: "Sales minus expenses",
    receiptsHint: "All processed",
    vatHint: "Payable",
    ledgerRevenue: "Revenue in the ledger",
    ledgerExpenses: "Expenses in the ledger",
    salesWeek: "Sales · this week",
    salesByGroup: "Sales by group",
    groupFood: "Food sales",
    groupAlcohol: "Alcohol sales",
    groupOther: "Other sales",
    month: "August 2026",
    overview: "Kate · Overview",
    railOverview: "Overview",
    railSales: "Sales",
    railReceipts: "Receipts",
    railExpenses: "Expenses",
    railLedger: "Bookkeeping",
    railShifts: "Shifts",
  },
  todo: {
    cardTitle: "What needs your attention",
    item1: "3 receipts are not in the ledger",
    item2: "VAT reconciliation needs a check",
    item3: "1 draft entry is waiting for approval",
    cardNote:
      "Kate works these out from your data on every load. Once something is " +
      "handled, the line disappears on its own.",
    heading: "Kate tells you what comes next.",
    body:
      "You do not have to keep it all in your head. Missing receipts, entries " +
      "to review and VAT that does not add up surface when they matter.",
  },
  benefits: {
    headingA: "You run the restaurant.",
    headingB: "Kate keeps the numbers straight.",
    body:
      "Sales, expenses, receipts and till reports all flow into the same " +
      "place automatically.",
    receiptsTitle: "Receipts",
    receiptsBody:
      "Photograph a receipt. The lines, VAT and category are read for you.",
    financeTitle: "Finances",
    financeBody:
      "See what the restaurant earns and where the money goes — by day and by " +
      "month.",
    ledgerTitle: "Bookkeeping",
    ledgerBody:
      "Receipts and sales days reach the ledger as soon as they are saved.",
  },
  flow: {
    heading: "Enter it once.",
    body: "Kate routes the same data to the right places automatically.",
    step1: "Sales",
    step1Note: "The evening ends",
    step2: "Till report",
    step2Note: "Photograph or type",
    step3: "Kate",
    step3Note: "Connects the data",
    step4: "Bookkeeping",
    step4Note: "Happens by itself",
    step5: "Reports & VAT",
    step5Note: "Ready to use",
  },
  month: {
    heading: "You always know where you stand.",
    body: "The month's sales, expenses, result and VAT in one view.",
  },
  features: {
    heading: "Everything that matters, in one place.",
    receipts: "Receipts",
    receiptsBody: "Capture, review and sort.",
    expenses: "Expenses",
    expensesBody: "Follow where the money goes.",
    sales: "Sales",
    salesBody: "By day and by month.",
    till: "Till reports",
    tillBody: "From a photo to the ledger.",
    ledger: "Bookkeeping",
    ledgerBody: "Real double-entry, automatically.",
    vat: "VAT & tax",
    vatBody: "Figures ready, guidance included.",
    reports: "Reports",
    reportsBody: "Journal, ledger, income statement and balance sheet.",
    staff: "Staff",
    staffBody: "Shifts, hours and payslips.",
    taxNote:
      "Kate prepares your VAT figures from the ledger and tells you what to " +
      "do. You file the return yourself in the tax authority's service — " +
      "Kate does not submit it for you.",
    lunch: "Lunch menu",
    lunchBody: "A week at a time, for the door and the web.",
    reservations: "Table bookings",
    reservationsBody: "A booking form for your own site, the floor on your phone.",
  },
  pricing: {
    heading: "One price. Everything included.",
    body: "No per-user fees and no add-ons.",
    perMonth: "€ / month",
    yearly: "€790 / year · save €158 a year",
    incReceipts: "Receipts",
    incExpenses: "Expenses",
    incSales: "Sales & till",
    incLedger: "Bookkeeping",
    incVat: "VAT & tax",
    incReports: "Reports",
    incStaff: "Staff",
    incAssistant: "Matti assistant",
    incLunch: "Lunch menu",
    incReservations: "Table bookings",
  },
  finalCta: {
    titleA: "Restaurant finances.",
    titleB: "Made simpler.",
    body: "Everything that matters, in one place.",
    secondary: "See how Kate works",
  },
  footer: {
    tagline: "Restaurant finances in one place.",
    sitemap: "Sitemap",
  },
  about: {
    metaTitle: "About – Kate",
    metaDescription:
      "Kate is built for the people who run restaurants every day. One place " +
      "for what matters most.",
    label: "About",
    heading: "We are building a better way to run a restaurant day to day.",
    body:
      "Kate started from a simple idea: the important parts of running a " +
      "restaurant should not be scattered across separate systems. One place. " +
      "Less fiddling. More time for the work itself.",
    photoAlt: "The Kate team",
    photoPending: "The team photo goes here.",
    captionA: "A small team. A large goal.",
    captionB:
      "We build Kate for the people who run restaurants every single day.",
    teamHeading: "The people behind Kate.",
    teamPending:
      "Team profiles go live once the photographs are ready. The places are " +
      "already on the page, so nothing shifts when the details arrive.",
    whyLabel: "Why Kate?",
    whyHeading:
      "Running a restaurant should not feel like managing ten different " +
      "systems.",
    whyBody:
      "Sales, receipts, expenses, staff, shifts, lunch menus and reporting all " +
      "belong to the same day. They are still usually handled in separate " +
      "places.",
    whyEmphasis: "Kate exists to bring them together.",
    beliefsLabel: "What we believe",
    belief1Title: "Simplicity",
    belief1Body: "Good software should make work easier, not more complicated.",
    belief2Title: "One place",
    belief2Body:
      "A restaurant's important information belongs in a single system.",
    belief3Title: "Real benefit",
    belief3Body:
      "We do not build features for their own sake. We build things that save " +
      "time and money.",
    ctaHeading: "Let's make restaurant work a little easier.",
    ctaBody: "Take a look at Kate and see what you can run from one place.",
    cta: "Explore Kate",
  },
};

// ---------------------------------------------------------------------------

const sv: Dictionary = {
  nav: {
    product: "Produkt",
    features: "Funktioner",
    pricing: "Pris",
    about: "Om oss",
    login: "Logga in",
    start: "Kom igång gratis",
    openApp: "Öppna Kate",
    openMenu: "Öppna menyn",
    closeMenu: "Stäng menyn",
    sections: "Sidans avsnitt",
    language: "Språk",
    home: "Kate, startsida",
  },
  hero: {
    label: "Restaurangens ekonomi. På ett ställe.",
    titleA: "Hela restaurangens ekonomi.",
    titleB: "På ett ställe.",
    body:
      "Kvitton, utgifter, försäljning, kassarapporter och bokföring utan " +
      "onödigt handarbete. Kate håller ordning på ekonomin.",
    secondary: "Se hur det fungerar",
    previewNote: "Kates gränssnitt. Siffrorna är exempel.",
  },
  preview: {
    today: "Dagens läge",
    synced: "Bokföringen synkad",
    ready: "Bokföringen klar",
    sales: "Försäljning",
    expenses: "Utgifter",
    result: "Resultat",
    receipts: "Kvitton",
    vat: "Moms",
    salesHint: "Från kassarapporten",
    expensesHint: "Bokförda utgifter",
    resultHint: "Försäljning minus utgifter",
    receiptsHint: "Allt behandlat",
    vatHint: "Att betala",
    ledgerRevenue: "Intäkter i bokföringen",
    ledgerExpenses: "Utgifter i bokföringen",
    salesWeek: "Försäljning · vecka",
    salesByGroup: "Försäljning per grupp",
    groupFood: "Restaurangförsäljning",
    groupAlcohol: "Alkoholförsäljning",
    groupOther: "Övrig försäljning",
    month: "Augusti 2026",
    overview: "Kate · Översikt",
    railOverview: "Översikt",
    railSales: "Försäljning",
    railReceipts: "Kvitton",
    railExpenses: "Utgifter",
    railLedger: "Bokföring",
    railShifts: "Skift",
  },
  todo: {
    cardTitle: "Det här behöver du göra",
    item1: "3 kvitton saknas i bokföringen",
    item2: "Momsavstämningen behöver kontrolleras",
    item3: "1 bokföringsförslag väntar på godkännande",
    cardNote:
      "Kate räknar ut det här från dina uppgifter vid varje sidladdning. När " +
      "något är åtgärdat försvinner raden av sig själv.",
    heading: "Kate säger vad som står på tur.",
    body:
      "Du behöver inte komma ihåg allt själv. Kvitton som saknas, poster som " +
      "ska granskas och moms som inte stämmer lyfts fram när det är dags.",
  },
  benefits: {
    headingA: "Du driver restaurangen.",
    headingB: "Kate håller ordning på siffrorna.",
    body:
      "Försäljning, utgifter, kvitton och kassarapporter hamnar automatiskt " +
      "i samma helhet.",
    receiptsTitle: "Kvitton",
    receiptsBody:
      "Fotografera kvittot. Rader, moms och kategori läses av åt dig.",
    financeTitle: "Ekonomi",
    financeBody:
      "Se vad restaurangen tjänar och vart pengarna tar vägen — dag för dag " +
      "och månad för månad.",
    ledgerTitle: "Bokföring",
    ledgerBody:
      "Kvitton och försäljningsdagar går till bokföringen så fort de sparas.",
  },
  flow: {
    heading: "Mata in en gång.",
    body: "Kate för samma uppgift vidare till rätt ställen automatiskt.",
    step1: "Försäljning",
    step1Note: "Kvällen tar slut",
    step2: "Kassarapport",
    step2Note: "Fotografera eller skriv",
    step3: "Kate",
    step3Note: "Kopplar ihop",
    step4: "Bokföring",
    step4Note: "Sker av sig själv",
    step5: "Rapporter & moms",
    step5Note: "Klart att använda",
  },
  month: {
    heading: "Du vet alltid var du står.",
    body: "Månadens försäljning, utgifter, resultat och moms i en vy.",
  },
  features: {
    heading: "Allt viktigt på ett ställe.",
    receipts: "Kvitton",
    receiptsBody: "Fotografera, granska och sortera.",
    expenses: "Utgifter",
    expensesBody: "Följ vart pengarna går.",
    sales: "Försäljning",
    salesBody: "Dag för dag och månad för månad.",
    till: "Kassarapporter",
    tillBody: "Från foto till bokföring.",
    ledger: "Bokföring",
    ledgerBody: "Dubbel bokföring automatiskt.",
    vat: "Moms & skatt",
    vatBody: "Siffrorna klara, anvisningar med.",
    reports: "Rapporter",
    reportsBody: "Dagbok, huvudbok, resultat- och balansräkning.",
    staff: "Personal",
    staffBody: "Skift, arbetstid och lönebesked.",
    taxNote:
      "Kate förbereder momsuppgifterna utifrån bokföringen och berättar vad " +
      "du ska göra. Deklarationen lämnar du in själv hos Skatteförvaltningen " +
      "— Kate skickar den inte åt dig.",
    lunch: "Lunchlista",
    lunchBody: "En vecka i taget, till dörren och webben.",
    reservations: "Bordsbokningar",
    reservationsBody: "Ett bokningsformulär till egna sidan, salen i telefonen.",
  },
  pricing: {
    heading: "Ett pris. Allt ingår.",
    body: "Inga avgifter per användare och inga tillägg.",
    perMonth: "€ / mån",
    yearly: "790 € / år · spara 158 € per år",
    incReceipts: "Kvitton",
    incExpenses: "Utgifter",
    incSales: "Försäljning & kassa",
    incLedger: "Bokföring",
    incVat: "Moms & skatt",
    incReports: "Rapporter",
    incStaff: "Personal",
    incAssistant: "Matti-assistenten",
    incLunch: "Lunchlista",
    incReservations: "Bordsbokningar",
  },
  finalCta: {
    titleA: "Restaurangens ekonomi.",
    titleB: "Enklare.",
    body: "Allt viktigt på ett ställe.",
    secondary: "Se hur Kate fungerar",
  },
  footer: {
    tagline: "Restaurangens ekonomi på ett ställe.",
    sitemap: "Webbplatskarta",
  },
  about: {
    metaTitle: "Om oss – Kate",
    metaDescription:
      "Kate byggs för dem som driver restauranger varje dag. Ett ställe för " +
      "det som är viktigast.",
    label: "Om oss",
    heading: "Vi bygger ett bättre sätt att sköta restaurangvardagen.",
    body:
      "Kate växte fram ur tanken att det viktigaste i en restaurang inte " +
      "borde ligga utspritt i olika system. Ett ställe. Mindre pillande. Mer " +
      "tid för själva jobbet.",
    photoAlt: "Kates team",
    photoPending: "Teambilden kommer här.",
    captionA: "Litet team. Stort mål.",
    captionB: "Vi bygger Kate för dem som driver restauranger varje dag.",
    teamHeading: "Människorna bakom Kate.",
    teamPending:
      "Teamet presenteras när bilderna är klara. Platserna finns redan på " +
      "sidan, så ingenting flyttar sig när uppgifterna kommer.",
    whyLabel: "Varför Kate?",
    whyHeading:
      "Att driva en restaurang borde inte kännas som att sköta tio olika " +
      "system.",
    whyBody:
      "Försäljning, kvitton, utgifter, personal, skift, lunchlistor och " +
      "rapportering hör till samma dag. Ändå sköts de oftast på olika håll.",
    whyEmphasis: "Kate finns för att föra ihop dem.",
    beliefsLabel: "Vad vi tror på",
    belief1Title: "Enkelhet",
    belief1Body: "Bra programvara ska göra jobbet lättare, inte krångligare.",
    belief2Title: "Ett ställe",
    belief2Body: "Restaurangens viktiga uppgifter hör hemma i ett system.",
    belief3Title: "Verklig nytta",
    belief3Body:
      "Vi bygger inte funktioner för sakens skull. Vi bygger sådant som sparar " +
      "tid och pengar.",
    ctaHeading: "Låt oss göra restaurangvardagen lite enklare.",
    ctaBody: "Titta närmare på Kate och se vad du kan sköta på ett ställe.",
    cta: "Utforska Kate",
  },
};

// ---------------------------------------------------------------------------

const da: Dictionary = {
  nav: {
    product: "Produkt",
    features: "Funktioner",
    pricing: "Pris",
    about: "Om os",
    login: "Log ind",
    start: "Kom i gang gratis",
    openApp: "Åbn Kate",
    openMenu: "Åbn menuen",
    closeMenu: "Luk menuen",
    sections: "Sidens afsnit",
    language: "Sprog",
    home: "Kate, forside",
  },
  hero: {
    label: "Restaurantens økonomi. Ét sted.",
    titleA: "Hele restaurantens økonomi.",
    titleB: "Ét sted.",
    body:
      "Kvitteringer, udgifter, salg, kasserapporter og bogføring uden unødigt " +
      "håndarbejde. Kate holder styr på økonomien.",
    secondary: "Se hvordan det virker",
    previewNote: "Kates brugerflade. Tallene er eksempler.",
  },
  preview: {
    today: "Dagens status",
    synced: "Bogføringen er synkroniseret",
    ready: "Bogføringen er klar",
    sales: "Salg",
    expenses: "Udgifter",
    result: "Resultat",
    receipts: "Kvitteringer",
    vat: "Moms",
    salesHint: "Fra kasserapporten",
    expensesHint: "Bogførte udgifter",
    resultHint: "Salg minus udgifter",
    receiptsHint: "Alt behandlet",
    vatHint: "Til betaling",
    ledgerRevenue: "Indtægter i bogføringen",
    ledgerExpenses: "Udgifter i bogføringen",
    salesWeek: "Salg · uge",
    salesByGroup: "Salg pr. gruppe",
    groupFood: "Restaurantsalg",
    groupAlcohol: "Alkoholsalg",
    groupOther: "Øvrigt salg",
    month: "August 2026",
    overview: "Kate · Overblik",
    railOverview: "Overblik",
    railSales: "Salg",
    railReceipts: "Kvitteringer",
    railExpenses: "Udgifter",
    railLedger: "Bogføring",
    railShifts: "Vagter",
  },
  todo: {
    cardTitle: "Det skal du se på",
    item1: "3 kvitteringer mangler i bogføringen",
    item2: "Momsafstemningen skal kontrolleres",
    item3: "1 bogføringsforslag venter på godkendelse",
    cardNote:
      "Kate regner det ud fra dine data ved hver indlæsning. Når noget er " +
      "klaret, forsvinder linjen af sig selv.",
    heading: "Kate fortæller, hvad der er næste skridt.",
    body:
      "Du behøver ikke huske det hele selv. Manglende kvitteringer, posteringer " +
      "til gennemsyn og moms, der ikke stemmer, dukker op, når det er aktuelt.",
  },
  benefits: {
    headingA: "Du driver restauranten.",
    headingB: "Kate holder styr på tallene.",
    body:
      "Salg, udgifter, kvitteringer og kasserapporter ender automatisk samme " +
      "sted.",
    receiptsTitle: "Kvitteringer",
    receiptsBody:
      "Tag et billede af kvitteringen. Linjer, moms og kategori aflæses for dig.",
    financeTitle: "Økonomi",
    financeBody:
      "Se hvad restauranten tjener, og hvor pengene går hen — dag for dag og " +
      "måned for måned.",
    ledgerTitle: "Bogføring",
    ledgerBody:
      "Kvitteringer og salgsdage når bogføringen, så snart de gemmes.",
  },
  flow: {
    heading: "Indtast én gang.",
    body: "Kate sender den samme oplysning videre til de rigtige steder.",
    step1: "Salg",
    step1Note: "Aftenen slutter",
    step2: "Kasserapport",
    step2Note: "Fotografér eller skriv",
    step3: "Kate",
    step3Note: "Samler dataene",
    step4: "Bogføring",
    step4Note: "Sker af sig selv",
    step5: "Rapporter & moms",
    step5Note: "Klar til brug",
  },
  month: {
    heading: "Du ved altid, hvor du står.",
    body: "Månedens salg, udgifter, resultat og moms i én visning.",
  },
  features: {
    heading: "Alt det vigtige ét sted.",
    receipts: "Kvitteringer",
    receiptsBody: "Fotografér, gennemgå og sortér.",
    expenses: "Udgifter",
    expensesBody: "Følg hvor pengene går hen.",
    sales: "Salg",
    salesBody: "Dag for dag og måned for måned.",
    till: "Kasserapporter",
    tillBody: "Fra foto til bogføring.",
    ledger: "Bogføring",
    ledgerBody: "Dobbelt bogholderi automatisk.",
    vat: "Moms & skat",
    vatBody: "Tallene klar, vejledning med.",
    reports: "Rapporter",
    reportsBody: "Dagbog, hovedbog, resultatopgørelse og balance.",
    staff: "Medarbejdere",
    staffBody: "Vagter, arbejdstid og lønsedler.",
    taxNote:
      "Kate klargør momstallene ud fra bogføringen og fortæller, hvad du skal " +
      "gøre. Angivelsen indsender du selv hos skattemyndigheden — Kate sender " +
      "den ikke for dig.",
    lunch: "Frokostmenu",
    lunchBody: "En uge ad gangen, til døren og nettet.",
    reservations: "Bordbestillinger",
    reservationsBody: "En bestillingsformular til egen side, salen i telefonen.",
  },
  pricing: {
    heading: "Én pris. Det hele er med.",
    body: "Ingen betaling pr. bruger og ingen tilkøb.",
    perMonth: "€ / md.",
    yearly: "790 € / år · spar 158 € om året",
    incReceipts: "Kvitteringer",
    incExpenses: "Udgifter",
    incSales: "Salg & kasse",
    incLedger: "Bogføring",
    incVat: "Moms & skat",
    incReports: "Rapporter",
    incStaff: "Medarbejdere",
    incAssistant: "Matti-assistenten",
    incLunch: "Frokostmenu",
    incReservations: "Bordbestillinger",
  },
  finalCta: {
    titleA: "Restaurantens økonomi.",
    titleB: "Enklere.",
    body: "Alt det vigtige ét sted.",
    secondary: "Se hvordan Kate virker",
  },
  footer: {
    tagline: "Restaurantens økonomi ét sted.",
    sitemap: "Sitemap",
  },
  about: {
    metaTitle: "Om os – Kate",
    metaDescription:
      "Kate bygges til dem, der driver restauranter hver dag. Ét sted til det, " +
      "der betyder mest.",
    label: "Om os",
    heading: "Vi bygger en bedre måde at drive restaurantens hverdag på.",
    body:
      "Kate opstod ud fra tanken om, at det vigtigste i en restaurant ikke " +
      "burde ligge spredt i forskellige systemer. Ét sted. Mindre bøvl. Mere " +
      "tid til selve arbejdet.",
    photoAlt: "Kate-teamet",
    photoPending: "Teambilledet kommer her.",
    captionA: "Lille team. Stort mål.",
    captionB: "Vi bygger Kate til dem, der driver restauranter hver dag.",
    teamHeading: "Menneskene bag Kate.",
    teamPending:
      "Teamet præsenteres, når billederne er klar. Pladserne er allerede på " +
      "siden, så intet flytter sig, når oplysningerne kommer.",
    whyLabel: "Hvorfor Kate?",
    whyHeading:
      "At drive en restaurant burde ikke føles som at styre ti forskellige " +
      "systemer.",
    whyBody:
      "Salg, kvitteringer, udgifter, medarbejdere, vagter, frokostmenuer og " +
      "rapportering hører til samme dag. Alligevel håndteres de oftest hver " +
      "for sig.",
    whyEmphasis: "Kate findes for at samle dem.",
    beliefsLabel: "Det tror vi på",
    belief1Title: "Enkelhed",
    belief1Body:
      "God software skal gøre arbejdet lettere, ikke mere indviklet.",
    belief2Title: "Ét sted",
    belief2Body: "Restaurantens vigtige oplysninger hører til i ét system.",
    belief3Title: "Reel nytte",
    belief3Body:
      "Vi bygger ikke funktioner for funktionernes skyld. Vi bygger det, der " +
      "sparer tid og penge.",
    ctaHeading: "Lad os gøre restaurantens hverdag en smule lettere.",
    ctaBody: "Kig på Kate og se, hvad du kan styre ét sted.",
    cta: "Udforsk Kate",
  },
};

// ---------------------------------------------------------------------------

const tr: Dictionary = {
  nav: {
    product: "Ürün",
    features: "Özellikler",
    pricing: "Fiyat",
    about: "Hakkımızda",
    login: "Giriş yap",
    start: "Ücretsiz başla",
    openApp: "Kate'i aç",
    openMenu: "Menüyü aç",
    closeMenu: "Menüyü kapat",
    sections: "Sayfa bölümleri",
    language: "Dil",
    home: "Kate, ana sayfa",
  },
  hero: {
    label: "Restoran finansı. Tek yerde.",
    titleA: "Restoranın tüm mali işleri.",
    titleB: "Tek yerde.",
    body:
      "Fişler, giderler, satışlar, kasa raporları ve muhasebe; gereksiz elle " +
      "iş olmadan. Kate finansınızı düzende tutar.",
    secondary: "Nasıl çalıştığını gör",
    previewNote: "Kate arayüzü. Rakamlar örnektir.",
  },
  preview: {
    today: "Bugünün durumu",
    synced: "Muhasebe eşitlendi",
    ready: "Muhasebe hazır",
    sales: "Satış",
    expenses: "Giderler",
    result: "Sonuç",
    receipts: "Fişler",
    vat: "KDV",
    salesHint: "Kasa raporundan",
    expensesHint: "Kaydedilen giderler",
    resultHint: "Satış eksi gider",
    receiptsHint: "Tümü işlendi",
    vatHint: "Ödenecek",
    ledgerRevenue: "Muhasebedeki gelirler",
    ledgerExpenses: "Muhasebedeki giderler",
    salesWeek: "Satış · hafta",
    salesByGroup: "Gruba göre satış",
    groupFood: "Restoran satışı",
    groupAlcohol: "Alkol satışı",
    groupOther: "Diğer satışlar",
    month: "Ağustos 2026",
    overview: "Kate · Genel bakış",
    railOverview: "Genel bakış",
    railSales: "Satış",
    railReceipts: "Fişler",
    railExpenses: "Giderler",
    railLedger: "Muhasebe",
    railShifts: "Vardiyalar",
  },
  todo: {
    cardTitle: "Yapmanız gerekenler",
    item1: "3 fiş muhasebeye geçmedi",
    item2: "KDV mutabakatı kontrol bekliyor",
    item3: "1 kayıt önerisi onay bekliyor",
    cardNote:
      "Kate bunları her açılışta verilerinizden hesaplar. İş halledildiğinde " +
      "satır kendiliğinden kaybolur.",
    heading: "Sırada ne olduğunu Kate söyler.",
    body:
      "Her şeyi aklınızda tutmanız gerekmez. Eksik fişler, gözden geçirilecek " +
      "kayıtlar ve tutmayan KDV, zamanı geldiğinde öne çıkar.",
  },
  benefits: {
    headingA: "Restoranı siz yönetirsiniz.",
    headingB: "Rakamları Kate düzenli tutar.",
    body:
      "Satış, gider, fiş ve kasa raporları otomatik olarak aynı yerde " +
      "toplanır.",
    receiptsTitle: "Fişler",
    receiptsBody:
      "Fişin fotoğrafını çekin. Satırlar, KDV ve kategori sizin için okunur.",
    financeTitle: "Finans",
    financeBody:
      "Restoranın ne kazandığını ve paranın nereye gittiğini görün — gün gün " +
      "ve ay ay.",
    ledgerTitle: "Muhasebe",
    ledgerBody:
      "Fişler ve satış günleri kaydedilir kaydedilmez muhasebeye geçer.",
  },
  flow: {
    heading: "Bir kez girin.",
    body: "Kate aynı bilgiyi otomatik olarak doğru yerlere iletir.",
    step1: "Satış",
    step1Note: "Akşam biter",
    step2: "Kasa raporu",
    step2Note: "Fotoğraflayın ya da yazın",
    step3: "Kate",
    step3Note: "Verileri birleştirir",
    step4: "Muhasebe",
    step4Note: "Kendiliğinden oluşur",
    step5: "Raporlar & KDV",
    step5Note: "Kullanıma hazır",
  },
  month: {
    heading: "Nerede olduğunuzu her zaman bilirsiniz.",
    body: "Ayın satışı, gideri, sonucu ve KDV'si tek ekranda.",
  },
  features: {
    heading: "Önemli olan her şey tek yerde.",
    receipts: "Fişler",
    receiptsBody: "Çekin, kontrol edin, düzenleyin.",
    expenses: "Giderler",
    expensesBody: "Paranın nereye gittiğini izleyin.",
    sales: "Satış",
    salesBody: "Gün gün ve ay ay.",
    till: "Kasa raporları",
    tillBody: "Fotoğraftan muhasebeye.",
    ledger: "Muhasebe",
    ledgerBody: "Çift taraflı kayıt, otomatik.",
    vat: "KDV & vergi",
    vatBody: "Rakamlar hazır, yönerge yanında.",
    reports: "Raporlar",
    reportsBody: "Yevmiye, defteri kebir, gelir tablosu ve bilanço.",
    staff: "Çalışanlar",
    staffBody: "Vardiya, çalışma saati ve bordro.",
    taxNote:
      "Kate KDV rakamlarını muhasebeden hazırlar ve ne yapmanız gerektiğini " +
      "söyler. Beyannameyi vergi idaresine kendiniz verirsiniz — Kate sizin " +
      "adınıza göndermez.",
    lunch: "Öğle menüsü",
    lunchBody: "Haftalık olarak, kapıya ve web'e.",
    reservations: "Masa rezervasyonları",
    reservationsBody: "Kendi siteniz için rezervasyon formu, salon telefonunuzda.",
  },
  pricing: {
    heading: "Tek fiyat. Her şey dahil.",
    body: "Kullanıcı başına ücret yok, ek paket yok.",
    perMonth: "€ / ay",
    yearly: "790 € / yıl · yılda 158 € tasarruf",
    incReceipts: "Fişler",
    incExpenses: "Giderler",
    incSales: "Satış & kasa",
    incLedger: "Muhasebe",
    incVat: "KDV & vergi",
    incReports: "Raporlar",
    incStaff: "Çalışanlar",
    incAssistant: "Matti asistanı",
    incLunch: "Öğle menüsü",
    incReservations: "Masa rezervasyonları",
  },
  finalCta: {
    titleA: "Restoran finansı.",
    titleB: "Daha basit.",
    body: "Önemli olan her şey tek yerde.",
    secondary: "Kate nasıl çalışır",
  },
  footer: {
    tagline: "Restoran finansı tek yerde.",
    sitemap: "Site haritası",
  },
  about: {
    metaTitle: "Hakkımızda – Kate",
    metaDescription:
      "Kate, her gün restoran işletenler için geliştiriliyor. En önemli işler " +
      "için tek bir yer.",
    label: "Hakkımızda",
    heading: "Restoranın günlük işleyişi için daha iyi bir yol kuruyoruz.",
    body:
      "Kate, bir restoranın önemli işlerinin ayrı sistemlere dağılmaması " +
      "gerektiği düşüncesinden doğdu. Tek yer. Daha az uğraş. İşin kendisine " +
      "daha çok zaman.",
    photoAlt: "Kate ekibi",
    photoPending: "Ekip fotoğrafı buraya gelecek.",
    captionA: "Küçük ekip. Büyük hedef.",
    captionB: "Kate'i her gün restoran işletenler için geliştiriyoruz.",
    teamHeading: "Kate'in arkasındaki insanlar.",
    teamPending:
      "Ekip tanıtımları fotoğraflar hazır olduğunda yayınlanacak. Yerler " +
      "sayfada şimdiden hazır, bilgiler eklendiğinde düzen değişmeyecek.",
    whyLabel: "Neden Kate?",
    whyHeading:
      "Bir restoranı işletmek, on ayrı sistemi yönetmek gibi hissettirmemeli.",
    whyBody:
      "Satış, fiş, gider, çalışanlar, vardiyalar, öğle menüleri ve raporlama " +
      "aynı güne aittir. Yine de çoğu zaman ayrı yerlerde yönetilir.",
    whyEmphasis: "Kate bunları bir araya getirmek için var.",
    beliefsLabel: "Neye inanıyoruz",
    belief1Title: "Sadelik",
    belief1Body: "İyi yazılım işi kolaylaştırmalı, karmaşıklaştırmamalı.",
    belief2Title: "Tek yer",
    belief2Body: "Restoranın önemli bilgileri tek bir sistemde durmalı.",
    belief3Title: "Gerçek fayda",
    belief3Body:
      "Özellikleri kendileri için geliştirmiyoruz. Zaman ve para kazandıran " +
      "şeyleri geliştiriyoruz.",
    ctaHeading: "Restoranın gününü biraz kolaylaştıralım.",
    ctaBody: "Kate'e göz atın ve tek yerden neleri yönetebileceğinizi görün.",
    cta: "Kate'i keşfet",
  },
};

// ---------------------------------------------------------------------------

const et: Dictionary = {
  nav: {
    product: "Toode",
    features: "Võimalused",
    pricing: "Hind",
    about: "Meist",
    login: "Logi sisse",
    start: "Alusta tasuta",
    openApp: "Ava Kate",
    openMenu: "Ava menüü",
    closeMenu: "Sulge menüü",
    sections: "Lehe osad",
    language: "Keel",
    home: "Kate, esileht",
  },
  hero: {
    label: "Restorani rahaasjad. Ühes kohas.",
    titleA: "Kogu restorani rahaasjad.",
    titleB: "Ühes kohas.",
    body:
      "Kviitungid, kulud, müük, kassaaruanded ja raamatupidamine ilma liigse " +
      "käsitsitööta. Kate hoiab rahaasjad korras.",
    secondary: "Vaata, kuidas see töötab",
    previewNote: "Kate kasutajaliides. Numbrid on näited.",
  },
  preview: {
    today: "Tänane seis",
    synced: "Raamatupidamine sünkroonitud",
    ready: "Raamatupidamine valmis",
    sales: "Müük",
    expenses: "Kulud",
    result: "Tulem",
    receipts: "Kviitungid",
    vat: "Käibemaks",
    salesHint: "Kassaaruandest",
    expensesHint: "Kirjendatud kulud",
    resultHint: "Müük miinus kulud",
    receiptsHint: "Kõik töödeldud",
    vatHint: "Tasumisele kuuluv",
    ledgerRevenue: "Tulud raamatupidamises",
    ledgerExpenses: "Kulud raamatupidamises",
    salesWeek: "Müük · nädal",
    salesByGroup: "Müük gruppide kaupa",
    groupFood: "Restoranimüük",
    groupAlcohol: "Alkoholimüük",
    groupOther: "Muu müük",
    month: "August 2026",
    overview: "Kate · Ülevaade",
    railOverview: "Ülevaade",
    railSales: "Müük",
    railReceipts: "Kviitungid",
    railExpenses: "Kulud",
    railLedger: "Raamatupidamine",
    railShifts: "Vahetused",
  },
  todo: {
    cardTitle: "Mida tuleb teha",
    item1: "3 kviitungit pole raamatupidamises",
    item2: "Käibemaksu võrdlus vajab kontrolli",
    item3: "1 kande ettepanek ootab kinnitust",
    cardNote:
      "Kate arvutab need sinu andmetest iga laadimise ajal. Kui asi on " +
      "tehtud, kaob rida ise ära.",
    heading: "Kate ütleb, mis on järgmisena.",
    body:
      "Sa ei pea kõike ise meeles pidama. Puuduvad kviitungid, ülevaatamist " +
      "vajavad kanded ja klappimata käibemaks tõusevad esile siis, kui on aeg.",
  },
  benefits: {
    headingA: "Sina juhid restorani.",
    headingB: "Kate hoiab numbrid korras.",
    body:
      "Müük, kulud, kviitungid ja kassaaruanded jõuavad automaatselt samasse " +
      "kohta.",
    receiptsTitle: "Kviitungid",
    receiptsBody:
      "Pildista kviitung. Read, käibemaks ja kategooria loetakse sinu eest.",
    financeTitle: "Rahaasjad",
    financeBody:
      "Näed, mida restoran teenib ja kuhu raha läheb — päev ja kuu kaupa.",
    ledgerTitle: "Raamatupidamine",
    ledgerBody:
      "Kviitungid ja müügipäevad jõuavad raamatupidamisse kohe salvestamisel.",
  },
  flow: {
    heading: "Sisesta üks kord.",
    body: "Kate viib sama teabe automaatselt õigetesse kohtadesse.",
    step1: "Müük",
    step1Note: "Õhtu lõpeb",
    step2: "Kassaaruanne",
    step2Note: "Pildista või sisesta",
    step3: "Kate",
    step3Note: "Seob andmed",
    step4: "Raamatupidamine",
    step4Note: "Tekib iseenesest",
    step5: "Aruanded & käibemaks",
    step5Note: "Kasutusvalmis",
  },
  month: {
    heading: "Tead alati, kus parasjagu ollakse.",
    body: "Kuu müük, kulud, tulem ja käibemaks ühes vaates.",
  },
  features: {
    heading: "Kõik oluline ühes kohas.",
    receipts: "Kviitungid",
    receiptsBody: "Pildista, kontrolli ja korrasta.",
    expenses: "Kulud",
    expensesBody: "Jälgi, kuhu raha läheb.",
    sales: "Müük",
    salesBody: "Päev ja kuu kaupa.",
    till: "Kassaaruanded",
    tillBody: "Pildilt raamatupidamisse.",
    ledger: "Raamatupidamine",
    ledgerBody: "Kahekordne kirjendamine automaatselt.",
    vat: "Käibemaks & maksud",
    vatBody: "Numbrid valmis, juhised kaasas.",
    reports: "Aruanded",
    reportsBody: "Päevaraamat, pearaamat, kasumiaruanne ja bilanss.",
    staff: "Töötajad",
    staffBody: "Vahetused, tööaeg ja palgateatised.",
    taxNote:
      "Kate valmistab käibemaksunumbrid raamatupidamisest ja ütleb, mida sul " +
      "tuleb teha. Deklaratsiooni esitad ise maksuameti teenuses — Kate ei " +
      "saada seda sinu eest.",
    lunch: "Lõunamenüü",
    lunchBody: "Nädal korraga, uksele ja veebi.",
    reservations: "Lauabroneeringud",
    reservationsBody: "Broneerimisvorm oma lehele, saal telefonis.",
  },
  pricing: {
    heading: "Üks hind. Kõik sees.",
    body: "Kasutajapõhiseid tasusid ega lisamooduleid ei ole.",
    perMonth: "€ / kuus",
    yearly: "790 € / aastas · säästad 158 € aastas",
    incReceipts: "Kviitungid",
    incExpenses: "Kulud",
    incSales: "Müük & kassa",
    incLedger: "Raamatupidamine",
    incVat: "Käibemaks & maksud",
    incReports: "Aruanded",
    incStaff: "Töötajad",
    incAssistant: "Matti assistent",
    incLunch: "Lõunamenüü",
    incReservations: "Lauabroneeringud",
  },
  finalCta: {
    titleA: "Restorani rahaasjad.",
    titleB: "Lihtsamalt.",
    body: "Kõik oluline ühes kohas.",
    secondary: "Vaata, kuidas Kate töötab",
  },
  footer: {
    tagline: "Restorani rahaasjad ühes kohas.",
    sitemap: "Sisukaart",
  },
  about: {
    metaTitle: "Meist – Kate",
    metaDescription:
      "Kate on tehtud neile, kes peavad restorani iga päev. Üks koht kõige " +
      "olulisema jaoks.",
    label: "Meist",
    heading: "Ehitame restoranile paremat viisi igapäevatööks.",
    body:
      "Kate sündis mõttest, et restorani olulised asjad ei peaks olema laiali " +
      "eri süsteemides. Üks koht. Vähem nokitsemist. Rohkem aega tööle endale.",
    photoAlt: "Kate tiim",
    photoPending: "Tiimipilt tuleb siia.",
    captionA: "Väike tiim. Suur eesmärk.",
    captionB: "Ehitame Katet neile, kes peavad restorani iga päev.",
    teamHeading: "Inimesed Kate taga.",
    teamPending:
      "Tiimi tutvustused avaldatakse, kui pildid on valmis. Kohad on lehel juba " +
      "olemas, nii et paigutus ei muutu, kui andmed lisanduvad.",
    whyLabel: "Miks Kate?",
    whyHeading:
      "Restorani pidamine ei peaks tunduma kümne eri süsteemi haldamisena.",
    whyBody:
      "Müük, kviitungid, kulud, töötajad, vahetused, lõunamenüüd ja aruandlus " +
      "kuuluvad samasse päeva. Ometi hallatakse neid enamasti eri kohtades.",
    whyEmphasis: "Kate on selleks, et need kokku tuua.",
    beliefsLabel: "Mida usume",
    belief1Title: "Lihtsus",
    belief1Body:
      "Hea tarkvara peaks tööd lihtsamaks tegema, mitte keerulisemaks.",
    belief2Title: "Üks koht",
    belief2Body: "Restorani olulised andmed kuuluvad ühte süsteemi.",
    belief3Title: "Tegelik kasu",
    belief3Body:
      "Me ei ehita võimalusi nende endi pärast. Ehitame seda, mis säästab aega " +
      "ja raha.",
    ctaHeading: "Teeme restorani päeva veidi lihtsamaks.",
    ctaBody: "Vaata Katet ja näe, mida saad ühest kohast juhtida.",
    cta: "Tutvu Katega",
  },
};

// ---------------------------------------------------------------------------

const DICTIONARIES: Record<Locale, Dictionary> = { fi, en, sv, da, tr, et };

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
