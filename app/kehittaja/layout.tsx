import { requireSuperAdmin } from "@/lib/restoflow/session";
import { fetchConsoleCounts } from "@/lib/kehittaja/queries";
import { DevNav, DevNavMobile } from "./nav";

export const metadata = {
  title: { default: "Developer Console", template: "%s · Developer Console" },
};

/**
 * Developer Consolen kuori.
 *
 * PÄÄSY VARMISTETAAN KAHDESSA KOHDASSA.
 *
 * Tämä layout ohjaa pois jos oikeutta ei ole, mutta se ei ole se mikä
 * suojaa. Suojan tekee kanta: jokainen konsolin kysely kulkee
 * sa_-funktion kautta, ja ne tarkistavat oikeuden itse. Jos tämä rivi
 * poistettaisiin, sivut latautuisivat tyhjinä eikä yksikään rivi
 * asiakasdataa tulisi näkyviin.
 *
 * Layoutin tarkistus on siis käytettävyyttä — käyttäjä ei jää
 * tuijottamaan tyhjää sivua — ei turvatoimi. Turvatoimi joka on vain
 * käyttöliittymässä ei ole turvatoimi.
 */
export default async function DevLayout({
  children,
}: LayoutProps<"/kehittaja">) {
  await requireSuperAdmin();

  /*
   * Luvut valikkoon, avaimena polku.
   *
   * Kolme kohtaa jotka odottavat ihmistä: uudet palautteet, näkemättömät
   * virheet ja avoimet yhteydenotot. Muut konsolin sivut ovat hakuja
   * eivätkä jonoja — niissä luku olisi koriste.
   */
  const counts = await fetchConsoleCounts();

  return (
    <div className="flex min-h-screen" style={{ background: "var(--rf-bg)" }}>
      <DevNav counts={counts} />

      <div className="min-w-0 flex-1">
        <DevNavMobile counts={counts} />

        <main className="mx-auto w-full max-w-[1180px] px-4 py-5 md:px-7 md:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
