-- Verra — vertailudata: jurisdiktiot, ALV-koodit, suunnitelmat, sääntöperheet.
--
-- TÄRKEÄÄ: kaikki tässä siemenetyt sääntöversiot ovat statukseltaan 'demo'.
-- Niitä ei ole validoitu virallista lähdettä vasten, eikä niitä saa esittää
-- oikeudellisena totuutena (§50). Kun sääntö on tarkistettu, sille luodaan
-- uusi versio jolla on legal_reference ja status 'validated'.

insert into jurisdictions (code, name, is_eu, currency) values
  ('FI', 'Suomi', true, 'EUR'),
  ('SE', 'Ruotsi', true, 'SEK'),
  ('DK', 'Tanska', true, 'DKK'),
  ('DE', 'Saksa', true, 'EUR'),
  ('ES', 'Espanja', true, 'EUR'),
  ('EE', 'Viro', true, 'EUR'),
  ('NO', 'Norja', false, 'NOK'),
  ('GB', 'Britannia', false, 'GBP'),
  ('US', 'Yhdysvallat', false, 'USD'),
  ('TR', 'Turkki', false, 'TRY')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- ALV-koodit (demo-tasoinen kartoitus kirjanpitoa varten)
-- ---------------------------------------------------------------------------

insert into vat_codes (jurisdiction, code, name, description, rate, reverse_charge, deductible) values
  ('FI', 'FI-STD',  'Yleinen verokanta',        'Suomen yleinen ALV-kanta',                  0.2550, false, true),
  ('FI', 'FI-RED1', 'Alennettu verokanta 1',    'Elintarvikkeet ja ravintolaruoka',          0.1350, false, true),
  ('FI', 'FI-RED2', 'Alennettu verokanta 2',    'Kirjat, lääkkeet, henkilökuljetus',         0.1000, false, true),
  ('FI', 'FI-ZERO', 'Nollaverokanta',           'Verollinen myynti nollakannalla',           0.0000, false, true),
  ('FI', 'FI-EXPT', 'Veroton',                  'ALV:n soveltamisalan ulkopuolinen erä',     null,   false, false),
  ('FI', 'FI-RC-EU','Käännetty verovelvollisuus','EU:n sisäinen B2B-palvelu tai -tavara',    null,   true,  true),
  ('FI', 'FI-EXP',  'Vienti EU:n ulkopuolelle', 'Veroton vienti',                            0.0000, false, true),
  ('FI', 'FI-OSS',  'OSS-etämyynti',            'Kuluttajamyynti toiseen EU-maahan',         null,   false, true),
  ('FI', 'FI-ND',   'Vähennyskelvoton',         'Ei vähennysoikeutta',                       null,   false, false)
on conflict (jurisdiction, code) do nothing;

-- ---------------------------------------------------------------------------
-- Suunnitelmat ja rajat (§29, §61)
-- ---------------------------------------------------------------------------

insert into plans (id, name, description, monthly_price_cents, yearly_price_cents, per_client_price_cents, sort_order) values
  ('free',     'Free',          'Kokeiluun ja satunnaiseen käyttöön',        0,    0,     null, 10),
  ('solo',     'Solo',          'Yksinyrittäjälle',                          1900, 19000, null, 20),
  ('business', 'Business',      'Kasvavalle yritykselle',                    4900, 49000, null, 30),
  ('growth',   'Pro / Growth',  'Useita yhtiöitä ja automaatiota',           9900, 99000, null, 40),
  ('firm',     'Tilitoimisto',  'Perusmaksu + asiakaskohtainen hinnoittelu', 4900, 49000, 900,  50)
on conflict (id) do nothing;

