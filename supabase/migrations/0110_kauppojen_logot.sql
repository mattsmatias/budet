-- ---------------------------------------------------------------------------
-- 0110 — Kauppojen logot ja Neste
-- ---------------------------------------------------------------------------
--
-- Sama sisalto kuin uudelleen generoidussa 0014-siemenessa. Tyhjaan
-- kantaan riittaa 0014 yksin; tama on olemassa siksi, etta jo ajossa
-- oleva kanta saa logot ja uuden ketjun ilman koko siemenen ajoa.
--
-- Logotiedostot ovat public/kaupat-kansiossa, ja ne tehdaan skriptilla
-- scripts/kauppojen-logot.mjs.

insert into merchants (id, name, category, brand_color, brand_background, logo_url) values
  ('k-market', 'K-Market', 'grocery', '#F28C28', '#FFF7ED', '/kaupat/k-market.png'),
  ('k-citymarket', 'K-Citymarket', 'grocery', '#D64500', '#FFF7ED', '/kaupat/k-citymarket.png'),
  ('s-market', 'S-market', 'grocery', '#00AA46', '#F0FDF4', '/kaupat/s-market.png'),
  ('alepa', 'Alepa', 'grocery', '#E30613', '#FFF1F2', '/kaupat/alepa.png'),
  ('prisma', 'Prisma', 'grocery', '#00693E', '#F0FDF4', '/kaupat/prisma.png'),
  ('lidl', 'Lidl', 'grocery', '#0050AA', '#EFF6FF', '/kaupat/lidl.png'),
  ('k-rauta', 'K-Rauta', 'hardware', '#E85D04', '#FFF7ED', '/kaupat/k-rauta.png'),
  ('bauhaus', 'BAUHAUS', 'hardware', '#C8102E', '#FFF1F2', '/kaupat/bauhaus.png'),
  ('neste', 'Neste', 'automotive', '#003F87', '#EFF6FF', '/kaupat/neste.png'),
  ('alko', 'Alko', 'alcohol', '#003DA5', '#EFF6FF', '/kaupat/alko.png'),
  ('kespro', 'Kespro', 'grocery', '#E85D04', '#FFF7ED', '/kaupat/kespro.png')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  brand_color = excluded.brand_color,
  brand_background = excluded.brand_background,
  logo_url = excluded.logo_url,
  updated_at = now();

insert into merchant_aliases (merchant_id, alias) values
  ('neste', 'neste'),
  ('neste', 'neste k'),
  ('neste', 'neste express'),
  ('neste', 'neste oil')
on conflict (alias) do update set merchant_id = excluded.merchant_id;
