-- ---------------------------------------------------------------------------
-- 0045 — Työvuorosuunnittelun perusta
-- ---------------------------------------------------------------------------
--
-- Työvuoroja on voinut luoda yksi kerrallaan, ja jokainen luotu vuoro on
-- näkynyt tekijälleen heti. Kuukauden suunnittelu vaatii toisenlaisen
-- kulun: koko kuukausi luonnostellaan rauhassa, tarkistetaan, ja
-- julkaistaan kerralla.
--
-- JULKAISU JA VASTAUS OVAT ERI ASIOITA.
--
-- shifts.status on työntekijän vastaus vuoroon: odottaa, hyväksytty,
-- ei pääse. Julkaisu on työnantajan teko. Jos nämä pakattaisiin samaan
-- kenttään, "julkaistu" ja "hyväksytty" sulkisivat toisensa pois — ja
-- juuri niiden yhdistelmä on tavallisin tila.
--
-- Siksi julkaisu on oma akselinsa: published_at ja cancelled_at.
--
--   Luonnos      published_at is null
--   Julkaistu    published_at not null ja cancelled_at null
--   Peruttu      cancelled_at not null
--
-- Toteutunut ei ole vuoron tila lainkaan. Se lasketaan leimauksista,
-- ja jos se tallennettaisiin vuorolle, suunniteltu aika ja toteutunut
-- aika alkaisivat elää samassa kentässä.
--
-- HUOM: status = 'draft' tarkoittaa tässä kannassa jo ennestään
-- avointa vuoroa jolla ei ole tekijää. Sitä ei nimetä uudelleen tässä
-- migraatiossa — nimeäminen koskisi jokaista lukupaikkaa, eikä
-- kahden asian sekaannus korjaannu sillä että molempia siirretään.

-- ---------------------------------------------------------------------------
-- 1. Uudet kentät
-- ---------------------------------------------------------------------------

alter table shifts
  /*
   * Suunniteltu tauko minuutteina.
   *
   * Vähennetään suunnitellusta työajasta. Erillään alku- ja
   * loppuajasta, koska tauko ei ole vuoron reunoilla vaan sen
   * sisällä — 10–18 tauolla 30 min on yhä vuoro joka alkaa
   * kymmeneltä.
   */
  add column if not exists break_minutes integer not null default 0,

  /* Vapaa lisätieto vuorolle: "avaus", "tilaisuus salissa". */
  add column if not exists note text,

  add column if not exists created_by uuid references profiles (id),

  /* Milloin vuoro tuli työntekijän näkyviin. Null = luonnos. */
  add column if not exists published_at timestamptz,

  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references profiles (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shifts_break_sane'
  ) then
    alter table shifts add constraint shifts_break_sane
      check (break_minutes >= 0 and break_minutes < 24 * 60);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Vanhat vuorot ovat julkaistuja
-- ---------------------------------------------------------------------------
--
-- Tämä on migraation tärkein rivi.
--
-- Ennen tätä jokainen vuoro näkyi tekijälleen. Jos vanhat rivit
-- jäisivät luonnoksiksi, jokaisen työntekijän vuorot katoaisivat
-- näkyvistä samalla hetkellä kun tämä ajetaan — eikä kukaan tietäisi
-- miksi.

update shifts
set published_at = created_at
where published_at is null;

-- ---------------------------------------------------------------------------
-- 3. Muutoshistoria
-- ---------------------------------------------------------------------------
--
-- Työvuoro on sopimus. Kun se muuttuu julkaisun jälkeen, on voitava
-- jälkikäteen näyttää mitä sovittiin, mitä muutettiin ja milloin —
-- palkkakiistat ratkotaan juuri näillä tiedoilla.
--
-- Rivi kirjoitetaan aina, ei koskaan päivitetä.

create table if not exists shift_changes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,

  kind text not null check (
    kind in ('created', 'updated', 'published', 'cancelled')
  ),

  changed_at timestamptz not null default now(),
  changed_by uuid references profiles (id),

  /* Tilanne ennen muutosta. Luonnissa nämä ovat tyhjiä. */
  from_user_id uuid,
  from_date date,
  from_start time,
  from_end time,
  from_break integer,

  /* Tilanne muutoksen jälkeen. Peruutuksessa nämä ovat tyhjiä. */
  to_user_id uuid,
  to_date date,
  to_start time,
  to_end time,
  to_break integer
);

