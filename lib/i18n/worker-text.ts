import type { AppLocale } from "./app-locales";

/**
 * Työntekijänäkymän tekstit.
 *
 * TOINEN KÄÄNNETTY OSA SOVELLUSTA.
 *
 * Kirjautumisen jälkeen tämä on se näkymä jossa monikielisyydestä on
 * eniten hyötyä: keittiössä puhutaan montaa kieltä, ja työntekijä
 * käyttää sovellusta puhelimella joka vuorossa. Ravintoloitsijan
 * hallintanäkymä on vähiten kiireinen, koska hän on useimmiten
 * suomenkielinen.
 *
 * Sama kuvio kuin auth-text.ts:ssä: tyyppi johdetaan suomesta, ei
 * "as const", ei funktioita. Paikkamerkit ovat {aaltosulkeissa} ja
 * fill sijoittaa arvot.
 *
 * PALVELINVIESTIT OVAT ERIKSEEN.
 *
 * Leimauksen ja vuoron ottamisen virheet ovat worker-errors.ts:ssä.
 * Ne käytetään vain server actioneissa, eikä niitä tarvitse lähettää
 * selaimeen jokaisen sivun mukana.
 */

const fi = {
  yleinen: {
    today: "Tänään",
    thisWeek: "Tämä viikko",
    thisMonth: "Tämä kuukausi",
    showAll: "Näytä kaikki",
    running: "Käynnissä",
    notSet: "Ei asetettu",
    user: "Käyttäjä",
    employee: "Työntekijä",
    week: "Viikko {numero}",
    min8: "Vähintään 8 merkkiä.",
    saving: "Tallennetaan…",
    sending: "Lähetetään…",
    missingOut: "Uloskirjaus puuttuu",
  },
  omatHalytykset: {
    shiftChanged: "Työvuoro muuttui",
    shiftWasNow: "oli {ennenAlku}–{ennenLoppu}, nyt {alku}–{loppu}",
    clockLeftOpen: "Leimaus jäi auki",
    clockLeftOpenDays: "{maara} päivää jäi leimaamatta ulos",
    tellManager:
      "Kerro esihenkilölle, jotta tunnit korjataan — auki jäänyt leimaus ei laske työaikaa oikein.",
    absenceSent: "Poissaoloilmoitus lähetetty",
    absencesSent: "{maara} poissaoloilmoitusta lähetetty",
    absenceNoCancel:
      "Ilmoitus ei peru vuoroa — esihenkilö etsii tilalle tekijän.",
  },

  nav: {
    home: "Koti",
    shifts: "Vuorot",
    time: "Työaika",
    more: "Lisää",
    mainNav: "Päänavigaatio",
    workerView: "Työntekijänäkymä",
  },

  koti: {
    hello: "Hei",
    community: "Työyhteisö",
    colleagueOne: "työkaveri",
    colleagueMany: "työkaveria",
    recentStamps: "Viimeisimmät leimaukset",
    noStampsYet:
      "Työaikasi näkyvät täällä, kun olet tehnyt ensimmäisen leimauksen.",
    nextShiftEmpty: "Ei tulevia työvuoroja",
    nextShiftEmptyBody: "Sinulle ei ole vielä lisätty tulevia työvuoroja.",
    birthdayOne: "{nimi} täyttää tänään vuosia!",
    birthdayMany: "{nimet} ja {viimeinen} täyttävät tänään vuosia!",
  },

  kello: {
    label: "Työajan leimaus",
    working: "Työ käynnissä",
    onBreak: "Tauolla",
    noShift: "Ei työvuoroa",
    notAtWork: "Et ole töissä",
    noAccrualOnBreak: "Työaika ei kerry tauolla",
    startedAt: "Aloitettu {aika}",
    shiftLabel: "Työvuoro {vuoro}",
    start: "Aloita työvuoro",
    stop: "Lopeta työvuoro",
    startBreak: "Aloita tauko",
    endBreak: "Jatka työtä",
    recording: "Kirjataan…",
    opensAt: "Sisäänleimaus avautuu klo {aika}. Työvuoro {vuoro}.",
    nextShiftIs: "Sinulle ei ole työvuoroa juuri nyt. Seuraava vuoro: {vuoro}.",
    noShiftPlanned:
      "Sinulle ei ole suunniteltu työvuoroa. Esihenkilö lisää vuorot.",
    doneIn: "Työvuoro aloitettu",
    doneBreakStart: "Tauko alkoi",
    doneBreakEnd: "Takaisin töissä",
    doneOut: "Työvuoro päättyi",
    noteIn: "Hyvää työvuoroa!",
    noteBreakStart: "Työaika ei kerry tauon aikana.",
    noteBreakEnd: "Työaika kertyy taas.",
    todaysHours: "Tämän päivän työaika",
  },

  vuorot: {
    title: "Vuorot",
    subtitle: "Tulevat työvuorosi",
    changed: "Työvuoro muuttui",
    cancelled: "Työvuoro peruttu",
    emptyTitle: "Ei tulevia työvuoroja",
    emptyBody:
      "Sinulle ei ole vielä lisätty tulevia työvuoroja. Saat ilmoituksen kun esihenkilö merkitsee vuoron.",
    confirmed: "Vahvistettu",
    openShifts: "Avoimet vuorot",
    takeShift: "Ota vuoro",
    confirmTake: "Otatko vuoron {paiva} klo {ajat}? Se on sinun heti.",
    cancel: "Peruuta",
    takenNote:
      "Otettu vuoro on sinun heti. Jos et pääsekään, ilmoita poissaolo — älä jätä sitä esihenkilön huomattavaksi.",
  },

  poissaolo: {
    certificateSeen: "Todistus merkitty nähdyksi",
    certificateNotSeen: "Todistusta ei ole vielä merkitty nähdyksi",
    noExtra: "Ei lisätietoa",
    ends: "Päättyy",
    endHint: "Jätä päättymispäivä tyhjäksi jos olet poissa vain yhden päivän.",
    extraInfo: "Lisätieto",
    starts: "Alkaa",
    cancelReport: "Peru ilmoitus",
    sickNoteTitle: "Sairauslomatodistus",
    sickNoteBody:
      "toimitetaan esihenkilölle erikseen silloin kun se on olemassa — ilmoita poissaolosta jo nyt. Todistusta ei liitetä Kateen, vaan esihenkilö merkitsee tähän ilmoitukseen nähneensä sen.",
    kindSick: "Sairaus",
    kindOther: "Muu poissaolo",
    kindCannotAttend: "En pääse vuoroon",
  },

  tyoaika: {
    title: "Työaika",
    subtitle: "Leimauksesi ja tehdyt tunnit",
    open: "Avoin työaika",
    missingOutOneDay: "Yhdeltä päivältä puuttuu uloskirjaus",
    emptyTitle: "Ei vielä leimauksia",
    emptyBody:
      "Työaikasi näkyvät täällä, kun olet tehnyt ensimmäisen leimauksen Koti-sivulla.",
    noStamp: "Ei vielä leimausta",
    history: "Historia",
    startedAt: "aloitettu {aika}",
    missingOutMany: "{maara} päivältä puuttuu uloskirjaus",
    managerFixes: "Esihenkilö korjaa työajan — älä leimaa uudelleen.",
  },

  palkka: {
    me: "Minä",
    accrued: "Kertynyt tässä kuussa",
    days: "Päivät",
    basePay: "Peruspalkka",
    toCheck: "Tarkistettavaa",
    fromStamps: "Aika on leimauksistasi, ei suunnitellusta vuorosta.",
    empty: "Ei vielä työaikaa tässä kuussa.",
  },

  ilmoitukset: {
    title: "Ilmoitukset",
    emptyTitle: "Ei ilmoituksia",
    emptyBody:
      "Kun saat työvuoron hyväksyttäväksi tai vuoro muuttuu, näet sen täällä. Ilmoitukset katoavat itsestään kun asia on hoidettu.",
  },

  tyoyhteiso: {
    title: "Työyhteisö",
    emptyTitle: "Ei työkavereita",
    emptyBody: "Ravintolaan ei ole vielä lisätty muita työntekijöitä.",
    colleagues: "Työkaverit",
    birthdayToday: "syntymäpäivä tänään",
  },

  asetukset: {
    title: "Asetukset",
    ownInfo: "Omat tiedot",
    email: "Sähköposti",
    name: "Nimi",
    nameHint: "Nimi näkyy esihenkilölle työvuoroissa ja työaikakirjauksissa.",
    community: "Työyhteisö",
    password: "Salasana",
    other: "Muuta",
    notifications: "Ilmoitukset",
    birthday: "Syntymäpäivä",
    saveBirthday: "Tallenna syntymäpäivä",
    hourlyRate: "Tuntipalkka",
    saveName: "Tallenna nimi",
    changePassword: "Vaihda salasana",
    changing: "Vaihdetaan…",
    reportAbsence: "Ilmoita poissaolo",
    report: "Ilmoita",
    newPassword: "Uusi salasana",
    newPasswordAgain: "Uusi salasana uudelleen",
    birthdayNote:
      "Työkaverit näkevät päivän ja kuukauden. Vuotta ei tallenneta. Tyhjennä kenttä ja tallenna, jos et halua näkyä.",
  },

  lisaa: {
    title: "Lisää",
    account: "Tili",
    app: "Sovellus",
    adminView: "Hallintanäkymä",
    signOut: "Kirjaudu ulos",
    footer: "Kate · työntekijänäkymä",
  },

  tehtavat: {
    label: "Omat tehtävät",
    heading: "Sinun tehtäväsi",
    dayOne: "päivä",
    dayMany: "päivää",
    overdueToday: "Myöhässä tänään klo {aika}",
    overdueDays: "Myöhässä {maara} {yksikko}",
  },

  asemat: {
    waiter: "Tarjoilija",
    kitchen: "Keittiö",
    manager: "Vuoropäällikkö",
    cleaning: "Siivous",
  },
  roolit: {
    owner: "Omistaja",
    manager: "Esihenkilö",
    employee: "Työntekijä",
    accountant: "Kirjanpitäjä",
  },
  lisatiedot: {
    forInfo: "{maara} tiedoksi",
    needsAction: "{maara} vaatii toimenpiteen",
    noticesNote:
      "Ilmoitukset lasketaan omista vuoroistasi ja leimauksistasi joka kerta kun avaat sivun. Niitä ei tallenneta, joten hoidettu asia katoaa listalta itsestään.",
    birthdayNote:
      "Syntymäpäivän voi lisätä tai poistaa omista asetuksista. Vuotta ei kysytä eikä tallenneta.",
    payTitle: "Palkkani",
    payDisclaimer:
      "Laskettu leimauksistasi. Bruttosumma ilman ennakonpidätystä ja muita vähennyksiä — ei palkkalaskelma eikä palkkatodistus.",
    payIssuesNote:
      "Kerro esihenkilölle, niin hän korjaa ajan. Sinä et voi muuttaa omaa työaikaasi jälkikäteen.",
    settingsNote:
      "Sähköpostin ja tuntipalkan muuttaa esihenkilö. Tuntipalkka näkyy tässä vain sinulle.",
  },
};

