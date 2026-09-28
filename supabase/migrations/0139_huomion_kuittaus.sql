-- Huomion kuittaus: "tarkistettu".
--
-- HUOMIO KATOAA VASTA KUN JOKU ON KATSONUT SEN.
--
-- Ilmoitukset johdetaan aineistosta joka latauksella, ja useimmat
-- katoavat itsestään kun asia korjataan: kuitti tarkistetaan, myynti
-- kirjataan. Osa ei katoa millään, koska niissä ei ole mitään
-- korjattavaa — toimittajan hinnat nousivat, budjetti on 90
-- prosentissa. Ne jäivät listalle joka päivä, ja lista jota ei voi
-- tyhjentää opettaa ohittamaan koko listan.
--
-- Kuittaus on siis omistajan merkintä siitä että asia on katsottu.
-- Se ei korjaa mitään eikä väitä korjaavansa.
--
-- KUUKAUSI ON OSA AVAINTA.
--
-- Tunnisteet kuten "budget-food" ja "spike-<toimittaja>" eivät sisällä
-- kuukautta: sama huomio syntyy uudelleen ensi kuussa samalla
-- tunnisteella. Ilman kuukautta kertakuittaus vaientaisi sen
-- ikuisiksi ajoiksi.
--
-- TEHTÄVIÄ EI KUITATA.
--
-- Tehtävällä on jo oma "merkitse tehdyksi", ja kaksi eri tapaa
-- sulkea sama asia tarkoittaa kahta eri totuutta siitä onko lasku
-- maksettu.

create table if not exists alert_acks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  alert_id text not null,
  month text not null,
  acked_by uuid not null references auth.users(id),
  acked_at timestamptz not null default now(),
  unique (restaurant_id, alert_id, month)
);

create index if not exists alert_acks_haku
  on alert_acks (restaurant_id, month);

alter table alert_acks enable row level security;

-- Luku jäsenille, kirjoitus vain funktion kautta.
drop policy if exists "alert_acks_select" on alert_acks;
create policy "alert_acks_select" on alert_acks
  for select using (restaurant_id in (select my_restaurant_ids()));

create or replace function ack_alert(p_restaurant uuid, p_alert text, p_month text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Tunniste tulee selaimelta, joten oikeus tarkistetaan tassa.
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi kuitata huomion';
  end if;

  if p_alert is null or trim(p_alert) = '' then
    raise exception 'Huomiota ei annettu';
  end if;

  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Kuukausi on muotoa 2026-09';
  end if;

  -- Tehtävät kuitataan tehdyksi, ei tarkistetuksi.
  if p_alert like 'task-%' then
    raise exception 'Tehtävä merkitään tehdyksi tehtävälistassa';
  end if;

  insert into alert_acks (restaurant_id, alert_id, month, acked_by)
  values (p_restaurant, trim(p_alert), p_month, auth.uid())
  on conflict (restaurant_id, alert_id, month) do nothing;

  perform write_audit(
    p_restaurant,
    'acknowledged',
    'alert',
    null,
    trim(p_alert),
    'Huomio merkittiin tarkistetuksi: ' || trim(p_alert)
  );
end;
$$;

create or replace function unack_alert(p_restaurant uuid, p_alert text, p_month text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_manager(p_restaurant) then
    raise exception 'Vain esihenkilö voi palauttaa huomion';
  end if;

  delete from alert_acks
   where restaurant_id = p_restaurant
     and alert_id = trim(p_alert)
     and month = p_month;
end;
$$;

revoke execute on function ack_alert(uuid, text, text) from public, anon;
revoke execute on function unack_alert(uuid, text, text) from public, anon;
grant execute on function ack_alert(uuid, text, text) to authenticated;
grant execute on function unack_alert(uuid, text, text) to authenticated;
