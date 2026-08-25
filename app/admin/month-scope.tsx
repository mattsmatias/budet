"use client";

import { usePathname } from "next/navigation";
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
  /* Vain lista ja kalenteri lukevat kuukauden, ei koko työvuorosivu. */
  "/admin/tyovuorot/lista",
  "/admin/tyovuorot/kalenteri",
];

export function MonthScope({ value, months }: { value: string; months: string[] }) {
  const pathname = usePathname();

  /*
   * Tarkka osuma tai alipolku. Ilman alipolkua /admin/raportit/tulosta
   * menettäisi valitsimen vaikka se lukee kuukauden, ja /admin saisi
   * sen jokaisella sivulla — se on kaikkien etuliite.
   */
  const shown = MONTHLY.some((route) =>
    route === "/admin" ? pathname === "/admin" : pathname.startsWith(route),
  );

  if (!shown) return null;

  return <MonthPicker value={value} months={months} />;
}
