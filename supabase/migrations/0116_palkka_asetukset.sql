-- ---------------------------------------------------------------------------
-- 0116 — Palkkakulujen asetukset
-- ---------------------------------------------------------------------------
--
-- Mita tyo maksaa tyonantajalle: bruttopalkka, sen paalle ilta- ja
-- viikonloppulisat, lomakorvaus ja tyonantajan sivukulut.
--
-- PROSENTIT OVAT ASETUS EIVAT VAKIO.
--
-- Sivukulujen ja lomakorvauksen suuruus riippuu tyoehtosopimuksesta ja
-- muuttuu vuosittain. Kovakoodattu luku olisi oikein yhden vuoden ja
-- vaarin kaikki muut, eika kukaan huomaisi milloin se vaihtui.
-- Oletukset ovat nollia: arvio on silloin pelkka bruttopalkka, mika on
-- rehellisesti liian pieni eika keksitty.
--
-- TAMA EI OLE PALKANLASKENTAA.
--
-- Ennakonpidatys, sairausajan palkka ja vuosilomalain paivat kuuluvat
-- palkkapalveluun. Verokortti ei kuulu tanne lainkaan: se maaraa mita
-- tyontekija saa kateen, ei mita tyonantaja maksaa.

create table if not exists payroll_settings (
  restaurant_id uuid primary key
    references restaurants (id) on delete cascade,

  /** Tyonantajan sivukulut osuutena palkasta, esim. 0.23. */
  side_cost_rate numeric(5, 4) not null default 0
    check (side_cost_rate >= 0 and side_cost_rate <= 2),

  /** Lomakorvaus osuutena palkasta, esim. 0.115. */
  holiday_rate numeric(5, 4) not null default 0
    check (holiday_rate >= 0 and holiday_rate <= 2),

  /** Iltalisa osuutena tuntipalkasta. */
  evening_rate numeric(5, 4) not null default 0
    check (evening_rate >= 0 and evening_rate <= 2),

  saturday_rate numeric(5, 4) not null default 0
    check (saturday_rate >= 0 and saturday_rate <= 2),

  /** Sunnuntailisa: 1 tarkoittaa sadan prosentin korotusta. */
  sunday_rate numeric(5, 4) not null default 0
    check (sunday_rate >= 0 and sunday_rate <= 2),

  /*
   * Illan rajat minuutteina vuorokauden alusta, paikallista aikaa.
   *
   * Loppu voi olla alkua pienempi: 18-06 menee keskiyon yli, ja se on
   * tavallisin iltatyon maaritelma.
   */
  evening_start_minute integer not null default 1080
    check (evening_start_minute >= 0 and evening_start_minute < 1440),
  evening_end_minute integer not null default 360
    check (evening_end_minute >= 0 and evening_end_minute < 1440),

  updated_at timestamptz not null default now()
);

alter table payroll_settings enable row level security;

/*
 * Omistajan asetus.
 *
 * Luvut kertovat mita tyo maksaa yritykselle. Tyontekijalle ne eivat
 * kuulu: han nakee oman tuntipalkkansa, ei yrityksen kulurakennetta.
 * Kirjanpitaja lukee talouden mutta ei muuta yrityksen asetuksia.
 */
drop policy if exists payroll_settings_read on payroll_settings;
create policy payroll_settings_read on payroll_settings
  for select to authenticated
  using (is_owner(restaurant_id));

drop policy if exists payroll_settings_write on payroll_settings;
create policy payroll_settings_write on payroll_settings
  for all to authenticated
  using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));
