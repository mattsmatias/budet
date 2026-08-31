-- ---------------------------------------------------------------------------
-- 0076 — Lähtökansiot seuraavat käyttäjän kieltä
-- ---------------------------------------------------------------------------
--
-- Kate luo yhdeksän lähtökansiota suomeksi. Turkinkielinen käyttäjä näki
-- siis turkinkielisen sovelluksen jossa lukee "Sopimukset", "Kuitit" ja
-- "Myyntiraportit" — eikä hän voi tietää ovatko ne käännösvirhe vai
-- jonkun aiemmin kirjoittamia nimiä.
--
-- ---------------------------------------------------------------------------
-- MIKSI EI NIMEN UUDELLEENKIRJOITUSTA
-- ---------------------------------------------------------------------------
--
-- Suoraviivaisin korjaus olisi kirjoittaa nimet uudelleen kun käyttäjä
-- vaihtaa kieltä. Se ei käy: kieli on käyttäjäkohtainen
-- (profiles.locale). Saman ravintolan kaksi käyttäjää voivat lukea
-- Katea eri kielillä, ja toisen valinta muuttaisi sen mitä toinen näkee
-- kansiopuussa.
--
-- ---------------------------------------------------------------------------
-- RIVI MUISTAA OLEVANSA KOSKEMATON
-- ---------------------------------------------------------------------------
--
-- default_key kertoo että tämä kansio on Katen luoma ehdotus jota
-- kukaan ei ole vielä nimennyt. Sellainen käännetään näytettäessä.
--
-- Uudelleennimeäminen tyhjentää avaimen. Siitä hetkestä nimi on
-- käyttäjän oma eikä käänny enää millään kielellä — myös silloin kun
-- hän sattui kirjoittamaan täsmälleen saman sanan takaisin. Se on
-- oikein: hän on silloin päättänyt nimen, eikä päätöstä pidä perua
-- hänen puolestaan.
--
-- Nimi säilyy kannassa sellaisenaan. Käännös on esitystapa, ei tieto —
-- muuten sama rivi tarkoittaisi eri asiaa riippuen siitä kuka katsoo.

alter table folders
  add column if not exists default_key text;

/*
 * Avain on yksilöllinen ravintolassa.
 *
 * Kaksi "kuitit"-avainta samassa ravintolassa näyttäisi samalta
 * nimeltä kahdesti, eikä käyttäjä voisi erottaa niitä toisistaan.
 */
create unique index if not exists folders_default_key_once
  on folders (restaurant_id, default_key)
  where default_key is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Lähtökansiot avaimineen
-- ---------------------------------------------------------------------------

drop function if exists default_folder_names();

create or replace function default_folder_names()
returns table (key text, name text, sort_order integer)
language sql
immutable
set search_path = public
as $$
  values
    ('contracts',     'Sopimukset',        0),
    ('receipts',      'Kuitit',            1),
    ('sales_reports', 'Myyntiraportit',    2),
    ('invoices',      'Laskut',            3),
    ('finance',       'Talous',            4),
    ('staff',         'Työntekijät',       5),
    ('authorities',   'Viranomaiset',      6),
    ('important',     'Tärkeät tiedostot', 7),
    ('other',         'Muut',              8);
$$;

create or replace function seed_default_folders(p_restaurant uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into folders (restaurant_id, parent_folder_id, name, sort_order, default_key)
  select p_restaurant, null, d.name, d.sort_order, d.key
  from default_folder_names() d
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Nimeäminen katkaisee sidoksen
-- ---------------------------------------------------------------------------

create or replace function rename_folder(p_folder uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_old text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'Kansion nimi puuttuu';
  end if;

  select restaurant_id, name into v_restaurant, v_old
  from folders where id = p_folder and deleted_at is null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * default_key nollataan aina, myös silloin kun nimi ei muutu.
   *
   * Käyttäjä avasi nimeämisen ja hyväksyi nimen. Se on päätös, ja
   * päätöksen jälkeen kansio ei saa vaihtaa nimeään kielen mukana.
   */
  update folders
  set name = v_name, default_key = null
  where id = p_folder;

  perform write_audit(
    v_restaurant, 'renamed', 'folder', p_folder, v_name,
    'Nimesi kansion ' || v_old || ' → ' || v_name
  );
end;
$$;

revoke execute on function default_folder_names() from public, anon, authenticated;
revoke execute on function seed_default_folders(uuid) from public, anon, authenticated;
revoke execute on function rename_folder(uuid, text) from public, anon;
grant execute on function rename_folder(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Olemassa olevat kansiot
-- ---------------------------------------------------------------------------
--
-- Ravintolat jotka on jo luotu saivat kansionsa ilman avainta. Ne
-- tunnistetaan nimestä — mutta vain juuritason kansiot, ja vain jos
-- nimi täsmää tarkalleen. Käyttäjän itse luoma "Talous" jossakin
-- alikansiossa ei ole Katen ehdotus eikä sitä ruveta kääntämään.

update folders f
set default_key = d.key
from default_folder_names() d
where f.parent_folder_id is null
  and f.default_key is null
  and lower(btrim(f.name)) = lower(d.name);
