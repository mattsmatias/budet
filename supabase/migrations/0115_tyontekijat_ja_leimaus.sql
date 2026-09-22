-- ---------------------------------------------------------------------------
-- 0115 — Tyontekijat ja tyoajan leimaus
-- ---------------------------------------------------------------------------
--
-- Kate seuraa toteutuneet tyotunnit ja laskee niista arvioidun
-- palkkakulun. Tama ei ole palkanlaskentaa: TES-lisat, sairausajan
-- palkka, lomakorvaukset ja tyonantajan sivukulut jaavat
-- palkkapalveluun, jossa ne kuuluvatkin.
--
-- ARVIO EI OLE PALKKA.
--
-- Tunnit kertaa tuntipalkka on arvio siita mita tyo maksoi. Se kertoo
-- suuruusluokan ja suunnan, ja se on kaytettavissa heti kuun aikana —
-- toisin kuin palkkalaskelma, joka tulee jalkikateen. Kirjanpitoon
-- menee edelleen se mika palkkapalvelusta tulee.

-- ---------------------------------------------------------------------------
-- 1. Tyontekijat
-- ---------------------------------------------------------------------------
--
-- Tyontekija on yrityksen tieto eika kayttajatili. Tili liitetaan
-- siihen vasta jos ja kun tyontekija kirjautuu: leimaus vaatii tilin,
-- mutta tuntien kirjaaminen ei vaadi etta tili on olemassa ensin.

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),

  /** Yhteystieto ja liitos tunnukseen: tili loytyy sahkopostilla. */
  email text,

  /** Tehtava yrityksessa, esimerkiksi kokki tai tarjoilija. */
  job_title text,

  /*
   * Tuntipalkka sentteina.
   *
   * Sentit eika desimaalit, kuten kaikki muutkin rahat tassa
   * jarjestelmassa. Liukuluku 14.50 ei ole 14,50 euroa.
   */
  hourly_cents integer not null default 0
    check (hourly_cents >= 0 and hourly_cents <= 100000),

  active boolean not null default true,

  /** Liitetty kayttajatili, tai null jos tyontekija ei viela kirjaudu. */
  user_id uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_restaurant_idx
  on employees (restaurant_id, active);

-- Yksi tili voi olla vain yksi tyontekija samassa yrityksessa.
create unique index if not exists employees_user_unique
  on employees (restaurant_id, user_id) where user_id is not null;

alter table employees enable row level security;

/*
 * Palkka on omistajan ja asianomaisen tieto.
 *
 * Tyontekija nakee oman rivinsa — myos oman tuntipalkkansa, joka on
 * hanen omansa. Toisen tyontekijan riviin ei ole asiaa, joten lukua ei
 * rajata vain sarakkeittain vaan koko rivi on suljettu.
 */
drop policy if exists employees_read on employees;
create policy employees_read on employees
  for select to authenticated
  using (is_owner(restaurant_id) or user_id = auth.uid());

drop policy if exists employees_write on employees;
create policy employees_write on employees
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- 2. Leimaukset
-- ---------------------------------------------------------------------------

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,

  /*
   * Vuoron paiva yrityksen aikavyohykkeella.
   *
   * Palvelin kay UTC:ssa. Ilman tata kello 23 alkanut vuoro kuuluisi
   * seuraavalle paivalle ja kuun viimeinen ilta seuraavalle
   * kuukaudelle.
   */
  work_date date not null,

  clock_in timestamptz not null default now(),
  clock_out timestamptz,

  /** Kesto minuutteina. Null kun vuoro on kesken. */
  minutes integer check (minutes is null or minutes >= 0),

  created_at timestamptz not null default now(),

  check (clock_out is null or clock_out >= clock_in)
);

create index if not exists time_entries_employee_idx
  on time_entries (employee_id, work_date desc);

create index if not exists time_entries_restaurant_idx
  on time_entries (restaurant_id, work_date desc);

/*
 * Yksi kesken oleva vuoro kerrallaan.
 *
 * Sovellus estaa toisen aloittamisen, mutta kaksi napautusta samaan
 * aikaan kahdelta laitteelta ohittaisi sovelluksen tarkistuksen.
 * Ehdollinen indeksi ei ohita.
 */
