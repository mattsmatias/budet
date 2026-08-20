-- Verra — verosäännöt, päätökset, VIES, audit trail, review, exportit.
--
-- Keskeinen periaate: verotuspäätös on muuttumaton tietue joka viittaa
-- sääntöversioon. Sääntöä ei koskaan poisteta eikä hyväksyttyä päätöstä
-- koskaan kirjoiteta hiljaisesti yli (§12, §14).

create type rule_status as enum (
  'demo',        -- havainnollistava, ei validoitu virallista lähdettä vasten
  'draft',
  'review',
  'validated',
  'active',
  'deprecated'
);

create type decision_outcome as enum (
  'determined',       -- sääntö tuotti päätöksen
  'needs_review',     -- ei voitu ratkaista turvallisesti
  'not_applicable'
);

create type vies_status as enum ('valid', 'invalid', 'unavailable', 'format_error', 'not_checked');

create type review_state as enum ('open', 'assigned', 'resolved', 'rejected');

create type export_format as enum ('csv', 'excel_csv', 'saft', 'procountor', 'netvisor', 'economic');

create type export_state as enum ('draft', 'blocked', 'ready', 'delivered', 'failed');

-- ---------------------------------------------------------------------------
-- Jurisdiktiot ja ALV-koodit
-- ---------------------------------------------------------------------------

create table jurisdictions (
  code char(2) primary key,             -- 'FI', 'DE', ...
  name text not null,
  is_eu boolean not null default false,
  currency char(3) not null default 'EUR',
  created_at timestamptz not null default now()
);

create table vat_codes (
  id uuid primary key default gen_random_uuid(),
  jurisdiction char(2) not null references jurisdictions (code) on delete restrict,
  code text not null,                   -- kirjanpidon ALV-koodi
  name text not null,
  description text,
  rate numeric(6, 4),                   -- null = ei kiinteää kantaa (esim. käännetty verovelvollisuus)
  reverse_charge boolean not null default false,
  deductible boolean,
  created_at timestamptz not null default now(),
  unique (jurisdiction, code)
);

-- ---------------------------------------------------------------------------
-- Säännöt ja versiot
-- ---------------------------------------------------------------------------

-- tax_rules on sääntöperhe (esim. vat-fi-food). Varsinainen sisältö on
-- versioissa, joilla on voimassaoloaika.
create table tax_rules (
  id text primary key,                  -- 'vat-fi-food'
  jurisdiction char(2) not null references jurisdictions (code) on delete restrict,
  name text not null,
  description text,
  category text,                        -- 'vat' | 'mileage' | 'per_diem' | 'deductibility'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tax_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null references tax_rules (id) on delete restrict,
  version text not null,                -- '2026.1'
  status rule_status not null default 'draft',
  priority int not null default 100,    -- pienempi = arvioidaan ensin
  effective_from date not null,
  effective_to date,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  exceptions jsonb not null default '[]'::jsonb,
  legal_reference text,                 -- virallinen lähde, jos validoitu
  source_url text,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  approved_by uuid references profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, version),
  constraint rule_versions_period check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on table tax_rule_versions is
  'Sääntöversioita ei poisteta. Käytöstä poistuva versio saa statuksen deprecated ja effective_to-päivän.';
comment on column tax_rule_versions.legal_reference is
  'Täytetään vasta kun sääntö on validoitu virallista lähdettä vasten. Demo-säännöillä null.';

create index tax_rule_versions_lookup_idx
  on tax_rule_versions (rule_id, status, effective_from desc);

-- Sääntöjen regressiotestit (§12, §49). Ajetaan myös tuotannossa
-- admin-paneelista ennen version julkaisua.
create table tax_rule_tests (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null references tax_rules (id) on delete cascade,
  name text not null,
  kind text not null default 'normal',  -- 'normal' | 'edge' | 'invalid' | 'boundary'
  input_facts jsonb not null,
  expected jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Verotuspäätökset
-- ---------------------------------------------------------------------------

-- Yksi rivi per rivikohtainen päätös. Dokumentilla voi olla useita
-- ALV-käsittelyjä samanaikaisesti (§11).
create table tax_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  line_item_id uuid references document_line_items (id) on delete cascade,

  rule_id text references tax_rules (id) on delete restrict,
  rule_version text,
  rule_version_id uuid references tax_rule_versions (id) on delete restrict,
  engine_version text not null,
  jurisdiction char(2) references jurisdictions (code) on delete restrict,
  effective_from date,
  effective_to date,

  outcome decision_outcome not null,
  vat_code text,
  vat_rate numeric(6, 4),
  vat_amount_cents bigint,
  deductible boolean,
  deductible_share numeric(5, 4),       -- osittain vähennyskelpoiset
  reverse_charge boolean not null default false,

  input_facts jsonb not null,           -- normalisoidut faktat, joilla päätös tehtiin
  reason text not null,                 -- ihmisluettava perustelu
  source_reference text,
  confidence confidence_band not null,
  confidence_score numeric(5, 4),

  -- Uudelleenajo (§14): historiallista päätöstä ei ylikirjoiteta, vaan
  -- uusi päätös viittaa edeltäjäänsä.
  supersedes_id uuid references tax_decisions (id) on delete set null,
  is_current boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null
);

