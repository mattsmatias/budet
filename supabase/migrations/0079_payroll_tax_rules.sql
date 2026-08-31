-- ---------------------------------------------------------------------------
-- 0079 — Palkanlaskennan vuosisäännöt
-- ---------------------------------------------------------------------------
--
-- Suomalainen palkanlaskenta on täynnä lukuja jotka muuttuvat kerran
-- vuodessa: työeläkemaksu, työttömyysvakuutusmaksu, työnantajan
-- sairausvakuutusmaksu, luontoisetujen verotusarvot. Yksikään niistä
-- ei ole sovelluslogiikkaa. Ne ovat tietoa jonka joku muu päättää.
--
-- ---------------------------------------------------------------------------
-- MIKSI TAULU EIKÄ VAKIO
-- ---------------------------------------------------------------------------
--
-- Kirjoitettuna koodiin "7,30 %" olisi oikein tasan vuoden. Kun
-- prosentti muuttuu 2027, vaihtoehtoja olisi kaksi: muuttaa vakio ja
-- rikkoa jokainen vuoden 2026 palkkalaskelma takautuvasti, tai
-- kirjoittaa if-lause vuosiluvusta ja toinen ensi vuonna.
--
-- Taulu tekee vuosimuutoksesta yhden rivin. Vanhat laskelmat pysyvät
-- ennallaan, koska ne lukevat oman vuotensa rivin — ja koska ne
-- tallentavat käytetyt arvot itseensä (0081).
--
-- ---------------------------------------------------------------------------
-- MITÄ TÄÄLLÄ EI OLE
-- ---------------------------------------------------------------------------
--
-- Ennakonpidätysprosenttia ei ole. Kate ei laske työntekijän
-- veroprosenttia — sen laskee Verohallinto ja se lukee verokortissa.
-- Täällä on vain se prosentti jota laki käskee käyttää silloin kun
-- verokorttia ei ole lainkaan.
--
-- Työnantajan tapaturmavakuutus- ja ryhmähenkivakuutusmaksua ei ole.
-- Ne eivät ole kansallisia prosentteja vaan vakuutusyhtiön ja
-- toimialan riskiluokan mukaisia, eikä keksitty luku ole parempi kuin
-- puuttuva luku.
--
-- ---------------------------------------------------------------------------
-- LÄHTEET
-- ---------------------------------------------------------------------------
--
-- Vuoden 2026 arvot on haettu näistä:
--
--   Eläketurvakeskus, Työeläkemaksut vuonna 2026
--   https://www.etk.fi/ajankohtaista/tyoelakemaksut-vuonna-2026/
--
--   Työeläkeyhtiö Elo, Sosiaalivakuutusmaksut 2026
--   https://www.elo.fi/fi-fi/tyonantaja/tyel-vakuuttaminen/tyel-maksu/
--   sosiaalivakuutusmaksut-2026
--
--   Verohallinto, Verokorttiohjeet maksajalle
--   https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/
--   yritys_tyonantajana/verokorttiohjeet/
--
--   Verohallinnon päätös luontoisetujen laskentaperusteista 2026
--   https://www.vero.fi/en/detailed-guidance/decisions/47380/
--   in-kind-benefits-fringe-benefits-2026/
--
-- Lähde tallennetaan riville. Kun joku kysyy kahden vuoden päästä
-- mistä 1,91 % tuli, vastaus on rivillä eikä kenenkään muistissa.

-- ---------------------------------------------------------------------------
-- 1. Vuosisäännöt
-- ---------------------------------------------------------------------------

