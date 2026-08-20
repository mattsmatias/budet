-- Verra — kaikki migraatiot yhtenä tiedostona.
--
-- Liitä tämä kokonaisuudessaan Supabasen SQL Editoriin ja paina Run.
-- Aja VAIN KERRAN tyhjään projektiin. Tiedosto on koottu hakemistosta
-- supabase/migrations/ — älä muokkaa tätä, vaan lähdetiedostoja.
--
-- Koottu: 2026-08-20 18:16 UTC

begin;


-- ===========================================================================
-- 0001_foundation.sql
-- ===========================================================================

-- Verra — perustus: organisaatiot, käyttäjät, roolit, tenant-eristys.
--
-- Jokainen taulu kuuluu organisaatioon (tenant). Tenant-eristys hoidetaan
-- RLS-politiikoilla migraatiossa 0004; tässä luodaan rakenteet ja apufunktiot
-- joihin politiikat nojaavat.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Luettelotyypit
-- ---------------------------------------------------------------------------

create type org_kind as enum (
  'company',           -- tavallinen yritysasiakas
  'accounting_firm'    -- tilitoimisto, jolla on asiakasorganisaatioita
);

create type member_role as enum (
  'business_owner',
  'accountant',
  'firm_admin',
  'firm_staff',
  'company_admin',
  'employee',
  'super_admin'
);

create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- ---------------------------------------------------------------------------
-- Organisaatiot
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  kind org_kind not null default 'company',
  name text not null,
  business_id text,                      -- Y-tunnus tai vastaava
  vat_id text,                           -- ALV-tunniste, esim. FI12345678
  country char(2) not null,              -- ISO 3166-1 alpha-2
  base_currency char(3) not null default 'EUR',
  accounting_software text,
  vat_registered boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column organizations.is_demo is
  'Demo-organisaation data on merkittävä käyttöliittymässä selvästi demoksi (§47).';

create index organizations_country_idx on organizations (country);

