-- ---------------------------------------------------------------------------
-- 0080 — Verokortit, luontoisedut ja työsuhteen tiedot
-- ---------------------------------------------------------------------------
--
-- Verokortti on ainoa paikka josta ennakonpidätysprosentti tulee. Kate
-- ei laske sitä eikä arvaa sitä: Verohallinto laskee sen ja työntekijä
-- tuo sen. Tämän tiedoston tehtävä on ottaa se vastaan niin, ettei
-- kukaan voi myöhemmin kysyä "millä perusteella tästä pidätettiin
-- kaksikymmentä prosenttia" ilman että vastaus löytyy.
--
-- ---------------------------------------------------------------------------
-- VANHAA VEROKORTTIA EI KORVATA, SEN PÄÄLLE TULEE UUSI
-- ---------------------------------------------------------------------------
--
-- Työntekijällä on vuoden aikana usein kaksi tai kolme verokorttia:
-- tammikuun vanha, helmikuun uusi, ja kesällä muutosverokortti. Jos
-- uusi kirjoittaisi vanhan yli, kesäkuussa maksetun palkan perustetta
-- ei enää olisi olemassa.
--
-- Siksi verokortti on rivi jolla on voimassaoloväli, ja rivejä on niin
-- monta kuin kortteja on ollut. Päällekkäisyys estetään kannassa
-- exclude-rajoitteella eikä sovelluksessa: sovellustarkistus pätee
-- siihen polkuun jonka joku muisti tarkistaa.
--
-- ---------------------------------------------------------------------------
-- MAKSUPÄIVÄ VALITSEE KORTIN, EI TYÖPÄIVÄ
-- ---------------------------------------------------------------------------
--
-- Verohallinnon ohje on yksiselitteinen: sovellettava verokortti
-- määräytyy suorituksen maksupäivästä. Kesäkuussa tehty työ joka
-- maksetaan heinäkuussa kuuluu heinäkuun kortille.
--
-- Tämä on helppo tehdä väärin, koska työvuoro on se jota katsotaan.
-- Siksi hakufunktio ottaa parametrikseen maksupäivän ja sen nimi
-- sanoo sen ääneen.
--
-- ---------------------------------------------------------------------------
-- DOKUMENTTI MENEE TIEDOSTOKAAPPIIN, EI OMAAN SÄILÖÖNSÄ
-- ---------------------------------------------------------------------------
--
-- Katessa on jo yksityinen tiedostokaappi käytäntöineen, käyttö-
-- oikeuksineen ja välityspalvelimineen. Toinen säilö verokorteille
-- olisi toinen paikka jossa yksityisyys pitäisi muistaa toteuttaa
-- oikein.
--
-- Verokortin dokumentti on siis tavallinen files-rivi, ja verokortti
-- viittaa siihen. Pelkkä PDF kansiossa ei kuitenkaan riitä
-- palkanlaskentaan: prosentit luetaan aina tältä riviltä.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Verokortti
-- ---------------------------------------------------------------------------

do $$ begin
  create type tax_card_source as enum ('manual', 'document');
exception when duplicate_object then null; end $$;

