import sharp from "sharp";
import { statSync } from "node:fs";

/**
 * Tekee kaupan logosta neliötunnuksen kuittilistaan.
 *
 *   node scripts/kauppojen-logot.mjs <kuva> <tunnus> [taustavari]
 *   node scripts/kauppojen-logot.mjs ~/lataukset/lidl.png lidl "#2250a9"
 *
 * Tunnus on sama kuin merchants-taulun id, ja tiedosto tallentuu
 * polkuun public/kaupat/<tunnus>.png. Kun se on tehty, brändille
 * lisätään logo scripts/merchant-seed.mjs-tiedostoon ja siemen ajetaan
 * uudelleen — käyttöliittymään ei kosketa.
 *
 * Lähdekuvat ovat eri kokoisia ja eri suhteissa: osa läpinäkyviä, osa
 * omalla taustavärillään. Listassa ne ovat kaikki samankokoisia
 * laattoja, joten kuva rajataan tyhjästä reunasta, keskitetään ja
 * täytetään taustavärillään. Tausta jää kuvaan tarkoituksella: sama
 * tiedosto toimii silloin sekä vaalealla että tummalla teemalla, eikä
 * valkoinen logo katoa tummaan korttiin.
 *
 * Taustaväri on lähteen oma. Läpinäkyvälle kuvalle se on valkoinen,
 * koska logot on suunniteltu valkoiselle paperille.
 */

const KOKO = 128;

/*
 * Reunus on noin kymmenesosa laatasta.
 *
 * Ilman sitä leveä logoteksti osuu pyöristettyyn kulmaan kiinni. Kun
 * lähteellä on oma taustaväri, reunus on samaa väriä eikä sitä erota
 * mistään — laatta näyttää edelleen täyteen maalatulta.
 */
const REUNUS = 13;

const [kuva, tunnus, vari] = process.argv.slice(2);

if (!kuva || !tunnus) {
  console.error(
    "Kayttö: node scripts/kauppojen-logot.mjs <kuva> <tunnus> [taustavari]",
  );
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(tunnus)) {
  console.error(`Tunnus "${tunnus}" ei kelpaa merchants-taulun id:ksi.`);
  process.exit(1);
}

const tausta = vari ?? "#ffffff";
const kohde = `public/kaupat/${tunnus}.png`;

const rajattu = await sharp(kuva)
  .flatten({ background: tausta })
  .trim({ threshold: 12 })
  .toBuffer();

await sharp(rajattu)
  .resize(KOKO - 2 * REUNUS, KOKO - 2 * REUNUS, {
    fit: "contain",
    background: tausta,
  })
  .extend({
    top: REUNUS,
    bottom: REUNUS,
    left: REUNUS,
    right: REUNUS,
    background: tausta,
  })
  .png({ compressionLevel: 9 })
  .toFile(kohde);

console.log(`${kohde}  ${tausta}  ${statSync(kohde).size} tavua`);
