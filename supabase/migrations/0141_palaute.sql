-- 0141 Palaute: bugit, ehdotukset ja yhteydenotot sovelluksen sisalta
--
-- MIKSI TAMA ON OLEMASSA.
--
-- Maksava asiakas, joka tormasi bugiin, ohjattiin sovelluksesta ULOS
-- julkiselle myyntilomakkeelle kirjoittamaan oma yrityksensa nimi
-- kasin — samalle lomakkeelle jolla uudet prospektit pyytavat
-- tunnuksia. Samaan aikaan app_errors tiesi jo virheen pinon muttei
-- kuka siihen tormasi tai mita han oli tekemassa. Saman tapauksen
-- kaksi puoliskoa olivat eri paikoissa eivatka loytaneet toisiaan.
--
-- Nyt ilmoitus lahtee sielta missa ongelma nakyy, ja se kantaa
-- mukanaan yrityksen, kayttajan ja nakyman polun ilman etta kukaan
-- kirjoittaa niita uudelleen.
--
-- KOLME LAJIA, YKSI TAULU.
--
-- Bugi, ehdotus ja yhteydenotto ovat sama asia lukijan kannalta:
-- asiakas sanoo jotain ja joku vastaa. Kolme taulua olisi tarkoittanut
-- etta kahta niista ei lueta. Laji on kentta, ei rakenne.
--
-- KAKSISUUNTAINEN.
--
-- Ilmoittaja nakee oman ilmoituksensa tilan ja vastauksen. Ilman sita
-- tama olisi postilaatikko johon asiat katoavat, ja "mita sille kavi"
-- kysyttaisiin lopulta puhelimessa — eli juuri siina kanavassa jonka
-- tama korvaa.

create type feedback_kind as enum ('bug', 'idea', 'contact');
create type feedback_status as enum ('new', 'in_progress', 'done', 'declined');

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  kind feedback_kind not null,
  title text not null check (length(trim(title)) between 3 and 120),
  body text not null check (length(trim(body)) between 10 and 4000),
  /*
   * Mista nakymasta ilmoitus lahti.
   *
   * Tama on ero "jokin ei toimi" -viestin ja korjattavan vian valilla.
   * Polku tulee palvelimelta eika lomakkeelta, joten sita ei voi
   * syottaa vaaraksi.
   */
  path text check (path is null or length(path) <= 300),
  status feedback_status not null default 'new',
  reply text check (reply is null or length(reply) <= 2000),
  replied_at timestamptz,
  replied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table feedback is
  'Asiakkaiden bugi-ilmoitukset, ehdotukset ja yhteydenotot. Kaksisuuntainen: ilmoittaja nakee tilan ja vastauksen.';

create index if not exists feedback_restaurant_idx
  on feedback (restaurant_id, created_at desc);
create index if not exists feedback_status_idx
  on feedback (status, created_at desc);

create trigger touch_feedback
  before update on feedback
  for each row execute function touch_updated_at();

alter table feedback enable row level security;

/*
 * Luku: oma ilmoitus, ja omistajalle kaikki yrityksen ilmoitukset.
 *
 * Omistaja vastaa yrityksestaan ja nakee mita sielta on lahetetty.
 * Muut roolit nakevat vain omansa: ilmoitus voi koskea sita etta
 * jokin on rikki tavalla joka nolottaa, eika sen tarvitse kiertaa
 * koko tiimin lapi.
 */
drop policy if exists feedback_read on feedback;
create policy feedback_read on feedback
  for select to authenticated
  using (created_by = (select auth.uid()) or is_owner(restaurant_id));

/*
 * Kirjoitus: oman yrityksen nimissa, omalla nimella.
 *
 * created_by pakotetaan omaksi: muuten kentan voisi asettaa
 * lomakkeelta ja ilmoitus nayttaisi tulleen jonkun toisen nimissa.
 */
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback
  for insert to authenticated
  with check (
    restaurant_id in (select my_restaurant_ids())
    and created_by = (select auth.uid())
  );

/*
 * Ei muokkausta eika poistoa asiakkaan puolelta.
 *
 * Lahetetty ilmoitus on tapahtuma eika luonnos. Tilan ja vastauksen
 * kirjoittaa vain yllapitaja omien funktioidensa kautta.
 */

-- ---------------------------------------------------------------------------
-- Kehittajan puoli: kaikki kulkee sa_-funktion lapi, kuten muukin konsoli.
-- ---------------------------------------------------------------------------

create or replace function sa_feedback(p_limit integer default 200)
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

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
  into v
  from (
    select
      f.id,
      f.created_at,
      f.kind,
      f.status,
      f.title,
      f.body,
      f.path,
      f.reply,
      f.replied_at,
      r.name as restaurant_name,
      r.id as restaurant_id,
      coalesce(p.full_name, u.email) as reporter,
      u.email as reporter_email
    from feedback f
    join restaurants r on r.id = f.restaurant_id
    left join auth.users u on u.id = f.created_by
    left join profiles p on p.id = f.created_by
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) x;

  return v;
end;
$$;

revoke all on function sa_feedback(integer) from public, anon;
grant execute on function sa_feedback(integer) to authenticated;

/*
 * Tilan ja vastauksen kirjaus.
 *
 * Vastaus on valinnainen: tilan siirtaminen tyon alle ei vaadi
 * sanoja. Tyhja vastaus ei pyyhi aiempaa, jotta tilan vaihtaminen
 * ei vahingossa poista jo kirjoitettua viestia.
 */
create or replace function sa_feedback_respond(
  p_id uuid,
  p_status feedback_status default null,
  p_reply text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reply text := nullif(trim(coalesce(p_reply, '')), '');
begin
  if not current_user_is_super_admin() then
    raise exception 'Vain jarjestelman yllapitaja';
  end if;

  if v_reply is not null and length(v_reply) > 2000 then
    raise exception 'Vastaus on liian pitka';
  end if;

  update feedback
  set status = coalesce(p_status, status),
      reply = coalesce(v_reply, reply),
      replied_at = case when v_reply is not null then now() else replied_at end,
      replied_by = case when v_reply is not null then (select auth.uid()) else replied_by end
  where id = p_id;

  if not found then
    raise exception 'Ilmoitusta ei loytynyt';
  end if;
end;
$$;

revoke all on function sa_feedback_respond(uuid, feedback_status, text) from public, anon;
grant execute on function sa_feedback_respond(uuid, feedback_status, text) to authenticated;

/* Merkin luku valikkoon: montako on viela avaamatta. */
create or replace function sa_feedback_open()
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

  select count(*) into v from feedback where status = 'new';
  return coalesce(v, 0);
end;
$$;

revoke all on function sa_feedback_open() from public, anon;
grant execute on function sa_feedback_open() to authenticated;
