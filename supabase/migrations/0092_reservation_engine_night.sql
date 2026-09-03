-- ---------------------------------------------------------------------------
-- 0092 — Varausmoottori: yön yli jatkuva ilta, varausnumero, allergiat, raja
-- ---------------------------------------------------------------------------
--
-- Edellinen migraatio antoi sarakkeet ja apufunktiot. Tämä kirjoittaa
-- moottorin funktiot uudelleen niin, että jokainen niistä muuttuu
-- täsmälleen kerran. Neljä muutosta kulkee samojen funktioiden läpi:
--
--   1. Ilta joka jatkuu keskiyön yli
--      Kellonaika ei enää tarkoita annettua päivää vaan sitä hetkeä
--      johon se aukiolossa osuu. Muunnos on reservation_start_at:ssä,
--      ja jokainen kohta jossa päivä ja kello muutettiin aikaleimaksi
--      kutsuu nyt sitä.
--
--   2. Varausnumero
--      Syntyy liipaisimessa. Funktiot vain palauttavat sen eteenpäin —
--      asiakkaalle vahvistukseen ja saliin listaan.
--
--   3. Allergiat omana kenttänään
--      Kulkee widgetistä kantaan ja kannasta saliin erillään
--      toivekentästä.
--
--   4. Peruutusraja
--      public_cancel_reservation tarkistaa asetuksen. Salin oma
--      peruutus ei kulje täältä eikä siihen kosketa.
--
-- ---------------------------------------------------------------------------
-- MIKSI FUNKTIOT PUDOTETAAN ENNEN LUONTIA
-- ---------------------------------------------------------------------------
--
-- Uusi parametri ei ole muutos vaan uusi funktio: create or replace
-- jättäisi vanhan version pystyyn, ja kutsu ilman uutta parametria olisi
-- sen jälkeen kaksiselitteinen. Pudotus on siis osa muutosta eikä
-- siivousta.

-- ---------------------------------------------------------------------------
-- 1. Varauksen kirjaus
-- ---------------------------------------------------------------------------

drop function if exists reservation_book(
  uuid, timestamptz, int, text, text, text, text,
  reservation_source, reservation_status, int, uuid[], text
);

create or replace function reservation_book(
  p_restaurant uuid,
  p_start timestamptz,
  p_party int,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source reservation_source,
  p_status reservation_status default 'confirmed',
  p_minutes int default null,
  p_tables uuid[] default null,
  p_cancel_token text default null,
  p_allergies text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
  v_kitchen json;
begin
  /*
   * Lukko ennen hakua.
   *
   * Kaikki tämän ravintolan varausyritykset kulkevat tästä jonossa.
   * Transaktiokohtainen: vapautuu commitissa ja rollbackissa.
   */
  perform pg_advisory_xact_lock(hashtext('kate:reservation:' || p_restaurant::text));

  v_minutes := coalesce(p_minutes, reservation_duration_for(p_restaurant, p_party));
  v_end := p_start + make_interval(mins => v_minutes);

  /* Keittiön raja koskee vain verkosta tulevia. */
  if p_source in ('widget', 'link') then
    v_kitchen := kitchen_check(p_restaurant, p_start, p_party);

    if (v_kitchen->>'limited')::boolean and not (v_kitchen->>'ok')::boolean then
      raise exception 'Keittio on varattu tahan aikaan.'
        using errcode = 'exclusion_violation';
    end if;
  end if;

  if p_tables is null or array_length(p_tables, 1) is null then
    v_tables := reservation_pick_tables(p_restaurant, p_start, v_end, p_party);
  else
    /*
     * Käsin annetut pöydät tarkistetaan silti.
     *
     * Ne kuuluvat tähän ravintolaan — muuten esihenkilö voisi kirjata
     * varauksen toisen ravintolan pöytään.
     */
    if exists (
      select 1 from unnest(p_tables) as x(id)
      where not exists (
        select 1 from restaurant_tables t
        where t.id = x.id and t.restaurant_id = p_restaurant
      )
    ) then
      raise exception 'Pöytä ei kuulu tähän ravintolaan.'
        using errcode = 'check_violation';
    end if;

    v_tables := p_tables;
  end if;

  if v_tables is null or array_length(v_tables, 1) is null then
    raise exception 'Vapaata pöytää ei ole tähän aikaan.'
      using errcode = 'exclusion_violation';
  end if;

  insert into reservations (
    restaurant_id, starts_at, ends_at, party_size, status, source,
    guest_name, guest_phone, guest_email, note, allergies,
    cancel_token_hash, created_by
  )
  values (
    p_restaurant, p_start, v_end, p_party, p_status, p_source,
    trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_allergies, '')), ''),
    case when p_cancel_token is null then null
         else encode(sha256(p_cancel_token::bytea), 'hex') end,
    auth.uid()
  )
  returning id into v_id;

  foreach v_table in array v_tables loop
    insert into reservation_table_assignments
      (reservation_id, table_id, starts_at, ends_at, blocking)
    values (
      v_id, v_table, p_start, v_end,
      p_status in ('pending', 'confirmed', 'arrived')
    );
  end loop;

  return v_id;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Vapaat ajat
