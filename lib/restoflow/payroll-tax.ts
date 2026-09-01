/**
 * Ennakonpidätys, vakuutusmaksut ja työnantajan kustannus.
 *
 * Tämä tiedosto ei tuo mitään. Ei Supabasea, ei Reactia, ei
 * päivämääräkirjastoa. Palkanlaskenta on se osa Katea jonka on oltava
 * oikein myös silloin kun kukaan ei katso, ja ainoa tapa tietää se on
 * voida ajaa se ilman kantaa ja ilman selainta.
 *
 * ---------------------------------------------------------------------
 * KATE EI KEKSI VEROPROSENTTIA
 * ---------------------------------------------------------------------
 *
 * Ennakonpidätysprosentin laskee Verohallinto ja se lukee verokortissa.
 * Täällä ei ole yhtään kaavaa joka päättelisi sen tuloista, iästä tai
 * mistään muusta. Kortti sisään, pidätys ulos.
 *
 * Jos korttia ei ole, käytetään sitä prosenttia jonka laki siihen
 * tilanteeseen säätää — ei lievempää arvausta. Sekin luku tulee
 * sääntötaulusta eikä tästä tiedostosta.
 *
 * ---------------------------------------------------------------------
 * KOLME MAKSUA, EI YHTÄ PROSENTTIA
 * ---------------------------------------------------------------------
 *
 * Työntekijän palkasta pidätetään kolme eri asiaa kolmelle eri
 * vastaanottajalle:
 *
 *   ennakonpidätys            Verohallinto        verokortin mukaan
 *   työeläkevakuutusmaksu     eläkeyhtiö          vuosisääntö
 *   työttömyysvakuutusmaksu   Työllisyysrahasto   vuosisääntö
 *
 * Työntekijän sairausvakuutusmaksu ei ole listassa. Se sisältyy
 * verokortin pidätysprosenttiin, ja omana rivinään se perittäisiin
 * kahdesti.
 *
 * ---------------------------------------------------------------------
 * LUONTOISETU EI OLE RAHAA
 * ---------------------------------------------------------------------
 *
 * Luontoisedun verotusarvo kasvattaa veronalaista palkkaa ja siten
 * pidätystä ja vakuutusmaksuja. Nettopalkasta se vähennetään takaisin:
 * puhelinetua ei makseta tilille.
 *
 * Tämä on se kohta jonka käsin laskeva ravintoloitsija tekee väärin
 * useimmin, kumpaan suuntaan tahansa.
 */

// ---------------------------------------------------------------------------
// Tyypit
// ---------------------------------------------------------------------------

/**
 * Vuoden vahvistetut prosentit.
 *
 * Nämä eivät ole vakioita vaan riviä kannasta. Vuosi 2027 on uusi rivi,
 * eikä se muuta vuoden 2026 laskelmia.
 */
export interface TaxRules {
  taxYear: number;

  employeePensionRate: number;
  employeeUnemploymentRate: number;

  employerPensionRate: number;
  employerHealthRate: number;
  employerUnemploymentLowRate: number;
  employerUnemploymentHighRate: number;
  employerUnemploymentThresholdCents: number;

  /** Pidätys kun verokorttia ei ole. */
  noTaxCardRate: number;
  maxWithholdingRate: number;

  pensionMinAge: number;
  pensionMaxAge: number;
  unemploymentMinAge: number;
  unemploymentMaxAge: number;
}

export interface TaxCard {
  id: string;
  basePercent: number;
  additionalPercent: number;
  incomeLimitCents: number;

  /** Ennen Katea samalle kortille kertynyt tulo. */
  priorIncomeCents: number;

  validFrom: string;
  validTo: string | null;
}

export type BenefitKind =
  "meal" | "phone" | "car" | "housing" | "bicycle" | "other";

export interface EmployeeBenefit {
  id: string;
  kind: BenefitKind;
  label: string;
  monthlyValueCents: number;
  validFrom: string;
  validTo: string | null;
}

/**
 * Ravintolan omat työnantajamaksut.
 *
 * Työnantajan TyEL-maksu on vakuutusyhtiökohtainen ja
 * tapaturmavakuutus toimialan riskiluokan mukainen. Kate ei tiedä
 * niitä ennen kuin ravintola kertoo, ja siihen asti eläkemaksu on
 * kansallinen keskiarvo ja kaksi muuta puuttuvat kokonaan.
 */
