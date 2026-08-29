import type { AppLocale } from "./app-locales";
import type {
  ExpenseCategory,
  PaymentMethod,
  ReviewReason,
} from "@/lib/restoflow/types";

/**
 * Jaetut nimikkeet ja kuukaudet.
 *
 * MIKSI OMA TIEDOSTO EIKÄ ADMIN-TEXT.
 *
 * Rooli, tehtävä, poissaolon laji ja vuoron tila esiintyvät kaikissa
 * kolmessa näkymässä: kirjautumisessa, työntekijän puolella ja
 * hallinnassa. Jos ne asuisivat yhdessä näkymän sanakirjassa, kaksi
 * muuta joutuisivat lainaamaan sitä — ja sama nimike päätyisi ennen
 * pitkää kolmeen paikkaan eri sanoilla.
 *
 * Kuukausien nimet tulevat Intl:stä eivätkä taulukosta. Kovakoodattu
 * lista olisi käännettävä kuudesti, ja se olisi väärässä sijamuodossa
 * heti kun lause vaatii muuta kuin nominatiivin.
 */

export interface Labels {
  roles: {
    owner: string;
    manager: string;
    employee: string;
    accountant: string;
  };
  positions: {
    waiter: string;
    kitchen: string;
    manager: string;
    cleaning: string;
  };
  absences: { sick: string; other: string; cannot_attend: string };
  absenceShort: { sick: string; other: string; cannot_attend: string };
  shiftStatus: {
    draft: string;
    pending: string;
    accepted: string;
    declined: string;
    changed: string;
  };
  categories: Record<ExpenseCategory, string>;
  payments: Record<PaymentMethod, string>;
  reviewReasons: Record<ReviewReason, string>;
}

