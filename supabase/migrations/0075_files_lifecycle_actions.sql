-- ---------------------------------------------------------------------------
-- 0075 — Elinkaaren toiminnot
-- ---------------------------------------------------------------------------
--
-- Poisto muuttuu peruttavaksi, joten sen paluuarvo muuttuu: aiemmin se
-- palautti storage-polut heti poistettavaksi, nyt se ei poista mitään
-- storagesta. Polut palautuvat vasta lopullisessa siivouksessa.
--
-- Paluuarvon muutos vaatii funktion pudottamisen ensin — create or
-- replace ei voi muuttaa sitä.

drop function if exists delete_file(uuid);
drop function if exists delete_folder(uuid, text);

/*
 * Vanha register_file jaisi rinnalle.
 *
 * Uusi versio saa kolme valinnaista parametria, mika tekee siita eri
 * funktion. Kuuden parametrin kutsu osuisi molempiin, ja PostgREST
 * kieltaytyisi valitsemasta -- lataus lakkaisi toimimasta.
 */
drop function if exists register_file(uuid, uuid, text, text, text, bigint);

/* Paluutyyppi muuttuu: expires_on mukaan hakutulokseen. */
drop function if exists search_files(uuid, text, integer);

-- ---------------------------------------------------------------------------
-- Poisto roskakoriin
-- ---------------------------------------------------------------------------

