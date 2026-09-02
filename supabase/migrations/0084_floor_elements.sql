-- ---------------------------------------------------------------------------
-- 0084 — Salin kalusteet ja pöydän oma koko
-- ---------------------------------------------------------------------------
--
-- Pöydät ilman seiniä on pistejoukko. Sama kaksitoista ympyrää
-- näyttää samalta joka ravintolassa, eikä tarjoilija tunnista niistä
-- omaa saliaan.
--
-- Baaritiski, keittiön ovi ja vessan käytävä ovat ne kiintopisteet
-- joiden avulla ihminen lukee tilaa. Kun ne ovat kartalla, "pöytä 12"
-- lakkaa olemasta numero ja alkaa olla paikka.
--
-- ---------------------------------------------------------------------------
-- KALUSTE EI OLE PÖYTÄ
-- ---------------------------------------------------------------------------
--
-- Oma taulunsa eikä lippu pöytärivillä. Kalusteella ei ole
-- paikkalukua, sitä ei voi varata, se ei kuulu yhdistelmiin eikä sillä
-- ole tilaa. Sama taulu tarkoittaisi puolet sarakkeista tyhjänä ja
-- jokaisessa kyselyssä ehdon "and not is_furniture".
--
-- ---------------------------------------------------------------------------
-- KOKO ON VAPAA, TOISIN KUIN PÖYDÄLLÄ
-- ---------------------------------------------------------------------------
--
-- Pöydän koko johdetaan paikkaluvusta, koska kahden hengen pöytä on
-- pieni ja kymmenen hengen iso — se on tosiasia salissa. Seinällä ei
-- ole paikkalukua, ja sen pituus on juuri se mitä siitä pitää kertoa.
--
-- Leveys on prosenttia salin leveydestä ja korkeus prosenttia salin
-- korkeudesta. Kaksi eri yksikköä samassa rivissä on epäkaunista,
-- mutta vaihtoehto olisi tallentaa salin kuvasuhde jokaiselle
-- kalusteelle — ja silloin kartan muodon muuttaminen siirtäisi
-- kaikkea.

do $$ begin
  create type floor_element_kind as enum (
    'wall', 'bar', 'kitchen', 'wc', 'door', 'entrance', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists floor_elements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,

  /* Sama aluejako kuin pöydillä: terassilla on oma karttansa. */
  area_id uuid references dining_areas(id) on delete set null,

  kind floor_element_kind not null,

  /** Vapaa nimi. "Baari" riittää baarille, "Kabinetti 2" ovelle. */
  label text not null default '',

  /* Keskikohta prosentteina, kuten pöydillä. */
  pos_x numeric(5, 2) not null,
  pos_y numeric(5, 2) not null,

  /** Leveys prosentteina salin leveydestä. */
  width numeric(5, 2) not null default 20,

  /** Korkeus prosentteina salin korkeudesta. */
  height numeric(5, 2) not null default 6,

  rotation smallint not null default 0,

  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint floor_elements_position check (
    pos_x >= 0 and pos_x <= 100 and pos_y >= 0 and pos_y <= 100
  ),

  /*
   * Alaraja ei ole nolla.
   *
   * Nollan levyinen seinä on olemassa kannassa muttei kartalla, eikä
   * sitä saa enää tartuttua kiinni hiirellä. Kahden prosentin
   * vähimmäiskoko on pienin joka pysyy osoitettavana.
   */
  constraint floor_elements_size check (
    width >= 2 and width <= 100 and height >= 2 and height <= 100
  ),

  constraint floor_elements_rotation check (rotation >= 0 and rotation < 360)
);