create table if not exists payroll_tax_rules (
  tax_year integer primary key,

  -- --- Työntekijältä perittävät ------------------------------------------
  --
  -- Nämä kolme ovat ainoat jotka työnantaja pidättää palkasta
  -- ennakonpidätyksen lisäksi. Työntekijän sairausvakuutusmaksu ei ole
  -- listassa: se sisältyy verokortin pidätysprosenttiin eikä sitä
  -- peritä erikseen. Erillisenä se veloitettaisiin kahdesti.

  /** Työntekijän työeläkevakuutusmaksu, % palkasta. */
  employee_pension_rate numeric(5, 2) not null,

  /** Palkansaajan työttömyysvakuutusmaksu, % palkasta. */
  employee_unemployment_rate numeric(5, 2) not null,

  -- --- Työnantajan maksut -------------------------------------------------

  /**
   * Työnantajan työeläkevakuutusmaksu, % palkasta.
   *
   * Tämä on keskimääräinen luku. Todellinen maksu riippuu
   * vakuutusyhtiöstä, yrityksen koosta ja asiakashyvityksistä, joten
   * ravintola voi korvata sen omallaan (payroll_settings).
   */
  employer_pension_rate numeric(5, 2) not null,

  /** Työnantajan sairausvakuutusmaksu, % palkasta. */
  employer_health_rate numeric(5, 2) not null,

  /*
   * Työnantajan työttömyysvakuutusmaksu on porrastettu.
   *
   * Alempi prosentti rajaan asti, ylempi sen ylittävältä osalta.
   * Raja lasketaan koko vuoden palkkasummasta, ei kuukaudesta.
   */
  employer_unemployment_low_rate numeric(5, 2) not null,
  employer_unemployment_high_rate numeric(5, 2) not null,
  employer_unemployment_threshold_cents bigint not null,

  -- --- Ennakonpidätys -----------------------------------------------------

  /**
   * Pidätysprosentti kun verokorttia ei ole.
   *
   * Ei oletus eikä arvaus vaan laissa säädetty seuraus siitä ettei
   * verokorttia esitetä. Kate ei keksi tähän mitään lievempää.
   */
  no_tax_card_rate numeric(5, 2) not null,

  /** Suurin sallittu pidätysprosentti verokortilla. */
  max_withholding_rate numeric(5, 2) not null default 60.00,

  -- --- Ikärajat -----------------------------------------------------------
  --
  -- Maksuvelvollisuus alkaa ja päättyy iän mukaan. Rajat ovat
  -- säännöissä eivätkä koodissa, koska nekin ovat muuttuneet
  -- useammin kuin kerran.

  pension_min_age smallint not null,
  pension_max_age smallint not null,
  unemployment_min_age smallint not null,
  unemployment_max_age smallint not null,

  -- --- Jäljitettävyys -----------------------------------------------------

  /** Mistä luvut on otettu. Yksi tai useampi osoite, rivinvaihdoin. */
  source_url text not null default '',
  source_note text not null default '',

  /*
   * Vahvistettu vai alustava.
   *
   * Ensi vuoden luvut tiedetään usein loppusyksystä, mutta ne
   * vahvistetaan myöhemmin. Merkintä kertoo laskelman lukijalle
   * kummasta on kyse.
   */
  confirmed boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_tax_rules_year check (tax_year between 2000 and 2100),
  constraint payroll_tax_rules_rates check (
    employee_pension_rate >= 0 and employee_pension_rate <= 100
    and employee_unemployment_rate >= 0 and employee_unemployment_rate <= 100
    and employer_pension_rate >= 0 and employer_pension_rate <= 100
    and employer_health_rate >= 0 and employer_health_rate <= 100
    and employer_unemployment_low_rate >= 0
    and employer_unemployment_high_rate >= 0
    and no_tax_card_rate >= 0 and no_tax_card_rate <= 100
  ),
  constraint payroll_tax_rules_ages check (
    pension_min_age >= 0 and pension_max_age > pension_min_age
    and unemployment_min_age >= 0 and unemployment_max_age > unemployment_min_age
  )
);

-- ---------------------------------------------------------------------------
-- 2. Luontoisetujen verotusarvot
-- ---------------------------------------------------------------------------
--
-- Oma taulu eikä sarakkeita sääntöriville: etuja on kymmenkunta ja
-- niitä tulee lisää. Sarakkeina jokainen uusi etu olisi migraatio.
--
-- Kaikkia ei voi arvottaa taulukosta. Autoedun ja asuntoedun arvo
-- riippuu autosta ja asunnosta, joten niille tallennetaan arvo nollana
-- ja merkintä siitä että arvo on syötettävä käsin. Kate ei arvaa
-- työsuhdeauton verotusarvoa.

