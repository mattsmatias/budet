import type { AppLocale } from "./app-locales";
import type {
  ExpenseCategory,
  PaymentMethod,
  ReviewReason,
} from "@/lib/restoflow/types";
import type {
  LedgerAccountType,
  LedgerSource,
  LedgerStatus,
  MonthStatus,
  SourceState,
} from "@/lib/restoflow/accounting";
import type {
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  TaskVisibility,
} from "@/lib/restoflow/tasks";

/**
 * Jaetut nimikkeet ja kuukaudet.
 *
 * MIKSI OMA TIEDOSTO EIKÄ ADMIN-TEXT.
 *
 * Rooli, kuitin tila ja lokin nimikkeet esiintyvät sekä kirjautumisessa
 * että hallinnassa. Jos ne asuisivat yhden näkymän sanakirjassa, toinen
 * joutuisi lainaamaan sitä — ja sama nimike päätyisi ennen pitkää
 * kahteen paikkaan eri sanoilla.
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
  categories: Record<ExpenseCategory, string>;
  /**
   * Yrityksen toimialan kategoriat valikoihin, esitysjärjestyksessä.
   * Asetetaan withBusiness-apurilla; ilman sitä valikko näyttää kaikki.
   */
  categoryChoices?: ExpenseCategory[];
  payments: Record<PaymentMethod, string>;
  reviewReasons: Record<ReviewReason, string>;
  accountType: Record<LedgerAccountType, string>;
  ledgerSource: Record<LedgerSource, string>;
  ledgerStatus: Record<LedgerStatus, string>;
  monthStatus: Record<MonthStatus, string>;
  sourceState: Record<SourceState, string>;
  auditAction: Record<string, string>;
  auditEntity: Record<string, string>;
  taskPriority: Record<TaskPriority, string>;
  taskVisibility: Record<TaskVisibility, string>;
  taskRecurrence: Record<TaskRecurrence, string>;
  taskStatus: Record<TaskStatus, string>;
  budgetStatus: Record<string, string>;
}

