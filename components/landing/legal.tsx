import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BUSINESS_ID, CONTACT_URL } from "@/lib/kate-contact";

/**
 * Sopimussivujen kuori.
 *
 * OMA KUORI, EI ETUSIVUN NAVIGAATIOTA.
 *
 * Etusivun palkissa on kielivalinta, ja nämä sivut ovat toistaiseksi
 * vain suomeksi. Valitsin joka vaihtaa kielen sivulle jota ei ole
 * lupaisi käännöksen jota ei ole, joten näillä sivuilla on kevyempi
 * kuori: tunnus takaisin etusivulle ja teksti.
 *
 * LUETTAVUUS ON TÄSSÄ SE MUOTOILU.
 *
 * Sopimusteksti luetaan kerran ja usein epäluuloisena. Kapea palsta,
 * selvät väliotsikot ja numeroidut kohdat tekevät siitä selattavan;
 * mitään muuta koristetta ei tarvita.
 */

export interface LegalSection {
  otsikko: string;
  kappaleet: string[];
  /** Luettelo kappaleiden jälkeen, jos kohta on lista. */
  lista?: string[];
}

export function Legal({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  /** Päivitetty-päivä ihmisen muodossa, esimerkiksi "27.9.2026". */
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="bd" lang="fi">
      <header className="mx-auto w-full max-w-3xl px-5 pt-8 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Logo size={24} />
          <span className="text-[16px] font-bold tracking-[-0.02em]">Kate</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6">
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>

        <p
          className="mt-4 text-[15px] leading-relaxed"
          style={{ color: "var(--bd-text-2)" }}
        >
          {intro}
        </p>

        <p className="mt-2 text-[13px]" style={{ color: "var(--bd-text-3)" }}>
          Päivitetty {updated}
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((osa, i) => (
            <section key={osa.otsikko}>
              <h2 className="text-[17px] font-bold tracking-[-0.01em]">
                {i + 1}. {osa.otsikko}
              </h2>

              {osa.kappaleet.map((kappale) => (
                <p
                  key={kappale}
                  className="mt-3 text-[14.5px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {kappale}
                </p>
              ))}

              {osa.lista ? (
                <ul
                  className="mt-3 space-y-1.5 ps-5 text-[14.5px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)", listStyle: "disc" }}
                >
                  {osa.lista.map((rivi) => (
                    <li key={rivi}>{rivi}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div
          className="mt-12 border-t pt-6 text-[13.5px]"
          style={{ borderColor: "var(--bd-line)", color: "var(--bd-text-2)" }}
        >
          <p>
            Kysymykset ja pyynnöt:{" "}
            <a
              href={CONTACT_URL}
              className="font-semibold underline underline-offset-4"
            >
              yhteydenottolomake
            </a>
            . Vastaamme samalla kanavalla.
          </p>

          <p className="mt-3 text-[12px]" style={{ color: "var(--bd-text-3)" }}>
            © {new Date().getFullYear()} Kate · Y-tunnus {BUSINESS_ID} ·{" "}
            <Link href="/" className="underline underline-offset-4">
              Etusivulle
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
