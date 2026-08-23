import { requireContext } from "@/lib/restoflow/session";
import { AppBottomNav, AppSidebar } from "./nav";

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
 */
export default async function EmployeeAppLayout({ children }: LayoutProps<"/app">) {
  const { user, restaurant } = await requireContext("/app");

  return (
    <div className="flex min-h-screen justify-center lg:justify-start">
      <AppSidebar
        userName={user.fullName ?? user.email ?? "Käyttäjä"}
        restaurantName={restaurant.name}
      />

      <div
        className="flex min-h-screen w-full max-w-md flex-col lg:max-w-none"
        style={{ background: "var(--rf-bg)" }}
      >
        <main className="flex-1 px-4 pb-6 pt-3 lg:mx-auto lg:w-full lg:max-w-4xl lg:px-10 lg:pb-12 lg:pt-9">
          {children}
        </main>

        <AppBottomNav />
      </div>
    </div>
  );
}
