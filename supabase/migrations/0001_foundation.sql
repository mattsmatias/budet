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
