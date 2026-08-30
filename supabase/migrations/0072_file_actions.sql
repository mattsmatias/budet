-- ---------------------------------------------------------------------------
-- 0072 — Tiedostojen ja kansioiden toiminnot
-- ---------------------------------------------------------------------------
--
-- Luku tapahtuu suorilla kyselyillä rivitason käytäntöjen läpi. Muutokset
-- kulkevat näiden funktioiden kautta, koska niihin liittyy tarkistuksia
-- joita käytäntö ei osaa ilmaista: silmukka kansiopuussa, syvyysraja,
-- kansion ja tiedoston kuuluminen samaan ravintolaan, ja lokimerkintä.
--
-- ---------------------------------------------------------------------------
-- RAVINTOLA LUETAAN RIVISTÄ, EI PYYNNÖSTÄ
-- ---------------------------------------------------------------------------
--
-- Yksikään funktio ei luota annettuun restaurant_id-arvoon. Kun
-- kohteena on olemassa oleva kansio tai tiedosto, ravintola haetaan
-- siitä rivistä ja oikeus tarkistetaan sitä vastaan. Uutta luotaessa
-- annettu tunniste kelpaa vain jos is_manager myöntää sen kutsujalle —
-- vieraan ravintolan tunniste ei siis avaa mitään.
--
-- Erityisesti siirroissa tarkistetaan molemmat päät: tiedosto ja
-- kohdekansio on kuuluttava samaan ravintolaan. Ilman sitä oman
-- ravintolan tiedoston voisi siirtää toisen ravintolan kansioon
-- pelkällä kansion tunnisteella.

-- ---------------------------------------------------------------------------
-- Apufunktiot
-- ---------------------------------------------------------------------------

/**
 * Kansion syvyys juuresta. Juurikansio on 1.
 */
create or replace function folder_depth(p_folder uuid)
returns integer
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    /* Rikkinäinen puu ei saa jäädä pyörimään ikuisesti. */
    where up.depth < 50
  )
  select coalesce(max(depth), 0) from up;
$$;

/**
 * Onko kohde jälkeläinen.
 *
 * Estää kansion siirtämisen oman alikansionsa sisään. Ilman tätä
 * tarkistusta siirto irrottaisi haaran puusta: se ei enää löytyisi
 * juuresta eikä siis mistään näkymästä, mutta rivit olisivat yhä
 * kannassa.
 */