-- Tilitoimiston ja asiakasorganisaation välinen suhde. Tämä on ainoa
-- mekanismi, jolla käyttäjä pääsee toisen organisaation dataan.
create table accounting_relationships (
  id uuid primary key default gen_random_uuid(),
  firm_org_id uuid not null references organizations (id) on delete cascade,
  client_org_id uuid not null references organizations (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_relationships_distinct check (firm_org_id <> client_org_id),
  unique (firm_org_id, client_org_id)
);

create index accounting_relationships_client_idx
  on accounting_relationships (client_org_id) where active;

-- ---------------------------------------------------------------------------
-- Jäsenyydet
-- ---------------------------------------------------------------------------

-- auth.users on Supabase Authin hallinnoima. Profiilitiedot omaan tauluun.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'fi',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column profiles.locale is
  'Ohjaa Timon vastauskielen (§16). Ei vaikuta itse verotuspäätökseen.';

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index organization_members_user_idx on organization_members (user_id);
create index organization_members_org_idx on organization_members (org_id);

-- Tilitoimiston työntekijän rajaus tiettyihin asiakkaisiin. Jos rivejä ei ole,
-- firm_admin näkee kaikki asiakkaat; firm_staff ei näe mitään ilman rajausta.
create table client_assignments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references accounting_relationships (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (relationship_id, user_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  email text not null,
  role member_role not null,
  invited_by uuid references profiles (id) on delete set null,
  token_hash text not null unique,
  status invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column invitations.token_hash is
  'Vain kutsutunnisteen tiiviste. Selkokielistä tokenia ei tallenneta.';

create index invitations_email_idx on invitations (lower(email));

-- ---------------------------------------------------------------------------
-- Apufunktiot RLS-politiikoille
-- ---------------------------------------------------------------------------

-- Organisaatiot, joihin nykyinen käyttäjä kuuluu suoraan.
create or replace function current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from organization_members where user_id = auth.uid();
$$;

-- Asiakasorganisaatiot, joihin nykyisellä käyttäjällä on pääsy
-- tilitoimistosuhteen kautta. firm_staff näkee vain hänelle osoitetut.
create or replace function current_user_client_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.client_org_id
  from accounting_relationships r
  join organization_members m on m.org_id = r.firm_org_id
  where r.active
    and m.user_id = auth.uid()
    and (
      m.role in ('firm_admin', 'accountant')
      or exists (
        select 1 from client_assignments a
        where a.relationship_id = r.id and a.user_id = auth.uid()
      )
    );
$$;

-- Kaikki organisaatiot joihin käyttäjällä on lukuoikeus.
create or replace function current_user_accessible_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from organization_members where user_id = auth.uid()
  union
  select * from current_user_client_org_ids();
$$;

create or replace function current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- Onko käyttäjällä jokin annetuista rooleista organisaatiossa?
create or replace function current_user_has_role(target_org uuid, roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org
      and user_id = auth.uid()
      and role = any (roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at-liipaisin
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on organizations
  for each row execute function touch_updated_at();
create trigger accounting_relationships_touch before update on accounting_relationships
  for each row execute function touch_updated_at();
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();
create trigger organization_members_touch before update on organization_members
  for each row execute function touch_updated_at();
create trigger invitations_touch before update on invitations
  for each row execute function touch_updated_at();

-- ===========================================================================
-- 0002_documents.sql
-- ===========================================================================

-- Verra — dokumentit, poiminta ja rivit.
--
-- Dokumentin elinkaari: received → processing → processed → needs_review
-- → approved / rejected → exported. Virhetila error on erillinen.

create type document_status as enum (
  'received',
  'processing',
  'processed',
  'needs_review',
  'approved',
  'rejected',
  'exported',
  'error'
);

create type document_kind as enum (
  'receipt',
  'invoice',
  'credit_note',
  'daily_report',
  'travel_expense',
  'other',
  'unknown'
);

create type document_source as enum ('upload', 'mobile', 'email', 'api', 'demo');

create type confidence_band as enum ('high', 'medium', 'low');

-- ---------------------------------------------------------------------------
-- Dokumentit
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  status document_status not null default 'received',
  kind document_kind not null default 'unknown',
  source document_source not null default 'upload',

  -- Toimittaja / kauppias
  supplier_name text,
  supplier_vat_id text,
  supplier_country char(2),
  supplier_address text,

  -- Tunnisteet ja päivämäärät
  document_number text,
  document_date date,
  due_date date,

  -- Rahamäärät pienimmässä yksikössä (sentteinä) kokonaislukuina, jotta
  -- liukulukupyöristys ei koskaan vaikuta verotuspäätökseen.
  currency char(3) not null default 'EUR',
  exchange_rate numeric(18, 8),
  net_amount_cents bigint,
  vat_amount_cents bigint,
  gross_amount_cents bigint,

  payment_method text,

  -- Luottamus ja käsittely
  confidence confidence_band,
  confidence_score numeric(5, 4),
  needs_review boolean not null default false,
  review_reasons text[] not null default '{}',

  assigned_to uuid references profiles (id) on delete set null,
  uploaded_by uuid references profiles (id) on delete set null,

  is_demo boolean not null default false,
  processing_error text,
  processed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references profiles (id) on delete set null,
  exported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documents_amounts_nonneg check (
    coalesce(net_amount_cents, 0) >= 0
    and coalesce(vat_amount_cents, 0) >= 0
    and coalesce(gross_amount_cents, 0) >= 0
  ),
  constraint documents_confidence_range check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  )
);

comment on column documents.net_amount_cents is
  'Rahamäärät sentteinä kokonaislukuina — ei liukulukuja verolaskennassa.';
comment on column documents.review_reasons is
  'Koneluettavat syyt sille miksi dokumentti on merkitty tarkistettavaksi (§23).';

create index documents_org_status_idx on documents (org_id, status);
create index documents_org_date_idx on documents (org_id, document_date desc);
create index documents_needs_review_idx on documents (org_id) where needs_review;
create index documents_supplier_idx on documents (org_id, lower(supplier_name));
create index documents_vat_id_idx on documents (supplier_vat_id) where supplier_vat_id is not null;

-- Vapaa tekstihaku toimittajan, numeron ja ALV-tunnisteen yli (§57).
create index documents_search_idx on documents using gin (
  to_tsvector(
    'simple',
    coalesce(supplier_name, '') || ' ' ||
    coalesce(document_number, '') || ' ' ||
    coalesce(supplier_vat_id, '')
  )
);

-- ---------------------------------------------------------------------------
-- Tiedostot
-- ---------------------------------------------------------------------------

create table document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  storage_path text not null,           -- polku 'documents'-bucketissa, ei julkinen
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,                 -- duplikaattien tunnistus (§8)
  page_count int,
  created_at timestamptz not null default now(),
  constraint document_files_size_positive check (byte_size > 0)
);

-- Sama tiedosto samaan organisaatioon vain kerran.
create unique index document_files_org_hash_idx on document_files (org_id, sha256);
create index document_files_document_idx on document_files (document_id);

create table document_pages (
  id uuid primary key default gen_random_uuid(),
  document_file_id uuid not null references document_files (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  page_number int not null,
  width int,
  height int,
  ocr_text text,
  created_at timestamptz not null default now(),
  unique (document_file_id, page_number)
);

-- ---------------------------------------------------------------------------
-- Poimitut kentät
-- ---------------------------------------------------------------------------

-- Jokainen poimittu kenttä säilyttää arvon, luottamuksen, sijainnin ja
-- poimintamenetelmän erikseen (§9), jotta lähde on jäljitettävissä.
create table document_fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  field_key text not null,              -- esim. 'supplier_vat_id'
  value_text text,
  value_number numeric(20, 6),
  value_date date,
  confidence numeric(5, 4),
  extraction_method text,               -- 'ocr' | 'llm' | 'manual' | 'derived'
  page_number int,
  bbox jsonb,                           -- {x, y, width, height} tulevia korostuksia varten
  is_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, field_key)
);

comment on column document_fields.bbox is
  'Varattu dokumenttiesikatselun korostuksille. Voi olla null.';

-- ---------------------------------------------------------------------------
-- Rivit
-- ---------------------------------------------------------------------------

create table document_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  line_number int not null,
  description text,
  category text,                        -- luokittelijan antama, esim. 'food'
  quantity numeric(20, 6),
  unit_price_cents bigint,
  net_amount_cents bigint not null default 0,
  vat_rate numeric(6, 4),               -- 0.1350 = 13,5 %
  vat_amount_cents bigint not null default 0,
  gross_amount_cents bigint not null default 0,
  confidence numeric(5, 4),
  is_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, line_number),
  constraint line_items_vat_rate_range check (
    vat_rate is null or (vat_rate >= 0 and vat_rate <= 1)
  )
);

