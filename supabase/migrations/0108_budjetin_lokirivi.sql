-- 0108 — Budjetin tallennus kaatui lokiin
--
-- VIRHE.
--
--   Budjetin tallennus epäonnistui: null value in column "summary" of
--   relation "audit_log" violates not-null constraint
--
-- Budjetti on jatkuva: set_budget tallentaa rivin ilman kuukautta
-- (month is null). audit_budgets kokosi lokiriviin lauseen, jossa oli
-- to_char(new.month, 'MM/YYYY') — ja null keskellä ketjutusta tekee
-- koko lauseesta nullin. Loki hylkäsi rivin, ja koko tallennus
-- peruuntui: budjettia ei voinut luoda lainkaan.
--
-- KORJAUS.
--
-- 1. audit_budgets kertoo jatkuvasta budjetista "jatkuva" kuukauden
--    sijaan. Kuukausikohtainen budjetti näkyy kuten ennenkin.
--
-- 2. audit_person_name palauttaa "Tuntematon" myös silloin kun
--    profiilia ei löydy. Ennen se palautti nullin, joka olisi
--    kaatanut saman ketjutuksen jäsenyyksien lokissa.
--
-- 3. write_audit ei enää kirjoita nullia tiivistelmäksi. Loki on
--    jäljitettävyyttä varten, eikä sen puute saa estää yrittäjää
--    tekemästä työtään: puuttuvan lauseen tilalle tulee toiminnon nimi.
--    Tämä on viimeinen verkko, ei syy jättää lauseita kirjoittamatta.

create or replace function public.audit_person_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select nullif(trim(full_name), '') from profiles where id = p_user),
    'Tuntematon'
  );
$function$;

create or replace function public.audit_budgets()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kausi text;
begin
  v_kausi := coalesce(
    to_char(coalesce(new.month, old.month), 'MM/YYYY'),
    'jatkuva'
  );

  if tg_op = 'INSERT' then
    perform write_audit(
      new.restaurant_id, 'created', 'budget', new.id, new.category::text,
      'Budjetti ' || new.category::text || ' (' || v_kausi || '): '
        || audit_euros(new.amount_cents) || '.',
      null, jsonb_build_object('amount_cents', new.amount_cents), false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      old.restaurant_id, 'deleted', 'budget', old.id, old.category::text,
      'Budjetti ' || old.category::text || ' (' || v_kausi || ') poistettiin.',
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
$function$;

create or replace function public.write_audit(
  p_restaurant uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_entity_name text,
  p_summary text,
  p_before jsonb default null::jsonb,
  p_after jsonb default null::jsonb,
  p_critical boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_role text;
begin
  if p_restaurant is null then return; end if;

  -- Yritys poistetaan: sen oma loki lähtee samalla (ks. 0101).
  if not restaurant_exists(p_restaurant) then
    return;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Tuntematon')
  into v_name
  from profiles p
  where p.id = v_actor;

  select m.role::text into v_role
  from memberships m
  where m.restaurant_id = p_restaurant and m.user_id = v_actor;

  insert into audit_log (
    restaurant_id, actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_name, summary,
    before_data, after_data, critical
  )
  values (
    p_restaurant, v_actor, coalesce(v_name, 'Järjestelmä'), v_role,
    p_action, p_entity_type, p_entity_id, p_entity_name,
    -- Puuttuva lause ei saa estää tekoa jota se kuvaa.
    coalesce(p_summary, p_action || coalesce(' — ' || p_entity_name, '')),
    p_before, p_after, p_critical
  );
end;
$function$;