insert into plan_entitlements (plan_id, key, limit_value, bool_value) values
  -- Free
  ('free', 'documents_per_month', 15, null),
  ('free', 'ai_questions_per_month', 20, null),
  ('free', 'seats', 1, null),
  ('free', 'vat_engine_full', null, false),
  ('free', 'timo', null, false),
  ('free', 'vies', null, false),
  ('free', 'email_ingestion', null, false),
  ('free', 'trips', null, false),
  ('free', 'accounting_integrations', null, false),
  ('free', 'api', null, false),
  -- Solo
  ('solo', 'documents_per_month', 150, null),
  ('solo', 'ai_questions_per_month', 300, null),
  ('solo', 'seats', 1, null),
  ('solo', 'vat_engine_full', null, true),
  ('solo', 'timo', null, true),
  ('solo', 'vies', null, true),
  ('solo', 'email_ingestion', null, true),
  ('solo', 'trips', null, true),
  ('solo', 'accounting_integrations', null, false),
  ('solo', 'api', null, false),
  -- Business
  ('business', 'documents_per_month', 750, null),
  ('business', 'ai_questions_per_month', 1500, null),
  ('business', 'seats', 5, null),
  ('business', 'vat_engine_full', null, true),
  ('business', 'timo', null, true),
  ('business', 'vies', null, true),
  ('business', 'email_ingestion', null, true),
  ('business', 'trips', null, true),
  ('business', 'accounting_integrations', null, true),
  ('business', 'api', null, false),
  -- Growth
  ('growth', 'documents_per_month', 2500, null),
  ('growth', 'ai_questions_per_month', 5000, null),
  ('growth', 'seats', 20, null),
  ('growth', 'vat_engine_full', null, true),
  ('growth', 'timo', null, true),
  ('growth', 'vies', null, true),
  ('growth', 'email_ingestion', null, true),
  ('growth', 'trips', null, true),
  ('growth', 'accounting_integrations', null, true),
  ('growth', 'api', null, true),
  -- Tilitoimisto
  ('firm', 'documents_per_month', null, null),
  ('firm', 'ai_questions_per_month', null, null),
  ('firm', 'seats', null, null),
  ('firm', 'vat_engine_full', null, true),
  ('firm', 'timo', null, true),
  ('firm', 'vies', null, true),
  ('firm', 'email_ingestion', null, true),
  ('firm', 'trips', null, true),
  ('firm', 'accounting_integrations', null, true),
  ('firm', 'api', null, true)
on conflict (plan_id, key) do nothing;

-- ---------------------------------------------------------------------------
-- Sääntöperheet
-- ---------------------------------------------------------------------------

insert into tax_rules (id, jurisdiction, name, description, category) values
  ('vat-fi-food',            'FI', 'Elintarvikkeet ja ravintolaruoka', 'Alennettu verokanta ruoalle',                       'vat'),
  ('vat-fi-alcohol',         'FI', 'Alkoholi',                          'Yleinen verokanta alkoholijuomille',                'vat'),
  ('vat-fi-service',         'FI', 'Palvelut',                          'Yleinen verokanta kotimaisille palveluille',        'vat'),
  ('vat-fi-goods',           'FI', 'Tavarat',                           'Yleinen verokanta kotimaisille tavaroille',         'vat'),
  ('vat-fi-reduced-transport','FI','Henkilökuljetus ja kirjat',         'Alennettu verokanta 2',                             'vat'),
  ('vat-fi-rc-eu-b2b',       'FI', 'EU B2B käännetty verovelvollisuus', 'Myynti EU-yritykselle, jolla voimassa oleva VAT-tunniste', 'vat'),
  ('vat-fi-export-non-eu',   'FI', 'Vienti EU:n ulkopuolelle',          'Veroton vienti',                                    'vat'),
  ('vat-fi-oss-distance',    'FI', 'OSS-etämyynti',                     'Kuluttajamyynti toiseen EU-maahan',                 'vat'),
  ('vat-fi-tips',            'FI', 'Tippi',                             'Vapaaehtoinen palkkio',                             'vat'),
  ('vat-fi-giftcard',        'FI', 'Lahjakortti',                       'Monikäyttöinen lahjakortti',                        'vat'),
  ('vat-fi-deposit',         'FI', 'Pantti',                            'Kierrätyspantti',                                   'vat'),
  ('vat-fi-packaging',       'FI', 'Pakkausmaksu',                      'Pakkaus- ja toimitusmaksu',                         'vat'),
  ('ded-fi-entertainment',   'FI', 'Edustuskulut',                      'Edustuskulujen vähennysoikeus',                     'deductibility'),
  ('ded-fi-employee-meal',   'FI', 'Henkilökunnan ateriat',             'Työntekijöiden ateriaetu',                          'deductibility'),
  ('mileage-fi',             'FI', 'Kilometrikorvaus',                  'Oman auton käyttö työajossa',                       'mileage'),
  ('perdiem-fi',             'FI', 'Päiväraha',                         'Kotimaan päiväraha',                                'per_diem')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sääntöversiot — kaikki DEMO-statuksella
