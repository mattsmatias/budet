-- ---------------------------------------------------------------------------
-- 0024 — Julkisen lounassivun teema
-- ---------------------------------------------------------------------------
--
-- Ravintolan valinta, ei viikon. Teema päätetään kerran eikä joka
-- maanantai, joten se on restaurants-taulussa eikä lounasviikossa.
--
-- Tarkistus rajaa arvot kolmeen. Vapaa teksti tarkoittaisi että
-- julkinen sivu voi saada tuntemattoman teeman ja joutuu arvaamaan
-- mitä tehdä — ja arvaus on siinä kohdassa valkoinen sivu.

alter table restaurants add column if not exists lunch_theme text not null
  default 'light';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_lunch_theme_valid'
  ) then
    alter table restaurants add constraint restaurants_lunch_theme_valid
      check (lunch_theme in ('light', 'dark', 'classic'));
  end if;
end;
$$;

/** Asettaa julkisen lounassivun teeman. */
create or replace function set_lunch_theme(p_restaurant uuid, p_theme text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi vaihtaa teemaa';
  end if;

  if p_theme not in ('light', 'dark', 'classic') then
    raise exception 'Tuntematon teema';
  end if;

  update restaurants
  set lunch_theme = p_theme, updated_at = now()
  where id = p_restaurant;
end;
$$;

revoke all on function set_lunch_theme from public;
grant execute on function set_lunch_theme to authenticated;

-- Näkymään mukaan, jotta hallintasivu tietää valitun teeman ilman
-- omaa kyselyä. Sarake loppuun: create or replace view ei salli
-- järjestyksen muuttamista.
create or replace view my_restaurants
with (security_invoker = true)
as
select
  r.id,
  r.name,
  r.timezone,
  r.currency,
  m.role,
  m.position,
  m.hourly_rate_cents,
  r.slug,
  r.lunch_theme
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;
