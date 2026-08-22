-- ---------------------------------------------------------------------------
-- 0019 — Slug jäsenyysnäkymään
-- ---------------------------------------------------------------------------
--
-- Julkisen lounassivun osoite rakennetaan slugista. Ilman tätä se
-- vaatisi oman kyselyn joka sivunlatauksella, vaikka jäsenyys haetaan
-- joka tapauksessa.
--
-- Sarake lisätään loppuun. create or replace view ei salli sarakkeiden
-- järjestyksen muuttamista, ja näkymän pudottaminen veisi mukanaan
-- oikeudet.
--
-- security_invoker = true säilyy: näkymä ei saa ohittaa RLS:ää.

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
  r.slug
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;