-- ---------------------------------------------------------------------------
--
-- conditions ja actions ovat sama rakenne jota lib/tax/engine.ts tulkitsee.
-- Ehdot ovat AND-yhdistelmä: jokainen avain on tosi jotta sääntö osuu.

insert into tax_rule_versions
  (rule_id, version, status, priority, effective_from, conditions, actions, notes)
values
  ('vat-fi-food', '2026.1', 'demo', 20, '2026-01-01',
   '{"jurisdiction":"FI","category":["food","groceries","restaurant_food"],"crossBorder":false}',
   '{"vatCode":"FI-RED1","vatRate":0.1350,"deductible":true}',
   'Demo-sääntö. Verokanta vahvistettava virallisesta lähteestä ennen tuotantokäyttöä.'),

  ('vat-fi-alcohol', '2026.1', 'demo', 10, '2026-01-01',
   '{"jurisdiction":"FI","category":["alcohol"],"crossBorder":false}',
   '{"vatCode":"FI-STD","vatRate":0.2550,"deductible":true}',
   'Demo-sääntö. Alkoholi ei kuulu ruoan alennettuun kantaan.'),

  ('vat-fi-reduced-transport', '2026.1', 'demo', 25, '2026-01-01',
   '{"jurisdiction":"FI","category":["passenger_transport","books","medicine"],"crossBorder":false}',
   '{"vatCode":"FI-RED2","vatRate":0.1000,"deductible":true}',
   'Demo-sääntö.'),

  ('vat-fi-service', '2026.1', 'demo', 60, '2026-01-01',
   '{"jurisdiction":"FI","supplyType":"service","crossBorder":false}',
   '{"vatCode":"FI-STD","vatRate":0.2550,"deductible":true}',
   'Demo-sääntö. Yleinen verokanta kotimaiselle palvelulle.'),

  ('vat-fi-goods', '2026.1', 'demo', 61, '2026-01-01',
   '{"jurisdiction":"FI","supplyType":"goods","crossBorder":false}',
   '{"vatCode":"FI-STD","vatRate":0.2550,"deductible":true}',
   'Demo-sääntö. Yleinen verokanta kotimaiselle tavaralle.'),

  ('vat-fi-rc-eu-b2b', '2026.1', 'demo', 5, '2026-01-01',
   '{"jurisdiction":"FI","crossBorder":true,"buyerInEu":true,"buyerType":"business","buyerVatIdValid":true}',
   '{"vatCode":"FI-RC-EU","vatRate":0,"reverseCharge":true,"deductible":true}',
   'Demo-sääntö. Edellyttää voimassa olevaa VIES-tarkistusta; pelkkä muodollisesti oikea tunniste ei riitä.'),

  ('vat-fi-export-non-eu', '2026.1', 'demo', 6, '2026-01-01',
   '{"jurisdiction":"FI","crossBorder":true,"buyerInEu":false}',
   '{"vatCode":"FI-EXP","vatRate":0,"deductible":true}',
   'Demo-sääntö. Vientinäyttö vaaditaan erikseen.'),

  ('vat-fi-oss-distance', '2026.1', 'demo', 7, '2026-01-01',
   '{"jurisdiction":"FI","crossBorder":true,"buyerInEu":true,"buyerType":"consumer"}',
   '{"vatCode":"FI-OSS","requiresReview":true}',
   'Demo-sääntö. Ostajan maan verokanta ratkaisee; vaatii aina tarkistuksen.'),

  ('vat-fi-tips', '2026.1', 'demo', 15, '2026-01-01',
   '{"jurisdiction":"FI","category":["tip"]}',
   '{"vatCode":"FI-EXPT","requiresReview":true}',
   'Demo-sääntö. Tipin käsittely riippuu siitä onko se vapaaehtoinen ja kenelle se päätyy.'),

  ('vat-fi-giftcard', '2026.1', 'demo', 16, '2026-01-01',
   '{"jurisdiction":"FI","category":["gift_card"]}',
   '{"vatCode":"FI-EXPT","requiresReview":true}',
   'Demo-sääntö. Monikäyttöisen lahjakortin myynti ei yleensä ole ALV-tapahtuma, yksikäyttöisen on.'),

  ('vat-fi-deposit', '2026.1', 'demo', 17, '2026-01-01',
   '{"jurisdiction":"FI","category":["deposit"]}',
   '{"vatCode":"FI-EXPT","requiresReview":true}',
   'Demo-sääntö. Kierrätyspantin käsittely vahvistettava.'),

  ('vat-fi-packaging', '2026.1', 'demo', 30, '2026-01-01',
   '{"jurisdiction":"FI","category":["packaging","delivery_fee"],"crossBorder":false}',
   '{"vatCode":"FI-STD","vatRate":0.2550,"deductible":true,"requiresReview":true}',
   'Demo-sääntö. Liitännäiskulu seuraa usein pääsuoritteen kantaa — vaatii tarkistuksen.'),

  ('ded-fi-entertainment', '2026.1', 'demo', 40, '2026-01-01',
   '{"jurisdiction":"FI","category":["business_entertainment"]}',
   '{"vatCode":"FI-ND","deductible":false,"requiresReview":true}',
   'Demo-sääntö. Edustuskulujen vähennysoikeus on rajoitettu.'),

  ('ded-fi-employee-meal', '2026.1', 'demo', 41, '2026-01-01',
   '{"jurisdiction":"FI","category":["employee_meal"]}',
   '{"vatCode":"FI-RED1","vatRate":0.1350,"requiresReview":true}',
   'Demo-sääntö. Ateriaedun käsittely riippuu järjestelystä.')
on conflict (rule_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- Sääntötestit (§49) — ajetaan myös vitestillä lib/tax/__tests__
-- ---------------------------------------------------------------------------

insert into tax_rule_tests (rule_id, name, kind, input_facts, expected) values
  ('vat-fi-food', 'Ravintolaruoka kotimaassa', 'normal',
   '{"jurisdiction":"FI","category":"food","supplyType":"goods","crossBorder":false}',
   '{"vatCode":"FI-RED1","outcome":"determined"}'),

  ('vat-fi-alcohol', 'Alkoholi ei saa ruoan kantaa', 'edge',
   '{"jurisdiction":"FI","category":"alcohol","supplyType":"goods","crossBorder":false}',
   '{"vatCode":"FI-STD","outcome":"determined"}'),

  ('vat-fi-rc-eu-b2b', 'EU B2B ilman VIES-vahvistusta ei mene käännetylle', 'boundary',
   '{"jurisdiction":"FI","crossBorder":true,"buyerInEu":true,"buyerType":"business","buyerVatIdValid":false}',
   '{"outcome":"needs_review"}')
on conflict do nothing;
