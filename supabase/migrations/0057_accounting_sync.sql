-- ---------------------------------------------------------------------------
-- 0057 — Tilikartta ja automaattinen johtaminen lähteistä
-- ---------------------------------------------------------------------------
--
-- KÄYTTÄJÄ EI SYÖTÄ MITÄÄN UUDELLEEN.
--
-- Kuitit ja myyntipäivät ovat jo Budetissa. Kirjanpito lukee ne ja
-- muodostaa kirjausesitykset. Käyttäjä tarkistaa poikkeamat, ei kopioi
-- rivejä.
--
-- ESITYS EI OLE KIRJAUS.
--
-- Johdettu tosite syntyy tilassa 'proposed'. Se näkyy, se on
-- tasapainossa ja siitä näkee mistä se tulee — mutta se ei ole
-- kirjanpitoa ennen kuin joku hyväksyy sen. Automaatti ei kirjaa
-- ohi ihmisen.
--
-- PUUTTUVAA TIETOA EI KEKSITÄ.
--
-- Jos kohdistus puuttuu tai kuitti on kesken, tosite jää tekemättä ja
-- syy palautuu raportissa. Arvattu tili olisi pahempi kuin puuttuva
-- tosite: puuttuvan huomaa, arvatun ei.

-- ---------------------------------------------------------------------------
-- Perustilikartta
-- ---------------------------------------------------------------------------
--
-- Suomalaisen ravintolan tavanomainen runko. Tämä on lähtökohta jonka
-- ravintola muokkaa, ei väite oikeasta tilikartasta: kirjanpitäjällä
-- on oma näkemyksensä ja tilit ovat ravintolakohtaisia.
--
-- is_system merkitsee tilit joihin kohdistukset osoittavat. Ne saa
-- nimetä uudelleen mutta ei poistaa jalan alta.

