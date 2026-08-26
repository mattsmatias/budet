import Link from "next/link";
import { fetchFlags } from "@/lib/kehittaja/queries";
import { Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";
import { FlagToggle } from "./toggle";

export const metadata = { title: "Feature flagit" };

/**
 * Feature flagit.
 *
 * KAKSI TASOA: OLETUS JA POIKKEUS.
 *
 * Globaali arvo on oletus. Ravintolakohtainen poikkeus voittaa sen ja
 * elää omassa taulussaan, jotta oletuksen vaihtaminen ei pyyhi
 * poikkeuksia — muuten yhden ravintolan kanssa sovittu koekäyttö
 * katoaisi seuraavalla globaalilla muutoksella.
 *
 * Poikkeus asetetaan ravintolan omalta sivulta, koska se koskee yhtä
 * asiakasta ja valinta pitää tehdä sen tiedot näkyvillä.
 */
export default async function DevFlagsPage() {
  const flags = await fetchFlags();

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Feature flagit</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Globaali arvo on oletus. Ravintolakohtainen poikkeus voittaa sen, eikä
          oletuksen vaihtaminen kumoa poikkeuksia.
        </p>
      </header>

      {flags.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei lippuja"
            description="Lippu on koodin tuntema nimi, joten se lisätään migraatiossa eikä käyttöliittymästä."
          />
        </Card>
      ) : (
        <div className="space-y-3.5">
          {flags.map((flag) => (
            <Card key={flag.key}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-bold tracking-[-0.0075em]">{flag.label}</h2>
                    <Pill tone={flag.enabled ? "ok" : "warn"} dot>
                      {flag.enabled ? "Päällä kaikille" : "Pois kaikilta"}
                    </Pill>
                  </div>

                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                    {flag.description ?? "Ei kuvausta."}
                  </p>

                  <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                    Avain koodissa: <code>{flag.key}</code>
                  </p>
                </div>
              </div>

              <div className="mt-3.5">
                <FlagToggle
                  flagKey={flag.key}
                  enabled={flag.enabled}
                  overrides={flag.overrides.length}
                />
              </div>

              {flag.overrides.length > 0 ? (
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
                  <p className="text-[12.5px] font-semibold">Poikkeukset</p>

                  <ul className="mt-1.5 space-y-1">
                    {flag.overrides.map((o) => (
                      <li key={o.restaurantId} className="flex items-center justify-between gap-3 text-[13px]">
                        <Link
                          href={`/kehittaja/ravintolat/${o.restaurantId}?valilehti=liput`}
                          className="rf-press truncate font-medium"
                        >
                          {o.restaurantName}
                        </Link>
                        <Pill tone={o.enabled ? "ok" : "warn"}>
                          {o.enabled ? "Päällä" : "Pois"}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Miten lippu vaikuttaa" subtitle="Kanta ratkaisee, ei käyttöliittymä" />
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Sovellus kysyy tilan funktiolta <code>feature_enabled(avain, ravintola)</code>.
          Se palauttaa ensin ravintolakohtaisen poikkeuksen, sitten globaalin
          oletuksen — ja tuntemattomalle avaimelle aina <strong>pois</strong>,
          jotta kirjoitusvirhe nimessä ei avaa ominaisuutta vahingossa.
        </p>
      </Card>
    </div>
  );
}
