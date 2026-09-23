-- ---------------------------------------------------------------------------
-- 0119 — Aattotyon korotus TES-saantoihin
-- ---------------------------------------------------------------------------
--
-- Tyoehtosopimus maksaa aattoina korotusta iltapaivasta alkaen, ja
-- korotus koskee peruspalkkaa seka iltalisaa. Kyseessa on saanto muiden
-- joukossa eika uusi rakenne: arvo, yksikko ja kellonaikavali tulevat
-- samoista sarakkeista kuin ilta- ja yolisalla.
--
-- MITKA PAIVAT OVAT AATTOJA, EI OLE KANNAN ASIA.
--
-- Uudenvuodenaatto, paasiaislauantai, vapunaatto, juhannusaatto ja
-- jouluaatto lasketaan kalenterista koodissa. Paivalista kannassa
-- vanhenisi joka vuosi, ja vanhentunut lista laskisi vaarin hiljaa.

alter table tes_rules
  drop constraint if exists tes_rules_rule_type_check;

alter table tes_rules
  add constraint tes_rules_rule_type_check
  check (rule_type in ('evening', 'night', 'saturday', 'sunday', 'eve'));

comment on column tes_rules.rule_type is
  'Mihin lisa kohdistuu. eve = aattotyon korotus, jonka paivat tulevat kalenterista.';