create unique index if not exists time_entries_one_open
  on time_entries (employee_id) where clock_out is null;

alter table time_entries enable row level security;

drop policy if exists time_entries_read on time_entries;
create policy time_entries_read on time_entries
  for select to authenticated
  using (
    is_owner(restaurant_id)
    or employee_id in (select id from employees where user_id = auth.uid())
  );

-- Kirjoitus vain omistajalle. Tyontekijan leimaus kulkee
-- clock_in- ja clock_out-funktioiden kautta, jotka tarkistavat
-- tekijan itse eivatka luota mihinkaan clientilta tulevaan.
drop policy if exists time_entries_write on time_entries;
create policy time_entries_write on time_entries
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

-- ---------------------------------------------------------------------------
-- 3. Kuka mina olen tassa yrityksessa
-- ---------------------------------------------------------------------------
--
-- Tyontekijarivi luodaan ennen kuin tili on olemassa, joten liitos
-- tehdaan sahkopostilla ensimmaisella kerralla. Sen jalkeen tunniste
-- ratkaisee, eika sahkopostin vaihtaminen irrota leimauksia.

create or replace function employee_for_me(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
  v_email text;
begin
  select id into v_id
  from employees
  where restaurant_id = p_restaurant
    and user_id = auth.uid()
    and active;

  if v_id is not null then
    return v_id;
  end if;

  select lower(trim(email)) into v_email from auth.users where id = auth.uid();
  if v_email is null or v_email = '' then
    return null;
  end if;

  select id into v_id
  from employees
  where restaurant_id = p_restaurant
    and user_id is null
    and active
    and lower(trim(email)) = v_email
  limit 1;

  if v_id is not null then
    update employees set user_id = auth.uid(), updated_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$function$;

revoke all on function employee_for_me from public;
grant execute on function employee_for_me to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Leimaus
-- ---------------------------------------------------------------------------

create or replace function clock_in(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_employee uuid;
  v_zone text;
  v_id uuid;
begin
  -- Jasenyys tarkistetaan ennen kaikkea muuta: ilman sita yritys ei ole
  -- kutsujan, ja tunniste tulee clientilta.
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei paasya taman yrityksen tietoihin.'
      using errcode = '42501';
  end if;

  v_employee := employee_for_me(p_restaurant);
  if v_employee is null then
    raise exception 'Sinua ei ole lisatty taman yrityksen tyontekijaksi.'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from time_entries
    where employee_id = v_employee and clock_out is null
  ) then
    raise exception 'Vuoro on jo kaynnissa.' using errcode = '23505';
  end if;

  select timezone into v_zone from restaurants where id = p_restaurant;

  insert into time_entries (restaurant_id, employee_id, work_date, clock_in)
  values (
    p_restaurant,
    v_employee,
    (now() at time zone coalesce(v_zone, 'Europe/Helsinki'))::date,
    now()
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function clock_in from public;
grant execute on function clock_in to authenticated;

create or replace function clock_out(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_employee uuid;
  v_id uuid;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei paasya taman yrityksen tietoihin.'
      using errcode = '42501';
  end if;

  v_employee := employee_for_me(p_restaurant);
  if v_employee is null then
    raise exception 'Sinua ei ole lisatty taman yrityksen tyontekijaksi.'
      using errcode = '42501';
  end if;

  update time_entries
  set clock_out = now(),
      /*
       * Minuutit talteen lopetushetkella.
       *
       * Kesto voitaisiin laskea joka kyselyssa, mutta silloin
       * jalkikateen korjattu kellonaika muuttaisi jo raportoituja
       * tunteja huomaamatta. Tallennettu luku on se mika nahtiin.
       */
      minutes = greatest(0, round(extract(epoch from (now() - clock_in)) / 60))
  where employee_id = v_employee and clock_out is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Kaynnissa olevaa vuoroa ei ole.' using errcode = 'P0002';
  end if;

  return v_id;
end;
$function$;

revoke all on function clock_out from public;
grant execute on function clock_out to authenticated;
