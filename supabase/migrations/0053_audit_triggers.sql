-- ---------------------------------------------------------------------------
-- 0053 — Toimintalokin liipaisimet
-- ---------------------------------------------------------------------------
--
-- LOKI SYNTYY KANNASSA, EI SOVELLUKSESSA.
--
-- Sovelluskoodista kirjattu loki jää kirjaamatta joka kerta kun joku
-- kutsuu rajapintaa suoraan tai kun uusi kirjoituspolku unohdetaan.
-- Liipaisin näkee jokaisen muutoksen riippumatta siitä mistä se tuli.
--
-- YKSI MUUTOS, YKSI RIVI KENTTÄÄ KOHTI.
--
-- Jokainen liipaisin vertaa kenttiä erikseen ja kirjaa vain ne jotka
-- muuttuivat. Koko rivin tallentaminen veisi lokiin myös sen mikä
-- pysyi samana, ja muutoksen löytäminen olisi lukijan työtä.
--
-- KRIITTISET MERKITÄÄN.
--
-- Palkka, rooli, käyttöoikeus, työaikakorjaus, ALV-kanta ja kuitin
-- summa ovat niitä joiden takia lokia luetaan. Ilman merkintää ne
-- hukkuisivat tavallisten muutosten sekaan.

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

/*
 * Nimi tekstinä, ei viitteenä.
 *
 * Loki on todiste tapahtumasta eikä saa kadota kun kohde poistetaan.
 * Poistetun työntekijän nimi jää riville, jotta "kuka poistettiin" on
 * myöhemminkin vastattavissa.
 */
create or replace function audit_person_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(full_name), ''), 'Tuntematon')
  from profiles where id = p_user;
$$;

/* Sentit euroina. Loki luetaan samoilla yksiköillä kuin näkymät. */
create or replace function audit_euros(p_cents integer)
returns text
language sql
immutable
as $$
  select case
    when p_cents is null then '—'
    else to_char(p_cents / 100.0, 'FM999G999G990D00') || ' €'
  end;
$$;

create or replace function audit_shift_label(p_user uuid, p_date date, p_start time, p_end time)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when p_user is null then 'Avoin vuoro' else audit_person_name(p_user) end
    || ' ' || to_char(p_date, 'DD.MM.YYYY') || ' '
    || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI');
$$;

-- ---------------------------------------------------------------------------
-- Työntekijät: palkka, rooli ja käyttöoikeus ovat kriittisiä
-- ---------------------------------------------------------------------------

