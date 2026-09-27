-- 0127 Tyontekijan ilmoittama yhteydenotto
--
-- SAMA TAULU KUIN ETUSIVUN LOMAKKEELLA.
--
-- Myyntitapaamisesta tuleva liidi on sama asia kuin etusivun
-- lomakkeelta tuleva: yritys joka haluaa Katen. Oma taulu tarkoittaisi
-- kahta listaa joita pitaa katsoa erikseen, ja toinen niista jaisi
-- katsomatta. Taulussa on nyt yksi kentta lisaa: kuka sen toi.
--
-- NIMI TALLENNETAAN, EI VAIN VIITE.
--
-- referred_by kertoo kenen tunnus ilmoituksen teki. Jos se tunnus
-- joskus poistetaan, viite katoaa mutta tieto ei saa kadota: liidin
-- historia on myynnin historiaa. Siksi nimi otetaan talteen myos
-- tekstina sellaisena kuin se oli ilmoitushetkella.

alter table contact_requests
  add column if not exists referred_by uuid references auth.users (id) on delete set null,
  add column if not exists referred_name text;

comment on column contact_requests.referred_by is
  'Katen tyontekija joka toi liidin, tai null kun se tuli etusivulta.';
comment on column contact_requests.referred_name is
  'Ilmoittajan nimi ilmoitushetkella. Sailyy vaikka tunnus poistetaan.';

create index if not exists contact_requests_referred_by_idx
  on contact_requests (referred_by);

-- ---------------------------------------------------------------------
-- Ilmoituksen jattaminen
-- ---------------------------------------------------------------------

-- KUKA SAA ILMOITTAA.
--
-- Vain Katen oma tyontekija tai jarjestelman yllapitaja. Etusivun
-- lomake kulkee edelleen omaa reittiaan (submit_contact_request), jota
-- ei muuteta: se on kirjautumattoman polku ja sen rajoitukset on
-- mitoitettu sen mukaan.
--
-- KAKSOISLAHETYS, EI VASYTYSHYOKKAYS.
--
-- Tassa ei ole etusivun kolmen vuorokausirajaa. Kirjautunut
-- tyontekija ei ole tuntematon, ja messuilla voi tulla kymmenen
-- liidia peräkkäin. Torjuttava tapaus on toinen: sama yritys kahdesti
-- kun lomake lahetettiin vahingossa uudelleen.
create or replace function submit_referral(
  p_restaurant text,
  p_name text,
  p_email text,
  p_phone text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nimi text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if not exists (select 1 from kate_staff where user_id = v_user)
     and not current_user_is_super_admin() then
    raise exception 'Vain Katen tyontekija voi ilmoittaa yrityksen';
  end if;

  if coalesce(trim(p_restaurant), '') = ''
     or coalesce(trim(p_name), '') = ''
     or v_email = '' then
    raise exception 'required';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'email';
  end if;

  if exists (
    select 1 from contact_requests
    where referred_by = v_user
      and lower(email) = v_email
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate';
  end if;

  select coalesce(p.full_name, ks.label, u.email)
  into v_nimi
  from auth.users u
  left join profiles p on p.id = u.id
  left join kate_staff ks on ks.user_id = u.id
  where u.id = v_user;

  insert into contact_requests (
    name, restaurant, email, phone, message, locale,
    referred_by, referred_name
  )
  values (
    left(trim(p_name), 120),
    left(trim(p_restaurant), 160),
    v_email,
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    nullif(left(trim(coalesce(p_message, '')), 2000), ''),
    'fi',
    v_user,
    left(coalesce(v_nimi, 'Kate'), 120)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Omat ilmoitukset.
--
-- Ilman tata lomake nielaisisi tiedot eika tyontekija naa niista enaa
-- mitaan: han ei tietaisi meniko ilmoitus perille eika onko se otettu
-- tyon alle. Lista on hanen omansa — toisten liidit eivat kuulu
-- hanelle.
create or replace function my_referrals()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'restaurant', c.restaurant,
      'name', c.name,
      'email', c.email,
      'createdAt', c.created_at,
      'handledAt', c.handled_at
    ) order by c.created_at desc)
    from contact_requests c
    where c.referred_by = v_user
  ), '[]'::jsonb);
end;
$$;

-- Konsolin lista: ilmoittaja mukaan.
create or replace function sa_contact_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'restaurant', c.restaurant,
      'email', c.email,
      'phone', c.phone,
      'message', c.message,
      'locale', c.locale,
      'createdAt', c.created_at,
      'handledAt', c.handled_at,
      'referredName', c.referred_name
    ) order by (c.handled_at is not null), c.created_at desc)
    from contact_requests c
  ), '[]'::jsonb);
end;
$$;

-- Oikeudet: seka PUBLIC etta anon nimetaan, koska Supabasen
-- oletusoikeudet antavat uudelle funktiolle EXECUTEn suoraan anonille.
revoke all on function submit_referral(text, text, text, text, text) from public, anon;
grant execute on function submit_referral(text, text, text, text, text) to authenticated;

revoke all on function my_referrals() from public, anon;
grant execute on function my_referrals() to authenticated;

revoke all on function sa_contact_requests() from public, anon;
grant execute on function sa_contact_requests() to authenticated;