comment on column document_line_items.vat_rate is
  'Osuutena, ei prosentteina: 13,5 % tallennetaan arvona 0.1350.';

create index document_line_items_document_idx on document_line_items (document_id, line_number);

-- ---------------------------------------------------------------------------
-- Liipaisimet
-- ---------------------------------------------------------------------------

create trigger documents_touch before update on documents
  for each row execute function touch_updated_at();
create trigger document_fields_touch before update on document_fields
  for each row execute function touch_updated_at();
create trigger document_line_items_touch before update on document_line_items
  for each row execute function touch_updated_at();

-- ===========================================================================
-- 0003_tax_engine.sql
-- ===========================================================================

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

-- ===========================================================================
-- 0004_billing.sql
-- ===========================================================================

-- Verra — tilaukset, käyttörajat, integraatiot, sähköpostivastaanotto.
--
-- Rajat ja hinnat tulevat tietokannasta, eivät koodista (§29, §61).
-- Palvelin validoi oikeudet; selaimen tarkistus on vain käyttöliittymän apu (§30).

create type subscription_state as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete'
);

create type billing_interval as enum ('month', 'year');

-- ---------------------------------------------------------------------------
-- Suunnitelmat
-- ---------------------------------------------------------------------------

create table plans (
  id text primary key,                  -- 'free' | 'solo' | 'business' | 'growth' | 'firm'
  name text not null,
  description text,
  monthly_price_cents int not null default 0,
  yearly_price_cents int,
  currency char(3) not null default 'EUR',
  stripe_price_id_monthly text,
  stripe_price_id_yearly text,
  -- Asiakaskohtainen lisähinta tilitoimistoille (§29).
  per_client_price_cents int,
  sort_order int not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rajat omana tauluna, jotta uusi raja ei vaadi skeemamuutosta.
create table plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references plans (id) on delete cascade,
  key text not null,                    -- 'documents_per_month', 'ai_questions_per_month', ...
  limit_value int,                      -- null = rajaton
  bool_value boolean,                   -- ominaisuuslippu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, key)
);

