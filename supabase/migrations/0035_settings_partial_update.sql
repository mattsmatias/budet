-- ---------------------------------------------------------------------------
-- Asetukset: osittainen päivitys ja leimausikkuna säädettäväksi
-- ---------------------------------------------------------------------------
--
-- 1. OSITTAINEN PÄIVITYS
--
-- Asetussivu jakautuu osioihin, ja jokainen osio on oma lomakkeensa.
-- Vanha funktio kirjoitti aina kaikki kentät, joten "Ravintolan nimi"
-- -lomake olisi tyhjentänyt aikavyöhykkeen ja nollannut
-- vuoroasetukset — kenttä jota lomake ei näytä ei saa muuttua sen
-- lähettämisestä.
--
-- Null tarkoittaa nyt "älä koske". Jokainen parametri on
-- oletusarvoltaan null, joten kutsuja lähettää vain sen mitä muuttaa.
--
-- 2. LEIMAUSIKKUNA
--
-- clock_in_early_minutes on ollut kannassa migraatiosta 0029 asti ja
-- record_clock_event lukee sitä, mutta sitä ei ole voinut muuttaa
-- mistään. Oletus 30 minuuttia on ollut siis lukittu arvo eikä
-- asetus. Nyt se on asetus.
--
-- Uusi parametri vaatii pudotuksen: lisätty parametri ei korvaa vanhaa
-- funktiota vaan luo ylikuormituksen, ja nimetty kutsu jäisi
-- monitulkintaiseksi.

drop function if exists update_restaurant(uuid, text, text, boolean);

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null,
  p_open_shift_claiming boolean default null,
  p_clock_in_early_minutes smallint default null
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

  -- Nimi saa puuttua (toinen lomake), muttei olla tyhjä.
  if p_name is not null and trim(p_name) = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if p_timezone is not null
     and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  -- Sama raja kuin sarakkeen check-ehdossa. Tarkistus on tässäkin,
  -- jotta virhe on luettava lause eikä rajoitteen nimi.
  if p_clock_in_early_minutes is not null
     and (p_clock_in_early_minutes < 0 or p_clock_in_early_minutes > 240) then
    raise exception 'Leimausikkuna on 0–240 minuuttia';
  end if;

  update restaurants
  set name = coalesce(trim(p_name), name),
      timezone = coalesce(p_timezone, timezone),
      open_shift_claiming = coalesce(p_open_shift_claiming, open_shift_claiming),
      clock_in_early_minutes =
        coalesce(p_clock_in_early_minutes, clock_in_early_minutes),
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function update_restaurant from public;
grant execute on function update_restaurant to authenticated;
