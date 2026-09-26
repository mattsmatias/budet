-- ---------------------------------------------------------------------------
-- 0122 — auth.uid() lasketaan kerran kyselya kohti
-- ---------------------------------------------------------------------------
--
-- KAYTANTO AJETAAN JOKA RIVILLE.
--
-- RLS-kaytannon lauseke suoritetaan erikseen jokaiselle tarkasteltavalle
-- riville. Kun lausekkeessa lukee auth.uid(), Postgres kutsuu sita
-- kerran riviä kohti: tuhannen kuitin listaus tekee tuhat kutsua, jotka
-- kaikki palauttavat saman arvon.
--
-- Kaarittyna muotoon (select auth.uid()) kutsu muuttuu aliyhteydeksi,
-- jonka suunnittelija laskee kerran ja kayttaa kaikille riveille. Tama
-- on Supabasen oma suositus ja sen lintterin nostama varoitus.
--
-- LOGIIKKA EI MUUTU.
--
-- Jokainen kaytanto luodaan uudelleen tasmalleen samalla lausekkeella;
-- ainoa ero on kaare auth.uid()-kutsun ymparilla. Roolit, komennot ja
-- ehdot ovat entiset. Migraatio ajetaan yhdessa transaktiossa, joten
-- valissa ei ole hetkea jolloin taulu olisi ilman kaytantoa.

-- ai_conversations ----------------------------------------------------------
drop policy if exists ai_conversations_own on ai_conversations;
create policy ai_conversations_own on ai_conversations
  for select to authenticated
  using (
    (user_id = (select auth.uid()))
    and (restaurant_id in (select my_restaurant_ids()))
  );

-- ai_messages ---------------------------------------------------------------
drop policy if exists ai_messages_own on ai_messages;
create policy ai_messages_own on ai_messages
  for select to authenticated
  using (
    conversation_id in (
      select ai_conversations.id
        from ai_conversations
       where ai_conversations.user_id = (select auth.uid())
    )
  );

-- ai_pending_actions --------------------------------------------------------
drop policy if exists ai_pending_actions_own on ai_pending_actions;
create policy ai_pending_actions_own on ai_pending_actions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- client_assignments --------------------------------------------------------
drop policy if exists client_assignments_select on client_assignments;
create policy client_assignments_select on client_assignments
  for select to authenticated
  using (
    (user_id = (select auth.uid()))
    or exists (
      select 1
        from accounting_relationships r
       where r.id = client_assignments.relationship_id
         and current_user_has_role(r.firm_org_id, array['firm_admin'::member_role])
    )
  );

-- documents -----------------------------------------------------------------
drop policy if exists documents_select on documents;
create policy documents_select on documents
  for select to authenticated
  using (
    current_user_is_super_admin()
    or (
      (org_id in (select current_user_accessible_org_ids()))
      and (
        (not current_user_has_role(org_id, array['employee'::member_role]))
        or (uploaded_by = (select auth.uid()))
      )
    )
  );

drop policy if exists documents_update on documents;
create policy documents_update on documents
  for update to authenticated
  using (
    (org_id in (select current_user_accessible_org_ids()))
    and (
      (not current_user_has_role(org_id, array['employee'::member_role]))
      or (uploaded_by = (select auth.uid()))
    )
  )
  with check (org_id in (select current_user_accessible_org_ids()));

-- employees -----------------------------------------------------------------
drop policy if exists employees_read on employees;
create policy employees_read on employees
  for select to authenticated
  using (is_owner(restaurant_id) or (user_id = (select auth.uid())));

-- feature_flag_restaurants --------------------------------------------------
drop policy if exists flag_overrides_read on feature_flag_restaurants;
create policy flag_overrides_read on feature_flag_restaurants
  for select to public
  using (
    exists (
      select 1
        from memberships m
       where m.restaurant_id = feature_flag_restaurants.restaurant_id
         and m.user_id = (select auth.uid())
         and m.active
    )
  );

-- feature_flags -------------------------------------------------------------
drop policy if exists flags_read on feature_flags;
create policy flags_read on feature_flags
  for select to public
  using ((select auth.uid()) is not null);

-- notifications -------------------------------------------------------------
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or exists (
      select 1
        from memberships m
       where m.user_id = profiles.id
         and m.restaurant_id in (select my_restaurant_ids())
    )
  );

drop policy if exists profiles_select_self on profiles;
create policy profiles_select_self on profiles
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or current_user_is_super_admin()
    or exists (
      select 1
        from organization_members m
       where m.user_id = profiles.id
         and m.org_id in (select current_user_accessible_org_ids())
    )
  );

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- receipt_items -------------------------------------------------------------
drop policy if exists receipt_items_write on receipt_items;
create policy receipt_items_write on receipt_items
  for all to authenticated
  using (
    receipt_id in (
      select receipts.id
        from receipts
       where is_manager(receipts.restaurant_id)
          or receipts.added_by = (select auth.uid())
    )
  )
  with check (
    receipt_id in (
      select receipts.id
        from receipts
       where is_manager(receipts.restaurant_id)
          or receipts.added_by = (select auth.uid())
    )
  );

-- receipt_pages -------------------------------------------------------------
drop policy if exists receipt_pages_read on receipt_pages;
create policy receipt_pages_read on receipt_pages
  for select to authenticated
  using (
    exists (
      select 1
        from receipts r
       where r.id = receipt_pages.receipt_id
         and (
           can_read_finance(r.restaurant_id)
           or (
             (r.restaurant_id in (select my_restaurant_ids()))
             and r.added_by = (select auth.uid())
           )
         )
    )
  );

-- receipts ------------------------------------------------------------------
drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts
  for insert to authenticated
  with check (is_manager(restaurant_id) and (added_by = (select auth.uid())));

drop policy if exists receipts_read on receipts;
create policy receipts_read on receipts
  for select to authenticated
  using (
    can_read_finance(restaurant_id)
    or (
      (restaurant_id in (select my_restaurant_ids()))
      and (added_by = (select auth.uid()))
    )
  );

-- tasks ---------------------------------------------------------------------
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select to authenticated
  using (
    (restaurant_id in (select my_restaurant_ids()))
    and case visibility
          when 'owner_only'::task_visibility then is_owner(restaurant_id)
          when 'managers'::task_visibility then is_manager(restaurant_id)
          when 'assigned_user'::task_visibility then
            ((assigned_to = (select auth.uid())) or is_manager(restaurant_id))
          else true
        end
  );

-- tax_guides ----------------------------------------------------------------
drop policy if exists tax_guides_read on tax_guides;
create policy tax_guides_read on tax_guides
  for select to public
  using ((select auth.uid()) is not null);

-- time_entries --------------------------------------------------------------
drop policy if exists time_entries_read on time_entries;
create policy time_entries_read on time_entries
  for select to authenticated
  using (
    is_owner(restaurant_id)
    or (
      employee_id in (
        select employees.id
          from employees
         where employees.user_id = (select auth.uid())
      )
    )
  );
