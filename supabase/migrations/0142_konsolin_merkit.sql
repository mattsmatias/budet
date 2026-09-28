-- 0142 Virheiden ja yhteydenottojen maara konsolin kiskoon
--
-- Palaute sai merkkinsa edellisessa muutoksessa. Virheet ja
-- yhteydenotot nayttivat lukunsa vain sivun otsikossa, eli ne naki
-- vasta kun sivun avasi — ja juuri ne kaksi ovat asioita joita ei
-- pitaisi joutua muistamaan katsoa.
--
-- OMA FUNKTIO, EI LISTAN PITUUS.
--
-- Valikko piirretaan konsolin jokaisella sivulla. Sadan virherivin tai
-- kaikkien yhteydenottojen hakeminen pelkan lukumaaran vuoksi olisi
-- kysely joka kasvaa datan mukana eika kerro enempaa.
--
-- SAMA LUKU KUIN SIVUN OTSIKOSSA.
--
-- Virheissa lasketaan rivit eika erillisia vikoja, vaikka sama vika
-- tuottaa monta rivia. Erotteleva luku olisi kiskossa parempi, mutta
-- silloin kisko ja sivu sanoisivat samasta asiasta eri luvun — ja
-- kaksi lukua samasta asiasta on kaksi eri asiaa lukijan silmissa.
-- Jos erottelu halutaan, se tehdaan molempiin kerralla.

create or replace function sa_app_errors_unseen()
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v integer;
begin
  if not current_user_is_super_admin() then
    return 0;
  end if;

  select count(*) into v from app_errors where not seen;
  return coalesce(v, 0);
end;
$$;

revoke all on function sa_app_errors_unseen() from public, anon;
grant execute on function sa_app_errors_unseen() to authenticated;

create or replace function sa_contact_requests_open()
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v integer;
begin
  if not current_user_is_super_admin() then
    return 0;
  end if;

  select count(*) into v from contact_requests where handled_at is null;
  return coalesce(v, 0);
end;
$$;

revoke all on function sa_contact_requests_open() from public, anon;
grant execute on function sa_contact_requests_open() to authenticated;
