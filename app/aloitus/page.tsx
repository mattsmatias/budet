import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { clearInvite, readInvite } from "@/app/(auth)/liity/actions";
import { createClient } from "@/utils/supabase/server";
import { getActiveRestaurant, requireUser } from "@/lib/restoflow/session";
import { Card } from "@/components/restoflow/ui";
import { SetupForm } from "./form";
import { JoinForm } from "./join";

export const metadata = { title: "Aloitus" };

/**
 * Kaksi tapaa päästä alkuun.
 *
 * Kutsuttu työntekijä ei perusta ravintolaa vaan liittyy olemassa olevaan.
 * Molemmat vaihtoehdot ovat samalla sivulla, koska tässä kohtaa käyttäjä ei
 * tiedä kumpaan ryhmään kuuluu — hän tietää vain onko hänellä koodi.
 */
export default async function SetupPage({ searchParams }: PageProps<"/aloitus">) {
  const params = await searchParams;
  const user = await requireUser("/aloitus");

  /*
   * Koodi lunastetaan tässä, ei erillisellä painikkeella.
   *
   * Käyttäjä on jo antanut koodin ja nähnyt mihin liittyy; toinen
   * vahvistus samasta asiasta olisi vaihe joka ei päätä mitään.
   *
   * Kaikki reitit kulkevat tämän sivun kautta: tunnuksen luonti
   * istunnolla, ja sähköpostivahvistuksen jälkeinen kirjautuminen.
   *
   * ENNEN jäsenyystarkistusta. Jos lunastus olisi sen jälkeen, jo
   * johonkin ravintolaan kuuluva ohjattaisiin pois ennen kuin hänen
   * kutsuaan ehditään käyttää — ja koodi jäisi lunastamatta ilman että
   * kukaan huomaisi.
   */
  const invite = await readInvite();
  if (invite) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_invitation", { p_code: invite.code });

    await clearInvite();
    if (!error) redirect("/app");
  }

  if (await getActiveRestaurant()) redirect("/admin");

  const mode = params.tila === "liity" ? "join" : "create";
  const firstName = user.fullName?.split(" ")[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-5 py-16">
      <div className="rf-enter">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Tervetuloa{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Perusta oma ravintola tai liity olemassa olevaan kutsukoodilla.
        </p>

        <div
          className="mt-6 grid grid-cols-2 gap-1 p-1"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <Tab href="/aloitus" label="Perusta" active={mode === "create"} />
          <Tab href="/aloitus?tila=liity" label="Liity koodilla" active={mode === "join"} />
        </div>

        <div className="mt-5">
          {mode === "create" ? (
            <>
              <SetupForm />
              <p className="mt-5 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
                Sinusta tulee ravintolan omistaja. Voit kutsua managereita,
                työntekijöitä ja kirjanpitäjän heti perustamisen jälkeen.
              </p>
            </>
          ) : (
            <Card>
              <JoinForm />
            </Card>
          )}
        </div>

        <form action={signOut} className="mt-8 text-center">
          <button
            type="submit"
            className="text-[13px] underline underline-offset-4"
            style={{ color: "var(--rf-text-3)" }}
          >
            Kirjaudu ulos
          </button>
        </form>
      </div>
    </div>
  );
}

function Tab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className="rf-press py-2 text-center text-[14px] font-medium"
      style={{
        background: active ? "var(--rf-card)" : "transparent",
        color: active ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
        borderRadius: "10px",
        boxShadow: active ? "var(--rf-shadow-sm)" : "none",
      }}
    >
      {label}
    </a>
  );
}
