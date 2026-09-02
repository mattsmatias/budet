-- ---------------------------------------------------------------------------
-- 0083 — Pöytäehdotukset varausta tehtäessä
-- ---------------------------------------------------------------------------
--
-- reservation_pick_tables valitsee pienimmän sopivan pöydän tai
-- yhdistelmän ja palauttaa sen. Se on oikea valinta verkkovaraukselle:
-- asiakas ei tiedä mikä pöytä on ikkunan vieressä eikä sen kuulu
-- päättää siitä.
--
-- Salissa se on väärä valinta. Esihenkilö tietää että kahdeksan hengen
-- seurue kannattaa laittaa 12+13 eikä 18+19, koska 18 on keittiön oven
-- vieressä. Kate ei tiedä sitä eikä voi tietää — mutta se voi näyttää
-- molemmat ja antaa ihmisen valita.
--
-- ---------------------------------------------------------------------------
-- SAMA SAATAVUUS, ERI MÄÄRÄ VASTAUKSIA
-- ---------------------------------------------------------------------------
--
-- Tämä funktio ei ole toinen varausmoottori. Se käyttää täsmälleen
-- samaa vapaana olemisen sääntöä kuin reservation_pick_tables:
-- tyhjennysvälillä laajennettu aikaväli, estävät varaukset, käytöstä
-- poistetut pöydät pois.
--
-- Jos säännöt eroaisivat, käyttöliittymä tarjoaisi pöytää jonka
-- tallennus hylkää — ja se on pahempi kuin ehdotusten puuttuminen.
--
-- ---------------------------------------------------------------------------
-- JÄRJESTYS ON MIELIPIDE, JA SE SANOTAAN ÄÄNEEN
-- ---------------------------------------------------------------------------
--
-- Ensin ne joissa menee vähiten paikkoja hukkaan, sitten yksittäiset
-- pöydät ennen yhdistelmiä. Kahden hengen seurue neljän pöydässä on
-- kaksi menetettyä paikkaa; sama seurue kahdessa yhdistetyssä pöydässä
-- on kaksi menetettyä paikkaa ja yksi ylimääräinen pöytä pois pelistä.
--
-- Järjestys on ehdotus. Lista näyttää kaikki, ja esihenkilö valitsee.

create or replace function reservation_table_options(
  p_restaurant uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_party int,
  p_exclude uuid default null,
  p_limit int default 6
)
returns table (
  kind text,
  table_ids uuid[],
  label text,
  seats_max int,
  /** Montako paikkaa jää käyttämättä. Nolla on täydellinen osuma. */
  wasted int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_turnaround int;
  v_range tstzrange;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_range := tstzrange(
    p_start - make_interval(mins => coalesce(v_turnaround, 0)),
    p_end + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  return query
  with vapaat as (
    select t.id, t.name, t.seats_min, t.seats_max, t.sort_order
    from restaurant_tables t
    where t.restaurant_id = p_restaurant
      and t.active
      and not exists (
        select 1 from reservation_table_assignments a
        where a.table_id = t.id
          and a.blocking
          and a.during && v_range
          and (p_exclude is null or a.reservation_id <> p_exclude)
      )
  ),

  yksittaiset as (
    select
      'table'::text as kind,
      array[v.id] as table_ids,
      v.name as label,
      v.seats_max,
      v.seats_max - p_party as wasted,
      0 as jarjestys,
      v.sort_order
    from vapaat v
    where v.seats_min <= p_party and v.seats_max >= p_party
  ),

  yhdistelmat as (
    select
      'combination'::text as kind,
      array_agg(m.table_id order by t.sort_order, t.name) as table_ids,
      /*
       * Nimi yhdistelmälle.
       *
       * Ravintola voi antaa oman nimen ("Ikkunapöydät"). Jos ei ole,
       * nimi kootaan pöytien nimistä: "12 + 13" on se miten siitä
       * salissa puhutaan.
       */
      coalesce(
        nullif(btrim(c.name), ''),
        string_agg(t.name, ' + ' order by t.sort_order, t.name)
      ) as label,
      c.seats_max,
      c.seats_max - p_party as wasted,
      1 as jarjestys,
      min(t.sort_order) as sort_order
    from table_combinations c
    join table_combination_members m on m.combination_id = c.id
    join vapaat t on t.id = m.table_id
    where c.restaurant_id = p_restaurant
      and c.active
      and c.seats_min <= p_party
      and c.seats_max >= p_party
    group by c.id, c.name, c.seats_max
    /*
     * Yhdistelmä kelpaa vain kokonaisena.
     *
     * Liitos vapaisiin pöytiin pudottaa varatut jäsenet pois, joten
     * ryhmän koko kertoo montako niistä oli vapaana. Ilman tätä
     * ehtoa puoliksi varattu yhdistelmä näyttäisi vapaalta.
     */
    having count(*) = (
      select count(*) from table_combination_members x
      where x.combination_id = c.id
    )
  )

  select o.kind, o.table_ids, o.label, o.seats_max, o.wasted
  from (
    select * from yksittaiset
    union all
    select * from yhdistelmat
  ) o
  order by o.wasted asc, o.jarjestys asc, o.sort_order asc, o.label asc
  limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function reservation_table_options(uuid, timestamptz, timestamptz, int, uuid, int)
  from public, anon;

grant execute on function reservation_table_options(uuid, timestamptz, timestamptz, int, uuid, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Varauksen aikaväli yhdellä kutsulla
-- ---------------------------------------------------------------------------
--
-- Ehdotusfunktio ottaa vastaan aikaleimat, mutta lomakkeella on
-- päivämäärä ja kellonaika. Muunnos vaatii ravintolan aikavyöhykkeen
-- ja oletuskeston, ja molemmat ovat kannassa.
--
-- Selaimessa laskettuna sama muunnos olisi toinen paikka jossa
-- kesäaika menee pieleen — ja pahimmillaan ehdotus koskisi eri
-- aikaväliä kuin tallennus, jolloin lista tarjoaisi pöytää jonka
-- tallennus hylkää.

create or replace function reservation_window(
  p_restaurant uuid,
  p_date date,
  p_time text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_minutes int;
  v_start timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;

  select coalesce(s.default_duration_minutes, 90) into v_minutes
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_minutes := coalesce(v_minutes, 90);

  v_start := (p_date + p_time::time) at time zone v_tz;

  return json_build_object(
    'startsAt', v_start,
    'endsAt', v_start + make_interval(mins => v_minutes)
  );
end;
$$;

revoke execute on function reservation_window(uuid, date, text) from public, anon;
grant execute on function reservation_window(uuid, date, text) to authenticated;
