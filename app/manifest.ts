import type { MetadataRoute } from "next";

/**
 * Kate asennettavana sovelluksena.
 *
 * Puhelimen "Lisää kotinäyttöön" tekee Katesta oman kuvakkeen, joka
 * aukeaa koko näytölle ilman selaimen osoiteriviä. Aloitussivu on
 * yleiskatsaus: kotinäytöltä avataan omaa yritystä, ei markkinointisivua.
 * Kirjautumaton ohjataan sieltä kirjautumiseen kuten selaimessakin.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Kate",
    short_name: "Kate",
    description: "Yrityksen myynti, kulut ja tulos yhdessä näkymässä.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f6f8",
    theme_color: "#f5f6f8",
    lang: "fi",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Lisää kuitti",
        short_name: "Kuitti",
        url: "/admin/kuitit/uusi",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Myynti",
        url: "/admin/myynti",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