create table if not exists tax_cards (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  /**
   * Perusprosentti: pidätys tulorajaan asti.
   *
   * numeric eikä integer, koska verokortissa lukee 17,5 eikä 17.
   */
  base_percent numeric(5, 2) not null,

  /** Lisäprosentti: pidätys tulorajan ylittävältä osalta. */
  additional_percent numeric(5, 2) not null,

  /** Vuositulorajа sentteinä. */
  income_limit_cents bigint not null,

  /**
   * Ennen Katea kertynyt tulo samalle kortille.
   *
   * Ravintola ottaa Katen käyttöön kesken vuoden, ja tuloraja on
   * koko vuoden raja. Ilman tätä kenttää tammi-toukokuun palkat
   * olisivat rajan kannalta olemattomia ja lisäprosentti jäisi
   * perimättä.
   */
  prior_income_cents bigint not null default 0,

  valid_from date not null,

  /** Null = toistaiseksi. Käytännössä vuoden loppu. */
  valid_to date,

  /** Verokortin kuva tai PDF tiedostokaapissa. */
  file_id uuid references files(id) on delete set null,

  /**
   * Mistä arvot tulivat.
   *
   * 'document' tarkoittaa että ne luettiin dokumentista ja käyttäjä
   * hyväksyi ne. Ei sitä että kone päätti — hyväksyntä on aina
   * ihmisen.
   */
  source tax_card_source not null default 'manual',

  note text not null default '',

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_cards_percentages check (
    base_percent >= 0 and base_percent <= 100
    and additional_percent >= 0 and additional_percent <= 100
  ),
  constraint tax_cards_limit check (income_limit_cents >= 0),
  constraint tax_cards_prior check (prior_income_cents >= 0),
  constraint tax_cards_validity check (valid_to is null or valid_to >= valid_from),

  /*
   * Kaksi voimassa olevaa korttia samalle päivälle on mahdoton
   * tilanne: laskenta joutuisi valitsemaan, eikä sillä ole perustetta
   * valita.
   *
   * Rajoite kannassa eikä tarkistus sovelluksessa. Sovellustarkistus
   * pätee siihen kirjoituspolkuun jonka joku muisti tarkistaa, ja
   * niitä on aina enemmän kuin muistetaan.
   */
  constraint tax_cards_no_overlap exclude using gist (
    restaurant_id with =,
    user_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index if not exists tax_cards_lookup
  on tax_cards (restaurant_id, user_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- 2. Luontoisedut
-- ---------------------------------------------------------------------------
--
-- Luontoisetu on veronalaista palkkaa jota ei makseta rahana. Se
-- kasvattaa ennakonpidätyksen ja vakuutusmaksujen perustetta mutta ei
-- nettopalkkaa — ja juuri siksi se on helppo laskea väärin.
--
-- Arvo tallennetaan riville eikä lueta vuositaulukosta laskentahetkellä.
-- Taulukkoarvo on lähtökohta jonka käyttöliittymä tarjoaa; rivillä on
-- se mitä tälle työntekijälle sovittiin.

create table if not exists employee_benefits (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  kind benefit_kind not null,

  /** Verotusarvo kuukaudessa sentteinä. */
  monthly_value_cents integer not null,

  /** Vapaa nimi kun laji on 'other'. */
  label text not null default '',

  valid_from date not null,
  valid_to date,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employee_benefits_value check (monthly_value_cents >= 0),
  constraint employee_benefits_validity check (valid_to is null or valid_to >= valid_from),

  /*
   * Sama etu kahteen kertaan samalle ajalle olisi kaksinkertainen
   * verotusarvo. Eri lajit saavat olla päällekkäin: puhelinetu ja
   * ravintoetu ovat molemmat tavallisia yhtä aikaa.
   */
  constraint employee_benefits_no_overlap exclude using gist (
    restaurant_id with =,
    user_id with =,
    kind with =,
    label with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);

create index if not exists employee_benefits_lookup
  on employee_benefits (restaurant_id, user_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- 3. Työsuhteen tiedot
-- ---------------------------------------------------------------------------
--
-- Nämä kuuluvat jäsenyyteen eivätkä uuteen tauluun: jäsenyys on jo se
-- rivi joka kertoo että tämä ihminen työskentelee tässä ravintolassa.
-- Erillinen taulu olisi toinen paikka jossa sama tieto asuu.
--
-- Syntymäaika on täällä eikä profiilissa. Profiili on yhteinen
-- kaikille ravintoloille joissa ihminen on töissä, ja syntymäaika on
-- palkanlaskennan tietoa: se ratkaisee vakuuttamisvelvollisuuden
-- ikärajat. Jäsenyydessä se on ravintolakohtainen ja rivikäytäntöjen
-- suojaama.

alter table memberships
  add column if not exists employment_starts_on date;

alter table memberships
  add column if not exists employment_ends_on date;

alter table memberships
  add column if not exists birth_date date;

alter table memberships
  drop constraint if exists memberships_employment_range;

alter table memberships
  add constraint memberships_employment_range check (
    employment_ends_on is null
    or employment_starts_on is null
    or employment_ends_on >= employment_starts_on
  );

/*
 * Uudet sarakkeet eivät päädy rajapintaan.
 *
 * 0028 poisti taulutason lukuoikeuden ja antoi sen takaisin sarake
 * kerrallaan. Syntymäaika ja työsuhteen päivät jäävät listan
 * ulkopuolelle, joten PostgREST ei tarjoile niitä kenellekään.
 * Esihenkilö lukee ne funktion kautta, työntekijä omansa.
 */

-- ---------------------------------------------------------------------------
-- 4. Rivitason käytännöt
-- ---------------------------------------------------------------------------
--
-- Verokortti on arkaluonteista henkilötietoa. Työntekijä näkee omansa
-- — hänellä on oikeus tarkistaa millä perusteella hänen palkastaan
-- pidätetään. Muiden kortteja hän ei näe.
--
-- Kirjanpitäjä ei näe verokortteja lainkaan. Hän tarvitsee
-- palkkasummat kirjanpitoon, ei yksittäisen ihmisen veroprosenttia.

alter table tax_cards enable row level security;
alter table employee_benefits enable row level security;

drop policy if exists tax_cards_read on tax_cards;
create policy tax_cards_read on tax_cards
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists tax_cards_write on tax_cards;
create policy tax_cards_write on tax_cards
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists employee_benefits_read on employee_benefits;
create policy employee_benefits_read on employee_benefits
  for select to authenticated
  using (user_id = auth.uid() or is_manager(restaurant_id));

drop policy if exists employee_benefits_write on employee_benefits;
create policy employee_benefits_write on employee_benefits
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- ---------------------------------------------------------------------------
-- 5. Maksupäivän mukainen verokortti
-- ---------------------------------------------------------------------------
--
-- Funktion nimi sanoo mitä parametri on. `tax_card_for(user, date)`
-- olisi kutsuttu jonain päivänä työvuoron päivämäärällä, ja tulos
-- olisi ollut väärä ilman että mikään kaatuu.

create or replace function tax_card_on_pay_date(
  p_restaurant uuid,
  p_user uuid,
  p_pay_date date
)
returns tax_cards
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from tax_cards c
  where c.restaurant_id = p_restaurant
    and c.user_id = p_user
    and c.valid_from <= p_pay_date
    and (c.valid_to is null or c.valid_to >= p_pay_date)
    and (c.user_id = auth.uid() or is_manager(c.restaurant_id))
  order by c.valid_from desc
  limit 1;
$$;

revoke all on function tax_card_on_pay_date(uuid, uuid, date) from public, anon;
grant execute on function tax_card_on_pay_date(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Työntekijän palkkaperustiedot
-- ---------------------------------------------------------------------------
--
-- Yksi funktio joka kokoaa sen mitä palkanlaskenta tarvitsee
-- jäsenyydestä. Esihenkilö saa kaikki, työntekijä omansa, muut eivät
-- mitään.

create or replace function employee_payroll_info(p_restaurant uuid)
returns table (
  user_id uuid,
  pay_type pay_type,
  hourly_rate_cents integer,
  monthly_salary_cents integer,
  employment_starts_on date,
  employment_ends_on date,
  birth_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.pay_type,
    m.hourly_rate_cents,
    m.monthly_salary_cents,
    m.employment_starts_on,
    m.employment_ends_on,
    m.birth_date
  from memberships m
  where m.restaurant_id = p_restaurant
    and (is_manager(p_restaurant) or m.user_id = auth.uid())
    and m.restaurant_id in (select my_restaurant_ids());
$$;

revoke all on function employee_payroll_info(uuid) from public, anon;
grant execute on function employee_payroll_info(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Työsuhteen tietojen tallennus
-- ---------------------------------------------------------------------------
--
-- Sarakkeisiin ei ole kirjoitusoikeutta rajapinnan kautta, joten
-- tallennus kulkee funktion läpi. Funktio on samalla se paikka jossa
-- tarkistukset tehdään kerran.

create or replace function save_employment_details(
  p_restaurant uuid,
  p_user uuid,
  p_starts_on date,
  p_ends_on date,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then
    raise exception 'Tyosuhteen paattymispaiva ei voi olla ennen alkupaivaa.'
      using errcode = 'check_violation';
  end if;

  /*
   * Syntymäaika tulevaisuudessa tai 1900-luvun alussa on
   * näppäilyvirhe. Ikäraja vaikuttaa vakuutusmaksuihin, joten virhe
   * näkyisi palkassa eikä lomakkeella.
   */
  if p_birth_date is not null
     and (p_birth_date > current_date or p_birth_date < date '1920-01-01') then
    raise exception 'Syntymaaika ei ole uskottava.' using errcode = 'check_violation';
  end if;

  update memberships
  set employment_starts_on = p_starts_on,
      employment_ends_on = p_ends_on,
      birth_date = p_birth_date
  where restaurant_id = p_restaurant and user_id = p_user;

  if not found then
    raise exception 'Tyontekijaa ei loytynyt.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function save_employment_details(uuid, uuid, date, date, date) from public, anon;
grant execute on function save_employment_details(uuid, uuid, date, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Toimintaloki
-- ---------------------------------------------------------------------------
--
-- Lokiin kirjataan että verokortti lisättiin, muuttui tai poistettiin,
-- ja mitä kenttiä muutos koski. Prosentteja ja tulorajaa ei kirjata:
-- ne ovat juuri sitä arkaluonteista sisältöä jonka takia verokortti on
-- suojattu, eikä loki saa olla kiertotie sen lukemiseen.
--
-- Muuttuneiden kenttien nimet riittävät siihen mihin lokia käytetään:
-- kuka muutti veroprosenttia ja milloin. Arvon näkee kortilta, jos on
-- oikeus nähdä.

create or replace function audit_tax_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tax_cards := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
  v_period text := to_char(v_row.valid_from, 'DD.MM.YYYY') || '–' ||
    coalesce(to_char(v_row.valid_to, 'DD.MM.YYYY'), 'toistaiseksi');
  v_changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'tax_card', v_row.id, v_name,
      v_name || ': verokortti lisättiin (' || v_period || ').',
      null, null, true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'tax_card', v_row.id, v_name,
      v_name || ': verokortti poistettiin (' || v_period || ').',
      null, null, true
    );
    return old;
  end if;

  if new.base_percent is distinct from old.base_percent then
    v_changed := v_changed || 'veroprosentti';
  end if;
  if new.additional_percent is distinct from old.additional_percent then
    v_changed := v_changed || 'lisäprosentti';
  end if;
  if new.income_limit_cents is distinct from old.income_limit_cents then
    v_changed := v_changed || 'tuloraja';
  end if;
  if new.prior_income_cents is distinct from old.prior_income_cents then
    v_changed := v_changed || 'aiempi tulo';
  end if;
  if new.valid_from is distinct from old.valid_from
     or new.valid_to is distinct from old.valid_to then
    v_changed := v_changed || 'voimassaolo';
  end if;
  if new.file_id is distinct from old.file_id then
    v_changed := v_changed || 'dokumentti';
  end if;

  if array_length(v_changed, 1) is null then
    return new;
  end if;

  perform write_audit(
    v_row.restaurant_id, 'updated', 'tax_card', v_row.id, v_name,
    v_name || ': verokorttia muutettiin (' || v_period || '). Muuttuneet: ' ||
      array_to_string(v_changed, ', ') || '.',
    null, null, true
  );

  return new;
end;
$$;

revoke all on function audit_tax_cards() from public, anon, authenticated;

drop trigger if exists tax_cards_audit on tax_cards;
create trigger tax_cards_audit
  after insert or update or delete on tax_cards
  for each row execute function audit_tax_cards();

/*
 * Luontoisedun arvo kirjataan lokiin.
 *
 * Toisin kuin veroprosentti, luontoisetu on työsuhteen ehto eikä
 * Verohallinnon päätös työntekijän henkilökohtaisesta verotuksesta.
 * Sen muuttuminen on juuri se asia jonka takia lokia luetaan.
 */
create or replace function audit_employee_benefits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row employee_benefits := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
  v_label text := coalesce(nullif(v_row.label, ''), v_row.kind::text);
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' lisättiin (' ||
        audit_euros(v_row.monthly_value_cents) || '/kk).',
      null,
      jsonb_build_object('kind', v_row.kind, 'value_cents', v_row.monthly_value_cents),
      true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' poistettiin.',
      jsonb_build_object('kind', v_row.kind, 'value_cents', v_row.monthly_value_cents),
      null, true
    );
    return old;
  end if;

  if new.monthly_value_cents is distinct from old.monthly_value_cents
     or new.valid_from is distinct from old.valid_from
     or new.valid_to is distinct from old.valid_to then
    perform write_audit(
      v_row.restaurant_id, 'updated', 'employee_benefit', v_row.id, v_name,
      v_name || ': luontoisetu ' || v_label || ' muuttui ' ||
        audit_euros(old.monthly_value_cents) || ' → ' ||
        audit_euros(new.monthly_value_cents) || '/kk.',
      jsonb_build_object('value_cents', old.monthly_value_cents),
      jsonb_build_object('value_cents', new.monthly_value_cents),
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function audit_employee_benefits() from public, anon, authenticated;

drop trigger if exists employee_benefits_audit on employee_benefits;
create trigger employee_benefits_audit
  after insert or update or delete on employee_benefits
  for each row execute function audit_employee_benefits();

drop trigger if exists tax_cards_touch on tax_cards;
create trigger tax_cards_touch before update on tax_cards
  for each row execute function touch_updated_at();

drop trigger if exists employee_benefits_touch on employee_benefits;
create trigger employee_benefits_touch before update on employee_benefits
  for each row execute function touch_updated_at();
