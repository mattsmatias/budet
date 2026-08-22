-- ---------------------------------------------------------------------------
-- 0009 — Kutsukoodien tiiviste ilman pgcryptoa
-- ---------------------------------------------------------------------------
--
-- VIKA: kutsun luonti kaatui virheeseen
--   "function digest(text, unknown) does not exist"
--
-- Syy: Supabase asentaa pgcrypton skeemaan `extensions`, ei `public`:iin.
-- Nämä funktiot ovat `security definer` ja `set search_path = public`,
-- joten `digest` ei näkynyt niille lainkaan. Migraation
-- `create extension if not exists pgcrypto` oli tyhjä käsky: laajennus
-- oli jo asennettuna, vain eri skeemaan.
--
-- KORJAUS: pgcryptoa ei tarvita. `sha256(bytea)` on ollut Postgresin
-- sisäänrakennettu funktio versiosta 11 ja löytyy pg_catalogista, joka
-- on aina hakupolussa.
--
-- Vaihtoehto olisi ollut lisätä `extensions` hakupolkuun, mutta
-- `set search_path = public` on nimenomaan se suojaus joka estää
-- security definer -funktiota poimimasta funktioita väärästä paikasta.
-- Sen löysentäminen kiertäisi suojauksen; sisäänrakennettu funktio
-- poistaa koko ongelman.
--
-- Tiivistemuoto muuttuu, joten vanhat koodit eivät enää täsmäisi.
-- Tarkistettu ennen ajoa: lunastamattomia kutsuja on nolla.

-- ---------------------------------------------------------------------------
-- Kutsun luonti
-- ---------------------------------------------------------------------------

create or replace function create_invitation(
  p_restaurant uuid,
  p_role app_role default 'employee',
  p_position staff_position default null,
  p_hourly_rate_cents int default null,
  p_label text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := '';
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i int;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi kutsua käyttäjiä';
  end if;

  -- Satunnaisuus gen_random_uuid():sta eikä random():sta.
  --
  -- random() on siemennetty pseudosatunnaisgeneraattori, jonka tilan voi
  -- periaatteessa päätellä aiemmista arvoista. Kutsukoodi antaa pääsyn
  -- ravintolan tietoihin, joten arvattavuus on turvakysymys.
  -- gen_random_uuid() käyttää vahvaa satunnaislähdettä ja on
  -- pg_catalogissa, joten se ei vaadi laajennusta.
  v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');

  -- Aakkostosta on jätetty pois I, O, 0 ja 1: ne sekoittuvat puhelimessa
  -- luettuna ja koodi kirjoitetaan käsin. 32 merkkiä jakaa 256 tasan,
  -- joten jakojäännös ei vinouta jakaumaa.
  for i in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(v_bytes, i - 1) % length(v_alphabet)),
      1
    );
  end loop;

  insert into restaurant_invitations (
    restaurant_id, code_hash, code_hint, role, position,
    hourly_rate_cents, label, created_by
  )
  values (
    p_restaurant,
    encode(sha256(v_code::bytea), 'hex'),
    right(v_code, 4),
    p_role,
    p_position,
    p_hourly_rate_cents,
    nullif(trim(p_label), ''),
    auth.uid()
  );

  return v_code;
end;
$$;

revoke all on function create_invitation from public;
grant execute on function create_invitation to authenticated;

-- ---------------------------------------------------------------------------
-- Kutsun lunastus ja esikatselu
-- ---------------------------------------------------------------------------
--
-- Rungot ovat 0004:sta ja 0005:sta sellaisenaan; vain tiiviste on
-- vaihdettu. Erityisesti preview_invitationin yhtenäinen virheilmoitus
-- säilyy — eri viestit kertoisivat arvailijalle onko koodi olemassa
-- mutta jo käytetty.

create or replace function accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inv restaurant_invitations;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from restaurant_invitations
  where code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex');

  if v_inv.id is null then
    raise exception 'Koodia ei löytynyt';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Koodi on jo käytetty';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Koodi on vanhentunut';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  -- Sama kaava kuin budjeteissa: päivitä, lisää jos ei ollut. Jäsenyys voi
  -- olla olemassa passivoituna, jolloin kutsu herättää sen uudelleen.
  update memberships
  set active = true,
      role = v_inv.role,
      position = v_inv.position,
      hourly_rate_cents = coalesce(v_inv.hourly_rate_cents, hourly_rate_cents)
  where restaurant_id = v_inv.restaurant_id and user_id = v_user;

  if not found then
    insert into memberships (
      restaurant_id, user_id, role, position, hourly_rate_cents
    )
    values (
      v_inv.restaurant_id, v_user, v_inv.role, v_inv.position,
      v_inv.hourly_rate_cents
    );
  end if;

  update restaurant_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.restaurant_id;
end;
$$;

revoke all on function accept_invitation from public;
grant execute on function accept_invitation to authenticated;

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
  where code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex');

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
