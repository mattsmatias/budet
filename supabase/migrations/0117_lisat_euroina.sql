-- ---------------------------------------------------------------------------
-- 0117 — Tyoaikalisat euroina tunnilta
-- ---------------------------------------------------------------------------
--
-- EURO JA PROSENTTI OVAT ERI ASIOITA.
--
-- Ravintola-alan tyoehtosopimuksissa iltalisa on tyypillisesti euroja
-- tunnilta — esimerkiksi 1,40 €/h — kun taas sunnuntaikorotus on
-- prosentti. Pelkka prosenttikentta oli vaara tietomalli euromaaralle:
-- se pakotti kayttajan laskemaan osuuden itse joka kerta kun
-- tuntipalkka muuttuu, ja luku vanheni ensimmaisesta palkankorotuksesta.
--
-- Jokaisella lisalla on nyt molemmat. Ne lasketaan yhteen, joten
-- kumman tahansa voi jattaa nollaksi.
--
-- Yolisa on oma lisansa omalla kellonaikavalillaan: illan ja yon raja
-- on eri asia kuin illan alku.

alter table payroll_settings
  add column if not exists evening_cents integer not null default 0
    check (evening_cents >= 0 and evening_cents <= 100000),
  add column if not exists saturday_cents integer not null default 0
    check (saturday_cents >= 0 and saturday_cents <= 100000),
  add column if not exists sunday_cents integer not null default 0
    check (sunday_cents >= 0 and sunday_cents <= 100000),
  add column if not exists night_cents integer not null default 0
    check (night_cents >= 0 and night_cents <= 100000),
  add column if not exists night_rate numeric(5, 4) not null default 0
    check (night_rate >= 0 and night_rate <= 2),
  add column if not exists night_start_minute integer not null default 1380
    check (night_start_minute >= 0 and night_start_minute < 1440),
  add column if not exists night_end_minute integer not null default 360
    check (night_end_minute >= 0 and night_end_minute < 1440);

comment on column payroll_settings.evening_cents is
  'Iltalisa euroina tunnilta, sentteina. Lasketaan yhteen evening_rate kanssa.';

/*
 * Illan oletusloppu 23:00 eika 06:00.
 *
 * Yolisa alkaa siita mihin ilta paattyy. Vanha oletus 06:00 olisi
 * peittanyt koko yon illaksi, ja yolisa jaisi kayttamatta ilman etta
 * kukaan huomaa miksi.
 */
alter table payroll_settings
  alter column evening_end_minute set default 1380;