do $$ begin
  create type benefit_kind as enum (
    'meal', 'phone', 'car', 'housing', 'bicycle', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists payroll_benefit_values (
  tax_year integer not null references payroll_tax_rules(tax_year) on delete cascade,
  kind benefit_kind not null,

  /**
   * Verotusarvo sentteinä.
   *
   * Ravintoedulla ateriaa kohti, muilla kuukaudessa. Nolla tarkoittaa
   * ettei taulukkoarvoa ole — silloin arvo on aina syötettävä.
   */
  value_cents integer not null default 0,

  /** 'per_month' tai 'per_meal'. Kertoo mitä value_cents tarkoittaa. */
  unit text not null default 'per_month',

  /**
   * Vaatiiko käsin syötetyn arvon.
   *
   * Autoetu ja asuntoetu lasketaan aina tapauskohtaisesti. Merkintä
   * estää käyttöliittymää tarjoamasta nollaa oletusarvona.
   */
  requires_manual_value boolean not null default false,

  note text not null default '',

  primary key (tax_year, kind),

  constraint payroll_benefit_values_value check (value_cents >= 0),
  constraint payroll_benefit_values_unit check (unit in ('per_month', 'per_meal'))
);

-- ---------------------------------------------------------------------------
-- 3. Ravintolan omat palkka-asetukset
-- ---------------------------------------------------------------------------
--
-- Kansallinen keskiarvo ei ole kenenkään todellinen maksu. Työnantajan
-- TyEL-maksu riippuu vakuutusyhtiöstä ja asiakashyvityksistä,
-- tapaturmavakuutus toimialan riskiluokasta. Nämä ravintola tietää ja
-- Kate ei.
--
-- Rivi on vapaaehtoinen: ilman sitä käytetään vuosisääntöjen
-- keskiarvoa, ja työnantajan kustannus on likiarvo. Sen sanotaan
-- laskelmassa ääneen.

create table if not exists payroll_settings (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,

  /** Ravintolan oma työnantajan TyEL-%. Null = käytä vuoden keskiarvoa. */
  employer_pension_rate numeric(5, 2),

  /** Tapaturmavakuutusmaksu, %. Null = ei mukana laskelmassa. */
  employer_accident_rate numeric(5, 2),

  /** Ryhmähenkivakuutusmaksu, %. Null = ei mukana laskelmassa. */
  employer_group_life_rate numeric(5, 2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_settings_rates check (
    (employer_pension_rate is null or (employer_pension_rate >= 0 and employer_pension_rate <= 100))
    and (employer_accident_rate is null or (employer_accident_rate >= 0 and employer_accident_rate <= 100))
    and (employer_group_life_rate is null or (employer_group_life_rate >= 0 and employer_group_life_rate <= 100))
  )
);

-- ---------------------------------------------------------------------------
-- 4. Vuoden 2026 arvot
-- ---------------------------------------------------------------------------
--
-- Vuoden 2026 muutos työeläkemaksussa: ikäryhmittäin eriytyneet
-- työntekijämaksut poistuivat. Vuosina 2017–2025 53–62-vuotias maksoi
-- korkeampaa maksua; 2026 alkaen kaikki maksavat 7,30 %.
--
-- Työnantajan 17,10 % on keskiarvo. Todellinen maksu on
-- vakuutusyhtiökohtainen, ja ravintola voi korvata sen omallaan.

insert into payroll_tax_rules (
  tax_year,
  employee_pension_rate,
  employee_unemployment_rate,
  employer_pension_rate,
  employer_health_rate,
  employer_unemployment_low_rate,
  employer_unemployment_high_rate,
  employer_unemployment_threshold_cents,
  no_tax_card_rate,
  max_withholding_rate,
  pension_min_age,
  pension_max_age,
  unemployment_min_age,
  unemployment_max_age,
  source_url,
  source_note,
  confirmed
) values (
  2026,
  7.30,
  0.89,
  17.10,
  1.91,
  0.31,
  1.23,
  250950000,
  60.00,
  60.00,
  17,
  68,
  18,
  65,
  'https://www.etk.fi/ajankohtaista/tyoelakemaksut-vuonna-2026/' || chr(10) ||
  'https://www.elo.fi/fi-fi/tyonantaja/tyel-vakuuttaminen/tyel-maksu/sosiaalivakuutusmaksut-2026' || chr(10) ||
  'https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/yritys_tyonantajana/verokorttiohjeet/',
  'Tyontekijamaksun ikaporrastus poistui 2026 alkaen: kaikki ikaryhmat 7,30 %. ' ||
  'Tyonantajan TyEL 17,10 % on keskiarvo, todellinen maksu on vakuutusyhtiokohtainen. ' ||
  'Tyonantajan tyottomyysvakuutusmaksun raja 2 509 500 euroa vuoden palkkasummasta. ' ||
  'Ennakonpidatys ilman verokorttia 60 %.',
  true
)
on conflict (tax_year) do nothing;

insert into payroll_benefit_values (tax_year, kind, value_cents, unit, requires_manual_value, note)
values
  (2026, 'meal',    880, 'per_meal',  false,
   'Verohallinnon paatos 2026, 10 §. 8,80 euroa ateriaa kohti kun tyonantajan valittomat kustannukset ovat 8,80-14,00 euroa.'),
  (2026, 'phone',  2000, 'per_month', false,
   'Verohallinnon paatos 2026, 26 §. 20 euroa kuukaudessa.'),
  (2026, 'bicycle',   0, 'per_month', true,
   'Verohallinnon paatos 2026, 27 §. Arvo lasketaan pyoran hankintahinnasta; kunnossapito-osuus 30 e/kk sahkopyoralle ja 20 e/kk muulle. Syotettava kasin.'),
  (2026, 'car',       0, 'per_month', true,
   'Verohallinnon paatos 2026, 17 §. Arvo riippuu auton ika- ja hintaryhmasta. Syotettava kasin.'),
  (2026, 'housing',   0, 'per_month', true,
   'Verohallinnon paatos 2026, 2 §. Arvo riippuu sijainnista ja pinta-alasta. Syotettava kasin.'),
  (2026, 'other',     0, 'per_month', true,
   'Kayvan arvon mukaan, Verohallinnon paatos 2026, 28 §. Syotettava kasin.')
on conflict (tax_year, kind) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Oikeudet
-- ---------------------------------------------------------------------------
--
-- Vuosisäännöt ja luontoisetujen taulukkoarvot ovat julkista tietoa:
-- ne lukevat Verohallinnon ja Eläketurvakeskuksen sivuilla. Jokainen
-- kirjautunut saa lukea ne, koska palkkalaskelman lukijan on voitava
-- tarkistaa mistä luku tuli.
--
-- Kirjoitusoikeutta ei anneta kenellekään. Nämä rivit tulevat
-- migraatiosta, eikä ravintola saa muuttaa kansallisia prosentteja
-- omassa kannassaan — muutettu prosentti olisi väärä palkka ilman
-- että kukaan huomaisi.

alter table payroll_tax_rules enable row level security;
alter table payroll_benefit_values enable row level security;
alter table payroll_settings enable row level security;

drop policy if exists payroll_tax_rules_read on payroll_tax_rules;
create policy payroll_tax_rules_read on payroll_tax_rules
  for select to authenticated using (true);

drop policy if exists payroll_benefit_values_read on payroll_benefit_values;
create policy payroll_benefit_values_read on payroll_benefit_values
  for select to authenticated using (true);

/*
 * Palkka-asetukset ovat ravintolan omia.
 *
 * Lukuoikeus jäsenille: työnantajan kustannus näkyy laskelmalla, ja
 * sen tarkistaminen vaatii tiedon käytetystä prosentista.
 * Kirjoitusoikeus vain esihenkilölle.
 */
drop policy if exists payroll_settings_read on payroll_settings;
create policy payroll_settings_read on payroll_settings
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists payroll_settings_write on payroll_settings;
create policy payroll_settings_write on payroll_settings
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists payroll_tax_rules_touch on payroll_tax_rules;
create trigger payroll_tax_rules_touch before update on payroll_tax_rules
  for each row execute function touch_updated_at();

drop trigger if exists payroll_settings_touch on payroll_settings;
create trigger payroll_settings_touch before update on payroll_settings
  for each row execute function touch_updated_at();
