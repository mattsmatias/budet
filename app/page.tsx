import Link from "next/link";
import { Card, Icon, ICONS } from "@/components/restoflow/ui";

/**
 * Sisääntulo.
 *
 * RestoFlow'lla on kaksi erillistä käyttöliittymää eri käyttäjille:
 * työntekijän mobiilinäkymä ja managerin työpöytänäkymä. Ne eivät ole
 * saman näkymän kokovariantteja vaan eri tuotteita — työntekijän ei kuulu
 * nähdä kulujen kokonaisuutta eikä managerin leimata itseään töihin
 * puhelimen kokoisesta näkymästä.
 */
export default function RestoFlowEntry() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-16">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-[22px] font-semibold tracking-tight">RestoFlow</span>
      </div>

      <h1 className="mt-8 text-[32px] font-semibold leading-tight tracking-tight">
        Kuitit, kulut, työvuorot ja työaika.
        <br />
        <span style={{ color: "var(--rf-text-2)" }}>Ei mitään muuta.</span>
      </h1>

      <p
        className="mt-4 max-w-xl text-[15px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        RestoFlow vastaa kolmeen kysymykseen: mihin ravintolan rahat menevät,
        kuinka paljon työtunteja tehdään ja mitä juuri nyt tapahtuu. Se ei ole
        kassajärjestelmä eikä näe pankkitiliä.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/app" className="rf-press block">
          <Card hover className="h-full">
            <span style={{ color: "var(--rf-blue)" }}>
              <Icon path={ICONS.clock} size={24} />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold">Työntekijä</h2>
            <p
              className="mt-1.5 text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              Mobiilinäkymä. Oma työaika, työvuorot ja kuittien lisääminen
              kuvaamalla.
            </p>
            <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
              Avaa mobiilinäkymä →
            </p>
          </Card>
        </Link>

        <Link href="/admin" className="rf-press block">
          <Card hover className="h-full">
            <span style={{ color: "var(--rf-blue)" }}>
              <Icon path={ICONS.chart} size={24} />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold">Manager</h2>
            <p
              className="mt-1.5 text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              Työpöytänäkymä. Kirjatut kulut, tarkistettavat kuitit, työtunnit
              ja raportit.
            </p>
            <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
              Avaa hallintanäkymä →
            </p>
          </Card>
        </Link>
      </div>

      <p className="mt-10 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Demo-aineisto. Luvut ovat keksittyjä eikä mitään tallenneta pysyvästi.
      </p>
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7.5" fill="#1d1d1f" />
      <path
        d="M9 19V9.6c0-.3.3-.6.6-.6h4.6a3 3 0 0 1 0 6H11"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.4 15 4.6 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
