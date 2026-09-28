import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { fetchFeedback, type FeedbackStatus } from "@/lib/restoflow/feedback";
import {
  Card,
  EmptyState,
  Pill,
  SectionLabel,
  type Tone,
} from "@/components/restoflow/ui";
import { fill } from "@/lib/i18n/auth-text";
import { FeedbackForm } from "./forms";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.palaute.title };
}

/**
 * Palaute ja ongelmat.
 *
 * MIKSI TÄMÄ ON SOVELLUKSEN SISÄLLÄ.
 *
 * Maksava asiakas, joka törmäsi bugiin, ohjattiin ennen ulos julkiselle
 * myyntilomakkeelle kirjoittamaan oma yrityksensä nimi käsin — samalle
 * lomakkeelle jolla uudet asiakkaat pyytävät tunnuksia. Nyt ilmoitus
 * lähtee sieltä missä ongelma näkyy, ja se kantaa mukanaan yrityksen,
 * käyttäjän ja näkymän polun ilman että kukaan kirjoittaa niitä
 * uudelleen.
 *
 * LOMAKE ENSIN, LISTA SEN ALLA.
 *
 * Tälle sivulle tullaan kertomaan jotain, ei lukemaan. Lista on silti
 * samalla sivulla eikä oman välilehtensä takana: ilman sitä tämä olisi
 * postilaatikko johon asiat katoavat, ja lähettäjä kysyisi lopulta
 * puhelimessa mitä hänen ilmoitukselleen tapahtui.
 */
export default async function FeedbackPage() {
  const { restaurant } = await adminContext("/admin/palaute");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;

  const items = await fetchFeedback(restaurant.id);

  const tilaTeksti: Record<FeedbackStatus, string> = {
    new: t.palaute.statusNew,
    in_progress: t.palaute.statusProgress,
    done: t.palaute.statusDone,
    declined: t.palaute.statusDeclined,
  };

  /*
   * Väri kertoo onko asia liikkeessä.
   *
   * Vastaanotettu on neutraali: se ei ole hyvä eikä huono uutinen vaan
   * kuittaus. Työn alla ja korjattu ovat kumpikin edistystä, ja "ei
   * toteuteta" on vastaus siinä missä muutkin — ei virhe.
   */
  const tilaVari: Record<FeedbackStatus, Tone> = {
    new: "neutral",
    in_progress: "info",
    done: "ok",
    declined: "neutral",
  };

  const lajiTeksti = {
    bug: t.palaute.kindBug,
    idea: t.palaute.kindIdea,
    contact: t.palaute.kindContact,
  };

  const pvm = (iso: string) =>
    new Date(iso).toLocaleDateString(tag, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });

  return (
    <div className="rf-enter space-y-5">
      <header>
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">
          {t.palaute.title}
        </h1>
        <p
          className="mt-1 max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.palaute.lead}
        </p>
      </header>

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.palaute.newOne}
        </h2>
        <div className="mt-4">
          <FeedbackForm t={t} />
        </div>
      </Card>

      <section>
        <SectionLabel>{t.palaute.mine}</SectionLabel>

        {items.length === 0 ? (
          <Card>
            <EmptyState title={t.palaute.none} description={t.palaute.noneHint} />
          </Card>
        ) : (
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-bold tracking-[-0.0075em]">
                      {item.title}
                    </h3>
                    <p
                      className="mt-0.5 text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {lajiTeksti[item.kind]} ·{" "}
                      {fill(t.palaute.sentOn, { pvm: pvm(item.createdAt) })}
                      {item.path
                        ? ` · ${fill(t.palaute.fromView, { polku: item.path })}`
                        : ""}
                    </p>
                  </div>

                  <Pill tone={tilaVari[item.status]}>
                    {tilaTeksti[item.status]}
                  </Pill>
                </div>

                <p
                  className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {item.body}
                </p>

                {/*
                  Vastaus erottuu omalla pohjallaan.

                  Se on toisen ihmisen puhetta samassa kortissa jossa on
                  omaa: ilman erottelua ne luetaan yhtenä tekstinä.
                */}
                {item.reply ? (
                  <div
                    className="mt-3.5 rounded-[var(--rf-r-stat)] p-3.5"
                    style={{ background: "var(--rf-inset)" }}
                  >
                    <p className="text-[12px] font-bold uppercase tracking-[0.06em]"
                       style={{ color: "var(--rf-text-3)" }}>
                      {t.palaute.answer}
                      {item.repliedAt ? ` · ${pvm(item.repliedAt)}` : ""}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {item.reply}
                    </p>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