comment on column plan_entitlements.limit_value is
  'null tarkoittaa rajatonta. Rajoja ei kovakoodata käyttöliittymään.';

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  plan_id text not null references plans (id) on delete restrict,
  state subscription_state not null default 'trialing',
  interval billing_interval not null default 'month',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create index subscriptions_stripe_idx on subscriptions (stripe_subscription_id);

-- Käyttömäärät laskutuskausittain. Lisäys on idempotentti entity_id:n kautta.
create table usage_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  metric text not null,                 -- 'documents' | 'ai_questions' | 'vies_checks'
  period_start date not null,
  quantity int not null default 1,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- Sama dokumentti ei kasvata käyttöä kahdesti vaikka käsittely ajettaisiin uudelleen.
create unique index usage_records_idempotency_idx
  on usage_records (org_id, metric, entity_type, entity_id)
  where entity_id is not null;

create index usage_records_period_idx on usage_records (org_id, metric, period_start);

-- ---------------------------------------------------------------------------
-- Integraatiot
-- ---------------------------------------------------------------------------

create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  provider text not null,               -- 'procountor' | 'netvisor' | 'economic'
  status text not null default 'disconnected',
  settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

-- Salaisuudet erillään asetuksista. Tätä taulua ei koskaan lueta selaimeen:
-- RLS estää kaiken asiakaspääsyn, käsittely vain service roolilla (§35).
create table integration_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  encrypted_payload text not null,
  key_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table integration_credentials is
  'Ei koskaan selaimeen. RLS kieltää kaiken pääsyn; vain palvelinpuoli service rolella.';

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,             -- näytetään käyttöliittymässä
  key_hash text not null unique,        -- vain tiiviste
  created_by uuid references profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sähköpostivastaanotto
-- ---------------------------------------------------------------------------

