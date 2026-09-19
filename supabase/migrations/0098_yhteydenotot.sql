-- Yhteydenottopyynnöt etusivulta.
--
-- Kate ei enää tarjoa itserekisteröitymistä: tunnukset luodaan
-- Developer Consolesta. Ravintola jättää yhteydenottopyynnön, ja se
-- näkyy konsolissa ylläpitäjälle.
--
-- TURVA
--
-- Taulu on RLS:n takana ilman yhtään politiikkaa: kukaan ei lue eikä
-- kirjoita sitä suoraan. Kirjoitus kulkee submit_contact_request-
-- funktion kautta, joka validoi kentät ja rajoittaa määrän. Luku ja
-- käsittely vain sa_-funktioilla, jotka tarkistavat ylläpitäjän itse.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  restaurant text not null check (char_length(restaurant) between 1 and 160),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  locale text not null default 'fi' check (char_length(locale) <= 5),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index if not exists contact_requests_created_idx
  on public.contact_requests (created_at desc);

create index if not exists contact_requests_email_idx
  on public.contact_requests (lower(email), created_at desc);

alter table public.contact_requests enable row level security;

revoke all on public.contact_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lähetys (julkinen)
-- ---------------------------------------------------------------------------

create or replace function public.submit_contact_request(
  p_name text,
  p_restaurant text,
  p_email text,
  p_phone text default null,
  p_message text default null,
  p_locale text default 'fi'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_restaurant), '') = ''
     or v_email = '' then
    raise exception 'required';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'email';
  end if;

  -- Sama osoite korkeintaan kolmesti vuorokaudessa, kaikki yhteensä
  -- korkeintaan sata tunnissa. Riittää estämään toistuvan lähettämisen
  -- ja roskapostiaallon ilman kolmannen osapuolen palvelua.
  if (select count(*) from contact_requests
       where lower(email) = v_email
         and created_at > now() - interval '1 day') >= 3 then
    raise exception 'rate';
  end if;

  if (select count(*) from contact_requests
       where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'rate';
  end if;

  insert into contact_requests (name, restaurant, email, phone, message, locale)
  values (
    left(trim(p_name), 120),
    left(trim(p_restaurant), 160),
    v_email,
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    nullif(left(trim(coalesce(p_message, '')), 2000), ''),
    left(coalesce(nullif(trim(p_locale), ''), 'fi'), 5)
  );
end;
$$;

revoke all on function public.submit_contact_request(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_request(text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ylläpitäjä
-- ---------------------------------------------------------------------------

create or replace function public.sa_contact_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
      'handledAt', c.handled_at
    ) order by (c.handled_at is not null), c.created_at desc)
    from contact_requests c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.sa_set_contact_handled(p_id uuid, p_handled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  update contact_requests
  set handled_at = case when p_handled then now() else null end,
      handled_by = case when p_handled then auth.uid() else null end
  where id = p_id;
end;
$$;

revoke all on function public.sa_contact_requests() from public, anon;
revoke all on function public.sa_set_contact_handled(uuid, boolean) from public, anon;
grant execute on function public.sa_contact_requests() to authenticated;
grant execute on function public.sa_set_contact_handled(uuid, boolean) to authenticated;