create or replace function delete_file(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_file;

  perform write_audit(
    v_restaurant, 'deleted', 'file', p_file, v_name,
    'Siirsi tiedoston ' || v_name || ' roskakoriin'
  );
end;
$$;

/**
 * Monta tiedostoa kerralla.
 *
 * Kaksisataa kuittia väärässä kansiossa on ero käyttökelpoisen ja
 * käyttökelvottoman välillä. Silmukka sovelluksesta olisi kaksisataa
 * kutsua, joista osa voisi onnistua ja osa ei.
 *
 * Jokainen tunniste tarkistetaan erikseen: yksikin vieras rivi
 * joukossa kaataa koko kutsun eikä poista mitään.
 */
create or replace function delete_files(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any (p_ids) and deleted_at is null;

  get diagnostics v_count = row_count;

  perform write_audit(
    v_restaurant, 'deleted', 'file', null, null,
    'Siirsi ' || v_count || ' tiedostoa roskakoriin'
  );
end;
$$;

/**
 * Kansion poisto.
 *
 * p_mode = 'keep'     — tiedostot siirtyvät juureen, kansio roskakoriin
 * p_mode = 'contents' — myös tiedostot roskakoriin
 *
 * Alikansiot seuraavat aina mukana: käyttäjä näkee kansion
 * sisältöineen yhtenä asiana.
 */
create or replace function delete_folder(p_folder uuid, p_mode text default 'keep')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_count integer := 0;
  v_ids uuid[];
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder and deleted_at is null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_mode not in ('keep', 'contents') then
    raise exception 'Tuntematon poistotapa';
  end if;

  /*
   * Haara taulukkoon.
   *
   * Väliaikainen taulu eläisi istunnon yli ja tekisi kahdesta
   * peräkkäisestä poistosta toisistaan riippuvia.
   */
  with recursive tree as (
    select id from folders where id = p_folder
    union all
    select f.id from folders f join tree t on f.parent_folder_id = t.id
  )
  select array_agg(id) into v_ids from tree;

  if p_mode = 'contents' then
    update files
    set deleted_at = now(), deleted_by = auth.uid()
    where folder_id = any (v_ids) and deleted_at is null;

    get diagnostics v_count = row_count;
  else
    /* Tiedostot jäävät kaappiin, mutta kansiota ei enää ole. */
    update files
    set folder_id = null
    where folder_id = any (v_ids) and deleted_at is null;
  end if;

  update folders
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any (v_ids) and deleted_at is null;

  perform write_audit(
    v_restaurant, 'deleted', 'folder', p_folder, v_name,
    case
      when p_mode = 'contents'
        then 'Siirsi kansion ' || v_name || ' sisältöineen roskakoriin (' || v_count || ' tiedostoa)'
      else 'Siirsi kansion ' || v_name || ' roskakoriin'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Palautus
-- ---------------------------------------------------------------------------

/**
 * Tiedosto takaisin.
 *
 * Jos alkuperäinen kansio on yhä roskakorissa, tiedosto palautuu
 * juureen. Vaihtoehto olisi palauttaa kansio mukana, mutta silloin
 * yhden tiedoston palautus toisi takaisin koko kansion jota kukaan ei
 * pyytänyt.
 */
create or replace function restore_file(p_file uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is not null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files f
  set deleted_at = null,
      deleted_by = null,
      folder_id = case
        when f.folder_id is null then null
        when exists (
          select 1 from folders d
          where d.id = f.folder_id and d.deleted_at is null
        ) then f.folder_id
        else null
      end
  where f.id = p_file;

  perform write_audit(
    v_restaurant, 'updated', 'file', p_file, v_name,
    'Palautti tiedoston ' || v_name
  );
end;
$$;

/**
 * Kansio takaisin.
 *
 * Vain tämä kansio, ei sen alikansioita: haara palautuu ylhäältä alas
 * sitä mukaa kuin käyttäjä palauttaa. Jos emo on yhä roskakorissa,
 * kansio nousee juureen — muuten se palaisi paikkaan jota ei näy.
 */
create or replace function restore_folder(p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, name into v_restaurant, v_name
  from folders where id = p_folder and deleted_at is not null;

  if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update folders f
  set deleted_at = null,
      deleted_by = null,
      parent_folder_id = case
        when f.parent_folder_id is null then null
        when exists (
          select 1 from folders p
          where p.id = f.parent_folder_id and p.deleted_at is null
        ) then f.parent_folder_id
        else null
      end
  where f.id = p_folder;

  perform write_audit(
    v_restaurant, 'updated', 'folder', p_folder, v_name,
    'Palautti kansion ' || v_name
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lopullinen siivous
-- ---------------------------------------------------------------------------

/**
 * Roskakorin tyhjennys.
 *
 * p_days = 30  — vanhentuneet, ajetaan roskakoria avattaessa
 * p_days = 0   — kaikki, käyttäjän pyynnöstä
 *
 * Palauttaa storage-polut, koska kanta ei ylety storageen. Ne
 * palautetaan tässä eikä jätetä kutsujan haettavaksi erikseen: silloin
 * ne olisivat jo poissa.
 */
create or replace function purge_trash(p_restaurant uuid, p_days integer default 30)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
   * Nolla tarkoittaa kaikkea, ei "vanhempaa kuin nyt".
   *
   * deleted_at < now() olisi epatosi juuri poistetulle rivilla, koska
   * now() on transaktion alkuhetki ja poisto tapahtui siina samassa.
   * Kayttajan "tyhjenna roskakori" ei siis tyhjentaisi sita mita han
   * juuri poisti.
   */
  v_days integer := greatest(coalesce(p_days, 30), 0);
  v_paths text[];
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  with poistetut as (
    delete from files
    where restaurant_id = p_restaurant
      and deleted_at is not null
      and (v_days = 0 or deleted_at < now() - make_interval(days => v_days))
    returning storage_path
  )
  select array_agg(storage_path) into v_paths from poistetut;

  delete from folders
  where restaurant_id = p_restaurant
    and deleted_at is not null
    and (v_days = 0 or deleted_at < now() - make_interval(days => v_days));

  return query select unnest(coalesce(v_paths, array[]::text[]));
end;
$$;

-- ---------------------------------------------------------------------------
-- Voimassaolo
-- ---------------------------------------------------------------------------

create or replace function set_file_expiry(p_file uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set expires_on = p_date where id = p_file;

  perform write_audit(
    v_restaurant, 'updated', 'file', p_file, v_name,
    case
      when p_date is null then 'Poisti voimassaolon tiedostolta ' || v_name
      else 'Asetti tiedoston ' || v_name || ' voimassaoloksi ' || to_char(p_date, 'DD.MM.YYYY')
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Liitokset
-- ---------------------------------------------------------------------------

/**
 * Tiedosto kiinni toimittajaan tai kuittiin.
 *
 * Molemmat päät tarkistetaan samasta ravintolasta, kuten siirroissa.
 * Ilman sitä oman tiedoston voisi liittää toisen ravintolan kuittiin
 * pelkällä tunnisteella, ja liitos näkyisi siellä.
 */
create or replace function link_file(
  p_file uuid,
  p_supplier uuid,
  p_receipt uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_name text;
  v_other uuid;
begin
  select restaurant_id, file_name into v_restaurant, v_name
  from files where id = p_file and deleted_at is null;

  if v_restaurant is null then raise exception 'Tiedostoa ei löydy'; end if;
  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_supplier is not null then
    select restaurant_id into v_other from suppliers where id = p_supplier;
    if v_other is distinct from v_restaurant then
      raise exception 'Toimittaja on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_receipt is not null then
    select restaurant_id into v_other from receipts where id = p_receipt;
    if v_other is distinct from v_restaurant then
      raise exception 'Kuitti on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files
  set supplier_id = p_supplier, receipt_id = p_receipt
  where id = p_file;
end;
$$;

-- ---------------------------------------------------------------------------
-- Joukkotoiminnot
-- ---------------------------------------------------------------------------

create or replace function move_files(p_ids uuid[], p_folder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
  v_target uuid;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_folder is not null then
    select restaurant_id into v_target
    from folders where id = p_folder and deleted_at is null;

    if v_target is null then raise exception 'Kohdekansiota ei löydy'; end if;

    if v_target <> v_restaurant then
      raise exception 'Kohdekansio on toisessa ravintolassa.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  update files set folder_id = p_folder
  where id = any (p_ids) and deleted_at is null;

  get diagnostics v_count = row_count;

  perform write_audit(
    v_restaurant, 'moved', 'file', null, null,
    'Siirsi ' || v_count || ' tiedostoa → ' ||
      coalesce(nullif(folder_path_text(p_folder), ''), 'Tiedostot')
  );
end;
$$;

create or replace function set_files_favorite(p_ids uuid[], p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_count integer;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;

  /*
   * min() ei toimi uuid-tyypille.
   *
   * Tarkoitus on vain todeta etta kaikki rivit ovat samasta
   * ravintolasta ja saada se yksi tunniste talteen.
   */
  select count(distinct restaurant_id), (array_agg(distinct restaurant_id))[1]
  into v_count, v_restaurant
  from files
  where id = any (p_ids) and deleted_at is null;

  if v_count <> 1 then raise exception 'Tiedostoja ei löydy'; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  update files set is_favorite = coalesce(p_value, false)
  where id = any (p_ids) and deleted_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Poistetut pois normaaleista näkymistä
-- ---------------------------------------------------------------------------

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
    and f.deleted_at is null
  group by f.folder_id;
$$;

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
  created_at timestamptz,
  expires_on date
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
    f.created_at,
    f.expires_on
  from files f
  where f.restaurant_id = p_restaurant
    and f.deleted_at is null
    and btrim(coalesce(p_term, '')) <> ''
    and lower(f.file_name) like '%' || lower(btrim(p_term)) || '%'
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

/**
 * Kirjaus lisätiedoin.
 *
 * Voimassaolo ja liitokset ovat valinnaisia parametreja eivätkä omia
 * kutsujaan: lataus tietää ne jo, ja erillinen kutsu olisi toinen
 * verkkokierros jonka epäonnistuminen jättäisi tiedoston puolitiehen.
 */
create or replace function register_file(
  p_restaurant uuid,
  p_folder uuid,
  p_name text,
  p_path text,
  p_type text,
  p_size bigint,
  p_expires date default null,
  p_supplier uuid default null,
  p_receipt uuid default null
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
    select restaurant_id into v_restaurant
    from folders where id = p_folder and deleted_at is null;
    if v_restaurant is null then raise exception 'Kansiota ei löydy'; end if;
  end if;

  if v_restaurant is null or not is_manager(v_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if split_part(p_path, '/', 1) <> v_restaurant::text then
    raise exception 'Polku ei kuulu tälle ravintolalle';
  end if;

  insert into files (
    restaurant_id, folder_id, file_name, storage_path,
    file_type, file_size, uploaded_by, expires_on, supplier_id, receipt_id
  )
  values (
    v_restaurant, p_folder, v_name, btrim(p_path),
    coalesce(nullif(btrim(p_type), ''), 'application/octet-stream'),
    p_size, auth.uid(), p_expires, p_supplier, p_receipt
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

-- ---------------------------------------------------------------------------
-- Oikeudet
-- ---------------------------------------------------------------------------
--
-- from public ei riitä: Supabase myöntää anonille suoran oikeuden.

revoke execute on function delete_file(uuid) from public, anon;
revoke execute on function delete_files(uuid[]) from public, anon;
revoke execute on function delete_folder(uuid, text) from public, anon;
revoke execute on function restore_file(uuid) from public, anon;
revoke execute on function restore_folder(uuid) from public, anon;
revoke execute on function purge_trash(uuid, integer) from public, anon;
revoke execute on function set_file_expiry(uuid, date) from public, anon;
revoke execute on function link_file(uuid, uuid, uuid) from public, anon;
revoke execute on function move_files(uuid[], uuid) from public, anon;
revoke execute on function set_files_favorite(uuid[], boolean) from public, anon;
revoke execute on function folder_counts(uuid) from public, anon;
revoke execute on function search_files(uuid, text, integer) from public, anon;
revoke execute on function register_file(uuid, uuid, text, text, text, bigint, date, uuid, uuid) from public, anon;

grant execute on function delete_file(uuid) to authenticated;
grant execute on function delete_files(uuid[]) to authenticated;
grant execute on function delete_folder(uuid, text) to authenticated;
grant execute on function restore_file(uuid) to authenticated;
grant execute on function restore_folder(uuid) to authenticated;
grant execute on function purge_trash(uuid, integer) to authenticated;
grant execute on function set_file_expiry(uuid, date) to authenticated;
grant execute on function link_file(uuid, uuid, uuid) to authenticated;
grant execute on function move_files(uuid[], uuid) to authenticated;
grant execute on function set_files_favorite(uuid[], boolean) to authenticated;
grant execute on function folder_counts(uuid) to authenticated;
grant execute on function search_files(uuid, text, integer) to authenticated;
grant execute on function register_file(uuid, uuid, text, text, text, bigint, date, uuid, uuid) to authenticated;
