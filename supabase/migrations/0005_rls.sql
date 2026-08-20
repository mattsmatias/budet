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