/*
 * Ei "as const": rakenne lukitaan, arvot eivät. Ks. auth-text.ts.
 */
export type WorkerText = typeof fi;

const en: WorkerText = {
  yleinen: {
    today: "Today",
    thisWeek: "This week",
    thisMonth: "This month",
    showAll: "Show all",
    running: "Running",
    notSet: "Not set",
    user: "User",
    employee: "Employee",
    week: "Week {numero}",
    min8: "At least 8 characters.",
    saving: "Saving…",
    sending: "Sending…",
    missingOut: "Clock-out missing",
  },
  omatHalytykset: {
    shiftChanged: "The shift changed",
    shiftWasNow: "was {ennenAlku}–{ennenLoppu}, now {alku}–{loppu}",
    clockLeftOpen: "A clocking was left open",
    clockLeftOpenDays: "{maara} days were left without a clock-out",
    tellManager:
      "Tell your manager so the hours get corrected — a clocking left open does not count the time right.",
    absenceSent: "The absence report was sent",
    absencesSent: "{maara} absence reports sent",
    absenceNoCancel:
      "The report does not cancel the shift — the manager finds a replacement.",
  },
  nav: {
    home: "Home",
    shifts: "Shifts",
    time: "Hours",
    more: "More",
    mainNav: "Main navigation",
    workerView: "Employee view",
  },
  koti: {
    hello: "Hi",
    community: "Team",
    colleagueOne: "colleague",
    colleagueMany: "colleagues",
    recentStamps: "Latest clock-ins",
    noStampsYet:
      "Your hours will show up here once you have clocked in for the first time.",
    nextShiftEmpty: "No upcoming shifts",
    nextShiftEmptyBody: "No upcoming shifts have been added for you yet.",
    birthdayOne: "It is {nimi}'s birthday today!",
    birthdayMany: "It is {nimet} and {viimeinen}'s birthday today!",
  },
  kello: {
    label: "Time clock",
    working: "At work",
    onBreak: "On a break",
    noShift: "No shift",
    notAtWork: "Not at work",
    noAccrualOnBreak: "Hours do not accrue during a break",
    startedAt: "Started at {aika}",
    shiftLabel: "Shift {vuoro}",
    start: "Start shift",
    stop: "End shift",
    startBreak: "Start a break",
    endBreak: "Back to work",
    recording: "Recording…",
    opensAt: "Clock-in opens at {aika}. Shift {vuoro}.",
    nextShiftIs: "You have no shift right now. Next shift: {vuoro}.",
    noShiftPlanned:
      "No shift has been planned for you. Your manager adds the shifts.",
    doneIn: "Shift started",
    doneBreakStart: "Break started",
    doneBreakEnd: "Back at work",
    doneOut: "Shift ended",
    noteIn: "Have a good shift!",
    noteBreakStart: "Hours do not accrue during the break.",
    noteBreakEnd: "Hours are accruing again.",
    todaysHours: "Hours today",
  },
  vuorot: {
    title: "Shifts",
    subtitle: "Your upcoming shifts",
    changed: "Shift changed",
    cancelled: "Shift cancelled",
    emptyTitle: "No upcoming shifts",
    emptyBody:
      "No upcoming shifts have been added for you yet. You will get a notice when your manager assigns one.",
    confirmed: "Confirmed",
    openShifts: "Open shifts",
    takeShift: "Take the shift",
    confirmTake: "Take the shift on {paiva} at {ajat}? It is yours right away.",
    cancel: "Cancel",
    takenNote:
      "A shift you take is yours right away. If you cannot make it after all, report an absence — do not leave it for your manager to notice.",
  },
  poissaolo: {
    certificateSeen: "Certificate marked as seen",
    certificateNotSeen: "The certificate has not been marked as seen yet",
    noExtra: "No further details",
    ends: "Ends",
    endHint: "Leave the end date empty if you are away for a single day only.",
    extraInfo: "Details",
    starts: "Starts",
    cancelReport: "Withdraw the report",
    sickNoteTitle: "A sickness certificate",
    sickNoteBody:
      "is given to your manager separately once it exists — report the absence now anyway. The certificate is not attached in Kate; your manager marks on this report that they have seen it.",
    kindSick: "Illness",
    kindOther: "Other absence",
    kindCannotAttend: "Cannot make the shift",
  },
  tyoaika: {
    title: "Hours",
    subtitle: "Your clock-ins and hours worked",
    open: "Open shift",
    missingOutOneDay: "One day is missing a clock-out",
    emptyTitle: "No clock-ins yet",
    emptyBody:
      "Your hours will show up here once you have clocked in for the first time on the Home page.",
    noStamp: "No clock-in yet",
    history: "History",
    startedAt: "started {aika}",
    missingOutMany: "{maara} days are missing a clock-out",
    managerFixes: "Your manager will fix the hours — do not clock in again.",
  },
  palkka: {
    me: "Me",
    accrued: "Accrued this month",
    days: "Days",
    basePay: "Base pay",
    toCheck: "Needs checking",
    fromStamps:
      "The time comes from your clock-ins, not from the planned shift.",
    empty: "No hours this month yet.",
  },
  ilmoitukset: {
    title: "Notices",
    emptyTitle: "No notices",
    emptyBody:
      "When you get a shift to confirm or a shift changes, you will see it here. Notices disappear on their own once the matter is handled.",
  },
  tyoyhteiso: {
    title: "Team",
    emptyTitle: "No colleagues",
    emptyBody: "No other employees have been added to the restaurant yet.",
    colleagues: "Colleagues",
    birthdayToday: "birthday today",
  },
  asetukset: {
    title: "Settings",
    ownInfo: "Your details",
    email: "Email",
    name: "Name",
    nameHint: "Your name is shown to your manager in shifts and time records.",
    community: "Team",
    password: "Password",
    other: "Other",
    notifications: "Notices",
    birthday: "Birthday",
    saveBirthday: "Save birthday",
    hourlyRate: "Hourly rate",
    saveName: "Save name",
    changePassword: "Change password",
    changing: "Changing…",
    reportAbsence: "Report an absence",
    report: "Report",
    newPassword: "New password",
    newPasswordAgain: "New password again",
    birthdayNote:
      "Your colleagues see the day and the month. The year is not stored. Clear the field and save if you would rather not appear.",
  },
  lisaa: {
    title: "More",
    account: "Account",
    app: "App",
    adminView: "Manager view",
    signOut: "Sign out",
    footer: "Kate · employee view",
  },
  tehtavat: {
    label: "Your tasks",
    heading: "Your tasks",
    dayOne: "day",
    dayMany: "days",
    overdueToday: "Overdue today at {aika}",
    overdueDays: "Overdue by {maara} {yksikko}",
  },

  asemat: {
    waiter: "Server",
    kitchen: "Kitchen",
    manager: "Shift manager",
    cleaning: "Cleaning",
  },
  roolit: {
    owner: "Owner",
    manager: "Manager",
    employee: "Employee",
    accountant: "Accountant",
  },
  lisatiedot: {
    forInfo: "{maara} for information",
    needsAction: "{maara} needs action",
    noticesNote:
      "Notices are worked out from your own shifts and clock-ins every time you open the page. They are not stored, so a handled matter disappears from the list on its own.",
    birthdayNote:
      "You can add or remove your birthday in your own settings. The year is not asked for and not stored.",
    payTitle: "My pay",
    payDisclaimer:
      "Worked out from your clock-ins. A gross figure without withholding tax or other deductions — not a payslip and not a certificate of earnings.",
    payIssuesNote:
      "Tell your manager and they will fix the time. You cannot change your own hours afterwards.",
    settingsNote:
      "Your manager changes the email address and the hourly rate. The rate is shown here only to you.",
  },
};

