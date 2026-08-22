-- ---------------------------------------------------------------------------
-- 0011 — Esihenkilön tekemä vuoro on heti voimassa
-- ---------------------------------------------------------------------------
--
-- Vuoro syntyi tilaan pending ja jäi odottamaan työntekijän kuittausta.
-- Ravintolassa työvuoro ei ole ehdotus: kun omistaja tai vuoropäällikkö
-- merkitsee vuoron, se on vuoro. Kuittausvaihe tuotti vain tilan jossa
-- kukaan ei tiennyt onko lista voimassa.
--
-- Uusi ja uudelleen jaettu vuoro on siis suoraan accepted. Kaksi asiaa
-- säilyy tarkoituksella:
--
--   draft   — vuoro jolle ei ole vielä tekijää. Se ei ole kenenkään
--             vuoro, joten sitä ei voi merkitä voimassa olevaksi.
--
--   changed — jo voimassa olevan vuoron aika muuttui. Tämä ei ole
--             hyväksyntää vaan huomautus: työntekijä on saattanut
--             suunnitella päivänsä vanhan ajan mukaan, ja muutoksen on
--             erotuttava.
--
-- Työntekijä ilmoittaa esteestä poissaoloilmoituksella, joka on erillinen
-- toiminto ja näkyy esihenkilölle sekä vuorolistassa että huomioissa.
-- Vuoro pysyy hänellä kunnes esihenkilö tekee sille jotain.

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
        else 'accepted'::shift_status
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
        -- Vuoro siirtyi toiselle: uudelle tekijälle se on heti voimassa
        -- eikä edellisen kieltäytyminen jää roikkumaan mukana.
        when v_old.user_id is distinct from p_user then 'accepted'::shift_status
        else v_old.status
      end
  where id = p_shift;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

-- Vanhat kuittausta odottavat vuorot ovat nyt voimassa. Ilman tätä ne
-- jäisivät ikuisesti tilaan jota mikään ei enää tuota, ja työntekijälle
-- näkyisi "odottaa vastausta" ilman mitään mihin vastata.
update shifts set status = 'accepted' where status = 'pending';

-- Työntekijä ei enää vastaa vuoroon, joten hän ei myöskään saa muuttaa
-- sen tilaa. Ilman tätä oikeus jäisi voimaan vaikka käyttöliittymästä
-- ei enää olisi tapaa käyttää sitä — ja rajapinta on auki silti.
--
-- guard_shift_response_trigger jätetään paikalleen. Se ei tee mitään
-- niin kauan kuin päivitysoikeutta ei ole, mutta jos oikeus joskus
-- palautetaan, se estää aikojen muuttamisen ilman että kukaan muistaa
-- lisätä suojan uudelleen.
drop policy if exists shifts_respond on shifts;
