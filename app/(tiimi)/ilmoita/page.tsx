import { Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";
import { fetchMyReferrals } from "@/lib/kate/referrals";
import { IlmoitusForm } from "./form";

export const metadata = { title: "Ilmoita yritys" };

/**
 * Yrityksen ilmoittaminen tapaamisesta.
 *
 * SAMA OVI KUIN ETUSIVUN LOMAKKEELLA.
 *
 * Ilmoitus menee samaan listaan kuin etusivulta tulevat yhteydenotot,
 * ja siihen jää ilmoittajan nimi. Oma lista olisi tarkoittanut kahta
 * paikkaa joita pitää katsoa erikseen — ja toinen niistä olisi jäänyt
 * katsomatta juuri silloin kun kiire on suurin.
 *
 * MITÄ TAPAHTUU SEURAAVAKSI.
 *
 * Kate ottaa yhteyttä yritykseen ja luo tunnukset. Työntekijä ei tee
 * kumpaakaan: hän on tavannut ihmisen ja kirjoittaa ylös mitä sovittiin.
 * Siksi tällä sivulla ei ole hintaa, sopimusta eikä tunnusten luontia.
 */
export default async function IlmoitaPage() {
  const omat = await fetchMyReferrals();
  const avoinna = omat.filter((r) => r.handledAt === null).length;

  return (
    <div className="rf-enter mx-auto w-full max-w-[720px] space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Ilmoita yritys
        </h1>
        <p
          className="mt-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Tapasitko yrityksen joka kiinnostui Katesta? Kirjoita tiedot tähän,
          niin Kate ottaa yhteyttä ja hoitaa tunnukset. Ilmoitus näkyy
          nimelläsi.
        </p>
      </div>

      <Card>
        <IlmoitusForm />
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader
            title="Omat ilmoitukset"
            subtitle={
              omat.length === 0
                ? "Ei vielä yhtään"
                : `${omat.length} ${
                    omat.length === 1 ? "ilmoitus" : "ilmoitusta"
                  }, ${avoinna} avoinna`
            }
          />
        </div>

        {omat.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="Ei ilmoituksia"
              description="Lähettämäsi ilmoitukset näkyvät tässä listassa."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {omat.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">
                    {r.restaurant}
                  </span>
                  <span
                    className="block text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {r.name} · {r.email} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("fi-FI")}
                  </span>
                </span>

                {/*
                  "Työn alla" eikä "Hoidettu": merkin laittaa Kate silloin
                  kun se ottaa yhteydenoton käsiteltäväksi, eikä se kerro
                  tuliko kaupat.
                */}
                <Pill tone={r.handledAt ? "ok" : "warn"}>
                  {r.handledAt ? "Työn alla" : "Odottaa"}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
