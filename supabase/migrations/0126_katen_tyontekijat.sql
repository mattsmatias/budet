-- 0126 Katen omat tyontekijat
--
-- OMA TAULU, EI LIPPUA PROFIILISSA.
--
-- Profiilia saa paivittaa itse (profiles_update_own), ja siella olevaa
-- kenttaa suojaisi vain liipaisin. Sama virhe tehtiin kertaalleen
-- is_super_admin-lipun kanssa, ja se vaati oman vahtinsa. Katen
-- tyontekijyys asuu siksi omassa taulussaan, jolle ei kirjoiteta
-- yhtaan kirjoituspolitiikkaa: rivi syntyy vain kutsukoodilla tai
-- yllapitajan funktiolla, eika kayttaja voi antaa sita itselleen
-- vaikka yrittaisi.
--
-- ERI ASIA KUIN ASIAKKAAN JASENYYS.
--
-- memberships kertoo mihin yritykseen ihminen kuuluu ja milla
-- roolilla. Katen tyontekija ei kuulu yhteenkaan asiakasyritykseen:
-- han nakee vain tuote-esittelyn. Jos tama olisi jasenyys, hanelle
-- pitaisi keksia ravintola johon han kuuluu.

create table if not exists kate_staff (
  user_id uuid primary key references profiles (id) on delete cascade,
  -- presenter = paasy tuote-esittelyyn. Uusi arvo lisataan omalla
  -- migraatiolla, jotta oikeuden laajentuminen nakyy historiassa.
  role text not null default 'presenter',
  -- Nimi jonka yllapitaja kirjoitti kutsuun. Jaa talteen siksi, etta
  -- kutsun luoja tietaa kenelle koodi annettiin ennen kuin tunnus on
  -- luotu ja profiilissa on oikea nimi.
  label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kate_staff_rooli check (role in ('presenter'))
);

comment on table kate_staff is
  'Katen omat tyontekijat. Ei asiakasyrityksen jasenyys.';

alter table kate_staff enable row level security;

-- Luku: oma rivi, ja yllapitajalle kaikki. Kirjoituspolitiikkaa ei ole.
drop policy if exists kate_staff_read on kate_staff;
create policy kate_staff_read on kate_staff
  for select using (
    user_id = (select auth.uid()) or current_user_is_super_admin()
  );

create index if not exists kate_staff_created_by_idx
  on kate_staff (created_by);

-- Kutsukoodit.
--
-- Kannassa on vain tiiviste, kuten yritysten kutsuissa. Koodi
-- naytetaan luojalle kerran; jos se katoaa, tehdaan uusi.
create table if not exists kate_invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  -- Nelja viimeista merkkia, jotta listasta tunnistaa minka koodin
  -- antoi kenelle. Nelja merkkia ei riita arvaamiseen.
  code_hint text not null,
  role text not null default 'presenter',
  label text,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kate_invitations_rooli check (role in ('presenter'))
);

comment on table kate_invitations is
  'Kertakoodit Katen tyontekijan tunnusta varten.';

alter table kate_invitations enable row level security;
-- Ei yhtaan politiikkaa: tiivisteita ei lueta clientilta lainkaan.

create index if not exists kate_invitations_created_by_idx
  on kate_invitations (created_by);
create index if not exists kate_invitations_accepted_by_idx
  on kate_invitations (accepted_by);

-- Taulujen oikeudet nimetaan tassa, ei jateta oletuksille.
revoke all on table kate_staff from anon, authenticated;
grant select on table kate_staff to authenticated;
revoke all on table kate_invitations from anon, authenticated;

-- ---------------------------------------------------------------------
-- Koodin tarkistus ja lunastus
-- ---------------------------------------------------------------------

