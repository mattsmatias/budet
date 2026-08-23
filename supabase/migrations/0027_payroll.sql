-- ---------------------------------------------------------------------------
-- 0027 — Palkat
-- ---------------------------------------------------------------------------
--
-- Työntekijän tekemä työ muuttuu palkkakertymäksi ja palkkalaskelmaksi.
--
-- Viisi ratkaisua ohjaa koko tiedostoa.
--
-- 1. SUUNNITELTU AIKA EI OLE PALKKA-AIKA.
--    Vuoron kellonajat ovat suunnitelma. Palkkaan oikeuttaa vain
--    clock_events-tapahtumista johdettu toteutunut aika. Siksi täällä ei
--    ole yhtään kenttää joka kopioisi vuoron suunniteltua aikaa: jos
--    sellainen olisi, joku laskisi jonain päivänä palkan siitä.
--
-- 2. ALKUPERÄISTÄ LEIMAUSTA EI MUUTETA KOSKAAN.
--    Unohtunut ulosleimaus korjataan lisäämällä korjaus, ei
--    kirjoittamalla clock_events-riviä uusiksi. Korjaus kantaa
--    alkuperäiset ajat, uudet ajat, tekijän, hetken ja syyn. Näin
--    palkkalaskelmasta pääsee aina takaisin siihen mitä oikeasti
--    tapahtui — ja siihen kuka päätti toisin.
--
-- 3. PALKKALASKELMA ON TILANNEKUVA.
--    Hyväksytty palkka ei saa muuttua äänettömästi kun vuoroa korjataan
--    jälkikäteen. Rivit ja summat jäädytetään, ja lähtötiedoista
--    lasketaan sormenjälki. Jos se muuttuu hyväksynnän jälkeen,
--    laskelma merkitään uudelleentarkistusta vaativaksi.
--
-- 4. PALKKALAJI ON DATAA, EI KOODIA.
--    Iltalisää ei kovakoodata. Palkkalajilla on arvo, yksikkö,
--    soveltamisikkuna ja voimassaolo. Tämä ei ole TES-moottori eikä
--    yritä olla: se on rakenne joka kattaa tavalliset lisät ilman että
--    uusi lisä vaatii koodimuutoksen.
--
-- 5. LISÄN SUURUUTTA EI ARVATA.
--    Yhtään palkkalajia ei luoda valmiiksi. Keksitty prosentti olisi
--    väärä palkka, ja väärä palkka on pahempi kuin puuttuva ominaisuus.
--    Peruspalkka toimii heti; lisät otetaan käyttöön kun ravintola
--    syöttää oikeat arvot.

-- ---------------------------------------------------------------------------
-- 1. Tyypit
-- ---------------------------------------------------------------------------

do $$ begin
  create type pay_type as enum ('hourly', 'monthly');
exception when duplicate_object then null; end $$;