const fi: Labels = {
  roles: {
    owner: "Omistaja",
    manager: "Esihenkilö",
    employee: "Työntekijä",
    accountant: "Kirjanpitäjä",
  },
  positions: {
    waiter: "Tarjoilija",
    kitchen: "Keittiö",
    manager: "Vuoropäällikkö",
    cleaning: "Siivous",
  },
  absences: {
    sick: "Sairaus",
    other: "Muu poissaolo",
    cannot_attend: "En pääse vuoroon",
  },
  absenceShort: { sick: "SL", other: "P", cannot_attend: "EP" },
  shiftStatus: {
    draft: "Luonnos",
    pending: "Odottaa vastausta",
    accepted: "Vahvistettu",
    declined: "Ei pääse",
    changed: "Muuttunut",
  },
  categories: {
    food: "Ruoka",
    alcohol: "Alkoholi",
    soft_drinks: "Alkoholittomat",
    cleaning: "Siivous",
    kitchen_supplies: "Keittiötarvikkeet",
    packaging: "Pakkausmateriaalit",
    staff: "Henkilöstö",
    transport: "Kuljetus",
    other: "Muut",
  },
  payments: {
    card: "Kortti",
    cash: "Käteinen",
    invoice: "Lasku",
    unknown: "Ei tiedossa",
  },
  reviewReasons: {
    vat_missing: "ALV puuttuu",
    vat_uncertain: "ALV epävarma",
    vat_mismatch: "ALV ei vastaa kategorian verokantaa",
    category_missing: "Kategoria puuttuu",
    total_uncertain: "Tunnistettu summa epävarma",
    supplier_uncertain: "Toimittaja epävarma",
    date_uncertain: "Päivämäärä epävarma",
    payment_missing: "Maksutapa puuttuu",
    duplicate_suspected: "Mahdollinen kaksoiskappale",
    poor_image: "Kuittikuva epäselvä",
    items_dont_sum: "Rivien summa ei täsmää loppusummaan",
  },
};
const en: Labels = {
  roles: {
    owner: "Owner",
    manager: "Manager",
    employee: "Employee",
    accountant: "Accountant",
  },
  positions: {
    waiter: "Waiter",
    kitchen: "Kitchen",
    manager: "Shift manager",
    cleaning: "Cleaning",
  },
  absences: {
    sick: "Sickness",
    other: "Other absence",
    cannot_attend: "Cannot make the shift",
  },
  absenceShort: { sick: "SL", other: "A", cannot_attend: "NO" },
  shiftStatus: {
    draft: "Draft",
    pending: "Awaiting an answer",
    accepted: "Confirmed",
    declined: "Cannot make it",
    changed: "Changed",
  },
  categories: {
    food: "Food",
    alcohol: "Alcohol",
    soft_drinks: "Soft drinks",
    cleaning: "Cleaning",
    kitchen_supplies: "Kitchen supplies",
    packaging: "Packaging",
    staff: "Staff",
    transport: "Transport",
    other: "Other",
  },
  payments: {
    card: "Card",
    cash: "Cash",
    invoice: "Invoice",
    unknown: "Not known",
  },
  reviewReasons: {
    vat_missing: "VAT is missing",
    vat_uncertain: "VAT is uncertain",
    vat_mismatch: "VAT does not match the category's rate",
    category_missing: "Category is missing",
    total_uncertain: "The recognised total is uncertain",
    supplier_uncertain: "Supplier is uncertain",
    date_uncertain: "Date is uncertain",
    payment_missing: "Payment method is missing",
    duplicate_suspected: "Possible duplicate",
    poor_image: "The receipt image is unclear",
    items_dont_sum: "The line items do not add up to the total",
  },
};
const sv: Labels = {
  roles: {
    owner: "Ägare",
    manager: "Chef",
    employee: "Anställd",
    accountant: "Bokförare",
  },
  positions: {
    waiter: "Servitör",
    kitchen: "Kök",
    manager: "Skiftchef",
    cleaning: "Städning",
  },
  absences: {
    sick: "Sjukdom",
    other: "Annan frånvaro",
    cannot_attend: "Kan inte ta passet",
  },
  absenceShort: { sick: "SJ", other: "F", cannot_attend: "EJ" },
  shiftStatus: {
    draft: "Utkast",
    pending: "Väntar på svar",
    accepted: "Bekräftat",
    declined: "Kan inte",
    changed: "Ändrat",
  },
  categories: {
    food: "Mat",
    alcohol: "Alkohol",
    soft_drinks: "Alkoholfritt",
    cleaning: "Städning",
    kitchen_supplies: "Köksartiklar",
    packaging: "Förpackningsmaterial",
    staff: "Personal",
    transport: "Transport",
    other: "Övrigt",
  },
  payments: {
    card: "Kort",
    cash: "Kontant",
    invoice: "Faktura",
    unknown: "Okänt",
  },
  reviewReasons: {
    vat_missing: "Moms saknas",
    vat_uncertain: "Momsen är osäker",
    vat_mismatch: "Momsen stämmer inte med kategorins skattesats",
    category_missing: "Kategori saknas",
    total_uncertain: "Den avlästa summan är osäker",
    supplier_uncertain: "Leverantören är osäker",
    date_uncertain: "Datumet är osäkert",
    payment_missing: "Betalsätt saknas",
    duplicate_suspected: "Möjlig dubblett",
    poor_image: "Kvittobilden är otydlig",
    items_dont_sum: "Radernas summa stämmer inte med slutsumman",
  },
};
const da: Labels = {
  roles: {
    owner: "Ejer",
    manager: "Leder",
    employee: "Medarbejder",
    accountant: "Bogholder",
  },
  positions: {
    waiter: "Tjener",
    kitchen: "Køkken",
    manager: "Vagtleder",
    cleaning: "Rengøring",
  },
  absences: {
    sick: "Sygdom",
    other: "Andet fravær",
    cannot_attend: "Kan ikke tage vagten",
  },
  absenceShort: { sick: "SY", other: "F", cannot_attend: "KI" },
  shiftStatus: {
    draft: "Kladde",
    pending: "Afventer svar",
    accepted: "Bekræftet",
    declined: "Kan ikke",
    changed: "Ændret",
  },
  categories: {
    food: "Mad",
    alcohol: "Alkohol",
    soft_drinks: "Alkoholfrit",
    cleaning: "Rengøring",
    kitchen_supplies: "Køkkenartikler",
    packaging: "Emballage",
    staff: "Personale",
    transport: "Transport",
    other: "Andet",
  },
  payments: {
    card: "Kort",
    cash: "Kontant",
    invoice: "Faktura",
    unknown: "Ukendt",
  },
  reviewReasons: {
    vat_missing: "Moms mangler",
    vat_uncertain: "Momsen er usikker",
    vat_mismatch: "Momsen passer ikke med kategoriens sats",
    category_missing: "Kategori mangler",
    total_uncertain: "Den aflæste sum er usikker",
    supplier_uncertain: "Leverandøren er usikker",
    date_uncertain: "Datoen er usikker",
    payment_missing: "Betalingsmåde mangler",
    duplicate_suspected: "Mulig dublet",
    poor_image: "Kvitteringsbilledet er utydeligt",
    items_dont_sum: "Linjernes sum passer ikke med slutsummen",
  },
};
const tr: Labels = {
  roles: {
    owner: "Sahip",
    manager: "Yönetici",
    employee: "Çalışan",
    accountant: "Muhasebeci",
  },
  positions: {
    waiter: "Garson",
    kitchen: "Mutfak",
    manager: "Vardiya amiri",
    cleaning: "Temizlik",
  },
  absences: {
    sick: "Hastalık",
    other: "Diğer devamsızlık",
    cannot_attend: "Vardiyaya gelemiyorum",
  },
  absenceShort: { sick: "HS", other: "D", cannot_attend: "GE" },
  shiftStatus: {
    draft: "Taslak",
    pending: "Yanıt bekliyor",
    accepted: "Onaylandı",
    declined: "Gelemiyor",
    changed: "Değişti",
  },
  categories: {
    food: "Yiyecek",
    alcohol: "Alkol",
    soft_drinks: "Alkolsüz",
    cleaning: "Temizlik",
    kitchen_supplies: "Mutfak malzemeleri",
    packaging: "Ambalaj",
    staff: "Personel",
    transport: "Nakliye",
    other: "Diğer",
  },
  payments: {
    card: "Kart",
    cash: "Nakit",
    invoice: "Fatura",
    unknown: "Bilinmiyor",
  },
  reviewReasons: {
    vat_missing: "KDV eksik",
    vat_uncertain: "KDV belirsiz",
    vat_mismatch: "KDV, kategorinin oranıyla uyuşmuyor",
    category_missing: "Kategori eksik",
    total_uncertain: "Okunan tutar belirsiz",
    supplier_uncertain: "Tedarikçi belirsiz",
    date_uncertain: "Tarih belirsiz",
    payment_missing: "Ödeme yöntemi eksik",
    duplicate_suspected: "Olası kopya",
    poor_image: "Fiş görseli belirsiz",
    items_dont_sum: "Satırların toplamı genel toplamla uyuşmuyor",
  },
};
const et: Labels = {
  roles: {
    owner: "Omanik",
    manager: "Juhataja",
    employee: "Töötaja",
    accountant: "Raamatupidaja",
  },
  positions: {
    waiter: "Ettekandja",
    kitchen: "Köök",
    manager: "Vahetuse juht",
    cleaning: "Koristus",
  },
  absences: {
    sick: "Haigus",
    other: "Muu puudumine",
    cannot_attend: "Ei saa vahetusse",
  },
  absenceShort: { sick: "HG", other: "P", cannot_attend: "EI" },
  shiftStatus: {
    draft: "Mustand",
    pending: "Ootab vastust",
    accepted: "Kinnitatud",
    declined: "Ei saa",
    changed: "Muutunud",
  },
  categories: {
    food: "Toit",
    alcohol: "Alkohol",
    soft_drinks: "Alkoholivaba",
    cleaning: "Koristus",
    kitchen_supplies: "Köögitarvikud",
    packaging: "Pakkematerjalid",
    staff: "Personal",
    transport: "Transport",
    other: "Muu",
  },
  payments: {
    card: "Kaart",
    cash: "Sularaha",
    invoice: "Arve",
    unknown: "Teadmata",
  },
  reviewReasons: {
    vat_missing: "Käibemaks puudub",
    vat_uncertain: "Käibemaks on ebakindel",
    vat_mismatch: "Käibemaks ei vasta kategooria määrale",
    category_missing: "Kategooria puudub",
    total_uncertain: "Tuvastatud summa on ebakindel",
    supplier_uncertain: "Tarnija on ebakindel",
    date_uncertain: "Kuupäev on ebakindel",
    payment_missing: "Makseviis puudub",
    duplicate_suspected: "Võimalik duplikaat",
    poor_image: "Tšeki pilt on ebaselge",
    items_dont_sum: "Ridade summa ei klapi lõppsummaga",
  },
};
const KAIKKI: Record<AppLocale, Labels> = { fi, en, sv, da, tr, et };

