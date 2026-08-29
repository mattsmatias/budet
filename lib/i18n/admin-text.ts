import type { AppLocale } from "./app-locales";

/**
 * Hallintanäkymän tekstit.
 *
 * KOLMAS JA SUURIN OSA.
 *
 * Kirjautuminen ja työntekijänäkymä on käännetty; tämä on loput.
 * Hallintanäkymässä on noin 730 merkkijonoa 84 tiedostossa, joten se
 * käännetään osissa ja jokainen osa viedään loppuun asti ennen
 * seuraavaa — puolittain käännetty näkymä on huonompi kuin
 * kääntämätön, koska kieli vaihtuu kesken sivun.
 *
 * Sama kuvio kuin muissa sanakirjoissa: tyyppi johdetaan suomesta, ei
 * "as const", ei funktioita, paikkamerkit {aaltosulkeissa}.
 *
 * NAVIGAATION OTSIKOT OVAT TÄÄLLÄ, EIVÄT PERMISSIONS.TS:SSÄ.
 *
 * Sivulista kertoo mitä sivuja on, kenelle ja missä järjestyksessä.
 * Se on käyttöoikeusasia. Otsikko on käännettävää tekstiä, joten se
 * kuuluu tänne, ja avain sitoo ne yhteen niin että puuttuva käännös
 * kaatuu tyypintarkistuksessa.
 */

const fi = {
  nav: {
    // Osastot
    sectionMain: "Päävalikko",
    sectionFinance: "Talous",
    sectionStaff: "Henkilöstö",
    sectionOther: "Muut",

    // Sivut
    overview: "Yleiskatsaus",
    tasks: "Tehtävät",
    sales: "Myynti",
    receipts: "Kuitit",
    expenses: "Kulut",
    budgets: "Budjetit",
    suppliers: "Toimittajat",
    accounting: "Kirjanpito",
    shifts: "Työvuorot",
    staff: "Työntekijät",
    payroll: "Palkat",
    lunch: "Lounas",
    reports: "Raportointi",
    more: "Lisää",
  },

  kuori: {
    addReceipt: "Lisää kuitti",
    searchPlaceholder: "Etsi kuitteja, toimittajia, työntekijöitä…",
    searchHint: "Kirjoita nimi tai sivun nimi.",
    noUrgent: "Ei kiireellisiä",
    noObservations:
      "Ei huomioita juuri nyt. Ne ilmestyvät tänne itsestään kun aineistossa on jotain kerrottavaa.",
    workerView: "Työntekijänäkymä",
    settings: "Asetukset",
    signOut: "Kirjaudu ulos",
    user: "Käyttäjä",
    employee: "Työntekijä",
    admin: "Hallinta",
    groupPage: "Sivu",
    groupSupplier: "Toimittaja",
    groupPerson: "Henkilö",
  },
};

/*
 * Ei "as const": rakenne lukitaan, arvot eivät. Ks. auth-text.ts.
 */
export type AdminText = typeof fi;

const en: AdminText = {
  nav: {
    sectionMain: "Main",
    sectionFinance: "Finance",
    sectionStaff: "People",
    sectionOther: "Other",
    overview: "Overview",
    tasks: "Tasks",
    sales: "Sales",
    receipts: "Receipts",
    expenses: "Expenses",
    budgets: "Budgets",
    suppliers: "Suppliers",
    accounting: "Bookkeeping",
    shifts: "Shifts",
    staff: "Employees",
    payroll: "Payroll",
    lunch: "Lunch",
    reports: "Reporting",
    more: "More",
  },
  kuori: {
    addReceipt: "Add a receipt",
    searchPlaceholder: "Search receipts, suppliers, employees…",
    searchHint: "Type a name or the name of a page.",
    noUrgent: "Nothing urgent",
    noObservations:
      "Nothing to note right now. Observations appear here on their own when there is something to say about the data.",
    workerView: "Employee view",
    settings: "Settings",
    signOut: "Sign out",
    user: "User",
    employee: "Employee",
    admin: "Management",
    groupPage: "Page",
    groupSupplier: "Supplier",
    groupPerson: "Person",
  },
};

const sv: AdminText = {
  nav: {
    sectionMain: "Huvudmeny",
    sectionFinance: "Ekonomi",
    sectionStaff: "Personal",
    sectionOther: "Övrigt",
    overview: "Översikt",
    tasks: "Uppgifter",
    sales: "Försäljning",
    receipts: "Kvitton",
    expenses: "Kostnader",
    budgets: "Budgetar",
    suppliers: "Leverantörer",
    accounting: "Bokföring",
    shifts: "Arbetspass",
    staff: "Anställda",
    payroll: "Löner",
    lunch: "Lunch",
    reports: "Rapportering",
    more: "Mer",
  },
  kuori: {
    addReceipt: "Lägg till kvitto",
    searchPlaceholder: "Sök kvitton, leverantörer, anställda…",
    searchHint: "Skriv ett namn eller namnet på en sida.",
    noUrgent: "Inget brådskande",
    noObservations:
      "Inget att notera just nu. Observationerna dyker upp här av sig själva när det finns något att säga om underlaget.",
    workerView: "Anställdvy",
    settings: "Inställningar",
    signOut: "Logga ut",
    user: "Användare",
    employee: "Anställd",
    admin: "Administration",
    groupPage: "Sida",
    groupSupplier: "Leverantör",
    groupPerson: "Person",
  },
};