create table email_ingestion (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  inbound_address text not null unique, -- esim. receipts+abc123@verra.app
  active boolean not null default true,
  allowed_senders text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  ingestion_id uuid references email_ingestion (id) on delete set null,
  message_id text,                      -- RFC 5322 Message-ID, duplikaattisuoja
  from_address text,
  subject text,
  received_at timestamptz not null default now(),
  attachment_count int not null default 0,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create unique index email_messages_dedup_idx on email_messages (org_id, message_id)
  where message_id is not null;

-- ---------------------------------------------------------------------------
-- Käsittelyjono
-- ---------------------------------------------------------------------------

-- Kevyt jonotaulu taustakäsittelylle (§46). Idempotenssiavain estää
-- saman työn kahdesti; yritykset ja viimeisin virhe tallennetaan.
create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  job_type text not null,               -- 'ocr' | 'classify' | 'vies' | 'export'
  document_id uuid references documents (id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'queued', -- queued | running | succeeded | failed
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create index processing_jobs_queue_idx on processing_jobs (status, scheduled_for)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- Liipaisimet
-- ---------------------------------------------------------------------------

create trigger plans_touch before update on plans
  for each row execute function touch_updated_at();
create trigger plan_entitlements_touch before update on plan_entitlements
  for each row execute function touch_updated_at();
create trigger subscriptions_touch before update on subscriptions
  for each row execute function touch_updated_at();
create trigger integrations_touch before update on integrations
  for each row execute function touch_updated_at();
create trigger integration_credentials_touch before update on integration_credentials
  for each row execute function touch_updated_at();
create trigger email_ingestion_touch before update on email_ingestion
  for each row execute function touch_updated_at();
create trigger processing_jobs_touch before update on processing_jobs
  for each row execute function touch_updated_at();

-- ===========================================================================
-- 0005_rls.sql
-- ===========================================================================

-- Verra — Row Level Security.
--
-- Lähtökohta: kaikki taulut kiinni, pääsy avataan erikseen. Käyttäjä näkee
-- vain oman organisaationsa datan tai asiakasorganisaation johon hänellä on
-- pääsy tilitoimistosuhteen kautta (§3, §35).
--
-- Huom: service role ohittaa RLS:n. Palvelinpuolen koodi, joka käyttää
-- service rolea, vastaa itse tenant-rajauksesta.

-- ---------------------------------------------------------------------------
-- RLS päälle kaikkiin
-- ---------------------------------------------------------------------------

alter table organizations            enable row level security;
alter table accounting_relationships enable row level security;
alter table profiles                 enable row level security;
alter table organization_members     enable row level security;
alter table client_assignments       enable row level security;
alter table invitations              enable row level security;

alter table documents                enable row level security;
alter table document_files           enable row level security;
alter table document_pages           enable row level security;
alter table document_fields          enable row level security;
alter table document_line_items      enable row level security;

alter table jurisdictions            enable row level security;
alter table vat_codes                enable row level security;
alter table tax_rules                enable row level security;
alter table tax_rule_versions        enable row level security;
alter table tax_rule_tests           enable row level security;
alter table tax_decisions            enable row level security;
alter table vies_checks              enable row level security;
alter table audit_events             enable row level security;
alter table reviews                  enable row level security;
alter table comments                 enable row level security;
alter table exports                  enable row level security;
alter table export_items             enable row level security;
alter table trips                    enable row level security;
alter table trip_expenses            enable row level security;
alter table notifications            enable row level security;

alter table plans                    enable row level security;
alter table plan_entitlements        enable row level security;
alter table subscriptions            enable row level security;
alter table usage_records            enable row level security;
alter table integrations             enable row level security;
alter table integration_credentials  enable row level security;
alter table api_keys                 enable row level security;
alter table email_ingestion          enable row level security;
alter table email_messages           enable row level security;
alter table processing_jobs          enable row level security;

-- ---------------------------------------------------------------------------
-- Organisaatiot ja jäsenyydet
-- ---------------------------------------------------------------------------

create policy organizations_select on organizations
  for select to authenticated
  using (id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());

create policy organizations_update on organizations
  for update to authenticated
  using (current_user_has_role(id, array['company_admin', 'business_owner', 'firm_admin']::member_role[]))
  with check (current_user_has_role(id, array['company_admin', 'business_owner', 'firm_admin']::member_role[]));

-- Uuden organisaation luonti kulkee palvelinpuolen kautta (service role),
-- jotta jäsenyys ja tilaus syntyvät samassa transaktiossa.

create policy profiles_select_self on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or current_user_is_super_admin()
    -- saman organisaation jäsenet näkevät toistensa perustiedot
    or exists (
      select 1 from organization_members m
      where m.user_id = profiles.id
        and m.org_id in (select current_user_accessible_org_ids())
    )
  );

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_super_admin = (select is_super_admin from profiles where id = auth.uid()));

create policy organization_members_select on organization_members
  for select to authenticated
  using (org_id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());

