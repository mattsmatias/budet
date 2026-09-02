-- 0086 – Pöydän vaihto varaukseen korjattu
--
-- reservation_update kaatui poikkeukseen aina kun varaukselle
-- annettiin pöytä:
--
--   malformed array literal: "pöytä"
--
-- Syy on muutoslokin rivi
--
--   v_muutos := v_muutos || 'pöytä';
--
-- jossa v_muutos on text[] ja literaali on tyypitön. Postgres valitsee
-- silloin taulukko||taulukko -yhdistelmän ja yrittää lukea sanan
-- "pöytä" taulukoksi. Kaksi edellistä lisäystä välttyivät tältä vain
-- siksi, että ne olivat ||-yhdistelmiä ja siten valmiiksi text.
--
-- Korjaus on yksi tyyppimerkintä. Virhe nousi vasta onnistuneen
-- päivityksen jälkeen, joten muutos peruuntui transaktion mukana ja
-- käyttäjä näki vain yleisen "Toiminto ei onnistunut" -viestin.
--
-- Muu funktio on ennallaan.

create or replace function public.reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_party int;
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_table uuid;
  v_muutos text[] := array[]::text[];
begin
  select * into v_old from reservations where id = p_reservation;
  if v_old.id is null or not is_manager(v_old.restaurant_id) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('kate:reservation:' || v_old.restaurant_id::text)
  );

  select r.timezone into v_tz from restaurants r where r.id = v_old.restaurant_id;

  v_party := coalesce(p_party, v_old.party_size);
  if v_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if p_date is not null or p_time is not null then
    v_start := (
      coalesce(p_date, (v_old.starts_at at time zone v_tz)::date)
      + coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    ) at time zone v_tz;
  else
    v_start := v_old.starts_at;
  end if;

  if v_party <> v_old.party_size then
    v_minutes := reservation_duration_for(v_old.restaurant_id, v_party);
  else
    v_minutes := (extract(epoch from (v_old.ends_at - v_old.starts_at)) / 60)::int;
  end if;
  v_end := v_start + make_interval(mins => v_minutes);

  if p_tables is not null then
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = v_old.restaurant_id
      )
    ) then
      return json_build_object('ok', false, 'error', 'table');
    end if;
    v_tables := p_tables;
  elsif v_start <> v_old.starts_at
        or v_end <> v_old.ends_at
        or v_party <> v_old.party_size
  then
    v_tables := reservation_pick_tables(
      v_old.restaurant_id, v_start, v_end, v_party, p_reservation
    );
    if v_tables is null then
      return json_build_object('ok', false, 'error', 'taken');
    end if;
  end if;

  begin
    update reservations set
      starts_at = v_start,
      ends_at = v_end,
      party_size = v_party,
      guest_name = coalesce(nullif(left(trim(p_name), 120), ''), guest_name),
      guest_phone = case when p_phone is null then guest_phone
                         else nullif(left(trim(p_phone), 40), '') end,
      guest_email = case when p_email is null then guest_email
                         else nullif(lower(left(trim(p_email), 160)), '') end,
      note = case when p_note is null then note
                  else nullif(left(trim(p_note), 500), '') end
    where id = p_reservation;

    if v_tables is not null then
      delete from reservation_table_assignments
      where reservation_id = p_reservation
        and table_id <> all (v_tables);

      foreach v_table in array v_tables loop
        insert into reservation_table_assignments
          (reservation_id, table_id, starts_at, ends_at, blocking)
        values (
          p_reservation, v_table, v_start, v_end,
          v_old.status in ('pending', 'confirmed', 'arrived')
        )
        on conflict (reservation_id, table_id) do update
          set starts_at = excluded.starts_at,
              ends_at = excluded.ends_at,
              blocking = excluded.blocking;
      end loop;
    end if;
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  if v_start <> v_old.starts_at then
    v_muutos := v_muutos || (
      'aika ' || to_char(v_old.starts_at at time zone v_tz, 'DD.MM. HH24:MI')
      || ' -> ' || to_char(v_start at time zone v_tz, 'DD.MM. HH24:MI')
    );
  end if;
  if v_party <> v_old.party_size then
    v_muutos := v_muutos || ('koko ' || v_old.party_size || ' -> ' || v_party);
  end if;
  if v_tables is not null then
    -- Tyyppimerkintä on korjaus: ilman sitä Postgres lukee sanan
    -- taulukoksi ja koko päivitys peruuntuu.
    v_muutos := v_muutos || 'pöytä'::text;
  end if;

  perform write_audit(
    v_old.restaurant_id, 'reservation.update', 'reservation',
    p_reservation, v_old.guest_name,
    'Muutti varausta: ' || v_old.guest_name
      || case when array_length(v_muutos, 1) is null then ''
              else ' (' || array_to_string(v_muutos, ', ') || ')' end,
    jsonb_build_object('starts_at', v_old.starts_at, 'party_size', v_old.party_size),
    jsonb_build_object('starts_at', v_start, 'party_size', v_party),
    false
  );

  return json_build_object('ok', true);
end;
$fn$;

revoke all on function public.reservation_update(
  uuid, date, time, int, text, text, text, text, uuid[]
) from anon;
