"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import { MetricCard } from "@/components/restoflow/ui";
import { AreaChart } from "@/components/restoflow/area-chart";

/**
 * Katen tuote-esittely.
 *
 * SAMA TALO, ERI HUONE.
 *
 * Esittely käyttää samoja värejä, kirjasinta ja pyöristyksiä kuin
 * sovellus itse. Asiakas näkee esittelyssä sen tuotteen jonka hän
 * ostaa — erillinen markkinointi-ilme näyttäisi toiselta tuotteelta
 * ja tekisi ensimmäisestä kirjautumisesta pettymyksen.
 *
 * VAIN SE MITÄ KATE OIKEASTI TEKEE.
 *
 * Jokainen väite tässä vastaa olemassa olevaa toimintoa. Luvut ovat
 * esimerkkejä ja sanotaan esimerkeiksi. Myyntipuhe joka lupaa
 * enemmän kuin tuote tekee, maksetaan takaisin ensimmäisessä
 * käyttökuukaudessa.
 */

interface Dia {
  id: string;
  otsikko: string;
  sisalto: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/* Palikat                                                             */
/* ------------------------------------------------------------------ */

function Silmays({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] font-bold uppercase tracking-[0.14em]"
      style={{ color: "var(--rf-accent)" }}
    >
      {children}
    </p>
  );
}

function Otsikko({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 text-[clamp(26px,3.4vw,44px)] font-bold leading-[1.08] tracking-[-0.035em]">
      {children}
    </h2>
  );
}

function Leipa({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-4 max-w-[62ch] text-[clamp(14px,1.25vw,17px)] leading-relaxed"
      style={{ color: "var(--rf-text-2)" }}
    >
      {children}
    </p>
  );
}

