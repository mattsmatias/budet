-- ---------------------------------------------------------------------------
-- 0093 — Varauslista: haku nimellä ja suodatus yli päivärajojen
-- ---------------------------------------------------------------------------
--
-- Salinäkymä vastaa kysymykseen "kuka tulee tänään". Se on oikea
-- kysymys vuoron aikana ja väärä joka muuna hetkenä:
--
--   "Soitti Virtanen, sanoi varanneensa jollekin päivälle" — päivä on
--   tuntematon, ja salinäkymä osaa vain yhden päivän kerrallaan.
--
--   "Onko ensi viikonlopulle paljon varauksia" — vastaus vaatii
--   seitsemän sivunlatausta ja muistin.
--
-- Tämä funktio hakee varaukset jaksosta eikä päivästä, ja etsii nimellä
-- tai varausnumerolla. Se on sama aineisto ja samat oikeudet kuin
-- reservation_day:ssä — yhteystiedot vain esihenkilölle — mutta rajaus
-- tulee kysymyksestä eikä kalenterista.
--
-- ---------------------------------------------------------------------------
-- MIKSI HAKU ON KANNASSA
-- ---------------------------------------------------------------------------
--
-- Vaihtoehto olisi hakea kaikki varaukset selaimeen ja suodattaa siellä.
-- Silloin jokainen sivunlataus lähettäisi jokaisen asiakkaan nimen ja
-- puhelinnumeron selaimeen, jotta niistä voitaisiin näyttää kymmenen.
--
-- ---------------------------------------------------------------------------
-- MIKSI SIVUTUS ON RAJA EIKÄ EHDOTUS
-- ---------------------------------------------------------------------------
--
-- Ravintolalla on vuodessa kymmeniä tuhansia varauksia. Ilman ylärajaa
-- "kaikki menneet" olisi kysely joka palauttaa ne kaikki kerran per
-- sivunlataus. Yläraja on kannassa eikä käyttöliittymässä, koska
-- käyttöliittymiä voi olla monta ja kanta on yksi.

create or replace function reservation_search(
  p_restaurant uuid,
  p_scope text default 'upcoming',
  p_date date default null,
  p_query text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_limit int;
  v_offset int;
  v_q text;
  v_total int;
  v_rows json;
  v_desc boolean;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  /*
   * Tyhjä haku ja pelkät välilyönnit ovat sama asia kuin ei hakua.
   *
   * Ilman tätä yhden välilyönnin kirjoittaminen kenttään näyttäisi
   * tyhjän listan ja väittäisi ettei varauksia ole.
   */
  v_q := nullif(trim(coalesce(p_query, '')), '');

  /*
   * Jakson rajat.
   *
   * Päivä käyttää samaa illan rajausta kuin salinäkymä: ilta kuuluu
   * siihen päivään jona se avautui, myös keskiyön jälkeen.
   */
  if p_scope = 'day' and p_date is not null then
    select n.starts_at, n.ends_at into v_from, v_to
    from reservation_night_range(p_restaurant, p_date) n;
    v_desc := false;
  elsif p_scope = 'past' then
    v_from := null;
    v_to := now();
    /* Menneet uusin ensin: lähin mennyt ilta on se jota kysytään. */
    v_desc := true;
  elsif p_scope = 'all' then
    v_from := null;
    v_to := null;
    v_desc := true;
  else
    v_from := now();
    v_to := null;
    v_desc := false;
  end if;

  select count(*) into v_total
  from reservations r
  where r.restaurant_id = p_restaurant
    and (v_from is null or r.starts_at >= v_from)
    and (v_to is null or r.starts_at < v_to)
    and (
      v_q is null
      or r.guest_name ilike '%' || v_q || '%'
      or r.reference ilike v_q || '%'
      or coalesce(r.guest_phone, '') ilike '%' || v_q || '%'
      or coalesce(r.guest_email, '') ilike '%' || v_q || '%'
    );

  select coalesce(json_agg(x.rivi order by x.jarjestys), '[]'::json)
  into v_rows
  from (
    select
      json_build_object(
        'id', r.id,
        'reference', r.reference,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'date', (r.starts_at at time zone v_tz)::date,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        'allergies', r.allergies,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json),
        'tables', coalesce((
          select json_agg(t.name order by t.sort_order, t.name)
          from reservation_table_assignments a
          join restaurant_tables t on t.id = a.table_id
          where a.reservation_id = r.id
        ), '[]'::json)
      ) as rivi,
      /*
       * Järjestysavain erikseen.
       *
       * json_agg ei osaa lajitella rakentamansa olion kentän mukaan, ja
       * aikaleima merkkijonona lajittuisi kirjaimittain. Käänteinen
       * järjestys tehdään negaatiolla, jotta lajittelu on yksi lauseke
       * eikä kaksi haaraa jotka voivat ajautua erilleen.
       */
      case when v_desc then -extract(epoch from r.starts_at)
           else extract(epoch from r.starts_at) end as jarjestys
    from reservations r
    where r.restaurant_id = p_restaurant
      and (v_from is null or r.starts_at >= v_from)
      and (v_to is null or r.starts_at < v_to)
      and (
        v_q is null
        or r.guest_name ilike '%' || v_q || '%'
        or r.reference ilike v_q || '%'
        or coalesce(r.guest_phone, '') ilike '%' || v_q || '%'
        or coalesce(r.guest_email, '') ilike '%' || v_q || '%'
      )
    order by
      case when v_desc then -extract(epoch from r.starts_at)
           else extract(epoch from r.starts_at) end,
      r.guest_name
    limit v_limit
    offset v_offset
  ) x;

  return json_build_object(
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'timezone', v_tz,
    'canManage', v_manager,
    'rows', v_rows
  );
end;
$fn$;

/*
 * Hakuindeksi nimelle ja numerolle.
 *
 * Ilman indeksiä ilike-haku lukee ravintolan kaikki varaukset. Se on
 * nopeaa tuhannella rivillä ja hidasta sadallatuhannella, ja ero näkyy
 * vasta silloin kun sitä ei ehdi korjata.
 */
create index if not exists reservations_restaurant_starts
  on reservations (restaurant_id, starts_at desc);

create index if not exists reservations_guest_name_search
  on reservations (restaurant_id, lower(guest_name));

revoke all on function reservation_search(uuid, text, date, text, int, int)
  from public, anon;

grant execute on function reservation_search(uuid, text, date, text, int, int)
  to authenticated;
