import Link from "next/link";
import { CodeForm } from "./form";

export const metadata = { title: "Liity ravintolaan" };

/**
 * Kutsukoodi ensin.
 *
 * Aiemmin kutsuttu työntekijä joutui luomaan tunnuksen ennen kuin
 * pääsi syöttämään koodin. Hän antoi siis sähköpostinsa ja
 * salasanansa tietämättä mihin oli liittymässä, ja väärällä koodilla
 * jäljelle jäi tunnus joka ei kuulu mihinkään.
 *
 * Nyt koodi tarkistetaan ensin, ja seuraava näkymä kertoo ravintolan
 * nimen ennen kuin mitään omaa tarvitsee luovuttaa.
 */
export default function JoinPage() {
  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">
        Liity ravintolaan
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Sait kutsukoodin esihenkilöltäsi. Syötä se tähän, niin näet mihin
        olet liittymässä.
      </p>

      <CodeForm />

      <p className="mt-7 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        Onko sinulla jo tunnus?{" "}
        <Link
          href="/kirjaudu"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          Kirjaudu
        </Link>
      </p>

      <p className="mt-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        Perustatko oman ravintolan?{" "}
        <Link
          href="/rekisteroidy"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          Luo tunnus
        </Link>
      </p>
    </div>
  );
}
