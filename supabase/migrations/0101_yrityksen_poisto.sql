-- 0101 — Yrityksen poisto kaatui lokiin
--
-- VIRHE.
--
-- Kehittäjäkonsolin "Poista yritys pysyvästi" kaatui:
--   insert or update on table "audit_log" violates foreign key
--   constraint "audit_log_restaurant_id_fkey"
--
-- sa_delete_restaurant poistaa restaurants-rivin, ja kanta poistaa
-- kaskadina sen myyntiryhmät, jäsenyydet, kuitit, budjetit ja tehtävät.
-- Jokaisella niistä on audit-laukaisin, joka kirjoittaa poistosta rivin
-- audit_log-tauluun — viittaamalla yritykseen joka on juuri poistettu.
-- Viiteavain hylkää rivin ja koko poisto peruuntuu. Tyhjäkin yritys
-- kaatui, koska sillä on aina oletusmyyntiryhmät.
--
-- KORJAUS.
--
-- Kun yritysriviä ei enää ole, poisto on osa yrityksen poistoa. Silloin:
--
-- 1. write_audit ei kirjoita yrityksen omaan lokiin. Loki poistuisi
--    joka tapauksessa yrityksen mukana; poisto itse on kirjattu
--    järjestelmälokiin (sa_log) ennen poistoa.
--
-- 2. Suljetun kuukauden suoja ja kirjatun tositteen lukko päästävät
--    rivin poistumaan. Ne suojaavat yksittäistä kuittia ja tositetta
--    muutoksilta yrityksen eläessä. Yrityksen poiston voi tehdä vain
--    järjestelmän ylläpitäjä nimen vahvistuksella (sa_delete_restaurant),
--    eikä kukaan muu pysty poistamaan restaurants-riviä, joten tästä ei
--    aukea tietä ohittaa suojaa yksittäiseltä riviltä.

-- Onko yritys yhä olemassa. Security definer, jotta rivitason suojaus ei
-- voi piilottaa riviä ja saada lukkoa luulemaan yritystä poistetuksi.
create or replace function public.restaurant_exists(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from restaurants where id = p_id);
$function$;

revoke all on function public.restaurant_exists(uuid) from public;
grant execute on function public.restaurant_exists(uuid) to authenticated;

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

  -- Yritys poistetaan: sen oma loki lähtee samalla.
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
    p_action, p_entity_type, p_entity_id, p_entity_name, p_summary,
    p_before, p_after, p_critical
  );
end;
$function$;

create or replace function public.guard_closed_month()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    -- Yritys poistetaan kokonaan: kuitit lähtevät sen mukana.
    if not restaurant_exists(old.restaurant_id) then
      return old;
    end if;
    if is_month_closed(old.restaurant_id, old.receipt_date) then
      raise exception 'Kuukausi on suljettu';
    end if;
    return old;
  end if;

  if is_month_closed(new.restaurant_id, new.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  if tg_op = 'UPDATE' and is_month_closed(old.restaurant_id, old.receipt_date) then
    raise exception 'Kuukausi on suljettu';
  end if;

  return new;
end;
$function$;

create or replace function public.ledger_entry_lukko()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    -- Yritys poistetaan kokonaan: tositteet lähtevät sen mukana.
    if not restaurant_exists(old.restaurant_id) then
      return old;
    end if;
    if old.status = 'posted' then
      raise exception 'Kirjattua tositetta ei poisteta. Tee korjaustosite.';
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    if new.entry_date <> old.entry_date
       or new.fiscal_year_id <> old.fiscal_year_id
       or new.entry_number <> old.entry_number
       or new.source_type <> old.source_type
       or new.status <> old.status then
      raise exception 'Kirjattua tositetta ei muuteta. Tee korjaustosite.';
    end if;
  end if;

  return new;
end;
$function$;
