-- ---------------------------------------------------------------------------
-- 0120 — TES:n toimiala irti Katen business_type-enumista
-- ---------------------------------------------------------------------------
--
-- SOPIMUKSEN ALA EI OLE SAMA ASIA KUIN KATEN ASIAKKAAN TOIMIALA.
--
-- business_type kertoo mita Kate tarjoaa yritykselle: ravintola, kahvila
-- tai parturi-kampaamo. Tyoehtosopimus on oman alansa asiakirja, ja
-- kaupan tai kiinteistopalvelualan sopimus on olemassa riippumatta
-- siita palveleeko Kate niita. Enumiin sidottuna sellaista sopimusta ei
-- voisi edes tallentaa ilman etta Katen oma toimialalista kasvaa.
--
-- Sarake on siis tekstia. Arvot pysyvat ennallaan, ja nykyiset
-- sopimukset kantavat edelleen tunnuksia 'restaurant', 'cafe' ja
-- 'barber'. Kentta on vain ryhmittelya varten: laskenta ei lue sita.

alter table tes_agreements
  alter column industry type text using industry::text;

alter table tes_agreements
  add constraint tes_agreements_industry_check
  check (length(trim(industry)) > 0);

comment on column tes_agreements.industry is
  'Sopimuksen ala vapaana tunnuksena, esimerkiksi restaurant tai retail. Ei sidottu business_type-enumiin eika kayteta laskennassa.';
