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
