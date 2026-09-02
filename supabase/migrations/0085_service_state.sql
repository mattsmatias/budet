-- ---------------------------------------------------------------------------
-- 0085 — Laskua odottava pöytä ja keittiön kapasiteetti
-- ---------------------------------------------------------------------------
--
-- Kaksi asiaa jotka näkyvät salissa mutta eivät Katessa.
--
-- ---------------------------------------------------------------------------
-- 1. LASKUA ODOTTAVA PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Pöytä jossa on syöty ja lasku on pyydetty ei ole enää "asiakkaat
-- pöydässä" eikä vielä "vapaa". Se on se pöytä jonka tarjoilija
-- katsoo seuraavaksi, ja se on myös se pöytä joka vapautuu
-- kymmenessä minuutissa — tieto jota tarvitaan kun ovella seisoo
-- kaksi ihmistä.
--
-- Aikaleima eikä tila. reservation_status kertoo missä varaus menee
-- (tuleva, saapunut, mennyt); laskun pyytäminen on tapahtuma sen
-- sisällä. Uusi enum-arvo olisi pakottanut jokaisen tilasiirtymän
-- käsittelemään sen, ja "peruttu lasku" ei tarkoita mitään.

alter table reservations
  add column if not exists bill_requested_at timestamptz;

/**
 * Laskun pyyntö päälle ja pois.
 *
 * Sama funktio molempiin suuntiin, koska tarjoilija painaa väärää
 * pöytää yhtä usein kuin oikeaa. Peruminen ilman erillistä
 * toimintoa on se ero jonka takia merkintää uskalletaan käyttää.
 *
 * Vain saapuneelle seurueelle: laskua ei voi pyytää pöydästä jossa
 * ei istu ketään.
 */