create or replace function folder_is_descendant(p_folder uuid, p_maybe_ancestor uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select exists (select 1 from up where up.parent_folder_id = p_maybe_ancestor);
$$;

/**
 * Kansiopolku tekstinä, esimerkiksi "Talous / 2026 / Elokuu".
 *
 * Käytetään hakutuloksessa ja lokimerkinnässä. Juuressa oleva tiedosto
 * saa tyhjän merkkijonon, jonka käyttöliittymä korvaa "Tiedostot"-
 * otsikolla omalla kielellään.
 */
create or replace function folder_path_text(p_folder uuid)
returns text
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select id, parent_folder_id, name, 1 as depth
    from folders
    where id = p_folder

    union all

    select f.id, f.parent_folder_id, f.name, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select coalesce(
    string_agg(name, ' / ' order by depth desc),
    ''
  )
  from up;
$$;

/**
 * Murupolku käyttöliittymälle.
 *
 * Palauttaa juuresta kohti kansiota, jotta näkymä voi tulostaa rivit
 * sellaisenaan. security invoker: rivitason käytännöt suodattavat, eikä
 * tässä ole mitään mitä ne eivät jo osaisi.
 */
create or replace function folder_breadcrumb(p_folder uuid)
returns table (id uuid, name text)
language sql
stable
set search_path = public
as $$
  with recursive up as (
    select f.id, f.parent_folder_id, f.name, 1 as depth
    from folders f
    where f.id = p_folder

    union all

    select f.id, f.parent_folder_id, f.name, up.depth + 1
    from folders f
    join up on f.id = up.parent_folder_id
    where up.depth < 50
  )
  select up.id, up.name from up order by up.depth desc;
$$;

/*
 * Syvyysraja.
 *
 * Käyttäjä saa rakentaa oman rakenteensa, eikä kymmenen tasoa tule
 * vastaan missään todellisessa käytössä. Raja on olemassa siksi ettei
 * ohjelmointivirhe tai vahinko voi kasvattaa puuta rajatta ja tehdä
 * murupolusta lukukelvotonta.
 */
create or replace function max_folder_depth()
returns integer
language sql
immutable
as $$ select 10 $$;

-- ---------------------------------------------------------------------------
-- Kansiot
-- ---------------------------------------------------------------------------

create or replace function create_folder(
  p_restaurant uuid,
  p_parent uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_order integer;
begin
  if v_name = '' then
    raise exception 'Kansion nimi puuttuu';
  end if;

  /*
   * Emokansio määrää ravintolan.
   *
   * Annettu tunniste on vain ehdotus. Jos emo on olemassa, ravintola
   * luetaan siitä — muuten alikansion voisi luoda toisen ravintolan
   * kansion alle antamalla oman tunnisteensa.
   */
  if p_parent is not null then
    select restaurant_id into v_restaurant from folders where id = p_parent;

    if v_restaurant is null then
      raise exception 'Kansiota ei löydy';
    end if;

    if folder_depth(p_parent) >= max_folder_depth() then
      raise exception 'Kansiorakenne on liian syvä';
    end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /* Uusi kansio listan loppuun, ei alkuun. */
  select coalesce(max(sort_order), -1) + 1 into v_order
  from folders
  where restaurant_id = v_restaurant
    and parent_folder_id is not distinct from p_parent;

  insert into folders (restaurant_id, parent_folder_id, name, sort_order, created_by)
  values (v_restaurant, p_parent, v_name, v_order, auth.uid())
  returning id into v_id;

  perform write_audit(
    v_restaurant, 'created', 'folder', v_id, v_name,
    'Loi kansion ' || v_name
  );

  return v_id;
end;
$$;

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
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  update folders set name = v_name where id = p_folder;

  perform write_audit(
    v_restaurant, 'renamed', 'folder', p_folder, v_name,
    'Nimesi kansion ' || v_old || ' → ' || v_name
  );
end;
$$;

create or replace function move_folder(p_folder uuid, p_parent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_target_restaurant uuid;
  v_name text;
  v_order integer;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  if p_parent is not null then
    select restaurant_id into v_target_restaurant from folders where id = p_parent;

    if v_target_restaurant is null then
      raise exception 'Kohdekansiota ei löydy';
    end if;

    /*
     * Molemmat päät samasta ravintolasta.
     *
     * Kutsuja voi olla usean ravintolan esihenkilö. Ilman tätä hän
     * voisi siirtää kansion ravintolasta toiseen, ja rivin
     * restaurant_id jäisi kertomaan eri tarinaa kuin sen paikka
     * puussa.
     */
    if v_target_restaurant <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.' using errcode = 'insufficient_privilege';
    end if;

    if p_parent = p_folder then
      raise exception 'Kansiota ei voi siirtää itseensä';
    end if;

    if folder_is_descendant(p_parent, p_folder) then
      raise exception 'Kansiota ei voi siirtää oman alikansionsa sisään';
    end if;

    if folder_depth(p_parent) >= max_folder_depth() then
      raise exception 'Kansiorakenne on liian syvä';
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_order
  from folders
  where restaurant_id = v_restaurant
    and parent_folder_id is not distinct from p_parent;

  update folders
  set parent_folder_id = p_parent, sort_order = v_order
  where id = p_folder;

  perform write_audit(
    v_restaurant, 'moved', 'folder', p_folder, v_name,
    'Siirsi kansion ' || v_name || ' → ' ||
      coalesce(nullif(folder_path_text(p_parent), ''), 'Tiedostot')
  );
end;
$$;

/**
 * Kansion poisto.
 *
 * p_mode = 'keep'     — tiedostot siirtyvät juureen, kansio katoaa
 * p_mode = 'contents' — myös tiedostot poistetaan
 *
 * Palauttaa poistettujen tiedostojen storage-polut, jotta kutsuja voi
 * poistaa myös itse objektit. Kanta ei ylety storageen, joten se on
 * kutsujan tehtävä — ja siksi polut palautetaan tässä eikä jätetä
 * kutsujan haettavaksi erikseen, jolloin ne olisivat jo poissa.
 */
create or replace function delete_folder(p_folder uuid, p_mode text default 'keep')
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_paths text[];
  v_count integer;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  if p_mode not in ('keep', 'contents') then
    raise exception 'Tuntematon poistotapa';
  end if;

  if p_mode = 'contents' then
    /*
     * Koko haara, ei vain tämä kansio.
     *
     * Käyttäjä näkee kansion sisältöineen yhtenä asiana. Jos poisto
     * koskisi vain ylintä tasoa, alikansioiden tiedostot jäisivät
     * juureen irrallisina — ja juuri niitä käyttäjä luuli poistavansa.
     */
    with recursive tree as (
      select id from folders where id = p_folder
      union all
      select f.id from folders f join tree t on f.parent_folder_id = t.id
    ),
    poistetut as (
      delete from files
      where folder_id in (select id from tree)
      returning storage_path
    )
    select array_agg(storage_path) into v_paths from poistetut;
  end if;

  v_count := coalesce(array_length(v_paths, 1), 0);

  delete from folders where id = p_folder;

  perform write_audit(
    v_restaurant, 'deleted', 'folder', p_folder, v_name,
    case
      when p_mode = 'contents'
        then 'Poisti kansion ' || v_name || ' sisältöineen (' || v_count || ' tiedostoa)'
      else 'Poisti kansion ' || v_name
    end,
    null, null, true
  );

  /* Polut kutsujalle, joka poistaa objektit storagesta. */
  return query select unnest(coalesce(v_paths, array[]::text[]));
end;
$$;

create or replace function reorder_folders(p_parent uuid, p_restaurant uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_wrong integer;
begin
  if p_parent is not null then
    select restaurant_id into v_restaurant from folders where id = p_parent;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * Jokaisen kansion on kuuluttava tähän paikkaan.
   *
   * Funktio on security definer, joten se ohittaa rivitason käytännöt.
   * Ilman tätä tarkistusta annettu tunnistelista olisi tapa muuttaa
   * minkä tahansa kansion järjestystä missä tahansa ravintolassa.
   */
  select count(*) into v_wrong
  from unnest(p_ids) as wanted(id)
  where not exists (
    select 1 from folders f
    where f.id = wanted.id
      and f.restaurant_id = v_restaurant
      and f.parent_folder_id is not distinct from p_parent
  );

  if v_wrong > 0 then
    raise exception 'Kansio ei kuulu tähän paikkaan';
  end if;

  update folders f
  set sort_order = pos.ord
  from unnest(p_ids) with ordinality as pos(id, ord)
  where f.id = pos.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tiedostot
-- ---------------------------------------------------------------------------

/**
 * Ladatun tiedoston kirjaus.
 *
 * Objekti on jo storagessa, kun tämä kutsutaan. Storage-käytäntö on
 * tarkistanut ravintolan polusta; tämä tarkistaa saman uudelleen
 * kannan puolelta, koska rivi on se jota käyttöliittymä näyttää.
 */
create or replace function register_file(
  p_restaurant uuid,
  p_folder uuid,
  p_name text,
  p_path text,
  p_type text,
  p_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid := p_restaurant;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_name = '' then raise exception 'Tiedoston nimi puuttuu'; end if;
  if coalesce(btrim(p_path), '') = '' then raise exception 'Polku puuttuu'; end if;
  if coalesce(p_size, 0) <= 0 then raise exception 'Tiedosto on tyhjä'; end if;

  if p_folder is not null then
    select restaurant_id into v_restaurant from folders where id = p_folder;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  /*
   * Polun on alettava tämän ravintolan tunnisteella.
   *
   * Muuten rivi voisi osoittaa toisen ravintolan objektiin, ja
   * allekirjoitettu osoite luotaisiin sille rivin perusteella.
   */
  if split_part(p_path, '/', 1) <> v_restaurant::text then
    raise exception 'Polku ei kuulu tälle ravintolalle';
  end if;

  insert into files (
    restaurant_id, folder_id, file_name, storage_path,
    file_type, file_size, uploaded_by
  )
  values (
    v_restaurant, p_folder, v_name, btrim(p_path),
    coalesce(nullif(btrim(p_type), ''), 'application/octet-stream'),
    p_size, auth.uid()
  )
  returning id into v_id;

  perform write_audit(
    v_restaurant, 'created', 'file', v_id, v_name,
    'Lisäsi tiedoston ' || v_name || ' → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );

  return v_id;
end;
$$;

create or replace function rename_file(p_file uuid, p_name text)
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
  if v_name = '' then raise exception 'Tiedoston nimi puuttuu'; end if;

  select restaurant_id, file_name into v_restaurant, v_old
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  update files set file_name = v_name where id = p_file;

  perform write_audit(
    v_restaurant, 'renamed', 'file', p_file, v_name,
    'Nimesi tiedoston ' || v_old || ' → ' || v_name
  );
end;
$$;

create or replace function move_file(p_file uuid, p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_current_folder uuid;
  v_target_restaurant uuid;
  v_name text;
  v_from text;
begin
  select restaurant_id, file_name, folder_id
  into v_restaurant, v_name, v_current_folder
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  v_from := coalesce(nullif(folder_path_text(v_current_folder), ''), 'Tiedostot');

  if p_folder is not null then
    select restaurant_id into v_target_restaurant from folders where id = p_folder;

    if v_target_restaurant is null then
      raise exception 'Kohdekansiota ei löydy';
    end if;

    /* Sama sääntö kuin kansion siirrossa: molemmat päät tarkistetaan. */
    if v_target_restaurant <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.' using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files set folder_id = p_folder where id = p_file;

  perform write_audit(
    v_restaurant, 'moved', 'file', p_file, v_name,
    'Siirsi tiedoston ' || v_name || ': ' || v_from || ' → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );
end;
$$;

create or replace function set_file_favorite(p_file uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  /* Tähti ei ole lokitapahtuma: se on näkymäasetus, ei muutos asiaan. */
  update files set is_favorite = coalesce(p_value, false) where id = p_file;
end;
$$;

/**
 * Tiedoston poisto.
 *
 * Palauttaa storage-polun, jotta kutsuja voi poistaa myös objektin.
 * Rivi poistetaan ensin: se on se mitä käyttäjä näkee, ja jäljelle
 * jäävä objekti on siivousasia — kun taas jäljelle jäävä rivi ilman
 * objektia olisi rikkinäinen tiedosto näkymässä.
 */
create or replace function delete_file(p_file uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_path text;
begin
  select restaurant_id, file_name, storage_path
  into v_restaurant, v_name, v_path
  from files where id = p_file;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege'; end if;

  delete from files where id = p_file;

  perform write_audit(
    v_restaurant, 'deleted', 'file', p_file, v_name,
    'Poisti tiedoston ' || v_name,
    null, null, true
  );

  return v_path;
end;
$$;

-- ---------------------------------------------------------------------------
-- Haku
-- ---------------------------------------------------------------------------

/**
 * Haku koko ravintolan tiedostoista.
 *
 * Sijainti tulee mukaan, koska hakutulos ilman sijaintia ei kerro
 * käyttäjälle mistä tiedosto löytyy ensi kerralla ilman hakua.
 *
 * security invoker: rivitason käytännöt rajaavat tuloksen kutsujan
 * ravintoloihin, eikä tässä tarvita mitään sen yli.
 */
create or replace function search_files(
  p_restaurant uuid,
  p_term text,
  p_limit integer default 50
)
returns table (
  id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  folder_id uuid,
  folder_path text,
  is_favorite boolean,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    f.id,
    f.file_name,
    f.file_type,
    f.file_size,
    f.folder_id,
    folder_path_text(f.folder_id),
    f.is_favorite,
    f.created_at
  from files f
  where f.restaurant_id = p_restaurant
    and btrim(coalesce(p_term, '')) <> ''
    and lower(f.file_name) like '%' || lower(btrim(p_term)) || '%'
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- Kirjautuneille, ei kaikille. Julkinen pinta ei kosketa tiedostoihin
-- millään tavalla.

/*
 * revoke ... from public EI RIITÄ.
 *
 * Supabase myöntää anon- ja authenticated-rooleille suoran
 * EXECUTE-oikeuden jokaiseen uuteen public-skeeman funktioon.
 * PUBLIClta peruminen ei kosketa suoraa myöntöä, joten funktio jää
 * kirjautumattoman kutsuttavaksi vaikka revoke näyttäisi tehdyltä.
 *
 * Sama ansa kuin taulujen kohdalla: oikeus on peruttava nimenomaan
 * siltä roolilta jolla se on.
 *
 * Apufunktiot ja kylvöfunktio ovat sisäisiä. Ne kutsutaan vain
 * security definer -funktioista, jotka ajavat omistajan oikeuksin,
 * eikä niillä ole omaa oikeustarkistusta — seed_default_folders
 * loisi kansiot mihin tahansa ravintolaan sille joka sen kutsuisi.
 */
revoke execute on function folder_depth(uuid) from public, anon, authenticated;
revoke execute on function folder_is_descendant(uuid, uuid) from public, anon, authenticated;
revoke execute on function max_folder_depth() from public, anon, authenticated;

revoke execute on function folder_path_text(uuid) from public, anon;
revoke execute on function folder_breadcrumb(uuid) from public, anon;
revoke execute on function search_files(uuid, text, integer) from public, anon;
revoke execute on function create_folder(uuid, uuid, text) from public, anon;
revoke execute on function rename_folder(uuid, text) from public, anon;
revoke execute on function move_folder(uuid, uuid) from public, anon;
revoke execute on function delete_folder(uuid, text) from public, anon;
revoke execute on function reorder_folders(uuid, uuid, uuid[]) from public, anon;
revoke execute on function register_file(uuid, uuid, text, text, text, bigint) from public, anon;
revoke execute on function rename_file(uuid, text) from public, anon;
revoke execute on function move_file(uuid, uuid) from public, anon;
revoke execute on function set_file_favorite(uuid, boolean) from public, anon;
revoke execute on function delete_file(uuid) from public, anon;

grant execute on function folder_path_text(uuid) to authenticated;
grant execute on function folder_breadcrumb(uuid) to authenticated;
grant execute on function search_files(uuid, text, integer) to authenticated;
grant execute on function create_folder(uuid, uuid, text) to authenticated;
grant execute on function rename_folder(uuid, text) to authenticated;
grant execute on function move_folder(uuid, uuid) to authenticated;
grant execute on function delete_folder(uuid, text) to authenticated;
grant execute on function reorder_folders(uuid, uuid, uuid[]) to authenticated;
grant execute on function register_file(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function rename_file(uuid, text) to authenticated;
grant execute on function move_file(uuid, uuid) to authenticated;
grant execute on function set_file_favorite(uuid, boolean) to authenticated;
grant execute on function delete_file(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tiedostomäärät kansioittain
-- ---------------------------------------------------------------------------

/**
 * Montako tiedostoa kussakin kansiossa on suoraan.
 *
 * Ilman tätä kansiolistaus joutuisi lataamaan koko ravintolan
 * tiedostorivit pelkkää lukumäärää varten. Rekursiivinen summa
 * lasketaan selaimessa: kansiopuu on siellä jo valmiina, eikä sitä
 * kannata hakea kahdesti.
 *
 * security invoker: rivitason käytännöt rajaavat tuloksen.
 */
create or replace function folder_counts(p_restaurant uuid)
returns table (folder_id uuid, file_count bigint)
language sql
stable
set search_path = public
as $$
  select f.folder_id, count(*)
  from files f
  where f.restaurant_id = p_restaurant
    and f.folder_id is not null
  group by f.folder_id;
$$;

revoke execute on function folder_counts(uuid) from public, anon;
grant execute on function folder_counts(uuid) to authenticated;
