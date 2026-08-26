/**
 * Järjestelmän tila.
 *
 * VIHREÄ VALO ON MITATTAVA, EI PIIRRETTÄVÄ.
 *
 * Tilanäyttö joka näyttää aina vihreää on pahempi kuin ei mitään: se
 * kertoo että kaikki on kunnossa juuri silloin kun asiakas soittaa
 * ettei mikään toimi. Siksi jokainen rivi tässä tekee oikean
 * kokeilun ja mittaa siihen kuluneen ajan.
 *
 * Mitä ei voi mitata, sitä ei väitetä toimivaksi. Sähköposti ja
 * maksuintegraatio eivät ole Budetissa konfiguroituina, joten ne
 * raportoidaan "ei käytössä" eikä vihreänä.
 */

import { createClient } from "@/utils/supabase/server";

export type CheckState = "ok" | "warn" | "down" | "off";

export interface Check {
  key: string;
  label: string;
  state: CheckState;
  detail: string;
  /** Vasteaika millisekunteina, jos mittaus tehtiin. */
  ms: number | null;
}

/** Hidas mutta toimiva on eri asia kuin rikki. */
const HIDAS_MS = 1500;

async function mittaa(
  key: string,
  label: string,
  probe: () => Promise<{ ok: boolean; detail: string }>,
): Promise<Check> {
  const alku = Date.now();
  try {
    const { ok, detail } = await probe();
    const ms = Date.now() - alku;
    return {
      key,
      label,
      state: !ok ? "down" : ms > HIDAS_MS ? "warn" : "ok",
      detail: ok && ms > HIDAS_MS ? `${detail} — vaste hidas` : detail,
      ms,
    };
  } catch (error) {
    return {
      key,
      label,
      state: "down",
      detail: error instanceof Error ? error.message : "Tuntematon virhe",
      ms: Date.now() - alku,
    };
  }
}

export async function runChecks(): Promise<Check[]> {
  const supabase = await createClient();

  return Promise.all([
    /*
     * Tietokanta.
     *
     * Kevyt oikea kysely eikä "select 1": rivikäytäntöjen läpi kulkeva
     * kysely kertoo että myös RLS toimii, ei vain että yhteys on auki.
     */
    mittaa("db", "Tietokanta", async () => {
      const { error } = await supabase.from("feature_flags").select("key").limit(1);
      if (error) return { ok: false, detail: error.message };
      return { ok: true, detail: "Kysely läpi rivikäytäntöjen" };
    }),

    /*
     * Tunnistautuminen.
     *
     * Istunto varmennetaan paikallisesti julkisella avaimella, joten
     * tämä mittaa myös sen että avainjoukko on saatavilla.
     */
    mittaa("auth", "Tunnistautuminen", async () => {
      const { data, error } = await supabase.auth.getClaims();
      if (error) return { ok: false, detail: error.message };
      return {
        ok: true,
        detail: data ? "Istunto varmennettu" : "Ei istuntoa, palvelu vastaa",
      };
    }),

    /*
     * Tallennustila.
     *
     * Kuittikuvat ovat siellä. Jos tämä on poikki, kuitin voi kirjata
     * muttei kuvaa liittää — ja se selviää vasta käyttäjän kokeillessa.
     */
    mittaa("storage", "Tallennustila", async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) return { ok: false, detail: error.message };
      const n = data?.length ?? 0;
      return { ok: true, detail: `${n} ${n === 1 ? "kansio" : "kansiota"}` };
    }),

    /*
     * Super Adminin oikeus.
     *
     * Tämä kokeilee samaa porttia jota konsolin jokainen kysely
     * käyttää. Jos se on rikki, konsoli näyttää tyhjää eikä syy
     * muuten selviäisi.
     */
    mittaa("gate", "Ylläpitäjän oikeus", async () => {
      const { error } = await supabase.rpc("sa_overview");
      if (error) return { ok: false, detail: error.message };
      return { ok: true, detail: "sa_-funktiot vastaavat" };
    }),

    /*
     * Matti.
     *
     * Avaimen olemassaolo tarkistetaan, ei sen arvoa eikä toimivuutta:
     * oikea kutsu maksaisi rahaa jokaisella sivulatauksella. Puuttuva
     * avain on silti se yleisin syy siihen ettei Matti vastaa.
     */
    Promise.resolve<Check>({
      key: "ai",
      label: "Matti (AI)",
      state: process.env.ANTHROPIC_API_KEY ? "ok" : "down",
      detail: process.env.ANTHROPIC_API_KEY
        ? "Avain asetettu"
        : "ANTHROPIC_API_KEY puuttuu — Matti ei vastaa",
      ms: null,
    }),

    /*
     * Sähköposti ja maksut.
     *
     * Näitä ei ole otettu käyttöön. "Ei käytössä" on rehellinen tila:
     * vihreä väittäisi että ne toimivat, punainen että ne ovat rikki.
     */
    Promise.resolve<Check>({
      key: "email",
      label: "Sähköposti",
      state: "off",
      detail: "Ei konfiguroitu — kutsut kulkevat koodilla",
      ms: null,
    }),

    Promise.resolve<Check>({
      key: "payments",
      label: "Maksuintegraatio",
      state: "off",
      detail: "Ei konfiguroitu — paketti kirjataan käsin",
      ms: null,
    }),
  ]);
}
