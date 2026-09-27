-- 0129 Pelkka provisio
--
-- NELJAS MALLI: PALKKA ON KOKONAAN PROVISIOTA.
--
-- Osa parturi-kampaamoista maksaa pelkkaa provisiota ilman
-- tuntipalkkaa. Aiemmat kolme mallia eivat kata sita: takuumallissa
-- tunnit ovat aina vahimmaispalkka, ja ilman neljatta vaihtoehtoa
-- tallainen tyontekija oli pakko kirjata vaaralla mallilla.
--
-- TUNNIT JAAVAT, PALKKA EI TULE NIISTA.
--
-- Tyoaika kirjataan edelleen: se kertoo milloin liike oli miehitetty
-- ja se on pakollinen tieto tyoaikakirjanpitoon. Kustannus vain ei
-- synny tunneista vaan myynnista, joten peruspalkka ja tyoaikalisat
-- ovat talla mallilla nollia.

alter table employees drop constraint if exists employees_pay_model;

alter table employees add constraint employees_pay_model
  check (pay_model in (
    'hourly',
    'hourly_commission',
    'commission_guaranteed',
    'commission_only'
  ));

comment on column employees.pay_model is
  'hourly | hourly_commission | commission_guaranteed | commission_only';
