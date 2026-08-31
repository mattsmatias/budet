-- ---------------------------------------------------------------------------
-- 0078 — Viimeksi käytetyt ja kansion viimeisin tapahtuma
-- ---------------------------------------------------------------------------
--
-- Ravintoloitsija ei muista missä kansiossa vuokrasopimus on. Hän
-- muistaa katsoneensa sitä viime viikolla.
--
-- "Viimeksi lisätyt" ei vastaa siihen: se kertoo mikä on uutta, ei mitä
-- on käytetty. Sopimus on voitu tallentaa vuosi sitten ja avata eilen —
-- ja juuri se eilinen avaus on se mistä sen löytää uudelleen.
--
-- ---------------------------------------------------------------------------
-- AVAUS ON TIETO, EI LOKI
-- ---------------------------------------------------------------------------
--
-- Sarake rivillä, ei erillistä tapahtumataulua. Kysymys on "milloin
-- tätä viimeksi katsottiin", ei "kuka katsoi mitäkin milloin".
-- Jälkimmäiseen vastaa audit_log, ja se on eri kysymys eri
-- käyttötarkoitukseen.
--
-- Ei myöskään käyttäjäkohtaisesti. Ravintolassa on muutama esihenkilö
-- ja he katsovat samoja papereita; "kuka viimeksi avasi" olisi tieto
-- jota kukaan ei kysy.

alter table files
  add column if not exists last_opened_at timestamptz;

create index if not exists files_recently_opened
  on files (restaurant_id, last_opened_at desc)
  where last_opened_at is not null and deleted_at is null;

/**
 * Avausajan merkintä.
 *
 * Lukuoikeus riittää: kirjanpitäjä saa avata tiedoston, ja hänen
 * avauksensa on yhtä lailla tieto siitä että tiedostoa käytetään.
 * files_write-käytäntö vaatisi esihenkilön, joten tämä on security
 * definer omalla tarkistuksellaan.
 *
 * Tuntematon tunniste palautuu hiljaa. Avaus on jo tapahtunut tai
 * epäonnistunut muualla, eikä merkinnän epäonnistuminen saa kaataa
 * tiedoston lataamista.
 */
create or replace function mark_file_opened(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then return; end if;

  if not can_read_finance(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set last_opened_at = now() where id = p_file;
end;
$$;

revoke execute on function mark_file_opened(uuid) from public, anon;
grant execute on function mark_file_opened(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Kansion viimeisin tapahtuma
-- ---------------------------------------------------------------------------
--
-- "86 tiedostoa · päivitetty tänään" kertoo yhdellä silmäyksellä missä
-- eletään ja mikä on hiljaista. Aika lasketaan samassa kyselyssä kuin
-- lukumäärä, joten se ei maksa erillistä kierrosta.
--
-- Paluutyyppi muuttuu, joten funktio on pudotettava ensin.

drop function if exists folder_counts(uuid);

create or replace function folder_counts(p_restaurant uuid)
returns table (folder_id uuid, file_count bigint, last_activity timestamptz)
language sql
stable
set search_path = public
as $$
  select f.folder_id, count(*), max(f.updated_at)
  from files f
  where f.restaurant_id = p_restaurant
    and f.folder_id is not null
    and f.deleted_at is null
  group by f.folder_id;
$$;

revoke execute on function folder_counts(uuid) from public, anon;
grant execute on function folder_counts(uuid) to authenticated;