const fi: Labels = {
  roles: {
    owner: "Omistaja",
    manager: "Esihenkilö",
    employee: "Työntekijä",
    accountant: "Kirjanpitäjä",
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
    products: "Hoitotuotteet",
    equipment: "Laitteet ja välineet",
    rent: "Toimitilat",
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
  accountType: {
    revenue: "Tuotot",
    expense: "Kulut",
    asset: "Vastaavaa",
    liability: "Vastattavaa",
    equity: "Oma pääoma",
  },
  ledgerSource: {
    receipt: "Kuitti",
    daily_sales: "Kassaraportti",
    manual: "Käsin",
    correction: "Korjaus",
  },
  ledgerStatus: {
    proposed: "Kirjausesitys",
    posted: "Kirjattu",
    rejected: "Hylätty",
  },
  monthStatus: {
    open: "🔓 Avoin",
    review: "Vaatii tarkistusta",
    ready: "Valmis",
    locked: "🔒 Lukittu",
  },
  sourceState: {
    unprocessed: "Ei kirjanpidossa",
    proposed: "Odottaa tarkistusta",
    posted: "Kirjattu kirjanpitoon",
    rejected: "Ei kirjata",
  },
  auditAction: {
    created: "Lisäsi",
    updated: "Muutti",
    deleted: "Poisti",
    published: "Julkaisi",
    cancelled: "Perui",
    completed: "Merkitsi tehdyksi",
  },
  auditEntity: {
    member: "Työntekijät",
    shift: "Työvuorot",
    receipt: "Kuitit",
    task: "Tehtävät",
    budget: "Budjetit",
    sales_group: "Verotus",
    time_correction: "Työajanseuranta",
    folder: "Kansiot",
    file: "Tiedostot",
  },
  taskPriority: {
    normal: "Normaali",
    important: "Tärkeä",
    critical: "Kriittinen",
  },
  taskVisibility: {
    owner_only: "Vain omistaja",
    managers: "Esihenkilöt",
    assigned_user: "Vain vastuuhenkilö",
    all_staff: "Koko henkilöstö",
  },
  taskRecurrence: {
    none: "Ei toistu",
    daily: "Päivittäin",
    weekly: "Viikoittain",
    monthly: "Kuukausittain",
    yearly: "Vuosittain",
  },
  taskStatus: {
    upcoming: "Tulossa",
    due_today: "Erääntyy tänään",
    overdue: "Myöhässä",
    completed: "Tehty",
    cancelled: "Peruttu",
  },
  budgetStatus: {
    ok: "OK",
    warning: "Lähestyy rajaa",
    exceeded: "Ylitetty",
    none: "Ei budjettia",
  },
};
const en: Labels = {
  roles: {
    owner: "Owner",
    manager: "Manager",
    employee: "Employee",
    accountant: "Accountant",
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
    products: "Care products",
    equipment: "Equipment",
    rent: "Premises & rent",
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
  accountType: {
    revenue: "Revenue",
    expense: "Expenses",
    asset: "Assets",
    liability: "Liabilities",
    equity: "Equity",
  },
  ledgerSource: {
    receipt: "Receipt",
    daily_sales: "Register report",
    manual: "By hand",
    correction: "Correction",
  },
  ledgerStatus: {
    proposed: "Proposed entry",
    posted: "Posted",
    rejected: "Rejected",
  },
  monthStatus: {
    open: "🔓 Open",
    review: "Needs checking",
    ready: "Ready",
    locked: "🔒 Locked",
  },
  sourceState: {
    unprocessed: "Not in the ledger",
    proposed: "Awaiting checking",
    posted: "Posted to the ledger",
    rejected: "Not posted",
  },
  auditAction: {
    created: "Added",
    updated: "Changed",
    deleted: "Deleted",
    published: "Published",
    cancelled: "Cancelled",
    completed: "Marked as done",
  },
  auditEntity: {
    member: "Employees",
    shift: "Shifts",
    receipt: "Receipts",
    task: "Tasks",
    budget: "Budgets",
    sales_group: "Taxation",
    time_correction: "Time tracking",
    folder: "Folders",
    file: "Files",
  },
  taskPriority: {
    normal: "Normal",
    important: "Important",
    critical: "Critical",
  },
  taskVisibility: {
    owner_only: "The owner only",
    managers: "Managers",
    assigned_user: "The assignee only",
    all_staff: "All staff",
  },
  taskRecurrence: {
    none: "Does not repeat",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  },
  taskStatus: {
    upcoming: "Upcoming",
    due_today: "Due today",
    overdue: "Overdue",
    completed: "Done",
    cancelled: "Cancelled",
  },
  budgetStatus: {
    ok: "OK",
    warning: "Approaching the limit",
    exceeded: "Exceeded",
    none: "No budget",
  },
};
const sv: Labels = {
  roles: {
    owner: "Ägare",
    manager: "Chef",
    employee: "Anställd",
    accountant: "Bokförare",
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
    products: "Vårdprodukter",
    equipment: "Utrustning",
    rent: "Lokaler",
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
  accountType: {
    revenue: "Intäkter",
    expense: "Kostnader",
    asset: "Tillgångar",
    liability: "Skulder",
    equity: "Eget kapital",
  },
  ledgerSource: {
    receipt: "Kvitto",
    daily_sales: "Kassarapport",
    manual: "För hand",
    correction: "Korrigering",
  },
  ledgerStatus: {
    proposed: "Bokföringsförslag",
    posted: "Bokförd",
    rejected: "Avvisad",
  },
  monthStatus: {
    open: "🔓 Öppen",
    review: "Kräver kontroll",
    ready: "Klar",
    locked: "🔒 Låst",
  },
  sourceState: {
    unprocessed: "Inte i bokföringen",
    proposed: "Väntar på kontroll",
    posted: "Bokförd",
    rejected: "Bokförs inte",
  },
  auditAction: {
    created: "Lade till",
    updated: "Ändrade",
    deleted: "Tog bort",
    published: "Publicerade",
    cancelled: "Ställde in",
    completed: "Markerade som klar",
  },
  auditEntity: {
    member: "Anställda",
    shift: "Arbetspass",
    receipt: "Kvitton",
    task: "Uppgifter",
    budget: "Budgetar",
    sales_group: "Beskattning",
    time_correction: "Tidsuppföljning",
    folder: "Mappar",
    file: "Filer",
  },
  taskPriority: {
    normal: "Normal",
    important: "Viktig",
    critical: "Kritisk",
  },
  taskVisibility: {
    owner_only: "Endast ägaren",
    managers: "Chefer",
    assigned_user: "Endast ansvarig",
    all_staff: "Hela personalen",
  },
  taskRecurrence: {
    none: "Upprepas inte",
    daily: "Dagligen",
    weekly: "Veckovis",
    monthly: "Månadsvis",
    yearly: "Årsvis",
  },
  taskStatus: {
    upcoming: "Kommande",
    due_today: "Förfaller i dag",
    overdue: "Försenad",
    completed: "Klar",
    cancelled: "Inställd",
  },
  budgetStatus: {
    ok: "OK",
    warning: "Närmar sig gränsen",
    exceeded: "Överskriden",
    none: "Ingen budget",
  },
};
const da: Labels = {
  roles: {
    owner: "Ejer",
    manager: "Leder",
    employee: "Medarbejder",
    accountant: "Bogholder",
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
    products: "Plejeprodukter",
    equipment: "Udstyr",
    rent: "Lokaler",
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
  accountType: {
    revenue: "Indtægter",
    expense: "Udgifter",
    asset: "Aktiver",
    liability: "Passiver",
    equity: "Egenkapital",
  },
  ledgerSource: {
    receipt: "Kvittering",
    daily_sales: "Kasserapport",
    manual: "Manuelt",
    correction: "Rettelse",
  },
  ledgerStatus: {
    proposed: "Bogføringsforslag",
    posted: "Bogført",
    rejected: "Afvist",
  },
  monthStatus: {
    open: "🔓 Åben",
    review: "Kræver kontrol",
    ready: "Klar",
    locked: "🔒 Låst",
  },
  sourceState: {
    unprocessed: "Ikke i bogføringen",
    proposed: "Afventer kontrol",
    posted: "Bogført",
    rejected: "Bogføres ikke",
  },
  auditAction: {
    created: "Tilføjede",
    updated: "Ændrede",
    deleted: "Slettede",
    published: "Udgav",
    cancelled: "Aflyste",
    completed: "Markerede som færdig",
  },
  auditEntity: {
    member: "Medarbejdere",
    shift: "Vagter",
    receipt: "Kvitteringer",
    task: "Opgaver",
    budget: "Budgetter",
    sales_group: "Beskatning",
    time_correction: "Tidsregistrering",
    folder: "Mapper",
    file: "Filer",
  },
  taskPriority: {
    normal: "Normal",
    important: "Vigtig",
    critical: "Kritisk",
  },
  taskVisibility: {
    owner_only: "Kun ejeren",
    managers: "Ledere",
    assigned_user: "Kun den ansvarlige",
    all_staff: "Hele personalet",
  },
  taskRecurrence: {
    none: "Gentages ikke",
    daily: "Dagligt",
    weekly: "Ugentligt",
    monthly: "Månedligt",
    yearly: "Årligt",
  },
  taskStatus: {
    upcoming: "Kommende",
    due_today: "Forfalder i dag",
    overdue: "Forsinket",
    completed: "Færdig",
    cancelled: "Aflyst",
  },
  budgetStatus: {
    ok: "OK",
    warning: "Nærmer sig grænsen",
    exceeded: "Overskredet",
    none: "Intet budget",
  },
};
const tr: Labels = {
  roles: {
    owner: "Sahip",
    manager: "Yönetici",
    employee: "Çalışan",
    accountant: "Muhasebeci",
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
    products: "Bakım ürünleri",
    equipment: "Ekipman",
    rent: "Kira ve işyeri",
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
  accountType: {
    revenue: "Gelirler",
    expense: "Giderler",
    asset: "Varlıklar",
    liability: "Yükümlülükler",
    equity: "Özkaynak",
  },
  ledgerSource: {
    receipt: "Fiş",
    daily_sales: "Kasa raporu",
    manual: "Elle",
    correction: "Düzeltme",
  },
  ledgerStatus: {
    proposed: "Kayıt önerisi",
    posted: "Kaydedildi",
    rejected: "Reddedildi",
  },
  monthStatus: {
    open: "🔓 Açık",
    review: "Kontrol gerekiyor",
    ready: "Hazır",
    locked: "🔒 Kilitli",
  },
  sourceState: {
    unprocessed: "Muhasebede değil",
    proposed: "Kontrol bekliyor",
    posted: "Muhasebeye kaydedildi",
    rejected: "Kaydedilmiyor",
  },
  auditAction: {
    created: "Ekledi",
    updated: "Değiştirdi",
    deleted: "Sildi",
    published: "Yayınladı",
    cancelled: "İptal etti",
    completed: "Tamamlandı olarak işaretledi",
  },
  auditEntity: {
    member: "Çalışanlar",
    shift: "Vardiyalar",
    receipt: "Fişler",
    task: "Görevler",
    budget: "Bütçeler",
    sales_group: "Vergilendirme",
    time_correction: "Zaman takibi",
    folder: "Klasörler",
    file: "Dosyalar",
  },
  taskPriority: {
    normal: "Normal",
    important: "Önemli",
    critical: "Kritik",
  },
  taskVisibility: {
    owner_only: "Yalnızca sahip",
    managers: "Yöneticiler",
    assigned_user: "Yalnızca sorumlu",
    all_staff: "Tüm personel",
  },
  taskRecurrence: {
    none: "Tekrarlanmaz",
    daily: "Günlük",
    weekly: "Haftalık",
    monthly: "Aylık",
    yearly: "Yıllık",
  },
  taskStatus: {
    upcoming: "Yaklaşan",
    due_today: "Bugün bitiyor",
    overdue: "Gecikmiş",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
  },
  budgetStatus: {
    ok: "Tamam",
    warning: "Sınıra yaklaşıyor",
    exceeded: "Aşıldı",
    none: "Bütçe yok",
  },
};
const et: Labels = {
  roles: {
    owner: "Omanik",
    manager: "Juhataja",
    employee: "Töötaja",
    accountant: "Raamatupidaja",
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
    products: "Hooldustooted",
    equipment: "Seadmed",
    rent: "Ruumid ja üür",
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
  accountType: {
    revenue: "Tulud",
    expense: "Kulud",
    asset: "Aktiva",
    liability: "Passiva",
    equity: "Omakapital",
  },
  ledgerSource: {
    receipt: "Tšekk",
    daily_sales: "Kassaaruanne",
    manual: "Käsitsi",
    correction: "Parandus",
  },
  ledgerStatus: {
    proposed: "Kandeettepanek",
    posted: "Kantud",
    rejected: "Tagasi lükatud",
  },
  monthStatus: {
    open: "🔓 Avatud",
    review: "Vajab kontrollimist",
    ready: "Valmis",
    locked: "🔒 Lukustatud",
  },
  sourceState: {
    unprocessed: "Raamatupidamises ei ole",
    proposed: "Ootab kontrollimist",
    posted: "Kantud raamatupidamisse",
    rejected: "Ei kanta",
  },
  auditAction: {
    created: "Lisas",
    updated: "Muutis",
    deleted: "Kustutas",
    published: "Avaldas",
    cancelled: "Tühistas",
    completed: "Märkis tehtuks",
  },
  auditEntity: {
    member: "Töötajad",
    shift: "Töövahetused",
    receipt: "Tšekid",
    task: "Ülesanded",
    budget: "Eelarved",
    sales_group: "Maksustamine",
    time_correction: "Tööaja jälgimine",
    folder: "Kaustad",
    file: "Failid",
  },
  taskPriority: {
    normal: "Tavaline",
    important: "Tähtis",
    critical: "Kriitiline",
  },
  taskVisibility: {
    owner_only: "Ainult omanik",
    managers: "Juhatajad",
    assigned_user: "Ainult vastutaja",
    all_staff: "Kogu personal",
  },
  taskRecurrence: {
    none: "Ei kordu",
    daily: "Iga päev",
    weekly: "Iga nädal",
    monthly: "Iga kuu",
    yearly: "Iga aasta",
  },
  taskStatus: {
    upcoming: "Tulemas",
    due_today: "Tähtaeg täna",
    overdue: "Hilinenud",
    completed: "Tehtud",
    cancelled: "Tühistatud",
  },
  budgetStatus: {
    ok: "OK",
    warning: "Läheneb piirile",
    exceeded: "Ületatud",
    none: "Eelarvet ei ole",
  },
};
const ar: Labels = {
  roles: {
    owner: "المالك",
    manager: "المدير",
    employee: "الموظف",
    accountant: "المحاسب",
  },
  categories: {
    food: "طعام",
    alcohol: "كحول",
    soft_drinks: "مشروبات غازية",
    cleaning: "تنظيف",
    kitchen_supplies: "مستلزمات المطبخ",
    packaging: "تغليف",
    staff: "الموظفون",
    transport: "نقل",
    products: "منتجات العناية",
    equipment: "معدات",
    rent: "المبنى والإيجار",
    other: "أخرى",
  },
  payments: {
    card: "بطاقة",
    cash: "نقدًا",
    invoice: "فاتورة",
    unknown: "غير معروف",
  },
  reviewReasons: {
    vat_missing: "ضريبة القيمة المضافة مفقودة",
    vat_uncertain: "ضريبة القيمة المضافة غير مؤكدة",
    vat_mismatch: "ضريبة القيمة المضافة لا تطابق نسبة الفئة",
    category_missing: "الفئة مفقودة",
    total_uncertain: "الإجمالي المكتشف غير مؤكد",
    supplier_uncertain: "المورّد غير مؤكد",
    date_uncertain: "التاريخ غير مؤكد",
    payment_missing: "طريقة الدفع مفقودة",
    duplicate_suspected: "احتمال تكرار",
    poor_image: "صورة الإيصال غير واضحة",
    items_dont_sum: "مجموع البنود لا يساوي الإجمالي",
  },
  accountType: {
    revenue: "الإيرادات",
    expense: "المصروفات",
    asset: "الأصول",
    liability: "الخصوم",
    equity: "حقوق الملكية",
  },
  ledgerSource: {
    receipt: "إيصال",
    daily_sales: "تقرير الصندوق",
    manual: "يدويًا",
    correction: "تصحيح",
  },
  ledgerStatus: {
    proposed: "قيد مقترح",
    posted: "مُرحّل",
    rejected: "مرفوض",
  },
  monthStatus: {
    open: "🔓 مفتوح",
    review: "يحتاج مراجعة",
    ready: "جاهز",
    locked: "🔒 مقفل",
  },
  sourceState: {
    unprocessed: "ليس في دفتر الأستاذ",
    proposed: "بانتظار المراجعة",
    posted: "مُرحّل إلى دفتر الأستاذ",
    rejected: "غير مُرحّل",
  },
  auditAction: {
    created: "أُضيف",
    updated: "تم التغيير",
    deleted: "حُذف",
    published: "نُشر",
    cancelled: "أُلغي",
    completed: "تم وضع علامة كمكتمل",
  },
  auditEntity: {
    member: "الموظفون",
    shift: "المناوبات",
    receipt: "الإيصالات",
    task: "المهام",
    budget: "الميزانيات",
    sales_group: "الضرائب",
    time_correction: "تتبع الوقت",
    folder: "المجلدات",
    file: "الملفات",
  },
  taskPriority: {
    normal: "عادية",
    important: "مهمة",
    critical: "حرجة",
  },
  taskVisibility: {
    owner_only: "المالك فقط",
    managers: "المديرون",
    assigned_user: "المكلّف فقط",
    all_staff: "جميع الموظفين",
  },
  taskRecurrence: {
    none: "لا يتكرر",
    daily: "يوميًا",
    weekly: "أسبوعيًا",
    monthly: "شهريًا",
    yearly: "سنويًا",
  },
  taskStatus: {
    upcoming: "قادمة",
    due_today: "مستحقة اليوم",
    overdue: "متأخرة",
    completed: "مكتملة",
    cancelled: "ملغاة",
  },
  budgetStatus: {
    ok: "جيد",
    warning: "يقترب من الحد",
    exceeded: "تجاوز الحد",
    none: "لا توجد ميزانية",
  },
};

const KAIKKI: Record<AppLocale, Labels> = { fi, en, sv, da, tr, et, ar };

export function labels(locale: AppLocale): Labels {
  return KAIKKI[locale] ?? fi;
}

// ---------------------------------------------------------------------------
// Kuukaudet
// ---------------------------------------------------------------------------

/**
 * Lukumäärä lauseena.
 *
 * "1 kuittia" on kielioppivirhe joka pistää silmään heti, ja moni
 * kieli erottaa yksikön ja monikon eri tavalla kuin suomi — siksi
 * lause tulee taulukosta eikä liimauksesta.
 */
const MAARAT: Record<
  AppLocale,
  {
    kuitti: [string, string];
    osuma: [string, string];
    myyntipaiva: [string, string];
    esitys: [string, string];
    paiva: [string, string];
  }
> = {
  fi: {
    kuitti: ["1 kuitti", "{n} kuittia"],
    osuma: ["1 osuma", "{n} osumaa"],
    myyntipaiva: ["1 myyntipäivä", "{n} myyntipäivää"],
    esitys: ["1 esitys", "{n} esitystä"],
    paiva: ["1 päivä", "{n} päivää"],
  },
  en: {
    kuitti: ["1 receipt", "{n} receipts"],
    osuma: ["1 match", "{n} matches"],
    myyntipaiva: ["1 sales day", "{n} sales days"],
    esitys: ["1 proposal", "{n} proposals"],
    paiva: ["1 day", "{n} days"],
  },
  sv: {
    kuitti: ["1 kvitto", "{n} kvitton"],
    osuma: ["1 träff", "{n} träffar"],
    myyntipaiva: ["1 försäljningsdag", "{n} försäljningsdagar"],
    esitys: ["1 förslag", "{n} förslag"],
    paiva: ["1 dag", "{n} dagar"],
  },
  da: {
    kuitti: ["1 kvittering", "{n} kvitteringer"],
    osuma: ["1 match", "{n} match"],
    myyntipaiva: ["1 salgsdag", "{n} salgsdage"],
    esitys: ["1 forslag", "{n} forslag"],
    paiva: ["1 dag", "{n} dage"],
  },
  tr: {
    kuitti: ["1 fiş", "{n} fiş"],
    osuma: ["1 eşleşme", "{n} eşleşme"],
    myyntipaiva: ["1 satış günü", "{n} satış günü"],
    esitys: ["1 öneri", "{n} öneri"],
    paiva: ["1 gün", "{n} gün"],
  },
  et: {
    kuitti: ["1 tšekk", "{n} tšekki"],
    osuma: ["1 vaste", "{n} vastet"],
    myyntipaiva: ["1 müügipäev", "{n} müügipäeva"],
    esitys: ["1 ettepanek", "{n} ettepanekut"],
    paiva: ["1 päev", "{n} päeva"],
  },
  ar: {
    kuitti: ["1 إيصال", "{n} إيصالات"],
    osuma: ["1 مطابقة", "{n} مطابقات"],
    myyntipaiva: ["1 يوم مبيعات", "{n} أيام مبيعات"],
    esitys: ["1 اقتراح", "{n} اقتراحات"],
    paiva: ["1 يوم", "{n} أيام"],
  },
};

function maara(
  count: number,
  locale: AppLocale,
  avain: keyof (typeof MAARAT)["fi"],
): string {
  const [yksi, moni] = (MAARAT[locale] ?? MAARAT.fi)[avain];
  return count === 1 ? yksi : moni.replace("{n}", String(count));
}

export function receiptCountIn(count: number, locale: AppLocale): string {
  return maara(count, locale, "kuitti");
}

export function hitCountIn(count: number, locale: AppLocale): string {
  return maara(count, locale, "osuma");
}

export function salesDayCountIn(count: number, locale: AppLocale): string {
  return maara(count, locale, "myyntipaiva");
}

export function proposalCountIn(count: number, locale: AppLocale): string {
  return maara(count, locale, "esitys");
}

export function dayCountIn(count: number, locale: AppLocale): string {
  return maara(count, locale, "paiva");
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
export function weekdayByNumberIn(
  weekday: number,
  locale: AppLocale,
  muoto: "short" | "long" = "short",
): string {
  const paiva = `2024-01-0${weekday}`;
  return muoto === "long"
    ? weekdayLongIn(paiva, locale).toLowerCase()
    : weekdayShortIn(paiva, locale);
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