create policy organization_members_manage on organization_members
  for all to authenticated
  using (current_user_has_role(org_id, array['company_admin', 'business_owner', 'firm_admin']::member_role[]))
  with check (current_user_has_role(org_id, array['company_admin', 'business_owner', 'firm_admin']::member_role[]));

create policy accounting_relationships_select on accounting_relationships
  for select to authenticated
  using (
    firm_org_id in (select current_user_org_ids())
    or client_org_id in (select current_user_org_ids())
    or current_user_is_super_admin()
  );

create policy accounting_relationships_manage on accounting_relationships
  for all to authenticated
  using (current_user_has_role(firm_org_id, array['firm_admin', 'accountant']::member_role[]))
  with check (current_user_has_role(firm_org_id, array['firm_admin', 'accountant']::member_role[]));

create policy client_assignments_select on client_assignments
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from accounting_relationships r
      where r.id = client_assignments.relationship_id
        and current_user_has_role(r.firm_org_id, array['firm_admin']::member_role[])
    )
  );

create policy client_assignments_manage on client_assignments
  for all to authenticated
  using (
    exists (
      select 1 from accounting_relationships r
      where r.id = client_assignments.relationship_id
        and current_user_has_role(r.firm_org_id, array['firm_admin']::member_role[])
    )
  )
  with check (
    exists (
      select 1 from accounting_relationships r
      where r.id = client_assignments.relationship_id
        and current_user_has_role(r.firm_org_id, array['firm_admin']::member_role[])
    )
  );

create policy invitations_manage on invitations
  for all to authenticated
  using (current_user_has_role(org_id, array['company_admin', 'business_owner', 'firm_admin', 'accountant']::member_role[]))
  with check (current_user_has_role(org_id, array['company_admin', 'business_owner', 'firm_admin', 'accountant']::member_role[]));

-- ---------------------------------------------------------------------------
-- Tenant-taulut: yhtenäinen org_id-pohjainen politiikka
-- ---------------------------------------------------------------------------

-- Luetaan jos org on saavutettavissa; kirjoitetaan jos org on saavutettavissa
-- eikä rooli ole pelkkä employee. Työntekijä saa luoda dokumentteja mutta ei
-- muokata muiden aineistoa — se rajataan sovelluslogiikassa ja alla
-- documents-taulun omassa politiikassa.

do $$
declare
  t text;
  tenant_tables text[] := array[
    'document_files', 'document_pages', 'document_fields', 'document_line_items',
    'vies_checks', 'reviews', 'comments', 'exports', 'export_items',
    'trips', 'trip_expenses', 'usage_records', 'processing_jobs',
    'email_ingestion', 'email_messages', 'integrations'
  ];
begin
  foreach t in array tenant_tables loop
    execute format($f$
      create policy %1$s_select on %1$s
        for select to authenticated
        using (org_id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());
    $f$, t);

    execute format($f$
      create policy %1$s_write on %1$s
        for all to authenticated
        using (org_id in (select current_user_accessible_org_ids()))
        with check (org_id in (select current_user_accessible_org_ids()));
    $f$, t);
  end loop;
end $$;

-- Dokumentit: työntekijä näkee vain omat lataamansa, muut roolit koko organisaation.
create policy documents_select on documents
  for select to authenticated
  using (
    current_user_is_super_admin()
    or (
      org_id in (select current_user_accessible_org_ids())
      and (
        not current_user_has_role(org_id, array['employee']::member_role[])
        or uploaded_by = auth.uid()
      )
    )
  );

create policy documents_insert on documents
  for insert to authenticated
  with check (org_id in (select current_user_accessible_org_ids()));

create policy documents_update on documents
  for update to authenticated
  using (
    org_id in (select current_user_accessible_org_ids())
    and (
      not current_user_has_role(org_id, array['employee']::member_role[])
      or uploaded_by = auth.uid()
    )
  )
  with check (org_id in (select current_user_accessible_org_ids()));

