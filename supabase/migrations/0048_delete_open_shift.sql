-- ---------------------------------------------------------------------------
-- 0048 — Avoimen vuoron poisto
-- ---------------------------------------------------------------------------
--
-- Avoin vuoro on vuoro jolla ei ole tekijää. Väärään päivään tehtynä
-- se jäi listalle pysyvästi: poisto esti menneen päivän, ja peruutus
-- jätti rivin näkyviin peruttuna.
--
-- MENNYT SUOJA ON TEKIJÄN SUOJA.
--
-- Poiston päivämääräraja on olemassa siksi, ettei tehtyä työtä voi
-- pyyhkiä pois. Vuoro jolla ei ole tekijää ei ole kenenkään tekemää
-- työtä eikä siihen voi liittyä leimauksia — sitä vasten ei ole mitään
-- suojattavaa.
--
-- JULKAISTU AVOIN VUORO PERUTAAN, EI POISTETA.
--
-- Julkaistu avoin vuoro on ollut tarjolla työntekijöille. Sen
-- katoaminen jäljettömiin veisi tiedon siitä että tarjous oli
-- olemassa. Peruutus riittää: migraatio 0048:n jälkeen peruttu avoin
-- vuoro ei enää näy tarjolla, mutta rivi säilyy.

create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.published_at is not null then
    raise exception 'Julkaistua vuoroa ei voi poistaa. Peru se, niin työntekijä saa tiedon.';
  end if;

  /*
   * Päivämääräraja koskee vain vuoroja joilla on tekijä.
   *
   * Tekijätön vuoro ei ole kenenkään tehtyä työtä, joten menneen
   * päivän suoja ei koske sitä. Muuten väärään päivään tehty avoin
   * vuoro jäisi listalle ikuisesti.
   */
  if v_shift.user_id is not null and v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;
