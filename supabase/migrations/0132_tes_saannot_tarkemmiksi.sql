-- 0132 Saannon rajaukset: viikonpaivat, pyhat ja korotuksen pohja
--
-- KAUPAN SOPIMUS EI MAHTUNUT MALLIIN.
--
-- Kaupan alan tyoehtosopimuksessa on kolme rajausta joita Katessa ei
-- voinut ilmaista:
--
--   1. Iltalisaa ei makseta arkilauantai-iltana, koska samoista
--      tunneista maksetaan lauantailisa. Ilman paivarajausta Kate
--      maksoi molemmat.
--   2. Yolisaa ei makseta sunnuntai- eika juhlapaivayona. Pelkka
--      viikonpaivalista ei riita, koska juhlapaiva voi olla mika
--      paiva tahansa.
--   3. Sunnuntaikorotus lasketaan vain peruspalkasta: "Sunnuntaityo-
--      korvausta laskettaessa tyoaikalisia ei oteta huomioon
--      peruspalkassa" (kaupan TES 10 § 3. kohta). MaRassa korotus
--      koskee myos ilta- ja yolisaa.
--
-- Nama ovat sopimuksen eroja eivatka laskennan mielipiteita, joten ne
-- ovat saannon kentissa. Tyhja rajaus tarkoittaa "koskee kaikkia",
-- joten MaRan luvut eivat muutu — karakterisointitestin 1072
-- tapausta antavat sentilleen saman tuloksen kuin ennen.

alter table tes_rules
  add column if not exists weekdays smallint[],
  add column if not exists not_on_holidays boolean not null default false,
  add column if not exists base_only boolean not null default false;

comment on column tes_rules.weekdays is
  'Viikonpaivat joina lisa maksetaan, 1 = maanantai … 7 = sunnuntai. Tyhja = kaikki.';
comment on column tes_rules.not_on_holidays is
  'Ei makseta sunnuntaina eika pyhapaivana.';
comment on column tes_rules.base_only is
  'Korotus lasketaan vain peruspalkasta, ei tyoaikalisista.';

-- Sopimuksesta puuttuva osa on yhta tarkea tieto kuin mukana oleva.
alter table tes_agreements
  add column if not exists note text;

comment on column tes_agreements.note is
  'Mita sopimuksesta on jatetty pois tai mita kaytosta pitaa tietaa.';