-- Miten palkkalajin arvo luetaan.
--
--   per_hour  kiinteä euromäärä jokaiselta tunnilta   (1,50 €/h)
--   percent   prosentti peruspalkasta samalta ajalta  (+100 %)
--   fixed     kertakorvaus kaudelta                    (50 €)
do $$ begin
  create type pay_component_unit as enum ('per_hour', 'percent', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_period_status as enum ('open', 'review', 'approved', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payslip_status as enum ('draft', 'review', 'approved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Työntekijän palkkatiedot
-- ---------------------------------------------------------------------------
--
-- hourly_rate_cents on jo olemassa eikä sitä siirretä. Uusi taulu
-- työntekijän palkkatiedoille olisi toinen paikka jossa tuntipalkka
-- asuu, ja kaksi paikkaa ajautuu erilleen.

alter table memberships
  add column if not exists pay_type pay_type not null default 'hourly';

-- Kuukausipalkka sentteinä. Null kun palkkatyyppi on tuntipalkka.
alter table memberships
  add column if not exists monthly_salary_cents integer;

alter table memberships
  drop constraint if exists memberships_salary_matches_type;

-- Kuukausipalkkalainen ilman kuukausipalkkaa saisi nollan palkkaa
-- hiljaisesti. Tuntipalkkalaisen kenttä saa jäädä tyhjäksi.
alter table memberships
  add constraint memberships_salary_matches_type check (
    pay_type <> 'monthly' or monthly_salary_cents is not null
  );

-- ---------------------------------------------------------------------------
-- 3. Palkkalajit
-- ---------------------------------------------------------------------------

create table if not exists pay_components (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  name text not null,

  /*
   * Tunniste tavallisille lisille.
   *
   * Vapaa teksti eikä enum: ravintola saa nimetä oman lisänsä, eikä
   * uusi lisä saa vaatia migraatiota. Tunnetut arvot ovat
   * evening, night, saturday, sunday, overtime, other.
   */
  code text not null default 'other',

  unit pay_component_unit not null,

  /*
   * Arvo yksikkönsä mukaan.
   *
   * per_hour ja fixed sentteinä, percent prosentteina (100 = +100 %).
   * Kaksi saraketta yhden sijaan olisi jättänyt aina toisen tyhjäksi;
   * yksikkö kertoo kumpaa luetaan.
   */
  value numeric(10, 2) not null,

  /*
   * Milloin sovelletaan.
   *
   * weekdays: 1 = maanantai ... 7 = sunnuntai. Tyhjä = kaikki päivät.
   * from_minute / to_minute: minuutteja paikallisesta keskiyöstä.
   *   Null molemmissa = koko vuorokausi.
   *   from > to tarkoittaa keskiyön yli: 23:00-06:00 on 1380 -> 360.
   */
  weekdays smallint[] not null default '{}',
  from_minute smallint,
  to_minute smallint,

  /*
   * Voiko yhdistyä muihin lisiin.
   *
   * Sunnuntai-illan työstä voi kertyä sekä sunnuntai- että iltalisä,
   * mutta ei aina. Kun tämä on false, samalta minuutilta maksetaan
   * vain arvokkain lisä.
   */
  stackable boolean not null default true,

  valid_from date not null default current_date,
  valid_to date,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pay_components_window check (
    (from_minute is null and to_minute is null)
    or (from_minute is not null and to_minute is not null)
  ),
  constraint pay_components_minutes check (
    (from_minute is null or (from_minute >= 0 and from_minute <= 1440))
    and (to_minute is null or (to_minute >= 0 and to_minute <= 1440))
  ),
  constraint pay_components_validity check (valid_to is null or valid_to >= valid_from)
);

create index if not exists pay_components_restaurant_idx
  on pay_components (restaurant_id) where active;

-- ---------------------------------------------------------------------------
-- 4. Palkkakaudet
-- ---------------------------------------------------------------------------
--
-- Kausi on päivävälinä eikä kuukautena. Puolikuukausikausi (1.-15.) on
-- yhtä luonteva kuin kuukausi, eikä kumpikaan ole erikoistapaus.

create table if not exists pay_periods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  starts_on date not null,
  ends_on date not null,

  status pay_period_status not null default 'open',

  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pay_periods_range check (ends_on >= starts_on),
  constraint pay_periods_unique unique (restaurant_id, starts_on, ends_on)
);

create index if not exists pay_periods_restaurant_idx
  on pay_periods (restaurant_id, starts_on desc);

-- ---------------------------------------------------------------------------
-- 5. Työajan korjaukset
-- ---------------------------------------------------------------------------
--
-- Tämä taulu on koko moduulin omatunto.
--
-- Kun ulosleimaus unohtuu, yrittäjä korjaa toteutuneen ajan. Korjaus ei
-- kirjoita clock_events-riviä uusiksi vaan asettuu sen päälle. Rivi
-- kantaa mitä siellä oli ennen, mitä siihen laitettiin, kuka laittoi,
-- milloin ja miksi.
--
-- Syy on pakollinen eikä valinnainen. Korjaus ilman perustelua on
-- palkkalaskelmassa luku jota kukaan ei osaa selittää.

create table if not exists time_corrections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  /** Päivä ravintolan aikavyöhykkeellä. */
  work_date date not null,

  /** Mitä leimauksista luettiin ennen korjausta. Null jos puuttui. */
  original_in timestamptz,
  original_out timestamptz,
  original_break_minutes integer,

  /** Mitä korjauksen jälkeen käytetään. */
  corrected_in timestamptz not null,
  corrected_out timestamptz not null,
  corrected_break_minutes integer not null default 0,

  reason text not null,

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),

  constraint time_corrections_order check (corrected_out > corrected_in),
  constraint time_corrections_break check (corrected_break_minutes >= 0),
  constraint time_corrections_reason check (length(btrim(reason)) > 0),

  /*
   * Yksi voimassa oleva korjaus per työntekijä ja päivä.
   *
   * Toinen korjaus samalle päivälle korvaa edellisen; historia säilyy
   * siinä että korvattu rivi poistetaan vasta kun uusi on tallennettu,
   * ja molemmat näkyvät tarkastuslokissa.
   */
  constraint time_corrections_unique unique (restaurant_id, user_id, work_date)
);

