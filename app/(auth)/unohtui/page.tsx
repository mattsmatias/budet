import Link from "next/link";
import { ResetRequestForm } from "./form";

export const metadata = { title: "Unohtuiko salasana" };

export default function ForgotPasswordPage() {
  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">
        Unohtuiko salasana?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Anna sähköpostiosoitteesi, niin lähetämme linkin jolla asetat uuden
        salasanan.
      </p>

      <ResetRequestForm />

      <p className="mt-6 text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        Muistitkin sen?{" "}
        <Link href="/kirjaudu" className="font-medium underline underline-offset-4">
          Kirjaudu sisään
        </Link>
      </p>
    </div>
  );
}
