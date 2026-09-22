-- 0105 — Kirjaamattomat kuittiesitykset uudelleen riveittäin
--
-- 0104 muutti kuitin kirjausesityksen jakautumaan rivien kategorioihin.
-- Olemassa olevat esitykset oli laskettu vanhalla tavalla, joten ne
-- lasketaan uudelleen. Kirjattuihin tositteisiin ei kosketa:
-- ledger_ensure_receipt ohittaa ne, ja tositenumero säilyy.

do $$
declare v_id uuid;
begin
  for v_id in select id from receipts where status = 'confirmed' loop
    perform ledger_ensure_receipt(v_id);
  end loop;
end $$;
