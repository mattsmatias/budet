import { fetchContactRequests } from "@/lib/kehittaja/queries";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";
import { HandledToggle } from "./toggle";

export const metadata = { title: "Yhteydenotot" };

/**
 * Yhteydenotot etusivulta.
 *
 * Kate ei tarjoa itserekisteröitymistä, joten tämä on uusien asiakkaiden
 * ovi: ravintola jättää pyynnön, ja tästä se otetaan työn alle. Kun
 * tunnukset on luotu (Yritykset → Luo yritys), pyyntö merkitään
 * hoidetuksi.
 */
export default async function DevContactsPage() {
  const requests = await fetchContactRequests();
  const open = requests.filter((r) => r.handledAt === null).length;

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Yhteydenotot
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Etusivun lomakkeelta. {open === 0 ? "Ei avoimia." : `${open} avoinna.`}{" "}
          Luo tunnukset kohdasta Yritykset → Luo yritys ja merkitse pyyntö
          sitten hoidetuksi.
        </p>
      </header>

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei yhteydenottoja"
            description="Etusivun lomakkeelta lähetetyt pyynnöt näkyvät täällä."
          />
        </Card>
      ) : (
        <div className="space-y-3.5">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
                      {r.restaurant}
                    </h2>
                    <Pill tone={r.handledAt ? "ok" : "warn"} dot>
                      {r.handledAt ? "Hoidettu" : "Avoin"}
                    </Pill>
                  </div>

                  <p className="mt-1 text-[13px]">
                    {r.name} ·{" "}
                    <a
                      href={`mailto:${r.email}`}
                      className="font-semibold"
                      style={{ color: "var(--rf-blue)" }}
                    >
                      {r.email}
                    </a>
                    {r.phone ? (
                      <>
                        {" · "}
                        <a
                          href={`tel:${r.phone.replace(/\s/g, "")}`}
                          style={{ color: "var(--rf-blue)" }}
                        >
                          {r.phone}
                        </a>
                      </>
                    ) : null}
                  </p>

                  {r.message ? (
                    <p
                      className="mt-2 max-w-2xl whitespace-pre-line text-[13.5px] leading-relaxed"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {r.message}
                    </p>
                  ) : null}

                  <p
                    className="mt-2 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {new Date(r.createdAt).toLocaleString("fi-FI", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · kieli {r.locale}
                  </p>
                </div>

                <HandledToggle id={r.id} handled={r.handledAt !== null} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
