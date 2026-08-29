import { requireContext } from "@/lib/restoflow/session";
import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";
import { AppBottomNav, AppSidebar } from "./nav";
import "../worker.css";

/**
 * Työntekijän kuori.
 *
 * Puhelimessa yksi kapea palsta ja alapalkki: näkymä on suunniteltu
 * peukalolle. Työpöydällä sama sovellus saa sivupalkin ja leveämmän
 * palstan.
 *
 * Aiemmin leveys oli rajattu puhelimen mittoihin myös työpöydällä. Se oli
 * tarkoituksellinen valinta — venytetty mobiilinäkymä näyttää
 * keskeneräiseltä — mutta lopputulos oli kapea nauha keskellä tyhjää
 * ruutua, eikä näkymää voinut kunnolla edes kokeilla koneella. Leveys
 * kasvaa nyt vain sen verran kuin sisältö tarvitsee: teksti ei veny
 * lukukelvottoman pitkäksi riviksi.
 *
 * ULKOASU TULEE ETUSIVUN KIELESTÄ.
 *
 * .bd-app tuo worker.css:n mitat: isommat pyöristykset, oikeat varjot
 * ja sisääntuloliike. Värit tulevat yhä theme.css:stä, joten tumma
 * teema toimii eikä punaista ole kahta.
 */
export default async function EmployeeAppLayout({ children }: LayoutProps<"/app">) {
  const { user } = await requireContext("/app");
  const t = workerText(await resolveLocale());

  return (
    <div className="bd-app flex min-h-screen justify-center lg:justify-start">
      <AppSidebar userName={user.fullName ?? user.email ?? t.yleinen.user} t={t} />

      <div
        className="relative flex min-h-screen w-full max-w-md flex-col lg:max-w-none"
        style={{ background: "var(--rf-bg)" }}
      >
        {/*
          Hehku sisällön takana.

          Ennen sisältöä puussa ja z-indeksittä, jotta se jää alle
          ilman että jokaiselle osiolle pitää antaa oma kerroksensa.
        */}
        <div className="bd-app-glow" aria-hidden="true" />

        <main className="relative flex-1 px-4 pb-6 pt-3 lg:mx-auto lg:w-full lg:max-w-4xl lg:px-10 lg:pb-12 lg:pt-9">
          {children}
        </main>

        <AppBottomNav t={t} />
      </div>
    </div>
  );
}
