-- Poistuneiden ominaisuuksien tyhjät tallennussäiliöt pois.
--
-- social (lounaslistan some-kuvat) ja floorplans (pöytäkartan
-- pohjakuvat) jäivät 0096:ssa, koska storage estää suoran poiston.
-- Esto on olemassa orpojen tiedostojen takia; säiliöt ovat tyhjiä,
-- ja se tarkistetaan ennen poistoa. Lupa on voimassa vain tämän
-- transaktion ajan.

do $$
begin
  if exists (select 1 from storage.objects where bucket_id in ('social', 'floorplans')) then
    raise exception 'Säiliöissä on tiedostoja, ei poisteta';
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id in ('social', 'floorplans');
end $$;