const sv: WorkerText = {
  yleinen: {
    today: "I dag",
    thisWeek: "Denna vecka",
    thisMonth: "Denna månad",
    showAll: "Visa alla",
    running: "Pågår",
    notSet: "Inte angivet",
    user: "Användare",
    employee: "Anställd",
    week: "Vecka {numero}",
    min8: "Minst 8 tecken.",
    saving: "Sparar…",
    sending: "Skickar…",
    missingOut: "Utstämpling saknas",
  },
  omatHalytykset: {
    shiftChanged: "Passet ändrades",
    shiftWasNow: "var {ennenAlku}–{ennenLoppu}, nu {alku}–{loppu}",
    clockLeftOpen: "En stämpling lämnades öppen",
    clockLeftOpenDays: "{maara} dagar blev utan utstämpling",
    tellManager:
      "Berätta för chefen så att timmarna rättas — en öppen stämpling räknar inte tiden rätt.",
    absenceSent: "Frånvaroanmälan skickad",
    absencesSent: "{maara} frånvaroanmälningar skickade",
    absenceNoCancel:
      "Anmälan ställer inte in passet — chefen söker en ersättare.",
  },
  nav: {
    home: "Hem",
    shifts: "Pass",
    time: "Arbetstid",
    more: "Mer",
    mainNav: "Huvudnavigering",
    workerView: "Anställdvy",
  },
  koti: {
    hello: "Hej",
    community: "Arbetsgemenskap",
    colleagueOne: "kollega",
    colleagueMany: "kollegor",
    recentStamps: "Senaste stämplingar",
    noStampsYet:
      "Din arbetstid visas här när du har stämplat in första gången.",
    nextShiftEmpty: "Inga kommande pass",
    nextShiftEmptyBody: "Inga kommande pass har lagts till för dig än.",
    birthdayOne: "{nimi} fyller år i dag!",
    birthdayMany: "{nimet} och {viimeinen} fyller år i dag!",
  },
  kello: {
    label: "Tidsstämpling",
    working: "På jobbet",
    onBreak: "På rast",
    noShift: "Inget pass",
    notAtWork: "Inte på jobbet",
    noAccrualOnBreak: "Arbetstid räknas inte under rasten",
    startedAt: "Började {aika}",
    shiftLabel: "Pass {vuoro}",
    start: "Börja passet",
    stop: "Avsluta passet",
    startBreak: "Börja rast",
    endBreak: "Tillbaka till jobbet",
    recording: "Registrerar…",
    opensAt: "Instämpling öppnar kl. {aika}. Pass {vuoro}.",
    nextShiftIs: "Du har inget pass just nu. Nästa pass: {vuoro}.",
    noShiftPlanned:
      "Inget pass har planerats för dig. Din chef lägger till passen.",
    doneIn: "Passet har börjat",
    doneBreakStart: "Rasten började",
    doneBreakEnd: "Tillbaka på jobbet",
    doneOut: "Passet avslutades",
    noteIn: "Ha ett bra pass!",
    noteBreakStart: "Arbetstid räknas inte under rasten.",
    noteBreakEnd: "Arbetstiden räknas igen.",
    todaysHours: "Dagens arbetstid",
  },
  vuorot: {
    title: "Pass",
    subtitle: "Dina kommande pass",
    changed: "Passet ändrades",
    cancelled: "Passet inställt",
    emptyTitle: "Inga kommande pass",
    emptyBody:
      "Inga kommande pass har lagts till för dig än. Du får ett meddelande när din chef lägger in ett.",
    confirmed: "Bekräftat",
    openShifts: "Lediga pass",
    takeShift: "Ta passet",
    confirmTake: "Tar du passet {paiva} kl. {ajat}? Det är ditt direkt.",
    cancel: "Avbryt",
    takenNote:
      "Ett pass du tar är ditt direkt. Om du ändå inte kan, anmäl frånvaro — lämna det inte åt din chef att upptäcka.",
  },
  poissaolo: {
    certificateSeen: "Intyget är markerat som sett",
    certificateNotSeen: "Intyget är inte markerat som sett än",
    noExtra: "Ingen ytterligare information",
    ends: "Slutar",
    endHint: "Lämna slutdatumet tomt om du är borta bara en dag.",
    extraInfo: "Mer information",
    starts: "Börjar",
    cancelReport: "Ta tillbaka anmälan",
    sickNoteTitle: "Ett sjukintyg",
    sickNoteBody:
      "lämnas till din chef separat när det finns — anmäl frånvaron redan nu. Intyget bifogas inte i Kate, utan din chef markerar på den här anmälan att hen sett det.",
    kindSick: "Sjukdom",
    kindOther: "Annan frånvaro",
    kindCannotAttend: "Kan inte ta passet",
  },
  tyoaika: {
    title: "Arbetstid",
    subtitle: "Dina stämplingar och arbetade timmar",
    open: "Öppen arbetstid",
    missingOutOneDay: "En dag saknar utstämpling",
    emptyTitle: "Inga stämplingar än",
    emptyBody:
      "Din arbetstid visas här när du har stämplat in första gången på Hem-sidan.",
    noStamp: "Ingen stämpling än",
    history: "Historik",
    startedAt: "började {aika}",
    missingOutMany: "{maara} dagar saknar utstämpling",
    managerFixes: "Din chef rättar arbetstiden — stämpla inte igen.",
  },
  palkka: {
    me: "Jag",
    accrued: "Intjänat denna månad",
    days: "Dagar",
    basePay: "Grundlön",
    toCheck: "Att kontrollera",
    fromStamps:
      "Tiden kommer från dina stämplingar, inte från det planerade passet.",
    empty: "Ingen arbetstid denna månad än.",
  },
  ilmoitukset: {
    title: "Meddelanden",
    emptyTitle: "Inga meddelanden",
    emptyBody:
      "När du får ett pass att bekräfta eller ett pass ändras ser du det här. Meddelanden försvinner av sig själva när saken är avklarad.",
  },
  tyoyhteiso: {
    title: "Arbetsgemenskap",
    emptyTitle: "Inga kollegor",
    emptyBody: "Inga andra anställda har lagts till i restaurangen än.",
    colleagues: "Kollegor",
    birthdayToday: "födelsedag i dag",
  },
  asetukset: {
    title: "Inställningar",
    ownInfo: "Dina uppgifter",
    email: "E-post",
    name: "Namn",
    nameHint: "Ditt namn visas för din chef i pass och tidsregistreringar.",
    community: "Arbetsgemenskap",
    password: "Lösenord",
    other: "Övrigt",
    notifications: "Meddelanden",
    birthday: "Födelsedag",
    saveBirthday: "Spara födelsedag",
    hourlyRate: "Timlön",
    saveName: "Spara namn",
    changePassword: "Byt lösenord",
    changing: "Byter…",
    reportAbsence: "Anmäl frånvaro",
    report: "Anmäl",
    newPassword: "Nytt lösenord",
    newPasswordAgain: "Nytt lösenord igen",
    birthdayNote:
      "Dina kollegor ser dagen och månaden. Året sparas inte. Töm fältet och spara om du hellre inte vill synas.",
  },
  lisaa: {
    title: "Mer",
    account: "Konto",
    app: "App",
    adminView: "Chefsvy",
    signOut: "Logga ut",
    footer: "Kate · anställdvy",
  },
  tehtavat: {
    label: "Dina uppgifter",
    heading: "Dina uppgifter",
    dayOne: "dag",
    dayMany: "dagar",
    overdueToday: "Försenad i dag kl. {aika}",
    overdueDays: "Försenad {maara} {yksikko}",
  },

  asemat: {
    waiter: "Servitör",
    kitchen: "Kök",
    manager: "Skiftansvarig",
    cleaning: "Städning",
  },
  roolit: {
    owner: "Ägare",
    manager: "Chef",
    employee: "Anställd",
    accountant: "Bokförare",
  },
  lisatiedot: {
    forInfo: "{maara} till kännedom",
    needsAction: "{maara} kräver åtgärd",
    noticesNote:
      "Meddelandena räknas fram ur dina egna pass och stämplingar varje gång du öppnar sidan. De sparas inte, så en avklarad sak försvinner från listan av sig själv.",
    birthdayNote:
      "Du kan lägga till eller ta bort födelsedagen i dina egna inställningar. Året frågas inte och sparas inte.",
    payTitle: "Min lön",
    payDisclaimer:
      "Framräknat ur dina stämplingar. Bruttobelopp utan förskottsinnehållning och andra avdrag — inte en lönespecifikation och inte ett löneintyg.",
    payIssuesNote:
      "Säg till din chef så rättar hen tiden. Du kan inte ändra din egen arbetstid i efterhand.",
    settingsNote:
      "Din chef ändrar e-postadressen och timlönen. Timlönen visas här bara för dig.",
  },
};

