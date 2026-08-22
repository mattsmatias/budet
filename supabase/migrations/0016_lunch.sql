-- ---------------------------------------------------------------------------
-- 0015 — Lounas
-- ---------------------------------------------------------------------------
--
-- Viikon lounaslista: suunnittele, muokkaa, esikatsele, julkaise, jaa.
--
-- Kolme ratkaisua ohjaa koko tiedostoa.
--
-- 1. HINTA EI OLE RUOASSA.
--    Lounas on yksi kokonaisuus jonka hintaan kaikki päivän ruoat
--    sisältyvät. Hintakenttä ruoassa houkuttelisi myymään yksittäisiä
--    annoksia, ja koko listan hinta olisi silloin laskettava jostain.
--    Hinta on päivässä, ja päivällä voi olla useampi nimetty hinta
--    (Lounas, Eläkeläinen, Lapset).
--
-- 2. JULKINEN SIVU EI LUE TAULUJA.
--    Asiakas ei ole kirjautunut. Sen sijaan että antaisimme anon-roolille
--    lukuoikeuden näihin tauluihin ja luottaisimme siihen että jokainen
--    käytäntö on kirjoitettu oikein, julkinen sivu kutsuu yhtä
--    security definer -funktiota joka palauttaa vain julkaistun viikon.
--    Yksi tarkistus yhdessä paikassa on tarkistettavissa; kymmenen
--    käytäntöä eri tauluissa ei.
--
-- 3. MUUTOS EI JULKAISE ITSEÄÄN.
--    Julkaistun listan muokkaaminen ei muuta sitä mitä asiakas näkee.
--    Sisällön muutosaika kirjataan liipaisimella, ja sitä verrataan
--    julkaisuaikaan. Ilman tätä ravintoloitsija voisi vahingossa
--    näyttää keskeneräisen listan ovessa olevassa QR-koodissa.

-- ---------------------------------------------------------------------------
-- 1. Ravintolan julkinen tunniste
-- ---------------------------------------------------------------------------
--
-- Osoitteessa ei käytetä uuid:ta. /lounas/cafe-monami on luettava,
-- jaettava ja muistettava; /lounas/36418756-fedd-... ei ole mitään
-- näistä. Tunnus ei myöskään paljasta sisäistä tunnistetta.

alter table restaurants add column if not exists slug text;

-- Täytetään nimestä. Ei ainutlaatuisuutta vielä: se lisätään vasta kun
-- mahdolliset törmäykset on ratkaistu numeroliitteellä.
update restaurants
set slug = regexp_replace(
  regexp_replace(
    lower(translate(name, 'äöåÄÖÅ', 'aoaAOA')),
    '[^a-z0-9]+', '-', 'g'
  ),
  '^-+|-+$', '', 'g'
)
where slug is null;

-- Törmäykset: sama nimi kahdella ravintolalla. Vanhin saa nimen,
-- muut saavat juoksevan numeron.
with numbered as (
  select id, slug,
         row_number() over (partition by slug order by created_at, id) as n
  from restaurants
)
update restaurants r
set slug = n.slug || '-' || n.n
from numbered n
where r.id = n.id and n.n > 1;

alter table restaurants alter column slug set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_slug_key') then
    alter table restaurants add constraint restaurants_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurants_slug_format') then
    alter table restaurants add constraint restaurants_slug_format
      check (slug ~ '^[a-z0-9][a-z0-9-]*$');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Sanastot
-- ---------------------------------------------------------------------------
--
-- Omina tauluina eikä enumeina: uuden ruokavalion tai allergeenin
-- lisääminen on rivi, ei skeemamuutos eikä koodimuutos.

create table if not exists diet_types (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  /** Lyhenne merkkiin. Tyhjä kun lyhennettä ei ole. */
  short_label text not null default '',
  sort_order int not null default 100
);

insert into diet_types (id, label, short_label, sort_order) values
  ('vegetarian',  'Kasvis',        'K',  10),
  ('vegan',       'Vegaaninen',    'VE', 20),
  ('gluten_free', 'Gluteeniton',   'G',  30),
  ('lactose_free','Laktoositon',   'L',  40),
  ('milk_free',   'Maidoton',      'M',  50)
on conflict (id) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  sort_order = excluded.sort_order;

