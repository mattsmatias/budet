-- 0146 Myyntisaamiset tilikarttaan ja lasku kirjauksen lahteeksi
--
-- Tilikartassa oli kassa, pankki ja korttisaatavat mutta ei
-- myyntisaamisia: Kate on tahan asti tuntenut vain myynnin joka on jo
-- maksettu. Lasku on saatava - myynti on tapahtunut muttei raha
-- liikkunut - eika sita voi kirjata millekaan olemassa olevalle
-- tilille ilman etta tase valehtelee.
--
-- KAKSI MIGRAATIOTA, EI YKSI.
--
-- Postgres ei salli enumin uuden arvon kayttoa samassa
-- transaktiossa jossa se lisataan. Funktiot jotka kayttavat naita
-- arvoja ovat siksi tiedostossa 0147.

alter type ledger_source add value if not exists 'invoice';
alter type ledger_source add value if not exists 'invoice_payment';

-- Uudet yritykset saavat tilin tilikartan mukana.
create or replace function public.business_ledger_accounts(p_type public.business_type)
returns table (number text, name text, type text)
language sql
immutable
as $$
  select t.number, t.name, t.type from (values
    ('1700', 'Myyntisaamiset', 'asset'),
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
    ('5000', 'Henkilöstökulut', 'expense'),
    ('6000', 'Muut liikekulut', 'expense')
  ) as t(number, name, type)
  where t.number <> '3010' or p_type <> 'cafe';
$$;

-- Ja olemassa olevat saavat sen nyt.
insert into ledger_accounts (restaurant_id, number, name, type, is_system, sort_order)
select r.id, '1700', 'Myyntisaamiset', 'asset', true, 0
from restaurants r
where not exists (
  select 1 from ledger_accounts a
  where a.restaurant_id = r.id and a.number = '1700'
);