comment on column tax_decisions.input_facts is
  'Normalisoidut faktat sellaisenaan. Sama input + sama sääntöversio = sama päätös (§2).';
comment on column tax_decisions.supersedes_id is
  'Uudelleenajossa syntynyt päätös osoittaa korvaamaansa. Vanhaa riviä ei muuteta.';

create index tax_decisions_document_idx on tax_decisions (document_id) where is_current;
create index tax_decisions_org_idx on tax_decisions (org_id, created_at desc);
create index tax_decisions_rule_idx on tax_decisions (rule_id, rule_version);

-- ---------------------------------------------------------------------------
-- VIES
-- ---------------------------------------------------------------------------

create table vies_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid references documents (id) on delete set null,
  vat_id text not null,
  country char(2) not null,
  status vies_status not null,
  company_name text,
  company_address text,
  request_payload jsonb,
  response_payload jsonb,
  consultation_number text,             -- VIESin virallinen kuittausnumero
  checked_at timestamptz not null default now(),
  provider text not null default 'mock',
  error_message text,
  created_at timestamptz not null default now()
);

comment on table vies_checks is
  'Kelvollinen VAT-tunniste ei yksin ratkaise käännettyä verovelvollisuutta — sääntömoottori arvioi koko tapahtuman (§17).';

create index vies_checks_vat_id_idx on vies_checks (vat_id, checked_at desc);
create index vies_checks_document_idx on vies_checks (document_id);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

-- Vain lisäys. Muokkaus ja poisto estetään liipaisimella ja RLS:llä (§13).
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  action text not null,                 -- 'document.uploaded', 'rule.applied', ...
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  source text not null default 'app',   -- 'app' | 'api' | 'system' | 'admin'
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_org_time_idx on audit_events (org_id, created_at desc);
create index audit_events_entity_idx on audit_events (entity_type, entity_id);

create or replace function reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events on muuttumaton: % ei ole sallittu', tg_op;
end;
$$;

create trigger audit_events_no_update before update on audit_events
  for each row execute function reject_audit_mutation();
create trigger audit_events_no_delete before delete on audit_events
  for each row execute function reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- Review-työjono
-- ---------------------------------------------------------------------------

create table reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  state review_state not null default 'open',
  reasons text[] not null default '{}',
  assigned_to uuid references profiles (id) on delete set null,
  resolved_by uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_org_state_idx on reviews (org_id, state);

create table comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid references documents (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exportit
-- ---------------------------------------------------------------------------

create table exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  format export_format not null,
  state export_state not null default 'draft',
  period_start date,
  period_end date,
  storage_path text,
  row_count int not null default 0,
  blocked_reasons jsonb not null default '[]'::jsonb,
  override_by uuid references profiles (id) on delete set null,
  override_reason text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

comment on column exports.blocked_reasons is
  'Täsmälliset syyt joiden takia export on estetty (§51). Tyhjä lista = ei esteitä.';

create table export_items (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references exports (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null references documents (id) on delete restrict,
  tax_decision_id uuid references tax_decisions (id) on delete restrict,
  row_data jsonb not null,
  created_at timestamptz not null default now()
);

create index export_items_export_idx on export_items (export_id);

-- ---------------------------------------------------------------------------
-- Matkat
-- ---------------------------------------------------------------------------

create table trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  trip_date date not null,
  origin text,
  destination text,
  purpose text,
  kilometers numeric(10, 2),
  vehicle text,
  mileage_rule_id text references tax_rules (id) on delete set null,
  mileage_rule_version text,
  mileage_rate_cents int,
  per_diem_rule_id text references tax_rules (id) on delete set null,
  per_diem_rule_version text,
  per_diem_cents int,
  meal_deduction_cents int not null default 0,
  total_reimbursement_cents bigint not null default 0,
  raw_input text,                       -- käyttäjän vapaa teksti (§25)
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column trips.mileage_rate_cents is
  'Kilometrikorvaus tallennetaan päätöshetken sääntöversiosta, ei kovakoodattuna.';

create table trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid references documents (id) on delete set null,
  description text,
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ilmoitukset
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Liipaisimet
-- ---------------------------------------------------------------------------

create trigger tax_rules_touch before update on tax_rules
  for each row execute function touch_updated_at();
create trigger tax_rule_versions_touch before update on tax_rule_versions
  for each row execute function touch_updated_at();
create trigger tax_rule_tests_touch before update on tax_rule_tests
  for each row execute function touch_updated_at();
create trigger reviews_touch before update on reviews
  for each row execute function touch_updated_at();
create trigger comments_touch before update on comments
  for each row execute function touch_updated_at();
create trigger exports_touch before update on exports
  for each row execute function touch_updated_at();
create trigger trips_touch before update on trips
  for each row execute function touch_updated_at();
