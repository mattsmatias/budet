import { fetchTesAgreements } from "@/lib/restoflow/queries";
import { requireSuperAdmin } from "@/lib/restoflow/session";
import { Card, EmptyState } from "@/components/restoflow/ui";
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

      {/*
        Toimialat joilla sopimusta ei ole.

        Hiusalalla ei ole valtakunnallista tyoehtosopimusta. Sita ei
        siis voi lisata tanne, ja ilman tata huomautusta se nayttaisi
        vain siltä että joku unohti syöttää sen. Tieto on tarkistettu
        PAMin sivulta; jos se muuttuu, tämä teksti muuttuu.
      */}
      <Card>
        <p className="text-[13.5px] font-semibold">
          Hiusalalla ei ole valtakunnallista työehtosopimusta
        </p>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          PAM: hiusalalla ei ole sopimusta joka takaisi koko alalle
          vähimmäistyöehdot. Alalla on yrityskohtaisia sopimuksia, ja
          monen työntekijän kohdalla noudatetaan kaupan alan
          työehtosopimusta. Parturi-kampaamon lisät tulevat siis
          työsopimuksesta tai siitä sopimuksesta jota yritys noudattaa —
          älä lisää tänne hiusalan sopimusta, jota ei ole.
        </p>
        <p
          className="mt-1.5 text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          Lähde: pam.fi · hiusalan työehdot · tarkistettu 27.9.2026
        </p>
      </Card>

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
