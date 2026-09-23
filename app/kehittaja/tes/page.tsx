import { fetchTesAgreements } from "@/lib/restoflow/queries";
import { requireSuperAdmin } from "@/lib/restoflow/session";
import { EmptyState } from "@/components/restoflow/ui";
import { TesList } from "./forms";

export const metadata = { title: "TES-hallinta" };

/**
 * TES-pohjat.
 *
 * Katen hallinta määrittää sopimukset ja niiden lisät; yritysasiakas
 * vain näkee omansa. Yrittäjä ei tiedä sopimuksensa iltalisää senttinä
 * eikä sitä pidä kysyä häneltä — väärin syötetty luku näyttäisi
 * tarkalta ja olisi väärä koko kuukauden ajan.
 *
 * VERSIO EI YLIKIRJOITA VANHAA.
 *
 * Sopimus uusitaan muutaman vuoden välein. Uusi kausi on oma rivinsä
 * samalla tunnuksella, ja laskenta valitsee sen version joka oli
 * voimassa vuoron päivänä — muuten viime vuoden kustannus muuttuisi
 * jälkikäteen.
 *
 * TÄMÄ EI OLE TES-MOOTTORI. Ylityö, työaikalain tulkinta ja
 * palkkaryhmät eivät ole täällä eikä niitä teeskennellä osattavan.
 */
export default async function TesPage() {
  await requireSuperAdmin();

  const agreements = await fetchTesAgreements();

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          TES-hallinta
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Sopimukset, niiden voimassaolo ja työaikalisät. Yritykselle
          sopimus valitaan yrityksen omalta sivulta.
        </p>
      </header>

      {agreements.length === 0 ? (
        <EmptyState
          title="Ei TES-pohjia"
          description="Lisää ensimmäinen sopimus, niin voit liittää sen yrityksille."
        />
      ) : null}

      <TesList agreements={agreements} />
    </div>
  );
}
