-- ---------------------------------------------------------------------------
-- 0114 — Kuvan polku istunnon näkymään
-- ---------------------------------------------------------------------------
--
-- Kuori piirtää yrityksen tunnuksen joka sivulla. Ilman tätä se
-- vaatisi oman kyselynsä ja allekirjoituksen jokaisella sivunpiirrolla
-- — kaksi verkkokutsua lisää siihen että laatalla näkyy kuva.
--
-- Näkymässä on polku eikä kuva. Tiedosto haetaan erikseen ja vain
-- silloin kun polku on olemassa, joten tyhjä laatta ei maksa mitään.

create or replace view my_restaurants
with (security_invoker = true)
as
select r.id,
       r.name,
       r.timezone,
       r.currency,
       m.role,
       r.slug,
       r.business_type,
       r.logo_path
from restaurants r
join memberships m on m.restaurant_id = r.id
where m.user_id = auth.uid() and m.active;

grant select on my_restaurants to authenticated;
