-- ---------------------------------------------------------------------------
-- 0094 — Analytiikka: päivittäinen kehitys ja vertailu edelliseen jaksoon
-- ---------------------------------------------------------------------------
--
-- Kolme lisäystä samaan funktioon:
--
--   1. byDay — jokainen jakson päivä omana rivinään, myös tyhjät.
--      Trendi on kuvio eikä luku, eikä kuviota näe ilman nollia:
--      lista jossa on vain ne päivät joina oli varauksia näyttää
--      tasaiselta myös silloin kun joka toinen päivä on tyhjä.
--
--   2. previous — edellisen yhtä pitkän jakson summat.
--      "142 varausta" ei kerro onko se paljon. "142, +18 %" kertoo.
--      Vertailujakso on edeltävä yhtä pitkä jakso eikä "sama kuukausi
--      viime vuonna": jälkimmäinen on parempi kysymys mutta vaatii
--      vuoden aineiston, jota useimmilla ei vielä ole.
--
--   3. Aukiolo joka ylittää keskiyön (0091) mukaan täyttöasteeseen.
--      Aiemmin tuntisarja laskettiin avaamistunnista viimeisen
--      istumisajan tuntiin, ja keskiyön yli menevällä illalla se oli
--      tyhjä sarja: 18 ei ole pienempi kuin 2.
--
-- ---------------------------------------------------------------------------
-- MINKÄ PÄIVÄN VARAUS ON
-- ---------------------------------------------------------------------------
--
-- Analytiikassa varaus kuuluu siihen kalenteripäivään jona se alkaa.
-- Salinäkymässä ilta kuuluu avauspäiväänsä, joten kello 00:30 alkava
-- varaus näkyy siellä lauantain iltana ja täällä sunnuntain rivillä.
--
-- Ero on tarkoituksellinen. Salissa kysymys on "kuka tulee tänä iltana"
-- ja vastauksen on oltava yksi ilta. Analytiikassa kysymys on "miten
-- varaukset jakautuvat", ja siinä kaikki luvut on laskettava samalla
-- säännöllä — myös täyttöaste, joka lasketaan kellonajoista. Yksi
-- sääntö koko funktiossa on tarkistettavissa; kaksi ei.

-- ---------------------------------------------------------------------------
-- Jakson summat
-- ---------------------------------------------------------------------------
--
-- Omana funktionaan, koska sama laskenta tehdään kahdesti: nykyiselle
-- jaksolle ja sitä edeltävälle. Kaksi kopiota samasta json_build_objectista
-- olisi kaksi paikkaa joissa "vieras" tarkoittaa eri asiaa.

