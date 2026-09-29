import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminContext } from "@/lib/restoflow/page-context";
import { fetchCustomers } from "@/lib/restoflow/customers";
import { Card, EmptyState, SectionLabel } from "@/components/restoflow/ui";
import { CustomerPicker } from "./forms";
import { LaskutTabs } from "../tabs";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.asiakkaat.title };
}

/**
 * Laskutuksen vastaanottajat.
 *
 * MIKSI REKISTERI ON OMA SIVUNSA.
 *
 * Asiakas kirjoitetaan kerran ja laskutetaan monta kertaa. Jos tiedot
 * annettaisiin vain laskua tehdessä, sama yritys kirjoitettaisiin
 * uudelleen joka kerta — ja pienikin ero osoitteessa tekisi kahdesta
 * rivistä kaksi eri asiakasta, joiden saatavia ei voi laskea yhteen.
 *
 * YTJ TÄYTTÄÄ, IHMINEN TARKISTAA.
 *
 * Nimi ja osoite tulevat rekisteristä, mutta ne jäävät muokattaviksi:
 * rekisterin osoite on toisinaan vanha, ja laskuttaja tietää sen
 * paremmin kuin rekisteri. Sähköpostia YTJ ei anna lainkaan, joten se
 * kysytään erikseen — ja juuri sitä laskun lähettäminen tarvitsee.
 */
export default async function CustomersPage() {
  const { restaurant } = await adminContext("/admin/laskut/asiakkaat");

  const locale = await resolveLocale();
  const t = adminText(locale);

  const asiakkaat = await fetchCustomers(restaurant.id);

  return (
    <div className="rf-enter space-y-5">
      <LaskutTabs t={t} nyt="asiakkaat" />

      <header>
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">
          {t.asiakkaat.title}
        </h1>
        <p
          className="mt-1 max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.asiakkaat.lead}
        </p>
      </header>

      <Card>
        <CustomerPicker t={t} />
      </Card>

      {asiakkaat.length === 0 ? (
        <Card>
          <EmptyState
            title={t.asiakkaat.empty}
            description={t.asiakkaat.emptyHint}
          />
        </Card>
      ) : (
        <section>
          <SectionLabel>{t.asiakkaat.mine}</SectionLabel>

          <div className="mt-3 space-y-2.5">
            {asiakkaat.map((asiakas) => (
              <Card key={asiakas.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[14.5px] font-bold tracking-[-0.0075em]">
                      {asiakas.name}
                    </h2>
                    <p
                      className="mt-0.5 text-[12.5px] leading-relaxed"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {[
                        asiakas.businessId,
                        asiakas.careOf,
                        asiakas.street,
                        [asiakas.postalCode, asiakas.city]
                          .filter(Boolean)
                          .join(" "),
                      ]
                        .filter((osa) => osa && osa.trim() !== "")
                        .join(" · ")}
                    </p>

                    {/*
                      Sähköposti erikseen ja korostettuna puuttuvana.

                      Ilman sitä laskua ei voi lähettää, ja se on juuri
                      se kenttä jota YTJ ei anna — eli se joka jää
                      täyttämättä jos siitä ei muistuteta.
                    */}
                    {asiakas.email ? (
                      <p
                        className="mt-1 text-[12.5px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {asiakas.email}
                      </p>
                    ) : (
                      <p
                        className="mt-1 text-[12.5px]"
                        style={{ color: "var(--rf-amber-text)" }}
                      >
                        {t.asiakkaat.emailHint}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