create or replace function ledger_seed(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $seed$
declare
  v_luotu integer := 0;
  v_kohdistuksia integer := 0;
  v_id uuid;
  v_rivi record;
  v_ryhma record;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilo voi luoda tilikartan';
  end if;

  for v_rivi in
    select * from (values
      -- Vastaavaa
      ('1750', 'Kassatilitykset',        'asset',     null::numeric),
      ('1763', 'Arvonlisaverosaaminen',  'asset',     null),
      ('1900', 'Kateiskassa',            'asset',     null),
      ('1910', 'Pankkitili',             'asset',     null),
      ('1920', 'Korttisaatavat',         'asset',     null),
      -- Vastattavaa
      ('2460', 'Arvonlisaverovelka',     'liability', null),
      ('2870', 'Ostovelat',              'liability', null),
      -- Tuotot
      ('3000', 'Ravintolamyynti',        'revenue',   null),
      ('3010', 'Alkoholimyynti',         'revenue',   null),
      ('3020', 'Muu myynti',             'revenue',   null),
      -- Kulut
      ('4000', 'Elintarvikeostot',       'expense',   null),
      ('4010', 'Alkoholiostot',          'expense',   null),
      ('4020', 'Alkoholittomat juomat',  'expense',   null),
      ('4100', 'Keittiotarvikkeet',      'expense',   null),
      ('4110', 'Pakkaustarvikkeet',      'expense',   null),
      ('4120', 'Siivoustarvikkeet',      'expense',   null),
      ('4200', 'Kuljetus',               'expense',   null),
      ('4900', 'Muut kulut',             'expense',   null),
      ('5000', 'Henkilostokulut',        'expense',   null)
    ) as t(number, name, type, vat_rate)
  loop
    insert into ledger_accounts (restaurant_id, number, name, type, vat_rate, is_system, sort_order)
    values (p_restaurant, v_rivi.number, v_rivi.name, v_rivi.type::ledger_account_type,
            v_rivi.vat_rate, true, v_rivi.number::integer)
    on conflict (restaurant_id, number) do nothing;

    if found then v_luotu := v_luotu + 1; end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- Kohdistukset
  -- -------------------------------------------------------------------------

  -- Kulukategoria -> kulutili. Avaimet ovat expense_category-enumin arvot.
  for v_rivi in
    select * from (values
      ('food',             '4000'),
      ('alcohol',          '4010'),
      ('soft_drinks',      '4020'),
      ('kitchen_supplies', '4100'),
      ('packaging',        '4110'),
      ('cleaning',         '4120'),
      ('transport',        '4200'),
      ('staff',            '5000'),
      ('other',            '4900')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'expense_category', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  -- Maksutapa -> vastatili.
  for v_rivi in
    select * from (values
      ('card',    '1920'),
      ('cash',    '1900'),
      ('invoice', '2870'),
      ('unknown', '1910')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'payment_method', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  -- Verotilit.
  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '1763';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_purchases', v_id) on conflict do nothing;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '2460';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_sales', v_id) on conflict do nothing;

  /*
   * Myyntiryhmä -> myyntitili.
   *
   * Ryhmät ovat ravintolan omia rivejä eivätkä enumia, joten
   * kohdistus tehdään tunnisteella. Nimi ratkaisee oletuksen:
   * alkoholi omalle tililleen, muut ravintolamyyntiin. Väärin
   * arvannut kohdistus on yhden klikkauksen päässä korjattavissa,
   * puuttuva kohdistus estäisi koko päivän kirjautumisen.
   */
  for v_ryhma in
    select id, name from sales_groups where restaurant_id = p_restaurant and active
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant
       and number = case
         when lower(v_ryhma.name) like '%alkoholi%' then '3010'
         when lower(v_ryhma.name) like '%muu%'      then '3020'
         else '3000'
       end;

    insert into ledger_mappings (restaurant_id, kind, ref_id, account_id)
    values (p_restaurant, 'sales_group', v_ryhma.id, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  return jsonb_build_object('accounts', v_luotu, 'mappings', v_kohdistuksia);
end;
$seed$;

revoke all on function ledger_seed from public;
grant execute on function ledger_seed to authenticated;

-- ---------------------------------------------------------------------------
-- Tilikausi päivämäärälle
-- ---------------------------------------------------------------------------
--
-- Kuukausi määräytyy tapahtuman päivästä (vaatimus 6), joten myös
-- tilikausi. Jos kautta ei ole, luodaan kalenterivuosi: se on
-- yleisin ja ravintola voi muuttaa rajat jälkikäteen.

create or replace function ledger_year_for(p_restaurant uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $vuosi$
declare
  v_id uuid;
begin
  select id into v_id from fiscal_years
   where restaurant_id = p_restaurant
     and p_date between starts_on and ends_on;

  if v_id is not null then
    return v_id;
  end if;

  insert into fiscal_years (restaurant_id, starts_on, ends_on)
  values (
    p_restaurant,
    make_date(extract(year from p_date)::int, 1, 1),
    make_date(extract(year from p_date)::int, 12, 31)
  )
  returning id into v_id;

  return v_id;
end;
$vuosi$;

revoke all on function ledger_year_for from public;

-- ---------------------------------------------------------------------------
-- Seuraava tositenumero
-- ---------------------------------------------------------------------------
--
-- Numero juoksee tilikauden sisällä. Tilikauden rivi lukitaan, jotta
-- kaksi rinnakkaista synkronointia ei valitse samaa numeroa —
-- yksikäsitteisyysrajoite hylkäisi jälkimmäisen ja koko ajo kaatuisi.

create or replace function ledger_next_number(p_year uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $numero$
declare
  v_n integer;
begin
  perform 1 from fiscal_years where id = p_year for update;

  select coalesce(max(entry_number), 0) + 1 into v_n
  from ledger_entries where fiscal_year_id = p_year;

  return v_n;
end;
$numero$;

revoke all on function ledger_next_number from public;

-- ---------------------------------------------------------------------------
-- Kuukauden synkronointi
-- ---------------------------------------------------------------------------
--
-- Idempotentti: jokainen lähde tarkistetaan ennen kirjausta, ja
-- yksikäsitteisyysrajoite on viimeinen varmistus. Ajo voidaan siis
-- toistaa niin monta kertaa kuin halutaan.
--
-- Palauttaa raportin eikä pelkkää lukumäärää: käyttäjän on nähtävä
-- mikä jäi tekemättä ja miksi.

create or replace function ledger_sync_month(p_restaurant uuid, p_month date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $sync$
declare
  v_alku date := date_trunc('month', p_month)::date;
  v_loppu date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;

  v_kuitteja integer := 0;
  v_myynteja integer := 0;
  v_ohitettu jsonb := '[]'::jsonb;

  v_r record;
  -- Oma muuttuja sisemmalle silmukalle: sama nimi ylikirjoittaisi
  -- ulomman rivin kesken kayton.
  v_line record;
  v_paiva record;
  v_year uuid;
  v_entry uuid;
  v_rivi integer;

  v_kulutili uuid;
  v_alvtili uuid;
  v_maksutili uuid;
  v_myyntitili uuid;
  v_kassatili uuid;

  v_netto integer;
  v_alv integer;
  v_summa bigint;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilo voi synkronoida kirjanpidon';
  end if;

  -- Lukittu kuukausi ei ota vastaan uusia kirjauksia.
  if exists (select 1 from closed_months
              where restaurant_id = p_restaurant and month = v_alku) then
    return jsonb_build_object(
      'locked', true,
      'message', 'Kuukausi on suljettu. Avaa se ensin tai tee korjaustosite.'
    );
  end if;

  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = p_restaurant and kind = 'vat_purchases' limit 1;

  -- =========================================================================
  -- Kuitit
  -- =========================================================================
  for v_r in
    select rc.id, rc.receipt_date, rc.supplier_name, rc.total_cents,
           coalesce(rc.vat_cents, 0) as vat_cents,
           rc.category::text as category, rc.payment_method::text as payment_method,
           rc.status::text as status
    from receipts rc
    where rc.restaurant_id = p_restaurant
      and rc.receipt_date between v_alku and v_loppu
      and not exists (
        select 1 from ledger_entries e
        where e.restaurant_id = p_restaurant
          and e.source_type = 'receipt'
          and e.source_id = rc.id
      )
    order by rc.receipt_date, rc.created_at
  loop
    -- Kesken oleva kuitti ei ole tosite.
    if v_r.status = 'needs_review' then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'receipt', 'id', v_r.id, 'name', v_r.supplier_name,
        'reason', 'Kuitti odottaa tarkistusta');
      continue;
    end if;

    select account_id into v_kulutili from ledger_mappings
     where restaurant_id = p_restaurant and kind = 'expense_category'
       and ref_key = v_r.category;

    select account_id into v_maksutili from ledger_mappings
     where restaurant_id = p_restaurant and kind = 'payment_method'
       and ref_key = v_r.payment_method;

    if v_kulutili is null or v_maksutili is null or v_alvtili is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'receipt', 'id', v_r.id, 'name', v_r.supplier_name,
        'reason', 'Tilikohdistus puuttuu');
      continue;
    end if;

    v_netto := v_r.total_cents - v_r.vat_cents;
    v_year := ledger_year_for(p_restaurant, v_r.receipt_date);

    insert into ledger_entries (
      restaurant_id, fiscal_year_id, entry_number, entry_date, description,
      source_type, source_id, created_by
    )
    values (
      p_restaurant, v_year, ledger_next_number(v_year), v_r.receipt_date,
      v_r.supplier_name, 'receipt', v_r.id, auth.uid()
    )
    returning id into v_entry;

    v_rivi := 1;

    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
    values (v_entry, v_rivi, v_kulutili, v_netto, 'Veroton');
    v_rivi := v_rivi + 1;

    if v_r.vat_cents > 0 then
      insert into ledger_lines (entry_id, line_number, account_id, debit_cents, vat_cents, description)
      values (v_entry, v_rivi, v_alvtili, v_r.vat_cents, v_r.vat_cents, 'Vahennettava ALV');
      v_rivi := v_rivi + 1;
    end if;

    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_maksutili, v_r.total_cents, 'Maksettu');

    v_kuitteja := v_kuitteja + 1;
  end loop;

  -- =========================================================================
  -- Myyntipaivat
  -- =========================================================================
  --
  -- Debet-puoli on kassatilitykset eika pankki tai kateinen: Budetin
  -- myyntipaiva ei erittele maksutapoja, ja "pankkitilille" kirjaaminen
  -- vaittaisi rahan olevan siella. Tilitystili kertoo mika on totta:
  -- myynti on syntynyt, tilitys on kesken.

  select id into v_kassatili from ledger_accounts
   where restaurant_id = p_restaurant and number = '1750';

  select account_id into v_alvtili from ledger_mappings
   where restaurant_id = p_restaurant and kind = 'vat_sales' limit 1;

  for v_paiva in
    select ds.id, ds.sales_date, ds.gross_sales_cents, ds.net_sales_cents,
           coalesce(ds.vat_cents, 0) as vat_cents
    from daily_sales ds
    where ds.restaurant_id = p_restaurant
      and ds.sales_date between v_alku and v_loppu
      and not exists (
        select 1 from ledger_entries e
        where e.restaurant_id = p_restaurant
          and e.source_type = 'daily_sales'
          and e.source_id = ds.id
      )
    order by ds.sales_date
  loop
    if v_kassatili is null or v_alvtili is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Tilikohdistus puuttuu');
      continue;
    end if;

    if v_paiva.gross_sales_cents is null then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Paivalta puuttuu bruttomyynti');
      continue;
    end if;

    -- Rivit myyntiryhmittain. Ilman niita ei voi kohdistaa tileille.
    if not exists (select 1 from daily_sales_lines where daily_sales_id = v_paiva.id) then
      v_ohitettu := v_ohitettu || jsonb_build_object(
        'type', 'daily_sales', 'id', v_paiva.id, 'name', v_paiva.sales_date::text,
        'reason', 'Paivalta puuttuu myyntiryhmien erittely');
      continue;
    end if;

    v_year := ledger_year_for(p_restaurant, v_paiva.sales_date);

    insert into ledger_entries (
      restaurant_id, fiscal_year_id, entry_number, entry_date, description,
      source_type, source_id, created_by
    )
    values (
      p_restaurant, v_year, ledger_next_number(v_year), v_paiva.sales_date,
      'Paivamyynti ' || to_char(v_paiva.sales_date, 'DD.MM.YYYY'),
      'daily_sales', v_paiva.id, auth.uid()
    )
    returning id into v_entry;

    v_rivi := 1;
    v_summa := 0;

    -- Debet: kassatilitykset koko bruttosummalla.
    insert into ledger_lines (entry_id, line_number, account_id, debit_cents, description)
    values (v_entry, v_rivi, v_kassatili, v_paiva.gross_sales_cents, 'Paivan myynti');
    v_rivi := v_rivi + 1;

    -- Kredit: myyntitilit netolla, ryhmittain.
    for v_line in
      select l.sales_group_id, l.vat_rate,
             sum(l.net_cents)::integer as net_cents,
             sum(l.vat_cents)::integer as vat_cents
      from daily_sales_lines l
      where l.daily_sales_id = v_paiva.id
      group by l.sales_group_id, l.vat_rate
      order by l.sales_group_id
    loop
      select account_id into v_myyntitili from ledger_mappings
       where restaurant_id = p_restaurant and kind = 'sales_group'
         and ref_id = v_line.sales_group_id;

      if v_myyntitili is null then
        select id into v_myyntitili from ledger_accounts
         where restaurant_id = p_restaurant and number = '3000';
      end if;

      insert into ledger_lines (entry_id, line_number, account_id, credit_cents, vat_rate, description)
      values (v_entry, v_rivi, v_myyntitili, v_line.net_cents, v_line.vat_rate, 'Myynti veroton');
      v_rivi := v_rivi + 1;
      v_summa := v_summa + v_line.net_cents;
    end loop;

    /*
     * Kredit: myynnin ALV.
     *
     * Erotus bruttoon eika rivien verojen summa. Rivien verot voivat
     * pyoristya eri tavalla kuin paivan yhteissumma, ja silloin tosite
     * jaisi sentin epatasapainoon. Erotus on aina tasan oikea, ja jos
     * se poikkeaa rivien summasta, tasmaytys nostaa sen esiin.
     */
    insert into ledger_lines (entry_id, line_number, account_id, credit_cents, description)
    values (v_entry, v_rivi, v_alvtili,
            (v_paiva.gross_sales_cents - v_summa)::integer, 'Myynnin ALV');

    v_myynteja := v_myynteja + 1;
  end loop;

  return jsonb_build_object(
    'month', to_char(v_alku, 'YYYY-MM'),
    'receipts', v_kuitteja,
    'salesDays', v_myynteja,
    'skipped', v_ohitettu
  );
end;
$sync$;

revoke all on function ledger_sync_month from public;
grant execute on function ledger_sync_month to authenticated;
