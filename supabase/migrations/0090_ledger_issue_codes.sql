-- 0090 – Kirjanpidon huomiot koodeina, ei lauseina
--
-- ledger_month_status rakensi "Mitä sinun pitää tehdä" -listan otsikot
-- ja selitteet valmiiksi suomeksi:
--
--   'title', 'Kirjausesityksiä odottaa'
--   'detail', v_esityksia || ' esitystä odottaa hyväksyntää.'
--
-- Ne näkyivät suomeksi myös englannin, ruotsin, tanskan, turkin ja
-- viron käyttäjille. Kanta ei tiedä kenelle se vastaa eikä millä
-- kielellä, eikä sen kuulukaan tietää.
--
-- ---------------------------------------------------------------------
-- KOODI ON TIETO, LAUSE ON ESITYSTAPA
-- ---------------------------------------------------------------------
--
-- Funktio palautti jo valmiiksi kentän 'kind' jokaiselle huomiolle.
-- Kaikki mitä lauseeseen tarvitaan on siis ollut olemassa: koodi,
-- vakavuus, lukumäärä ja rahaero. Lause kootaan sovelluksessa, jossa
-- käyttäjän kieli tiedetään.
--
-- Myös taivutus siirtyy sinne. Kanta valitsi yksikön ja monikon
-- käsin — ' kuitti' tai ' kuittia' — ja se sääntö on eri jokaisella
-- kielellä.
--
-- title ja detail POISTETAAN eikä jätetä varmuuden vuoksi. Jätettynä
-- ne olisivat kaksi kenttää joita joku käyttää vahingossa, ja vika
-- palaisi hiljaa takaisin.
--
-- Muu funktio on ennallaan: tila, luvut ja ALV lasketaan kuten ennen.

create or replace function public.ledger_month_status(
  p_restaurant uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_alku date := date_trunc('month', p_month)::date;
  v_loppu date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_alv jsonb;
  v_lukittu boolean;
  v_esityksia int; v_kirjattuja int; v_hylattyja int;
  v_kuitteja_ilman int; v_paivia_ilman int;
  v_myyntiero bigint; v_alvero bigint;
  v_ongelmat jsonb := '[]'::jsonb;
  v_tila text;
begin
  if not can_read_finance(p_restaurant) then raise exception 'Ei oikeutta'; end if;

  v_lukittu := exists (select 1 from closed_months
                       where restaurant_id = p_restaurant and month = v_alku);

  select count(*) filter (where status = 'proposed'),
         count(*) filter (where status = 'posted'),
         count(*) filter (where status = 'rejected')
    into v_esityksia, v_kirjattuja, v_hylattyja
  from ledger_entries
  where restaurant_id = p_restaurant and entry_date between v_alku and v_loppu;

  select count(*) into v_kuitteja_ilman from receipts rc
  where rc.restaurant_id = p_restaurant and rc.receipt_date between v_alku and v_loppu
    and not exists (select 1 from ledger_entries e
      where e.restaurant_id = p_restaurant and e.source_type = 'receipt' and e.source_id = rc.id);

  select count(*) into v_paivia_ilman from daily_sales ds
  where ds.restaurant_id = p_restaurant and ds.sales_date between v_alku and v_loppu
    and not exists (select 1 from ledger_entries e
      where e.restaurant_id = p_restaurant and e.source_type = 'daily_sales' and e.source_id = ds.id);

  v_alv := ledger_vat_summary(p_restaurant, v_alku);
  v_myyntiero := (v_alv->>'salesGrossSource')::bigint - (v_alv->>'salesGrossLedger')::bigint;
  v_alvero := (v_alv->>'salesVatSource')::bigint - (v_alv->>'salesVatLedger')::bigint;

  if v_kuitteja_ilman > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'receipts_missing', 'severity', 'warning',
      'count', v_kuitteja_ilman);
  end if;

  if v_paivia_ilman > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'sales_missing', 'severity', 'warning',
      'count', v_paivia_ilman);
  end if;

  if v_esityksia > 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'proposals', 'severity', 'info',
      'count', v_esityksia);
  end if;

  /*
   * Täsmäämättömyydet ovat aina yksi huomio.
   *
   * count on lukumäärä listan oikeassa reunassa, ja "yksi ero" on
   * oikea luku: ero on yksi asia jonka joku selvittää, ei kokoelma.
   * Ero itse kulkee erikseen sentteinä.
   */
  if v_myyntiero <> 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'sales_mismatch', 'severity', 'critical', 'count', 1,
      'differenceCents', v_myyntiero);
  end if;

  if v_alvero <> 0 then
    v_ongelmat := v_ongelmat || jsonb_build_object(
      'kind', 'vat_mismatch', 'severity', 'critical', 'count', 1,
      'differenceCents', v_alvero);
  end if;

  if v_lukittu then
    v_tila := 'locked';
  elsif v_myyntiero <> 0 or v_alvero <> 0 then
    v_tila := 'review';
  elsif v_esityksia > 0 or v_kuitteja_ilman > 0 or v_paivia_ilman > 0 then
    v_tila := 'open';
  elsif v_kirjattuja > 0 then
    v_tila := 'ready';
  else
    v_tila := 'open';
  end if;

  return jsonb_build_object(
    'month', to_char(v_alku, 'YYYY-MM'),
    'status', v_tila,
    'proposed', v_esityksia,
    'posted', v_kirjattuja,
    'rejected', v_hylattyja,
    'receiptsMissing', v_kuitteja_ilman,
    'salesDaysMissing', v_paivia_ilman,
    'vat', v_alv,
    'issues', v_ongelmat
  );
end;
$fn$;

revoke all on function public.ledger_month_status(uuid, date) from anon;
