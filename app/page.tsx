import Link from "next/link";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";

/**
 * Sisääntulo.
 *
 * Budet'lla on kaksi erillistä käyttöliittymää eri käyttäjille:
 * työntekijän mobiilinäkymä ja managerin työpöytänäkymä. Ne eivät ole saman
 * näkymän kokovariantteja vaan eri tuotteita — työntekijän ei kuulu nähdä
 * kulujen kokonaisuutta eikä managerin leimata itseään töihin puhelimen
 * kokoisesta näkymästä.
 */
export default async function Entry() {
  const user = await getUser();
  const restaurant = user ? await getActiveRestaurant() : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-16">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="text-[22px] font-semibold tracking-tight">Budet</span>
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
        Budet vastaa kolmeen kysymykseen: mihin ravintolan rahat menevät,
        kuinka paljon työtunteja tehdään ja mitä juuri nyt tapahtuu. Se ei ole
        kassajärjestelmä eikä näe pankkitiliä.
      </p>

      {user ? (
        <>
          <p className="mt-8 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            Kirjautuneena{user.fullName ? ` — ${user.fullName}` : ""}
            {restaurant ? ` · ${restaurant.name}` : ""}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <EntryCard
              href="/app"
              icon="clock"
              title="Työntekijä"
              body="Mobiilinäkymä. Oma työaika, työvuorot ja kuittien lisääminen kuvaamalla."
              cta="Avaa mobiilinäkymä"
            />
            <EntryCard
              href="/admin"
              icon="overview"
              title="Manager"
              body="Työpöytänäkymä. Kirjatut kulut, tarkistettavat kuitit, työtunnit ja raportit."
              cta="Avaa hallintanäkymä"
            />
          </div>
        </>
      ) : (
        <>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/rekisteroidy"
              className="rf-press px-5 py-3 text-[15px] font-semibold"
              style={{
                background: "var(--rf-accent)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Luo tunnus
            </Link>
            <Link
              href="/kirjaudu"
              className="rf-press px-5 py-3 text-[15px] font-semibold"
              style={{
                background: "var(--rf-card)",
                color: "var(--rf-text)",
                borderRadius: "var(--rf-r-control)",
                boxShadow: "var(--rf-shadow-sm)",
              }}
            >
              Kirjaudu
            </Link>
          </div>

          <ul
            className="mt-10 grid gap-3 text-[14px] sm:grid-cols-2"
            style={{ color: "var(--rf-text-2)" }}
          >
            <Feature icon="receipt" text="Kuvaa kuitti — rivit, ALV ja kategoria poimitaan" />
            <Feature icon="expenses" text="Kulut kategorioittain ja toimittajittain" />
            <Feature icon="budget" text="Budjetit ja hälytykset ennen kuin raja ylittyy" />
            <Feature icon="clock" text="Työaika ja työvuorot samassa laskennassa" />
          </ul>
        </>
      )}

      <p className="mt-10 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Kaikki luvut tarkoittavat järjestelmään kirjattuja kuluja. Budet ei
        näe kassaa eikä pankkitiliä.
      </p>
    </div>
  );
}

function EntryCard({
  href,
  icon,
  title,
  body,
  cta,
}: {
  href: string;
  icon: "clock" | "overview";
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link href={href} className="rf-press block">
      <Card hover className="h-full">
        <span style={{ color: "var(--rf-blue)" }}>
          <RfIcon name={icon} size={24} />
        </span>
        <h2 className="mt-3 text-[17px] font-semibold">{title}</h2>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {body}
        </p>
        <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
          {cta} →
        </p>
      </Card>
    </Link>
  );
}

function Feature({
  icon,
  text,
}: {
  icon: "receipt" | "expenses" | "budget" | "clock";
  text: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
        <RfIcon name={icon} size={18} />
      </span>
      {text}
    </li>
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
