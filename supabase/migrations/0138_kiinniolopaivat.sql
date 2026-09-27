-- Kiinniolopäivät.
--
-- KIINNI OLLUT PÄIVÄ EI OLE UNOHTUNUT MERKINTÄ.
--
-- Kate on tähän asti pitänyt jokaista menneen kuukauden päivää
-- päivänä jolta myynti kuuluu löytyä. Sunnuntaisin suljettu kahvila
-- sai siitä neljä varoitusta kuukaudessa, joka kuukausi, eikä niille
-- voinut tehdä mitään — ja varoitus jota ei voi kuitata opettaa
-- sivuuttamaan myös ne varoitukset jotka tarkoittavat jotain.
--
-- Koodissa oli jo tämän olettava kommentti (missingSalesDays:
-- "ravintola on voinut olla kiinni"), mutta kutsuja antoi sille aina
-- kaikki kuukauden päivät. Asetusta ei ollut olemassa.
--
-- ISO-NUMEROINTI, EI NOLLAPOHJAINEN.
--
-- 1 = maanantai ... 7 = sunnuntai, sama kuin extract(isodow) ja sama
-- kuin lib/restoflow/sales.ts:n weekdayOf. Javascriptin getDay() on
-- eri asia, eikä sitä käytetä kummassakaan päässä.

alter table restaurants
  add column if not exists closed_weekdays smallint[] not null default '{}';

alter table restaurants
  drop constraint if exists restaurants_closed_weekdays_check;

alter table restaurants
  add constraint restaurants_closed_weekdays_check check (
    -- Kelvolliset numerot eikä koko viikkoa kiinni: seitsemän
    -- kiinniolopäivää tarkoittaisi ettei yritystä ole. Toistot karsii
    -- update_restaurant, koska alikysely ei ole sallittu tarkisteessa
    -- eikä tauluun kirjoiteta muualta.
    closed_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
    and array_length(closed_weekdays, 1) is distinct from 7
  );

comment on column restaurants.closed_weekdays is
  'Viikonpäivät jolloin yritys on kiinni. 1 = maanantai ... 7 = sunnuntai.';

-- Näkymä kantaa asetuksen istuntoon asti.
create or replace view my_restaurants as
  select r.id,
         r.name,
         r.timezone,
         r.currency,
         m.role,
         r.slug,
         r.business_type,
         r.logo_path,
         r.status,
         r.trial_ends_on,
         r.closed_weekdays
    from restaurants r
    join memberships m on m.restaurant_id = r.id
   where m.user_id = (select auth.uid()) and m.active;

-- Asetus tallennetaan samalla funktiolla kuin nimi ja aikavyöhyke.
create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null,
  p_closed_weekdays smallint[] default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
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

  /*
   * Tyhjä taulukko on eri asia kuin puuttuva.
   *
   * null tarkoittaa "älä koske" — lomake joka ei lähetä kenttää ei saa
   * tyhjentää sitä. Tyhjä taulukko tarkoittaa "auki joka päivä", ja se
   * on oikea tapa poistaa kaikki kiinniolopäivät.
   */
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
      updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke execute on function update_restaurant(uuid, text, text, smallint[]) from public, anon;
grant execute on function update_restaurant(uuid, text, text, smallint[]) to authenticated;

-- Vanha kolmen parametrin versio pois, jotta kutsu ei voi vahingossa
-- osua siihen ja jättää kiinniolopäiviä tallentamatta.
drop function if exists update_restaurant(uuid, text, text);
