-- 0143 Myyntilaskut: vastaanottajat, laskut ja rivit
--
-- Kate on tahan asti katsonut vain sisaanpain: kuitit, kulut ja kassan
-- paivaraportit. Yritys joka laskuttaa toista yritysta on joutunut
-- tekemaan laskun jossain muualla ja kirjaamaan myynnin Kateen kasin —
-- sama luku kahdesti, ja jalkimmainen unohtuu.
--
-- KOLME TAULUA JA YKSI PERIAATE.
--
-- customers on vastaanottajarekisteri: kerran kirjoitettu asiakas
-- loytyy seuraavalla kerralla nimella. invoices on lasku, ja
-- invoice_rows sen rivit.
--
-- Periaate on se etta LASKU EI MUUTU ASIAKKAAN MUKANA. Vastaanottajan
-- nimi ja osoite kopioidaan laskulle sellaisena kuin ne olivat
-- laskutushetkella. Jos asiakas muuttaa ja rekisteri paivitetaan,
-- viime vuonna lahetetty lasku nayttaisi muuten osoitteen johon sita
-- ei koskaan lahetetty — ja lasku on tosite, ei nakyma rekisteriin.

-- ---------------------------------------------------------------------------
-- Myyjan omat tiedot
-- ---------------------------------------------------------------------------
--
-- Laskussa on oltava myyjan Y-tunnus ja tilinumero (ALV-laki 209 e §).
-- Y-tunnus on jo restaurants-taulussa; tilinumeroa ei ollut, koska
-- mitaan ei ole ennen pitanyt maksaa yritykselle pain.

alter table restaurants
  add column if not exists iban text
    check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  add column if not exists invoice_terms_days integer not null default 14
    check (invoice_terms_days between 0 and 365),
  add column if not exists invoice_note text
    check (invoice_note is null or length(invoice_note) <= 500);

comment on column restaurants.iban is
  'Myyjan tilinumero laskulle. Muoto tarkistetaan, tarkistusnumero sovelluksessa.';
comment on column restaurants.invoice_terms_days is
  'Maksuaika paivina, laskun oletus.';

-- ---------------------------------------------------------------------------
-- Vastaanottajat
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  /*
   * Y-tunnus on vapaaehtoinen.
   *
   * Yksityishenkilolle laskuttava parturi ei tarvitse sita, eika sita
   * saa vaatia. Muoto tarkistetaan vain jos se on annettu;
   * tarkistusnumero lasketaan sovelluksessa, koska virheesta pitaa
   * saada ymmarrettava lause eika kannan poikkeus.
   */
  business_id text check (business_id is null or business_id ~ '^[0-9]{7}-[0-9]$'),
  /* "Tarkenne", esim. c/o Sukunimi tai osasto. */
  care_of text check (care_of is null or length(care_of) <= 120),
  street text check (street is null or length(street) <= 160),
  postal_code text check (postal_code is null or length(postal_code) <= 12),
  city text check (city is null or length(city) <= 80),
  country char(2) not null default 'FI',
  /* Laskun lahetysta varten. YTJ ei anna sahkopostia, joten se kysytaan. */
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  note text check (note is null or length(note) <= 500),
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table customers is
  'Laskutuksen vastaanottajarekisteri yrityskohtaisesti.';

create index if not exists customers_restaurant_idx
  on customers (restaurant_id, name);

/*
 * Sama Y-tunnus vain kerran yritysta kohti.
 *
 * Kaksi riviä samalle asiakkaalle tarkoittaa kahta eri saatavaa
 * samasta asiakkaasta, eika kumpikaan kerro kokonaisuutta. Nimen
 * perusteella ei voi rajata: kaksi eri yritysta voi olla samanniminen.
 */
create unique index if not exists customers_business_id_uniq
  on customers (restaurant_id, business_id)
  where business_id is not null and archived_at is null;

create trigger touch_customers
  before update on customers
  for each row execute function touch_updated_at();

alter table customers enable row level security;

drop policy if exists customers_read on customers;
create policy customers_read on customers
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists customers_write on customers;
create policy customers_write on customers
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