-- Verotuspäätökset: luettavissa, mutta ei muokattavissa käyttöliittymästä.
-- Uusi päätös syntyy aina uutena rivinä palvelinpuolen moottorin kautta (§14).
create policy tax_decisions_select on tax_decisions
  for select to authenticated
  using (org_id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());

-- Audit trail: luku sallittu, kirjoitus vain palvelinpuolelta.
-- Lisäksi liipaisimet estävät update/delete kaikilta rooleilta.
create policy audit_events_select on audit_events
  for select to authenticated
  using (org_id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());

create policy notifications_select on notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Sääntökirjasto: luettavissa kaikille kirjautuneille, kirjoitus vain admin
-- ---------------------------------------------------------------------------

create policy jurisdictions_read on jurisdictions
  for select to authenticated using (true);
create policy vat_codes_read on vat_codes
  for select to authenticated using (true);
create policy tax_rules_read on tax_rules
  for select to authenticated using (true);
create policy tax_rule_tests_read on tax_rule_tests
  for select to authenticated using (true);

-- Vain julkaistut sääntöversiot näkyvät tavallisille käyttäjille.
create policy tax_rule_versions_read on tax_rule_versions
  for select to authenticated
  using (status in ('demo', 'validated', 'active', 'deprecated') or current_user_is_super_admin());

create policy tax_rules_admin on tax_rules
  for all to authenticated
  using (current_user_is_super_admin()) with check (current_user_is_super_admin());
create policy tax_rule_versions_admin on tax_rule_versions
  for all to authenticated
  using (current_user_is_super_admin()) with check (current_user_is_super_admin());

-- ---------------------------------------------------------------------------
-- Laskutus
-- ---------------------------------------------------------------------------

-- Hinnasto on julkinen, jotta hinnoittelusivu voi lukea sen ilman kirjautumista.
create policy plans_read on plans
  for select to anon, authenticated using (is_public or current_user_is_super_admin());
create policy plan_entitlements_read on plan_entitlements
  for select to anon, authenticated using (true);

-- Tilausta luetaan, mutta sitä ei muuteta selaimesta. Tilan omistaa
-- Stripe-webhook palvelinpuolella (§30).
create policy subscriptions_select on subscriptions
  for select to authenticated
  using (org_id in (select current_user_accessible_org_ids()) or current_user_is_super_admin());

create policy api_keys_select on api_keys
  for select to authenticated
  using (current_user_has_role(org_id, array['company_admin', 'business_owner', 'firm_admin']::member_role[]));

-- integration_credentials: ei yhtään politiikkaa.
-- RLS on päällä ja politiikkoja ei ole, joten kaikki asiakaspääsy estyy.
-- Vain service role pääsee käsiksi.

-- ===========================================================================
-- 0006_seed_reference.sql
-- ===========================================================================

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

-- ===========================================================================
-- 0007_auth_storage.sql
-- ===========================================================================

-- Verra — autentikoinnin kytkentä, organisaation perustus ja tallennus.
--
-- Kolme asiaa jotka on tehtävä palvelimella eikä selaimesta:
--   1. profiilirivin luonti rekisteröitymisen yhteydessä
--   2. organisaation + jäsenyyden + tilauksen luonti samassa transaktiossa
--   3. tallennuskorien pääsynhallinta

-- ---------------------------------------------------------------------------
-- 1. Profiili syntyy automaattisesti auth.users-riviä vastaan
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fi')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Organisaation perustus
-- ---------------------------------------------------------------------------

