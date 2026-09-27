-- 0130 Tilikartta toimialan mukaan
--
-- PARTURIN TILIKARTASSA OLI RAVINTOLAN TILEJA.
--
-- Myyntitilien nimet vaihtuivat toimialan mukaan jo migraatiossa 0099,
-- mutta kulutilit olivat kaikille samat. Parturi sai tilikarttaansa
-- Elintarvikeostot, Alkoholiostot, Alkoholittomat juomat,
-- Keittiotarvikkeet ja Pakkaustarvikkeet — viisi tilia joille han ei
-- voi kirjata mitaan, koska niiden kulukategorioita ei edes tarjota
-- hanen kuiteilleen.
--
-- Tyhja tili ei ole harmiton. Tilikartta on se lista jonka yrittaja
-- nayttaa kirjanpitajalleen, ja vaara tili siina kertoo etta
-- jarjestelma on tehty jollekin muulle.
--
-- LISTA TULEE SAMASTA LAHTEESTA KUIN KULUKATEGORIAT.
--
-- Toimialan kulukategoriat ovat sovelluksessa (business.ts) ja
-- kategorian tili tassa kannassa (business_category_accounts).
-- Tilikartta on naiden leikkaus: jokaiselle tarjotulle kategorialle
-- oma tili, eika yhtaan muuta.

-- Toimialan kulukategoriat kannassa.
--
-- Sama lista kuin sovelluksen business.ts:ssa. Kaksi paikkaa on yksi
-- liikaa, mutta vaihtoehto olisi tehda tilikartan luonti sovelluksessa
-- — ja se on kannan tyota. Jos lista muuttuu, se muuttuu molemmissa;
-- siksi tama on oma funktionsa eika kopioitu kolmeen kyselyyn.
create or replace function public.business_expense_categories(p_type public.business_type)
returns text[]
language sql
immutable
as $$
  select case p_type
    when 'barber' then array[
      'products', 'equipment', 'rent', 'cleaning', 'transport', 'staff', 'other'
    ]
    when 'cafe' then array[
      'food', 'soft_drinks', 'packaging', 'kitchen_supplies', 'cleaning',
      'equipment', 'rent', 'transport', 'staff', 'other'
    ]
    else array[
      'food', 'alcohol', 'soft_drinks', 'kitchen_supplies', 'packaging',
      'cleaning', 'equipment', 'rent', 'transport', 'staff', 'other'
    ]
  end;
$$;

revoke all on function public.business_expense_categories(public.business_type)
  from public, anon, authenticated;

create or replace function public.business_ledger_accounts(p_type public.business_type)
returns table (number text, name text, type text)
language sql
immutable
as $$
  select t.number, t.name, t.type from (values
    ('1750', 'Kassatilitykset', 'asset'),
    ('1763', 'Arvonlisäverosaaminen', 'asset'),
    ('1900', 'Käteiskassa', 'asset'),
    ('1910', 'Pankkitili', 'asset'),
    ('1920', 'Korttisaatavat', 'asset'),
    ('2460', 'Arvonlisäverovelka', 'liability'),
    ('2870', 'Ostovelat', 'liability'),
    ('3000', case p_type when 'cafe' then 'Kahvilamyynti'
                         when 'barber' then 'Palvelumyynti'
                         else 'Ravintolamyynti' end, 'revenue'),
    ('3010', case p_type when 'barber' then 'Tuotemyynti'
                         else 'Alkoholimyynti' end, 'revenue'),
    ('3020', 'Muu myynti', 'revenue'),
    ('3900', 'Pyöristyserot', 'revenue'),
    ('4000', 'Elintarvikeostot', 'expense'),
    ('4010', 'Alkoholiostot', 'expense'),
    ('4020', 'Alkoholittomat juomat', 'expense'),
    ('4030', 'Hoitotuotteet ja tarvikkeet', 'expense'),
    ('4100', 'Keittiötarvikkeet', 'expense'),
    ('4110', 'Pakkaustarvikkeet', 'expense'),
    ('4120', 'Siivoustarvikkeet', 'expense'),
    ('4130', 'Laitteet ja välineet', 'expense'),
    ('4200', 'Kuljetus', 'expense'),
    ('4300', 'Toimitilakulut', 'expense'),
    ('4900', 'Muut kulut', 'expense'),
    ('5000', 'Henkilöstökulut', 'expense')
  ) as t(number, name, type)
  -- Tase- ja myyntitilit kaikille. Kulutili vain jos toimialalla on
  -- sita vastaava kulukategoria.
  where t.type <> 'expense'
     or t.number in (
       select a.account
       from business_category_accounts() a
       where a.category = any (business_expense_categories(p_type))
     );