create or replace function reservation_set_bill(
  p_reservation uuid,
  p_waiting boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_status reservation_status;
begin
  select r.restaurant_id, r.status into v_restaurant, v_status
  from reservations r where r.id = p_reservation;

  if v_restaurant is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if not is_manager(v_restaurant)
     and v_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_waiting and v_status <> 'arrived' then
    return json_build_object('ok', false, 'error', 'not_arrived');
  end if;

  update reservations
  set bill_requested_at = case when p_waiting then now() else null end
  where id = p_reservation;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function reservation_set_bill(uuid, boolean) from public, anon;
grant execute on function reservation_set_bill(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. KEITTIÖN KAPASITEETTI
-- ---------------------------------------------------------------------------
--
-- Pöytiä voi olla vapaana vaikka keittiö ei ehdi. Kaksitoista
-- neljän hengen pöytää tarkoittaa 48 paikkaa, mutta jos kaikki
-- istuutuvat kello 18:00, keittiö tekee 48 annosta puolessa
-- tunnissa — eikä tee.
--
-- Raja on annoksia aikaikkunassa, ei pöytiä. Kaksi eri asiaa:
-- pöytäkapasiteetti kertoo mahtuuko seurue istumaan,
-- keittiökapasiteetti ehtiikö keittiö ruokkia heidät.
--
-- ---------------------------------------------------------------------------
-- IKKUNA ON LIUKUVA, EI TASATUNTI
-- ---------------------------------------------------------------------------
--
-- "Enintään 40 henkeä tunnissa" tarkoittaa mitä tahansa tunnin
-- mittaista jaksoa, ei kello 18–19 ja 19–20 erikseen. Tasatunneittain
-- laskettuna 20 henkeä 18:55 ja 20 henkeä 19:05 mahtuisivat, vaikka
-- keittiöön osuu neljäkymmentä kymmenessä minuutissa.
--
-- Siksi tarkistus katsoo uuden varauksen alkuhetkestä eteen- ja
-- taaksepäin puoli ikkunaa, molemmat päät mukaan lukien.
--
-- Symmetria ei ollut ilmaista. Ensimmäinen toteutus käytti
-- puoliavointa väliä, ja silloin klo 18:30 mitattuna 18:00 laskettiin
-- mukaan mutta ei toisin päin: sama pari varauksia oli yhtä aikaa
-- sekä liikaa että sopivasti riippuen siitä kummasta päästä katsoi.
-- Testi löysi sen, ei silmä.

alter table reservation_settings
  add column if not exists kitchen_capacity integer;

alter table reservation_settings
  add column if not exists kitchen_window_minutes integer not null default 60;

alter table reservation_settings
  drop constraint if exists reservation_settings_kitchen;

alter table reservation_settings
  add constraint reservation_settings_kitchen check (
    (kitchen_capacity is null or kitchen_capacity > 0)
    and kitchen_window_minutes between 15 and 240
  );

/**
 * Montako ruokailijaa keittiöön osuu tähän aikaan.
 *
 * Lasketaan alkuajoista: ruoka tehdään kun seurue saapuu, ei koko
 * sen ajan kun se istuu. Kahden tunnin illallinen kuormittaa
 * keittiötä alussa, ei lopussa.
 *
 * Peruttu ja no-show eivät kuormita ketään.
 */
create or replace function kitchen_load(
  p_restaurant uuid,
  p_at timestamptz,
  p_exclude uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.party_size), 0)::integer
  from reservations r,
       lateral (
         select coalesce(s.kitchen_window_minutes, 60) as w
         from reservation_settings s
         where s.restaurant_id = p_restaurant
       ) k
  where r.restaurant_id = p_restaurant
    and r.status in ('pending', 'confirmed', 'arrived', 'completed')
    and (p_exclude is null or r.id <> p_exclude)
    /*
     * Etäisyys alkuhetkestä, molempiin suuntiin ja päät mukaan.
     *
     * abs() eikä kaksi vertailua: se on symmetrinen määritelmän
     * tasolla, eikä sitä voi vahingossa kirjoittaa epäsymmetriseksi
     * korjatessa. Sekunteina, koska minuuttien kokonaislukujako
     * pyöristäisi parittoman ikkunan väärin.
     */
    and abs(extract(epoch from (r.starts_at - p_at))) <= k.w * 30;
$$;

revoke execute on function kitchen_load(uuid, timestamptz, uuid) from public, anon;
grant execute on function kitchen_load(uuid, timestamptz, uuid) to authenticated;

/**
 * Mahtuuko seurue keittiön kapasiteettiin.
 *
 * Palauttaa tilanteen eikä pelkkää kyllä/ei: käyttöliittymän on
 * voitava kertoa kuinka paljon tilaa on jäljellä, jotta
 * ravintoloitsija näkee onko kyse yhdestä hengestä vai kymmenestä.
 *
 * Ilman asetettua rajaa vastaus on aina kyllä. Kate ei keksi
 * keittiölle kapasiteettia jota kukaan ei ole kertonut.
 */
create or replace function kitchen_check(
  p_restaurant uuid,
  p_at timestamptz,
  p_party integer,
  p_exclude uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_window integer;
  v_load integer;
begin
  select s.kitchen_capacity, coalesce(s.kitchen_window_minutes, 60)
  into v_capacity, v_window
  from reservation_settings s
  where s.restaurant_id = p_restaurant;

  if v_capacity is null then
    return json_build_object('limited', false, 'ok', true);
  end if;

  v_load := kitchen_load(p_restaurant, p_at, p_exclude);

  return json_build_object(
    'limited', true,
    'ok', v_load + p_party <= v_capacity,
    'capacity', v_capacity,
    'windowMinutes', v_window,
    'load', v_load,
    'remaining', greatest(0, v_capacity - v_load)
  );
end;
$$;

revoke execute on function kitchen_check(uuid, timestamptz, integer, uuid) from public, anon;
grant execute on function kitchen_check(uuid, timestamptz, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Raja varausmoottoriin
-- ---------------------------------------------------------------------------
--
-- Kapasiteetti joka näkyy vain ruudulla ei ole kapasiteetti. Se on
-- kytkettävä siihen yhteen paikkaan josta kaikki varaukset kulkevat.
--
-- ---------------------------------------------------------------------------
-- VERKKO ESTETÄÄN, SALI VAROITETAAN
-- ---------------------------------------------------------------------------
--
-- Asiakas verkossa ei voi neuvotella keittiön kanssa: hänelle raja on
-- raja, ja ylityksen salliminen tarkoittaisi ettei rajaa ole.
--
-- Esihenkilö sen sijaan tietää enemmän kuin Kate. Perjantain kymmenen
-- hengen seurue voi olla se joka tilaa kolme pizzaa, ja kielto olisi
-- silloin ohjelma joka väittää tietävänsä keittiöstä paremmin.
-- Hallintanäkymä näyttää kuorman, mutta ei estä.
--
-- reservation_slots suodattaa täydet ajat pois julkiselta listalta.
-- Ilman sitä asiakas valitsisi ajan jonka tallennus hylkää — ja se on
-- huonompi kuin ajan puuttuminen listalta.

create or replace function reservation_book(
  p_restaurant uuid,
  p_start timestamp with time zone,
  p_party integer,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_source reservation_source,
  p_status reservation_status default 'confirmed'::reservation_status,
  p_minutes integer default null,
  p_tables uuid[] default null,
  p_cancel_token text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_minutes int;
  v_end timestamptz;
  v_tables uuid[];
  v_id uuid;
  v_table uuid;
  v_kitchen json;
begin
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
$function$;

create or replace function reservation_slots(
  p_restaurant uuid,
  p_date date,
  p_party integer,
  p_exclude uuid default null
)
returns table(slot_time time without time zone, starts_at timestamp with time zone)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
  order by e.t;
end;
$function$;