create or replace function reservation_totals(
  p_restaurant uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns json
language sql
stable
security definer
set search_path = public
as $fn$
  select json_build_object(
    'reservations', count(*),
    'cancelled', count(*) filter (where r.status = 'cancelled'),
    'noShow', count(*) filter (where r.status = 'no_show'),
    'realised', count(*) filter (where r.status in ('arrived', 'completed')),
    'upcoming', count(*) filter (where r.status in ('pending', 'confirmed')),
    'guests', coalesce(sum(r.party_size) filter (
      where r.status not in ('cancelled', 'no_show')), 0),
    'partySum', coalesce(sum(r.party_size) filter (
      where r.status not in ('cancelled', 'no_show')), 0),
    'partyCount', count(*) filter (
      where r.status not in ('cancelled', 'no_show'))
  )
  from reservations r
  where r.restaurant_id = p_restaurant
    and r.starts_at >= p_from
    and r.starts_at < p_to;
$fn$;

revoke all on function reservation_totals(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function reservation_totals(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Analytiikka
-- ---------------------------------------------------------------------------

create or replace function public.reservation_stats(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_days int;
  v_prev_from timestamptz;
  v_seats int;
  v_tables int;
  v_out json;
begin
  /*
   * Esihenkilön tieto, ei koko henkilökunnan.
   *
   * Peruutusprosentti ja vieraiden määrä ovat liiketoiminnan lukuja
   * samaan tapaan kuin myynti. Salinäkymä riittää vuoron tekemiseen.
   */
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Virheellinen aikavali.' using errcode = '22007';
  end if;

  /*
   * Yläraja on suoja eikä mielipide: aukiolo haetaan päivä kerrallaan,
   * joten jakson pituus on suoraan kyselyiden määrä.
   */
  if (p_to - p_from) > 400 then
    raise exception 'Liian pitka aikavali.' using errcode = '22003';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;

  v_days := (p_to - p_from) + 1;
  v_from := (p_from + time '00:00') at time zone v_tz;
  v_to := ((p_to + 1) + time '00:00') at time zone v_tz;

  /* Edeltävä yhtä pitkä jakso, päivä ennen jakson alkua taaksepäin. */
  v_prev_from := ((p_from - v_days) + time '00:00') at time zone v_tz;

  select coalesce(sum(t.seats_max), 0), count(*)
    into v_seats, v_tables
  from restaurant_tables t
  where t.restaurant_id = p_restaurant and t.active;

  with varaukset as (
    select
      r.id,
      r.party_size,
      r.status::text as status,
      r.source::text as source,
      (r.starts_at at time zone v_tz) as alkaa,
      (r.ends_at at time zone v_tz) as paattyy
    from reservations r
    where r.restaurant_id = p_restaurant
      and r.starts_at >= v_from
      and r.starts_at < v_to
  ),

  /*
   * Varaus joka vie pöydän.
   *
   * Peruttu ja saapumatta jäänyt ovat merkintöjä siitä että joku aikoi
   * tulla. Ne lasketaan omina lukuinaan, mutta ne eivät ole vieraita
   * eivätkä täyttöastetta.
   */
  pitavat as (
    select * from varaukset
    where status in ('pending', 'confirmed', 'arrived', 'completed')
  ),

  paivat as (
    select d::date as paiva
    from generate_series(p_from, p_to, interval '1 day') d
  ),

  /*
   * Aukiolotunnit paikallisina hetkinä.
   *
   * Sarja lasketaan avaamistunnista aukiolon pituuden yli, jolloin
   * keskiyön ylittävä ilta jatkuu seuraavan päivän tunteihin sen sijaan
   * että sarja jäisi tyhjäksi. Tunti pyöristetään alaspäin, jotta
   * 18:30 avautuva ravintola on auki tunnilla 18 eikä puolikkaalla.
   */
  aukitunnit as (
    select distinct
      (h.hetki)::date as paiva,
      extract(hour from h.hetki)::int as tunti
    from paivat p
    cross join lateral reservation_windows(p_restaurant, p.paiva) w
    cross join lateral generate_series(
      0,
      floor(
        (coalesce(w.span_minutes, 0) + extract(minute from w.opens)::int)::numeric / 60
      )::int
    ) as g(n)
    cross join lateral (
      select date_trunc('hour', (p.paiva + w.opens)::timestamp)
             + make_interval(hours => g.n) as hetki
    ) h
  ),

  /* Auki olleet päivät avauspäivän mukaan: viikonpäivä on avauspäivä. */
  aukipaivat as (
    select p.paiva
    from paivat p
    where exists (select 1 from reservation_windows(p_restaurant, p.paiva))
  ),

  /*
   * Varatut paikat tunneittain.
   *
   * Varaus lasketaan jokaiselle tunnille jonka se kattaa: kello 18
   * alkava kahden tunnin varaus vie paikat myös yhdeksältä. Loppuhetki
   * vähennetään minuutilla, jottei tasan 20:00 päättyvä varaus näy enää
   * kahdeksalta.
   */
  kaytetyt as (
    select
      h.hetki::date as paiva,
      extract(hour from h.hetki)::int as tunti,
      sum(v.party_size)::int as paikat,
      count(*)::int as varauksia
    from pitavat v
    cross join lateral generate_series(
      0,
      greatest(
        0,
        floor(
          extract(epoch from (
            date_trunc('hour', v.paattyy - interval '1 minute')
            - date_trunc('hour', v.alkaa)
          )) / 3600
        )::int
      )
    ) as gs(n)
    cross join lateral (
      select date_trunc('hour', v.alkaa) + make_interval(hours => gs.n) as hetki
    ) h
    group by 1, 2
  )

  select json_build_object(
    'from', p_from,
    'to', p_to,
    'days', v_days,

    'capacity', json_build_object('seats', v_seats, 'tables', v_tables),

    'totals', reservation_totals(p_restaurant, v_from, v_to),

    /* Edeltävä jakso samoilla säännöillä, samasta funktiosta. */
    'previous', reservation_totals(p_restaurant, v_prev_from, v_from),

    'byDay', coalesce((
      select json_agg(json_build_object(
               'date', d.paiva,
               'reservations', d.n,
               'guests', d.vieraat,
               'cancelled', d.peruttu,
               'noShow', d.ei_saapunut)
             order by d.paiva)
      from (
        select
          p.paiva,
          coalesce(v.n, 0) as n,
          coalesce(v.vieraat, 0) as vieraat,
          coalesce(v.peruttu, 0) as peruttu,
          coalesce(v.ei_saapunut, 0) as ei_saapunut
        from paivat p
        left join (
          select
            alkaa::date as paiva,
            count(*)::int as n,
            coalesce(sum(party_size) filter (
              where status not in ('cancelled', 'no_show')), 0)::int as vieraat,
            count(*) filter (where status = 'cancelled')::int as peruttu,
            count(*) filter (where status = 'no_show')::int as ei_saapunut
          from varaukset
          group by 1
        ) v on v.paiva = p.paiva
      ) d
    ), '[]'::json),

    'bySource', coalesce((
      select json_agg(json_build_object('source', s.source, 'count', s.n)
                      order by s.n desc, s.source)
      from (
        select source, count(*)::int as n from varaukset group by source
      ) s
    ), '[]'::json),

    'byHour', coalesce((
      select json_agg(json_build_object(
               'hour', h.tunti,
               'reservations', h.n,
               'guests', h.paikat)
             order by h.tunti)
      from (
        select extract(hour from alkaa)::int as tunti,
               count(*)::int as n,
               coalesce(sum(party_size), 0)::int as paikat
        from pitavat group by 1
      ) h
    ), '[]'::json),

    'byWeekday', coalesce((
      select json_agg(json_build_object(
               'weekday', w.vk,
               'reservations', w.n,
               'guests', w.paikat,
               'days', w.paivia,
               'openDays', w.auki)
             order by w.vk)
      from (
        select
          d.vk,
          d.paivia,
          coalesce(a.auki, 0) as auki,
          coalesce(v.n, 0) as n,
          coalesce(v.paikat, 0) as paikat
        from (
          select extract(isodow from paiva)::int as vk, count(*)::int as paivia
          from paivat group by 1
        ) d
        left join (
          select extract(isodow from paiva)::int as vk,
                 count(distinct paiva)::int as auki
          from aukipaivat group by 1
        ) a on a.vk = d.vk
        left join (
          select extract(isodow from alkaa)::int as vk,
                 count(*)::int as n,
                 coalesce(sum(party_size), 0)::int as paikat
          from pitavat group by 1
        ) v on v.vk = d.vk
      ) w
    ), '[]'::json),

    'occupancy', coalesce((
      select json_agg(json_build_object(
               'weekday', o.vk,
               'hour', o.tunti,
               'seats', o.paikat,
               'days', o.paivia)
             order by o.vk, o.tunti)
      from (
        select
          extract(isodow from t.paiva)::int as vk,
          t.tunti,
          round(avg(coalesce(k.paikat, 0))::numeric, 2) as paikat,
          count(*)::int as paivia
        from aukitunnit t
        left join kaytetyt k on k.paiva = t.paiva and k.tunti = t.tunti
        group by 1, 2
      ) o
    ), '[]'::json)
  )
  into v_out;

  return v_out;
end;
$fn$;

revoke all on function public.reservation_stats(uuid, date, date) from anon;
grant execute on function public.reservation_stats(uuid, date, date) to authenticated;
