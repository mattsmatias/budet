import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { SignUpForm } from "./form";

export const metadata = { title: "Luo tunnus" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/rekisteroidy">) {
  const params = await searchParams;

  // Kutsulinkistä tullut ei ole perustamassa ravintolaa vaan
  // liittymässä olemassa olevaan. Tieto kulkee tunnuksen luonnin läpi,
  // jotta hän päätyy oikealle välilehdelle eikä perusta vahingossa
  // omaa ravintolaa.
  const joining = params.tila === "liity";

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

      {joining ? (
        <p
          className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-accent-bg)",
            color: "var(--rf-accent-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Sinut on kutsuttu ravintolaan. Luo ensin oma tunnus, niin pääset
          syöttämään kutsukoodin.
        </p>
      ) : null}

      {isConfigured() ? (
        <SignUpForm joining={joining} />
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
