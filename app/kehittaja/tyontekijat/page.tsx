import { fetchKateTeam } from "@/lib/kehittaja/queries";
import { Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";
import { InviteKateForm, RemoveStaff, RevokeInvite } from "./forms";

export const metadata = { title: "Työntekijät" };

/**
 * Katen omat työntekijät.
 *
 * ERI LISTA KUIN KÄYTTÄJÄT.
 *
 * Käyttäjät-sivu on asiakkaiden ihmisiä: heillä on yritys ja rooli
 * siinä. Tämä sivu on meidän omaa väkeä, eikä heillä ole yritystä
 * lainkaan. Sama lista olisi kaksi eri asiaa samassa taulukossa, ja
 * tuen ensimmäinen kysymys ("kuka tämä on ja mihin hän kuuluu") saisi
 * kaksi eri vastausta samasta sarakkeesta.
 *
 * MITÄ TUNNUS NÄKEE.
 *
 * Katen työntekijän tunnus näkee tuote-esittelyn eikä mitään muuta.
 * Hän ei kuulu yhteenkään asiakasyritykseen, joten hallinnan sivut
 * eivät avaudu hänelle — ei siksi että ne olisi piilotettu, vaan
 * koska niissä ei ole hänelle yhtään riviä.
 */

/** Roolin nimi ihmiselle. Toistaiseksi yksi. */
const ROOLIT: Record<string, string> = {
  presenter: "Esittely",
};

function paiva(iso: string): string {
  return new Date(iso).toLocaleDateString("fi-FI");
}

/** Montako päivää kutsulla on jäljellä. Mennyt näytetään nollana. */
function paiviaJaljella(iso: string, now: Date): number {
  const ms = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default async function DevKateStaffPage() {
  const { staff, invitations } = await fetchKateTeam();
  const now = new Date();

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Työntekijät
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Katen oma väki. {staff.length}{" "}
          {staff.length === 1 ? "tunnus" : "tunnusta"} ja {invitations.length}{" "}
          {invitations.length === 1 ? "avoin kutsu" : "avointa kutsua"}.
        </p>
      </header>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader
            title="Luo tunnukset"
            subtitle="Koodi on kertakäyttöinen ja voimassa 14 päivää"
          />
        </div>

        <div className="px-5 pt-3">
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            Anna koodi työntekijälle. Hän avaa <strong>kateapp.fi/liity</strong>
            , syöttää koodin ja asettaa oman salasanansa. Salasana ei kulje
            meidän kautta, eikä koodi kelpaa toista kertaa.
          </p>
        </div>

        <InviteKateForm />
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-4">
          <CardHeader
            title="Tunnukset"
            subtitle={
              staff.length === 0
                ? "Ei vielä yhtään"
                : `${staff.length} ${
                    staff.length === 1 ? "henkilö" : "henkilöä"
                  }, näkymä: esittely`
            }
          />
        </div>

        {staff.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="Ei työntekijöitä"
              description="Luo ensimmäinen koodi yläpuolelta."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="rf-table w-full" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th className="px-5 py-3 text-start">Nimi</th>
                  <th className="px-4 py-3 text-start">Sähköposti</th>
                  <th className="px-4 py-3 text-start">Näkymä</th>
                  <th className="px-4 py-3 text-start">
                    Viimeisin kirjautuminen
                  </th>
                  <th className="px-5 py-3 text-start">Oikeus</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((s) => (
                  <tr key={s.userId}>
                    <td className="px-5 py-3 font-semibold">
                      {s.name ?? "Nimetön"}
                      {s.isSuperAdmin ? (
                        <span className="ms-2 align-middle">
                          <Pill tone="risk">Super admin</Pill>
                        </span>
                      ) : null}
                    </td>

                    <td
                      className="px-4 py-3 text-[13px]"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {s.email ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-[13px]">
                      {ROOLIT[s.role] ?? s.role}
                    </td>

                    <td
                      className="rf-tabular px-4 py-3 text-[12.5px]"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {s.lastSignInAt ? paiva(s.lastSignInAt) : "ei koskaan"}
                    </td>

                    <td className="px-5 py-3">
                      <RemoveStaff
                        userId={s.userId}
                        name={s.name ?? s.email ?? "tämä tunnus"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {invitations.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title="Avoimet kutsut"
              subtitle="Koodia ei voi näyttää uudelleen — kannassa on vain tiiviste"
            />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {invitations.map((k) => {
              const jaljella = paiviaJaljella(k.expiresAt, now);

              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">
                      {k.label ?? "Nimetön kutsu"}
                    </span>
                    <span
                      className="block text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      Koodi päättyy {k.codeHint} · luotu {paiva(k.createdAt)}
                    </span>
                  </span>

                  <Pill tone={jaljella === 0 ? "warn" : "info"}>
                    {jaljella === 0
                      ? "Vanhentunut"
                      : `${jaljella} pv voimassa`}
                  </Pill>

                  <RevokeInvite id={k.id} />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
