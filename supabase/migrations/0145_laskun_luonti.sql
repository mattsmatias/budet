-- 0145 Laskun luonti yhtena tapahtumana
--
-- MIKSI FUNKTIO EIKA KAKSI INSERTTIA.
--
-- Lasku ja sen rivit ovat yksi asia. Kahtena kutsuna rivien
-- epaonnistuminen jattaisi laskun ilman riveja ja kuluttaisi
-- laskunumeron: numerointi on aukoton juokseva sarja, ja aukko siina
-- on kirjanpidossa kysymys johon on vastattava.
--
-- SUMMAT LASKETAAN TAALLA, EI KUTSUJASSA.
--
-- Funktio on myonnetty authenticated-roolille, joten sita voi kutsua
-- suoraan rajapinnasta ohi sovelluksen. Jos summat tulisivat
-- parametrina, kutsuja voisi antaa rivit ja niista riippumattoman
-- loppusumman. Rivit ovat ainoa syote; summat johdetaan niista.
--
-- ALV KANNOITTAIN, KUTEN LAKI VAATII.
--
-- Arvonlisaverolaki 209 e § vaatii veron perusteen ja maaran
-- verokannoittain. Riveittain pyoristettyna ja yhteen laskettuna
-- tulos poikkeaa sentin: kolme rivia a 3,35 euroa antaa riveittain
-- 255 senttia mutta kannoittain 256. Sama laskenta on
-- lib/restoflow/invoice-math.ts:ssa naytön esikatselua varten.
--
-- numeric-tyypin round() pyoristaa puolikkaat poispain nollasta, mika
-- on sama saanto kuin sovelluksen puolella. Liukuluku ei olisi.
--
-- EI VALIAIKAISTA TAULUA.
--
-- Ensimmainen versio keroi rivit temporary tableen. Se on
-- yhteysriippuvainen rakenne funktiossa jota kutsutaan yhdistetyn
-- yhteyden yli, eika sen tila ole funktion oma - ja se kaatoi kutsun.
-- Rivit johdetaan nyt suoraan jsonb-parametrista kahdessa lauseessa:
-- summat ensin, rivit sen jalkeen. Molemmat lukevat samaa syotetta
-- samalla lausekkeella, joten ne eivat voi olla eri mielta.

create or replace function create_invoice(
  p_restaurant uuid,
  p_customer uuid,
  p_recipient jsonb,
  p_invoice_date date,
  p_due_date date,
  p_note text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_net bigint := 0;
  v_vat bigint := 0;
  v_kelvollisia integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta laskuttaa tassa yrityksessa'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Laskulla on oltava vahintaan yksi rivi';
  end if;

  if coalesce(trim(p_recipient->>'name'), '') = '' then
    raise exception 'Vastaanottajan nimi puuttuu';
  end if;

  if p_due_date < p_invoice_date then
    raise exception 'Erapaiva ei voi olla ennen laskun paivaa';
  end if;

  /* Jokaiselle riville on loydyttava kannallinen verokanta. */
  select count(*) into v_kelvollisia
  from jsonb_array_elements(p_rows) as e
  join vat_codes c on c.id = (e->>'vat_code_id')::uuid and c.rate is not null;

  if v_kelvollisia <> jsonb_array_length(p_rows) then
    raise exception 'Tuntematon tai kannaton verokanta laskurivilla';
  end if;

  /* Summat: netto riveittain pyoristettyna, vero kannoittain. */
  select
    coalesce(sum(k.netto), 0),
    coalesce(sum(round(k.netto * k.rate)), 0)
  into v_net, v_vat
  from (
    select
      c.rate as rate,
      sum(round((e->>'quantity')::numeric * (e->>'unit_price_cents')::integer))::bigint as netto
    from jsonb_array_elements(p_rows) as e
    join vat_codes c on c.id = (e->>'vat_code_id')::uuid and c.rate is not null
    group by c.rate
  ) k;

  insert into invoices (
    restaurant_id, customer_id,
    recipient_name, recipient_business_id, recipient_care_of,
    recipient_street, recipient_postal_code, recipient_city,
    recipient_country, recipient_email,
    number, reference, invoice_date, due_date, note,
    net_cents, vat_cents, total_cents, created_by
  )
  values (
    p_restaurant, p_customer,
    left(trim(p_recipient->>'name'), 200),
    nullif(trim(coalesce(p_recipient->>'business_id', '')), ''),
    nullif(trim(coalesce(p_recipient->>'care_of', '')), ''),
    nullif(trim(coalesce(p_recipient->>'street', '')), ''),
    nullif(trim(coalesce(p_recipient->>'postal_code', '')), ''),
    nullif(trim(coalesce(p_recipient->>'city', '')), ''),
    coalesce(nullif(p_recipient->>'country', ''), 'FI'),
    nullif(trim(coalesce(p_recipient->>'email', '')), ''),
    /* Numero ja viite: liipaisin invoices_number antaa. */
    0, '', p_invoice_date, p_due_date,
    nullif(trim(coalesce(p_note, '')), ''),
    v_net, v_vat, v_net + v_vat,
    (select auth.uid())
  )
  returning id into v_id;

  insert into invoice_rows (
    invoice_id, line_number, description, quantity, unit,
    unit_price_cents, vat_code_id, net_cents, vat_cents, total_cents
  )
  select
    v_id,
    t.ord::integer,
    left(trim(t.e->>'description'), 200),
    (t.e->>'quantity')::numeric,
    nullif(trim(coalesce(t.e->>'unit', '')), ''),
    (t.e->>'unit_price_cents')::integer,
    c.id,
    n.netto,
    /*
     * Rivin vero on jako-osuus eika laskun veron lahde.
     *
     * Laskun vero tulee kannoittain, joten rivien verojen summa voi
     * poiketa siita sentin - samoin kuin oikeissa kuiteissa. Siksi
     * laskulla ei nayteta rivin veroa vaan kantojen erittely.
     */
    round(n.netto * c.rate)::integer,
    n.netto + round(n.netto * c.rate)::integer
  from jsonb_array_elements(p_rows) with ordinality as t(e, ord)
  join vat_codes c on c.id = (t.e->>'vat_code_id')::uuid
  cross join lateral (
    select round((t.e->>'quantity')::numeric * (t.e->>'unit_price_cents')::integer)::integer as netto
  ) n
  order by t.ord;

  perform write_audit(
    p_restaurant, 'create', 'invoice', v_id,
    left(trim(p_recipient->>'name'), 200),
    'Lasku luotiin',
    null,
    jsonb_build_object('total_cents', v_net + v_vat),
    false
  );

  return v_id;
end;
$$;

revoke all on function create_invoice(uuid, uuid, jsonb, date, date, text, jsonb)
  from public, anon;
grant execute on function create_invoice(uuid, uuid, jsonb, date, date, text, jsonb)
  to authenticated;
