-- ---------------------------------------------------------------------------
-- 0013 — Kauppatunnistus (merchants)
-- ---------------------------------------------------------------------------
--
-- Kuitilla luki tähän asti vain se nimi jonka poiminta luki paperista:
-- "S-Market Kajaani", "Gigantti Oy", "K-MARKET MALMI". Ne ovat eri
-- merkkijonoja mutta osa kolmea tunnettua ketjua, eikä listasta voinut
-- silmäillä missä on käyty.
--
-- Kolme tasoa, ei kahta:
--
--   merchants   Brändi. Yhteinen kaikille ravintoloille, ei kenenkään
--               omistama. K-Market on K-Market riippumatta siitä kuka
--               siellä käy.
--
--   suppliers   Yksittäinen toimipiste ravintolan kirjanpidossa.
--               "K-Market Malmi" on ravintolan oma rivi, ja se osoittaa
--               brändiin. Tämä taulu on jo olemassa; siihen lisätään
--               vain linkki.
--
--   receipts    Osoittaa toimipisteeseen kuten ennenkin. Kuitti ei tiedä
--               brändistä mitään, eikä sen tarvitse.
--
-- Näin brändi → ketju → toimipiste on olemassa heti, mutta
-- käyttöliittymässä näkyy vain se mikä on tarpeen.

-- ---------------------------------------------------------------------------
-- 1. Kategoriat omana tauluna
-- ---------------------------------------------------------------------------
--
-- Ei enumia. Uuden toimialan lisääminen olisi silloin skeemamuutos, ja
-- koko tämän järjestelmän tarkoitus on että yrityksiä ja toimialoja voi
-- lisätä koskematta koodiin.

create table if not exists merchant_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  sort_order int not null default 100
);

insert into merchant_categories (id, label, sort_order) values
  ('grocery',     'Ruokakauppa',   10),
  ('restaurant',  'Ravintola',     20),
  ('alcohol',     'Alkoholi',      30),
  ('electronics', 'Elektroniikka', 40),
  ('hardware',    'Rautakauppa',   50),
  ('automotive',  'Autoilu',       60),
  ('retail',      'Vähittäiskauppa', 70),
  ('pharmacy',    'Apteekki',      80),
  ('transport',   'Liikenne',      90),
  ('services',    'Palvelut',     100)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Brändit
-- ---------------------------------------------------------------------------
--
-- Tunnus on luettava merkkijono eikä uuid: 'k-market' kertoo lokitiedosta
-- ja virheilmoituksesta heti mistä on kyse, ja siemenaineiston voi ajaa
-- uudelleen ilman että tunnukset vaihtuvat.
--
-- brand_color ja brand_background ovat tunnisteita, eivät teemoja.
-- Käyttöliittymä käyttää niitä pienenä korostuksena — logon taustana ja
-- kirjaimen värinä — eikä koskaan koko kortin värinä.

