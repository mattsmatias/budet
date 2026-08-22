import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    /*
     * .manual.test.ts jaa pois tavallisesta ajosta.
     *
     * Ne kutsuvat oikeaa AI-rajapintaa ja maksavat joka ajolla. Testi
     * joka maksaa rahaa ei kuulu sarjaan jota ajetaan joka muutoksen
     * jalkeen - se ajetaan kasin kun on syyta:
     *
     *   npx vitest run live.manual
     */
    exclude: [
      "node_modules/**",
      ".next/**",
      ".agents/**",
      "**/*.manual.test.ts",
    ],
  },
});