$$;

-- Kohdistus vain olemassa oleville tileille.
--
-- ledger_seed kavi kaikki kategoriat lapi ja kohdisti ne tileille.
-- Kun tilikartta on toimialakohtainen, osaa tileista ei ole — silloin
-- kohdistus jatetaan tekematta sen sijaan etta se osoittaisi tyhjaan.
create or replace function public.ledger_seed(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_luotu integer := 0; v_kohdistuksia integer := 0;
  v_id uuid; v_rivi record; v_ryhma record;
  v_type public.business_type;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi luoda tilikartan';
  end if;

  select business_type into v_type from restaurants where id = p_restaurant;

  for v_rivi in
    select * from business_ledger_accounts(coalesce(v_type, 'restaurant'))
  loop
    insert into ledger_accounts (restaurant_id, number, name, type, vat_rate, is_system, sort_order)
    values (p_restaurant, v_rivi.number, v_rivi.name, v_rivi.type::ledger_account_type,
            null, true, v_rivi.number::integer)
    on conflict (restaurant_id, number) do nothing;
    if found then v_luotu := v_luotu + 1; end if;
  end loop;

  for v_rivi in
    select category as avain, account as tili from business_category_accounts()
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;

    /* Toimialalla ei ole tata tilia: ei kohdisteta. */
    if v_id is null then continue; end if;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'expense_category', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  for v_rivi in
    select * from (values
      ('card','1920'),('cash','1900'),('invoice','2870'),('unknown','1910')
    ) as t(avain, tili)
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant and number = v_rivi.tili;
    if v_id is null then continue; end if;

    insert into ledger_mappings (restaurant_id, kind, ref_key, account_id)
    values (p_restaurant, 'payment_method', v_rivi.avain, v_id)
    on conflict do nothing;
    if found then v_kohdistuksia := v_kohdistuksia + 1; end if;
  end loop;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '1763';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_purchases', v_id) on conflict do nothing;

  select id into v_id from ledger_accounts where restaurant_id = p_restaurant and number = '2460';
  insert into ledger_mappings (restaurant_id, kind, account_id)
  values (p_restaurant, 'vat_sales', v_id) on conflict do nothing;

  for v_ryhma in
    select id, name from sales_groups where restaurant_id = p_restaurant and active
  loop
    select id into v_id from ledger_accounts
     where restaurant_id = p_restaurant
       and number = case
         when lower(v_ryhma.name) like '%alkoholi%' then '3010'
         when lower(v_ryhma.name) like '%tuote%'    then '3010'
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
$$;

-- ---------------------------------------------------------------------
-- Jo perustetut yritykset
-- ---------------------------------------------------------------------
--
-- KAYTTAMATON TILI POIS, KAYTETTY JAA.
--
-- Vanhat yritykset ovat saaneet koko tililuettelon. Vaaralle
-- toimialalle kuuluvat tilit poistetaan vain jos niilla ei ole
-- yhtaan vientia: kirjattu rivi on kirjanpitoa, eika sita siivota
-- pois siksi etta tili nayttaa nyt vaaralta.

do $$
declare
  v_rivi record;
begin
  for v_rivi in
    select a.id, a.restaurant_id, a.number
    from ledger_accounts a
    join restaurants r on r.id = a.restaurant_id
    where a.type = 'expense'
      and a.number not in (
        select c.account from business_category_accounts() c
        where c.category = any (business_expense_categories(r.business_type))
      )
      and not exists (select 1 from ledger_lines l where l.account_id = a.id)
  loop
    delete from ledger_mappings where account_id = v_rivi.id;
    delete from ledger_accounts where id = v_rivi.id;
  end loop;
end $$;