export interface EmployerSettings {
  pensionRate: number | null;
  accidentRate: number | null;
  groupLifeRate: number | null;
}

export type TaxIssueKind =
  | "no_tax_card"
  | "no_pay_date"
  | "unknown_age"
  | "estimated_employer_cost"
  | "no_rules_for_year";

export interface TaxIssue {
  kind: TaxIssueKind;
  /** Valmis lause suomeksi. Käyttöliittymä näyttää tämän sellaisenaan. */
  message: string;
}

export interface WithholdingResult {
  /** Pidätys yhteensä sentteinä. */
  cents: number;

  /** Perusprosentilla pidätetty osuus veronalaisesta palkasta. */
  atBaseCents: number;

  /** Lisäprosentilla pidätetty osuus. */
  atAdditionalCents: number;

  /** Tulorajaa käytetty ennen tätä laskelmaa. */
  limitBeforeCents: number;

  /** Paljonko tämä laskelma käytti tulorajaa. */
  limitUsedCents: number;

  /** Tulorajaa jäljellä laskelman jälkeen. */
  limitRemainingCents: number;

  /** Laskettiinko ilman verokorttia. */
  noTaxCard: boolean;
}

export interface PayslipTax {
  /** Rahapalkka: peruspalkka ja lisät. */
  grossCents: number;

  /** Luontoisetujen verotusarvo. */
  benefitsCents: number;

  /** Veronalainen palkka = rahapalkka + luontoisedut. */
  taxableCents: number;

  withholding: WithholdingResult;

  employeePensionCents: number;
  employeeUnemploymentCents: number;

  /** Tilille maksettava. */
  netCents: number;

  employerPensionCents: number;
  employerHealthCents: number;
  employerUnemploymentCents: number;
  employerAccidentCents: number;
  employerGroupLifeCents: number;

  /** Rahapalkka + kaikki työnantajan maksut. */
  employerTotalCents: number;

  /** Laskennassa käytetyt arvot. Nämä jäädytetään laskelmalle. */
  used: {
    taxYear: number;
    taxCardId: string | null;
    basePercent: number | null;
    additionalPercent: number | null;
    employeePensionRate: number;
    employeeUnemploymentRate: number;
    employerPensionRate: number;
    employerHealthRate: number;
    employerUnemploymentRate: number;
    employerAccidentRate: number | null;
    employerGroupLifeRate: number | null;
  };

  issues: TaxIssue[];
}

// ---------------------------------------------------------------------------
// Pyöristys
// ---------------------------------------------------------------------------

/**
 * Sentteihin puolet ylöspäin.
 *
 * Jokainen prosenttilasku pyöristetään kerran, omalla rivillään.
 * Yhteissumman pyöristäminen lopuksi antaisi laskelman jonka rivit
 * eivät laske yhteen summakseen — ja juuri se on ensimmäinen asia
 * jonka palkkalaskelman lukija tarkistaa.
 *
 * Math.round(-0.5) on JavaScriptissä -0, joten negatiiviset kierretään
 * itseisarvon kautta. Palkassa negatiivinen on korjauserä, ei virhe.
 */