-- Organisaatio, jäsenyys ja tilaus syntyvät yhdessä. Jos jokin epäonnistuu,
-- mitään ei jää puolitiehen — muuten käyttäjä voisi jäädä tilaan jossa on
-- organisaatio mutta ei jäsenyyttä siihen, eikä pääsisi omaan dataansa.
create or replace function create_organization(
  p_name text,
  p_country char(2),
  p_kind org_kind default 'company',
  p_role member_role default 'company_admin',
  p_business_id text default null,
  p_vat_id text default null,
  p_accounting_software text default null,
  p_vat_registered boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organisaation nimi puuttuu';
  end if;

  insert into organizations (name, country, kind, business_id, vat_id,
                             accounting_software, vat_registered)
  values (trim(p_name), upper(p_country), p_kind, nullif(trim(p_business_id), ''),
          nullif(trim(p_vat_id), ''), nullif(trim(p_accounting_software), ''),
          p_vat_registered)
  returning id into v_org_id;

  insert into organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, p_role);

  -- Uusi organisaatio aloittaa 14 päivän kokeilulla (§31).
  insert into subscriptions (org_id, plan_id, state, trial_ends_at)
  values (v_org_id, 'free', 'trialing', now() + interval '14 days');

  insert into audit_events (org_id, user_id, action, entity_type, entity_id,
                            after_state, source)
  values (v_org_id, v_user_id, 'organization.created', 'organization', v_org_id,
          jsonb_build_object('name', trim(p_name), 'country', upper(p_country)),
          'app');

  return v_org_id;
end;
$$;

revoke all on function create_organization from public;
grant execute on function create_organization to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Audit-tapahtuman kirjaus
-- ---------------------------------------------------------------------------

-- audit_events-tauluun ei ole insert-politiikkaa, joten kirjaus kulkee tämän
-- security definer -funktion kautta. Näin käyttäjä ei voi väärentää
-- tapahtumia mutta sovellus voi kirjata ne.
create or replace function log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_org_id is not null
     and not exists (
       select 1 from current_user_accessible_org_ids() o where o = p_org_id
     ) then
    raise exception 'Ei oikeutta organisaatioon';
  end if;

  insert into audit_events (org_id, user_id, action, entity_type, entity_id,
                            before_state, after_state, metadata, source)
  values (p_org_id, auth.uid(), p_action, p_entity_type, p_entity_id,
          p_before, p_after, coalesce(p_metadata, '{}'::jsonb), 'app')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function log_audit_event from public;
grant execute on function log_audit_event to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Käytön kirjaus rajojen valvontaan
-- ---------------------------------------------------------------------------

create or replace function record_usage(
  p_org_id uuid,
  p_metric text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_quantity int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usage_records (org_id, metric, period_start, quantity,
                             entity_type, entity_id)
  values (p_org_id, p_metric, date_trunc('month', now())::date, p_quantity,
          p_entity_type, p_entity_id)
  -- Sama dokumentti ei kasvata käyttöä kahdesti vaikka käsittely ajettaisiin
  -- uudelleen. Idempotenssi tulee osittaisindeksistä migraatiossa 0004.
  on conflict do nothing;
end;
$$;

grant execute on function record_usage to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Tallennuskorit (§38)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 20971520,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  ('exports', 'exports', false, 52428800, null),
  ('avatars', 'avatars', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Dokumentit eivät ole julkisia. Polku alkaa aina organisaation tunnisteella,
-- ja pääsy ratkaistaan samalla funktiolla kuin muualla.
create policy "documents_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select current_user_accessible_org_ids())
  );

create policy "documents_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select current_user_accessible_org_ids())
  );

create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select current_user_accessible_org_ids())
  );

create policy "exports_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1]::uuid in (select current_user_accessible_org_ids())
  );

create policy "avatars_own" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 6. Näkymä käyttäjän organisaatioista
-- ---------------------------------------------------------------------------

-- security_invoker: näkymä noudattaa kutsujan RLS-politiikkoja eikä omistajan.
create or replace view my_organizations
with (security_invoker = true)
as
select
  o.id,
  o.name,
  o.kind,
  o.country,
  o.base_currency,
  o.is_demo,
  m.role,
  s.plan_id,
  s.state as subscription_state,
  s.trial_ends_at
from organizations o
join organization_members m on m.org_id = o.id and m.user_id = auth.uid()
left join subscriptions s on s.org_id = o.id;

grant select on my_organizations to authenticated;

commit;
