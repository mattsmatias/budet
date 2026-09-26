-- ---------------------------------------------------------------------------
-- 0121 — Sisaisten funktioiden oikeudet ja search_path
-- ---------------------------------------------------------------------------
--
-- SISAINEN APUFUNKTIO EI OLE RAJAPINTA.
--
-- Kanta tarjosi anon-roolille suoritusoikeuden kymmeneen SECURITY
-- DEFINER -funktioon joilla ei ole sisaista oikeustarkistusta. Kaksi
-- niista teki oikeasti jotain: audit_person_name palautti kenen tahansa
-- profiilin nimen pelkalla UUID:lla, ja record_usage kirjoitti
-- kayttorivin mille tahansa organisaatiolle. Kumpikin oli kutsuttavissa
-- julkisella avaimella ilman kirjautumista.
--
-- Naita funktioita ei kutsuta sovelluskoodista lainkaan: ne ovat
-- muiden SQL-funktioiden ja triggerien apureita. Kutsu toisesta
-- SECURITY DEFINER -funktiosta tapahtuu maarittajan oikeuksilla, joten
-- oikeuden peruminen anonilta ja kirjautuneelta ei riko yhtaan
-- nykyista kutsua. Tarkistettiin myos, ettei yksikaan RLS-kaytanto
-- kutsu naita — kaytanto suoritetaan kysyjan roolilla, ja silloin
-- peruminen olisi katkaissut paasyn.
--
-- Julkisiksi jaavat vain ne kaksi joiden kuuluu olla: liittymiskoodin
-- esikatselu ja etusivun yhteydenottolomake.

revoke execute on function public.audit_person_name(uuid) from anon, authenticated;
revoke execute on function public.record_usage(uuid, text, text, uuid, integer) from anon, authenticated;
revoke execute on function public.restaurant_slug(text) from anon, authenticated;
revoke execute on function public.restaurant_exists(uuid) from anon, authenticated;
revoke execute on function public.is_month_closed(uuid, date) from anon, authenticated;
revoke execute on function public.feature_enabled(text, uuid) from anon, authenticated;
revoke execute on function public.ledger_year_for(uuid, date) from anon, authenticated;
revoke execute on function public.ledger_next_number(uuid) from anon, authenticated;

comment on function public.audit_person_name(uuid) is
  'Sisainen apuri toimintalokin nimille. Ei anon- eika authenticated-oikeutta: kutsutaan vain maarittajan oikeuksilla toisesta funktiosta.';

comment on function public.record_usage(uuid, text, text, uuid, integer) is
  'Sisainen kayttokirjaus. Ei anon- eika authenticated-oikeutta: ilman tarkistusta kuka tahansa olisi voinut kirjoittaa kayttorivin mille tahansa organisaatiolle.';

-- ---------------------------------------------------------------------------
-- search_path kiinni
-- ---------------------------------------------------------------------------
--
-- Ilman kiinnitettya hakupolkua funktio loytaa taulun jonka kutsuja on
-- asettanut polkuunsa. Nama ovat triggereita ja apureita jotka ajetaan
-- usein maarittajan oikeuksilla, joten vaara taulu olisi vaara taulu
-- korkeilla oikeuksilla.

alter function public.audit_euros(p_cents integer) set search_path = public, pg_temp;
alter function public.business_category_accounts() set search_path = public, pg_temp;
alter function public.business_default_pos_names(p_type business_type) set search_path = public, pg_temp;
alter function public.business_default_sales_groups(p_type business_type) set search_path = public, pg_temp;
alter function public.business_ledger_accounts(p_type business_type) set search_path = public, pg_temp;
alter function public.default_pos_names() set search_path = public, pg_temp;
alter function public.ledger_kirjattu_lukossa() set search_path = public, pg_temp;
alter function public.ledger_tasapaino() set search_path = public, pg_temp;
alter function public.next_task_due(p_due date, p_rule task_recurrence) set search_path = public, pg_temp;
alter function public.reject_audit_mutation() set search_path = public, pg_temp;
alter function public.touch_updated_at() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Kaytannottomat taulut
-- ---------------------------------------------------------------------------
--
-- RLS paalla ilman yhtaan kaytantoa tarkoittaa: ei suoraa paasya
-- kenellekaan. Molemmissa se on tarkoitus eika unohdus, mutta
-- lintterin varoitus toistuu kunnes syy on kirjoitettu nakyviin.
-- Kaytannon lisaaminen laajentaisi paasya — tunnustauluun juuri sita
-- ei haluta.

comment on table public.contact_requests is
  'Etusivun yhteydenotot. Kirjoitus vain submit_contact_request-funktion kautta ja luku vain sa_-funktioilla, joten suoraa RLS-kaytantoa ei ole tarkoituksella.';

comment on table public.integration_credentials is
  'Integraatioiden tunnukset. Ei RLS-kaytantoa tarkoituksella: rivit luetaan vain palvelinpuolelta, eika yhdellekaan selainroolille anneta suoraa paasya.';
