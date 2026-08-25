-- ---------------------------------------------------------------------------
-- 0041 — Kassan oma ALV-erittely
-- ---------------------------------------------------------------------------
--
-- Z-raportti kertoo saman päivän kahdella tavalla: tuoteryhmittäin
-- (ALKO, RUOKA, VEDET) ja verokannoittain (25,5 %, 13,5 %). Budet on
-- lukenut vain tuoteryhmät ja johtanut veron niistä ryhmän kannalla.
--
-- NÄMÄ KAKSI JAKOA EIVÄT OLE SAMA JAKO.
--
-- Oikeasta raportista: tuoteryhmä ALKO on 10,00 €, mutta kassan
-- 25,5 %:n kanta on 10,50 €. Puoli euroa RUOKA/VEDET-ryhmien sisällä
-- on verotettu yleisellä kannalla — pantti, pakkaus tai mukaan otettu
-- tuote. Ryhmä ei siis kerro kantaa, vaikka melkein aina kertookin.
--
-- Kun Budet johti veron ryhmistä, se sai 159,83 € siinä missä kassa
-- ilmoitti 159,88 €. Täsmäytys huusi "ALV ei täsmää" ja neuvoi
-- korjaamaan ryhmien verokantoja — vaikka ryhmät olivat oikein.
--
-- KASSAN ILMOITTAMA VERO ON TOTUUS.
--
-- Kassa on kirjanpidon lähde ja sen ALV-taulukko on se luku joka
-- ilmoitetaan verottajalle. Budetin oma laskelma on tarkistuslaskelma,
-- ei korvaava. Tämä taulu säilyttää kassan luvut sellaisenaan, jotta
-- niitä voi verrata sen sijaan että ne korvattaisiin.

create table if not exists daily_sales_vat (
  id uuid primary key default gen_random_uuid(),
  daily_sales_id uuid not null references daily_sales (id) on delete cascade,

  /*
   * Kanta sellaisena kuin raportissa lukee.
   *
   * numeric eikä float: 0,255 ei ole esitettävissä binäärisenä
   * liukulukuna, ja verokanta on juuri se luku jonka on oltava tarkka.
   */
  vat_rate numeric(6, 5) not null check (vat_rate >= 0 and vat_rate < 1),

  /* Kaikki kolme raportista, ei laskettuna. */
  gross_cents integer not null check (gross_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  net_cents integer not null check (net_cents >= 0),

  created_at timestamptz not null default now(),

  /* Sama kanta kahdesti tarkoittaisi kahta totuutta samasta rivistä. */
  unique (daily_sales_id, vat_rate)
);

create index if not exists daily_sales_vat_lookup
  on daily_sales_vat (daily_sales_id);

-- ---------------------------------------------------------------------------
-- Näkyvyys
-- ---------------------------------------------------------------------------
--
-- Sama sääntö kuin myyntiriveillä: luku talousoikeudella, kirjoitus
-- vuoropäälliköllä. Oikeus tulee päivästä johon rivi kuuluu — oma
-- restaurant_id olisi toinen lähde samalle totuudelle.

alter table daily_sales_vat enable row level security;

drop policy if exists daily_sales_vat_read on daily_sales_vat;
create policy daily_sales_vat_read on daily_sales_vat
  for select to authenticated
  using (
    exists (
      select 1 from daily_sales d
      where d.id = daily_sales_id and can_read_finance(d.restaurant_id)
    )
  );

drop policy if exists daily_sales_vat_write on daily_sales_vat;
create policy daily_sales_vat_write on daily_sales_vat
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