create or replace function audit_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'member', new.user_id,
      audit_person_name(new.user_id),
      audit_person_name(new.user_id) || ' lisättiin ravintolaan roolilla ' || new.role::text || '.',
      null, jsonb_build_object('role', new.role, 'position', new.position), true
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'member', old.user_id,
      audit_person_name(old.user_id),
      audit_person_name(old.user_id) || ' poistettiin ravintolasta.',
      jsonb_build_object('role', old.role, 'position', old.position), null, true
    );
    return old;
  end if;

  v_name := audit_person_name(new.user_id);

  if new.role is distinct from old.role then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': rooli ' || old.role::text || ' → ' || new.role::text || '.',
      jsonb_build_object('role', old.role), jsonb_build_object('role', new.role), true
    );
  end if;

  if new.hourly_rate_cents is distinct from old.hourly_rate_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': tuntipalkka ' || audit_euros(old.hourly_rate_cents)
        || ' → ' || audit_euros(new.hourly_rate_cents) || '.',
      jsonb_build_object('hourly_rate_cents', old.hourly_rate_cents),
      jsonb_build_object('hourly_rate_cents', new.hourly_rate_cents), true
    );
  end if;

  if new.monthly_salary_cents is distinct from old.monthly_salary_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': kuukausipalkka ' || audit_euros(old.monthly_salary_cents)
        || ' → ' || audit_euros(new.monthly_salary_cents) || '.',
      jsonb_build_object('monthly_salary_cents', old.monthly_salary_cents),
      jsonb_build_object('monthly_salary_cents', new.monthly_salary_cents), true
    );
  end if;

  if new.position is distinct from old.position then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || ': tehtävä ' || coalesce(old.position::text, '—')
        || ' → ' || coalesce(new.position::text, '—') || '.',
      jsonb_build_object('position', old.position),
      jsonb_build_object('position', new.position), false
    );
  end if;

  if new.active is distinct from old.active then
    perform write_audit(
      new.restaurant_id, 'updated', 'member', new.user_id, v_name,
      v_name || (case when new.active then ' aktivoitiin.' else ' poistettiin käytöstä.' end),
      jsonb_build_object('active', old.active),
      jsonb_build_object('active', new.active), true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_audit on memberships;
create trigger memberships_audit
  after insert or update or delete on memberships
  for each row execute function audit_memberships();

-- ---------------------------------------------------------------------------
-- Verotus ja budjetit
-- ---------------------------------------------------------------------------

create or replace function audit_sales_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'sales_group', new.id, new.name,
      'Myyntiryhmä ' || new.name || ' lisättiin kannalla '
        || to_char(new.vat_rate * 100, 'FM990D0') || ' %.',
      null, jsonb_build_object('name', new.name, 'vat_rate', new.vat_rate), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'sales_group', old.id, old.name,
      'Myyntiryhmä ' || old.name || ' poistettiin.',
      jsonb_build_object('name', old.name, 'vat_rate', old.vat_rate), null, true
    );
    return old;
  end if;

  if new.vat_rate is distinct from old.vat_rate then
    perform write_audit(
      new.restaurant_id, 'updated', 'sales_group', new.id, new.name,
      new.name || ': ALV-kanta ' || to_char(old.vat_rate * 100, 'FM990D0')
        || ' % → ' || to_char(new.vat_rate * 100, 'FM990D0') || ' %.',
      jsonb_build_object('vat_rate', old.vat_rate),
      jsonb_build_object('vat_rate', new.vat_rate), true
    );
  end if;

  if new.name is distinct from old.name then
    perform write_audit(
      new.restaurant_id, 'updated', 'sales_group', new.id, new.name,
      'Myyntiryhmän nimi ' || old.name || ' → ' || new.name || '.',
      jsonb_build_object('name', old.name), jsonb_build_object('name', new.name), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sales_groups_audit on sales_groups;
create trigger sales_groups_audit
  after insert or update or delete on sales_groups
  for each row execute function audit_sales_groups();

create or replace function audit_budgets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'budget', new.id, new.category::text,
      'Budjetti ' || new.category::text || ' ' || to_char(new.month, 'MM/YYYY')
        || ': ' || audit_euros(new.amount_cents) || '.',
      null, jsonb_build_object('amount_cents', new.amount_cents), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'budget', old.id, old.category::text,
      'Budjetti ' || old.category::text || ' ' || to_char(old.month, 'MM/YYYY') || ' poistettiin.',
      jsonb_build_object('amount_cents', old.amount_cents), null, false
    );
    return old;
  end if;

  if new.amount_cents is distinct from old.amount_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'budget', new.id, new.category::text,
      'Budjetti ' || new.category::text || ': ' || audit_euros(old.amount_cents)
        || ' → ' || audit_euros(new.amount_cents) || '.',
      jsonb_build_object('amount_cents', old.amount_cents),
      jsonb_build_object('amount_cents', new.amount_cents), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_audit on budgets;
create trigger budgets_audit
  after insert or update or delete on budgets
  for each row execute function audit_budgets();

-- ---------------------------------------------------------------------------
-- Työajan korjaus: aina kriittinen
-- ---------------------------------------------------------------------------
--
-- Käsin korjattu työaika vaikuttaa suoraan palkkaan. Korjaus on aina
-- uusi rivi, joten pelkkä insert riittää: vanha ja uusi aika ovat
-- molemmat samalla rivillä.

