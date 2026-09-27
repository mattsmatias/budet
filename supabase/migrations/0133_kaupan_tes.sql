-- 0133 Kaupan alan tyoehtosopimus
--
-- MIKSI TAMA ON PARTURIN KOHDALLA.
--
-- Hiusalalla ei ole valtakunnallista tyoehtosopimusta. PAMin mukaan
-- alalla on yrityskohtaisia sopimuksia ja "monen tyontekijan kohdalla
-- noudatetaan kaupan tyoehtosopimusta". Kate ei paata kenen sopimus
-- yritysta sitoo — se tarjoaa taman valittavaksi, ja yllapitaja
-- valitsee sen vain jos yritys oikeasti noudattaa sita.
--
-- KAKSI VERSIOTA, KOSKA LISAT OVAT ERI SUURUISIA.
--
-- Palkkaliitteessa on omat euromaarat Helsingille ja muulle Suomelle.
-- Yksi keskiarvo olisi vaara molemmille, joten sopimuksia on kaksi ja
-- yllapitaja valitsee sen jota yritys noudattaa.
--
-- Lahde: PAM, kaupan alan tyoehtosopimus, palkkaliitteen kohta 12
-- (myyjat ja myymalatyontekijat) seka 10 § 3. kohta. Tarkistettu
-- 27.9.2026. Lisat ovat olleet voimassa 1.5.2022 lukien.

do $$
declare
  v_muu uuid;
  v_hki uuid;
  v_huom text := 'Aattoiltalisaa ei ole syotetty: kaupan aatot (loppiaisen aatto, kiirastorstai, helatorstain aatto, juhannusaatto, pyhainpaivan aatto, jouluaatto, uudenvuoden aatto) eivat ole samat kuin MaRan aatot, joita Katen aattosaanto kayttaa. Vaara paivalista maksaisi lisan vaarina paivina. Lahde: PAM, kaupan alan TES, palkkaliite 12 § seka 10 § 3. kohta, tarkistettu 27.9.2026.';
begin
  if exists (select 1 from tes_agreements where slug in ('kauppa', 'kauppa-hki')) then
    return;
  end if;

  insert into tes_agreements (slug, name, industries, valid_from, valid_until, is_active, note)
  values ('kauppa', 'Kaupan alan TES (muu Suomi)', array['barber'], '2022-05-01', null, true, v_huom)
  returning id into v_muu;

  insert into tes_agreements (slug, name, industries, valid_from, valid_until, is_active, note)
  values ('kauppa-hki', 'Kaupan alan TES (Helsinki)', array['barber'], '2022-05-01', null, true, v_huom)
  returning id into v_hki;

  insert into tes_rules (tes_id, rule_type, name, unit, value, start_time, end_time, weekdays, not_on_holidays, base_only)
  values
    (v_muu, 'evening', 'Iltalisä', 'eur_per_hour', 4.00, '18:00', '24:00', array[1,2,3,4,5,7]::smallint[], false, false),
    (v_muu, 'night', 'Yölisä', 'eur_per_hour', 6.01, '00:00', '06:00', array[1,2,3,4,5,6]::smallint[], true, false),
    (v_muu, 'saturday', 'Lauantailisä', 'eur_per_hour', 5.27, '13:00', '24:00', null, true, false),
    (v_muu, 'sunday', 'Sunnuntaikorotus', 'percent', 100, null, null, null, false, true),
    (v_hki, 'evening', 'Iltalisä', 'eur_per_hour', 4.18, '18:00', '24:00', array[1,2,3,4,5,7]::smallint[], false, false),
    (v_hki, 'night', 'Yölisä', 'eur_per_hour', 6.28, '00:00', '06:00', array[1,2,3,4,5,6]::smallint[], true, false),
    (v_hki, 'saturday', 'Lauantailisä', 'eur_per_hour', 5.46, '13:00', '24:00', null, true, false),
    (v_hki, 'sunday', 'Sunnuntaikorotus', 'percent', 100, null, null, null, false, true);
end $$;
