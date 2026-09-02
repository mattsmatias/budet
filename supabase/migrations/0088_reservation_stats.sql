-- 0088 – Varausanalytiikka
--
-- Yksi funktio joka lukee jakson varaukset kerran ja palauttaa niistä
-- summat. Laskenta on kannassa siksi, että vaihtoehto olisi hakea
-- vuoden varaukset selaimeen ja laskea siellä — ja silloin selain
-- saisi jokaisen asiakkaan nimen ja puhelinnumeron nähtäväkseen
-- voidakseen laskea montako heitä oli.
--
-- Funktio palauttaa lukumääriä, ei valmiita prosentteja. Osuudet ja
-- keskiarvot lasketaan sovelluksessa omassa moduulissaan, jotta
-- pyöristys on yhdessä paikassa ja testattavissa.
--
-- ---------------------------------------------------------------------
-- MITÄ TÄYTTÖASTE TÄSSÄ TARKOITTAA
-- ---------------------------------------------------------------------
--
-- Käytetyt paikat jaettuna salin paikoilla, viikonpäivän ja tunnin
-- mukaan, keskiarvona jakson päivistä.
--
-- Kolme rajausta, jotta luku tarkoittaa jotain:
--
-- 1. Mukaan vain aukiolotunnit. Suljettu maanantai ei ole nolla
--    prosenttia täynnä, se ei ole auki. Aukiolo haetaan päivä
--    kerrallaan, koska poikkeuspäivä syrjäyttää viikkorytmin.
--
-- 2. Viimeinen istumisaika on viimeinen mitattu tunti. Sen jälkeen
--    pöytää ei voi enää antaa, joten tyhjyys siellä ei ole
--    käyttämätöntä kapasiteettia vaan sulkemisaika.
--
-- 3. Kapasiteetti on nykyisten käytössä olevien pöytien paikkamäärä.
--    Tätä EI tiedetä menneisyydestä: jos sali on juuri laajennettu,
--    vanhat viikot näyttävät tyhjemmiltä kuin olivat. Käyttöliittymän
--    on sanottava tämä ääneen, ei piilotettava sitä prosenttiin.

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

  v_from := (p_from + time '00:00') at time zone v_tz;
  v_to := ((p_to + 1) + time '00:00') at time zone v_tz;

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

  aukitunnit as (
    select distinct
      p.paiva,
      h.tunti
    from paivat p
    cross join lateral reservation_windows(p_restaurant, p.paiva) w
    cross join lateral generate_series(
      extract(hour from w.opens)::int,
      extract(hour from w.last_seating)::int,
      1
    ) as h(tunti)
  ),

  /*
   * Varatut paikat tunneittain.
   *
   * Varaus lasketaan jokaiselle tunnille jonka se kattaa: kello 18
   * alkava kahden tunnin varaus vie paikat myös yhdeksältä. Loppuhetki
   * vähennetään minuutilla, jottei tasan 20:00 päättyvä varaus näy
   * enää kahdeksalta.
   *
   * greatest pitää sarjan nousevana. Keskiyön yli menevä varaus jää
   * muuten tyhjäksi sarjaksi, koska 23 ei ole pienempi kuin 0.
   */
  kaytetyt as (
    select
      v.alkaa::date as paiva,
      gs.tunti,
      sum(v.party_size)::int as paikat,
      count(*)::int as varauksia
    from pitavat v
    cross join lateral generate_series(
      extract(hour from v.alkaa)::int,
      greatest(
        extract(hour from v.alkaa)::int,
        extract(hour from (v.paattyy - interval '1 minute'))::int
      ),
      1
    ) as gs(tunti)
    group by 1, 2
  )

  select json_build_object(
    'from', p_from,
    'to', p_to,
    'days', (p_to - p_from) + 1,

    'capacity', json_build_object('seats', v_seats, 'tables', v_tables),

    'totals', (
      select json_build_object(
        'reservations', count(*),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'noShow', count(*) filter (where status = 'no_show'),
        'realised', count(*) filter (where status in ('arrived', 'completed')),
        'upcoming', count(*) filter (where status in ('pending', 'confirmed')),
        'guests', coalesce(sum(party_size) filter (
          where status not in ('cancelled', 'no_show')), 0),
        'partySum', coalesce(sum(party_size) filter (
          where status not in ('cancelled', 'no_show')), 0),
        'partyCount', count(*) filter (
          where status not in ('cancelled', 'no_show'))
      )
      from varaukset
    ),

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
          from aukitunnit group by 1
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
