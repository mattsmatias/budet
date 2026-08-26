-- ---------------------------------------------------------------------------
-- 0052 — Tehtävien toiminnot
-- ---------------------------------------------------------------------------
--
-- Merkintä tehdyksi kulkee funktion kautta eikä suorana päivityksenä.
-- Vastuuhenkilö saa kuitata oman tehtävänsä, muttei siirtää eräpäivää
-- eikä vaihtaa vastuuhenkilöä — rivikäytäntö ei pysty erottamaan
-- näitä toisistaan, funktio pystyy.
--
-- JOKAINEN TOISTO ON OMA TEHTÄVÄNSÄ.
--
-- Kun elokuun vuokra merkitään maksetuksi, syyskuun tehtävä syntyy
-- omana rivinään. Yksi rivi jonka eräpäivä siirtyy hukkaisi
-- historian: silloin ei voisi enää sanoa maksettiinko elokuun vuokra
-- ajallaan.
--
-- Seuraava eräpäivä lasketaan eräpäivästä eikä tästä päivästä. "Joka
-- kuukauden viides" pysyy viidentenä vaikka tehtävä kuitattaisiin
-- kahdeksantena.

create or replace function next_task_due(p_due date, p_rule task_recurrence)
returns date
language sql
immutable
as $$
  select case p_rule
    when 'daily' then p_due + 1
    when 'weekly' then p_due + 7
    when 'monthly' then (p_due + interval '1 month')::date
    when 'yearly' then (p_due + interval '1 year')::date
    else null
  end;
$$;

create or replace function complete_task(p_task uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
  v_next date;
  v_new uuid;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then
    raise exception 'Tehtävää ei löytynyt';
  end if;

  /*
   * Vastuuhenkilö saa kuitata omansa.
   *
   * Ilman tätä työntekijä ei voisi merkitä tehtäväänsä tehdyksi
   * lainkaan, koska kirjoitusoikeus tauluun on esihenkilöllä.
   */
  if not (
    is_manager(v_task.restaurant_id)
    or (v_task.assigned_to = auth.uid()
        and v_task.restaurant_id in (select my_restaurant_ids()))
  ) then
    raise exception 'Ei oikeutta tähän tehtävään';
  end if;

  -- Jo tehty on jo tehty. Ei virhe eikä uutta toistoa.
  if v_task.completed_at is not null then
    return null;
  end if;

  if v_task.cancelled_at is not null then
    raise exception 'Peruttua tehtävää ei voi merkitä tehdyksi';
  end if;

  update tasks
  set completed_at = now(), completed_by = auth.uid()
  where id = p_task;

  if v_task.recurrence = 'none' then
    return null;
  end if;

  v_next := next_task_due(v_task.due_on, v_task.recurrence);
  if v_next is null then
    return null;
  end if;

  /*
   * Sama toisto ei synny kahdesti.
   *
   * Kaksi nopeaa kuittausta tuottaisi muuten kaksi syyskuun vuokraa.
   * Ketju tunnistetaan juuresta, joten tarkistus kestää myös pitkän
   * sarjan.
   */
  if exists (
    select 1 from tasks
    where parent_task_id = coalesce(v_task.parent_task_id, v_task.id)
      and due_on = v_next
  ) then
    return null;
  end if;

  insert into tasks (
    restaurant_id, title, description, due_on, due_time,
    priority, visibility, assigned_to, recurrence, parent_task_id,
    remind_days_before, remind_on_due, remind_when_overdue, created_by
  )
  values (
    v_task.restaurant_id, v_task.title, v_task.description, v_next, v_task.due_time,
    v_task.priority, v_task.visibility, v_task.assigned_to, v_task.recurrence,
    coalesce(v_task.parent_task_id, v_task.id),
    v_task.remind_days_before, v_task.remind_on_due, v_task.remind_when_overdue,
    coalesce(auth.uid(), v_task.created_by)
  )
  returning id into v_new;

  return v_new;
end;
$$;

revoke all on function complete_task from public;
grant execute on function complete_task to authenticated;

/** Väärin kuitattu takaisin auki. Vain esihenkilö. */
create or replace function reopen_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then return; end if;

  if not is_manager(v_task.restaurant_id) then
    raise exception 'Vain esihenkilö voi avata tehtävän uudelleen';
  end if;

  update tasks
  set completed_at = null, completed_by = null,
      cancelled_at = null, cancelled_by = null
  where id = p_task;
end;
$$;

revoke all on function reopen_task from public;
grant execute on function reopen_task to authenticated;

/**
 * Peruutus, ei poisto.
 *
 * Peruttu tehtävä säilyy: se kertoo että asia oli suunnitteilla ja
 * siitä luovuttiin. Poistettu tehtävä ei kerro kummastakaan.
 */
create or replace function cancel_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
begin
  select * into v_task from tasks where id = p_task;
  if v_task.id is null then return; end if;

  if not is_manager(v_task.restaurant_id) then
    raise exception 'Vain esihenkilö voi perua tehtävän';
  end if;

  if v_task.completed_at is not null then
    raise exception 'Tehty tehtävä on jo hoidettu — sitä ei voi perua';
  end if;

  update tasks
  set cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_task and cancelled_at is null;
end;
$$;

revoke all on function cancel_task from public;
grant execute on function cancel_task to authenticated;
