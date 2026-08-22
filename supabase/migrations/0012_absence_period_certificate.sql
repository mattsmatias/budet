-- ---------------------------------------------------------------------------
-- 0012 — Poissaolon jakso ja todistusmerkintä
-- ---------------------------------------------------------------------------
--
-- Kaksi puutetta samassa taulussa.
--
-- 1. Poissaolossa oli vain yksi päivä. Sairauslomatodistus kattaa
--    jakson — esimerkiksi 26.8.–29.8. — eikä sitä voinut ilmaista.
--    Neljä erillistä ilmoitusta samasta sairaudesta on väärä kuva
--    tapahtuneesta ja neljä riviä esihenkilön listalla.
--
-- 2. Ei mitään tapaa kertoa onko todistus toimitettu.
--
-- Todistuksesta tallennetaan vain merkintä, ei kuvaa. Lääkärintodistus
-- on terveystieto, ja siinä lukee usein diagnoosi. Työnantajalle kuuluu
-- tieto poissaolosta ja sen kestosta, ei siitä mikä ihmisellä on.
-- Budet tallentaa siis sen mitä palkanmaksuun tarvitaan — kuka, milloin,
-- mille ajalle, onko todistus nähty — eikä muuta.

-- ---------------------------------------------------------------------------
-- 1. Jakso
-- ---------------------------------------------------------------------------
--
-- Nykyiset rivit ovat yhden päivän mittaisia, joten loppupäivä on sama
-- kuin alkupäivä. Täytetään ensin ja vasta sitten pakotetaan not null:
-- toisin päin olemassa oleva aineisto estäisi migraation.

alter table absences add column if not exists end_date date;

update absences set end_date = absence_date where end_date is null;

alter table absences alter column end_date set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'absences_period_valid'
  ) then
    alter table absences
      add constraint absences_period_valid check (end_date >= absence_date);
  end if;
end;
$$;

-- Haut kysyvät "ketkä ovat poissa tästä päivästä eteenpäin", ja se
-- osuu nyt loppupäivään: eilen alkanut sairausloma on yhä voimassa.
create index if not exists absences_restaurant_end_idx
  on absences (restaurant_id, end_date);

-- ---------------------------------------------------------------------------
-- 2. Todistusmerkintä
-- ---------------------------------------------------------------------------

alter table absences add column if not exists certificate_seen_at timestamptz;
alter table absences add column if not exists certificate_seen_by uuid
  references profiles (id) on delete set null;

/**
 * Merkitsee todistuksen nähdyksi tai poistaa merkinnän.
 *
 * Oma funktio eikä päivitysoikeutta tauluun. Esihenkilö saa kuitata
 * todistuksen, mutta hän ei saa muuttaa työntekijän omaa ilmoitusta —
 * ei päivämääriä eikä lisätietoa. Update-käytäntö sallisi molemmat,
 * koska with check näkee vain uuden rivin eikä voi verrata vanhaan.
 *
 * Kuka merkitsi ja milloin jää talteen. Ilman sitä merkintä on väite
 * jonka takana ei ole ketään.
 */
create or replace function mark_absence_certificate(
  p_absence uuid,
  p_seen boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_absence absences;
begin
  select * into v_absence from absences where id = p_absence;
  if v_absence.id is null then
    raise exception 'Ilmoitusta ei löytynyt';
  end if;

  if not is_manager(v_absence.restaurant_id) then
    raise exception 'Vain esihenkilö voi kuitata todistuksen';
  end if;

  update absences
  set certificate_seen_at = case when p_seen then now() else null end,
      certificate_seen_by = case when p_seen then auth.uid() else null end
  where id = p_absence;
end;
$$;

revoke all on function mark_absence_certificate from public;
grant execute on function mark_absence_certificate to authenticated;
