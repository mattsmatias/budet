-- 0131 Sopimus voi kattaa useamman toimialan
--
-- KAHVILA-ALALLA EI OLE OMAA SOPIMUSTA.
--
-- Kahvila kuuluu matkailu-, ravintola- ja vapaa-ajan palveluiden
-- tyoehtosopimukseen. Sopimuksen 1 §:n soveltamisalassa luetellaan
-- nimenomaisesti "ravintolat, kahvilat, pubit, yokerhot"
-- (PAM, luettu 27.9.2026). Sama sopimus on jo Katessa; puuttui vain
-- tieto siita etta se koskee myos kahviloita.
--
-- YKSI TOIMIALA EI RIITA KENTAKSI.
--
-- Aiemmin sopimuksella oli tasan yksi toimiala, jolloin kahvilalle
-- olisi pitanyt joko tehda kopio samasta sopimuksesta tai valita se
-- "muista sopimuksista" — kopio vanhenisi omaa tahtiaan ja toinen
-- nayttaisi silta ettei sopimus oikeasti koske kahvilaa.
--
-- Kentta on lista, koska sopimuksen soveltamisala on lista. Sama
-- rakenne kantaa myos seuraavat: kaupan tyoehtosopimusta noudatetaan
-- osassa parturiliikkeita, ja se voi kattaa useamman toimialan
-- kerralla.

alter table tes_agreements
  add column if not exists industries text[];

update tes_agreements
set industries = array[industry]
where industries is null;

-- MaRa kattaa ravintolat ja kahvilat. Lahde: sopimuksen 1 §.
update tes_agreements
set industries = array['restaurant', 'cafe']
where slug = 'marava';

alter table tes_agreements
  alter column industries set default '{}',
  alter column industries set not null;

-- Vanha kentta pois: kaksi paikkaa samalle tiedolle ajautuu erilleen.
alter table tes_agreements drop column if exists industry;

comment on column tes_agreements.industries is
  'Toimialat joita sopimus koskee. Ryhmittelya varten, ei laskentaan.';
