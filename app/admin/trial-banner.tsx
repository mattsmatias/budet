import type { AdminText } from "@/lib/i18n/admin-text";
import { CONTACT_URL } from "@/lib/kate-contact";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";
import { formatDayIn } from "@/lib/i18n/labels";
import { RfIcon } from "@/components/restoflow/icons";
import { trialState } from "@/lib/restoflow/trial";

/**
 * Kokeilun tila sovelluksen ylälaidassa.
 *
 * KOLME SÄVYÄ, EI KOLMEA BANNERIA.
 *
 * Kokeilun alkupäivinä rivi on hiljainen: se kertoo montako päivää on
 * jäljellä eikä vaadi mitään. Viimeisellä viikolla se muuttuu
 * huomiovärille, ja päättymisen jälkeen se kertoo mitä seuraavaksi.
 * Sama rivi koko ajan samassa paikassa on helpompi oppia lukemaan
 * kuin kolme eri ilmoitusta jotka ilmestyvät eri kohtiin.
 *
 * EI SULJE OVEA.
 *
 * Päättynyt kokeilu ei estä käyttöä eikä piilota lukuja. Sovelluksessa
 * ei ole maksutapaa, joten lukitseminen jättäisi asiakkaan tilaan
 * jossa hän ei voi maksaa vaikka haluaisi. Katkaisu on myynnin päätös
 * ja tehdään hallinnasta.
 */
export function TrialBanner({
  status,
  trialEndsOn,
  today,
  locale,
  t,
}: {
  status: string;
  trialEndsOn: string | null;
  today: string;
  locale: AppLocale;
  t: AdminText;
}) {
  const tila = trialState(status, trialEndsOn, today);
  if (tila.kind === "none") return null;

  const paiva = formatDayIn(tila.endsOn!, locale);

  const savy =
    tila.kind === "ended"
      ? {
          bg: "var(--rf-red-bg)",
          text: "var(--rf-red-text)",
          icon: "alert" as const,
        }
      : tila.kind === "ending"
        ? {
            bg: "var(--rf-amber-bg)",
            text: "var(--rf-amber-text)",
            icon: "clock" as const,
          }
        : {
            bg: "var(--rf-inset)",
            text: "var(--rf-text-2)",
            icon: "clock" as const,
          };

  const otsikko =
    tila.kind === "ended"
      ? fill(t.kokeilu.ended, { paiva })
      : tila.daysLeft === 0
        ? t.kokeilu.lastDay
        : fill(t.kokeilu.daysLeft, { maara: String(tila.daysLeft) });

  const selite =
    tila.kind === "ended"
      ? t.kokeilu.nothingLost
      : tila.kind === "ending"
        ? t.kokeilu.keepGoing
        : fill(t.kokeilu.endsOn, { paiva });

  return (
    <div
      className="rf-no-print flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[12.5px] md:px-6"
      style={{ background: savy.bg, color: savy.text }}
    >
      <span className="inline-flex items-center gap-1.5 font-bold">
        <RfIcon name={savy.icon} size={15} />
        {t.kokeilu.label}
      </span>

      <span className="font-semibold">{otsikko}</span>
      <span className="min-w-0">{selite}</span>

      {/*
        Yhteydenotto on ainoa tie eteenpäin, joten se on rivillä eikä
        ohjeessa: asiakas ei voi itse maksaa sovelluksessa.

        Linkki osoitti ensin asetuksiin, jossa ei ole mitään tapaa
        ottaa yhteyttä. Kehotus joka vie umpikujaan on pahempi kuin
        ei kehotusta lainkaan, joten se osoittaa nyt etusivun
        lomakkeeseen — se kirjoittaa contact_requests-tauluun ja
        viesti nakyy konsolissa samana päivänä.
      */}
      <a
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rf-press ms-auto shrink-0 font-bold underline-offset-4 hover:underline"
      >
        {t.kokeilu.contact} →
      </a>
    </div>
  );
}
