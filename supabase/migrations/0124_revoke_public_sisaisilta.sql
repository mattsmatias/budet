-- ---------------------------------------------------------------------------
-- 0124 — Sisaiset apurit myos PUBLIC-roolilta
-- ---------------------------------------------------------------------------
--
-- REVOKE ANONILTA EI RIITA.
--
-- Postgres antaa uudelle funktiolle suoritusoikeuden PUBLIC-roolille
-- oletuksena, ja anon perii sen sita kautta. Migraatio 0121 perui
-- oikeuden anonilta ja kirjautuneelta, mutta nelja funktiota jai
-- edelleen kutsuttavaksi, koska niiden oikeus ei tullut roolilta vaan
-- PUBLICilta. Tarkistus paljasti sen: kaksi funktiota naytti yha
-- avoimelta revoken jalkeen.
--
-- Tassa oikeus perutaan siita mista se oikeasti tulee. Kaikki
-- kahdeksan ovat muiden SQL-funktioiden apureita, eika yksikaan
-- RLS-kaytanto kutsu niita, joten kutsupolut sailyvat: SECURITY
-- DEFINER -funktio ajaa ne omistajan oikeuksilla.
--
-- Julkisiksi jaavat vain preview_invitation ja submit_contact_request.

revoke execute on function public.audit_person_name(uuid) from public;
revoke execute on function public.record_usage(uuid, text, text, uuid, integer) from public;
revoke execute on function public.feature_enabled(text, uuid) from public;
revoke execute on function public.is_month_closed(uuid, date) from public;
revoke execute on function public.restaurant_slug(text) from public;
revoke execute on function public.restaurant_exists(uuid) from public;
revoke execute on function public.ledger_year_for(uuid, date) from public;
revoke execute on function public.ledger_next_number(uuid) from public;