create table if not exists allergen_types (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  sort_order int not null default 100
);

insert into allergen_types (id, label, sort_order) values
  ('gluten',    'Gluteeni',   10),
  ('milk',      'Maito',      20),
  ('egg',       'Kananmuna',  30),
  ('fish',      'Kala',       40),
  ('shellfish', 'Äyriäiset',  50),
  ('soy',       'Soija',      60),
  ('nuts',      'Pähkinät',   70),
  ('celery',    'Selleri',    80),
  ('mustard',   'Sinappi',    90),
  ('sesame',    'Seesami',   100)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Viikko
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lunch_status') then
    create type lunch_status as enum ('draft', 'published', 'archived');
  end if;
end;
$$;

create table if not exists lunch_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  /** Viikon maanantai. Tarkistus estää muun viikonpäivän. */
  week_start date not null check (extract(isodow from week_start) = 1),

  /**
   * Loppupäivä johdetaan alusta.
   *
   * Generoituna sarakkeena viikko ei voi olla ristiriitainen: alku ja
   * loppu eivät voi ajautua eri viikoille, koska loppua ei voi
   * kirjoittaa.
   */
  week_end date generated always as (week_start + 6) stored,

  status lunch_status not null default 'draft',
  published_at timestamptz,

  /**
   * Milloin sisältöä viimeksi muutettiin.
   *
   * Liipaisin päivittää tämän kun päivä, hinta tai ruoka muuttuu.
   * Vertaamalla julkaisuaikaan tiedetään onko julkaistussa listassa
   * julkaisemattomia muutoksia.
   */
  content_updated_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, week_start)
);

create index if not exists lunch_menus_restaurant_week_idx
  on lunch_menus (restaurant_id, week_start desc);

create table if not exists lunch_days (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references lunch_menus (id) on delete cascade,
  date date not null,

  /** 1 = maanantai. Johdettu, jotta se ei voi olla ristiriidassa. */
  day_of_week int generated always as (extract(isodow from date)::int) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (menu_id, date)
);

create index if not exists lunch_days_menu_idx on lunch_days (menu_id, date);

-- ---------------------------------------------------------------------------
-- 4. Hinnat
-- ---------------------------------------------------------------------------
--
-- Sentteinä kokonaislukuna, kuten kaikki muukin raha tässä
-- sovelluksessa. Liukuluku olisi eri sääntö samalle asialle.

create table if not exists lunch_prices (
  id uuid primary key default gen_random_uuid(),
  lunch_day_id uuid not null references lunch_days (id) on delete cascade,

  /** "Lounas", "Eläkeläinen", "Lapset". */
  name text not null check (length(trim(name)) > 0 and length(name) <= 40),

  price_cents int not null check (price_cents >= 0),
  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  unique (lunch_day_id, name)
);

