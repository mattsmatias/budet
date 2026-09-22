-- ---------------------------------------------------------------------------
-- 0113 — Yrityksen profiilikuva
-- ---------------------------------------------------------------------------
--
-- Yritys voi asettaa oman kuvansa asetuksista. Kuva nakyy siella missa
-- yritys tunnistetaan: asetuksissa, puhelimen tilikortissa ja tulostetun
-- raportin otsikossa.
--
-- POLKU EIKA OSOITE.
--
-- Sarakkeeseen tallennetaan tallennussailion polku, ei valmis osoite.
-- Sailio on yksityinen ja osoite haetaan allekirjoitettuna pyyntokohtaisesti,
-- kuten kuiteilla ja dokumenttikaapissa. Valmis osoite kannassa vanhenisi
-- tunnissa tai — jos se olisi julkinen — jaisi pysyvasti auki kenelle
-- tahansa jolle se paatyy.
--
-- Vanhaa logo_url-saraketta ei kayteta. Se on super admin -rajapinnan
-- paluutyypissa eika sen poisto olisi tamansuuruisen muutoksen arvoista;
-- nimensa mukaisesti se odottaa osoitetta, ei polkua.

alter table restaurants add column if not exists logo_path text;

comment on column restaurants.logo_path is
  'Yrityksen profiilikuvan polku logos-sailiossa. Osoite haetaan allekirjoitettuna.';

-- ---------------------------------------------------------------------------
-- 1. Sailio
-- ---------------------------------------------------------------------------
--
-- Yksityinen kuten muutkin. Kaksi megatavua riittaa: sovellus pienentaa
-- kuvan nelioksi ennen lahetysta, ja raja on siella missa se estaa
-- vahingon eika tyota.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos', 'logos', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Polku alkaa aina yrityksen tunnisteella, ja paasy ratkaistaan samalla
-- jasenyydella kuin muualla.
drop policy if exists logos_storage_read on storage.objects;
create policy logos_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1]::uuid in (select my_restaurant_ids())
  );

-- Kirjoitus on omistajan oikeus. Kirjanpitaja lukee talouden eika vaihda
-- yrityksen ilmetta.
drop policy if exists logos_storage_write on storage.objects;
create policy logos_storage_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and is_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists logos_storage_update on storage.objects;
create policy logos_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and is_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists logos_storage_delete on storage.objects;
create policy logos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and is_owner((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- 2. Polun asettaminen
-- ---------------------------------------------------------------------------
--
-- Oma funktionsa eika update_restaurant-kutsun lisakentta: kuvan vaihto
-- on eri tapahtuma kuin nimen muutos, ja lokiin kuuluu oma rivinsa.
--
-- Polku tarkistetaan palvelimella. Ilman tarkistusta omistaja voisi
-- osoittaa oman yrityksensa kuvan toisen yrityksen kansioon ja lukea
-- sen allekirjoitetulla osoitteella — sailion lukupolitiikka paastaa
-- lapi vain omat kansiot, mutta polun kirjoittaja on tassa se joka
-- valitsee kansion.

create or replace function set_restaurant_logo(
  p_restaurant uuid,
  p_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_old text;
  v_name text;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi vaihtaa yrityksen kuvan.'
      using errcode = '42501';
  end if;

  if p_path is not null and p_path !~ ('^' || p_restaurant::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Kuvan polku ei kuulu talle yritykselle.'
      using errcode = '22023';
  end if;

  select logo_path, name into v_old, v_name
  from restaurants where id = p_restaurant;

  update restaurants set logo_path = p_path where id = p_restaurant;

  perform write_audit(
    p_restaurant,
    case when p_path is null then 'deleted' else 'updated' end,
    'restaurant',
    p_restaurant,
    v_name,
    case
      when p_path is null then 'Yrityksen kuva poistettiin'
      when v_old is null then 'Yrityksen kuva lisattiin'
      else 'Yrityksen kuva vaihdettiin'
    end,
    null,
    null,
    false
  );
end;
$function$;

revoke all on function set_restaurant_logo from public;
grant execute on function set_restaurant_logo to authenticated;
