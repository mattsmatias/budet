-- ---------------------------------------------------------------------------
-- 0049 — Monen vuoron poisto kerralla
-- ---------------------------------------------------------------------------
--
-- Vuoro kerrallaan poistaminen on kaksi klikkausta per rivi. Kun
-- kopiointi tai toistuva vuoro on tehnyt kuukauden verran vääriä
-- rivejä, se on satakolmekymmentä klikkausta — ja käytännössä se
-- tarkoittaa että virheelliset rivit jäävät kantaan.
--
-- SÄÄNNÖT EIVÄT LÖYSTY JOUKOSSA.
--
-- Jokaiseen riviin sovelletaan täsmälleen samat säännöt kuin
-- yksittäin: luonnos poistetaan, julkaistu perutaan, ja menneen
-- päivän nimetty vuoro on suojattu. Joukkotoiminto joka ohittaisi
-- säännöt olisi tapa kiertää ne.
--
-- YKSI RIVI EI KAADA MUITA.
--
-- Valinnassa on lähes aina rivejä joihin ei voi koskea. Jos yksi
-- niistä keskeyttäisi koko toimenpiteen, joukkopoisto epäonnistuisi
-- juuri silloin kun sitä eniten tarvitaan. Sen sijaan jokainen rivi
-- käsitellään erikseen ja tulos kerrotaan kolmena lukuna.

create or replace function bulk_remove_shifts(p_ids uuid[])
returns table (removed integer, cancelled integer, blocked integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer := 0;
  v_cancelled integer := 0;
  v_blocked integer := 0;
  v_shift shifts;
  v_id uuid;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return query select 0, 0, 0;
    return;
  end if;

  /*
   * Yläraja kerralla käsiteltäville.
   *
   * Valinta tehdään näkymästä joka näyttää yhden kuukauden, joten
   * viisisataa riittää moninkertaisesti. Raja on olemassa siksi, ettei
   * yksi kutsu voi lukita koko taulua.
   */
  if array_length(p_ids, 1) > 500 then
    raise exception 'Liian monta vuoroa kerralla. Valitse enintään 500.';
  end if;

  foreach v_id in array p_ids loop
    select * into v_shift from shifts where id = v_id;

    if v_shift.id is null then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if not is_manager(v_shift.restaurant_id) then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    -- Jo peruttu on jo tehty. Ei virhe eikä uusi tapahtuma.
    if v_shift.cancelled_at is not null then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    if v_shift.published_at is not null then
      update shifts
      set cancelled_at = now(), cancelled_by = auth.uid()
      where id = v_id;

      insert into shift_changes (
        shift_id, restaurant_id, kind, changed_by,
        from_user_id, from_date, from_start, from_end, from_break
      )
      values (
        v_id, v_shift.restaurant_id, 'cancelled', auth.uid(),
        v_shift.user_id, v_shift.shift_date, v_shift.start_time,
        v_shift.end_time, v_shift.break_minutes
      );

      v_cancelled := v_cancelled + 1;
      continue;
    end if;

    /*
     * Menneen päivän nimetty vuoro on suojattu myös joukossa.
     *
     * Tekijätön vuoro ei ole kenenkään tehtyä työtä, joten sitä raja
     * ei koske — sama sääntö kuin yksittäispoistossa.
     */
    if v_shift.user_id is not null and v_shift.shift_date < current_date then
      v_blocked := v_blocked + 1;
      continue;
    end if;

    delete from shifts where id = v_id;
    v_removed := v_removed + 1;
  end loop;

  return query select v_removed, v_cancelled, v_blocked;
end;
$$;

revoke all on function bulk_remove_shifts from public;
grant execute on function bulk_remove_shifts to authenticated;
