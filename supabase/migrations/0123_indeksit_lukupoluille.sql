-- ---------------------------------------------------------------------------
-- 0123 — Indeksit niille vierasavaimille joita oikeasti luetaan
-- ---------------------------------------------------------------------------
--
-- INDEKSI EI OLE ILMAINEN.
--
-- Lintteri loysi kahdeksankymmenta indeksoimatonta vierasavainta.
-- Niiden lisaaminen kaikkien varalta olisi vaihtanut hitaan luvun
-- hitaaseen kirjoitukseen: jokainen indeksi pitaa paivittaa joka
-- rivilisayksella, ja samassa kannassa on jo neljakymmenta indeksia
-- joita ei ole kertaakaan kaytetty.
--
-- Tassa ovat ne joilla on osoitettava lukupolku: RLS-kaytannon
-- alikysely, nakyman liitos tai toistuvan tehtavan ketju. Loput —
-- created_by, posted_by, completed_by ja muut kirjausmerkinnat —
-- jaavat indeksoimatta, koska niilla ei haeta vaan ne vain
-- tallennetaan.

-- Tyontekijan oma rivi: time_entries_read-kaytannon alikysely ja
-- employee_for_me hakevat talla jokaisella leimauksella.
create index if not exists employees_user_id_idx
  on employees (user_id);

-- documents_select ja documents_update tarkistavat lataajan.
create index if not exists documents_uploaded_by_idx
  on documents (uploaded_by);

create index if not exists documents_assigned_to_idx
  on documents (assigned_to);

-- Myynti ryhmittain liittaa myyntiryhman joka riville.
create index if not exists daily_sales_lines_sales_group_id_idx
  on daily_sales_lines (sales_group_id);

-- Toimintaloki nayttaa tekijan nimen jokaisella rivilla.
create index if not exists audit_log_actor_id_idx
  on audit_log (actor_id);

-- Ilmoitukset haetaan organisaatiolla.
create index if not exists notifications_org_id_idx
  on notifications (org_id);

-- Toistuvan tehtavan ketju kulkee vanhemman kautta.
create index if not exists tasks_parent_task_id_idx
  on tasks (parent_task_id);

-- Oikaisu viittaa korjattavaan vientiin, ja ketju naytetaan kirjanpidossa.
create index if not exists ledger_entries_corrects_id_idx
  on ledger_entries (corrects_id);