-- ---------------------------------------------------------------------------
--
-- Ajat lasketaan paikallisina aikaleimoina eikä kellonaikoina.
-- Kellonaika + minuutit kiertää vuorokauden ympäri hiljaa: 23:30 + 60
-- minuuttia on 00:30, ja se näytti kuuluvan samaan päivään. Paikallinen
-- aikaleima kasvaa seuraavaan päivään kuten ilta oikeasti kasvaa, ja
-- vasta lopuksi se muutetaan hetkeksi ravintolan vyöhykkeellä — jolloin
-- myös kesäajan vaihto osuu oikein.

create or replace function reservation_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns table (slot_time time, starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_slot int;
  v_lead int;
  v_minutes int;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  select s.slot_minutes, s.lead_minutes into v_slot, v_lead
  from reservation_settings s where s.restaurant_id = p_restaurant;

  if v_slot is null then return; end if;

  v_minutes := reservation_duration_for(p_restaurant, p_party);

  return query
  with ikkunat as (
    select w.opens, w.span_minutes
    from reservation_windows(p_restaurant, p_date) w
  ),
  ajat as (
    select ((p_date + w.opens)::timestamp
            + make_interval(mins => v_slot * g.n)) as paikallinen
    from ikkunat w
    cross join lateral generate_series(
      0,
      /* Viimeinen istumisaika on mukana, sen jälkeiset eivät. */
      greatest(0, floor(coalesce(w.span_minutes, 0)::numeric / v_slot)::int)
    ) as g(n)
  ),
  ehdokkaat as (
    select distinct
      a.paikallinen::time as t,
      (a.paikallinen at time zone v_tz) as alkaa
    from ajat a
  )
  select e.t, e.alkaa
  from ehdokkaat e
  where
    /* Menneisyyteen ei varata, eikä liian lyhyellä varoitusajalla. */
    e.alkaa >= now() + make_interval(mins => coalesce(v_lead, 0))
    and reservation_pick_tables(
          p_restaurant,
          e.alkaa,
          e.alkaa + make_interval(mins => v_minutes),
          p_party,
          p_exclude
        ) is not null
    /* Täysi keittiö ei näy vapaana aikana. */
    and (kitchen_check(p_restaurant, e.alkaa, p_party, p_exclude)->>'ok')::boolean
  /*
   * Järjestys on hetki eikä kellonaika.
   *
   * Kellonajan mukaan lajiteltuna keskiyön jälkeiset ajat nousisivat
   * listan kärkeen: 00:30 on pienempi luku kuin 18:00, mutta se on
   * illan viimeinen aika eikä ensimmäinen.
   */
  order by e.alkaa;
end;
$fn$;

create or replace function reservation_admin_slots(
  p_restaurant uuid,
  p_date date,
  p_party int,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.starts_at)
      from reservation_slots(p_restaurant, p_date, p_party, p_exclude) s
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Varauksen aikaväli lomakkeelle
-- ---------------------------------------------------------------------------

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
as $fn$
declare
  v_minutes int;
  v_start timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(s.default_duration_minutes, 90) into v_minutes
  from reservation_settings s where s.restaurant_id = p_restaurant;

  v_minutes := coalesce(v_minutes, 90);

  /* Sama muunnos kuin tallennuksessa, jottei ehdotus koske eri iltaa. */
  v_start := reservation_start_at(p_restaurant, p_date, p_time::time);

  return json_build_object(
    'startsAt', v_start,
    'endsAt', v_start + make_interval(mins => v_minutes)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Varaus ja walk-in salista
-- ---------------------------------------------------------------------------

drop function if exists reservation_create_admin(
  uuid, date, time, int, text, text, text, text, boolean, int, uuid[]
);

create or replace function reservation_create_admin(
  p_restaurant uuid,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_walk_in boolean default false,
  p_minutes int default null,
  p_tables uuid[] default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_start timestamptz;
  v_id uuid;
  v_ref text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if p_party < 1 then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  v_start := reservation_start_at(p_restaurant, p_date, p_time);

  begin
    v_id := reservation_book(
      p_restaurant, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      case when p_walk_in then 'walk_in'::reservation_source
           else 'admin'::reservation_source end,
      case when p_walk_in then 'arrived'::reservation_status
           else 'confirmed'::reservation_status end,
      p_minutes, p_tables, null,
      left(trim(coalesce(p_allergies, '')), 200)
    );
  exception
    when exclusion_violation then
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.reference into v_ref from reservations r where r.id = v_id;

  perform write_audit(
    p_restaurant,
    case when p_walk_in then 'reservation.walk_in' else 'reservation.create' end,
    'reservation', v_id, trim(p_name),
    case when p_walk_in then 'Lisäsi walk-inin: ' else 'Loi varauksen: ' end
      || trim(p_name) || ', ' || p_party || ' hlö, '
      || to_char(p_date, 'DD.MM.YYYY') || ' klo ' || to_char(p_time, 'HH24:MI'),
    null,
    jsonb_build_object('party_size', p_party, 'starts_at', v_start),
    false
  );

  return json_build_object('ok', true, 'id', v_id, 'reference', v_ref);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Varauksen muokkaus
-- ---------------------------------------------------------------------------

drop function if exists reservation_update(
  uuid, date, time, int, text, text, text, text, uuid[]
);

create or replace function reservation_update(
  p_reservation uuid,
  p_date date default null,
  p_time time default null,
  p_party int default null,
  p_name text default null,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_tables uuid[] default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_old record;
  v_tz text;
  v_start timestamptz;
  v_night date;
  v_night_start timestamptz;
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

  /*
   * Uusi hetki lasketaan samasta funktiosta kuin uusi varaus.
   *
   * Kalenterissa varausta raahataan kello kahteen yöllä, ja se kuuluu
   * yhä siihen iltaan josta se raahattiin. Ilman yhteistä muunnosta
   * siirto olisi hypännyt vuorokauden taaksepäin.
   */
  if p_date is not null or p_time is not null then
    /*
     * Oletuspäivä on illan päivä, ei kalenteripäivä.
     *
     * Kello 00:30 alkava varaus on tallennettu sunnuntain puolelle
     * mutta se on lauantain iltaa. Jos siirto ilman päivämäärää
     * käyttäisi kalenteripäivää, kalenterissa tehty pieni siirto
     * hyppäisi vuorokauden eteenpäin.
     */
    v_night := (v_old.starts_at at time zone v_tz)::date;

    select n.starts_at into v_night_start
    from reservation_night_range(v_old.restaurant_id, v_night) n;

    if v_night_start is not null and v_old.starts_at < v_night_start then
      v_night := v_night - 1;
    end if;

    v_start := reservation_start_at(
      v_old.restaurant_id,
      coalesce(p_date, v_night),
      coalesce(p_time, (v_old.starts_at at time zone v_tz)::time)
    );
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
                  else nullif(left(trim(p_note), 500), '') end,
      allergies = case when p_allergies is null then allergies
                       else nullif(left(trim(p_allergies), 200), '') end
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
    /* Tyyppimerkintä on korjaus (0086): ilman sitä sana luetaan taulukoksi. */
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

-- ---------------------------------------------------------------------------
-- 6. Julkinen varaus
-- ---------------------------------------------------------------------------

create or replace function public_reservation_config(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return null; end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;

  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object(
      'restaurantName', v_r.name,
      'enabled', false
    );
  end if;

  return json_build_object(
    'restaurantName', v_r.name,
    'enabled', true,
    'timezone', v_r.timezone,
    'minParty', v_s.min_party,
    'maxParty', v_s.max_party,
    'maxDaysAhead', v_s.max_days_ahead,
    /* Widget kertoo rajan ennen varausta, ei vasta peruutusyrityksessä. */
    'cancelCutoffHours', coalesce(v_s.cancel_cutoff_hours, 0),
    'today', (now() at time zone v_r.timezone)::date,
    'theme', json_build_object(
      'color', v_s.theme_color,
      'dark', v_s.theme_dark,
      'radius', v_s.theme_radius
    )
  );
end;
$fn$;

create or replace function public_reservation_slots(
  p_slug text,
  p_date date,
  p_party int
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
  v_today date;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then return json_build_object('slots', '[]'::json); end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('slots', '[]'::json);
  end if;

  /* Rajat tarkistetaan täällä, ei selaimessa. */
  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('slots', '[]'::json, 'reason', 'party');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;

  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('slots', '[]'::json, 'reason', 'date');
  end if;

  return json_build_object(
    'slots', coalesce((
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.starts_at)
      from reservation_slots(v_r.id, p_date, p_party) s
    ), '[]'::json)
  );
end;
$fn$;

drop function if exists public_create_reservation(
  text, date, time, int, text, text, text, text
);

create or replace function public_create_reservation(
  p_slug text,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null,
  p_allergies text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_r record;
  v_s record;
  v_today date;
  v_start timestamptz;
  v_id uuid;
  v_token text;
  v_res record;
begin
  select id, name, timezone into v_r from restaurants where slug = p_slug;
  if v_r.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_s from reservation_settings where restaurant_id = v_r.id;
  if v_s.restaurant_id is null or not v_s.enabled then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if p_party < v_s.min_party or p_party > v_s.max_party then
    return json_build_object('ok', false, 'error', 'party');
  end if;

  if coalesce(trim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'name');
  end if;

  if coalesce(trim(p_phone), '') = '' then
    return json_build_object('ok', false, 'error', 'phone');
  end if;

  v_today := (now() at time zone v_r.timezone)::date;
  if p_date < v_today or p_date > v_today + v_s.max_days_ahead then
    return json_build_object('ok', false, 'error', 'date');
  end if;

  /*
   * Sama puhelinnumero, korkeintaan viisi tulevaa varausta.
   *
   * Julkinen rajapinta ilman kirjautumista on täytettävissä
   * roskavarauksilla, ja täyteen varattu sali on ravintolalle sama asia
   * kuin suljettu. Raja on puhelinnumerossa eikä IP-osoitteessa, koska
   * numero kerätään joka tapauksessa.
   */
  if (
    select count(*)
    from reservations x
    where x.restaurant_id = v_r.id
      and x.guest_phone = left(trim(p_phone), 40)
      and x.status in ('pending', 'confirmed')
      and x.starts_at > now()
  ) >= 5 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  /*
   * Aika on aukioloikkunan sisällä.
   *
   * Etäisyys avaamisesta kierrätetään vuorokauden yli, joten sama
   * tarkistus kelpaa myös illalle joka jatkuu keskiyön yli: 00:30 on
   * 390 minuuttia 18:00:sta ja mahtuu ikkunaan jonka pituus on 480.
   */
  if not exists (
    select 1
    from reservation_windows(v_r.id, p_date) w
    cross join lateral (
      select (((extract(epoch from (p_time - w.opens)) / 60)::int % 1440) + 1440) % 1440 as off
    ) o
    where o.off <= coalesce(w.span_minutes, 0)
  ) then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if extract(epoch from p_time)::int % (v_s.slot_minutes * 60) <> 0 then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  v_start := reservation_start_at(v_r.id, p_date, p_time);

  if v_start < now() + make_interval(mins => v_s.lead_minutes) then
    return json_build_object('ok', false, 'error', 'too_late');
  end if;

  /*
   * Peruutustunnus arvotaan kannassa, ei clientissä.
   *
   * gen_random_uuid on pg_catalogissa ja käyttää samaa satunnaislähdettä
   * kuin pgcrypton gen_random_bytes, joka Supabasessa asuu skeemassa
   * jota search_path = public ei näe. Kaksi uuid:ta on 64 heksamerkkiä.
   */
  v_token := replace(gen_random_uuid()::text, '-', '')
             || replace(gen_random_uuid()::text, '-', '');

  begin
    v_id := reservation_book(
      v_r.id, v_start, p_party,
      left(trim(p_name), 120),
      left(trim(coalesce(p_phone, '')), 40),
      left(trim(coalesce(p_email, '')), 160),
      left(trim(coalesce(p_note, '')), 500),
      'widget', 'confirmed', null, null, v_token,
      left(trim(coalesce(p_allergies, '')), 200)
    );
  exception
    when exclusion_violation then
      /* Sekä "ei vapaata pöytää" että rajoitteen laukeaminen. */
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.starts_at, r.ends_at, r.party_size, r.reference into v_res
  from reservations r where r.id = v_id;

  return json_build_object(
    'ok', true,
    'cancelToken', v_token,
    /* Numero on se jonka asiakas lukee puhelimessa ääneen. */
    'reference', v_res.reference,
    'restaurantName', v_r.name,
    'date', (v_res.starts_at at time zone v_r.timezone)::date,
    'time', to_char(p_time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'cancelCutoffHours', coalesce(v_s.cancel_cutoff_hours, 0),
    'tables', coalesce((
      select json_agg(t.name order by t.sort_order, t.name)
      from reservation_table_assignments a
      join restaurant_tables t on t.id = a.table_id
      where a.reservation_id = v_id
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 7. Asiakkaan oma peruutus
-- ---------------------------------------------------------------------------

create or replace function public_cancel_reservation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_res record;
  v_cutoff int;
begin
  if coalesce(trim(p_token), '') = '' then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_res.status in ('cancelled', 'no_show', 'completed') then
    return json_build_object('ok', false, 'error', 'already');
  end if;

  if v_res.starts_at < now() then
    return json_build_object('ok', false, 'error', 'past');
  end if;

  select coalesce(s.cancel_cutoff_hours, 0) into v_cutoff
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  /*
   * Raja koskee verkkoperuutusta, ei peruutusta.
   *
   * Asiakas soittaa ja sali peruu. Virhe kertoo rajan tunteina, jotta
   * käyttöliittymä voi sanoa mihin asti linkki toimi — "peruutus ei
   * onnistunut" ilman lukua on ohje soittaa arvaamalla.
   */
  if coalesce(v_cutoff, 0) > 0
     and v_res.starts_at < now() + make_interval(hours => v_cutoff) then
    return json_build_object(
      'ok', false,
      'error', 'cutoff',
      'cutoffHours', v_cutoff
    );
  end if;

  update reservations set status = 'cancelled' where id = v_res.id;

  return json_build_object(
    'ok', true,
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size
  );
end;
$fn$;

create or replace function public_reservation_lookup(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_res record;
  v_cutoff int;
begin
  if coalesce(trim(p_token), '') = '' then return null; end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then return null; end if;

  select coalesce(s.cancel_cutoff_hours, 0) into v_cutoff
  from reservation_settings s where s.restaurant_id = v_res.restaurant_id;

  return json_build_object(
    'restaurantName', v_res.restaurant_name,
    'reference', v_res.reference,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'guestName', v_res.guest_name,
    'status', v_res.status,
    'cancelCutoffHours', coalesce(v_cutoff, 0),
    /*
     * Miksi peruutusta ei voi tehdä.
     *
     * Sivu näyttää eri lauseen menneelle ajalle ja liian myöhäiselle:
     * jälkimmäisessä asiakas voi yhä perua soittamalla. Ero on
     * kellonajassa, ja kello kuuluu kantaan — sivu piirretään
     * palvelimella, ja siellä kellon lukeminen kesken piirron on
     * epävakaa tulos joka voi muuttua ilman että mikään muuttui.
     */
    'cancelBlocked', case
      when v_res.status not in ('pending', 'confirmed') then null
      when v_res.starts_at <= now() then 'past'
      when coalesce(v_cutoff, 0) > 0
           and v_res.starts_at < now() + make_interval(hours => v_cutoff)
        then 'cutoff'
      else null
    end,
    'cancellable', v_res.status in ('pending', 'confirmed')
                   and v_res.starts_at > now()
                   and (
                     coalesce(v_cutoff, 0) = 0
                     or v_res.starts_at >= now() + make_interval(hours => coalesce(v_cutoff, 0))
                   )
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Päivän varaukset
-- ---------------------------------------------------------------------------
--
-- ILTA KUULUU SIIHEN PÄIVÄÄN JONA SE AVAUTUI.
--
-- Kalenteripäivä oli oikea rajaus niin kauan kuin ilta päättyi ennen
-- keskiyötä. Nyt kello 00:30 alkava varaus on lauantain iltaa, ja
-- lauantain salinäkymän on näytettävä se — muuten se ilmestyisi
-- sunnuntain aamuun, jolloin ravintola on kiinni.
--
-- Raja kulkee siis edellisen illan viimeisessä ajassa: sunnuntai alkaa
-- siitä hetkestä johon lauantain ilta päättyi. Sama sääntö molemmissa
-- päissä, joten yksikään varaus ei näy kahdesti eikä katoa.

create or replace function reservation_night_range(
  p_restaurant uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_tz text;
  v_prev_last time;
  v_own_last time;
begin
  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  if v_tz is null then return; end if;

  /* Edellisen illan viimeinen aika, jos se ylitti keskiyön. */
  select max(w.last_seating) into v_prev_last
  from reservation_windows(p_restaurant, p_date - 1) w
  where w.last_seating < w.opens;

  /* Tämän illan viimeinen aika, jos se ylittää keskiyön. */
  select max(w.last_seating) into v_own_last
  from reservation_windows(p_restaurant, p_date) w
  where w.last_seating < w.opens;

  return query select
    case
      when v_prev_last is null then (p_date + time '00:00') at time zone v_tz
      /* Sekunti eteenpäin: tasan viimeiseen aikaan alkava kuuluu eiliseen. */
      else ((p_date + v_prev_last)::timestamp + interval '1 second') at time zone v_tz
    end,
    case
      when v_own_last is null then ((p_date + 1) + time '00:00') at time zone v_tz
      else (((p_date + 1) + v_own_last)::timestamp + interval '1 second') at time zone v_tz
    end;
end;
$fn$;

create or replace function public.reservation_day(
  p_restaurant uuid,
  p_date date
)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_tz text;
  v_manager boolean;
  v_from timestamptz;
  v_to timestamptz;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta tähän ravintolaan.'
      using errcode = 'insufficient_privilege';
  end if;

  select r.timezone into v_tz from restaurants r where r.id = p_restaurant;
  v_manager := is_manager(p_restaurant);

  select n.starts_at, n.ends_at into v_from, v_to
  from reservation_night_range(p_restaurant, p_date) n;

  return json_build_object(
    'date', p_date,
    'timezone', v_tz,
    'canManage', v_manager,
    'settings', (
      select json_build_object(
        'enabled', s.enabled,
        'slotMinutes', s.slot_minutes,
        'defaultDurationMinutes', s.default_duration_minutes,
        'turnaroundMinutes', s.turnaround_minutes,
        'minParty', s.min_party,
        'maxParty', s.max_party,
        'kitchenCapacity', s.kitchen_capacity,
        'kitchenWindowMinutes', s.kitchen_window_minutes
      )
      from reservation_settings s where s.restaurant_id = p_restaurant
    ),
    'hours', (
      select json_build_object(
        'opens', to_char(w.opens, 'HH24:MI'),
        'lastSeating', to_char(w.last_seating, 'HH24:MI'),
        /* Kalenterin aikajana venyy tällä keskiyön yli. */
        'spanMinutes', w.span_minutes
      )
      from reservation_windows(p_restaurant, p_date) w
      order by w.opens
      limit 1
    ),
    'areas', coalesce((
      select json_agg(json_build_object('id', a.id, 'name', a.name)
                      order by a.sort_order, a.name)
      from dining_areas a where a.restaurant_id = p_restaurant
    ), '[]'::json),
    'tables', coalesce((
      select json_agg(json_build_object(
        'id', t.id,
        'name', t.name,
        'areaId', t.area_id,
        'seatsMin', t.seats_min,
        'seatsMax', t.seats_max,
        'active', t.active,
        'posX', t.pos_x,
        'posY', t.pos_y,
        'shape', t.shape,
        'rotation', t.rotation,
        'width', t.width
      ) order by t.sort_order, t.name)
      from restaurant_tables t where t.restaurant_id = p_restaurant
    ), '[]'::json),
    'elements', coalesce((
      select json_agg(json_build_object(
        'id', e.id,
        'areaId', e.area_id,
        'kind', e.kind,
        'label', e.label,
        'posX', e.pos_x,
        'posY', e.pos_y,
        'width', e.width,
        'height', e.height,
        'rotation', e.rotation
      ) order by e.sort_order, e.created_at)
      from floor_elements e where e.restaurant_id = p_restaurant
    ), '[]'::json),
    'reservations', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'reference', r.reference,
        'startsAt', r.starts_at,
        'endsAt', r.ends_at,
        'time', to_char((r.starts_at at time zone v_tz)::time, 'HH24:MI'),
        'endTime', to_char((r.ends_at at time zone v_tz)::time, 'HH24:MI'),
        'partySize', r.party_size,
        'status', r.status,
        'source', r.source,
        'guestName', r.guest_name,
        'guestPhone', case when v_manager then r.guest_phone else null end,
        'guestEmail', case when v_manager then r.guest_email else null end,
        'note', r.note,
        /* Allergia näkyy myös tarjoilijalle: se on salityötä. */
        'allergies', r.allergies,
        'billRequestedAt', r.bill_requested_at,
        'tableIds', coalesce((
          select json_agg(a.table_id) from reservation_table_assignments a
          where a.reservation_id = r.id
        ), '[]'::json)
      ) order by r.starts_at, r.guest_name)
      from reservations r
      where r.restaurant_id = p_restaurant
        and r.starts_at >= v_from
        and r.starts_at < v_to
    ), '[]'::json)
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------

revoke all on function reservation_book from public, anon;
revoke all on function reservation_slots from public, anon;
revoke all on function reservation_night_range(uuid, date) from public, anon;
grant execute on function reservation_night_range(uuid, date) to authenticated;
revoke all on function reservation_create_admin from public, anon;
revoke all on function reservation_update from public, anon;
revoke all on function public.reservation_day(uuid, date) from anon;

grant execute on function reservation_book to authenticated;
grant execute on function reservation_slots to authenticated;
grant execute on function reservation_create_admin to authenticated;
grant execute on function reservation_update to authenticated;
grant execute on function reservation_admin_slots to authenticated;
grant execute on function reservation_window(uuid, date, text) to authenticated;

grant execute on function public_reservation_config to anon, authenticated;
grant execute on function public_reservation_slots to anon, authenticated;
grant execute on function public_create_reservation to anon, authenticated;
grant execute on function public_cancel_reservation to anon, authenticated;
grant execute on function public_reservation_lookup to anon, authenticated;
