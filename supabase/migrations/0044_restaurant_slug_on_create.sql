-- ---------------------------------------------------------------------------
-- 0044 — Uusi ravintola saa osoitetunnuksen
-- ---------------------------------------------------------------------------
--
-- UUDEN RAVINTOLAN LUONTI ON OLLUT RIKKI.
--
-- Migraatio 0016 lisäsi restaurants.slug-sarakkeen, täytti sen
-- olemassa oleville riveille ja asetti sen NOT NULL -tilaan. Se ei
-- päivittänyt create_restaurant-funktiota, joka lisää rivin vain
-- nimellä ja aikavyöhykkeellä.
--
-- Siitä lähtien jokainen yritys luoda ravintola on kaatunut
-- rajoitteeseen: "null value in column slug violates not-null
-- constraint". Vika ei näkynyt kenellekään, koska sen jälkeen ei ole
-- luotu uutta ravintolaa — ja juuri siksi se olisi löytynyt vasta
-- ensimmäisestä uudesta asiakkaasta.
--
-- Vika löytyi kun oletuskohdistuksia (0043) todennettiin ajamalla
-- create_restaurant peruutettavassa transaktiossa.

-- ---------------------------------------------------------------------------
-- Tunnus nimestä
-- ---------------------------------------------------------------------------
--
-- Sama muunnos kuin 0016:n täytössä, jotta vanhat ja uudet tunnukset
-- näyttävät samalta: ääkköset auki, muut merkit viivaksi, reunaviivat
-- pois. /lounas/cafe-monami on luettava, jaettava ja muistettava.
--
-- Numeroliite törmäyksestä. Kaksi samannimistä ravintolaa on
-- tavallista, ja tunnus on ainutkertainen — ilman liitettä
-- jälkimmäisen luonti kaatuisi.
--
-- Tyhjä tulos saa varanimen. Nimi joka koostuu pelkistä välimerkeistä
-- tai latinalaisen aakkoston ulkopuolisista merkeistä muuttuisi
-- tyhjäksi, ja tyhjä rikkoisi muotorajoitteen.

create or replace function restaurant_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := regexp_replace(
    regexp_replace(
      lower(translate(coalesce(p_name, ''), 'äöåÄÖÅüÜéÉ', 'aoaAOAuUeE')),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );

  if v_base = '' then
    v_base := 'ravintola';
  end if;

  v_slug := v_base;

  while exists (select 1 from restaurants where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  return v_slug;
end;
$$;

-- Ei kutsuttavaksi ulkopuolelta: tunnus syntyy ravintolan luonnissa.
revoke all on function restaurant_slug from public;

-- ---------------------------------------------------------------------------
-- Ravintolan luonti
-- ---------------------------------------------------------------------------
--
-- Tunnuksen haku ja rivin lisäys eivät ole yksi atominen toimenpide:
-- kaksi samannimistä luontia yhtä aikaa voi valita saman tunnuksen.
-- Silloin ainutkertaisuusrajoite hylkää jälkimmäisen, ja se yritetään
-- uudelleen — toinen rivi on silloin näkyvissä, joten seuraava tunnus
-- on eri. Rajoite on oikea paikka tälle: lukitus estäisi rinnakkaiset
-- luonnit myös silloin kun nimet eroavat.

create or replace function create_restaurant(
  p_name text,
  p_timezone text default 'Europe/Helsinki'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Kirjautuminen vaaditaan';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Ravintolan nimi puuttuu';
  end if;

  insert into profiles (id) values (v_user) on conflict (id) do nothing;

  for v_attempt in 1..5 loop
    begin
      insert into restaurants (name, timezone, slug)
      values (
        trim(p_name),
        coalesce(nullif(trim(p_timezone), ''), 'Europe/Helsinki'),
        restaurant_slug(p_name)
      )
      returning id into v_id;

      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception 'Ravintolan osoitetunnusta ei voitu muodostaa. Kokeile toista nimeä.';
      end if;
    end;
  end loop;

  insert into memberships (restaurant_id, user_id, role, position, hourly_rate_cents)
  values (v_id, v_user, 'owner', 'manager', null);

  /*
   * Myyntiryhmien pohja.
   *
   * Kannat ovat lähtökohta jonka ravintola tarkistaa — asetusnäkymä
   * sanoo sen ääneen. Vanhat ravintolat pitävät omansa, ja kirjatut
   * myyntirivit kantavat oman kantansa.
   */
  insert into sales_groups (restaurant_id, name, vat_rate, is_default, sort_order)
  values
    (v_id, 'Ravintolamyynti', 0.13500, true, 0),
    (v_id, 'Alkoholimyynti', 0.25500, false, 1),
    (v_id, 'Muut myynnit', 0.25500, false, 2);

  /*
   * Kassaryhmien kohdistukset.
   *
   * Ilman näitä ensimmäinen päiväraportti menisi kokonaan
   * oletusryhmään ja olut kirjautuisi alennetulle kannalle.
   */
  insert into pos_sales_groups (restaurant_id, pos_name, sales_group_id)
  select v_id, d.pos_name, g.id
  from default_pos_names() d
  join sales_groups g
    on g.restaurant_id = v_id
   and g.name = d.group_name;

  return v_id;
end;
$$;

revoke all on function create_restaurant from public;
grant execute on function create_restaurant to authenticated;
