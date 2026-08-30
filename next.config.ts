import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Siirtyneet osoitteet.
   *
   * Varausasetukset olivat asetusten alla ja siirtyivät varaussivun
   * välilehdeksi. Osoite ehti olla julkaistuna, joten se voi olla
   * kirjanmerkissä — ja kirjanmerkki joka johtaa 404:ään näyttää
   * siltä että ominaisuus poistettiin.
   *
   * Pysyvä ohjaus (308), koska siirto on lopullinen.
   */
  async redirects() {
    return [
      {
        source: "/admin/asetukset/varaukset",
        destination: "/admin/varaukset/asetukset",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