const da: WorkerText = {
  yleinen: {
    today: "I dag",
    thisWeek: "Denne uge",
    thisMonth: "Denne måned",
    showAll: "Vis alle",
    running: "I gang",
    notSet: "Ikke angivet",
    user: "Bruger",
    employee: "Medarbejder",
    week: "Uge {numero}",
    min8: "Mindst 8 tegn.",
    saving: "Gemmer…",
    sending: "Sender…",
    missingOut: "Udstempling mangler",
  },
  omatHalytykset: {
    shiftChanged: "Vagten blev ændret",
    shiftWasNow: "var {ennenAlku}–{ennenLoppu}, nu {alku}–{loppu}",
    clockLeftOpen: "En stempling blev efterladt åben",
    clockLeftOpenDays: "{maara} dage blev uden udstempling",
    tellManager:
      "Fortæl det til lederen, så timerne rettes — en åben stempling tæller ikke tiden rigtigt.",
    absenceSent: "Fraværsmeldingen er sendt",
    absencesSent: "{maara} fraværsmeldinger sendt",
    absenceNoCancel:
      "Meldingen aflyser ikke vagten — lederen finder en afløser.",
  },
  nav: {
    home: "Hjem",
    shifts: "Vagter",
    time: "Arbejdstid",
    more: "Mere",
    mainNav: "Hovednavigation",
    workerView: "Medarbejdervisning",
  },
  koti: {
    hello: "Hej",
    community: "Arbejdsfællesskab",
    colleagueOne: "kollega",
    colleagueMany: "kolleger",
    recentStamps: "Seneste stemplinger",
    noStampsYet:
      "Din arbejdstid vises her, når du har stemplet ind første gang.",
    nextShiftEmpty: "Ingen kommende vagter",
    nextShiftEmptyBody: "Der er ikke lagt kommende vagter ind til dig endnu.",
    birthdayOne: "{nimi} har fødselsdag i dag!",
    birthdayMany: "{nimet} og {viimeinen} har fødselsdag i dag!",
  },
  kello: {
    label: "Tidsstempling",
    working: "På arbejde",
    onBreak: "På pause",
    noShift: "Ingen vagt",
    notAtWork: "Ikke på arbejde",
    noAccrualOnBreak: "Arbejdstid tælles ikke under pausen",
    startedAt: "Startet {aika}",
    shiftLabel: "Vagt {vuoro}",
    start: "Start vagten",
    stop: "Afslut vagten",
    startBreak: "Start pause",
    endBreak: "Tilbage på arbejde",
    recording: "Registrerer…",
    opensAt: "Indstempling åbner kl. {aika}. Vagt {vuoro}.",
    nextShiftIs: "Du har ingen vagt lige nu. Næste vagt: {vuoro}.",
    noShiftPlanned:
      "Der er ikke planlagt en vagt til dig. Din leder tilføjer vagterne.",
    doneIn: "Vagten er startet",
    doneBreakStart: "Pausen begyndte",
    doneBreakEnd: "Tilbage på arbejde",
    doneOut: "Vagten er afsluttet",
    noteIn: "God vagt!",
    noteBreakStart: "Arbejdstid tælles ikke under pausen.",
    noteBreakEnd: "Arbejdstiden tælles igen.",
    todaysHours: "Dagens arbejdstid",
  },
  vuorot: {
    title: "Vagter",
    subtitle: "Dine kommende vagter",
    changed: "Vagten blev ændret",
    cancelled: "Vagten er aflyst",
    emptyTitle: "Ingen kommende vagter",
    emptyBody:
      "Der er ikke lagt kommende vagter ind til dig endnu. Du får besked, når din leder tildeler en.",
    confirmed: "Bekræftet",
    openShifts: "Ledige vagter",
    takeShift: "Tag vagten",
    confirmTake:
      "Tager du vagten {paiva} kl. {ajat}? Den er din med det samme.",
    cancel: "Annullér",
    takenNote:
      "En vagt du tager, er din med det samme. Hvis du alligevel ikke kan, så meld fravær — lad ikke din leder opdage det selv.",
  },
  poissaolo: {
    certificateSeen: "Attesten er markeret som set",
    certificateNotSeen: "Attesten er ikke markeret som set endnu",
    noExtra: "Ingen yderligere oplysninger",
    ends: "Slutter",
    endHint: "Lad slutdatoen stå tom, hvis du kun er væk én dag.",
    extraInfo: "Flere oplysninger",
    starts: "Starter",
    cancelReport: "Træk meldingen tilbage",
    sickNoteTitle: "En lægeerklæring",
    sickNoteBody:
      "afleveres til din leder særskilt, når den findes — meld fraværet allerede nu. Erklæringen vedhæftes ikke i Kate; din leder markerer på denne melding, at vedkommende har set den.",
    kindSick: "Sygdom",
    kindOther: "Andet fravær",
    kindCannotAttend: "Kan ikke tage vagten",
  },
  tyoaika: {
    title: "Arbejdstid",
    subtitle: "Dine stemplinger og arbejdede timer",
    open: "Åben arbejdstid",
    missingOutOneDay: "Én dag mangler en udstempling",
    emptyTitle: "Ingen stemplinger endnu",
    emptyBody:
      "Din arbejdstid vises her, når du har stemplet ind første gang på Hjem-siden.",
    noStamp: "Ingen stempling endnu",
    history: "Historik",
    startedAt: "startet {aika}",
    missingOutMany: "{maara} dage mangler en udstempling",
    managerFixes: "Din leder retter arbejdstiden — stempl ikke igen.",
  },
  palkka: {
    me: "Mig",
    accrued: "Optjent denne måned",
    days: "Dage",
    basePay: "Grundløn",
    toCheck: "Skal tjekkes",
    fromStamps:
      "Tiden kommer fra dine stemplinger, ikke fra den planlagte vagt.",
    empty: "Ingen arbejdstid denne måned endnu.",
  },
  ilmoitukset: {
    title: "Beskeder",
    emptyTitle: "Ingen beskeder",
    emptyBody:
      "Når du får en vagt til godkendelse, eller en vagt ændres, ser du det her. Beskeder forsvinder af sig selv, når sagen er ordnet.",
  },
  tyoyhteiso: {
    title: "Arbejdsfællesskab",
    emptyTitle: "Ingen kolleger",
    emptyBody:
      "Der er ikke tilføjet andre medarbejdere til restauranten endnu.",
    colleagues: "Kolleger",
    birthdayToday: "fødselsdag i dag",
  },
  asetukset: {
    title: "Indstillinger",
    ownInfo: "Dine oplysninger",
    email: "E-mail",
    name: "Navn",
    nameHint: "Dit navn vises for din leder i vagter og tidsregistreringer.",
    community: "Arbejdsfællesskab",
    password: "Adgangskode",
    other: "Andet",
    notifications: "Beskeder",
    birthday: "Fødselsdag",
    saveBirthday: "Gem fødselsdag",
    hourlyRate: "Timeløn",
    saveName: "Gem navn",
    changePassword: "Skift adgangskode",
    changing: "Skifter…",
    reportAbsence: "Meld fravær",
    report: "Meld",
    newPassword: "Ny adgangskode",
    newPasswordAgain: "Ny adgangskode igen",
    birthdayNote:
      "Dine kolleger ser dagen og måneden. Året gemmes ikke. Ryd feltet og gem, hvis du helst ikke vil vises.",
  },
  lisaa: {
    title: "Mere",
    account: "Konto",
    app: "App",
    adminView: "Ledervisning",
    signOut: "Log ud",
    footer: "Kate · medarbejdervisning",
  },
  tehtavat: {
    label: "Dine opgaver",
    heading: "Dine opgaver",
    dayOne: "dag",
    dayMany: "dage",
    overdueToday: "Forsinket i dag kl. {aika}",
    overdueDays: "Forsinket {maara} {yksikko}",
  },

  asemat: {
    waiter: "Tjener",
    kitchen: "Køkken",
    manager: "Vagtansvarlig",
    cleaning: "Rengøring",
  },
  roolit: {
    owner: "Ejer",
    manager: "Leder",
    employee: "Medarbejder",
    accountant: "Bogholder",
  },
  lisatiedot: {
    forInfo: "{maara} til orientering",
    needsAction: "{maara} kræver handling",
    noticesNote:
      "Beskederne regnes ud fra dine egne vagter og stemplinger, hver gang du åbner siden. De gemmes ikke, så en ordnet sag forsvinder fra listen af sig selv.",
    birthdayNote:
      "Du kan tilføje eller fjerne fødselsdagen i dine egne indstillinger. Året spørges der ikke om, og det gemmes ikke.",
    payTitle: "Min løn",
    payDisclaimer:
      "Udregnet ud fra dine stemplinger. Bruttobeløb uden A-skat og andre fradrag — ikke en lønseddel og ikke en lønattest.",
    payIssuesNote:
      "Sig det til din leder, så retter vedkommende tiden. Du kan ikke ændre din egen arbejdstid bagefter.",
    settingsNote:
      "Din leder ændrer e-mailadressen og timelønnen. Timelønnen vises kun for dig her.",
  },
};