export function roundCents(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Prosenttiosuus sentteinä. */
function percentOf(cents: number, percent: number): number {
  return roundCents((cents * percent) / 100);
}

// ---------------------------------------------------------------------------
// Päivämäärät
// ---------------------------------------------------------------------------

/** "2026-03-10" → 2026. */
function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toDay(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

/**
 * Ikä päivänä.
 *
 * Kokonaisina vuosina, koska vakuuttamisvelvollisuuden ikärajat ovat
 * kokonaisia vuosia. Syntymäpäivänä ikä on jo täyttynyt.
 */
export function ageOn(birthDate: string, onDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(onDate)) return null;

  const syntyma = birthDate.slice(0, 10);
  const paiva = onDate.slice(0, 10);

  let ika = Number(paiva.slice(0, 4)) - Number(syntyma.slice(0, 4));

  /* Syntymäpäivä ei ole vielä ollut tänä vuonna. */
  if (paiva.slice(5) < syntyma.slice(5)) ika -= 1;

  return ika;
}

// ---------------------------------------------------------------------------
// Verokortin valinta
// ---------------------------------------------------------------------------

/**
 * Maksupäivänä voimassa oleva kortti.
 *
 * Parametrin nimi on payDate eikä date. Verokortti valitaan
 * Verohallinnon ohjeen mukaan suorituksen maksupäivästä, ja
 * työvuoron päivämäärä on se jota tässä kohtaa on helpoin vahingossa
 * antaa. Kesäkuussa tehty työ joka maksetaan heinäkuussa kuuluu
 * heinäkuun kortille.
 *
 * Useasta osuvasta valitaan myöhäisin alkupäivä: muutosverokortti
 * kumoaa aiemman samalta ajalta.
 */
export function pickTaxCard(cards: TaxCard[], payDate: string): TaxCard | null {
  const day = toDay(payDate);

  const osuvat = cards
    .filter((card) => {
      if (toDay(card.validFrom) > day) return false;
      if (card.validTo && toDay(card.validTo) < day) return false;
      return true;
    })
    .sort((a, b) => toDay(b.validFrom) - toDay(a.validFrom));

  return osuvat[0] ?? null;
}

// ---------------------------------------------------------------------------
// Luontoisedut
// ---------------------------------------------------------------------------

/**
 * Luontoisetujen verotusarvo palkkakaudelta.
 *
 * Arvo on kuukausiarvo, mutta palkkakausi ei ole aina kuukausi.
 * Puolikuukausikaudella etu jaetaan päivien suhteessa, jolloin kaksi
 * puolikasta summautuu takaisin kokonaiseksi kuukaudeksi. Koko etu
 * molemmille puolikkaille olisi kaksinkertainen verotusarvo, ja
 * kokonainen vain toiselle olisi mielivaltainen valinta.
 *
 * Osittainen voimassaolo kesken kuukauden käsitellään samalla
 * säännöllä: etu joka alkaa 16. päivä on puoli kuukautta.
 */
export function benefitsForPeriod(
  benefits: EmployeeBenefit[],
  from: string,
  to: string,
): number {
  return benefits.reduce(
    (sum, benefit) =>
      sum +
      prorateMonthly(
        benefit.monthlyValueCents,
        from,
        to,
        benefit.validFrom,
        benefit.validTo,
      ),
    0,
  );
}

/**
 * Kuukausiarvo jaksolle päivien suhteessa.
 *
 * Sama laskutoimitus tarvitaan kahteen asiaan: luontoisedun
 * verotusarvoon ja kuukausipalkkaan. Molemmissa kysymys on sama —
 * kuinka suuri osa kuukaudesta tämä jakso on — ja kaksi toteutusta
 * ajautuisi erilleen juuri karkausvuoden helmikuussa.
 *
 * Kuukausi kerrallaan, koska kuukausien pituus vaihtelee. Maaliskuun
 * puolikas on 15/31 ja helmikuun 14/28, eikä kumpikaan ole "puoli".
 * Näin kaksi puolikasta summautuu takaisin kokonaiseksi kuukaudeksi.
 *
 * Rajaus voimassaoloon on valinnainen: kuukausipalkalla sitä ei ole,
 * luontoisedulla on.
 */
export function prorateMonthly(
  monthlyCents: number,
  from: string,
  to: string,
  validFrom?: string | null,
  validTo?: string | null,
): number {
  let arvo = 0;

  let vuosi = yearOf(from);
  let kuukausi = Number(from.slice(5, 7));

  const loppuVuosi = yearOf(to);
  const loppuKuukausi = Number(to.slice(5, 7));

  /* Suojaus kelvottomalta jaksolta: silmukka ei saa jäädä pyörimään. */
  let kierroksia = 0;

  while (
    (vuosi < loppuVuosi ||
      (vuosi === loppuVuosi && kuukausi <= loppuKuukausi)) &&
    kierroksia < 240
  ) {
    kierroksia += 1;

    const pituus = daysInMonth(vuosi, kuukausi);
    const kuukaudenAlku = `${vuosi}-${pad(kuukausi)}-01`;
    const kuukaudenLoppu = `${vuosi}-${pad(kuukausi)}-${pad(pituus)}`;

    const alku = maxDay(
      maxDay(from, kuukaudenAlku),
      validFrom ?? kuukaudenAlku,
    );
    const loppu = minDay(minDay(to, kuukaudenLoppu), validTo ?? kuukaudenLoppu);

    if (toDay(alku) <= toDay(loppu)) {
      const paivia = (toDay(loppu) - toDay(alku)) / 86_400_000 + 1;
      arvo += (monthlyCents * paivia) / pituus;
    }

    kuukausi += 1;
    if (kuukausi > 12) {
      kuukausi = 1;
      vuosi += 1;
    }
  }

  return roundCents(arvo);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function maxDay(a: string, b: string): string {
  return toDay(a) >= toDay(b) ? a : b;
}

function minDay(a: string, b: string): string {
  return toDay(a) <= toDay(b) ? a : b;
}

// ---------------------------------------------------------------------------
// Ennakonpidätys
// ---------------------------------------------------------------------------

/**
 * Pidätys tulorajan molemmin puolin.
 *
 * Verokortissa on kaksi prosenttia ja raja niiden välissä. Rajaan asti
 * pidätetään perusprosentilla, sen ylittävältä osalta lisäprosentilla.
 * Sama palkka voi mennä molempiin: kun rajaa on jäljellä 500 euroa ja
 * palkka on 1 000, viisisataa menee kumpaankin.
 *
 * Raja on vuosiraja ja kertyy koko vuodelta, ei kaudelta. Siksi
 * funktio ottaa vastaan jo käytetyn määrän eikä laske sitä itse: se
 * tieto on kannassa, hyväksytyissä ja maksetuissa laskelmissa.
 *
 * Ilman korttia pidätetään se prosentti jonka laki siihen tilanteeseen
 * säätää. Se ei ole rangaistus vaan seuraus, ja se kerrotaan
 * laskelmalla omana merkintänään — muuten kuusikymmentä prosenttia
 * näyttäisi virheeltä.
 */
export function withholdingFor(input: {
  taxableCents: number;
  card: TaxCard | null;
  usedLimitCents: number;
  rules: TaxRules;
}): WithholdingResult {
  const { taxableCents, card, usedLimitCents, rules } = input;

  if (!card) {
    return {
      cents: percentOf(taxableCents, rules.noTaxCardRate),
      atBaseCents: 0,
      atAdditionalCents: taxableCents,
      limitBeforeCents: usedLimitCents,
      limitUsedCents: 0,
      limitRemainingCents: 0,
      noTaxCard: true,
    };
  }

  const jaljella = Math.max(0, card.incomeLimitCents - usedLimitCents);

  const perusOsa = Math.min(Math.max(0, taxableCents), jaljella);
  const lisaOsa = Math.max(0, taxableCents - perusOsa);

  return {
    cents:
      percentOf(perusOsa, card.basePercent) +
      percentOf(lisaOsa, card.additionalPercent),
    atBaseCents: perusOsa,
    atAdditionalCents: lisaOsa,
    limitBeforeCents: usedLimitCents,
    limitUsedCents: perusOsa,
    limitRemainingCents: Math.max(0, jaljella - perusOsa),
    noTaxCard: false,
  };
}

// ---------------------------------------------------------------------------
// Ikärajat
// ---------------------------------------------------------------------------

/**
 * Kuuluuko maksu perittäväksi iän perusteella.
 *
 * Tuntematon ikä palauttaa true. Ravintolan työntekijä on lähes aina
 * ikärajojen sisällä, ja maksun perimättä jättäminen olisi
 * työnantajalle jälkilasku. Puuttuva syntymäaika nostetaan
 * huomautukseksi, jotta se korjataan eikä jää huomaamatta.
 */
function withinAge(
  age: number | null,
  minAge: number,
  maxAge: number,
): boolean {
  if (age === null) return true;
  return age >= minAge && age <= maxAge;
}

// ---------------------------------------------------------------------------
// Työnantajan työttömyysvakuutusmaksu
// ---------------------------------------------------------------------------

/**
 * Porrastettu maksu rajan molemmin puolin.
 *
 * Alempi prosentti vuosipalkkasumman rajaan asti, ylempi sen yli.
 * Raja on koko yrityksen palkkasumma vuodessa, ei työntekijän palkka,
 * joten laskenta tarvitsee tiedon siitä paljonko on jo maksettu.
 *
 * Ravintola ylittää rajan harvoin. Se ei ole syy laskea väärin sitä
 * joka ylittää.
 */
export function employerUnemploymentFor(input: {
  taxableCents: number;
  payrollBeforeCents: number;
  rules: TaxRules;
}): { cents: number; effectiveRate: number } {
  const { taxableCents, payrollBeforeCents, rules } = input;

  const raja = rules.employerUnemploymentThresholdCents;
  const alle = Math.max(0, Math.min(taxableCents, raja - payrollBeforeCents));
  const yli = Math.max(0, taxableCents - alle);

  const cents =
    percentOf(alle, rules.employerUnemploymentLowRate) +
    percentOf(yli, rules.employerUnemploymentHighRate);

  /*
   * Toteutunut prosentti tallennetaan laskelmalle. Kun maksu jakautuu
   * rajan yli, kumpikaan taulukon prosenteista ei kuvaa sitä mitä
   * tällä laskelmalla tapahtui.
   */
  const effectiveRate =
    taxableCents === 0
      ? rules.employerUnemploymentLowRate
      : Math.round((cents / taxableCents) * 10_000) / 100;

  return { cents, effectiveRate };
}

// ---------------------------------------------------------------------------
// Koko laskelma
// ---------------------------------------------------------------------------

/**
 * Bruttopalkasta nettopalkkaan ja työnantajan kustannukseen.
 *
 * Yksi funktio, koska nämä ovat yksi laskutoimitus. Erillisinä
 * palasina joku laskisi jonain päivänä nettopalkan ilman
 * luontoisetuja tai työnantajan kustannuksen ilman lisiä, ja luvut
 * olisivat lähellä oikeaa.
 *
 * Palauttaa aina tuloksen, ei heitä. Puuttuva verokortti ei ole
 * poikkeus vaan tilanne jolla on lain määräämä seuraus, ja se
 * kerrotaan issues-listalla.
 */
export function calculatePayslipTax(input: {
  /** Rahapalkka: peruspalkka ja lisät. */
  grossCents: number;

  /** Palkkakausi luontoisetujen jaksotusta varten. */
  periodFrom: string;
  periodTo: string;

  /** Maksupäivä. Valitsee verokortin ja verovuoden. */
  payDate: string;

  cards: TaxCard[];
  benefits: EmployeeBenefit[];

  /** Tulorajaa käytetty ennen tätä laskelmaa. */
  usedLimitCents: number;

  /** Ravintolan vuoden palkkasumma ennen tätä laskelmaa. */
  payrollBeforeCents: number;

  rules: TaxRules;
  employer: EmployerSettings;

  /** Työntekijän syntymäaika, jos tiedossa. */
  birthDate: string | null;
}): PayslipTax {
  const {
    grossCents,
    periodFrom,
    periodTo,
    payDate,
    cards,
    benefits,
    usedLimitCents,
    payrollBeforeCents,
    rules,
    employer,
    birthDate,
  } = input;

  const issues: TaxIssue[] = [];

  const benefitsCents = benefitsForPeriod(benefits, periodFrom, periodTo);
  const taxableCents = grossCents + benefitsCents;

  // --- Ennakonpidätys ------------------------------------------------------

  const card = pickTaxCard(cards, payDate);

  if (!card) {
    issues.push({
      kind: "no_tax_card",
      message:
        `Voimassa olevaa verokorttia ei ole maksupäivälle ${payDate}. ` +
        `Ennakonpidätys on lain mukaan ${rules.noTaxCardRate} %. ` +
        `Pyydä työntekijältä verokortti ja laske palkka uudelleen.`,
    });
  }

  const withholding = withholdingFor({
    taxableCents,
    card,
    usedLimitCents,
    rules,
  });

  // --- Työntekijän vakuutusmaksut -----------------------------------------

  const age = birthDate ? ageOn(birthDate, payDate) : null;

  if (birthDate === null) {
    issues.push({
      kind: "unknown_age",
      message:
        "Syntymäaika puuttuu, joten vakuutusmaksujen ikärajoja ei voitu " +
        "tarkistaa. Maksut on peritty normaalisti.",
    });
  }

  const elakeIkaan = withinAge(age, rules.pensionMinAge, rules.pensionMaxAge);
  const tyottomyysIkaan = withinAge(
    age,
    rules.unemploymentMinAge,
    rules.unemploymentMaxAge,
  );

  const employeePensionCents = elakeIkaan
    ? percentOf(taxableCents, rules.employeePensionRate)
    : 0;

  const employeeUnemploymentCents = tyottomyysIkaan
    ? percentOf(taxableCents, rules.employeeUnemploymentRate)
    : 0;

  /*
   * Luontoisetu vähennetään takaisin.
   *
   * Se kasvatti veronalaista palkkaa ja siten pidätystä, mutta sitä ei
   * makseta rahana. Ilman tätä riviä nettopalkka olisi liian suuri
   * täsmälleen edun verotusarvon verran.
   */
  const netCents =
    taxableCents -
    withholding.cents -
    employeePensionCents -
    employeeUnemploymentCents -
    benefitsCents;

  // --- Työnantajan maksut --------------------------------------------------

  const employerPensionRate = employer.pensionRate ?? rules.employerPensionRate;

  if (employer.pensionRate === null) {
    issues.push({
      kind: "estimated_employer_cost",
      message:
        `Työnantajan eläkemaksuna on käytetty kansallista keskiarvoa ` +
        `${rules.employerPensionRate} %. Todellinen maksu on ` +
        `vakuutusyhtiökohtainen — syötä se palkka-asetuksiin, jotta ` +
        `kustannus on tarkka.`,
    });
  }

  const employerPensionCents = elakeIkaan
    ? percentOf(taxableCents, employerPensionRate)
    : 0;

  const employerHealthCents = percentOf(taxableCents, rules.employerHealthRate);

  const unemployment = tyottomyysIkaan
    ? employerUnemploymentFor({ taxableCents, payrollBeforeCents, rules })
    : { cents: 0, effectiveRate: 0 };

  const employerAccidentCents =
    employer.accidentRate === null
      ? 0
      : percentOf(taxableCents, employer.accidentRate);

  const employerGroupLifeCents =
    employer.groupLifeRate === null
      ? 0
      : percentOf(taxableCents, employer.groupLifeRate);

  /*
   * Kokonaiskustannus lasketaan veronalaisesta palkasta.
   *
   * Luontoisetu on työnantajalle todellinen kulu — ateria maksaa
   * keittiölle jotain — ja se on jo mukana veronalaisessa palkassa.
   * Rahapalkasta laskettu kustannus jättäisi sen ulos.
   */
  const employerTotalCents =
    taxableCents +
    employerPensionCents +
    employerHealthCents +
    unemployment.cents +
    employerAccidentCents +
    employerGroupLifeCents;

  return {
    grossCents,
    benefitsCents,
    taxableCents,
    withholding,
    employeePensionCents,
    employeeUnemploymentCents,
    netCents,
    employerPensionCents,
    employerHealthCents,
    employerUnemploymentCents: unemployment.cents,
    employerAccidentCents,
    employerGroupLifeCents,
    employerTotalCents,
    used: {
      taxYear: rules.taxYear,
      taxCardId: card?.id ?? null,
      basePercent: card ? card.basePercent : rules.noTaxCardRate,
      additionalPercent: card ? card.additionalPercent : rules.noTaxCardRate,
      employeePensionRate: elakeIkaan ? rules.employeePensionRate : 0,
      employeeUnemploymentRate: tyottomyysIkaan
        ? rules.employeeUnemploymentRate
        : 0,
      employerPensionRate: elakeIkaan ? employerPensionRate : 0,
      employerHealthRate: rules.employerHealthRate,
      employerUnemploymentRate: unemployment.effectiveRate,
      employerAccidentRate: employer.accidentRate,
      employerGroupLifeRate: employer.groupLifeRate,
    },
    issues,
  };
}
