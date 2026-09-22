/**
 * Matin tunnus.
 *
 * NIMI ANSAITSEE OMAN MERKIN.
 *
 * Matti oli kipinäikoni — sama tähti jota lähes jokainen tekoälytyökalu
 * käyttää. Se kertoi "tekoälyä" muttei "Matti": nimetty avustaja näytti
 * geneeriseltä ominaisuudelta. Tunnus on nyt samaa perhettä kuin Katen
 * logo: tumma laatta ja valkoinen merkki. Merkki on M, jonka
 * keskikohta laskeutuu kuin käyrä. Kun Matti miettii, merkki sykkii.
 *
 * Laatassa on hento reunaviiva, jotta tumma merkki erottuu myös tummalta
 * taustalta.
 */
export function MattiMark({
  size = 24,
  thinking = false,
  label,
}: {
  size?: number;
  /** Merkki sykkii: vastausta haetaan. */
  thinking?: boolean;
  /** Saavutettava nimi; ilman sitä merkki on koriste. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`rf-matti-mark shrink-0${thinking ? " rf-matti-thinking" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="24" height="24" rx="7" fill="#0f1729" />
      {/* Yläreunan heijastus antaa laatalle muodon ilman liukumaa. */}
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="6.5"
        stroke="#ffffff"
        strokeOpacity="0.14"
      />
      <path
        d="M6.8 16.9V9.1l5.2 5.1 5.2-5.1v7.8"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
