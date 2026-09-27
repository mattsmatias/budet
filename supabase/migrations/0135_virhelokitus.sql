-- 0135 Palvelinvirheet talteen
--
-- JOS KUKAAN EI NAE VIRHETTA, SITA EI OLE KORJATTU.
--
-- 500-virhe nakyi vain Vercelin lokeissa, joita kukaan ei lue ilman
-- syyta — ja syy tuli silloin asiakkaan puhelimessa. Nyt virhe
-- kirjautuu kantaan ja nakyy konsolissa.
--
-- EI ULKOISTA PALVELUA.
--
-- Sentry olisi parempi halytyksiin, mutta se on uusi tili, uusi avain
-- ja uusi kolmas osapuoli jolle asiakkaan polut vuotaisivat. Tama
-- riittaa siihen mihin sita tarvitaan: nakee etta jokin on rikki ja
-- missa.
--
-- ANON SAA KIRJATA, MUTTA RAJATUSTI.
--
-- Kirjautumissivun virhe on juuri se joka pitaa nahda, joten kirjaus
-- on auki myos kirjautumattomalle. Siksi funktio katkaisee jokaisen
-- kentan ja lopettaa kirjaamisen jos virheita tulee yli kahdensadan
-- tunnissa: sama katto kuin yhteydenottolomakkeella.

create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  path text,
  message text not null,
  digest text,
  stack text,
  seen boolean not null default false
);

comment on table app_errors is
  'Palvelinvirheet. Ei henkilotietoja: vain polku, viesti ja pino.';

create index if not exists app_errors_aika_idx
  on app_errors (occurred_at desc);

alter table app_errors enable row level security;

revoke all on table app_errors from anon, authenticated;

create or replace function log_app_error(
  p_path text,
  p_message text,
  p_digest text default null,
  p_stack text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (select count(*) from app_errors
      where occurred_at > now() - interval '1 hour') >= 200 then
    return;
  end if;

  insert into app_errors (path, message, digest, stack)
  values (
    left(coalesce(p_path, ''), 300),
    left(coalesce(nullif(trim(p_message), ''), 'tuntematon virhe'), 1000),
    left(coalesce(p_digest, ''), 100),
    left(coalesce(p_stack, ''), 4000)
  );
end;
$$;

revoke all on function log_app_error(text, text, text, text) from public;
grant execute on function log_app_error(text, text, text, text) to anon, authenticated;

create or replace function sa_app_errors(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.occurred_at desc), '[]'::jsonb)
  into v
  from (
    select id, occurred_at, path, message, digest, stack, seen
    from app_errors
    order by occurred_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) x;

  return v;
end;
$$;

revoke all on function sa_app_errors(integer) from public, anon;
grant execute on function sa_app_errors(integer) to authenticated;

create or replace function sa_mark_errors_seen()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  update app_errors set seen = true where not seen;
end;
$$;

revoke all on function sa_mark_errors_seen() from public, anon;
grant execute on function sa_mark_errors_seen() to authenticated;
