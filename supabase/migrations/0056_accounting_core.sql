-- ---------------------------------------------------------------------------
-- 0056 — Kirjanpidon tietomalli
-- ---------------------------------------------------------------------------
--
-- KIRJANPITO ON OMA TAPAHTUMADATANSA, EI NÄKYMÄ LÄHTEISIIN.
--
-- Kuitti ja myyntipäivä ovat operatiivista dataa: ne kertovat mitä
-- ravintolassa tapahtui. Kirjanpitotapahtuma kertoo miten se on
-- kirjattu. Nämä eivät ole sama asia eivätkä saa olla sama rivi.
--
-- Jos kirjanpito olisi vain näkymä kuitteihin, kuitin muokkaus
-- muuttaisi jo kirjattua tilikautta takautuvasti ja hiljaa. Siksi
-- kirjaus on oma rivinsä joka muistaa mistä se syntyi.
--
-- TASAPAINO ON KANNAN VASTUULLA.
--
-- Debet = kredit varmistetaan lykätyllä liipaisimella, ei
-- sovelluskoodissa. Sovelluksia on monta — palvelinfunktio, tuleva
-- tuonti, korjaustoiminto — ja jokainen niistä voisi unohtaa
-- tarkistuksen. Kanta ei unohda.
--
-- RAHA ON KOKONAISIA SENTTEJÄ.
--
-- Sama kuin muualla Budetissa. Liukuluku ei kelpaa: 0.1 + 0.2 ei ole
-- 0.3, ja kirjanpidossa se on virhe eikä pyöristys.

-- ---------------------------------------------------------------------------
-- Tyypit
-- ---------------------------------------------------------------------------

do $tyypit$
begin
  if not exists (select 1 from pg_type where typname = 'ledger_account_type') then
    create type ledger_account_type as enum (
      'revenue', 'expense', 'asset', 'liability', 'equity'
    );
  end if;

  -- Mistä kirjaus syntyi. 'manual' on käsin tehty, muut johdettu.
  if not exists (select 1 from pg_type where typname = 'ledger_source') then
    create type ledger_source as enum (
      'receipt', 'daily_sales', 'manual', 'correction'
    );
  end if;

  /*
   * Kirjauksen elinkaari.
   *
   * proposed = Budetin muodostama esitys jota ei ole hyväksytty.
   * posted   = kirjattu, muuttumaton; korjaus tehdään uudella rivillä.
   * rejected = esitys jota ei kirjata; jää näkyviin jottei sama
   *            lähde ehdota itseään uudelleen joka synkronoinnissa.
   */
  if not exists (select 1 from pg_type where typname = 'ledger_status') then
    create type ledger_status as enum (
      'proposed', 'posted', 'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'fiscal_year_status') then
    create type fiscal_year_status as enum ('open', 'closed');
  end if;
end
$tyypit$;

-- ---------------------------------------------------------------------------
-- Tilikaudet
-- ---------------------------------------------------------------------------
--
-- Tilikausi ei ole aina kalenterivuosi, joten alku ja loppu ovat
-- päivämääriä eikä vuosiluku. Päällekkäisyys estetään rajoitteella:
-- yksi päivä kuuluu tasan yhteen tilikauteen, muuten tositenumero ei
-- ole yksikäsitteinen.

create table if not exists fiscal_years (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  status        fiscal_year_status not null default 'open',
  closed_by     uuid references auth.users(id) on delete set null,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),

  constraint fiscal_year_jarjestys check (ends_on > starts_on)
);

create index if not exists fiscal_years_restaurant_idx
  on fiscal_years (restaurant_id, starts_on desc);

-- Päällekkäiset tilikaudet pois. btree_gist tarvitaan jotta uuid ja
-- daterange mahtuvat samaan rajoitteeseen.
create extension if not exists btree_gist;

do $paallekkain$
begin
  if not exists (select 1 from pg_constraint where conname = 'fiscal_years_ei_paallekkain') then
    alter table fiscal_years add constraint fiscal_years_ei_paallekkain
      exclude using gist (
        restaurant_id with =,
        daterange(starts_on, ends_on, '[]') with &&
      );
  end if;
end
$paallekkain$;

-- ---------------------------------------------------------------------------
-- Tilikartta
-- ---------------------------------------------------------------------------
--
-- Tilikartta on ravintolakohtainen. Yhteinen kartta olisi houkutteleva,
-- mutta silloin yksikin ravintolan lisäämä tili näkyisi kaikille.
--
-- vat_rate on tilin oletuskanta eikä totuus: kirjauksen rivi kantaa
-- oman kantansa, koska kanta voi muuttua kesken tilikauden ja vanhat
-- kirjaukset säilyttävät sen mikä oli voimassa.