const tr: WorkerText = {
  yleinen: {
    today: "Bugün",
    thisWeek: "Bu hafta",
    thisMonth: "Bu ay",
    showAll: "Tümünü göster",
    running: "Devam ediyor",
    notSet: "Belirtilmemiş",
    user: "Kullanıcı",
    employee: "Çalışan",
    week: "{numero}. hafta",
    min8: "En az 8 karakter.",
    saving: "Kaydediliyor…",
    sending: "Gönderiliyor…",
    missingOut: "Çıkış kaydı eksik",
  },
  omatHalytykset: {
    shiftChanged: "Vardiya değişti",
    shiftWasNow: "{ennenAlku}–{ennenLoppu} idi, şimdi {alku}–{loppu}",
    clockLeftOpen: "Bir kayıt açık kaldı",
    clockLeftOpenDays: "{maara} gün çıkış kaydı olmadan kaldı",
    tellManager:
      "Saatlerin düzeltilmesi için yöneticine söyle — açık kalan kayıt süreyi doğru saymaz.",
    absenceSent: "Devamsızlık bildirimi gönderildi",
    absencesSent: "{maara} devamsızlık bildirimi gönderildi",
    absenceNoCancel:
      "Bildirim vardiyayı iptal etmez — yönetici yerine birini bulur.",
  },
  nav: {
    home: "Ana sayfa",
    shifts: "Vardiyalar",
    time: "Çalışma saati",
    more: "Daha fazla",
    mainNav: "Ana gezinme",
    workerView: "Çalışan görünümü",
  },
  koti: {
    hello: "Merhaba",
    community: "Ekip",
    colleagueOne: "iş arkadaşı",
    colleagueMany: "iş arkadaşı",
    recentStamps: "Son kayıtlar",
    noStampsYet:
      "İlk giriş kaydını yaptığında çalışma saatlerin burada görünür.",
    nextShiftEmpty: "Yaklaşan vardiya yok",
    nextShiftEmptyBody: "Sana henüz yaklaşan bir vardiya eklenmedi.",
    birthdayOne: "Bugün {nimi} doğum gününü kutluyor!",
    birthdayMany: "Bugün {nimet} ve {viimeinen} doğum günlerini kutluyor!",
  },
  kello: {
    label: "Mesai kaydı",
    working: "İş başında",
    onBreak: "Molada",
    noShift: "Vardiya yok",
    notAtWork: "İş başında değilsin",
    noAccrualOnBreak: "Molada çalışma saati işlemez",
    startedAt: "Başlangıç {aika}",
    shiftLabel: "Vardiya {vuoro}",
    start: "Vardiyayı başlat",
    stop: "Vardiyayı bitir",
    startBreak: "Mola ver",
    endBreak: "İşe dön",
    recording: "Kaydediliyor…",
    opensAt: "Giriş kaydı saat {aika} itibarıyla açılır. Vardiya {vuoro}.",
    nextShiftIs: "Şu anda vardiyan yok. Sonraki vardiya: {vuoro}.",
    noShiftPlanned: "Sana vardiya planlanmamış. Vardiyaları yöneticin ekler.",
    doneIn: "Vardiya başladı",
    doneBreakStart: "Mola başladı",
    doneBreakEnd: "İş başına dönüldü",
    doneOut: "Vardiya bitti",
    noteIn: "İyi vardiyalar!",
    noteBreakStart: "Mola sırasında çalışma saati işlemez.",
    noteBreakEnd: "Çalışma saati yeniden işliyor.",
    todaysHours: "Bugünkü çalışma saati",
  },
  vuorot: {
    title: "Vardiyalar",
    subtitle: "Yaklaşan vardiyaların",
    changed: "Vardiya değişti",
    cancelled: "Vardiya iptal edildi",
    emptyTitle: "Yaklaşan vardiya yok",
    emptyBody:
      "Sana henüz yaklaşan bir vardiya eklenmedi. Yöneticin bir vardiya verdiğinde haber alırsın.",
    confirmed: "Onaylandı",
    openShifts: "Açık vardiyalar",
    takeShift: "Vardiyayı al",
    confirmTake:
      "{paiva} saat {ajat} vardiyasını alıyor musun? Hemen senin olur.",
    cancel: "Vazgeç",
    takenNote:
      "Aldığın vardiya hemen senin olur. Yine de gelemeyecek olursan devamsızlık bildir — yöneticinin fark etmesini bekleme.",
  },
  poissaolo: {
    certificateSeen: "Belge görüldü olarak işaretlendi",
    certificateNotSeen: "Belge henüz görüldü olarak işaretlenmedi",
    noExtra: "Ek bilgi yok",
    ends: "Bitiş",
    endHint: "Yalnızca bir gün yoksan bitiş tarihini boş bırak.",
    extraInfo: "Ek bilgi",
    starts: "Başlangıç",
    cancelReport: "Bildirimi geri al",
    sickNoteTitle: "Sağlık raporu",
    sickNoteBody:
      "eline geçtiğinde yöneticine ayrıca verilir — devamsızlığı şimdiden bildir. Rapor Kate'e eklenmez; yöneticin bu bildirime raporu gördüğünü işaretler.",
    kindSick: "Hastalık",
    kindOther: "Diğer devamsızlık",
    kindCannotAttend: "Vardiyaya gelemiyorum",
  },
  tyoaika: {
    title: "Çalışma saati",
    subtitle: "Kayıtların ve çalıştığın saatler",
    open: "Açık mesai",
    missingOutOneDay: "Bir günün çıkış kaydı eksik",
    emptyTitle: "Henüz kayıt yok",
    emptyBody:
      "Ana sayfada ilk giriş kaydını yaptığında çalışma saatlerin burada görünür.",
    noStamp: "Henüz kayıt yok",
    history: "Geçmiş",
    startedAt: "başlangıç {aika}",
    missingOutMany: "{maara} günün çıkış kaydı eksik",
    managerFixes: "Çalışma saatini yöneticin düzeltir — tekrar kayıt yapma.",
  },
  palkka: {
    me: "Ben",
    accrued: "Bu ay biriken",
    days: "Günler",
    basePay: "Temel ücret",
    toCheck: "Kontrol edilecek",
    fromStamps: "Süre planlanan vardiyadan değil, kendi kayıtlarından gelir.",
    empty: "Bu ay henüz çalışma saati yok.",
  },
  ilmoitukset: {
    title: "Bildirimler",
    emptyTitle: "Bildirim yok",
    emptyBody:
      "Onaylaman gereken bir vardiya geldiğinde ya da vardiya değiştiğinde burada görürsün. Konu halledilince bildirimler kendiliğinden kaybolur.",
  },
  tyoyhteiso: {
    title: "Ekip",
    emptyTitle: "İş arkadaşı yok",
    emptyBody: "Restorana henüz başka çalışan eklenmedi.",
    colleagues: "İş arkadaşları",
    birthdayToday: "bugün doğum günü",
  },
  asetukset: {
    title: "Ayarlar",
    ownInfo: "Bilgilerin",
    email: "E-posta",
    name: "Ad",
    nameHint: "Adın vardiyalarda ve mesai kayıtlarında yöneticine görünür.",
    community: "Ekip",
    password: "Parola",
    other: "Diğer",
    notifications: "Bildirimler",
    birthday: "Doğum günü",
    saveBirthday: "Doğum gününü kaydet",
    hourlyRate: "Saat ücreti",
    saveName: "Adı kaydet",
    changePassword: "Parolayı değiştir",
    changing: "Değiştiriliyor…",
    reportAbsence: "Devamsızlık bildir",
    report: "Bildir",
    newPassword: "Yeni parola",
    newPasswordAgain: "Yeni parola tekrar",
    birthdayNote:
      "İş arkadaşların günü ve ayı görür. Yıl saklanmaz. Görünmek istemiyorsan alanı boşaltıp kaydet.",
  },
  lisaa: {
    title: "Daha fazla",
    account: "Hesap",
    app: "Uygulama",
    adminView: "Yönetici görünümü",
    signOut: "Çıkış yap",
    footer: "Kate · çalışan görünümü",
  },
  tehtavat: {
    label: "Görevlerin",
    heading: "Görevlerin",
    dayOne: "gün",
    dayMany: "gün",
    overdueToday: "Bugün saat {aika} itibarıyla gecikti",
    overdueDays: "{maara} {yksikko} gecikti",
  },

  asemat: {
    waiter: "Garson",
    kitchen: "Mutfak",
    manager: "Vardiya sorumlusu",
    cleaning: "Temizlik",
  },
  roolit: {
    owner: "Sahip",
    manager: "Yönetici",
    employee: "Çalışan",
    accountant: "Muhasebeci",
  },
  lisatiedot: {
    forInfo: "{maara} bilgi",
    needsAction: "{maara} işlem gerektiriyor",
    noticesNote:
      "Bildirimler sayfayı her açtığında kendi vardiyalarından ve kayıtlarından hesaplanır. Saklanmazlar, bu yüzden halledilen konu listeden kendiliğinden kaybolur.",
    birthdayNote:
      "Doğum gününü kendi ayarlarından ekleyebilir veya kaldırabilirsin. Yıl sorulmaz ve saklanmaz.",
    payTitle: "Ücretim",
    payDisclaimer:
      "Kayıtlarından hesaplandı. Stopaj ve diğer kesintiler hariç brüt tutar — bordro ya da ücret belgesi değildir.",
    payIssuesNote:
      "Yöneticine söyle, süreyi o düzeltir. Kendi çalışma saatini sonradan değiştiremezsin.",
    settingsNote:
      "E-posta adresini ve saat ücretini yöneticin değiştirir. Saat ücreti burada yalnızca sana görünür.",
  },
};

