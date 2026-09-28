-- 0144 Myyjan laskutustiedot omistajan asetettaviksi
--
-- Laskussa on oltava myyjan Y-tunnus ja tilinumero (ALV-laki 209 e §).
-- Y-tunnus on ollut vain Katen yllapitajan asetettavissa, koska se on
-- annettu yritysta perustettaessa eika sita ole tarvinnut muuttaa.
-- Laskutuksen myota se on yrityksen oma tieto: ilman sita ei voi
-- laskuttaa, eika laskuttaja voi jaada odottamaan etta joku muu kirjaa
-- sen.
--
-- TYHJA MERKKIJONO TYHJENTAA, NULL JATTAA KOSKEMATTA.
--
-- Muilla kentilla null on riittanyt "ala koske" -merkiksi, koska niita
-- ei voi tyhjentaa: nimi ja aikavyohyke ovat aina jotain. Y-tunnus ja
-- tilinumero voi poistaa, joten niille tarvitaan kaksi eri tyhjaa.
--
-- MUUTOS KIRJATAAN LOKIIN.
--
-- Y-tunnus ja tilinumero ovat yrityksen identiteetti laskulla. Niiden
-- vaihtaminen on eri asia kuin nimen muuttaminen: vaara tilinumero
-- ohjaa asiakkaan maksun vaaralle tilille, ja silloin on tiedettava
-- kuka sen vaihtoi ja milloin. Muut kentat eivat kirjaudu, koska loki
-- johon kirjataan kaikki on loki jota ei lueta.

create or replace function update_restaurant(
  p_restaurant uuid,
  p_name text default null,
  p_timezone text default null,
  p_closed_weekdays smallint[] default null,
  p_payroll_enabled boolean default null,
  p_business_id text default null,
  p_iban text default null,
  p_invoice_terms_days integer default null,
  p_invoice_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ennen record;
begin
  if not is_owner(p_restaurant) then
    raise exception 'Vain omistaja voi muuttaa asetuksia';
  end if;

  if p_name is not null and trim(p_name) = '' then
    raise exception 'Nimi ei voi olla tyhjä';
  end if;

  if p_timezone is not null
     and not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Tuntematon aikavyöhyke';
  end if;

  if p_closed_weekdays is not null
     and not (p_closed_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'Viikonpäivä on 1-7';
  end if;

  /*
   * Muoto kannassa, tarkistusnumero sovelluksessa.
   *
   * Kanta ei laske Y-tunnuksen eika IBANin tarkistusnumeroa: se
   * lasketaan sovelluksessa, jotta virheesta saa ihmiselle luettavan
   * lauseen eika kannan poikkeusta. Muoto tarkistetaan silti tassa,
   * jottei ohi paase kirjoittamalla suoraan kantaan.
   */
  if p_business_id is not null and p_business_id <> ''
     and p_business_id !~ '^[0-9]{7}-[0-9]$' then
    raise exception 'Y-tunnuksen muoto on 1234567-8';
  end if;

  if p_iban is not null and p_iban <> ''
     and p_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' then
    raise exception 'Tilinumeron muoto ei kelpaa';
  end if;

  select business_id, iban into v_ennen
    from restaurants where id = p_restaurant;

  update restaurants
  set name = coalesce(trim(p_name), name),
      timezone = coalesce(p_timezone, timezone),
      closed_weekdays = coalesce(
        (select array_agg(distinct d order by d) from unnest(p_closed_weekdays) as d),
        case when p_closed_weekdays is null then closed_weekdays else '{}'::smallint[] end
      ),
      payroll_enabled = coalesce(p_payroll_enabled, payroll_enabled),
      business_id = case
        when p_business_id is null then business_id
        when p_business_id = '' then null
        else p_business_id
      end,
      iban = case
        when p_iban is null then iban
        when p_iban = '' then null
        else p_iban
      end,
      invoice_terms_days = coalesce(p_invoice_terms_days, invoice_terms_days),
      invoice_note = case
        when p_invoice_note is null then invoice_note
        when p_invoice_note = '' then null
        else p_invoice_note
      end,
      updated_at = now()
  where id = p_restaurant;

  if (p_business_id is not null
      and coalesce(nullif(p_business_id, ''), '') is distinct from coalesce(v_ennen.business_id, ''))
     or (p_iban is not null
      and coalesce(nullif(p_iban, ''), '') is distinct from coalesce(v_ennen.iban, '')) then
    perform write_audit(
      p_restaurant,
      'update',
      'restaurant',
      p_restaurant,
      null,
      'Laskutustiedot muuttuivat',
      jsonb_build_object('business_id', v_ennen.business_id, 'iban', v_ennen.iban),
      jsonb_build_object(
        'business_id', coalesce(nullif(p_business_id, ''), v_ennen.business_id),
        'iban', coalesce(nullif(p_iban, ''), v_ennen.iban)
      ),
      true
    );
  end if;
end;
$$;

-- Vanha viisipaikkainen jaa muuten rinnalle ja tekee kutsusta
-- monitulkintaisen.
drop function if exists update_restaurant(uuid, text, text, smallint[], boolean);

revoke all on function update_restaurant(uuid, text, text, smallint[], boolean, text, text, integer, text)
  from public, anon;
grant execute on function update_restaurant(uuid, text, text, smallint[], boolean, text, text, integer, text)
  to authenticated;