create index if not exists shift_changes_lookup
  on shift_changes (shift_id, changed_at desc);

alter table shift_changes enable row level security;

/*
 * Historia on esihenkilön työkalu.
 *
 * Työntekijä näkee oman vuoronsa nykytilan ja saa muutoksesta
 * ilmoituksen. Koko muutosketju kertoisi myös siitä kuka vuoroa
 * suunnitteli ja milloin — se on työnjohdon tietoa.
 */
drop policy if exists shift_changes_read on shift_changes;
create policy shift_changes_read on shift_changes
  for select to authenticated
  using (is_manager(restaurant_id));

-- Kirjoitus tapahtuu vain funktioiden kautta, jotka ovat definereitä.
drop policy if exists shift_changes_write on shift_changes;
create policy shift_changes_write on shift_changes
  for all to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 4. Luonnos ei näy työntekijälle
-- ---------------------------------------------------------------------------
--
-- Lukusääntö oli: oma vuoro näkyy aina. Julkaisu ei tarkoittaisi
-- mitään, jos luonnos näkyisi silti.
--
-- Peruttu vuoro näkyy edelleen. Työntekijän on saatava tietää että
-- vuoro peruttiin; hiljaa katoava vuoro on pahempi kuin peruttu.
-- Näkymä kertoo peruutuksen, ei tämä sääntö.

