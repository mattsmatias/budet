import Link from "next/link";
import { getUser } from "@/lib/restoflow/session";
import { NewPasswordForm } from "./form";

export const metadata = { title: "Uusi salasana" };

/**
 * Uuden salasanan asetus.
 *
 * Sivulle päädytään palautuslinkistä, joka on jo vaihdettu istunnoksi
 * /auth/callback-reitillä. Ilman istuntoa lomaketta ei näytetä lainkaan:
 * tyhjä lomake joka ei voi tallentaa on harhaanjohtava.
 */
export default async function NewPasswordPage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="rf-enter">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Linkki ei kelpaa
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Palautuslinkki on vanhentunut tai se on jo käytetty. Linkki toimii
          kerran ja on voimassa tunnin.
        </p>

        <Link
          href="/unohtui"
          className="rf-press mt-6 flex w-full items-center justify-center py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-text)",
            color: "#fff",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Pyydä uusi linkki
        </Link>
      </div>
    );
  }

  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">Uusi salasana</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Asetat salasanan tunnukselle {user.email}.
      </p>

      <NewPasswordForm />
    </div>
  );
}
