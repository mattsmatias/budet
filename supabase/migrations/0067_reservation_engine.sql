-- ---------------------------------------------------------------------------
-- 0067 — Varausmoottori
-- ---------------------------------------------------------------------------
--
-- Saatavuus lasketaan kannassa, ei selaimessa. Selain saa listan
-- vapaista ajoista, mutta se on ehdotus: varauksen luonti tarkistaa
-- kaiken uudelleen lukon takana. Selaimen kertoma vapaa aika on
-- vanhentunutta tietoa siitä hetkestä kun se piirrettiin.
--
-- ---------------------------------------------------------------------------
-- Miksi neuvoa-antava lukko
-- ---------------------------------------------------------------------------
--
-- Exclusion-rajoite estää päällekkäisyyden mutta ei ratkaise sitä
-- oikein. Kaksi yhtäaikaista varausta neljälle hengelle: molemmat
-- etsivät vapaan pöydän, molemmat löytävät pöydän 3, toinen kirjoittaa
-- ensin ja toinen kaatuu rajoitteeseen — vaikka pöytä 4 oli vapaa.
--
-- Ravintolakohtainen lukko sarjallistaa haun ja kirjoituksen. Jälkimmäinen
-- yritys näkee ensimmäisen tuloksen ja löytää pöydän 4. Lukko on
-- transaktiokohtainen, joten se vapautuu itsestään myös virhetilanteessa.
--
-- Lukko on ravintolakohtainen eikä globaali: kahden eri ravintolan
-- varaukset eivät odota toisiaan.

-- ---------------------------------------------------------------------------
-- Kesto henkilömäärän mukaan
-- ---------------------------------------------------------------------------

create or replace function reservation_duration_for(
  p_restaurant uuid,
  p_party int
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select d.minutes
      from reservation_durations d
      where d.restaurant_id = p_restaurant
        and d.min_party <= p_party
        and (d.max_party is null or d.max_party >= p_party)
      /* Tarkin sääntö voittaa: kapein väli ensin. */
      order by coalesce(d.max_party, 999) - d.min_party asc, d.min_party desc
      limit 1
    ),
    (select s.default_duration_minutes from reservation_settings s
     where s.restaurant_id = p_restaurant),
    90
  );
$$;

-- ---------------------------------------------------------------------------
-- Päivän aukiolo
-- ---------------------------------------------------------------------------
--
-- Poikkeus voittaa viikonpäivän aina. Suljettu päivä palauttaa nollan
-- riviä, jolloin päivälle ei synny yhtään aikaa.

create or replace function reservation_windows(
  p_restaurant uuid,
  p_date date
)
returns table (opens time, last_seating time)
language sql
stable
security definer
set search_path = public
as $$
  with poikkeus as (
    select * from reservation_exceptions e
    where e.restaurant_id = p_restaurant and e.exception_date = p_date
  )
  select e.opens, e.last_seating
  from poikkeus e
  where not e.closed

  union all

  select h.opens, h.last_seating
  from reservation_hours h
  where h.restaurant_id = p_restaurant
    and h.weekday = extract(isodow from p_date)::int
    and not exists (select 1 from poikkeus);
$$;

-- ---------------------------------------------------------------------------
-- Vapaat pöydät yhdelle aikavälille
-- ---------------------------------------------------------------------------
--
-- Palauttaa pöytien tunnisteet tai null jos kapasiteettia ei ole.
--
-- Yksittäinen pöytä ennen yhdistelmää, ja pienin riittävä ennen
-- suurinta: kahden hengen seuruetta ei istuteta kuuden pöytään jos
-- kahden pöytä on vapaana, eikä pöytiä yhdistetä turhaan.

