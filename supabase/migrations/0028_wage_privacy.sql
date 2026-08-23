-- ---------------------------------------------------------------------------
-- 0028 — Tuntipalkka ei vuoda rajapinnasta
-- ---------------------------------------------------------------------------
--
-- Käyttöliittymä on piilottanut tuntipalkat muilta kuin esihenkilöiltä
-- alusta asti: `staff.rates.view` puuttuu työntekijältä ja
-- kirjanpitäjältä. Kanta ei kuitenkaan tiennyt siitä mitään.
--
-- memberships_read-käytäntö sallii jokaisen jäsenen lukea oman
-- ravintolansa jäsenrivit, ja PostgREST tarjoilee ne sellaisenaan:
--
--   GET /rest/v1/memberships?select=user_id,hourly_rate_cents
--
-- Kuka tahansa työntekijä sai näin koko henkilöstön palkat. Piilottaminen
-- näkymässä ei ole suojaus vaan sopimus siitä ettei kukaan katso.
--
-- RIVITASO EI RIITÄ TÄHÄN
--
-- Ilmeisin korjaus olisi rajata käytäntö omaan riviin. Se rikkoisi
-- kaksi asiaa: työkaverien nimet ja tehtävät luetaan samalta riviltä, ja
-- kirjanpitäjä tarvitsee nimet raportteihin. Ongelma ei ole rivi vaan
-- sarake, joten suojaus tehdään sarakkeeseen.

-- ---------------------------------------------------------------------------
-- 1. Sarakeoikeudet
-- ---------------------------------------------------------------------------
--
-- Taulutason lupa poistetaan ja annetaan takaisin sarake kerrallaan.
-- Palkkasarakkeet jäävät listan ulkopuolelle, jolloin PostgREST vastaa
-- niitä pyytävään kyselyyn virheellä eikä datalla.
--
-- Rivitason käytäntö jää voimaan sellaisenaan: jäsen näkee edelleen
-- oman ravintolansa rivit, nyt vain ilman palkkaa.

revoke select on memberships from authenticated;
revoke select on memberships from anon;

grant select (
  id,
  restaurant_id,
  user_id,
  role,
  position,
  active,
  pay_type,
  created_at,
  updated_at
) on memberships to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Oma palkka näkyy edelleen
-- ---------------------------------------------------------------------------
--
-- my_restaurants palauttaa kirjautuneen käyttäjän omat jäsenyydet ja
-- niiden mukana oman tuntipalkan. Näkymä suodattaa jo itse
-- `m.user_id = auth.uid()`, joten se ei voi palauttaa muiden rivejä.
--
-- security_invoker pois: kutsujalla ei ole enää sarakeoikeutta, ja
-- näkymä kaatuisi. Määrittelijän oikeuksin ajettuna näkymän oma
-- where-ehto on ainoa portti — ja se on tiukempi kuin rivikäytäntö.

alter view my_restaurants set (security_invoker = false);

-- ---------------------------------------------------------------------------
-- 3. Esihenkilön pääsy palkkoihin
-- ---------------------------------------------------------------------------
--
-- Sovellus tarvitsee koko henkilöstön palkat kahteen asiaan:
-- palkkalaskentaan ja työvoimakustannuksen arvioon. Molemmat ovat
-- esihenkilön näkymiä.
--
-- Funktio palauttaa tyhjän jos kutsuja ei ole omistaja tai
-- vuoropäällikkö. Ei virhettä vaan tyhjä: kutsuva koodi käsittelee jo
-- puuttuvan palkan (`hourlyRateCents: number | null`), ja kirjanpitäjän
-- raportti jättää palkkasarakkeen pois omalla ehdollaan.

create or replace function staff_pay_rates(p_restaurant uuid)
returns table (
  user_id uuid,
  hourly_rate_cents int,
  monthly_salary_cents int,
  pay_type pay_type
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.hourly_rate_cents, m.monthly_salary_cents, m.pay_type
  from memberships m
  where m.restaurant_id = p_restaurant
    and m.active
    and is_manager(p_restaurant);
$$;

revoke all on function staff_pay_rates(uuid) from public;
grant execute on function staff_pay_rates(uuid) to authenticated;