create or replace function audit_time_corrections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := audit_person_name(new.user_id);
begin
  perform write_audit(
    new.restaurant_id, 'updated', 'time_correction', new.id, v_name,
    v_name || ': työaika ' || to_char(new.work_date, 'DD.MM.YYYY') || ' korjattiin.',
    jsonb_build_object(
      'in', new.original_in, 'out', new.original_out,
      'break_minutes', new.original_break_minutes
    ),
    jsonb_build_object(
      'in', new.corrected_in, 'out', new.corrected_out,
      'break_minutes', new.corrected_break_minutes, 'reason', new.reason
    ),
    true
  );
  return new;
end;
$$;

drop trigger if exists time_corrections_audit on time_corrections;
create trigger time_corrections_audit
  after insert on time_corrections
  for each row execute function audit_time_corrections();

-- ---------------------------------------------------------------------------
-- Työvuorot
-- ---------------------------------------------------------------------------
--
-- Julkaisu ja peruutus ovat omia tapahtumiaan eivätkä pelkkiä
-- kenttämuutoksia: ne ovat lupaus työntekijälle ja sen peruminen.

create or replace function audit_shifts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'shift', new.id,
      audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time),
      'Työvuoro luotiin: '
        || audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time) || '.',
      null,
      jsonb_build_object('date', new.shift_date, 'start', new.start_time, 'end', new.end_time),
      false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'shift', old.id,
      audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time),
      'Työvuoro poistettiin: '
        || audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time) || '.',
      jsonb_build_object('date', old.shift_date, 'start', old.start_time, 'end', old.end_time),
      null, false
    );
    return old;
  end if;

  v_label := audit_shift_label(new.user_id, new.shift_date, new.start_time, new.end_time);

  if old.published_at is null and new.published_at is not null then
    perform write_audit(
      new.restaurant_id, 'published', 'shift', new.id, v_label,
      'Työvuoro julkaistiin: ' || v_label || '.', null, null, false
    );
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    perform write_audit(
      new.restaurant_id, 'cancelled', 'shift', new.id, v_label,
      'Työvuoro peruttiin: ' || v_label || '.', null, null, false
    );
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.shift_date is distinct from old.shift_date then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoro muuttui: '
        || audit_shift_label(old.user_id, old.shift_date, old.start_time, old.end_time)
        || ' → ' || v_label || '.',
      jsonb_build_object('date', old.shift_date, 'start', old.start_time, 'end', old.end_time),
      jsonb_build_object('date', new.shift_date, 'start', new.start_time, 'end', new.end_time),
      false
    );
  end if;

  if new.user_id is distinct from old.user_id then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoron tekijä vaihtui: '
        || coalesce(audit_person_name(old.user_id), 'Avoin vuoro') || ' → '
        || coalesce(audit_person_name(new.user_id), 'Avoin vuoro') || '.',
      jsonb_build_object('user_id', old.user_id),
      jsonb_build_object('user_id', new.user_id), false
    );
  end if;

  if new.break_minutes is distinct from old.break_minutes then
    perform write_audit(
      new.restaurant_id, 'updated', 'shift', new.id, v_label,
      'Työvuoron tauko ' || old.break_minutes || ' min → ' || new.break_minutes || ' min.',
      jsonb_build_object('break_minutes', old.break_minutes),
      jsonb_build_object('break_minutes', new.break_minutes), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists shifts_audit on shifts;
create trigger shifts_audit
  after insert or update or delete on shifts
  for each row execute function audit_shifts();

-- ---------------------------------------------------------------------------
-- Kuitit: summa ja ALV ovat kriittisiä
-- ---------------------------------------------------------------------------

create or replace function audit_receipts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'receipt', new.id, new.supplier_name,
      'Kuitti lisättiin: ' || new.supplier_name || ' '
        || audit_euros(new.total_cents) || '.',
      null, jsonb_build_object('total_cents', new.total_cents, 'category', new.category), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'receipt', old.id, old.supplier_name,
      'Kuitti poistettiin: ' || old.supplier_name || ' '
        || audit_euros(old.total_cents) || '.',
      jsonb_build_object('total_cents', old.total_cents, 'category', old.category),
      null, true
    );
    return old;
  end if;

  if new.total_cents is distinct from old.total_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin summa ' || audit_euros(old.total_cents) || ' → '
        || audit_euros(new.total_cents) || '.',
      jsonb_build_object('total_cents', old.total_cents),
      jsonb_build_object('total_cents', new.total_cents), true
    );
  end if;

  if new.vat_cents is distinct from old.vat_cents then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin ALV ' || audit_euros(old.vat_cents) || ' → '
        || audit_euros(new.vat_cents) || '.',
      jsonb_build_object('vat_cents', old.vat_cents),
      jsonb_build_object('vat_cents', new.vat_cents), true
    );
  end if;

  if new.category is distinct from old.category then
    perform write_audit(
      new.restaurant_id, 'updated', 'receipt', new.id, new.supplier_name,
      'Kuitin kategoria ' || old.category::text || ' → ' || new.category::text || '.',
      jsonb_build_object('category', old.category),
      jsonb_build_object('category', new.category), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists receipts_audit on receipts;
create trigger receipts_audit
  after insert or update or delete on receipts
  for each row execute function audit_receipts();

-- ---------------------------------------------------------------------------
-- Tehtävät
-- ---------------------------------------------------------------------------
--
-- Eräpäivän siirto on oma tapahtumansa vanhoine ja uusine päivineen:
-- juuri se on kysymys johon myöhemmin halutaan vastaus.

create or replace function audit_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'task', new.id, new.title,
      'Tehtävä luotiin: ' || new.title || ' (eräpäivä '
        || to_char(new.due_on, 'DD.MM.YYYY') || ').',
      null, jsonb_build_object('due_on', new.due_on, 'priority', new.priority), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'task', old.id, old.title,
      'Tehtävä poistettiin: ' || old.title || '.',
      jsonb_build_object('due_on', old.due_on), null, false
    );
    return old;
  end if;

  if old.completed_at is null and new.completed_at is not null then
    perform write_audit(
      new.restaurant_id, 'completed', 'task', new.id, new.title,
      'Tehtävä merkittiin tehdyksi: ' || new.title || '.', null, null, false
    );
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    perform write_audit(
      new.restaurant_id, 'cancelled', 'task', new.id, new.title,
      'Tehtävä peruttiin: ' || new.title || '.', null, null, false
    );
  end if;

  if new.due_on is distinct from old.due_on then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': eräpäivä ' || to_char(old.due_on, 'DD.MM.YYYY')
        || ' → ' || to_char(new.due_on, 'DD.MM.YYYY') || '.',
      jsonb_build_object('due_on', old.due_on),
      jsonb_build_object('due_on', new.due_on), false
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': vastuuhenkilö '
        || coalesce(audit_person_name(old.assigned_to), 'ei kukaan') || ' → '
        || coalesce(audit_person_name(new.assigned_to), 'ei kukaan') || '.',
      jsonb_build_object('assigned_to', old.assigned_to),
      jsonb_build_object('assigned_to', new.assigned_to), false
    );
  end if;

  if new.priority is distinct from old.priority then
    perform write_audit(
      new.restaurant_id, 'updated', 'task', new.id, new.title,
      new.title || ': prioriteetti ' || old.priority::text || ' → ' || new.priority::text || '.',
      jsonb_build_object('priority', old.priority),
      jsonb_build_object('priority', new.priority), false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_audit on tasks;
create trigger tasks_audit
  after insert or update or delete on tasks
  for each row execute function audit_tasks();
