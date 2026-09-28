-- Palkat käyttöön yrityskohtaisesti.
--
-- Palkkaosio on koko sovelluksen ainoa moduuli jota iso osa yrityksistä
-- ei tarvitse lainkaan: yhden ihmisen toiminimi ei pidä kirjaa
-- työntekijöistä eikä leimaa vuoroja. Heille se oli sivu valikossa,
-- oma osio asetuksissa ja kortti yleiskatsauksessa, jotka kaikki
-- kertoivat tyhjästä.
--
-- MIKSI TÄMÄN SAA KYTKEÄ POIS.
--
-- Koska se ei kanna yhtään lukua. Henkilöstökulut tulevat kuiteista
-- (category = 'staff') aivan kuten kaikki muutkin kulut, ja ne
-- kulkevat kulujen summiin, kirjanpidon tilille 5000 ja tulokseen
-- samaa reittiä kuin ennenkin. Palkkamoduulin laskema työnantajakustannus
-- on erillinen arvio leimatuista tunneista eikä sitä lasketa mihinkään
-- summaan. Kytkin siis piilottaa näkymän, ei muuta euroa.
--
-- OLETUS ON ERI VANHOILLE JA UUSILLE.
--
-- Sarake luodaan arvolla true, jotta yksikään käytössä oleva yritys ei
-- menetä mitään tämän myötä, ja oletus vaihdetaan heti sen jälkeen
-- falseksi: uusi yritys aloittaa ilman palkkaosiota ja ottaa sen
-- käyttöön kun ensimmäinen työntekijä palkataan.

alter table restaurants
  add column if not exists payroll_enabled boolean not null default true;

alter table restaurants
  alter column payroll_enabled set default false;

comment on column restaurants.payroll_enabled is
  'Onko palkkaosio (tyontekijat, leimaus, tyonantajakustannus) kaytossa. '
  'Ei vaikuta yhteenkaan lukuun: henkilostokulut tulevat kuiteista.';

-- Näkymä kantaa tiedon istuntoon. Koko select-lista uudelleen, koska
-- create or replace ei salli sarakkeen lisäämistä keskelle.
create or replace view my_restaurants as
  select
    r.id,
    r.name,
    r.timezone,
    r.currency,
    m.role,
    r.slug,
    r.business_type,
    r.logo_path,
    r.status,
    r.trial_ends_on,
    r.closed_weekdays,
    r.payroll_enabled
  from restaurants r
  join memberships m on m.restaurant_id = r.id
  where m.user_id = (select auth.uid())
    and m.active;

-- Asetusten tallennus. Null tarkoittaa "älä koske", kuten muillakin
-- kentillä, jotta yhtä asetusta voi muuttaa ilman että muut kulkevat
-- mukana.
create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null,
  p_closed_weekdays smallint[] default null,
  p_payroll_enabled boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa asetuksia';
  end if;

  if p_name is not null and trim(p_name) = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if p_timezone is not null
     and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  if p_closed_weekdays is not null
     and not (p_closed_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Viikonpäivä on 1-7';
  end if;

  update restaurants
  set name = coalesce(trim(p_name), name),
      timezone = coalesce(p_timezone, timezone),
      closed_weekdays = coalesce(
        (select array_agg(distinct d order by d) from unnest(p_closed_weekdays) as d),
        case when p_closed_weekdays is null then closed_weekdays else '{}'::smallint[] end
      ),
      payroll_enabled = coalesce(p_payroll_enabled, payroll_enabled),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

-- Vanha nelipaikkainen jää muuten rinnalle ja tekee nelipaikkaisesta
-- kutsusta monitulkintaisen.
drop function if exists update_restaurant(uuid, text, text, smallint[]);

revoke all on function update_restaurant(uuid, text, text, smallint[], boolean)
  from public, anon;
grant execute on function update_restaurant(uuid, text, text, smallint[], boolean)
  to authenticated;

-- Leimaus tarkistaa kytkimen kannassa asti.
--
-- Palvelinteot tarkistavat saman, mutta leimaus on ainoa palkkakirjoitus
-- jonka tekee joku muu kuin omistaja: työntekijän istunnolla on oikeus
-- näihin funktioihin, joten ehdon kuuluu olla myös siellä missä kirjoitus
-- tapahtuu. Sama kuvio kuin aiemmalla open_shift_claiming-lipulla.
create or replace function clock_in(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_zone text;
  v_id uuid;
  v_enabled boolean;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei paasya taman yrityksen tietoihin.'
      using errcode = '42501';
  end if;

  select payroll_enabled, timezone into v_enabled, v_zone
  from restaurants where id = p_restaurant;

  if not coalesce(v_enabled, false) then
    raise exception 'Palkat eivat ole kaytossa tassa yrityksessa.'
      using errcode = '42501';
  end if;

  v_employee := employee_for_me(p_restaurant);
  if v_employee is null then
    raise exception 'Sinua ei ole lisatty taman yrityksen tyontekijaksi.'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from time_entries
    where employee_id = v_employee and clock_out is null
  ) then
    raise exception 'Vuoro on jo kaynnissa.' using errcode = '23505';
  end if;

  insert into time_entries (restaurant_id, employee_id, work_date, clock_in)
  values (
    p_restaurant,
    v_employee,
    (now() at time zone coalesce(v_zone, 'Europe/Helsinki'))::date,
    now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Ulosleimaus sallitaan myös kytkimen jälkeen: kesken jäänyt vuoro on jo
-- tehtyä työtä, ja sen sulkematta jättäminen jättäisi rivin ikuisesti
-- auki. Vain uuden vuoron aloitus estyy.
create or replace function clock_out(p_restaurant uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee uuid;
  v_id uuid;
begin
  if p_restaurant not in (select my_restaurant_ids()) then
    raise exception 'Ei paasya taman yrityksen tietoihin.'
      using errcode = '42501';
  end if;

  v_employee := employee_for_me(p_restaurant);
  if v_employee is null then
    raise exception 'Sinua ei ole lisatty taman yrityksen tyontekijaksi.'
      using errcode = '42501';
  end if;

  update time_entries
  set clock_out = now(),
      minutes = greatest(0, round(extract(epoch from (now() - clock_in)) / 60))
  where employee_id = v_employee and clock_out is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Kaynnissa olevaa vuoroa ei ole.' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;
