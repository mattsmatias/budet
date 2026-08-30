import { notFound } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { loadReservationConfig } from "@/lib/restoflow/public-reservations";

/**
 * Ravintolan oma varaussivu.
 *
 * Ravintola jolla ei ole verkkosivua — tai jonka sivuun ei pääse
 * lisäämään koodia — saa tästä osoitteen jonka voi laittaa Googleen,
 * Instagramin profiiliin tai ovikylttiin.
 *
 * ---------------------------------------------------------------------
 * MIKSI TÄMÄ SIVU LATAA SAMAN WIDGETIN
 * ---------------------------------------------------------------------
 *
 * Varauslomake olisi luontevaa kirjoittaa tähän Reactilla. Silloin
 * sama lomake olisi olemassa kahdesti: kerran widgetissä ja kerran
 * täällä. Kaksi toteutusta samasta asiasta ajautuu erilleen — ensin
 * pienessä, sitten siinä mikä merkitsee, ja jompikumpi jää
 * korjaamatta.
 *
 * Sivu on siis kehys widgetin ympärillä. Se mitä asiakas näkee tästä
 * osoitteesta on sama kuin se minkä hän näkee ravintolan omalta
 * sivulta, koska se on sama koodi.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/varaa/[slug]">) {
  const { slug } = await params;
  const config = await loadReservationConfig(slug);
  const t = adminText(await resolveLocale());

  if (!config) return { title: t.varausJulkinen.bookTitle };

  return {
    title: `${t.varausJulkinen.bookTitle} · ${config.restaurantName}`,
    /* Varaussivua ei indeksoida ravintolan oman sivun ohi. */
    robots: { index: false, follow: false },
  };
}

export default async function BookingPage({
  params,
}: PageProps<"/varaa/[slug]">) {
  const { slug } = await params;
  const locale = await resolveLocale();
  const t = adminText(locale);

  const config = await loadReservationConfig(slug);
  if (!config) notFound();

  return (
    <main
      className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16"
      style={{ color: "var(--rf-text)" }}
    >
      <h1 className="text-[26px] font-bold tracking-tight sm:text-[32px]">
        {config.restaurantName}
      </h1>

      {!config.enabled ? (
        <p className="mt-3 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausJulkinen.notAvailable}
        </p>
      ) : null}

      {/*
        Kiinnityskohta ja skripti samassa järjestyksessä kuin
        upotuskoodissa. Widget odottaa DOM:in valmistumista, joten
        järjestys ei ole ehdoton — mutta tämän sivun on näytettävä
        samalta kuin ohjeen, jotta ohje on tarkistettavissa täältä.
      */}
      <div id="kate-reservation" className="mt-8" />

      <script src="/widget.js" data-restaurant={slug} data-lang={locale} defer />
    </main>
  );
}