create table if not exists ledger_accounts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  number        text not null,
  name          text not null,
  type          ledger_account_type not null,
  vat_rate      numeric(6,5),
  active        boolean not null default true,
  -- Järjestelmän luoma perustili. Estää poiston jalan alta.
  is_system     boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ledger_accounts_numero_muoto check (number ~ '^[0-9]{3,6}$'),
  unique (restaurant_id, number)
);

create index if not exists ledger_accounts_restaurant_idx
  on ledger_accounts (restaurant_id, number);

-- ---------------------------------------------------------------------------
-- Tositteet
-- ---------------------------------------------------------------------------
--
-- EI KAHTA KIRJAUSTA SAMASTA LÄHTEESTÄ.
--
-- Yksikäsitteisyys (restaurant_id, source_type, source_id) on koko
-- automaattisen synkronoinnin turva. Ilman sitä joka ajo tekisi uudet
-- rivit, ja kolmas ajo kolminkertaistaisi tilikauden. Rajoite on
-- kannassa eikä koodissa, koska koodi voi ajautua rinnakkain itsensä
-- kanssa.
--
-- Osittainen indeksi: käsin tehdyillä kirjauksilla ei ole lähdettä,
-- eivätkä ne siis saa törmätä toisiinsa.

create table if not exists ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  fiscal_year_id uuid not null references fiscal_years(id) on delete restrict,

  -- Tositenumero juoksee tilikauden sisällä.
  entry_number   integer not null,
  entry_date     date not null,
  description    text not null,

  source_type    ledger_source not null,
  source_id      uuid,

  status         ledger_status not null default 'proposed',

  -- Korjaus osoittaa alkuperäiseen. Alkuperäistä ei poisteta.
  corrects_id    uuid references ledger_entries(id) on delete restrict,
  correction_reason text,

  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  posted_by      uuid references auth.users(id) on delete set null,
  posted_at      timestamptz,

  unique (fiscal_year_id, entry_number)
);

create unique index if not exists ledger_entries_lahde_uniikki
  on ledger_entries (restaurant_id, source_type, source_id)
  where source_id is not null;

create index if not exists ledger_entries_kausi_idx
  on ledger_entries (restaurant_id, entry_date);
create index if not exists ledger_entries_tila_idx
  on ledger_entries (restaurant_id, status);

-- ---------------------------------------------------------------------------
-- Vientirivit
-- ---------------------------------------------------------------------------
--
-- Rivi on joko debet tai kredit, ei molempia eikä kumpaakaan.
-- Molemmat sallittuna sama rivi voisi kuitata itsensä ja tosite
-- näyttäisi tasapainoiselta olematta sitä.

create table if not exists ledger_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references ledger_entries(id) on delete cascade,
  line_number  integer not null,
  account_id   uuid not null references ledger_accounts(id) on delete restrict,

  debit_cents  integer not null default 0,
  credit_cents integer not null default 0,

  -- Rivin oma kanta ja vero. Tilin oletus on lähtökohta, tämä on totuus.
  vat_rate     numeric(6,5),
  vat_cents    integer,

  description  text,

  constraint ledger_lines_ei_negatiivinen
    check (debit_cents >= 0 and credit_cents >= 0),
  constraint ledger_lines_vain_toinen_puoli
    check ((debit_cents > 0) <> (credit_cents > 0)),

  unique (entry_id, line_number)
);

create index if not exists ledger_lines_entry_idx on ledger_lines (entry_id);
create index if not exists ledger_lines_account_idx on ledger_lines (account_id);

-- ---------------------------------------------------------------------------
-- Tilikohdistukset
-- ---------------------------------------------------------------------------
--
-- Mikä tili vastaa mitäkin lähdettä. Taulu eikä kovakoodattu taulukko,
-- koska tilikartta on ravintolakohtainen: yhden ruokaostot on 4000 ja
-- toisen 4100.
--
-- ref_id viittaa myyntiryhmään tai kulukategoriaan, ref_key on
-- avainsana kuten maksutapa. Kumpikin voi olla tyhjä: verotileillä
-- riittää laji.