create index if not exists time_corrections_lookup_idx
  on time_corrections (restaurant_id, work_date);

-- ---------------------------------------------------------------------------
-- 6. Palkkalaskelmat
-- ---------------------------------------------------------------------------

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  pay_period_id uuid not null references pay_periods(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  status payslip_status not null default 'draft',

  /*
   * Tuntipalkka talletetaan laskelmaan.
   *
   * Jos se luettaisiin jäsenyydestä, palkankorotus muuttaisi
   * takautuvasti jo maksetut laskelmat.
   */
  hourly_rate_cents integer,
  pay_type pay_type not null default 'hourly',

  worked_minutes integer not null default 0,
  base_cents integer not null default 0,
  supplements_cents integer not null default 0,
  gross_cents integer not null default 0,

  /*
   * Kirjanpidon valmius.
   *
   * Vähennyksiä ja työnantajan kuluja ei lasketa vielä, mutta paikka on
   * olemassa jotta ne eivät myöhemmin vaadi laskelmien uudelleenluontia.
   */
  deductions_cents integer not null default 0,
  employer_cost_cents integer not null default 0,
  cost_center text,

  /*
   * Lähtötietojen sormenjälki.
   *
   * Lasketaan niistä leimauksista, korjauksista ja palkkalajeista
   * joista laskelma syntyi. Jos se ei täsmää nykytilaan, laskelma on
   * vanhentunut ja vaatii uuden tarkistuksen.
   */
  source_fingerprint text not null default '',

  computed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payslips_unique unique (pay_period_id, user_id)
);

create index if not exists payslips_period_idx on payslips (pay_period_id);
create index if not exists payslips_user_idx on payslips (restaurant_id, user_id);

-- ---------------------------------------------------------------------------
-- 7. Palkkalaskelman rivit
-- ---------------------------------------------------------------------------
--
-- Jokainen rivi osoittaa mistä summa tuli: päivä, vuoro, palkkalaji ja
-- mahdollinen korjaus. Ilman näitä viittauksia laskelma on laskin;
-- niiden kanssa se on jäljitettävissä.

create table if not exists payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references payslips(id) on delete cascade,

  work_date date not null,

  /** Vuoro josta rivi syntyi. Null jos työtä tehtiin ilman vuoroa. */
  shift_id uuid references shifts(id) on delete set null,

  /** Palkkalaji. Null tarkoittaa peruspalkkaa. */
  pay_component_id uuid references pay_components(id) on delete set null,

  /** Korjaus jonka aikaan rivi perustuu, jos aikaa korjattiin. */
  correction_id uuid references time_corrections(id) on delete set null,

  description text not null,
  minutes integer not null default 0,

  /** Yksikköhinta sentteinä tunnilta, tai prosentti jos laji on percent. */
  rate_cents integer not null default 0,
  amount_cents integer not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists payslip_lines_slip_idx on payslip_lines (payslip_id, work_date);
create index if not exists payslip_lines_shift_idx on payslip_lines (shift_id);

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
--
-- Palkka on henkilötietoa. Työntekijä näkee omansa, esihenkilö kaikki,
-- kirjanpitäjä ei mitään: hän saa kuluraportin kokonaissummina eikä
-- tarvitse yksittäisen ihmisen palkkaa.

