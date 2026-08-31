-- ---------------------------------------------------------------------------
-- 0081 — Palkkalaskelman verotus, vähennykset ja työnantajan kustannus
-- ---------------------------------------------------------------------------
--
-- 0027 laski bruttopalkan ja jätti kaksi saraketta odottamaan:
-- deductions_cents ja employer_cost_cents. Tämä migraatio täyttää sen
-- lupauksen — mutta ei yhtenä lukuna.
--
-- ---------------------------------------------------------------------------
-- YKSI PROSENTTI EI RIITÄ
-- ---------------------------------------------------------------------------
--
-- Houkutus on tallentaa "vähennykset" yhtenä summana. Silloin
-- palkkalaskelmasta ei näkisi mitä siinä on, eikä kukaan voisi
-- tarkistaa sitä. Ennakonpidätys menee Verohallinnolle,
-- työeläkemaksu eläkeyhtiölle ja työttömyysvakuutusmaksu
-- Työllisyysrahastolle. Ne ovat kolme eri maksua kolmelle eri
-- vastaanottajalle, ja jokainen niistä on ilmoitettava erikseen
-- tulorekisteriin.
--
-- Huomaa mitä listasta puuttuu: työntekijän sairausvakuutusmaksu.
-- Se sisältyy verokortin pidätysprosenttiin. Erillisenä rivinä se
-- perittäisiin kahdesti.
--
-- ---------------------------------------------------------------------------
-- KÄYTETYT ARVOT JÄÄDYTETÄÄN
-- ---------------------------------------------------------------------------
--
-- Vuoden 2027 tammikuussa työeläkemaksu on eri kuin nyt. Jos laskelma
-- lukisi prosentin sääntötaulusta joka kerta kun se avataan, vuoden
-- 2026 palkkalaskelma näyttäisi vuonna 2027 eri summat kuin sinä
-- päivänä kun se maksettiin — ja työntekijän tiliotteella olisi se
-- vanha summa.
--
-- Siksi jokainen laskennassa käytetty prosentti tallennetaan riville.
-- Sääntötaulu kertoo mitä käytetään uutta laskettaessa; laskelma
-- kertoo mitä käytettiin. Nämä ovat eri kysymyksiä.
--
-- ---------------------------------------------------------------------------
-- MAKSUPÄIVÄ ON OMA PÄIVÄNSÄ
-- ---------------------------------------------------------------------------
--
-- Kaudella on kolme päivää jotka on helppo sekoittaa:
--
--   työjakso      milloin työ tehtiin        (payslip_lines.work_date)
--   palkkakausi   miltä ajalta palkka on     (pay_periods.starts_on/ends_on)
--   maksupäivä    milloin raha liikkuu       (pay_periods.pay_date)
--
-- Verokortti ja verovuosi määräytyvät maksupäivästä. Kesäkuussa tehty
-- työ joka maksetaan heinäkuussa kuuluu heinäkuun verokortille, ja
-- joulukuun työ joka maksetaan tammikuussa kuuluu uuteen verovuoteen.

-- ---------------------------------------------------------------------------
-- 1. Maksupäivä
-- ---------------------------------------------------------------------------

alter table pay_periods
  add column if not exists pay_date date;

/*
 * Maksupäivä ei ole pakollinen avoimella kaudella.
 *
 * Kausi avataan usein ennen kuin maksupäivä on tiedossa. Hyväksyntä
 * sen sijaan vaatii sen — hyväksytty palkka ilman maksupäivää olisi
 * palkka jonka verokorttia ei voi valita. Se tarkistetaan
 * hyväksymisfunktiossa eikä check-rajoitteella, jotta virheilmoitus
 * on suomea eikä rajoitteen nimi.
 */

alter table payslips
  add column if not exists pay_date date;

-- ---------------------------------------------------------------------------
-- 2. Veronalainen palkka ja luontoisedut
-- ---------------------------------------------------------------------------

alter table payslips
  add column if not exists benefits_cents integer not null default 0;

/**
 * Veronalainen palkka = rahapalkka + luontoisetujen verotusarvo.
 *
 * Tästä lasketaan ennakonpidätys ja vakuutusmaksut. Nettopalkasta
 * luontoisetu vähennetään takaisin: sitä ei makseta rahana.
 */
alter table payslips
  add column if not exists taxable_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 3. Työntekijältä perittävät
-- ---------------------------------------------------------------------------

alter table payslips
  add column if not exists withholding_cents integer not null default 0;

alter table payslips
  add column if not exists employee_pension_cents integer not null default 0;

alter table payslips
  add column if not exists employee_unemployment_cents integer not null default 0;

alter table payslips
  add column if not exists net_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 4. Työnantajan maksut
-- ---------------------------------------------------------------------------
--
-- Nämä eivät vähennä työntekijän palkkaa. Ne kertovat mitä
-- työntekijä oikeasti maksaa työnantajalle — luku jota ravintoloitsija
-- tarvitsee hinnoitteluun ja jota palkkalaskelma ei perinteisesti
-- kerro.

