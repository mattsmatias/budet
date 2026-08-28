# Tiimikuvat

Tähän kansioon tulevat Meistä-sivun valokuvat.

## Yhteiskuva

Tiedosto: mikä tahansa nimi, esim. `team.jpg`

- Kuvasuhde **16:9** (esim. 2400 × 1350)
- Vaakakuva, luonnollinen tilanne
- Sivu rajaa kuvan `object-fit: cover` -säännöllä, joten reunoilta
  voi jäädä hieman pois. Älä siis sijoita ketään aivan reunaan.

Ota kuva käyttöön asettamalla `lib/team.ts`:

```ts
export const TEAM_PHOTO: string | null = "/team/team.jpg";
```

## Henkilökuvat

Tiedostot: esim. `founder.jpg`, `member-2.jpg`

- Kuvasuhde **4:5** (esim. 800 × 1000) — sama kaikille
- Sama valaistus ja sama rajaus, jotta rivi näyttää yhtenäiseltä
- Ei voimakasta filtteriä

Lisää henkilöt `lib/team.ts`:n `TEAM`-taulukkoon. Kun taulukko on
tyhjä, sivu näyttää kuvapaikat ja kertoo että esittelyt julkaistaan
myöhemmin — asettelu ei siis muutu kun tiedot lisätään.

## Miksi kuvasuhde on tärkeä

Sivu varaa kuvalle tilan ennen kuin kuva on latautunut. Jos suhde
poikkeaa, teksti hyppää kuvan latautuessa.
