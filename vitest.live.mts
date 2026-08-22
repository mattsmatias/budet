import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Maksullisten testien konfiguraatio.
 *
 * Tavallinen vitest.config.mts sulkee .manual.test.ts-tiedostot pois,
 * jottei jokainen ajo kutsuisi AI-rajapintaa. Poissulku ei kuitenkaan
 * saa tarkoittaa ettei testiä voi ajaa lainkaan — testi jota ei voi
 * ajaa ei todenna mitään.
 *
 *   npm run test:live
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.manual.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".agents/**"],
    testTimeout: 120_000,
    // Konsoli lapi sellaisenaan: naiden testien arvo on siina mita
    // malli oikeasti vastasi, ei siina etta ne menivat lapi.
    disableConsoleIntercept: true,
  },
});