create index if not exists floor_elements_restaurant_idx
  on floor_elements (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- Pöydän oma koko
-- ---------------------------------------------------------------------------
--
-- Koko johdetaan paikkaluvusta, ja se on oikea oletus. Se ei ole aina
-- oikea: kuuden hengen pitkä juhlapöytä ja kuuden hengen pyöreä pöytä
-- vievät salista eri määrän tilaa, ja ravintoloitsija näkee sen
-- kartalta ennen kuin osaa sanoa miksi.
--
-- Null tarkoittaa "käytä paikkaluvusta johdettua". Se ei ole sama
-- asia kuin nolla eikä sama asia kuin oletusarvo tallennettuna:
-- johdettu koko seuraa paikkalukua, tallennettu ei.

alter table restaurant_tables
  add column if not exists width numeric(5, 2);

alter table restaurant_tables
  drop constraint if exists restaurant_tables_width;

alter table restaurant_tables
  add constraint restaurant_tables_width
  check (width is null or (width >= 3 and width <= 40));

-- ---------------------------------------------------------------------------
-- Käytännöt
-- ---------------------------------------------------------------------------
--
-- Sama jako kuin pöydillä: jäsen näkee salin, esihenkilö järjestää
-- sen. Tarjoilijan on nähtävä missä baari on; sen siirtäminen ei
-- kuulu hänelle.

alter table floor_elements enable row level security;

drop policy if exists floor_elements_read on floor_elements;
create policy floor_elements_read on floor_elements
  for select to authenticated
  using (restaurant_id in (select my_restaurant_ids()));

drop policy if exists floor_elements_write on floor_elements;
create policy floor_elements_write on floor_elements
  for all to authenticated
  using (is_manager(restaurant_id))
  with check (is_manager(restaurant_id));

drop trigger if exists floor_elements_touch on floor_elements;
create trigger floor_elements_touch before update on floor_elements
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Kartan tallennus yhtenä eränä
-- ---------------------------------------------------------------------------
--
-- Kartan järjestely on yksi teko. save_table_positions hoitaa pöydät;
-- tämä hoitaa kalusteet, ja sen on osattava myös lisäys ja poisto —
-- käyttäjä raahaa baarin kartalle ja poistaa väärin lisätyn seinän
-- samalla istumalla.
--
-- Poisto on "kaikki mitä listassa ei ole". Se on ainoa tapa jolla
-- selaimen tila ja kanta päätyvät samaan lopputulokseen ilman että
-- jokainen poisto on oma verkkokierroksensa — ja puoliksi tallennettu
-- kartta on huonompi kuin tallentamaton.

create or replace function save_floor_elements(
  p_restaurant uuid,
  p_area uuid,
  p_elements jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_elements) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(p_elements) > 200 then
    raise exception 'Liian monta kalustetta kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_elements)
  loop
    /*
     * Tunniste kertoo onko kyseessä uusi vai vanha.
     *
     * Selain antaa uudelle kalusteelle tunnisteen vasta kun kanta
     * antaa sen. Tyhjä tunniste on siis "tämä on uusi", ei virhe.
     */
    v_id := nullif(v_row->>'id', '')::uuid;

    if v_id is null then
      insert into floor_elements (
        restaurant_id, area_id, kind, label,
        pos_x, pos_y, width, height, rotation, sort_order
      )
      values (
        p_restaurant,
        p_area,
        (v_row->>'kind')::floor_element_kind,
        coalesce(left(btrim(v_row->>'label'), 40), ''),
        round((v_row->>'x')::numeric, 2),
        round((v_row->>'y')::numeric, 2),
        round((v_row->>'width')::numeric, 2),
        round((v_row->>'height')::numeric, 2),
        coalesce((v_row->>'rotation')::smallint, 0),
        v_count
      )
      returning id into v_id;
    else
      update floor_elements e
      set
        kind = (v_row->>'kind')::floor_element_kind,
        label = coalesce(left(btrim(v_row->>'label'), 40), ''),
        pos_x = round((v_row->>'x')::numeric, 2),
        pos_y = round((v_row->>'y')::numeric, 2),
        width = round((v_row->>'width')::numeric, 2),
        height = round((v_row->>'height')::numeric, 2),
        rotation = coalesce((v_row->>'rotation')::smallint, 0),
        sort_order = v_count
      where e.id = v_id
        /* Ravintola riviltä, ei parametrista: vieras tunniste ei osu. */
        and e.restaurant_id = p_restaurant;
    end if;

    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  end loop;

  /*
   * Poistetut pois.
   *
   * Rajaus alueeseen on olennainen: ilman sitä terassin tallennus
   * pyyhkisi salin kalusteet, koska ne eivät ole terassin listalla.
   */
  delete from floor_elements e
  where e.restaurant_id = p_restaurant
    and e.area_id is not distinct from p_area
    and not (e.id = any(v_ids));

  return v_count;
end;
$$;

revoke execute on function save_floor_elements(uuid, uuid, jsonb) from public, anon;
grant execute on function save_floor_elements(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Pöytien leveys mukaan sijaintitallennukseen
-- ---------------------------------------------------------------------------
--
-- save_table_positions kirjoitti paikan, muodon ja kierron. Leveys on
-- neljäs asia jota kartalla säädetään, ja se kuuluu samaan
-- tallennukseen: erillinen kutsu tarkoittaisi että puolet muutoksista
-- voi jäädä tallentumatta.

create or replace function save_table_positions(
  p_restaurant uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not is_manager(p_restaurant) then
    raise exception 'Ei oikeutta.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Virheellinen syote.' using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(p_positions) > 200 then
    raise exception 'Liian monta poytaa kerralla.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_row in select * from jsonb_array_elements(p_positions)
  loop
    update restaurant_tables t
    set
      pos_x = round((v_row->>'x')::numeric, 2),
      pos_y = round((v_row->>'y')::numeric, 2),
      shape = coalesce((v_row->>'shape')::table_shape, t.shape),
      rotation = coalesce((v_row->>'rotation')::smallint, t.rotation),

      /*
       * Tyhjä leveys palauttaa johdetun koon.
       *
       * Null ei ole nolla eikä oletusarvo: se tarkoittaa "seuraa
       * paikkalukua". Ravintoloitsijan on päästävä takaisin siihen
       * ilman että hän arvaa mikä luku olisi ollut oikea.
       */
      width = case
        when v_row ? 'width' and nullif(v_row->>'width', '') is not null
          then round((v_row->>'width')::numeric, 2)
        when v_row ? 'width' then null
        else t.width
      end
    where t.id = (v_row->>'id')::uuid
      and t.restaurant_id = p_restaurant;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function save_table_positions(uuid, jsonb) from public, anon;
grant execute on function save_table_positions(uuid, jsonb) to authenticated;
