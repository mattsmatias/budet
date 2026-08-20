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
