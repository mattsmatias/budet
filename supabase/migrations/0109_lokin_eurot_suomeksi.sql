-- 0109 — Lokin eurot suomalaisittain
--
-- audit_euros muotoili summan to_char'in G- ja D-merkeillä, jotka
-- seuraavat kannan lokaalia. Kanta on en_US, joten lokissa luki
-- "1,500.00 €" siinä missä käyttöliittymä näyttää "1 500,00 €".
-- Erottimet kirjoitetaan nyt itse, jolloin muoto on sama riippumatta
-- siitä mihin kanta on asetettu.

create or replace function public.audit_euros(p_cents integer)
returns text
language sql
immutable
as $function$
  select case
    when p_cents is null then '—'
    else
      replace(
        replace(to_char(p_cents / 100.0, 'FM999,999,990.00'), ',', ' '),
        '.', ','
      ) || ' €'
  end;
$function$;
