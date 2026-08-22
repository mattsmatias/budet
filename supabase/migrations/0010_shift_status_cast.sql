-- ---------------------------------------------------------------------------
-- 0010 — Uuden vuoron tila oikeaan tyyppiin
-- ---------------------------------------------------------------------------
--
-- Uuden työvuoron luonti kaatui virheeseen:
--
--   column "status" is of type shift_status but expression is of type text
--
-- Syy on insert-haaran case-lauseessa:
--
--   case when p_user is null then 'draft' else 'pending' end
--
-- Postgres ei tiedä lainausmerkeissä olevien literaalien tyyppiä. Yksin
-- insertin arvolistassa se päättelisi tyypin sarakkeesta, mutta case
-- ratkaisee haarojensa yhteisen tyypin ennen sitä — ja kahdesta
-- tuntemattomasta literaalista tulee text. Enum-sarakkeeseen ei voi
-- sijoittaa tekstiä ilman muunnosta.
--
-- Saman funktion update-haara toimi, koska siinä muunnos oli kirjoitettu
-- näkyviin. Siksi vuoron muokkaaminen onnistui ja vain luonti kaatui.
--
-- Alla oleva runko on haettu tuotannosta pg_get_functiondef-kutsulla ja
-- siihen on lisätty ainoastaan ::shift_status insert-haaraan. Mikään muu
-- ei muutu.

create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case
        when p_user is null then 'draft'::shift_status
        else 'pending'::shift_status
      end
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_old from shifts where id = p_shift;
  if v_old.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  update shifts
  set user_id = p_user,
      position = p_position,
      shift_date = p_date,
      start_time = p_start,
      end_time = p_end,
      location = coalesce(p_location, ''),
      previous_start_time = case
        when v_old.start_time is distinct from p_start then v_old.start_time
        else previous_start_time end,
      previous_end_time = case
        when v_old.end_time is distinct from p_end then v_old.end_time
        else previous_end_time end,
      status = case
        when v_old.status = 'accepted'
          and (v_old.start_time is distinct from p_start
               or v_old.end_time is distinct from p_end)
          then 'changed'::shift_status
        when p_user is null then 'draft'::shift_status
        when v_old.user_id is distinct from p_user then 'pending'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;