create table if not exists merchants (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (length(trim(name)) > 0),

  /** Virallinen nimi kaupparekisterissä, jos eri kuin brändinimi. */
  legal_name text,

  /** Y-tunnus muodossa 1234567-8. Vahvin tunniste kun se on tiedossa. */
  business_id text check (business_id is null or business_id ~ '^\d{7}-\d$'),

  category text not null references merchant_categories (id),
  subcategory text,

  /** Brändin tunnusväri. Käytetään pienenä korostuksena. */
  brand_color text not null default '#6b7280'
    check (brand_color ~ '^#[0-9a-fA-F]{6}$'),

  /** Erittäin vaalea tausta logolle. */
  brand_background text not null default '#f3f4f6'
    check (brand_background ~ '^#[0-9a-fA-F]{6}$'),

  /** Logon osoite jos sellainen on. Ilman sitä näytetään alkukirjain. */
  logo_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchants_category_idx on merchants (category);
create unique index if not exists merchants_business_id_idx
  on merchants (business_id) where business_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Kirjoitusasut
-- ---------------------------------------------------------------------------
--
-- Sama kauppa kirjoitetaan kuiteissa monella tavalla. Aliakset ovat
-- normalisoituja: pieniä kirjaimia, ilman välimerkkejä ja yhtiömuotoja.
-- Normalisointi tehdään sovelluksessa, koska sama funktio tarvitaan
-- myös tunnistushetkellä eikä sitä saa olla kahta versiota.

create table if not exists merchant_aliases (
  merchant_id text not null references merchants (id) on delete cascade,

  /** Normalisoitu kirjoitusasu. Ei sisällä välilyöntejä eikä välimerkkejä. */
  alias text not null check (alias = lower(alias) and length(alias) >= 2),

  primary key (alias)
);

create index if not exists merchant_aliases_merchant_idx
  on merchant_aliases (merchant_id);

-- ---------------------------------------------------------------------------
-- 4. Toimipiste osoittaa brändiin
-- ---------------------------------------------------------------------------

alter table suppliers add column if not exists merchant_id text
  references merchants (id) on delete set null;

-- Millä varmuudella tunnistus tehtiin. Käyttäjän itse korjaama on 1.
alter table suppliers add column if not exists merchant_confidence numeric(3, 2)
  check (merchant_confidence is null
         or (merchant_confidence >= 0 and merchant_confidence <= 1));

-- Erottaa käyttäjän vahvistaman tunnistuksen koneen tekemästä. Konetta
-- ei päästetä muuttamaan sitä minkä ihminen on vahvistanut.
alter table suppliers add column if not exists merchant_confirmed boolean
  not null default false;

create index if not exists suppliers_merchant_idx on suppliers (merchant_id);

-- ---------------------------------------------------------------------------
-- 5. Pääsy
-- ---------------------------------------------------------------------------
--
-- Brändiluettelo on yhteinen ja julkinen kirjautuneille: siinä ei ole
-- kenenkään liiketietoja, ainoastaan se että K-Market on ruokakauppa.
-- Kirjoitusoikeutta ei anneta kenellekään — luettelo ylläpidetään
-- migraatioilla, jottei yksi käyttäjä voi muuttaa sitä mitä muut näkevät.

alter table merchants enable row level security;
alter table merchant_aliases enable row level security;
alter table merchant_categories enable row level security;

drop policy if exists merchants_read on merchants;
create policy merchants_read on merchants
  for select to authenticated using (true);

drop policy if exists merchant_aliases_read on merchant_aliases;
create policy merchant_aliases_read on merchant_aliases
  for select to authenticated using (true);

drop policy if exists merchant_categories_read on merchant_categories;
create policy merchant_categories_read on merchant_categories
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. Toimipisteen liittäminen brändiin
-- ---------------------------------------------------------------------------

/**
 * Liittää toimipisteen brändiin.
 *
 * Erillinen funktio eikä osa create_receiptiä: kuitin tallennus on jo
 * toimiva kokonaisuus, eikä tunnistus saa kaataa sitä. Jos brändi jää
 * tunnistamatta, kuitti tallentuu silti.
 *
 * Kone ei ylikirjoita ihmistä. Kun merchant_confirmed on tosi, käyttäjä
 * on itse valinnut brändin eikä automaattinen tunnistus koske siihen —
 * muuten seuraava kuitti samasta kaupasta kumoaisi korjauksen.
 */
create or replace function set_supplier_merchant(
  p_supplier uuid,
  p_merchant text,
  p_confidence numeric,
  p_confirmed boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_confirmed boolean;
begin
  select restaurant_id, merchant_confirmed
    into v_restaurant, v_confirmed
    from suppliers where id = p_supplier;

  if v_restaurant is null then
    raise exception 'Toimittajaa ei löytynyt';
  end if;

  if v_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan';
  end if;

  -- Vahvistettua ei muuteta koneellisesti.
  if v_confirmed and not p_confirmed then
    return;
  end if;

  -- Vain esihenkilö saa vahvistaa. Tunnistus on kirjanpidon tietoa.
  if p_confirmed and not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi vahvistaa kaupan';
  end if;

  update suppliers
  set merchant_id = p_merchant,
      merchant_confidence = p_confidence,
      merchant_confirmed = p_confirmed,
      updated_at = now()
  where id = p_supplier;
end;
$$;

revoke all on function set_supplier_merchant from public;
grant execute on function set_supplier_merchant to authenticated;
