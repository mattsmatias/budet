-- ---------------------------------------------------------------------------
-- 0069 — Lounasruokien järjestäminen raahaamalla
-- ---------------------------------------------------------------------------
--
-- move_lunch_item vaihtaa kaksi vierekkäistä. Se riitti nuolinapeille:
-- yksi painallus, yksi askel. Raahaus pudottaa ruoan monta paikkaa
-- kerralla, ja sarja vaihtoja olisi sarja kyselyitä joista jokin voi
-- epäonnistua kesken — silloin lista jäisi puolittain väärään
-- järjestykseen.
--
-- Tämä ottaa koko päivän järjestyksen kerralla: listan mukainen
-- paikka on uusi sort_order. Yksi kutsu, yksi transaktio, ei
-- välitiloja.
--
-- move_lunch_item jää kantaan mutta jää käyttämättä: myös
-- näppäimistöllä siirtäminen kulkee tästä, koska yksi tapa kirjoittaa
-- järjestys on vähemmän kuin kaksi. Funktion poistaminen olisi oma
-- migraationsa ilman hyötyä, joten se jää siihen.

create or replace function reorder_lunch_items(p_day uuid, p_items uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
begin
  v_restaurant := lunch_day_restaurant(p_day);
  if v_restaurant is null then return; end if;

  if not is_manager(v_restaurant) then
    raise exception 'Vain esihenkilö voi hallita lounaslistaa';
  end if;

  /*
   * Kaikkien annettujen on kuuluttava tähän päivään.
   *
   * Ilman tätä toisen päivän — tai toisen ravintolan — ruoan
   * tunnisteen voisi liittää listaan ja saada sille uuden
   * järjestysnumeron. Rivitason käytäntö estäisi kirjoituksen, mutta
   * tämä funktio on security definer ja ohittaa sen.
   */
  if exists (
    select 1 from unnest(p_items) as x(id)
    where not exists (
      select 1 from lunch_items i
      where i.id = x.id and i.lunch_day_id = p_day
    )
  ) then
    raise exception 'Ruoka ei kuulu tähän päivään';
  end if;

  /*
   * Järjestys luetaan taulukon paikasta.
   *
   * ordinality antaa indeksin, ja se on suoraan uusi sort_order.
   * Puuttuvat rivit — jos listasta jäi jokin pois — säilyttävät oman
   * numeronsa, eikä niitä siirretä minnekään.
   */
  update lunch_items i
  set sort_order = paikka.nro, updated_at = now()
  from unnest(p_items) with ordinality as paikka(id, nro)
  where i.id = paikka.id and i.lunch_day_id = p_day;
end;
$$;

revoke all on function reorder_lunch_items from public, anon;
grant execute on function reorder_lunch_items to authenticated;
