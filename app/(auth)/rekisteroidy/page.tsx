import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { SignUpForm } from "./form";

export const metadata = { title: "Luo tunnus" };

export default function SignUpPage() {
  return (
    <div className="rf-enter">
      <h1 className="text-[26px] font-semibold tracking-tight">Luo tunnus</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        Onko sinulla jo tunnus?{" "}
        <Link
          href="/kirjaudu"
          className="font-medium underline underline-offset-4"
          style={{ color: "var(--rf-blue)" }}
        >
          Kirjaudu
        </Link>
      </p>

      {isConfigured() ? (
        <SignUpForm />
      ) : (
        <div
          className="mt-7 px-4 py-3.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Rekisteröitymistä ei ole otettu käyttöön tässä ympäristössä.
        </div>
      )}
    </div>
  );
}