-- Sama normalisointi kuin yritysten koodeissa: isot kirjaimet ja
-- reunavalit pois ennen tiivistetta, jotta kasin kirjoitettu koodi
-- kelpaa samalla tavalla kumpaakin reittia.
create or replace function preview_kate_invitation(p_code text)
returns table (label text, role text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.label, i.role
  from kate_invitations i
  where i.code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex')
    and i.accepted_at is null
    and i.expires_at >= now();
$$;

create or replace function accept_kate_invitation(p_code text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_inv kate_invitations;
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  select * into v_inv from kate_invitations
  where code_hash = encode(sha256(upper(trim(p_code))::bytea), 'hex');

  if v_inv.id is null then
    raise exception 'Koodia ei loytynyt';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'Koodi on jo kaytetty';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Koodi on vanhentunut';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  insert into kate_staff (user_id, role, label, created_by)
  values (v_user, v_inv.role, v_inv.label, v_inv.created_by)
  on conflict (user_id) do update set role = excluded.role;

  update kate_invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.role;
end;
$$;

-- ---------------------------------------------------------------------
-- Konsolin toiminnot
-- ---------------------------------------------------------------------

create or replace function sa_kate_staff()
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

  select jsonb_build_object(
    'staff', coalesce((
      select jsonb_agg(row_to_json(s)::jsonb order by s.created_at)
      from (
        select
          ks.user_id,
          ks.role,
          coalesce(p.full_name, ks.label) as name,
          u.email,
          u.last_sign_in_at,
          ks.created_at,
          coalesce(p.is_super_admin, false) as is_super_admin
        from kate_staff ks
        left join profiles p on p.id = ks.user_id
        left join auth.users u on u.id = ks.user_id
      ) s
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(row_to_json(i)::jsonb order by i.created_at desc)
      from (
        select
          ki.id,
          ki.label,
          ki.role,
          ki.code_hint,
          ki.expires_at,
          ki.created_at
        from kate_invitations ki
        where ki.accepted_at is null
      ) i
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

create or replace function sa_invite_kate_staff(p_label text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := '';
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  i integer;
  v_label text := nullif(trim(p_label), '');
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  -- Sama satunnaisuus kuin yritysten kutsuissa: random() on arvattava.
  v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 1..8 loop
    v_code := v_code || substr(
      v_alphabet,
      1 + (get_byte(v_bytes, i - 1) % length(v_alphabet)),
      1
    );
  end loop;

  insert into kate_invitations (code_hash, code_hint, label, created_by)
  values (
    encode(sha256(v_code::bytea), 'hex'),
    right(v_code, 4),
    v_label,
    auth.uid()
  );

  perform sa_log(
    'kate.staff_invited',
    'Kutsu Katen tyontekijalle' || coalesce(': ' || v_label, ''),
    'kate_staff', null, v_label, null,
    jsonb_build_object('role', 'presenter'), false
  );

  return v_code;
end;
$$;

create or replace function sa_revoke_kate_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_label text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select label into v_label from kate_invitations
  where id = p_id and accepted_at is null;

  delete from kate_invitations where id = p_id and accepted_at is null;

  perform sa_log(
    'kate.invitation_revoked',
    'Katen tyontekijan kutsu peruttiin' || coalesce(': ' || v_label, ''),
    'kate_staff', null, v_label, null, null, false
  );
end;
$$;

-- Oikeuden poisto ei poista tunnusta.
--
-- Tunnus jaa olemaan ja sen voi kutsua uudelleen. Tunnuksen
-- poistaminen kuuluu Supabasen puolelle, eika sita tehda vahingossa
-- listan roskakorista.
create or replace function sa_remove_kate_staff(p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text;
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  select coalesce(p.full_name, ks.label) into v_name
  from kate_staff ks
  left join profiles p on p.id = ks.user_id
  where ks.user_id = p_user;

  delete from kate_staff where user_id = p_user;

  perform sa_log(
    'kate.staff_removed',
    'Katen tyontekijan paasy poistettiin' || coalesce(': ' || v_name, ''),
    'kate_staff', p_user, v_name, null, null, true
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Funktioiden oikeudet
-- ---------------------------------------------------------------------
--
-- MOLEMMAT NIMETAAN: PUBLIC JA ANON.
--
-- Pelkka revoke PUBLICilta ei riita, koska Supabasen oletusoikeudet
-- antavat uudelle funktiolle EXECUTEn suoraan anonille, ja suora
-- myonto jaa voimaan vaikka PUBLICilta revotaan. Pelkka revoke
-- anonilta ei riittanyt aiemmin (0124), koska oikeus tuli silloin
-- PUBLICin kautta. Vain nain paivin oikeus sulkeutuu — ja se
-- tarkistettiin kannasta funktio kerrallaan.

revoke all on function preview_kate_invitation(text) from public;
grant execute on function preview_kate_invitation(text) to anon, authenticated;

revoke all on function accept_kate_invitation(text) from public, anon;
grant execute on function accept_kate_invitation(text) to authenticated;

revoke all on function sa_kate_staff() from public, anon;
grant execute on function sa_kate_staff() to authenticated;

revoke all on function sa_invite_kate_staff(text) from public, anon;
grant execute on function sa_invite_kate_staff(text) to authenticated;

revoke all on function sa_revoke_kate_invitation(uuid) from public, anon;
grant execute on function sa_revoke_kate_invitation(uuid) to authenticated;

revoke all on function sa_remove_kate_staff(uuid) from public, anon;
grant execute on function sa_remove_kate_staff(uuid) to authenticated;