create or replace function reservation_pick_tables(
  p_restaurant uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_party int,
  p_exclude uuid default null
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_turnaround int;
  v_range tstzrange;
  v_tables uuid[];
begin
  select coalesce(s.turnaround_minutes, 0) into v_turnaround
  from reservation_settings s where s.restaurant_id = p_restaurant;

  /*
   * Tyhjennysväli laajentaa hakuväliä molempiin suuntiin.
   *
   * Rajoite kannassa vartioi vain todellista päällekkäisyyttä; väli on
   * ravintolan toive siitä ettei seuraava seurue istu edellisen
   * lautasten päälle. Esihenkilö voi silti sijoittaa pöydän käsin
   * tiukemmin, ja se on tarkoitus.
   */
  v_range := tstzrange(
    p_start - make_interval(mins => coalesce(v_turnaround, 0)),
    p_end + make_interval(mins => coalesce(v_turnaround, 0)),
    '[)'
  );

  -- 1. Pienin yksittäinen pöytä johon seurue mahtuu.
  select array[t.id] into v_tables
  from restaurant_tables t
  where t.restaurant_id = p_restaurant
    and t.active
    and t.seats_min <= p_party
    and t.seats_max >= p_party
    and not exists (
      select 1 from reservation_table_assignments a
      where a.table_id = t.id
        and a.blocking
        and a.during && v_range
        and (p_exclude is null or a.reservation_id <> p_exclude)
    )
  order by t.seats_max asc, t.sort_order asc, t.name asc
  limit 1;

  if v_tables is not null then
    return v_tables;
  end if;

  -- 2. Pienin yhdistelmä jonka kaikki pöydät ovat vapaana ja käytössä.
  select array_agg(m.table_id order by m.table_id) into v_tables
  from table_combinations c
  join table_combination_members m on m.combination_id = c.id
  where c.id = (
    select c2.id
    from table_combinations c2
    where c2.restaurant_id = p_restaurant
      and c2.active
      and c2.seats_min <= p_party
      and c2.seats_max >= p_party
      and exists (select 1 from table_combination_members x where x.combination_id = c2.id)
      and not exists (
        select 1
        from table_combination_members m2
        join restaurant_tables t2 on t2.id = m2.table_id
        where m2.combination_id = c2.id
          and (
            not t2.active
            or exists (
              select 1 from reservation_table_assignments a
              where a.table_id = m2.table_id
                and a.blocking
                and a.during && v_range
                and (p_exclude is null or a.reservation_id <> p_exclude)
            )
          )
      )
    order by c2.seats_max asc, c2.created_at asc
    limit 1
  )
  group by c.id;

  return v_tables;
end;
$$;

-- ---------------------------------------------------------------------------
-- Päivän vapaat ajat
-- ---------------------------------------------------------------------------

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
as $$
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
    select w.opens, w.last_seating from reservation_windows(p_restaurant, p_date) w
  ),
  ajat as (
    select
      (w.opens + make_interval(mins => v_slot * g.n))::time as t
    from ikkunat w
    cross join lateral generate_series(
      0,
      /* Viimeinen istumisaika on mukana, sen jälkeiset eivät. */
      greatest(0, floor(extract(epoch from (w.last_seating - w.opens)) / 60 / v_slot)::int)
    ) as g(n)
  ),
  ehdokkaat as (
    select distinct a.t,
           ((p_date + a.t) at time zone v_tz) as alkaa
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
  order by e.t;
end;
$$;

-- ---------------------------------------------------------------------------
-- Varauksen luonti
-- ---------------------------------------------------------------------------
--
-- Yksi funktio kaikille lähteille. Julkinen widget, hallintanäkymä ja
-- walk-in kulkevat tästä, jotta sääntö on yksi eikä kolme.
--
-- p_tables antaa esihenkilön ohittaa automaattivalinnan. Julkinen
-- rajapinta ei koskaan välitä sitä.

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
  p_cancel_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
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

  if p_tables is null or array_length(p_tables, 1) is null then
    v_tables := reservation_pick_tables(p_restaurant, p_start, v_end, p_party);
  else
    /*
     * Käsin annetut pöydät tarkistetaan silti.
     *
     * Ne kuuluvat tähän ravintolaan ja ovat vapaana — muuten
     * esihenkilö voisi kaksoisvarata pöydän hallintanäkymästä.
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
    guest_name, guest_phone, guest_email, note, cancel_token_hash, created_by
  )
  values (
    p_restaurant, p_start, v_end, p_party, p_status, p_source,
    trim(p_name), nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_note, '')), ''),
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
$$;

-- ---------------------------------------------------------------------------
-- Julkinen rajapinta
-- ---------------------------------------------------------------------------
--
-- Neljä funktiota, ei yhtään taulua. Ravintola tunnistetaan slugista:
-- clientin lähettämä uuid olisi clientin valitsema.

create or replace function public_reservation_config(p_slug text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
    'today', (now() at time zone v_r.timezone)::date,
    'theme', json_build_object(
      'color', v_s.theme_color,
      'dark', v_s.theme_dark,
      'radius', v_s.theme_radius
    )
  );
end;
$$;

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
as $$
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
      select json_agg(to_char(s.slot_time, 'HH24:MI') order by s.slot_time)
      from reservation_slots(v_r.id, p_date, p_party) s
    ), '[]'::json)
  );
end;
$$;

create or replace function public_create_reservation(
  p_slug text,
  p_date date,
  p_time time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
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
   * roskavarauksilla, ja täyteen varattu sali on ravintolalle sama
   * asia kuin suljettu. Raja on puhelinnumerossa eikä IP-osoitteessa,
   * koska numero kerätään joka tapauksessa — IP-osoite olisi uusi
   * henkilötieto pelkkää laskuria varten.
   *
   * Viisi ei osu kehenkään oikeaan asiakkaaseen. Se ei myöskään estä
   * määrätietoista, joka vaihtaa numeroa — mutta ravintola näkee
   * varaukset ja voi perua ne. Tämä katkaisee vahingon ja kiusanteon.
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
   * Aika on aukioloajan sisällä ja aikavälin päällä.
   *
   * Ilman tätä asiakas voisi lähettää kellonajan 19:07 ohittaen
   * selaimen tarjoamat vaihtoehdot.
   */
  if not exists (
    select 1 from reservation_windows(v_r.id, p_date) w
    where p_time >= w.opens and p_time <= w.last_seating
  ) then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  if extract(epoch from p_time)::int % (v_s.slot_minutes * 60) <> 0 then
    return json_build_object('ok', false, 'error', 'slot');
  end if;

  v_start := (p_date + p_time) at time zone v_r.timezone;

  if v_start < now() + make_interval(mins => v_s.lead_minutes) then
    return json_build_object('ok', false, 'error', 'too_late');
  end if;

  /*
   * Peruutustunnus arvotaan kannassa, ei clientissä.
   *
   * gen_random_bytes olisi luontevin, mutta se on pgcryptoa ja asuu
   * Supabasessa extensions-skeemassa — search_path = public ei näe
   * sitä. Sama ansa kuin digestissä (0009). gen_random_uuid on
   * pg_catalogissa ja käyttää samaa satunnaislähdettä; kaksi niistä
   * on 64 heksamerkkiä ja 244 bittiä arvattavaa.
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
      'widget', 'confirmed', null, null, v_token
    );
  exception
    when exclusion_violation then
      /* Sekä "ei vapaata pöytää" että rajoitteen laukeaminen. */
      return json_build_object('ok', false, 'error', 'taken');
  end;

  select r.starts_at, r.ends_at, r.party_size into v_res
  from reservations r where r.id = v_id;

  return json_build_object(
    'ok', true,
    'cancelToken', v_token,
    'restaurantName', v_r.name,
    'date', p_date,
    'time', to_char(p_time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'tables', coalesce((
      select json_agg(t.name order by t.sort_order, t.name)
      from reservation_table_assignments a
      join restaurant_tables t on t.id = a.table_id
      where a.reservation_id = v_id
    ), '[]'::json)
  );
end;
$$;

create or replace function public_cancel_reservation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
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

  update reservations set status = 'cancelled' where id = v_res.id;

  return json_build_object(
    'ok', true,
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size
  );
end;
$$;

create or replace function public_reservation_lookup(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  if coalesce(trim(p_token), '') = '' then return null; end if;

  select r.*, x.name as restaurant_name, x.timezone
  into v_res
  from reservations r
  join restaurants x on x.id = r.restaurant_id
  where r.cancel_token_hash = encode(sha256(trim(p_token)::bytea), 'hex');

  if v_res.id is null then return null; end if;

  return json_build_object(
    'restaurantName', v_res.restaurant_name,
    'date', (v_res.starts_at at time zone v_res.timezone)::date,
    'time', to_char((v_res.starts_at at time zone v_res.timezone)::time, 'HH24:MI'),
    'partySize', v_res.party_size,
    'guestName', v_res.guest_name,
    'status', v_res.status,
    'cancellable', v_res.status in ('pending', 'confirmed')
                   and v_res.starts_at > now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- Vain julkiset funktiot anonille. Moottorin sisäiset funktiot eivät ole
-- anonin kutsuttavissa, vaikka ne ovat security definer — muuten kuka
-- tahansa voisi luetella toisen ravintolan pöydät tunnisteella.

revoke all on function reservation_pick_tables from public, anon;
revoke all on function reservation_book from public, anon;
revoke all on function reservation_slots from public, anon;
revoke all on function reservation_windows from public, anon;
revoke all on function reservation_duration_for from public, anon;

grant execute on function reservation_slots to authenticated;
grant execute on function reservation_windows to authenticated;
grant execute on function reservation_duration_for to authenticated;
grant execute on function reservation_pick_tables to authenticated;
grant execute on function reservation_book to authenticated;

grant execute on function public_reservation_config to anon, authenticated;
grant execute on function public_reservation_slots to anon, authenticated;
grant execute on function public_create_reservation to anon, authenticated;
grant execute on function public_cancel_reservation to anon, authenticated;
grant execute on function public_reservation_lookup to anon, authenticated;