alter table pay_components enable row level security;
alter table pay_periods enable row level security;
alter table time_corrections enable row level security;
alter table payslips enable row level security;
alter table payslip_lines enable row level security;

drop policy if exists pay_components_read on pay_components;
create policy pay_components_read on pay_components
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists pay_components_write on pay_components;
create policy pay_components_write on pay_components
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists pay_periods_read on pay_periods;
create policy pay_periods_read on pay_periods
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists pay_periods_write on pay_periods;
create policy pay_periods_write on pay_periods
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

/*
 * Korjauksen näkee se jota se koskee.
 *
 * Työntekijän on voitava tarkistaa millä perusteella hänen työaikaansa
 * muutettiin. Korjauksen saa tehdä vain esihenkilö.
 */
drop policy if exists time_corrections_read on time_corrections;
create policy time_corrections_read on time_corrections
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
  );

drop policy if exists time_corrections_write on time_corrections;
create policy time_corrections_write on time_corrections
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists payslips_read on payslips;
create policy payslips_read on payslips
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_manager(restaurant_id)
  );

drop policy if exists payslips_write on payslips;
create policy payslips_write on payslips
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists payslip_lines_read on payslip_lines;
create policy payslip_lines_read on payslip_lines
  for select to authenticated
  using (
    payslip_id in (
      select id from payslips
      where user_id = auth.uid() or is_manager(restaurant_id)
    )
  );

drop policy if exists payslip_lines_write on payslip_lines;
create policy payslip_lines_write on payslip_lines
  for all to authenticated
  using (
    payslip_id in (select id from payslips where is_manager(restaurant_id))
  )
  with check (
    payslip_id in (select id from payslips where is_manager(restaurant_id))
  );

-- ---------------------------------------------------------------------------
-- 9. Hyväksytty kausi lukkiutuu
-- ---------------------------------------------------------------------------
--
-- Käytäntö ei riitä tähän: lukitus ei koske sitä kuka saa kirjoittaa
-- vaan sitä milloin. Liipaisin on oikea paikka, koska se pätee myös
-- silloin kun rivi päivitetään jostain muualta kuin sovelluksesta.

create or replace function payslip_locked_when_period_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  period_status pay_period_status;
begin
  select status into period_status
  from pay_periods
  where id = coalesce(new.pay_period_id, old.pay_period_id);

  if period_status in ('approved', 'paid') then
    raise exception 'Palkkakausi on hyväksytty. Avaa kausi ennen muutosta.'
      using errcode = 'check_violation';
  end if;

  -- Poistossa new on null, joten rivi olisi kadonnut paluuarvon mukana.
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists payslips_locked on payslips;
create trigger payslips_locked
  before update or delete on payslips
  for each row
  when (pg_trigger_depth() = 0)
  execute function payslip_locked_when_period_approved();

/*
 * Liipaisinfunktiota ei kutsuta rajapinnasta.
 *
 * Postgres antaa uudelle funktiolle oletuksena suoritusoikeuden
 * kaikille, jolloin se näkyy PostgRESTin /rpc-polulla. Kutsu ei tekisi
 * mitään hyödyllistä ilman liipaisinkontekstia, mutta security definer
 * -funktion ei kuulu olla kutsuttavissa ilman syytä.
 */
revoke all on function payslip_locked_when_period_approved() from public;
revoke all on function payslip_locked_when_period_approved() from anon;
revoke all on function payslip_locked_when_period_approved() from authenticated;

-- ---------------------------------------------------------------------------
-- 10. updated_at
-- ---------------------------------------------------------------------------
--
-- touch_updated_at on jo olemassa aiemmista migraatioista. Sitä ei
-- määritellä tässä uudelleen: identtinenkin uudelleenmäärittely olisi
-- toinen paikka jota pitäisi muistaa muuttaa.

drop trigger if exists pay_components_touch on pay_components;
create trigger pay_components_touch before update on pay_components
  for each row execute function touch_updated_at();

drop trigger if exists pay_periods_touch on pay_periods;
create trigger pay_periods_touch before update on pay_periods
  for each row execute function touch_updated_at();

drop trigger if exists payslips_touch on payslips;
create trigger payslips_touch before update on payslips
  for each row execute function touch_updated_at();
