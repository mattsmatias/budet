import Link from "next/link";
import { isConfigured } from "@/utils/supabase/server";
import { readInvite } from "../liity/actions";
import { POSITION_LABELS, ROLE_LABELS } from "@/lib/restoflow/types";
import type { Role, StaffPosition } from "@/lib/restoflow/types";
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

  /*
   * Kutsu luetaan evästeestä, ei osoitteesta.
   *
   * Käyttäjä on jo syöttänyt koodin edellisellä sivulla. Tässä näytetään
   * mihin hän on liittymässä, jotta hän tietää sen ennen kuin antaa
   * sähköpostinsa ja salasanansa.
   */
  const invite = joining ? await readInvite() : null;

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

      {invite ? (
        <div
          className="mt-4 px-4 py-3.5"
          style={{
            background: "var(--rf-accent-bg)",
            color: "var(--rf-accent-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p className="text-[13px]">Liityt ravintolaan</p>
          <p className="mt-0.5 text-[17px] font-semibold">
            {invite.preview.restaurantName}
          </p>
          <p className="mt-0.5 text-[13px]">
            {invite.preview.position
              ? POSITION_LABELS[invite.preview.position as StaffPosition]
              : ROLE_LABELS[invite.preview.role as Role]}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed">
            Luo tunnus, niin liitäminen tapahtuu automaattisesti. Koodia ei
            tarvitse syöttää uudelleen.
          </p>
        </div>
      ) : joining ? (
        <p
          className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Kutsukoodi puuttuu tai on vanhentunut.{" "}
          <Link href="/liity" className="font-medium underline underline-offset-4">
            Syötä koodi uudelleen
          </Link>
          .
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