alter table payslips
  add column if not exists employer_pension_cents integer not null default 0;

alter table payslips
  add column if not exists employer_health_cents integer not null default 0;

alter table payslips
  add column if not exists employer_unemployment_cents integer not null default 0;

alter table payslips
  add column if not exists employer_accident_cents integer not null default 0;

alter table payslips
  add column if not exists employer_group_life_cents integer not null default 0;

-- ---------------------------------------------------------------------------
-- 5. Käytetyt laskenta-arvot
-- ---------------------------------------------------------------------------
--
-- Sanoin ne ääneen tiedoston alussa: nämä ovat se syy miksi vuoden
-- 2026 palkkalaskelma näyttää samalta vuonna 2027.

alter table payslips
  add column if not exists tax_rules_year_used integer;

alter table payslips
  add column if not exists tax_card_id uuid references tax_cards(id) on delete set null;

alter table payslips
  add column if not exists tax_base_percent_used numeric(5, 2);

alter table payslips
  add column if not exists tax_additional_percent_used numeric(5, 2);

alter table payslips
  add column if not exists employee_pension_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employee_unemployment_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_pension_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_health_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_unemployment_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_accident_rate_used numeric(5, 2);

alter table payslips
  add column if not exists employer_group_life_rate_used numeric(5, 2);

/**
 * Verokortitta laskettu.
 *
 * Kun työntekijä ei ole esittänyt verokorttia, pidätys on lain mukaan
 * 60 %. Merkintä erottaa sen siitä että joku olisi kirjannut kortille
 * kuusikymmentä prosenttia — ja se on laskelmalla se lause jonka
 * lukija tarvitsee.
 */
alter table payslips
  add column if not exists no_tax_card boolean not null default false;

-- ---------------------------------------------------------------------------
-- 6. Tulorajan käyttö
-- ---------------------------------------------------------------------------
--
-- Kaksi lukua: paljonko rajaa oli käytetty ennen tätä laskelmaa ja
-- paljonko tämä käytti. Niistä saa jäljellä olevan ilman että
-- mitään lasketaan uudelleen — ja ne kertovat myös miksi juuri tällä
-- laskelmalla siirryttiin lisäprosenttiin.

alter table payslips
  add column if not exists income_limit_before_cents bigint;

alter table payslips
  add column if not exists income_limit_used_cents bigint;

-- ---------------------------------------------------------------------------
-- 7. Tila
-- ---------------------------------------------------------------------------
--
-- payslip_status sai arvot 'paid' ja 'cancelled' edellisessä
-- migraatiossa. Vain hyväksytty ja maksettu kerryttävät: luonnos on
-- keskeneräinen arvio ja peruttu on virhe jota ei tapahtunut.

alter table payslips
  add column if not exists paid_at timestamptz;

alter table payslips
  add column if not exists cancelled_at timestamptz;

alter table payslips
  add column if not exists cancelled_reason text;

-- ---------------------------------------------------------------------------
-- 8. Palkkarivin laji
-- ---------------------------------------------------------------------------
--
-- Ennen tätä rivin laji pääteltiin siitä onko pay_component_id null.
-- Luontoisetu ei ole palkkalaji eikä peruspalkka, ja päättely olisi
-- kertonut sen olevan peruspalkkaa.

do $$ begin
  create type payslip_line_kind as enum ('base', 'supplement', 'benefit');
exception when duplicate_object then null; end $$;

alter table payslip_lines
  add column if not exists line_kind payslip_line_kind not null default 'base';

/* Vanhat rivit: lisä jos palkkalaji, muuten peruspalkka. */
update payslip_lines
set line_kind = 'supplement'
where pay_component_id is not null and line_kind = 'base';

-- ---------------------------------------------------------------------------
-- 9. Palkkakertymä
-- ---------------------------------------------------------------------------
--
-- Kertymä lasketaan kannassa eikä selaimessa. Selaimessa laskettu
-- kertymä olisi oikea vain niin kauan kuin sivulla on kaikki
-- laskelmat — ja se ei ole koskaan totta.
--
-- Vuosi määräytyy maksupäivästä. Joulukuussa tehty työ joka maksetaan
-- tammikuussa on seuraavan vuoden tuloa, ja verottaja katsoo sitä
-- samalla tavalla.
--
-- Vain 'approved' ja 'paid'. Luonnos ei kerrytä mitään, eikä peruttu.

