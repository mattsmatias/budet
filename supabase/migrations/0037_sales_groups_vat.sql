-- ---------------------------------------------------------------------------
-- 0037 — Myyntiryhmät, verokannat ja kassaryhmien kohdistus
-- ---------------------------------------------------------------------------
--
-- Päivän myynti on ollut yksi luku ja yksi ALV-summa. Kassan
-- päiväraportti ei ole: siinä myynti on jaettu ryhmiin ja jokaisella
-- ryhmällä on oma verokantansa. Ilman samaa jakoa Budet ei voi
-- täsmäytyä raporttiin — se voi vain todeta että loppusumma on sama
-- tai eri, eikä kertoa mistä ero syntyy.
--
-- YKSI YLEINEN "RAVINTOLAN ALV %" EI RIITÄ
--
-- Ravintolassa on samana päivänä kaksi tai kolme kantaa: ruoka,
-- alkoholi ja mahdollinen nollakanta. Yksi kenttä pakottaisi
-- keskiarvoon, joka ei ole mikään verokanta.
--
-- HISTORIALLINEN KANTA SÄILYY TAPAHTUMASSA
--
-- Verokanta muuttuu lainsäädännöllä. Jos rivi viittaisi vain
-- ryhmään, ryhmän kannan muuttaminen kirjoittaisi menneisyyden
-- uudelleen: viime vuoden raportti näyttäisi eri luvut kuin silloin
-- kun se lähetettiin kirjanpitoon.
--
-- Siksi jokainen myyntirivi tallentaa käytetyn kannan lukuna. Ryhmän
-- asetus kertoo mitä kantaa UUSI rivi käyttää; vanha rivi kantaa
-- omansa mukanaan eikä muutu koskaan.

-- ---------------------------------------------------------------------------
-- 1. Myyntiryhmät
-- ---------------------------------------------------------------------------

create table if not exists sales_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  name text not null check (length(trim(name)) > 0),

  /*
   * Verokanta osuutena: 0.14000 = 14 %.
   *
   * numeric eikä float. Liukuluku ei esitä 0,255:tä tarkasti, ja
   * verolaskennan on oltava toistettavissa bitilleen samana.
   *
   * Viisi desimaalia riittää: 25,5 % on 0.25500 ja hienojakoisempaa
   * kantaa ei ole olemassa.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate <= 1),

  /* Pois käytöstä otettu ryhmä ei katoa: vanhat rivit viittaavat siihen. */
  active boolean not null default true,

  /*
   * Oletusryhmä.
   *
   * Kassaraportin ryhmä jota ei ole kohdistettu päätyy tänne, jottei
   * myynti katoa kohdistamattomuuden takia. Osittainen kirjaus on
   * pahempi kuin kohdistamaton: loppusumma ei enää täsmää.
   */
  is_default boolean not null default false,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, name)
);

/*
 * Yksi oletus per ravintola.
 *
 * Osittainen indeksi eikä check-ehto: ehto näkee vain oman rivinsä,
 * eikä voi tietää onko toinen oletus jo olemassa.
 */
create unique index if not exists sales_groups_one_default
  on sales_groups (restaurant_id)
  where is_default;

