-- RestoFlow — kutsukoodin tarkistus ennen lunastusta.
--
-- Erillinen funktio, jotta käyttöliittymä voi kertoa mihin ravintolaan
-- koodi vie ennen kuin käyttäjä hyväksyy liittymisen. Ilman tätä
-- lunastus olisi sokea klikkaus.

-- Sarakkeiden nimissä ei käytetä sanoja "position" eikä "role":
-- position on Postgresin varattu funktio, ja role on varattu avainsana.
-- Kumpikaan ei kelpaa returns table -lauseessa ilman lainausmerkkejä.
create or replace function preview_invitation(p_code text)
returns table (
  restaurant_name text,
  invited_role app_role,
  invited_position staff_position
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv restaurant_invitations;
begin
  if auth.uid() is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex');

  -- Sama viesti kaikissa epäonnistumisissa: eri viestit kertoisivat
  -- arvailijalle onko koodi olemassa mutta käytetty.
  if v_inv.id is null
     or v_inv.accepted_at is not null
     or v_inv.expires_at < now() then
    raise exception 'Koodi ei kelpaa';
  end if;

  return query
  select r.name, v_inv.role, v_inv.position
  from restaurants r
  where r.id = v_inv.restaurant_id;
end;
$$;

revoke all on function preview_invitation from public;
grant execute on function preview_invitation to authenticated;