export function labels(locale: AppLocale): Labels {
  return KAIKKI[locale] ?? fi;
}

// ---------------------------------------------------------------------------
// Kuukaudet
// ---------------------------------------------------------------------------

/**
 * Kuittien ja vuorojen lukumäärä lauseena.
 *
 * "1 kuittia" on kielioppivirhe joka pistää silmään heti, ja moni
 * kieli erottaa yksikön ja monikon eri tavalla kuin suomi — siksi
 * lause tulee taulukosta eikä liimauksesta.
 */
const MAARAT: Record<
  AppLocale,
  { kuitti: [string, string]; vuoro: [string, string] }
> = {
  fi: { kuitti: ["1 kuitti", "{n} kuittia"], vuoro: ["1 vuoro", "{n} vuoroa"] },
  en: {
    kuitti: ["1 receipt", "{n} receipts"],
    vuoro: ["1 shift", "{n} shifts"],
  },
  sv: { kuitti: ["1 kvitto", "{n} kvitton"], vuoro: ["1 pass", "{n} pass"] },
  da: {
    kuitti: ["1 kvittering", "{n} kvitteringer"],
    vuoro: ["1 vagt", "{n} vagter"],
  },
  tr: { kuitti: ["1 fiş", "{n} fiş"], vuoro: ["1 vardiya", "{n} vardiya"] },
  et: {
    kuitti: ["1 tšekk", "{n} tšekki"],
    vuoro: ["1 vahetus", "{n} vahetust"],
  },
};

