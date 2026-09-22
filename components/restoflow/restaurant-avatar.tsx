import { initials } from "@/lib/restoflow/initials";

/**
 * Yrityksen tunnus.
 *
 * Kuva kun sellainen on asetettu, muuten nimen alkukirjaimet. Tyhjä
 * laatta ei ole vaihtoehto: paikka jossa tunnus on pysyy samana
 * riippumatta siitä onko kuvaa, jotta otsikkorivi ei hyppää kun kuva
 * asetetaan tai poistetaan.
 *
 * Pyöristetty neliö eikä ympyrä: sama muoto kuin kauppojen tunnuksilla,
 * ja tässä sovelluksessa ympyrä on ihmisen kuva.
 *
 * Kuva on aina neliö — sovellus piirtää sen sellaiseksi ennen
 * tallennusta — joten cover ei rajaa mitään, vaan estää raon jos mitat
 * eivät jostain syystä täsmää.
 */
export function RestaurantAvatar({
  name,
  logoUrl,
  size = 36,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background: logoUrl ? "#ffffff" : "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: Math.round(size * 0.28),
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontSize: Math.round(size * 0.34),
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
