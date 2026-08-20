-- Verra — profiilien täydennys ja organisaation luonnin kovennus.
--
-- Ongelma: käyttäjä joka rekisteröityi ENNEN migraatiota 0007 ei saanut
-- profiilirivia, koska trigger syntyi vasta silloin. organization_members
-- viittaa profiles-tauluun vieraalla avaimella, joten organisaation luonti
-- kaatui viiteavainvirheeseen.
--
-- Tämä migraatio on idempotentti ja turvallinen ajaa uudelleen.

-- ---------------------------------------------------------------------------
-- 1. Täydennä puuttuvat profiilit olemassa olevista käyttäjistä
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name, locale)
select
  u.id,
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'locale', ''), 'fi')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---------------------------------------------------------------------------
-- 2. create_organization luo profiilin itse jos se puuttuu
-- ---------------------------------------------------------------------------
--
-- Puolustava toimenpide: profiilin olemassaolo ei saa olla ehto sille että
-- käyttäjä pääsee alkuun. Jos trigger jostain syystä ei ole ajanut, funktio
-- korjaa tilanteen sen sijaan että kaatuisi viiteavainvirheeseen.

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

  if coalesce(trim(p_country), '') = '' then
    raise exception 'Maa puuttuu';
  end if;

  -- Varmista profiili ennen jäsenyyttä.
  insert into profiles (id, locale)
  values (v_user_id, 'fi')
  on conflict (id) do nothing;

  insert into organizations (name, country, kind, business_id, vat_id,
                             accounting_software, vat_registered)
  values (trim(p_name), upper(p_country), p_kind, nullif(trim(p_business_id), ''),
          nullif(trim(p_vat_id), ''), nullif(trim(p_accounting_software), ''),
          p_vat_registered)
  returning id into v_org_id;

  insert into organization_members (org_id, user_id, role)
  values (v_org_id, v_user_id, p_role);

  -- Tilaus vain jos free-suunnitelma on siemenetty. Puuttuva hinnasto ei
  -- saa estää organisaation luontia.
  if exists (select 1 from plans where id = 'free') then
    insert into subscriptions (org_id, plan_id, state, trial_ends_at)
    values (v_org_id, 'free', 'trialing', now() + interval '14 days')
    on conflict (org_id) do nothing;
  end if;

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
