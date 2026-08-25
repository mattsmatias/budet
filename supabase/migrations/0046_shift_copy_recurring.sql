-- ---------------------------------------------------------------------------
-- 0046 — Kopiointi ja toistuvat vuorot
-- ---------------------------------------------------------------------------
--
-- Kuukauden suunnittelu vuoro kerrallaan on satakolmekymmentä lomaketta.
-- Ravintolan viikko on kuitenkin lähes sama joka viikko, joten
-- suunnittelu on käytännössä edellisen viikon kopiointia ja poikkeusten
-- korjaamista.
--
-- KOPIO EI SAA LUODA PÄÄLLEKKÄISYYTTÄ.
--
-- Kopiointi kohdistuu usein alueelle jossa on jo vuoroja: viikko
-- kopioidaan, sitten huomataan että puolet oli jo tehty. Ilman
-- ohitusta jokainen ihminen saisi kaksi vuoroa samaan aikaan, ja
-- virheen siivoaminen olisi työläämpää kuin koko kopiointi.
--
-- Siksi funktio ohittaa päivän jolla kyseisellä ihmisellä on jo
-- päällekkäinen vuoro, ja kertoo montako ohitettiin.
--
-- KOPIO SYNTYY LUONNOKSENA.
--
-- Kopioitu kuukausi on suunnitelman raakaversio. Se tarkistetaan ja
-- julkaistaan erikseen, kuten käsin tehty suunnitelmakin.

-- ---------------------------------------------------------------------------
-- Vuoron aikaväli
-- ---------------------------------------------------------------------------
--
-- Yön yli menevä vuoro päättyy seuraavana päivänä. Aikaväliksi
-- muutettuna päällekkäisyyden voi tarkistaa suoraan, eikä keskiyö ole
-- erikoistapaus jonka joku unohtaa.

create or replace function shift_range(p_date date, p_start time, p_end time)
returns tsrange
language sql
immutable
as $$
  select tsrange(
    (p_date + p_start)::timestamp,
    case
      when p_end > p_start then (p_date + p_end)::timestamp
      else (p_date + 1 + p_end)::timestamp
    end,
    '[)'
  );
$$;

/*
 * Onko ihmisellä jo vuoro tähän aikaan.
 *
 * Peruttuja ei lasketa: peruttu vuoro ei vie kenenkään aikaa.
 * Avoimille vuoroille (user null) ei tarkisteta mitään — kaksi avointa
 * vuoroa samaan aikaan on kaksi paikkaa jotka pitää täyttää, ei virhe.
 */
create or replace function shift_conflicts(
  p_user uuid,
  p_date date,
  p_start time,
  p_end time
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then false
    else exists (
      select 1
      from shifts s
      where s.user_id = p_user
        and s.cancelled_at is null
        and s.shift_date between p_date - 1 and p_date + 1
        and shift_range(s.shift_date, s.start_time, s.end_time)
            && shift_range(p_date, p_start, p_end)
    )
  end;
$$;

revoke all on function shift_conflicts from public;
grant execute on function shift_conflicts to authenticated;

-- ---------------------------------------------------------------------------
-- Aikavälin kopiointi
-- ---------------------------------------------------------------------------
--
-- Siirtymä päivinä eikä "seuraava viikko": sama funktio kopioi viikon
-- (7), kahden viikon jakson (14) ja kuukauden (kuukauden pituus).
-- Viikonpäivät säilyvät seitsemällä jaollisilla siirtymillä, ja juuri
-- se on kopioinnin tarkoitus.
--
-- Palauttaa kaksi lukua: montako luotiin ja montako ohitettiin.

create or replace function copy_shifts(
  p_restaurant uuid,
  p_from date,
  p_to date,
  p_offset integer
)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_skipped integer := 0;
  v_row shifts;
  v_date date;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi kopioida työvuoroja';
  end if;

  if p_offset = 0 then
    raise exception 'Kopiointi samaan päivään ei tekisi mitään';
  end if;

  for v_row in
    select *
    from shifts
    where restaurant_id = p_restaurant
      and shift_date between p_from and p_to
      and cancelled_at is null
    order by shift_date, start_time
  loop
    v_date := v_row.shift_date + p_offset;

    if shift_conflicts(v_row.user_id, v_date, v_row.start_time, v_row.end_time) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status, break_minutes, note, created_by
    )
    values (
      p_restaurant, v_row.user_id, v_row.position, v_date,
      v_row.start_time, v_row.end_time, v_row.location,
      case when v_row.user_id is null then 'draft'::shift_status else 'accepted'::shift_status end,
      v_row.break_minutes, v_row.note, auth.uid()
    );

    v_created := v_created + 1;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function copy_shifts from public;
grant execute on function copy_shifts to authenticated;

-- ---------------------------------------------------------------------------
-- Toistuva vuoro
-- ---------------------------------------------------------------------------
--
-- "Ali tekee maanantaisin ja tiistaisin 10–18 syyskuun ajan."
--
-- Viikonpäivät ISO-numeroina: 1 = maanantai, 7 = sunnuntai. Sama
-- numerointi kuin kalenterissa ja työvuorolistassa, jotta yksikään
-- näkymä ei joudu kääntämään sitä.

create or replace function create_recurring_shifts(
  p_restaurant uuid,
  p_user uuid,
  p_weekdays integer[],
  p_start time,
  p_end time,
  p_from date,
  p_to date,
  p_break integer default 0,
  p_position staff_position default null,
  p_location text default '',
  p_note text default null
)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_skipped integer := 0;
  v_date date;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi luoda työvuoroja';
  end if;

  if p_weekdays is null or array_length(p_weekdays, 1) is null then
    raise exception 'Valitse vähintään yksi viikonpäivä';
  end if;

  if p_to < p_from then
    raise exception 'Jakson loppu on ennen alkua';
  end if;

  /*
   * Yläraja jaksolle.
   *
   * Vuoden mittainen toistuva vuoro on lähes varmasti kirjausvirhe
   * päivämäärässä, ja se täyttäisi kalenterin sadoilla riveillä joita
   * kukaan ei ole tarkoittanut.
   */
  if p_to - p_from > 366 then
    raise exception 'Jakso on liian pitkä. Tee enintään vuoden mittainen jakso.';
  end if;

  v_date := p_from;

  while v_date <= p_to loop
    if extract(isodow from v_date)::integer = any (p_weekdays) then
      if shift_conflicts(p_user, v_date, p_start, p_end) then
        v_skipped := v_skipped + 1;
      else
        insert into shifts (
          restaurant_id, user_id, position, shift_date, start_time, end_time,
          location, status, break_minutes, note, created_by
        )
        values (
          p_restaurant, p_user, p_position, v_date, p_start, p_end,
          coalesce(p_location, ''),
          case when p_user is null then 'draft'::shift_status else 'accepted'::shift_status end,
          greatest(coalesce(p_break, 0), 0),
          nullif(trim(coalesce(p_note, '')), ''),
          auth.uid()
        );

        v_created := v_created + 1;
      end if;
    end if;

    v_date := v_date + 1;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function create_recurring_shifts from public;
grant execute on function create_recurring_shifts to authenticated;
