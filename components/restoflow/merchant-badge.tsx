import { merchantInitial, UNKNOWN_MERCHANT } from "@/lib/restoflow/merchants";
import type { Merchant } from "@/lib/restoflow/merchants";

/**
 * Kaupan tunnus listassa.
 *
 * Brändiväri on tunniste, ei teema. Se näkyy kahdessa paikassa: kirjaimen
 * värinä ja logon erittäin vaaleana taustana. Koko kortti pysyy valkoisena
 * — jos jokainen kuitti värjättäisiin kauppansa mukaan, lista muuttuisi
 * kirjavaksi eikä yksikään väri erottuisi enää mistään.
 *
 * Tunnistamaton kauppa saa neutraalin harmaan eikä arvottua väriä. Väri
 * väittäisi tunnistuksesta jota ei ole tehty.
 *
 * Logo tulee kannan logo_url-kentästä. Tiedostot ovat valmiiksi neliöitä
 * ja sisältävät oman taustansa, joten ne täyttävät laatan reunasta
 * reunaan — sama kuva toimii silloin sekä vaalealla että tummalla
 * teemalla, eikä valkoinen logo katoa tummaan korttiin.
 *
 * Kirjain on varamalli eikä väliaikaisratkaisu: ilman logoa piirretään
 * brändivärinen alkukirjain, koska väärän ketjun logo olisi pahempi kuin
 * ei logoa lainkaan.
 */
export function MerchantBadge({
  merchant,
  fallbackName,
  size = 40,
}: {
  /** Tunnistettu brändi, tai null. */
  merchant: Merchant | null;
  /** Kuitissa lukeva nimi. Käytetään kun brändiä ei tunnisteta. */
  fallbackName: string;
  size?: number;
}) {
  const color = merchant?.brandColor ?? UNKNOWN_MERCHANT.brandColor;
  const logo = merchant?.logoUrl ?? null;
  // Logon oma tausta on kuvassa. Brändin vaalea tausta jäisi näkyviin
  // vain hiuksenohuena reunana pyöristetyssä kulmassa.
  const background = logo
    ? "transparent"
    : (merchant?.brandBackground ?? UNKNOWN_MERCHANT.brandBackground);
  const initial = merchantInitial(merchant?.name ?? fallbackName);

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background,
        // Pyöristetty neliö, ei ympyrä: erottaa kaupan tunnuksen
        // henkilön avatarista, joka on tässä sovelluksessa pyöreä.
        borderRadius: Math.round(size * 0.3),
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          // Kuva on neliö ja laatta on neliö, joten cover ei rajaa
          // mitään — se vain estää raon jos mitat eivät täsmää.
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            color,
            fontSize: Math.round(size * 0.42),
            fontWeight: 650,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}

/**
 * Toimialan nimi pienenä tunnisteena.
 *
 * Brändiväri vain tekstissä, ei taustana. Kaksi väripintaa vierekkäin
 * — logo ja pilleri — olisi jo liikaa yhdelle riville.
 */
export function MerchantCategoryTag({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span className="text-[12px] font-medium" style={{ color }}>
      {label}
    </span>
  );
}
