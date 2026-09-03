import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { formatDayIn } from "@/lib/i18n/labels";
import { lookupReservation } from "@/lib/restoflow/public-reservations";
import { CancelForm } from "./cancel-form";

/**
 * Asiakkaan oma varaussivu.
 *
 * Osoitteessa oleva tunnus on koko todiste: sen tietävä saa nähdä ja
 * perua varauksen. Se on tarkoituksellinen — vaihtoehto olisi vaatia
 * asiakasta luomaan tunnus Kateen, ja pöydän varaaminen ei ole syy
 * perustaa käyttäjätiliä.
 *
 * Tunnus on 64 heksamerkkiä eli 244 bittiä satunnaisuutta, ja kannassa
 * siitä on vain sha256-tiiviste. Arvaaminen ei onnistu, eikä vuotanut
 * tietokantavarmuuskopio anna kenellekään pääsyä.
 *
 * Sivua ei indeksoida. Varauslinkki hakukoneessa olisi juuri se mitä
 * tässä yritetään välttää.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return {
    title: t.varausJulkinen.yourBooking,
    robots: { index: false, follow: false },
  };
}

export default async function ReservationPage({
  params,
}: PageProps<"/varaus/[token]">) {
  const { token } = await params;
  const locale = await resolveLocale();
  const t = adminText(locale);

  const reservation = /^[0-9a-f]{64}$/.test(token)
    ? await lookupReservation(token)
    : null;

  if (!reservation) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-16">
        <h1 className="text-[24px] font-bold tracking-tight">
          {t.varausJulkinen.notFoundTitle}
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausJulkinen.notFoundBody}
        </p>
      </main>
    );
  }

  const rows: [string, string][] = [
    [t.varausJulkinen.restaurant, reservation.restaurantName],
    [t.varausJulkinen.date, formatDayIn(reservation.date, locale)],
    [t.varausJulkinen.time, reservation.time],
    [
      t.varausJulkinen.guests,
      fill(t.varausJulkinen.guestsCount, {
        maara: String(reservation.partySize),
      }),
    ],
    [t.varausJulkinen.guestName, reservation.guestName],
  ];

  /* Varausnumero viimeisenä: se etsitään täältä, sitä ei muisteta. */
  if (reservation.reference) {
    rows.push([t.varausJulkinen.reference, reservation.reference]);
  }

  /*
   * Miksi peruutuspainiketta ei ole.
   *
   * Kaksi eri syytä näyttivät ennen samalta: mennyt aika ja liian
   * lähellä oleva aika. Jälkimmäisessä asiakas voi yhä perua
   * soittamalla, ja juuri se on se lause jota hän tältä sivulta hakee.
   *
   * Syyn päättää kanta. Se on kellonaikakysymys, ja kellon lukeminen
   * kesken palvelinpiirron on tulos joka voi muuttua ilman että mikään
   * muuttui.
   */
  const cutoff = reservation.cancelCutoffHours ?? 0;
  const liianMyohaan = reservation.cancelBlocked === "cutoff";

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-12 sm:py-16">
      <h1 className="text-[24px] font-bold tracking-tight sm:text-[28px]">
        {t.varausJulkinen.yourBooking}
      </h1>

      <dl
        className="mt-6 grid gap-x-6 gap-y-2 p-5"
        style={{
          gridTemplateColumns: "auto 1fr",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-card)",
        }}
      >
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              {label}
            </dt>
            <dd className="text-[14px] font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {reservation.cancellable ? (
        <CancelForm
          token={token}
          labels={{
            cancel: t.varausJulkinen.cancel,
            cancelling: t.varausJulkinen.cancelling,
            cancelled: t.varausJulkinen.cancelled,
            cancelledBody: t.varausJulkinen.cancelledBody,
            failed: t.varausJulkinen.cancelFailed,
            already: t.varausJulkinen.already,
            past: t.varausJulkinen.past,
            notFound: t.varausJulkinen.notFoundBody,
            cutoff: t.varausJulkinen.cutoff,
          }}
        />
      ) : reservation.status === "cancelled" ? (
        /*
         * Peruttu varaus näyttää saman kuitin kuin juuri peruttu.
         *
         * "Tämä varaus on jo peruttu" lukee moitteena — se on oikea
         * teksti epäonnistuneelle toiselle yritykselle lomakkeessa,
         * mutta väärä sille joka avaa linkin nähdäkseen tilanteen.
         * Kysymys johon hän hakee vastausta on "onko tämä peruttu",
         * ja vastaus on kyllä.
         */
        <div
          role="status"
          className="mt-6 p-5"
          style={{
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          <p className="text-[16px] font-semibold">
            {t.varausJulkinen.cancelled}
          </p>
          <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            {t.varausJulkinen.cancelledBody}
          </p>
        </div>
      ) : liianMyohaan ? (
        <p className="mt-6 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {fill(t.varausJulkinen.cutoff, { tunnit: String(cutoff) })}
        </p>
      ) : (
        <p className="mt-6 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausJulkinen.past}
        </p>
      )}
    </main>
  );
}
