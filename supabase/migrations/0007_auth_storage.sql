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
