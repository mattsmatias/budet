-- 0128 Provisiopalkka
--
-- HIUSALALLA PALKKA EI OLE PELKKIA TUNTEJA.
--
-- Parturi-kampaamossa maksetaan usein provisiota omasta myynnista:
-- joko tuntipalkan paalle tai niin, etta tuntipalkka on takuu ja
-- provisio maksetaan jos se on suurempi. Ilman tata Katen arvio
-- tyonantajan kustannuksesta oli hiusalalla jarjestelmallisesti liian
-- pieni — ja juuri siina kohdassa jossa yrittaja katsoo kannattaako
-- tyontekija pitaa.
--
-- MALLI ON TYONTEKIJAKOHTAINEN.
--
-- Sama yritys voi maksaa yhdelle tuntipalkkaa, toiselle tuntipalkkaa
-- ja provisiota ja kolmannelle provisiota takuupalkalla. Malli on
-- siksi tyontekijan rivilla eika yrityksen asetuksissa.
--
--   hourly                 vain tunnit (oletus, nykyinen kaytos)
--   hourly_commission      tunnit + provisio omasta myynnista
--   commission_guaranteed  suurempi naista: tunnit tai provisio

alter table employees
  add column if not exists pay_model text not null default 'hourly',
  add column if not exists commission_rate numeric(6,4) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_pay_model'
  ) then
    alter table employees add constraint employees_pay_model
      check (pay_model in ('hourly', 'hourly_commission', 'commission_guaranteed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'employees_commission_rate'
  ) then
    alter table employees add constraint employees_commission_rate
      check (commission_rate >= 0 and commission_rate <= 1);
  end if;
end $$;

comment on column employees.pay_model is
  'hourly | hourly_commission | commission_guaranteed';
comment on column employees.commission_rate is
  'Provisio-osuus omasta myynnista ilman alv, esim. 0.4000 = 40 %.';

-- ---------------------------------------------------------------------
-- Tyontekijan oma myynti
-- ---------------------------------------------------------------------
--
-- KUUKAUSI KERRALLAAN, KASIN SYOTETTYNA.
--
-- Kate tietaa paivan myynnin mutta ei sita kuka sen teki: myynti
-- kirjataan paivatasolla eika kassajarjestelmasta tule tekijaa. Luku
-- otetaan siis siita mista parturi sen itsekin lukee — ajanvaraus- tai
-- kassaraportista kuukauden lopussa.
--
-- ILMAN ALV.
--
-- Provisio lasketaan verottomasta myynnista. Arvonlisavero ei ole
-- yrityksen tuloa, joten sen mukaan laskettu provisio maksaisi
-- neljanneksen liikaa.
create table if not exists employee_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  -- Kuukauden ensimmainen paiva. Paivamaara eika teksti, jotta
  -- jarjestys ja vertailu toimivat kannassa.
  period_month date not null,
  net_cents integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_sales_net check (net_cents >= 0),
  constraint employee_sales_kuukausi check (extract(day from period_month) = 1),
  unique (employee_id, period_month)
);

comment on table employee_sales is
  'Tyontekijan oma myynti kuukaudessa, verottomana. Provision pohja.';

alter table employee_sales enable row level security;

-- Sama saanto kuin employees-taululla: omistaja hallitsee, ja
-- tyontekija nakee oman rivinsa.
drop policy if exists employee_sales_read on employee_sales;
create policy employee_sales_read on employee_sales
  for select using (
    is_owner(restaurant_id)
    or exists (
      select 1 from employees e
      where e.id = employee_sales.employee_id
        and e.user_id = (select auth.uid())
    )
  );

drop policy if exists employee_sales_write on employee_sales;
create policy employee_sales_write on employee_sales
  for all using (is_owner(restaurant_id))
  with check (is_owner(restaurant_id));

create index if not exists employee_sales_kuukausi_idx
  on employee_sales (restaurant_id, period_month);
create index if not exists employee_sales_created_by_idx
  on employee_sales (created_by);

drop trigger if exists employee_sales_touch on employee_sales;
create trigger employee_sales_touch
  before update on employee_sales
  for each row execute function touch_updated_at();
