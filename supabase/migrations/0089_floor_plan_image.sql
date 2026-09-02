-- 0089 – Salin pohjapiirros kuvana
--
-- Ravintolalla on pohjapiirros: arkkitehdin kuva, paloturvallisuuden
-- kaavio tai käsin piirretty luonnos. Pöytien raahaaminen tyhjälle
-- ruudukolle on arvailua siitä missä seinät ovat; kuvan päälle
-- raahattuna se on sen merkitsemistä mikä on jo tiedossa.
--
-- ---------------------------------------------------------------------
-- YKSI KUVA RAVINTOLAA KOHTI
-- ---------------------------------------------------------------------
--
-- Kartta on yksi laatikko, jonka sisällä alueet vaihtavat näkyviä
-- pöytiä. Kuva alueittain vaatisi laatikon alueittain, eikä sitä ole.
-- Useamman salin oma pohjapiirros on siis oma muutoksensa, ei tämän
-- taulun rivi.
--
-- ---------------------------------------------------------------------
-- KUVASUHDE TALLENNETAAN
-- ---------------------------------------------------------------------
--
-- Kartan laatikko on ollut kiinteä 3:2. Pohjapiirros ei ole, ja
-- venytetty pohjapiirros on väärä pohjapiirros: neliön muotoinen sali
-- näyttäisi siinä leveältä ja pöytä osuisi seinän läpi.
--
-- Kun kuva on, laatikko ottaa kuvan muodon. Pöytien sijainnit ovat
-- prosentteja, joten ne pysyvät samassa kohdassa salia.
--
-- ---------------------------------------------------------------------
-- TIEDOSTO ON YKSITYINEN
-- ---------------------------------------------------------------------
--
-- Pohjapiirros kertoo missä ovet ja hätäpoistumistiet ovat. Se ei
-- kuulu julkiseen osoitteeseen, joten ämpäri on yksityinen ja kuva
-- näytetään allekirjoitetulla linkillä kuten muutkin ravintolan
-- dokumentit.

-- ---------------------------------------------------------------------------
-- Taulu
-- ---------------------------------------------------------------------------

