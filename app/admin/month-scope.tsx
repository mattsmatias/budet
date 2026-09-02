"use client";

import { usePathname } from "next/navigation";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { AdminText } from "@/lib/i18n/admin-text";
import { MonthPicker } from "./month-picker";

/**
 * Kuukausivalitsin vain sivuilla jotka lukevat kuukauden.
 *
 * Valitsin on yläpalkissa, ja palkki on kaikilla sivuilla sama. Se
 * näkyi siis myös Lounaalla, Työntekijöissä ja Asetuksissa — sivuilla
 * jotka eivät lue ?kuukausi-parametria lainkaan. Kuukauden
 * vaihtaminen näytti tekevän jotain: osoite muuttui, näkymä ei.
 *
 * Säädin joka ei tee mitään on pahempi kuin puuttuva säädin. Ensin
 * käyttäjä kokeilee uudelleen, sitten hän lakkaa luottamasta myös
 * niihin sivuihin joilla se toimii.
 *
 * Lista on tässä eikä sivuilla, koska sivu ei voi kertoa palkille
 * mitään: palkki renderöityy kuoressa lapsen ulkopuolella.
 */
const MONTHLY = [
  "/admin",
  "/admin/kulut",
  "/admin/palkat",
  "/admin/raportit",
  /* Kirjanpidon kuukausi on koko sivun aihe, ei yhden välilehden. */
  "/admin/kirjanpito",
  /*
   * Kuitit ja Myynti näyttivät koko historian.
   *
   * Kuittilista oli yksi pino kaikesta, myyntilista viimeiset
   * kolmekymmentä päivää. Kumpikin vastaa kysymykseen "mitä tässä
   * kuussa tapahtui", ja sitä kysytään useammin kuin yhden vanhan
   * rivin etsimistä.
   */
  "/admin/kuitit",
  "/admin/myynti",
  /*
   * Toimittajat, Budjetit ja Havainnot lukivat vain kuluvan kuukauden.
   *
   * Ne kaikki vastaavat kysymykseen "miten tässä kuussa meni" — kenelle
   * raha meni, riittikö budjetti, mikä poikkesi. Kysymys on yhtä
   * mielekäs elokuusta kuin kuluvasta kuusta, mutta vastausta ei
   * päässyt katsomaan.
   */
  "/admin/toimittajat",
  "/admin/budjetit",
  "/admin/havainnot",
  /* Vain lista ja kalenteri lukevat kuukauden, ei koko työvuorosivu. */
  "/admin/tyovuorot/lista",
  "/admin/tyovuorot/kalenteri",
  /*
   * Varauksista vain analytiikka.
   *
   * Salinäkymä lukee päivän ja asetukset ei kumpaakaan. Kuukauden
   * vaihtaminen niillä näyttäisi tekevän jotain mitä se ei tee.
   */
  "/admin/varaukset/analytiikka",
];

/**
 * Lukeeko tämä sivu kuukauden?
 *
 * Tarkka osuma tai alipolku. Ilman alipolkua /admin/raportit/tulosta
 * menettäisi valitsimen vaikka se lukee kuukauden, ja /admin saisi sen
 * jokaisella sivulla — se on kaikkien etuliite.
 */
function useMonthly(): boolean {
  const pathname = usePathname();

  return MONTHLY.some((route) =>
    route === "/admin" ? pathname === "/admin" : pathname.startsWith(route),
  );
}

/** Työpöydän yläpalkkiin. */
export function MonthScope({
  t,
  value,
  months,
  locale,
}: {
  t: AdminText;
  value: string;
  months: string[];
  locale: AppLocale;
}) {
  if (!useMonthly()) return null;

  return <MonthPicker t={t} value={value} months={months} locale={locale} />;
}

/**
 * Puhelimen oma rivi.
 *
 * KOLME PAINIKETTA EI MAHDU OTSIKKOPALKKIIN.
 *
 * Puhelimen palkissa on ravintolan nimi, käyttäjä, kello ja tunnus.
 * Valitsin sinne ahdettuna olisi puristanut nimen muutamaan merkkiin.
 * Omalla rivillään se saa täyden leveyden eikä vie mitään muuta pois.
 *
 * Rivi ei ole tarttuva. Kuukauden vaihtaminen on kerran katsomisen
 * aikana tehtävä valinta, ei jatkuvasti käsillä oleva säädin — ja
 * tarttuva rivi söisi pystytilaa juuri siltä sisällöltä jota
 * katsotaan.
 *
 * Ilman tätä kuukautta ei voinut vaihtaa puhelimessa lainkaan:
 * yläpalkki on md:flex, joten valitsin katosi kapealla ruudulla
 * kokonaan kaikilta kuukausisivuilta.
 */
export function MobileMonthBar({
  t,
  value,
  months,
  locale,
}: {
  t: AdminText;
  value: string;
  months: string[];
  locale: AppLocale;
}) {
  if (!useMonthly()) return null;

  return (
    <div
      className="rf-no-print flex justify-center border-b px-4 py-2.5 md:hidden"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-card)" }}
    >
      <MonthPicker t={t} value={value} months={months} locale={locale} />
    </div>
  );
}