create or replace function payroll_accrual(
  p_restaurant uuid,
  p_user uuid,
  p_year integer
)
returns table (
  gross_cents bigint,
  benefits_cents bigint,
  taxable_cents bigint,
  withholding_cents bigint,
  employee_pension_cents bigint,
  employee_unemployment_cents bigint,
  net_cents bigint,
  employer_cost_cents bigint,
  payslip_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(p.gross_cents), 0)::bigint,
    coalesce(sum(p.benefits_cents), 0)::bigint,
    coalesce(sum(p.taxable_cents), 0)::bigint,
    coalesce(sum(p.withholding_cents), 0)::bigint,
    coalesce(sum(p.employee_pension_cents), 0)::bigint,
    coalesce(sum(p.employee_unemployment_cents), 0)::bigint,
    coalesce(sum(p.net_cents), 0)::bigint,
    coalesce(sum(
      p.gross_cents + p.employer_pension_cents + p.employer_health_cents
      + p.employer_unemployment_cents + p.employer_accident_cents
      + p.employer_group_life_cents
    ), 0)::bigint,
    count(*)::integer
  from payslips p
  where p.restaurant_id = p_restaurant
    and p.user_id = p_user
    and p.status in ('approved', 'paid')
    and p.pay_date is not null
    and extract(year from p.pay_date) = p_year
    and (p.user_id = auth.uid() or is_manager(p.restaurant_id));
$$;

revoke all on function payroll_accrual(uuid, uuid, integer) from public, anon;
grant execute on function payroll_accrual(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Tulorajan tila
-- ---------------------------------------------------------------------------
--
-- Kortin tuloraja koskee sitä aikaa jona kortti on voimassa.
-- Muutosverokortti tuo mukanaan oman rajansa loppuvuodelle, joten
-- käyttö lasketaan kortin voimassaoloajalta eikä koko kalenterivuodelta.
--
-- prior_income_cents kattaa sen mitä ennen Katea maksettiin. Ilman
-- sitä kesken vuotta käyttöönotettu Kate luulisi rajaa koskemattomaksi
-- ja jättäisi lisäprosentin perimättä.

create or replace function income_limit_status(
  p_restaurant uuid,
  p_user uuid,
  p_pay_date date
)
returns table (
  tax_card_id uuid,
  limit_cents bigint,
  used_cents bigint,
  remaining_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with card as (
    select * from tax_card_on_pay_date(p_restaurant, p_user, p_pay_date)
  ),
  used as (
    select coalesce(sum(p.taxable_cents), 0)::bigint as total
    from payslips p, card c
    where p.restaurant_id = p_restaurant
      and p.user_id = p_user
      and p.status in ('approved', 'paid')
      and p.pay_date is not null
      and p.pay_date >= c.valid_from
      and (c.valid_to is null or p.pay_date <= c.valid_to)
  )
  select
    c.id,
    c.income_limit_cents,
    c.prior_income_cents + u.total,
    greatest(0, c.income_limit_cents - (c.prior_income_cents + u.total))
  from card c, used u
  where (p_user = auth.uid() or is_manager(p_restaurant));
$$;

revoke all on function income_limit_status(uuid, uuid, date) from public, anon;
grant execute on function income_limit_status(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Toimintaloki: palkkalaskelman elinkaari
-- ---------------------------------------------------------------------------
--
-- Laskelman syntyminen, hyväksyminen, maksaminen ja peruminen ovat ne
-- neljä hetkeä joiden takia palkkalokia luetaan. Summat kirjataan
-- bruttona ja nettona; rivikohtaista erittelyä ei, koska se on
-- laskelmalla eikä lokin tehtävä ole kopioida sitä.

create or replace function audit_payslips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payslips := coalesce(new, old);
  v_name text := audit_person_name(v_row.user_id);
begin
  if tg_op = 'INSERT' then
    perform write_audit(
      v_row.restaurant_id, 'created', 'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma luotiin.',
      null, null, false
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform write_audit(
      v_row.restaurant_id, 'deleted', 'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma poistettiin.',
      null, null, true
    );
    return old;
  end if;

  if new.status is distinct from old.status then
    perform write_audit(
      v_row.restaurant_id,
      case new.status
        when 'cancelled' then 'cancelled'
        when 'approved' then 'completed'
        when 'paid' then 'completed'
        else 'updated'
      end,
      'payslip', v_row.id, v_name,
      v_name || ': palkkalaskelma ' ||
      case new.status
        when 'draft' then 'palautettiin luonnokseksi'
        when 'review' then 'siirtyi tarkistettavaksi'
        when 'approved' then 'hyväksyttiin'
        when 'paid' then 'merkittiin maksetuksi'
        when 'cancelled' then 'peruttiin'
        else new.status::text
      end ||
      ' (brutto ' || audit_euros(new.gross_cents) ||
      ', netto ' || audit_euros(new.net_cents) || ').',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      new.status in ('approved', 'paid', 'cancelled')
    );
  end if;

  return new;
end;
$$;

revoke all on function audit_payslips() from public, anon, authenticated;

drop trigger if exists payslips_audit on payslips;
create trigger payslips_audit
  after insert or update or delete on payslips
  for each row execute function audit_payslips();