-- ---------------------------------------------------------------------------
-- Laskut
-- ---------------------------------------------------------------------------

create type invoice_status as enum ('draft', 'sent', 'paid', 'cancelled');

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  /*
   * Viite rekisteriin sailyy, mutta lasku ei riipu siita.
   *
   * restrict eika cascade: asiakasta ei saa poistaa niin etta lasku
   * katoaa mukana. Rekisterista poistaminen on arkistointi.
   */
  customer_id uuid references customers(id) on delete restrict,

  /* Vastaanottaja sellaisena kuin han oli laskutushetkella. */
  recipient_name text not null check (length(trim(recipient_name)) between 1 and 200),
  recipient_business_id text,
  recipient_care_of text,
  recipient_street text,
  recipient_postal_code text,
  recipient_city text,
  recipient_country char(2) not null default 'FI',
  recipient_email text,

  /* Juokseva numero yritysta kohti, liipaisin antaa. */
  number integer not null,
  /* Suomalainen viitenumero, johdettu numerosta. */
  reference text not null,

  invoice_date date not null default current_date,
  due_date date not null,

  status invoice_status not null default 'draft',
  sent_at timestamptz,
  paid_at timestamptz,
  paid_cents integer check (paid_cents is null or paid_cents >= 0),

  /* Summat talletetaan: lasku on tosite eika laskentakaava. */
  net_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,

  note text check (note is null or length(note) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_due_after_date check (due_date >= invoice_date)
);

comment on table invoices is
  'Myyntilaskut. Vastaanottaja on kopio laskutushetkesta, ei viittaus rekisteriin.';

create unique index if not exists invoices_number_uniq
  on invoices (restaurant_id, number);
create index if not exists invoices_restaurant_idx
  on invoices (restaurant_id, invoice_date desc);
create index if not exists invoices_open_idx
  on invoices (restaurant_id, due_date)
  where status = 'sent';

create trigger touch_invoices
  before update on invoices
  for each row execute function touch_updated_at();

create table if not exists invoice_rows (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  line_number integer not null,
  description text not null check (length(trim(description)) between 1 and 200),
  quantity numeric(12,3) not null default 1 check (quantity <> 0),
  unit text check (unit is null or length(unit) <= 20),
  unit_price_cents integer not null,
  /*
   * ALV-kanta viittauksena eika lukuna.
   *
   * Prosentit muuttuvat lailla — yleinen kanta nousi 25,5:een ja
   * elintarvikekanta laski 13,5:een. Kovakoodattu luku olisi oikea
   * vain siihen asti kunnes se ei ole, ja silloin se olisi vaarin
   * hiljaa.
   */
  vat_code_id uuid not null references vat_codes(id),
  net_cents integer not null,
  vat_cents integer not null,
  total_cents integer not null
);

create index if not exists invoice_rows_invoice_idx
  on invoice_rows (invoice_id, line_number);

alter table invoices enable row level security;
alter table invoice_rows enable row level security;

drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists invoices_write on invoices;
create policy invoices_write on invoices
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop policy if exists invoice_rows_read on invoice_rows;
create policy invoice_rows_read on invoice_rows
  for select to authenticated
  using (
    exists (
      select 1 from invoices i
      where i.id = invoice_rows.invoice_id
        and i.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists invoice_rows_write on invoice_rows;
create policy invoice_rows_write on invoice_rows
  for all to authenticated
  using (
    exists (
      select 1 from invoices i
      where i.id = invoice_rows.invoice_id and is_manager(i.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from invoices i
      where i.id = invoice_rows.invoice_id and is_manager(i.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Viitenumero ja juokseva numerointi
-- ---------------------------------------------------------------------------

/**
 * Suomalainen viitenumero.
 *
 * Painot 7, 3, 1 oikealta vasemmalle, summa, ja tarkistusnumero on se
 * mika puuttuu seuraavaan kymmeneen. Vahintaan nelja merkkia, joten
 * perusosa taytetaan kolmeen numeroon.
 *
 * Viite eika vapaa viesti, koska pankki tunnistaa maksun siita
 * automaattisesti — ja juuri se tekee maksun kohdistamisesta
 * mahdollista ilman etta kukaan lukee tiliotetta rivi riviltä.
 */
create or replace function fi_reference(p_number bigint)
returns text
language plpgsql
immutable
as $$
declare
  v_teksti text;
  v_base text;
  v_sum integer := 0;
  v_paino integer[] := array[7, 3, 1];
  i integer;
  v_check integer;
begin
  if p_number is null or p_number < 0 then
    raise exception 'Viitenumeron perusosa puuttuu';
  end if;

  /*
   * Tayttö vain kun perusosa on lyhyempi kuin kolme.
   *
   * lpad(teksti, 3, '0') ei taytä kolmeen vaan LEIKKAA kolmeen, joten
   * suora lpad antoi laskuille 1234 ja 12345 saman viitteen 1232 —
   * kaksi eri laskua samalla viitteella kohdistaisi maksun vaaraan
   * laskuun.
   */
  v_teksti := p_number::text;
  v_base := case
    when length(v_teksti) < 3 then lpad(v_teksti, 3, '0')
    else v_teksti
  end;

  for i in 1..length(v_base) loop
    v_sum := v_sum
      + substr(v_base, length(v_base) - i + 1, 1)::integer
      * v_paino[((i - 1) % 3) + 1];
  end loop;

  v_check := (10 - (v_sum % 10)) % 10;
  return v_base || v_check::text;
end;
$$;

/**
 * Numero ja viite laskulle sen syntyessa.
 *
 * Numeroa ei anneta sovelluksesta: kaksi samanaikaista laskua saisi
 * saman numeron, ja laskunumeron on oltava aukoton ja ainutkertainen.
 * Neuvottelulukko yrityksen kohdalla riittaa — laskuja ei luoda
 * sekunnissa satoja.
 */
create or replace function invoice_number_assign()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text));

    select coalesce(max(number), 0) + 1
      into new.number
      from invoices
     where restaurant_id = new.restaurant_id;
  end if;

  if new.reference is null or new.reference = '' then
    new.reference := fi_reference(new.number);
  end if;

  return new;
end;
$$;

create trigger invoices_number
  before insert on invoices
  for each row execute function invoice_number_assign();

/**
 * Lahetettya laskua ei muuteta.
 *
 * Lasku on tosite siita hetkesta kun se lahti vastaanottajalle.
 * Summan tai vastaanottajan muuttaminen jalkikateen tekisi kahdesta
 * eri paperista saman laskun. Tilan saa yha vaihtaa — maksu ja
 * mitatointi ovat tapahtumia laskun elinkaaressa, eivat sen sisallon
 * muutoksia.
 */
create or replace function invoice_sent_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;

  if new.recipient_name is distinct from old.recipient_name
     or new.recipient_business_id is distinct from old.recipient_business_id
     or new.recipient_street is distinct from old.recipient_street
     or new.recipient_postal_code is distinct from old.recipient_postal_code
     or new.recipient_city is distinct from old.recipient_city
     or new.number is distinct from old.number
     or new.reference is distinct from old.reference
     or new.invoice_date is distinct from old.invoice_date
     or new.net_cents is distinct from old.net_cents
     or new.vat_cents is distinct from old.vat_cents
     or new.total_cents is distinct from old.total_cents then
    raise exception 'Lahetettya laskua ei muuteta. Mitatoi se ja tee uusi.';
  end if;

  return new;
end;
$$;

create trigger invoices_locked
  before update on invoices
  for each row execute function invoice_sent_locked();

/* Rivit lukkiutuvat laskun mukana. */
create or replace function invoice_rows_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_status invoice_status;
begin
  select status into v_status
    from invoices
   where id = coalesce(new.invoice_id, old.invoice_id);

  if v_status <> 'draft' then
    raise exception 'Lahetetyn laskun rivit ovat lukossa.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger invoice_rows_lukko
  before insert or update or delete on invoice_rows
  for each row execute function invoice_rows_locked();