create table if not exists ledger_mappings (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind          text not null,
  ref_id        uuid,
  ref_key       text,
  account_id    uuid not null references ledger_accounts(id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint ledger_mappings_laji check (kind in (
    'sales_group', 'expense_category', 'payment_method',
    'vat_sales', 'vat_purchases'
  ))
);

create unique index if not exists ledger_mappings_uniikki
  on ledger_mappings (
    restaurant_id, kind,
    coalesce(ref_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(ref_key, '')
  );

-- ---------------------------------------------------------------------------
-- Tasapaino
-- ---------------------------------------------------------------------------
--
-- Lykätty liipaisin: rivit lisätään yksi kerrallaan, joten tosite on
-- väistämättä epätasapainossa kesken lisäyksen. Tarkistus tehdään
-- vasta kun transaktio on valmis.
--
-- Tarkistetaan myös rivien määrä: yhden rivin tosite ei voi olla
-- tasapainossa muuten kuin nollasummana, ja nollasumman tosite on
-- virhe eikä kirjaus.

create or replace function ledger_tasapaino()
returns trigger
language plpgsql
as $tasapaino$
declare
  v_entry uuid;
  v_debit bigint;
  v_credit bigint;
  v_rivit integer;
  v_numero integer;
begin
  v_entry := coalesce(new.entry_id, old.entry_id);

  -- Tosite on voitu poistaa kokonaan; silloin ei ole mitään tarkistettavaa.
  if not exists (select 1 from ledger_entries where id = v_entry) then
    return null;
  end if;

  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*)
    into v_debit, v_credit, v_rivit
  from ledger_lines where entry_id = v_entry;

  select entry_number into v_numero from ledger_entries where id = v_entry;

  if v_rivit < 2 then
    raise exception 'Tosite % : kirjauksessa on oltava vähintään kaksi riviä (nyt %)',
      v_numero, v_rivit;
  end if;

  if v_debit <> v_credit then
    raise exception 'Tosite % ei täsmää: debet % senttiä, kredit % senttiä',
      v_numero, v_debit, v_credit;
  end if;

  return null;
end;
$tasapaino$;

drop trigger if exists ledger_tasapaino_trigger on ledger_lines;
create constraint trigger ledger_tasapaino_trigger
  after insert or update or delete on ledger_lines
  deferrable initially deferred
  for each row execute function ledger_tasapaino();

-- ---------------------------------------------------------------------------
-- Kirjattua ei muuteta
-- ---------------------------------------------------------------------------
--
-- Kun tosite on kirjattu, sen rivejä ei muokata eikä poisteta.
-- Korjaus on uusi tosite joka osoittaa alkuperäiseen. Tämä on
-- kirjanpidon perussääntö eikä käytäntökysymys, joten se on kannassa.

create or replace function ledger_kirjattu_lukossa()
returns trigger
language plpgsql
as $lukko$
declare
  v_status ledger_status;
begin
  select status into v_status
  from ledger_entries
  where id = coalesce(new.entry_id, old.entry_id);

  if v_status = 'posted' then
    raise exception 'Kirjattua tositetta ei muuteta. Tee korjaustosite.';
  end if;

  return coalesce(new, old);
end;
$lukko$;

drop trigger if exists ledger_lines_lukko on ledger_lines;
create trigger ledger_lines_lukko
  before insert or update or delete on ledger_lines
  for each row execute function ledger_kirjattu_lukossa();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Sama jako kuin muualla taloudessa: luku niille jotka näkevät
-- talouden, kirjoitus vuoropäälliköstä ylöspäin, tilikauden sulku
-- omistajalle.

alter table fiscal_years    enable row level security;
alter table ledger_accounts enable row level security;
alter table ledger_entries  enable row level security;
alter table ledger_lines    enable row level security;
alter table ledger_mappings enable row level security;

drop policy if exists fiscal_years_read on fiscal_years;
create policy fiscal_years_read on fiscal_years
  for select using (can_read_finance(restaurant_id));

drop policy if exists fiscal_years_write on fiscal_years;
create policy fiscal_years_write on fiscal_years
  for all using (is_owner(restaurant_id)) with check (is_owner(restaurant_id));

drop policy if exists ledger_accounts_read on ledger_accounts;
create policy ledger_accounts_read on ledger_accounts
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_accounts_write on ledger_accounts;
create policy ledger_accounts_write on ledger_accounts
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));

drop policy if exists ledger_entries_read on ledger_entries;
create policy ledger_entries_read on ledger_entries
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_entries_write on ledger_entries;
create policy ledger_entries_write on ledger_entries
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));

-- Rivit periytyvät tositteen oikeuksista: oma ravintolasarake olisi
-- toisto joka voi ajautua eri linjalle tositteen kanssa.
drop policy if exists ledger_lines_read on ledger_lines;
create policy ledger_lines_read on ledger_lines
  for select using (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and can_read_finance(e.restaurant_id)
  ));

drop policy if exists ledger_lines_write on ledger_lines;
create policy ledger_lines_write on ledger_lines
  for all using (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and is_manager(e.restaurant_id)
  )) with check (exists (
    select 1 from ledger_entries e
    where e.id = ledger_lines.entry_id and is_manager(e.restaurant_id)
  ));

drop policy if exists ledger_mappings_read on ledger_mappings;
create policy ledger_mappings_read on ledger_mappings
  for select using (can_read_finance(restaurant_id));

drop policy if exists ledger_mappings_write on ledger_mappings;
create policy ledger_mappings_write on ledger_mappings
  for all using (is_manager(restaurant_id)) with check (is_manager(restaurant_id));