create index if not exists sales_groups_lookup
  on sales_groups (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. Kassajärjestelmän ryhmien kohdistus
-- ---------------------------------------------------------------------------
--
-- Kassa tuntee omat nimensä: "Ruoka", "Viini", "Olut", "Take away".
-- Budet tuntee myyntiryhmät. Kohdistus on ravintolakohtainen, koska
-- kaksi ravintolaa nimeää samat asiat eri tavoin.

create table if not exists pos_sales_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /* Nimi sellaisena kuin se lukee kassan raportissa. */
  pos_name text not null check (length(trim(pos_name)) > 0),

  sales_group_id uuid not null references sales_groups (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /*
   * Sama kassaryhmä voi osoittaa vain yhteen myyntiryhmään.
   *
   * Kaksi kohdistusta samalle nimelle tarkoittaisi että myynnin
   * verokanta riippuu siitä kumman kysely löytää ensin.
   */
  unique (restaurant_id, pos_name)
);

-- ---------------------------------------------------------------------------
-- 3. Päivän myynti ryhmittäin
-- ---------------------------------------------------------------------------
--
-- daily_sales pysyy päivän yhteenvetona. Rivit kertovat mistä se
-- koostuu, ja vain rivit mahdollistavat täsmäytyksen kannoittain.

create table if not exists daily_sales_lines (
  id uuid primary key default gen_random_uuid(),

  daily_sales_id uuid not null references daily_sales (id) on delete cascade,
  sales_group_id uuid not null references sales_groups (id) on delete restrict,

  /*
   * Kannan luku tapahtumahetkellä.
   *
   * Tämä on rivin totuus. Ryhmän nykyinen kanta on vain oletus uusille
   * riveille — vanhan rivin verokanta ei muutu ryhmää muokkaamalla.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate <= 1),

  /*
   * Brutto on syöte, muut johdettuja.
   *
   * Kassaraportti antaa ryhmän myynnin verollisena. Vero ja veroton
   * lasketaan siitä keskitetyllä pyöristyssäännöllä ja tallennetaan,
   * jottei raportti laske niitä joka kerta uudelleen mahdollisesti
   * eri tavalla.
   */
  gross_cents integer not null check (gross_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  net_cents integer not null check (net_cents >= 0),

  /* Kassan oma ryhmänimi sellaisena kuin se raportissa luki. */
  pos_name text,

  created_at timestamptz not null default now(),

  /* Yksi rivi per ryhmä per päivä. Kaksi tarkoittaisi kahta totuutta. */
  unique (daily_sales_id, sales_group_id),

  constraint daily_sales_lines_sum check (gross_cents = vat_cents + net_cents)
);

create index if not exists daily_sales_lines_lookup
  on daily_sales_lines (daily_sales_id);

-- ---------------------------------------------------------------------------
-- 4. Kassan ilmoittamat luvut täsmäytystä varten
-- ---------------------------------------------------------------------------
--
-- Täsmäytys vertaa kahta lukua: mitä kassa sanoo ja mitä Budetin rivit
-- laskevat. Kassan luku on säilytettävä sellaisenaan — jos se
-- korvattaisiin laskennalla, vertailu vertaisi lukua itseensä ja
-- täsmäisi aina.

alter table daily_sales
  add column if not exists pos_gross_cents integer;

alter table daily_sales
  add column if not exists pos_vat_cents integer;

alter table daily_sales drop constraint if exists daily_sales_pos_positive;
alter table daily_sales add constraint daily_sales_pos_positive check (
  (pos_gross_cents is null or pos_gross_cents >= 0)
  and (pos_vat_cents is null or pos_vat_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- 5. Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Verokannat ovat liiketoiminta-asetuksia: sama rajaus kuin muullakin
-- taloustiedolla. Lukeminen talousoikeudella, muuttaminen omistajalla.
-- Myyntirivit seuraavat daily_salesin sääntöä.

alter table sales_groups enable row level security;
alter table pos_sales_groups enable row level security;
alter table daily_sales_lines enable row level security;

drop policy if exists sales_groups_read on sales_groups;
create policy sales_groups_read on sales_groups
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists sales_groups_write on sales_groups;
create policy sales_groups_write on sales_groups
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

drop policy if exists pos_sales_groups_read on pos_sales_groups;
create policy pos_sales_groups_read on pos_sales_groups
  for select to authenticated
  using (can_read_finance(restaurant_id));

drop policy if exists pos_sales_groups_write on pos_sales_groups;
create policy pos_sales_groups_write on pos_sales_groups
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

/*
 * Rivin oikeus tulee päivästä johon se kuuluu.
 *
 * Rivillä ei ole omaa restaurant_id:tä: kaksi lähdettä samalle
 * totuudelle ajautuisi erilleen, ja väärin päivitetty rivi näkyisi
 * väärälle ravintolalle.
 */
drop policy if exists daily_sales_lines_read on daily_sales_lines;
create policy daily_sales_lines_read on daily_sales_lines
  for select to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and can_read_finance(d.restaurant_id)
    )
  );

drop policy if exists daily_sales_lines_write on daily_sales_lines;
create policy daily_sales_lines_write on daily_sales_lines
  for all to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and is_manager(d.restaurant_id)
    )
  );

drop trigger if exists sales_groups_touch on sales_groups;
create trigger sales_groups_touch before update on sales_groups
  for each row execute function touch_updated_at();

drop trigger if exists pos_sales_groups_touch on pos_sales_groups;
create trigger pos_sales_groups_touch before update on pos_sales_groups
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Kassan ilmoittama ALV rivillä
-- ---------------------------------------------------------------------------
--
-- Täsmäytys vertaa kannoittain: mitä kassa sanoi tästä kannasta ja
-- mitä Budet laskee samasta bruttosummasta. Ilman kassan omaa lukua
-- vertailu vertaisi laskentaa itseensä ja täsmäisi aina.
--
-- Vapaaehtoinen, koska kaikki raportit eivät erittele ALV:tä
-- kannoittain — silloin täsmäytys tehdään vain loppusummasta.

alter table daily_sales_lines add column if not exists pos_vat_cents integer;

alter table daily_sales_lines drop constraint if exists daily_sales_lines_pos_vat_positive;
alter table daily_sales_lines add constraint daily_sales_lines_pos_vat_positive
  check (pos_vat_cents is null or pos_vat_cents >= 0);