drop policy if exists shifts_read on shifts;
create policy shifts_read on shifts
  for select to authenticated
  using (
    is_manager(restaurant_id)
    or (
      restaurant_id in (select my_restaurant_ids())
      and user_id = auth.uid()
      and published_at is not null
    )
    or (
      restaurant_id in (select my_restaurant_ids())
      and user_id is null
      and published_at is not null
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Vuoron tallennus
-- ---------------------------------------------------------------------------
--
-- Sama funktio luo ja päivittää. Uusi vuoro syntyy luonnoksena:
-- kuukauden suunnittelu on keskeneräistä siihen asti kun se
-- julkaistaan, eikä keskeneräinen suunnitelma kuulu työntekijän
-- kalenteriin.
--
-- Julkaistun vuoron muutos säilyttää julkaisun. Vuoro on jo nähty, ja
-- sen palauttaminen luonnokseksi tarkoittaisi että se katoaisi
-- työntekijältä ilmoituksetta.

drop function if exists upsert_shift(uuid, uuid, uuid, date, time, time, text, staff_position);

create or replace function upsert_shift(
  p_restaurant uuid,
  p_shift uuid,
  p_user uuid,
  p_date date,
  p_start time,
  p_end time,
  p_location text default '',
  p_position staff_position default null,
  p_break integer default 0,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_old shifts;
  v_break integer := greatest(coalesce(p_break, 0), 0);
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi hallita työvuoroja';
  end if;

  if p_shift is null then
    insert into shifts (
      restaurant_id, user_id, position, shift_date, start_time, end_time,
      location, status, break_minutes, note, created_by
    )
    values (
      p_restaurant, p_user, p_position, p_date, p_start, p_end,
      coalesce(p_location, ''),
      case when p_user is null then 'draft'::shift_status else 'accepted'::shift_status end,
      v_break,
      nullif(trim(coalesce(p_note, '')), ''),
      auth.uid()
    )
    returning id into v_id;

    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      to_user_id, to_date, to_start, to_end, to_break
    )
    values (v_id, p_restaurant, 'created', auth.uid(), p_user, p_date, p_start, p_end, v_break);

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
      break_minutes = v_break,
      note = nullif(trim(coalesce(p_note, '')), ''),
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
        when v_old.user_id is distinct from p_user then 'accepted'::shift_status
        else v_old.status
      end
  where id = p_shift;

  /*
   * Historiarivi vain kun jokin oikeasti muuttui.
   *
   * Lomakkeen tallennus ilman muutoksia on tavallista: avataan,
   * katsotaan, tallennetaan. Tyhjä muutosrivi tekisi historiasta
   * lokin josta ei löydä sitä muutosta jota etsitään.
   */
  if v_old.user_id is distinct from p_user
     or v_old.shift_date is distinct from p_date
     or v_old.start_time is distinct from p_start
     or v_old.end_time is distinct from p_end
     or v_old.break_minutes is distinct from v_break
  then
    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      from_user_id, from_date, from_start, from_end, from_break,
      to_user_id, to_date, to_start, to_end, to_break
    )
    values (
      p_shift, v_old.restaurant_id, 'updated', auth.uid(),
      v_old.user_id, v_old.shift_date, v_old.start_time, v_old.end_time, v_old.break_minutes,
      p_user, p_date, p_start, p_end, v_break
    );
  end if;

  return p_shift;
end;
$$;

revoke all on function upsert_shift from public;
grant execute on function upsert_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Julkaisu
-- ---------------------------------------------------------------------------
--
-- Julkaistaan aikaväli kerralla: kuukausi suunnitellaan kokonaisuutena
-- ja se myös luvataan kokonaisuutena. Vuoro kerrallaan julkaiseminen
-- jättäisi työntekijälle puolikkaan kuukauden, eikä hän tietäisi onko
-- loppu tulossa vai ei.
--
-- Jo julkaistuja ei kosketa: julkaisuhetki on se hetki jolloin vuoro
-- ensimmäisen kerran luvattiin.

create or replace function publish_shifts(
  p_restaurant uuid,
  p_from date,
  p_to date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi julkaista työvuoroja';
  end if;

  with julkaistut as (
    update shifts
    set published_at = now()
    where restaurant_id = p_restaurant
      and shift_date between p_from and p_to
      and published_at is null
      and cancelled_at is null
    returning id, restaurant_id, user_id, shift_date, start_time, end_time, break_minutes
  ),
  kirjatut as (
    insert into shift_changes (
      shift_id, restaurant_id, kind, changed_by,
      to_user_id, to_date, to_start, to_end, to_break
    )
    select id, restaurant_id, 'published', auth.uid(),
           user_id, shift_date, start_time, end_time, break_minutes
    from julkaistut
    returning 1
  )
  select count(*) into v_count from kirjatut;

  return v_count;
end;
$$;

revoke all on function publish_shifts from public;
grant execute on function publish_shifts to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Peruutus
-- ---------------------------------------------------------------------------
--
-- Julkaistua vuoroa ei poisteta vaan perutaan. Poistettu rivi veisi
-- mukanaan tiedon siitä että vuoro oli olemassa, ja juuri se tieto
-- tarvitaan kun kysytään miksi joku ei ollut töissä.
--
-- Luonnoksen saa poistaa: sitä ei ole luvattu kenellekään.

create or replace function cancel_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then
    raise exception 'Vuoroa ei löytynyt';
  end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi perua työvuoroja';
  end if;

  if v_shift.cancelled_at is not null then
    return;
  end if;

  update shifts
  set cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = p_shift;

  insert into shift_changes (
    shift_id, restaurant_id, kind, changed_by,
    from_user_id, from_date, from_start, from_end, from_break
  )
  values (
    p_shift, v_shift.restaurant_id, 'cancelled', auth.uid(),
    v_shift.user_id, v_shift.shift_date, v_shift.start_time, v_shift.end_time,
    v_shift.break_minutes
  );
end;
$$;

revoke all on function cancel_shift from public;
grant execute on function cancel_shift to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Poisto vain luonnoksesta
-- ---------------------------------------------------------------------------
--
-- Julkaistu vuoro on jo nähty. Sen katoaminen jäljettömiin on juuri se
-- mitä työvuorolistalta ei saa tapahtua, joten poiston tilalle tulee
-- peruutus — ja funktio sanoo sen ääneen sen sijaan että tekisi
-- jommankumman käyttäjän puolesta.

create or replace function delete_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  select * into v_shift from shifts where id = p_shift;
  if v_shift.id is null then return; end if;

  if not is_manager(v_shift.restaurant_id) then
    raise exception 'Vain esihenkilö voi poistaa työvuoroja';
  end if;

  if v_shift.shift_date < current_date then
    raise exception 'Mennyttä vuoroa ei voi poistaa';
  end if;

  if v_shift.published_at is not null then
    raise exception 'Julkaistua vuoroa ei voi poistaa. Peru se, niin työntekijä saa tiedon.';
  end if;

  delete from shifts where id = p_shift;
end;
$$;

revoke all on function delete_shift from public;
grant execute on function delete_shift to authenticated;