export function receiptCountIn(count: number, locale: AppLocale): string {
  const [yksi, moni] = (MAARAT[locale] ?? MAARAT.fi).kuitti;
  return count === 1 ? yksi : moni.replace("{n}", String(count));
}

export function shiftCountIn(count: number, locale: AppLocale): string {
  const [yksi, moni] = (MAARAT[locale] ?? MAARAT.fi).vuoro;
  return count === 1 ? yksi : moni.replace("{n}", String(count));
}

/** "tammikuu" — kuukauden nimi pienellä, vertailulauseita varten. */
export function monthWordIn(month: string, locale: AppLocale): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, m - 1, 1)))
    .toLowerCase();
}

/**
 * "Tammikuu 2026".
 *
 * Iso alkukirjain on tyylivalinta eikä kielioppia: suomessa kuukausi
 * kirjoitetaan pienellä, mutta otsikkona se on aina ollut isolla ja
 * kielen vaihtuminen ei ole syy muuttaa ulkoasua.
 */
export function formatMonthIn(month: string, locale: AppLocale): string {
  const [year] = month.split("-").map(Number);
  const sana = monthWordIn(month, locale);
  return `${sana.charAt(0).toUpperCase()}${sana.slice(1)} ${year}`;
}

/** "Tammikuu" — vuosi jää pois kun se on jo otsikossa. */
export function formatMonthShortIn(month: string, locale: AppLocale): string {
  const sana = monthWordIn(month, locale);
  return `${sana.charAt(0).toUpperCase()}${sana.slice(1)}`;
}

// ---------------------------------------------------------------------------
// Viikonpäivät ja päivämäärät
// ---------------------------------------------------------------------------

/** UTC-keskipäivä: aikavyöhyke ei saa siirtää päivää edelliseksi. */
function paivaks(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/** "Keskiviikko" — viikonpäivä kokonaan, iso alkukirjain. */
export function weekdayLongIn(isoDate: string, locale: AppLocale): string {
  const sana = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(paivaks(isoDate));
  return `${sana.charAt(0).toUpperCase()}${sana.slice(1)}`;
}

/** "ke" — lyhenne listan tunnisteeksi, pienellä. */
export function weekdayShortIn(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    .format(paivaks(isoDate))
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Viikonpäivä numerosta, 1 = maanantai.
 *
 * Vuorolistan otsikkorivi tuntee vain päivän numeron, ei päivämäärää.
 * Numero muunnetaan tunnetuksi viikoksi jotta Intl saa oikean päivän:
 * 2024-01-01 oli maanantai.
 */
export function weekdayByNumberIn(weekday: number, locale: AppLocale): string {
  return weekdayShortIn(`2024-01-0${weekday}`, locale);
}

/** "24.8.2026" kielen omalla numeromuodolla. */
export function formatDayIn(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(paivaks(isoDate));
}

/** "24.8." — vuosi jää pois kun se on rivin muusta sisällöstä selvä. */
export function formatDayShortIn(isoDate: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  }).format(paivaks(isoDate));
}