const et: WorkerText = {
  yleinen: {
    today: "Täna",
    thisWeek: "See nädal",
    thisMonth: "See kuu",
    showAll: "Näita kõiki",
    running: "Käib",
    notSet: "Määramata",
    user: "Kasutaja",
    employee: "Töötaja",
    week: "{numero}. nädal",
    min8: "Vähemalt 8 märki.",
    saving: "Salvestame…",
    sending: "Saadame…",
    missingOut: "Väljaregistreerimine puudub",
  },
  omatHalytykset: {
    shiftChanged: "Vahetus muutus",
    shiftWasNow: "oli {ennenAlku}–{ennenLoppu}, nüüd {alku}–{loppu}",
    clockLeftOpen: "Registreering jäi lahti",
    clockLeftOpenDays: "{maara} päeva jäi väljaregistreerimata",
    tellManager:
      "Räägi juhatajale, et tunnid parandataks — lahtijäänud registreering ei arvesta aega õigesti.",
    absenceSent: "Puudumisteade saadetud",
    absencesSent: "{maara} puudumisteadet saadetud",
    absenceNoCancel: "Teade ei tühista vahetust — juhataja otsib asendaja.",
  },
  nav: {
    home: "Avaleht",
    shifts: "Vahetused",
    time: "Tööaeg",
    more: "Rohkem",
    mainNav: "Peamenüü",
    workerView: "Töötaja vaade",
  },
  koti: {
    hello: "Tere",
    community: "Meeskond",
    colleagueOne: "kolleeg",
    colleagueMany: "kolleegi",
    recentStamps: "Viimased registreeringud",
    noStampsYet:
      "Sinu tööaeg ilmub siia, kui oled esimest korda sisse registreerinud.",
    nextShiftEmpty: "Tulevasi vahetusi pole",
    nextShiftEmptyBody: "Sulle pole veel tulevasi vahetusi lisatud.",
    birthdayOne: "{nimi} tähistab täna sünnipäeva!",
    birthdayMany: "{nimet} ja {viimeinen} tähistavad täna sünnipäeva!",
  },
  kello: {
    label: "Tööaja registreerimine",
    working: "Tööl",
    onBreak: "Pausil",
    noShift: "Vahetust pole",
    notAtWork: "Sa ei ole tööl",
    noAccrualOnBreak: "Pausi ajal tööaeg ei kogune",
    startedAt: "Alustatud {aika}",
    shiftLabel: "Vahetus {vuoro}",
    start: "Alusta vahetust",
    stop: "Lõpeta vahetus",
    startBreak: "Alusta pausi",
    endBreak: "Tagasi tööle",
    recording: "Registreerime…",
    opensAt: "Sisseregistreerimine avaneb kell {aika}. Vahetus {vuoro}.",
    nextShiftIs: "Sul ei ole praegu vahetust. Järgmine vahetus: {vuoro}.",
    noShiftPlanned:
      "Sulle ei ole vahetust planeeritud. Vahetused lisab juhataja.",
    doneIn: "Vahetus algas",
    doneBreakStart: "Paus algas",
    doneBreakEnd: "Tagasi tööl",
    doneOut: "Vahetus lõppes",
    noteIn: "Head vahetust!",
    noteBreakStart: "Pausi ajal tööaeg ei kogune.",
    noteBreakEnd: "Tööaeg koguneb taas.",
    todaysHours: "Tänane tööaeg",
  },
  vuorot: {
    title: "Vahetused",
    subtitle: "Sinu tulevased vahetused",
    changed: "Vahetus muutus",
    cancelled: "Vahetus tühistati",
    emptyTitle: "Tulevasi vahetusi pole",
    emptyBody:
      "Sulle pole veel tulevasi vahetusi lisatud. Saad teate, kui juhataja määrab vahetuse.",
    confirmed: "Kinnitatud",
    openShifts: "Vabad vahetused",
    takeShift: "Võta vahetus",
    confirmTake: "Kas võtad vahetuse {paiva} kell {ajat}? See on kohe sinu.",
    cancel: "Loobu",
    takenNote:
      "Võetud vahetus on kohe sinu. Kui sa siiski ei saa tulla, teata puudumisest — ära jäta seda juhataja märgata.",
  },
  poissaolo: {
    certificateSeen: "Tõend on märgitud nähtuks",
    certificateNotSeen: "Tõendit ei ole veel nähtuks märgitud",
    noExtra: "Lisainfot pole",
    ends: "Lõpeb",
    endHint: "Jäta lõppkuupäev tühjaks, kui oled ära ainult ühe päeva.",
    extraInfo: "Lisainfo",
    starts: "Algab",
    cancelReport: "Võta teade tagasi",
    sickNoteTitle: "Haigusleht",
    sickNoteBody:
      "antakse juhatajale eraldi siis, kui see olemas on — teata puudumisest juba praegu. Tõendit Kate'i ei lisata; juhataja märgib sellele teatele, et on seda näinud.",
    kindSick: "Haigus",
    kindOther: "Muu puudumine",
    kindCannotAttend: "Ei saa vahetusse tulla",
  },
  tyoaika: {
    title: "Tööaeg",
    subtitle: "Sinu registreeringud ja tehtud tunnid",
    open: "Avatud tööaeg",
    missingOutOneDay: "Ühel päeval puudub väljaregistreerimine",
    emptyTitle: "Registreeringuid veel pole",
    emptyBody:
      "Sinu tööaeg ilmub siia, kui oled avalehel esimest korda sisse registreerinud.",
    noStamp: "Registreeringut veel pole",
    history: "Ajalugu",
    startedAt: "alustatud {aika}",
    missingOutMany: "{maara} päeval puudub väljaregistreerimine",
    managerFixes: "Juhataja parandab tööaja — ära registreeri uuesti.",
  },
  palkka: {
    me: "Mina",
    accrued: "Sel kuul kogunenud",
    days: "Päevad",
    basePay: "Põhipalk",
    toCheck: "Vajab kontrolli",
    fromStamps:
      "Aeg tuleb sinu registreeringutest, mitte planeeritud vahetusest.",
    empty: "Sel kuul veel tööaega pole.",
  },
  ilmoitukset: {
    title: "Teated",
    emptyTitle: "Teateid pole",
    emptyBody:
      "Kui saad vahetuse kinnitamiseks või vahetus muutub, näed seda siin. Teated kaovad ise, kui asi on korras.",
  },
  tyoyhteiso: {
    title: "Meeskond",
    emptyTitle: "Kolleege pole",
    emptyBody: "Restorani ei ole veel teisi töötajaid lisatud.",
    colleagues: "Kolleegid",
    birthdayToday: "täna sünnipäev",
  },
  asetukset: {
    title: "Seaded",
    ownInfo: "Sinu andmed",
    email: "E-post",
    name: "Nimi",
    nameHint: "Sinu nimi on juhatajale näha vahetustes ja tööaja kirjetes.",
    community: "Meeskond",
    password: "Parool",
    other: "Muu",
    notifications: "Teated",
    birthday: "Sünnipäev",
    saveBirthday: "Salvesta sünnipäev",
    hourlyRate: "Tunnitasu",
    saveName: "Salvesta nimi",
    changePassword: "Muuda parooli",
    changing: "Muudame…",
    reportAbsence: "Teata puudumisest",
    report: "Teata",
    newPassword: "Uus parool",
    newPasswordAgain: "Uus parool uuesti",
    birthdayNote:
      "Kolleegid näevad päeva ja kuud. Aastat ei salvestata. Kui sa ei soovi näha olla, tühjenda väli ja salvesta.",
  },
  lisaa: {
    title: "Rohkem",
    account: "Konto",
    app: "Rakendus",
    adminView: "Juhataja vaade",
    signOut: "Logi välja",
    footer: "Kate · töötaja vaade",
  },
  tehtavat: {
    label: "Sinu ülesanded",
    heading: "Sinu ülesanded",
    dayOne: "päev",
    dayMany: "päeva",
    overdueToday: "Tähtaeg möödus täna kell {aika}",
    overdueDays: "Hilinenud {maara} {yksikko}",
  },

  asemat: {
    waiter: "Teenindaja",
    kitchen: "Köök",
    manager: "Vahetuse juht",
    cleaning: "Koristus",
  },
  roolit: {
    owner: "Omanik",
    manager: "Juhataja",
    employee: "Töötaja",
    accountant: "Raamatupidaja",
  },
  lisatiedot: {
    forInfo: "{maara} teadmiseks",
    needsAction: "{maara} vajab tegutsemist",
    noticesNote:
      "Teated arvutatakse sinu enda vahetustest ja registreeringutest iga kord, kui lehe avad. Neid ei salvestata, nii et korras asi kaob nimekirjast ise.",
    birthdayNote:
      "Sünnipäeva saad lisada või eemaldada oma seadetes. Aastat ei küsita ega salvestata.",
    payTitle: "Minu palk",
    payDisclaimer:
      "Arvutatud sinu registreeringutest. Brutosumma ilma tulumaksu ja muude mahaarvamisteta — see ei ole palgateatis ega palgatõend.",
    payIssuesNote:
      "Ütle juhatajale, tema parandab aja. Oma tööaega sa tagantjärele muuta ei saa.",
    settingsNote:
      "E-posti aadressi ja tunnitasu muudab juhataja. Tunnitasu näed siin ainult sina.",
  },
};

const KAIKKI: Record<AppLocale, WorkerText> = { fi, en, sv, da, tr, et };

/** Tekstit valitulla kielellä; tuntematon kieli saa suomen. */
export function workerText(locale: AppLocale): WorkerText {
  return KAIKKI[locale] ?? fi;
}
