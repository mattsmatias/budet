-- ---------------------------------------------------------------------------
-- 0032 — Kutsukoodi ennen tunnusta
-- ---------------------------------------------------------------------------
--
-- Kutsuttu työntekijä joutui ensin luomaan tunnuksen ja vasta sitten
-- syöttämään koodin. Järjestys oli väärin päin: hän ei tiedä mihin on
-- liittymässä ennen kuin on jo antanut sähköpostinsa ja salasanansa, ja
-- väärällä koodilla koko tunnus jäi roikkumaan tyhjään.
--
-- Koodi kysytään nyt ensin. Sitä varten tarvitaan tapa tarkistaa koodi
-- ilman kirjautumista.
--
-- MITÄ FUNKTIO PALJASTAA
--
-- Vain sen mitä kutsuttu tarvitsee nähdäkseen liittyvänsä oikeaan
-- paikkaan: ravintolan nimi ja tuleva tehtävä. Ei tuntipalkkaa, ei
-- kutsujan nimeä, ei muita jäseniä.
--
-- Väärä koodi palauttaa tyhjän. Ei virhettä eikä vihjettä siitä oliko
-- koodi olemassa mutta käytetty vai olematon — molemmista saa saman
-- vastauksen, jottei funktiolla voi kartoittaa koodeja.
--
-- Koodi itse on ainoa salaisuus, ja se on tallessa vain tiivisteenä.
-- Sama pinta on ollut olemassa accept_invitationissa alusta asti; tämä
-- ei avaa uutta reittiä vaan saman reitin lukevan version.

drop function if exists preview_invitation(text);

create function preview_invitation(p_code text)
returns table (
  restaurant_name text,
  role app_role,
  "position" staff_position
)
language sql
stable
security definer
set search_path = public
as $$
  select r.name, i.role, i.position
  from restaurant_invitations i
  join restaurants r on r.id = i.restaurant_id
  where i.code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex')
    and i.accepted_at is null
    and i.expires_at >= now();
$$;

revoke all on function preview_invitation(text) from public;
grant execute on function preview_invitation(text) to anon;
grant execute on function preview_invitation(text) to authenticated;