const da: AdminText = {
  nav: {
    sectionMain: "Hovedmenu",
    sectionFinance: "Økonomi",
    sectionStaff: "Personale",
    sectionOther: "Andet",
    overview: "Overblik",
    tasks: "Opgaver",
    sales: "Salg",
    receipts: "Kvitteringer",
    expenses: "Udgifter",
    budgets: "Budgetter",
    suppliers: "Leverandører",
    accounting: "Bogføring",
    shifts: "Vagter",
    staff: "Medarbejdere",
    payroll: "Løn",
    lunch: "Frokost",
    reports: "Rapportering",
    more: "Mere",
  },
  kuori: {
    addReceipt: "Tilføj kvittering",
    searchPlaceholder: "Søg kvitteringer, leverandører, medarbejdere…",
    searchHint: "Skriv et navn eller navnet på en side.",
    noUrgent: "Intet hastende",
    noObservations:
      "Intet at bemærke lige nu. Observationerne dukker op her af sig selv, når der er noget at sige om materialet.",
    workerView: "Medarbejdervisning",
    settings: "Indstillinger",
    signOut: "Log ud",
    user: "Bruger",
    employee: "Medarbejder",
    admin: "Administration",
    groupPage: "Side",
    groupSupplier: "Leverandør",
    groupPerson: "Person",
  },
};

const tr: AdminText = {
  nav: {
    sectionMain: "Ana menü",
    sectionFinance: "Finans",
    sectionStaff: "Personel",
    sectionOther: "Diğer",
    overview: "Genel bakış",
    tasks: "Görevler",
    sales: "Satış",
    receipts: "Fişler",
    expenses: "Giderler",
    budgets: "Bütçeler",
    suppliers: "Tedarikçiler",
    accounting: "Muhasebe",
    shifts: "Vardiyalar",
    staff: "Çalışanlar",
    payroll: "Ücretler",
    lunch: "Öğle yemeği",
    reports: "Raporlama",
    more: "Daha fazla",
  },
  kuori: {
    addReceipt: "Fiş ekle",
    searchPlaceholder: "Fiş, tedarikçi, çalışan ara…",
    searchHint: "Bir ad ya da sayfa adı yaz.",
    noUrgent: "Acil bir şey yok",
    noObservations:
      "Şu anda not edilecek bir şey yok. Verilerde söylenecek bir şey olduğunda gözlemler buraya kendiliğinden gelir.",
    workerView: "Çalışan görünümü",
    settings: "Ayarlar",
    signOut: "Çıkış yap",
    user: "Kullanıcı",
    employee: "Çalışan",
    admin: "Yönetim",
    groupPage: "Sayfa",
    groupSupplier: "Tedarikçi",
    groupPerson: "Kişi",
  },
};

const et: AdminText = {
  nav: {
    sectionMain: "Peamenüü",
    sectionFinance: "Rahandus",
    sectionStaff: "Personal",
    sectionOther: "Muu",
    overview: "Ülevaade",
    tasks: "Ülesanded",
    sales: "Müük",
    receipts: "Tšekid",
    expenses: "Kulud",
    budgets: "Eelarved",
    suppliers: "Tarnijad",
    accounting: "Raamatupidamine",
    shifts: "Vahetused",
    staff: "Töötajad",
    payroll: "Palgad",
    lunch: "Lõuna",
    reports: "Aruandlus",
    more: "Rohkem",
  },
  kuori: {
    addReceipt: "Lisa tšekk",
    searchPlaceholder: "Otsi tšekke, tarnijaid, töötajaid…",
    searchHint: "Kirjuta nimi või lehe nimi.",
    noUrgent: "Kiireloomulist pole",
    noObservations:
      "Praegu pole midagi märkida. Tähelepanekud ilmuvad siia ise, kui andmetes on midagi öelda.",
    workerView: "Töötaja vaade",
    settings: "Seaded",
    signOut: "Logi välja",
    user: "Kasutaja",
    employee: "Töötaja",
    admin: "Haldus",
    groupPage: "Leht",
    groupSupplier: "Tarnija",
    groupPerson: "Isik",
  },
};

const KAIKKI: Record<AppLocale, AdminText> = { fi, en, sv, da, tr, et };

/** Tekstit valitulla kielellä; tuntematon kieli saa suomen. */
export function adminText(locale: AppLocale): AdminText {
  return KAIKKI[locale] ?? fi;
}

/** Navigaation avaimet, jotta permissions.ts voi tyypittää ne. */
export type NavKey = keyof AdminText["nav"];
