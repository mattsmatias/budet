# Kauppojen tunnukset

Kuittilistassa näkyvät ketjujen logot. Tiedoston nimi on sama kuin
`merchants`-taulun `id`, ja osoite on `merchants.logo_url`.

Kuvat ovat 128 × 128 pikselin neliöitä ja sisältävät oman taustavärinsä,
jotta sama tiedosto toimii sekä vaalealla että tummalla teemalla.
Ketjulle, jolla ei ole tiedostoa tässä, piirretään brändivärinen
alkukirjain — väärän ketjun logo olisi pahempi kuin ei logoa lainkaan.

Uusi tunnus tehdään lähdekuvasta:

    node scripts/kauppojen-logot.mjs <kuva> <tunnus> [taustavari]

Sen jälkeen brändille lisätään `logo` tiedostoon
`scripts/merchant-seed.mjs` ja siemenmigraatio ajetaan uudelleen.

Logot ovat omistajiensa tavaramerkkejä. Niitä käytetään vain kaupan
tunnistamiseen käyttäjän omissa kuiteissa.
