-- ---------------------------------------------------------------------------
-- 0014 — Brändiluettelon siemenaineisto
-- ---------------------------------------------------------------------------
--
-- GENEROITU TIEDOSTO. Älä muokkaa käsin.
--   node scripts/merchant-seed.mjs > supabase/migrations/0014_merchant_seed.sql
--
-- Aliakset on normalisoitu samalla säännöllä jota tunnistus käyttää.
-- Käsin kirjoitettuina ne ajautuisivat erilleen, ja kauppa jäisi
-- tunnistamatta ilman että kukaan huomaisi miksi.
--
-- Uusi yritys lisätään skriptiin ja migraatio ajetaan uudelleen.
-- Käyttöliittymään ei kosketa.

insert into merchants (id, name, category, brand_color, brand_background) values
  ('k-market', 'K-Market', 'grocery', '#F28C28', '#FFF7ED'),
  ('k-supermarket', 'K-Supermarket', 'grocery', '#E85D04', '#FFF7ED'),
  ('k-citymarket', 'K-Citymarket', 'grocery', '#D64500', '#FFF7ED'),
  ('s-market', 'S-market', 'grocery', '#00AA46', '#F0FDF4'),
  ('alepa', 'Alepa', 'grocery', '#E30613', '#FFF1F2'),
  ('sale', 'Sale', 'grocery', '#0A7D33', '#F0FDF4'),
  ('prisma', 'Prisma', 'grocery', '#00693E', '#F0FDF4'),
  ('lidl', 'Lidl', 'grocery', '#0050AA', '#EFF6FF'),
  ('minimani', 'Minimani', 'grocery', '#C8102E', '#FFF1F2'),
  ('gigantti', 'Gigantti', 'electronics', '#005EB8', '#EFF6FF'),
  ('power', 'POWER', 'electronics', '#0F172A', '#F1F5F9'),
  ('verkkokauppa-com', 'Verkkokauppa.com', 'electronics', '#E4002B', '#FFF1F2'),
  ('elisa', 'Elisa', 'electronics', '#0019AF', '#EFF6FF'),
  ('dna', 'DNA', 'electronics', '#6E2585', '#FAF5FF'),
  ('telia', 'Telia', 'electronics', '#990AE3', '#FAF5FF'),
  ('k-rauta', 'K-Rauta', 'hardware', '#E85D04', '#FFF7ED'),
  ('bauhaus', 'BAUHAUS', 'hardware', '#C8102E', '#FFF1F2'),
  ('stark', 'STARK', 'hardware', '#1D4ED8', '#EFF6FF'),
  ('puuilo', 'Puuilo', 'hardware', '#F59E0B', '#FFFBEB'),
  ('motonet', 'Motonet', 'automotive', '#0F52BA', '#EFF6FF'),
  ('tokmanni', 'Tokmanni', 'retail', '#E4002B', '#FFF1F2'),
  ('clas-ohlson', 'Clas Ohlson', 'retail', '#00447C', '#EFF6FF'),
  ('ikea', 'IKEA', 'retail', '#0058A3', '#EFF6FF'),
  ('yliopiston-apteekki', 'Yliopiston Apteekki', 'pharmacy', '#00843D', '#F0FDF4'),
  ('alko', 'Alko', 'alcohol', '#003DA5', '#EFF6FF'),
  ('mcdonalds', 'McDonald''s', 'restaurant', '#DA291C', '#FFF1F2'),
  ('hesburger', 'Hesburger', 'restaurant', '#004B93', '#EFF6FF'),
  ('burger-king', 'Burger King', 'restaurant', '#D62300', '#FFF7ED'),
  ('subway', 'Subway', 'restaurant', '#008C15', '#F0FDF4'),
  ('wolt', 'Wolt', 'restaurant', '#00C2E8', '#ECFEFF'),
  ('foodora', 'Foodora', 'restaurant', '#D70F64', '#FDF2F8'),
  ('hsl', 'HSL', 'transport', '#007AC9', '#EFF6FF'),
  ('vr', 'VR', 'transport', '#007A3D', '#F0FDF4'),
  ('finnair', 'Finnair', 'transport', '#0B1560', '#EFF6FF'),
  ('kespro', 'Kespro', 'grocery', '#E85D04', '#FFF7ED'),
  ('metro-tukku', 'Metro-tukku', 'grocery', '#00519E', '#EFF6FF'),
  ('valio', 'Valio', 'grocery', '#0057B8', '#EFF6FF'),
  ('heinon-tukku', 'Heinon Tukku', 'grocery', '#C8102E', '#FFF1F2')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  brand_color = excluded.brand_color,
  brand_background = excluded.brand_background,
  updated_at = now();

insert into merchant_aliases (merchant_id, alias) values
  ('k-market', 'k market'),
  ('k-market', 'kmarket'),
  ('k-supermarket', 'k supermarket'),
  ('k-supermarket', 'ksupermarket'),
  ('k-citymarket', 'k citymarket'),
  ('k-citymarket', 'citymarket'),
  ('s-market', 's market'),
  ('s-market', 'smarket'),
  ('alepa', 'alepa'),
  ('sale', 'sale'),
  ('prisma', 'prisma'),
  ('lidl', 'lidl'),
  ('minimani', 'minimani'),
  ('gigantti', 'gigantti'),
  ('power', 'power'),
  ('verkkokauppa-com', 'verkkokauppa.com'),
  ('verkkokauppa-com', 'verkkokauppa com'),
  ('verkkokauppa-com', 'verkkokauppa'),
  ('elisa', 'elisa'),
  ('dna', 'dna'),
  ('telia', 'telia'),
  ('k-rauta', 'k rauta'),
  ('k-rauta', 'krauta'),
  ('bauhaus', 'bauhaus'),
  ('stark', 'stark'),
  ('puuilo', 'puuilo'),
  ('motonet', 'motonet'),
  ('tokmanni', 'tokmanni'),
  ('clas-ohlson', 'clas ohlson'),
  ('ikea', 'ikea'),
  ('yliopiston-apteekki', 'yliopiston apteekki'),
  ('yliopiston-apteekki', 'ya apteekki'),
  ('alko', 'alko'),
  ('mcdonalds', 'mcdonald s'),
  ('mcdonalds', 'mcdonalds'),
  ('mcdonalds', 'mc donalds'),
  ('hesburger', 'hesburger'),
  ('burger-king', 'burger king'),
  ('subway', 'subway'),
  ('wolt', 'wolt'),
  ('wolt', 'wolt enterprises'),
  ('foodora', 'foodora'),
  ('hsl', 'hsl'),
  ('hsl', 'helsingin seudun liikenne'),
  ('vr', 'vr'),
  ('vr', 'vr group'),
  ('finnair', 'finnair'),
  ('kespro', 'kespro'),
  ('metro-tukku', 'metro tukku'),
  ('metro-tukku', 'meira nova'),
  ('valio', 'valio'),
  ('heinon-tukku', 'heinon tukku')
on conflict (alias) do update set merchant_id = excluded.merchant_id;