function Ruutu({
  children,
  sävy = "pinta",
}: {
  children: React.ReactNode;
  sävy?: "pinta" | "upotus";
}) {
  return (
    <div
      className="h-full p-4"
      style={{
        background: sävy === "upotus" ? "var(--rf-inset)" : "var(--rf-bg)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      {children}
    </div>
  );
}

function Kuvake({ name }: { name: IconName }) {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center"
      style={{
        background: "var(--rf-accent-bg)",
        color: "var(--rf-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name={name} size={18} />
    </span>
  );
}

function OminaisuusRuutu({
  icon,
  otsikko,
  teksti,
}: {
  icon: IconName;
  otsikko: string;
  teksti: string;
}) {
  return (
    <Ruutu>
      <Kuvake name={icon} />
      <p className="mt-2.5 text-[14px] font-bold">{otsikko}</p>
      <p
        className="mt-1 text-[12.5px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {teksti}
      </p>
    </Ruutu>
  );
}

/** Rivi jossa vasemmalla teksti ja oikealla näyte. */
function Kaksipalsta({
  vasen,
  oikea,
}: {
  vasen: React.ReactNode;
  oikea: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      <div>{vasen}</div>
      <div className="min-w-0">{oikea}</div>
    </div>
  );
}

function Huomio({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-5 max-w-[62ch] text-[12.5px] leading-relaxed"
      style={{ color: "var(--rf-text-3)" }}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Diat                                                                */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Nayte oikeasta sovelluksesta                                        */
/* ------------------------------------------------------------------ */

/**
 * Esimerkkikuukausi.
 *
 * LUVUT OVAT KESKENAAN JOHDONMUKAISIA.
 *
 * Myynti miinus kulut on tulos, kulujakauman osuudet summautuvat
 * sataan ja kuukauden kayra paatyy samaan summaan kuin kortti. Jos
 * luvut riitelisivat keskenaan, asiakas huomaisi sen nopeammin kuin
 * uskoisi — ja kysyisi laskeeko Kate oikein.
 *
 * Mittakaava on pienen ravintolan kuukausi, ei ketjun.
 */
const MYYNTI = 48250;
const KULUT = 31180;
const TULOS = MYYNTI - KULUT;

const VIIKOT = ["Vk 36", "Vk 37", "Vk 38", "Vk 39"];
const MYYNTI_VIIKOT = [10850, 12400, 11900, 13100];
const KULUT_VIIKOT = [7600, 7950, 7430, 8200];

const JAKAUMA: { nimi: string; osuus: number; savy: string }[] = [
  { nimi: "Ruoka", osuus: 43, savy: "var(--rf-blue)" },
  { nimi: "Henkilosto", osuus: 28, savy: "var(--rf-accent)" },
  { nimi: "Juomat", osuus: 17, savy: "var(--rf-violet, #7b76e8)" },
  { nimi: "Muut", osuus: 12, savy: "var(--rf-text-3)" },
];

/** Euroa naytolle: "48 250 €". */
function euro(arvo: number): string {
  return arvo.toLocaleString("fi-FI") + " €";
}

function Esimerkkimerkki() {
  return (
    <span
      className="px-2 py-1 text-[11px] font-bold"
      style={{
        background: "var(--rf-accent-bg)",
        color: "var(--rf-accent)",
        borderRadius: 999,
      }}
    >
      Esimerkki
    </span>
  );
}

const OMINAISUUDET: { icon: IconName; otsikko: string; teksti: string }[] = [
  {
    icon: "receipt",
    otsikko: "Kuitit",
    teksti: "Kuvaa, tarkista ja tallenna — rivit poimitaan valmiiksi.",
  },
  {
    icon: "expenses",
    otsikko: "Kulut",
    teksti: "Näe mihin raha menee, kategoria kerrallaan.",
  },
  {
    icon: "sales",
    otsikko: "Myynti",
    teksti: "Päivän ja kuukauden myynti myyntiryhmittäin.",
  },
  {
    icon: "camera",
    otsikko: "Kassaraportit",
    teksti: "Kassan päiväraportti kuvasta suoraan kirjanpitoon.",
  },
  {
    icon: "ledger",
    otsikko: "Kirjanpito",
    teksti: "Kaksinkertainen kirjanpito syntyy automaattisesti.",
  },
  {
    icon: "budget",
    otsikko: "ALV ja veroasiat",
    teksti: "ALV-luvut valmiina ja ohjeet mukana.",
  },
  {
    icon: "report",
    otsikko: "Raportit",
    teksti: "Päiväkirja, pääkirja, tuloslaskelma ja tase.",
  },
  {
    icon: "staff",
    otsikko: "Työaika ja palkkakulut",
    teksti: "Leimaukset ja arvioitu työnantajakustannus.",
  },
  {
    icon: "check",
    otsikko: "Tehtävät",
    teksti: "Muistutukset ja määräpäivät, ettei mikään unohdu.",
  },
  {
    icon: "folder",
    otsikko: "Tiedostot",
    teksti: "Sopimukset ja tositteet yksityisesti tallessa.",
  },
  {
    icon: "sparkle",
    otsikko: "Matti-avustaja",
    teksti: "Kertoo mikä muuttui ja mitä kannattaa tehdä seuraavaksi.",
  },
  {
    icon: "suppliers",
    otsikko: "Toimittajat",
    teksti: "Ostot toimittajittain ja tunnistetut ketjut.",
  },
];

const VIRTA: { vaihe: string; selite: string }[] = [
  { vaihe: "Myynti", selite: "Ilta päättyy" },
  { vaihe: "Kassaraportti", selite: "Kuvaa tai kirjaa" },
  { vaihe: "Kate", selite: "Yhdistää ja tarkistaa" },
  { vaihe: "Kirjanpito", selite: "Syntyy itsestään" },
  { vaihe: "Raportit ja ALV", selite: "Valmiina kuun lopussa" },
];

const DIAT: Dia[] = [
  {
    id: "kansi",
    otsikko: "Kate",
    sisalto: (
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <span className="text-[28px] font-bold tracking-[-0.03em]">Kate</span>
        </div>

        <h2 className="mt-8 text-[clamp(30px,4.6vw,60px)] font-bold leading-[1.02] tracking-[-0.04em]">
          Näe mihin raha menee.
          <br />
          <span style={{ color: "var(--rf-accent)" }}>
            Ja paljonko jää käteen.
          </span>
        </h2>

        <p
          className="mt-6 max-w-[58ch] text-[clamp(15px,1.4vw,19px)] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Kate kokoaa myynnin, kuitit ja kulut yhteen näkymään. Kuvaat kuitin
          tai kassaraportin, ja Kate hoitaa loput.
        </p>

        <p
          className="mt-10 text-[12.5px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--rf-text-3)" }}
        >
          Tuote-esittely
        </p>
      </div>
    ),
  },

  {
    id: "ongelma",
    otsikko: "Lähtötilanne",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Lähtötilanne</Silmays>
        <Otsikko>Talous selviää vasta kuukausia myöhemmin.</Otsikko>
        <Leipa>
          Yrittäjä tietää mitä kassassa on tänään, mutta ei sitä mitä illasta
          jäi käteen. Tieto on kolmessa paikassa: kuitit laatikossa, myynti
          kassajärjestelmässä ja kirjanpito tilitoimistossa.
        </Leipa>

        <div className="mt-7 grid gap-3.5 sm:grid-cols-3">
          {[
            {
              otsikko: "Kuitit",
              teksti:
                "Kassi kuitteja kerran kuussa. Osa ehtii kadota, osa haalistua.",
            },
            {
              otsikko: "Excel",
              teksti:
                "Luvut kirjoitetaan uudestaan käsin, ja virhe löytyy vasta lopussa.",
            },
            {
              otsikko: "Arvailu",
              teksti:
                "Tulos selviää kun kuukausi on ohi eikä siihen voi enää vaikuttaa.",
            },
          ].map((k) => (
            <Ruutu key={k.otsikko} sävy="upotus">
              <p className="text-[14px] font-bold">{k.otsikko}</p>
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {k.teksti}
              </p>
            </Ruutu>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: "ratkaisu",
    otsikko: "Ratkaisu",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Ratkaisu</Silmays>
        <Otsikko>Kirjaa kerran. Kate hoitaa loput.</Otsikko>
        <Leipa>
          Yksi kassaraportti päivittää myynnin, ALV:n, kirjanpidon ja raportit.
          Mitään ei tarvitse kirjoittaa kahteen kertaan.
        </Leipa>

        <div className="mt-8 grid gap-3.5 sm:grid-cols-3">
          {[
            {
              icon: "receipt" as IconName,
              otsikko: "Kuitista kirjaus sekunneissa",
              teksti:
                "Ota kuva puhelimella. Kate lukee toimittajan, rivit, ALV:n ja kategorian — sinä tarkistat ja tallennat.",
            },
            {
              icon: "trend" as IconName,
              otsikko: "Tulos näkyy heti",
              teksti:
                "Myynti miinus kulut päivä ja kuukausi kerrallaan. Näet mikä tuottaa ja mitkä kulut kasvavat.",
            },
            {
              icon: "ledger" as IconName,
              otsikko: "Kirjanpito ajan tasalla",
              teksti:
                "Kuitit ja myyntipäivät kirjautuvat sitä mukaa kun ne tallennetaan. Kirjanpitäjä näkee samat luvut.",
            },
          ].map((k) => (
            <Ruutu key={k.otsikko}>
              <Kuvake name={k.icon} />
              <p className="mt-2.5 text-[14.5px] font-bold">{k.otsikko}</p>
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {k.teksti}
              </p>
            </Ruutu>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: "virta",
    otsikko: "Miten se toimii",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Miten se toimii</Silmays>
        <Otsikko>Ilta päättyy — kirjanpito on valmis.</Otsikko>

        <div className="mt-9 grid gap-3 md:grid-cols-5">
          {VIRTA.map((v, i) => (
            <div key={v.vaihe} className="relative">
              <Ruutu sävy={i === 2 ? "pinta" : "upotus"}>
                <span
                  className="rf-tabular inline-flex h-7 w-7 items-center justify-center text-[12px] font-bold"
                  style={{
                    background:
                      i === 2 ? "var(--rf-accent)" : "var(--rf-accent-bg)",
                    color: i === 2 ? "var(--rf-on-accent)" : "var(--rf-accent)",
                    borderRadius: 999,
                  }}
                >
                  {i + 1}
                </span>
                <p className="mt-2.5 text-[14px] font-bold">{v.vaihe}</p>
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {v.selite}
                </p>
              </Ruutu>
            </div>
          ))}
        </div>

        <Huomio>
          Sama aineisto kulkee koko ketjun läpi. Kun kuitti on tallennettu, se
          näkyy kuluissa, kirjanpidossa, ALV-laskelmassa ja raporteissa ilman
          erillistä siirtoa.
        </Huomio>
      </div>
    ),
  },

  {
    id: "ominaisuudet",
    otsikko: "Ominaisuudet",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Ominaisuudet</Silmays>
        <Otsikko>Kaikki mitä yrityksesi talous tarvitsee.</Otsikko>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {OMINAISUUDET.map((o) => (
            <OminaisuusRuutu key={o.otsikko} {...o} />
          ))}
        </div>
      </div>
    ),
  },

  {
    id: "nakyma",
    otsikko: "Yleiskatsaus",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Silmays>Nain se nayttaa</Silmays>
            <Otsikko>Kuukausi yhdella silmayksella.</Otsikko>
          </div>
          <Esimerkkimerkki />
        </div>

        {/*
          Nama ovat sovelluksen omat kortit ja kaavio, eivat kuvat.
          Asiakas nakee esittelyssa saman pinnan jonka han nakee
          ensimmaisella kirjautumisella — kuvakaappaus vanhenisi
          seuraavassa julkaisussa, tama ei.
        */}
        <div className="mt-5 grid auto-rows-fr grid-cols-2 gap-2.5 xl:grid-cols-4">
          <MetricCard
            label="Myynti"
            value={euro(MYYNTI)}
            icon={<RfIcon name="sales" size={17} />}
            tileTone="blue"
            tone="muted"
            conclusion="Syyskuu 2026"
          />
          <MetricCard
            label="Kulut"
            value={euro(KULUT)}
            icon={<RfIcon name="expenses" size={17} />}
            tileTone="violet"
            tone="muted"
            conclusion="Kirjatut kulut"
          />
          <MetricCard
            label="Tulos"
            value={euro(TULOS)}
            icon={<RfIcon name="trend" size={17} />}
            tileTone="green"
            tone="up"
            delta={{ text: "35 % myynnista", tone: "up" }}
            conclusion="Myynti miinus kulut"
          />
          <MetricCard
            label="Kuitit"
            value="38"
            icon={<RfIcon name="receipt" size={17} />}
            tileTone="brand"
            tone="muted"
            conclusion="Kaikki tarkistettu"
          />
        </div>

        <div className="mt-3.5 min-h-0 flex-1">
          <Ruutu>
            <p className="text-[13px] font-bold">Myynti ja kulut</p>
            <div className="mt-2">
              <AreaChart
                labels={VIIKOT}
                series={[
                  {
                    label: "Myynti",
                    color: "var(--rf-blue)",
                    points: MYYNTI_VIIKOT,
                  },
                  {
                    label: "Kulut",
                    color: "var(--rf-accent)",
                    points: KULUT_VIIKOT,
                  },
                ]}
                format={euro}
                ariaLabel="Myynti ja kulut viikoittain"
              />
            </div>
          </Ruutu>
        </div>
      </div>
    ),
  },

  {
    id: "kulut",
    otsikko: "Kulut",
    sisalto: (
      <Kaksipalsta
        vasen={
          <>
            <Silmays>Nain se nayttaa</Silmays>
            <Otsikko>Mihin raha meni.</Otsikko>
            <Leipa>
              Jokainen kuitti osuu kategoriaan, ja kategoriat kertovat
              kuukauden kuvan ilman etta mitaan lasketaan kasin. Rivia
              napsauttamalla naet kuitit joista se koostuu.
            </Leipa>
            <Huomio>
              Kategoriat tulevat toimialasta: ravintolalla ruoka ja juomat,
              parturilla tuotteet ja tarvikkeet. Omia voi lisata.
            </Huomio>
          </>
        }
        oikea={
          <Ruutu>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold">Kulujakauma</p>
              <Esimerkkimerkki />
            </div>

            <div
              className="mt-3 space-y-3 border-t pt-3"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {JAKAUMA.map((rivi) => (
                <div key={rivi.nimi}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold">{rivi.nimi}</span>
                    <span className="rf-tabular">
                      {euro(Math.round((KULUT * rivi.osuus) / 100))} ·{" "}
                      {rivi.osuus} %
                    </span>
                  </div>

                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        width: rivi.osuus + "%",
                        height: "100%",
                        background: rivi.savy,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Ruutu>
        }
      />
    ),
  },

  {
    id: "kuitit",
    otsikko: "Kuitit",
    sisalto: (
      <Kaksipalsta
        vasen={
          <>
            <Silmays>Kuitit</Silmays>
            <Otsikko>Kuvasta riveiksi.</Otsikko>
            <Leipa>
              Kate lukee kuitista toimittajan, päivän, rivit, ALV-kannat ja
              kulukategorian. Tunnistetut kauppaketjut näkyvät omalla
              tunnuksellaan, joten ostot löytyvät myöhemmin nimellä eikä
              muistin varassa.
            </Leipa>
            <Huomio>
              Ehdotus tulee tarkistettavaksi, ei suoraan kirjanpitoon. Sinä
              päätät mikä tallennetaan.
            </Huomio>
          </>
        }
        oikea={
          <Ruutu>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold">Kuitti luettu</p>
              <span
                className="px-2 py-1 text-[11px] font-bold"
                style={{
                  background: "var(--rf-accent-bg)",
                  color: "var(--rf-accent)",
                  borderRadius: 999,
                }}
              >
                Esimerkki
              </span>
            </div>

            <div
              className="mt-3 space-y-2 border-t pt-3 text-[13px]"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {[
                ["Toimittaja", "Tukkutoimitus Oy"],
                ["Päivä", "14.8.2026"],
                ["Kategoria", "Ruoka"],
                ["ALV 14 %", "18,20 €"],
                ["Yhteensä", "148,20 €"],
              ].map(([nimi, arvo], i, rivit) => (
                <div
                  key={nimi}
                  className="flex items-baseline justify-between gap-4"
                  style={{
                    fontWeight: i === rivit.length - 1 ? 700 : 400,
                  }}
                >
                  <span style={{ color: "var(--rf-text-3)" }}>{nimi}</span>
                  <span className="rf-tabular">{arvo}</span>
                </div>
              ))}
            </div>
          </Ruutu>
        }
      />
    ),
  },

  {
    id: "kirjanpito",
    otsikko: "Kirjanpito ja ALV",
    sisalto: (
      <Kaksipalsta
        vasen={
          <>
            <Silmays>Kirjanpito ja ALV</Silmays>
            <Otsikko>Kaksinkertainen kirjanpito syntyy itsestään.</Otsikko>
            <Leipa>
              Jokaisesta kuitista ja myyntipäivästä muodostuu kirjaus
              tilikartalle. Kuukauden päättäminen lukitsee jakson, ja
              päiväkirja, pääkirja, tuloslaskelma ja tase ovat valmiina.
            </Leipa>
            <Huomio>
              Kate valmistelee ALV-luvut kirjanpidosta ja kertoo mitä sinun
              pitää tehdä. Ilmoituksen teet itse OmaVerossa — Kate ei lähetä
              sitä puolestasi.
            </Huomio>
          </>
        }
        oikea={
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { otsikko: "Päiväkirja", teksti: "Tapahtumat aikajärjestyksessä" },
              { otsikko: "Pääkirja", teksti: "Tileittäin eriteltynä" },
              { otsikko: "Tuloslaskelma", teksti: "Tuotot ja kulut" },
              { otsikko: "Tase", teksti: "Varat ja velat" },
            ].map((k) => (
              <Ruutu key={k.otsikko} sävy="upotus">
                <p className="text-[13.5px] font-bold">{k.otsikko}</p>
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {k.teksti}
                </p>
              </Ruutu>
            ))}
          </div>
        }
      />
    ),
  },

  {
    id: "tyoaika",
    otsikko: "Työaika ja palkkakulut",
    sisalto: (
      <Kaksipalsta
        vasen={
          <>
            <Silmays>Työaika ja palkkakulut</Silmays>
            <Otsikko>Työvuoro maksaa jotain jo tänään.</Otsikko>
            <Leipa>
              Työntekijä leimaa vuoron alun ja lopun omilla tunnuksillaan.
              Toteutuneista minuuteista lasketaan arvioitu työnantajakustannus:
              palkka, työaikalisät, arvioitu lomakustannus ja sivukulut.
              Työaikalisät tulevat yritykselle määritetystä
              työehtosopimuksesta, ja vuoron päivä ratkaisee minkä
              sopimuskauden arvoja käytetään.
            </Leipa>
            <Huomio>
              Kate ei laske palkkoja. Ennakonpidätys, sairausajan palkka ja
              lomapäivät tulevat palkkapalvelusta — tämä arvioi vain
              työnantajan kustannuksen.
            </Huomio>
          </>
        }
        oikea={
          <Ruutu>
            <p className="text-[13px] font-bold">Arvioitu työnantajakustannus</p>
            <p
              className="mt-1 text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              Esimerkki: iltavuoro 5 h, tuntipalkka 14,50 €
            </p>

            <div
              className="mt-3 space-y-2 border-t pt-3 text-[13px]"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {[
                ["Palkka", "72,50 €"],
                ["Työaikalisät", "7,00 €"],
                ["Arvioitu lomakustannus", "9,14 €"],
                ["Sivukulut", "20,42 €"],
              ].map(([nimi, arvo]) => (
                <div key={nimi} className="flex justify-between gap-4">
                  <span style={{ color: "var(--rf-text-3)" }}>{nimi}</span>
                  <span className="rf-tabular">{arvo}</span>
                </div>
              ))}

              <div
                className="flex justify-between gap-4 border-t pt-2 text-[15px] font-bold"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <span>Yhteensä</span>
                <span className="rf-tabular">109,06 €</span>
              </div>
            </div>
          </Ruutu>
        }
      />
    ),
  },

  {
    id: "kaytto",
    otsikko: "Käyttäjät",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Käyttäjät</Silmays>
        <Otsikko>Jokainen näkee sen mikä hänelle kuuluu.</Otsikko>

        <div className="mt-7 grid gap-3.5 sm:grid-cols-3">
          {[
            {
              icon: "staff" as IconName,
              otsikko: "Omistaja",
              teksti:
                "Näkee kaiken: myynnin, kulut, kirjanpidon, työntekijät ja asetukset.",
            },
            {
              icon: "ledger" as IconName,
              otsikko: "Kirjanpitäjä",
              teksti:
                "Omat tunnukset samoihin lukuihin. Ei pääsyä työntekijöiden tietoihin.",
            },
            {
              icon: "clock" as IconName,
              otsikko: "Työntekijä",
              teksti:
                "Näkee vain oman työaikansa ja omat leimauksensa — ei muiden.",
            },
          ].map((k) => (
            <Ruutu key={k.otsikko}>
              <Kuvake name={k.icon} />
              <p className="mt-2.5 text-[14.5px] font-bold">{k.otsikko}</p>
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {k.teksti}
              </p>
            </Ruutu>
          ))}
        </div>

        <Huomio>
          Käyttöliittymä on saatavilla suomeksi, englanniksi, ruotsiksi,
          tanskaksi, viroksi, turkiksi ja arabiaksi. Kate toimii selaimessa ja
          puhelimessa ilman erillistä sovellusta.
        </Huomio>
      </div>
    ),
  },

  {
    id: "turva",
    otsikko: "Tietoturva",
    sisalto: (
      <div className="flex flex-1 flex-col">
        <Silmays>Tietoturva</Silmays>
        <Otsikko>Yrityksen luvut ovat yrityksen omat.</Otsikko>

        <div className="mt-7 grid gap-3.5 sm:grid-cols-2">
          {[
            {
              otsikko: "Erottelu tehdään tietokannassa",
              teksti:
                "Jokainen rivi on sidottu yritykseen, ja pääsy tarkistetaan tietokannassa asti — ei pelkästään käyttöliittymässä.",
            },
            {
              otsikko: "Tiedostot yksityisiä",
              teksti:
                "Sopimukset ja tositteet tallennetaan yksityiseen säilöön. Julkisia linkkejä ei muodosteta.",
            },
            {
              otsikko: "Toimintaloki",
              teksti:
                "Kuka teki mitä ja milloin. Kuukauden lukitus, muutokset ja poistot jäävät näkyviin.",
            },
            {
              otsikko: "Palkkatiedot rajattu",
              teksti:
                "Tuntipalkat ja leimaukset näkyvät vain niille, joiden rooli sen sallii.",
            },
          ].map((k) => (
            <Ruutu key={k.otsikko} sävy="upotus">
              <p className="text-[14px] font-bold">{k.otsikko}</p>
              <p
                className="mt-1.5 text-[12.5px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {k.teksti}
              </p>
            </Ruutu>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: "hinta",
    otsikko: "Hinta",
    sisalto: (
      <Kaksipalsta
        vasen={
          <>
            <Silmays>Hinta</Silmays>
            <Otsikko>Yksi hinta. Kaikki mukana.</Otsikko>
            <Leipa>
              Ei käyttäjäkohtaisia maksuja eikä lisäosia. Kirjanpitäjäsi pääsee
              mukaan samaan hintaan.
            </Leipa>
            <Huomio>
              Luomme tunnukset ja otamme Katen käyttöön puolestasi.
            </Huomio>
          </>
        }
        oikea={
          <Ruutu>
            <div className="flex items-center gap-2">
              <Logo size={20} />
              <span className="text-[14px] font-bold">Kate</span>
            </div>

            <p className="mt-4">
              <span className="rf-tabular text-[clamp(38px,5vw,56px)] font-bold leading-none tracking-[-0.04em]">
                79
              </span>
              <span
                className="ms-1 text-[15px] font-semibold"
                style={{ color: "var(--rf-text-2)" }}
              >
                € / kk
              </span>
            </p>

            <p
              className="mt-1.5 text-[12.5px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              790 € / vuosi · säästä 158 € vuodessa
            </p>

            <div
              className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3.5 text-[12.5px]"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {[
                "Kuitit",
                "Kulut",
                "Myynti ja kassa",
                "Kirjanpito",
                "ALV ja veroasiat",
                "Raportit",
                "Henkilöstökulut",
                "Matti-avustaja",
                "Tehtävät",
                "Tiedostot",
              ].map((n) => (
                <span key={n} className="flex items-center gap-1.5">
                  <span style={{ color: "var(--rf-accent)" }}>
                    <RfIcon name="check" size={14} />
                  </span>
                  {n}
                </span>
              ))}
            </div>
          </Ruutu>
        }
      />
    ),
  },

  {
    id: "aloitus",
    otsikko: "Aloitetaan",
    sisalto: (
      <div className="flex flex-1 flex-col justify-center">
        <Silmays>Aloitetaan</Silmays>

        <h2 className="mt-3 text-[clamp(28px,4.2vw,54px)] font-bold leading-[1.04] tracking-[-0.04em]">
          Yrityksen talous.
          <br />
          <span style={{ color: "var(--rf-accent)" }}>Yksinkertaisemmin.</span>
        </h2>

        <div className="mt-7 space-y-2.5">
          {[
            "Luomme tunnukset ja otamme Katen käyttöön puolestasi",
            "Kirjanpitäjäsi pääsee mukaan omilla tunnuksillaan",
            "Yksi hinta, ei käyttäjäkohtaisia maksuja",
          ].map((r) => (
            <p key={r} className="flex items-start gap-2.5 text-[15px]">
              <span className="mt-0.5" style={{ color: "var(--rf-accent)" }}>
                <RfIcon name="check" size={17} />
              </span>
              {r}
            </p>
          ))}
        </div>

        <div className="mt-9 flex items-center gap-3">
          <Logo size={26} />
          <span className="text-[17px] font-bold tracking-[-0.02em]">
            kateapp.fi
          </span>
        </div>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Esitys                                                              */
/* ------------------------------------------------------------------ */

export function Esittely() {
  const [sivu, setSivu] = useState(0);
  const kehys = useRef<HTMLDivElement>(null);
  const [kokoNaytto, setKokoNaytto] = useState(false);

  const siirry = useCallback((suunta: number) => {
    setSivu((n) => Math.min(DIAT.length - 1, Math.max(0, n + suunta)));
  }, []);

  /*
   * Näppäimistö on esityksen tärkein ohjain.
   *
   * Esittelijä seisoo näytön vieressä eikä etsi hiirtä. Nuolet,
   * välilyönti ja Page Up/Down toimivat kuten missä tahansa
   * esitysohjelmassa, myös kaukosäätimellä joka lähettää juuri niitä.
   */
  useEffect(() => {
    const kuuntele = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        siirry(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        siirry(-1);
      } else if (e.key === "Home") {
        setSivu(0);
      } else if (e.key === "End") {
        setSivu(DIAT.length - 1);
      }
    };

    window.addEventListener("keydown", kuuntele);
    return () => window.removeEventListener("keydown", kuuntele);
  }, [siirry]);

  useEffect(() => {
    const vaihtui = () => setKokoNaytto(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", vaihtui);
    return () => document.removeEventListener("fullscreenchange", vaihtui);
  }, []);

  const koko = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await kehys.current?.requestFullscreen();
  };

  /*
   * Pyyhkäisy tabletilla.
   *
   * SORMI ON TABLETIN NUOLINÄPPÄIN.
   *
   * Esittely pidetään usein tabletilta pöydän ääressä, eikä pienten
   * nuolinappien etsiminen kesken lauseen näytä hyvältä asiakkaan
   * silmissä. Vaakapyyhkäisy vaihtaa dian samaan suuntaan kuin
   * kuvagalleriassa: vasemmalle eteenpäin.
   *
   * PYSTYSUUNTA VOITTAA.
   *
   * Sivua pitää voida vierittää sormella myös dian päältä, joten ele
   * luetaan diaksi vain kun vaakaliike on selvästi pystyliikettä
   * suurempi. Hiiri jätetään rauhaan: työpöydällä raahaus on tekstin
   * maalaamista eikä eleohjausta.
   */
  const kosketus = useRef<{ x: number; y: number; id: number } | null>(null);

  const eleAlkaa = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    kosketus.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const elePaattyy = (e: React.PointerEvent) => {
    const alku = kosketus.current;
    kosketus.current = null;
    if (!alku || alku.id !== e.pointerId) return;

    const vaaka = e.clientX - alku.x;
    const pysty = e.clientY - alku.y;

    /* Lyhyt tönäisy on napautus, ja pysty on vieritystä. */
    if (Math.abs(vaaka) < 55) return;
    if (Math.abs(vaaka) < Math.abs(pysty) * 1.4) return;

    siirry(vaaka < 0 ? 1 : -1);
  };

  const dia = DIAT[sivu];

  return (
    <div className="space-y-3.5">
      <div
        ref={kehys}
        onPointerDown={eleAlkaa}
        onPointerUp={elePaattyy}
        onPointerCancel={() => {
          kosketus.current = null;
        }}
        className="relative flex flex-col overflow-hidden"
        style={{
          background: "var(--rf-bg)",
          border: "1px solid var(--rf-line)",
          borderRadius: kokoNaytto ? 0 : "var(--rf-r-card)",
          minHeight: kokoNaytto ? "100vh" : "min(78vh, 660px)",
          /* Pystyvieritys jää selaimelle, vaakaele meille. */
          touchAction: "pan-y",
        }}
      >
        {/* Edistyminen: ohut viiva ylälaidassa, ei laskuria keskellä. */}
        <div style={{ height: 3, background: "var(--rf-inset)" }}>
          <div
            style={{
              height: "100%",
              width: `${((sivu + 1) / DIAT.length) * 100}%`,
              background: "var(--rf-accent)",
              transition: "width 220ms ease",
            }}
          />
        </div>

        <div
          key={dia.id}
          className="rf-enter flex flex-1 flex-col px-6 py-7 md:px-12 md:py-11"
        >
          {dia.sisalto}
        </div>

        <div
          className="flex items-center justify-between gap-4 border-t px-4 py-2.5 md:px-6"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span
              className="text-[12px] font-semibold"
              style={{ color: "var(--rf-text-3)" }}
            >
              {dia.otsikko}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {DIAT.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSivu(i)}
                aria-label={d.otsikko}
                aria-current={i === sivu}
                className="rf-press"
                style={{
                  width: i === sivu ? 20 : 7,
                  height: 7,
                  borderRadius: 999,
                  background:
                    i === sivu ? "var(--rf-accent)" : "var(--rf-line-strong)",
                  transition: "width 180ms ease, background 180ms ease",
                }}
              />
            ))}
          </div>

          <span
            className="rf-tabular text-[12px] font-semibold"
            style={{ color: "var(--rf-text-3)" }}
          >
            {sivu + 1} / {DIAT.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Nappi onClick={() => siirry(-1)} disabled={sivu === 0}>
            <RfIcon name="back" size={16} />
            Edellinen
          </Nappi>

          <Nappi
            onClick={() => siirry(1)}
            disabled={sivu === DIAT.length - 1}
            korostettu
          >
            Seuraava
            <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
              <RfIcon name="back" size={16} />
            </span>
          </Nappi>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Pyyhkäise tai käytä nuolinäppäimiä
          </span>
          <Nappi onClick={koko}>
            {kokoNaytto ? "Poistu koko näytöstä" : "Koko näyttö"}
          </Nappi>
        </div>
      </div>
    </div>
  );
}

function Nappi({
  children,
  onClick,
  disabled,
  korostettu,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  korostettu?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold disabled:opacity-40"
      style={{
        background: korostettu ? "var(--rf-accent)" : "var(--rf-bg)",
        color: korostettu ? "var(--rf-on-accent)" : "var(--rf-text)",
        border: korostettu ? "none" : "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
        minHeight: 36,
      }}
    >
      {children}
    </button>
  );
}