create table if not exists public.floor_plan_images (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete cascade,
  storage_path text not null,
  /* Kuvan omat mitat pikseleinä. Vain suhde kiinnostaa. */
  width int not null check (width > 0),
  height int not null check (height > 0),
  /*
   * Kuvan peittävyys kartalla.
   *
   * Pohjapiirros on tausta eikä sisältö: täydellä voimakkuudella se
   * kilpailee pöytien kanssa siitä kumpaa katsotaan. Säädettävä, koska
   * kuvat ovat eri vahvuisia — valokuva paperista on tummempi kuin
   * viivapiirros.
   */
  opacity numeric(3, 2) not null default 0.45
    check (opacity >= 0.05 and opacity <= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.floor_plan_images enable row level security;

drop policy if exists floor_plan_images_read on public.floor_plan_images;
create policy floor_plan_images_read on public.floor_plan_images
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

/*
 * Kirjoitus vain funktion kautta.
 *
 * Ei insert- eikä update-käytäntöä: tallennus kulkee
 * save_floor_plan_image-funktion läpi, joka tarkistaa esihenkilön ja
 * kirjoittaa muutoslokin. Suora oikeus tauluun olisi toinen reitti
 * samaan riviin, ja toinen reitti on se joka unohtuu tarkistaa.
 */

-- ---------------------------------------------------------------------------
-- Tallennus
-- ---------------------------------------------------------------------------

create or replace function public.save_floor_plan_image(
  p_restaurant uuid,
  p_path text,
  p_width int,
  p_height int,
  p_opacity numeric default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_vanha text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_path is null or length(trim(p_path)) = 0 then
    return json_build_object('ok', false, 'error', 'path');
  end if;

  /*
   * Polku alkaa ravintolan tunnisteella.
   *
   * Sama sääntö kuin tallennuskäytännöissä. Ilman tätä kutsuja voisi
   * osoittaa rivin toisen ravintolan tiedostoon: rivin lukisi vain
   * oma väki, mutta allekirjoitettu linkki tehtäisiin vieraaseen
   * kuvaan.
   */
  if split_part(p_path, '/', 1) <> p_restaurant::text then
    return json_build_object('ok', false, 'error', 'path');
  end if;

  if p_width is null or p_height is null or p_width <= 0 or p_height <= 0 then
    return json_build_object('ok', false, 'error', 'size');
  end if;

  select storage_path into v_vanha
  from floor_plan_images where restaurant_id = p_restaurant;

  insert into floor_plan_images (
    restaurant_id, storage_path, width, height, opacity, updated_by
  )
  values (
    p_restaurant, trim(p_path), p_width, p_height,
    coalesce(p_opacity, 0.45), auth.uid()
  )
  on conflict (restaurant_id) do update set
    storage_path = excluded.storage_path,
    width = excluded.width,
    height = excluded.height,
    opacity = excluded.opacity,
    updated_at = now(),
    updated_by = excluded.updated_by;

  perform write_audit(
    p_restaurant, 'floorplan.image', 'restaurant', p_restaurant, null,
    case when v_vanha is null
         then 'Lisäsi pohjapiirroksen'
         else 'Vaihtoi pohjapiirroksen' end,
    null, null, false
  );

  /*
   * Vanha tiedosto palautetaan poistettavaksi.
   *
   * Kanta ei osaa poistaa tallennustilasta, ja korvattu kuva jäisi
   * muuten maksamaan tilaa ikuisesti. Kutsuja poistaa sen — ja jos se
   * epäonnistuu, rivi osoittaa silti uuteen kuvaan.
   */
  return json_build_object(
    'ok', true,
    'previousPath', case when v_vanha = trim(p_path) then null else v_vanha end
  );
end;
$fn$;

create or replace function public.set_floor_plan_opacity(
  p_restaurant uuid,
  p_opacity numeric
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if p_opacity is null or p_opacity < 0.05 or p_opacity > 1 then
    return json_build_object('ok', false, 'error', 'opacity');
  end if;

  update floor_plan_images
  set opacity = p_opacity, updated_at = now(), updated_by = auth.uid()
  where restaurant_id = p_restaurant;

  if not found then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  /* Ei muutoslokia: peittävyys on katseluasetus, ei salin tieto. */
  return json_build_object('ok', true);
end;
$fn$;

create or replace function public.delete_floor_plan_image(
  p_restaurant uuid
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_path text;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  select storage_path into v_path
  from floor_plan_images where restaurant_id = p_restaurant;

  if v_path is null then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  delete from floor_plan_images where restaurant_id = p_restaurant;

  perform write_audit(
    p_restaurant, 'floorplan.image', 'restaurant', p_restaurant, null,
    'Poisti pohjapiirroksen', null, null, false
  );

  return json_build_object('ok', true, 'previousPath', v_path);
end;
$fn$;

revoke all on function public.save_floor_plan_image(uuid, text, int, int, numeric)
  from anon;
revoke all on function public.set_floor_plan_opacity(uuid, numeric) from anon;
revoke all on function public.delete_floor_plan_image(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Tallennustila
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'floorplans', 'floorplans', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/*
 * Luku koko väelle, kirjoitus esihenkilölle.
 *
 * Tarjoilija näkee kartan salinäkymässä ja kartta on kuvan päällä,
 * joten lukuoikeus on sama kuin karttaan. Kuvan vaihtaminen on salin
 * muuttamista, ja se on esihenkilön työtä.
 */
drop policy if exists floorplans_storage_read on storage.objects;
create policy floorplans_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'floorplans'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

drop policy if exists floorplans_storage_write on storage.objects;
create policy floorplans_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists floorplans_storage_update on storage.objects;
create policy floorplans_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );

drop policy if exists floorplans_storage_delete on storage.objects;
create policy floorplans_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'floorplans'
    and is_manager((storage.foldername(name))[1]::uuid)
  );
