import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * PDF-kirjasto jätetään niputtamatta.
   *
   * @react-pdf/renderer tuo mukanaan fontti- ja tavukäsittelyä joka ei
   * kestä bundlausta: se ladataan palvelimella sellaisenaan. Tämä on
   * kirjaston oma ohje eikä kiertotie.
   */
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