create index if not exists lunch_prices_day_idx
  on lunch_prices (lunch_day_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5. Ruoat
-- ---------------------------------------------------------------------------
--
-- EI hintasaraketta. Se on tämän moduulin tärkein rakenteellinen
-- valinta: lounas on kokonaisuus, ei annosvalikoima.

create table if not exists lunch_items (
  id uuid primary key default gen_random_uuid(),
  lunch_day_id uuid not null references lunch_days (id) on delete cascade,

  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  description text check (description is null or length(description) <= 400),

  /** Polku storagessa, ei URL. Sama tapa kuin kuiteissa. */
  image_path text,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lunch_items_day_idx
  on lunch_items (lunch_day_id, sort_order);

create table if not exists lunch_item_diets (
  lunch_item_id uuid not null references lunch_items (id) on delete cascade,
  diet_type text not null references diet_types (id),
  primary key (lunch_item_id, diet_type)
);

create table if not exists lunch_item_allergens (
  lunch_item_id uuid not null references lunch_items (id) on delete cascade,
  allergen_type text not null references allergen_types (id),
  primary key (lunch_item_id, allergen_type)
);

-- ---------------------------------------------------------------------------
-- 6. Sisällön muutosaika
-- ---------------------------------------------------------------------------
--
-- Ilman tätä "julkaistussa listassa on muutoksia" pitäisi päätellä
-- vertaamalla rivejä, tai jokaisen toiminnon pitäisi muistaa päivittää
-- viikko itse. Toinen unohtuisi ennemmin tai myöhemmin.

create or replace function touch_lunch_menu_from_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus set content_updated_at = now(), updated_at = now()
  where id = coalesce(new.menu_id, old.menu_id);
  return null;
end;
$$;

create or replace function touch_lunch_menu_from_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus m set content_updated_at = now(), updated_at = now()
  from lunch_days d
  where d.id = coalesce(new.lunch_day_id, old.lunch_day_id)
    and m.id = d.menu_id;
  return null;
end;
$$;

create or replace function touch_lunch_menu_from_item_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update lunch_menus m set content_updated_at = now(), updated_at = now()
  from lunch_days d, lunch_items i
  where i.id = coalesce(new.lunch_item_id, old.lunch_item_id)
    and d.id = i.lunch_day_id
    and m.id = d.menu_id;
  return null;
end;
$$;

drop trigger if exists lunch_days_touch on lunch_days;
create trigger lunch_days_touch
  after insert or update or delete on lunch_days
  for each row execute function touch_lunch_menu_from_day();

drop trigger if exists lunch_prices_touch on lunch_prices;
create trigger lunch_prices_touch
  after insert or update or delete on lunch_prices
  for each row execute function touch_lunch_menu_from_child();

drop trigger if exists lunch_items_touch on lunch_items;
create trigger lunch_items_touch
  after insert or update or delete on lunch_items
  for each row execute function touch_lunch_menu_from_child();

drop trigger if exists lunch_item_diets_touch on lunch_item_diets;
create trigger lunch_item_diets_touch
  after insert or update or delete on lunch_item_diets
  for each row execute function touch_lunch_menu_from_item_child();

drop trigger if exists lunch_item_allergens_touch on lunch_item_allergens;
create trigger lunch_item_allergens_touch
  after insert or update or delete on lunch_item_allergens
  for each row execute function touch_lunch_menu_from_item_child();

-- ---------------------------------------------------------------------------
-- 7. Pääsy
-- ---------------------------------------------------------------------------
--
-- Luku: ravintolan jäsenet. Kirjoitus: vain esihenkilö — lounaslista on
-- se mitä ovessa lukee, eikä työntekijä muuta sitä ohimennen.
--
-- Anon-roolille EI anneta mitään. Julkinen sivu kulkee funktion kautta.

alter table lunch_menus enable row level security;
alter table lunch_days enable row level security;
alter table lunch_prices enable row level security;
alter table lunch_items enable row level security;
alter table lunch_item_diets enable row level security;
alter table lunch_item_allergens enable row level security;
alter table diet_types enable row level security;
alter table allergen_types enable row level security;

drop policy if exists diet_types_read on diet_types;
create policy diet_types_read on diet_types
  for select to authenticated using (true);

drop policy if exists allergen_types_read on allergen_types;
create policy allergen_types_read on allergen_types
  for select to authenticated using (true);

drop policy if exists lunch_menus_read on lunch_menus;
create policy lunch_menus_read on lunch_menus
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists lunch_days_read on lunch_days;
create policy lunch_days_read on lunch_days
  for select to authenticated
  using (
    menu_id in (
      select id from lunch_menus
      where restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_prices_read on lunch_prices;
create policy lunch_prices_read on lunch_prices
  for select to authenticated
  using (
    lunch_day_id in (
      select d.id from lunch_days d
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_items_read on lunch_items;
create policy lunch_items_read on lunch_items
  for select to authenticated
  using (
    lunch_day_id in (
      select d.id from lunch_days d
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_item_diets_read on lunch_item_diets;
create policy lunch_item_diets_read on lunch_item_diets
  for select to authenticated
  using (
    lunch_item_id in (
      select i.id from lunch_items i
      join lunch_days d on d.id = i.lunch_day_id
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists lunch_item_allergens_read on lunch_item_allergens;
create policy lunch_item_allergens_read on lunch_item_allergens
  for select to authenticated
  using (
    lunch_item_id in (
      select i.id from lunch_items i
      join lunch_days d on d.id = i.lunch_day_id
      join lunch_menus m on m.id = d.menu_id
      where m.restaurant_id in (select my_restaurant_ids())
    )
  );
