-- ---------------------------------------------------------------------------
-- 0059 — Kukaan ei korota itseään ylläpitäjäksi
-- ---------------------------------------------------------------------------
--
-- OIKEUKSIEN LAAJENNUSAUKKO.
--
-- profiles-taulun päivityskäytäntö on:
--   using (id = auth.uid()) with check (id = auth.uid())
--
-- Rivikäytäntö rajaa rivejä, ei sarakkeita. Sama käytäntö salli siis
-- myös is_super_admin-sarakkeen kirjoittamisen, ja kuka tahansa
-- kirjautunut käyttäjä — työntekijä mukaan lukien — olisi voinut
-- kutsua suoraan API:a:
--
--   update profiles set is_super_admin = true where id = <oma id>
--
-- ja saada järjestelmätason oikeudet jokaiseen ravintolaan.
--
-- Sarake on ollut kannassa ennen Developer Consolea, mutta mikään ei
-- lukenut sitä, joten aukko ei ollut hyödynnettävissä. Konsoli teki
-- siitä oikean: nyt lippu ratkaisee pääsyn kaikkien asiakkaiden
-- tietoihin.
--
-- KAKSI LUKKOA, KOSKA NE PETTÄVÄT ERI TAVOIN.
--
-- Sarakeoikeus katkaisee API-polun: PostgREST ei pysty kirjoittamaan
-- saraketta lainkaan, eikä kutsu edes yritä.
--
-- Liipaisin kattaa kaiken muun. Se pysäyttäisi myös security definer
-- -funktion joka vahingossa päivittäisi profiilirivin kokonaisena ja
-- veisi lipun mukanaan.

revoke update (is_super_admin) on public.profiles from anon, authenticated;

create or replace function guard_super_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_super_admin, false) is distinct from coalesce(old.is_super_admin, false) then
    /*
     * auth.uid() on null kun ajetaan migraatiosta tai palvelinavaimella.
     *
     * Silloin kyse on hallitusta ylläpitotoimesta eikä käyttäjän
     * pyynnöstä, ja se sallitaan — muuten ensimmäistä ylläpitäjää ei
     * voisi nimetä lainkaan, koska nimeäminen vaatisi ylläpitäjän joka
     * ei vielä ole olemassa.
     */
    if auth.uid() is not null and not current_user_is_super_admin() then
      raise exception 'Jarjestelmatason oikeutta ei voi asettaa itselle';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_super_admin on public.profiles;
create trigger profiles_guard_super_admin
  before update on public.profiles
  for each row
  execute function guard_super_admin_flag();

comment on function guard_super_admin_flag is
  'Estaa is_super_admin-lipun asettamisen ilman olemassa olevaa yllapitajan oikeutta.';
