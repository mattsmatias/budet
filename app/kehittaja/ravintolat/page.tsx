import Link from "next/link";
import { fetchRestaurants } from "@/lib/kehittaja/queries";
import {
  PLAN_LABELS,
  STATUS_LABELS,
  healthOf,
  statusTone,
  type RestaurantStatus,
} from "@/lib/kehittaja/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Ravintolat" };

const SUODATTIMET = [
  { key: "kaikki", label: "Kaikki" },
  { key: "active", label: "Aktiiviset" },
  { key: "trial", label: "Kokeilut" },
  { key: "suspended", label: "Keskeytetyt" },
  { key: "cancelled", label: "Päättyneet" },
  { key: "archived", label: "Arkistoidut" },
] as const;

/**
 * Kaikki Budetiin luodut ravintolat.
 *
 * HAKU JA SUODATIN OSOITTEESSA, EI TILASSA.
 *
 * Suodatettu näkymä on jaettava linkki: kun tuki kysyy "katso tuota
 * keskeytettyä", osoite riittää. Selaimen paluunappi toimii myös,
 * mikä ei ole itsestään selvää jos valinta elää komponentin tilassa.
 */
export default async function DevRestaurantsPage({
  searchParams,
}: PageProps<"/kehittaja/ravintolat">) {
  const params = await searchParams;
  const all = await fetchRestaurants();

  const tila = typeof params.tila === "string" ? params.tila : "kaikki";
  const haku = typeof params.haku === "string" ? params.haku.trim().toLowerCase() : "";

  const now = new Date();

  const rows = all.filter((r) => {
    if (tila !== "kaikki" && r.status !== tila) return false;
    if (haku === "") return true;
    return (
      r.name.toLowerCase().includes(haku) ||
      (r.ownerName ?? "").toLowerCase().includes(haku) ||
      (r.ownerEmail ?? "").toLowerCase().includes(haku) ||
      (r.businessId ?? "").toLowerCase().includes(haku) ||
      (r.city ?? "").toLowerCase().includes(haku)
    );
  });

  return (
    <div className="rf-stagger space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Ravintolat</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {rows.length === all.length
              ? `${all.length} ${all.length === 1 ? "ravintola" : "ravintolaa"}`
              : `${rows.length} / ${all.length} ravintolaa`}
          </p>
        </div>

        <Link
          href="/kehittaja/ravintolat/uusi"
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={15} />
          Luo ravintola
        </Link>
      </header>

      {/*
        Haku on lomake eikä näppäilyn kuuntelija.

        Palvelinkomponentti hakee joka näppäimenpainalluksella
        uudelleen, jos haku olisi elävä. Enter riittää: lista on
        pitkä vasta kun asiakkaita on satoja.
      */}
      <form method="get" className="flex flex-wrap gap-2">
        {tila !== "kaikki" ? <input type="hidden" name="tila" value={tila} /> : null}

        <input
          name="haku"
          defaultValue={typeof params.haku === "string" ? params.haku : ""}
          placeholder="Hae ravintolaa, omistajaa tai Y-tunnusta…"
          className="min-w-0 flex-1 px-3.5 text-[13.5px]"
          style={{
            height: 40,
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
            color: "var(--rf-text)",
          }}
        />

        <button
          type="submit"
          className="rf-press shrink-0 px-4 text-[13px] font-bold"
          style={{
            height: 40,
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Hae
        </button>
      </form>

      <nav aria-label="Suodattimet" className="flex flex-wrap gap-1.5">
        {SUODATTIMET.map((s) => {
          const active = tila === s.key;
          const query = new URLSearchParams();
          if (s.key !== "kaikki") query.set("tila", s.key);
          if (haku !== "") query.set("haku", haku);
          const qs = query.toString();

          return (
            <Link
              key={s.key}
              href={qs === "" ? "/kehittaja/ravintolat" : `/kehittaja/ravintolat?${qs}`}
              aria-current={active ? "page" : undefined}
              className="rf-press px-3 py-1.5 text-[12.5px]"
              style={{
                background: active ? "var(--rf-accent-soft)" : "var(--rf-inset)",
                color: active ? "var(--rf-accent)" : "var(--rf-text-2)",
                fontWeight: active ? 700 : 500,
                borderRadius: 980,
              }}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Ei osumia"
            description="Yksikään ravintola ei vastaa hakua tai valittua tilaa."
          />
        </Card>
      ) : (
        <Card padded={false}>
          {/*
            Taulukko vierii omassa laatikossaan.

            Ruudukon lapsi on oletuksena min-width:auto, joten leveä
            taulukko työntäisi koko sivun vaakasuuntaan vierimään.
          */}
          <div className="overflow-x-auto">
            <table className="rf-table w-full" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Ravintola</th>
                  <th className="px-4 py-3 text-left">Omistaja</th>
                  <th className="px-4 py-3 text-left">Tila</th>
                  <th className="px-4 py-3 text-left">Paketti</th>
                  <th className="px-4 py-3 text-right">Käyttäjiä</th>
                  <th className="px-4 py-3 text-left">Viimeksi</th>
                  <th className="px-5 py-3 text-left">Luotu</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const health = healthOf(r.lastSignInAt, r.status, now);
                  const tone = statusTone(r.status as RestaurantStatus);

                  return (
                    <tr key={r.id}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/kehittaja/ravintolat/${r.id}`}
                          className="rf-press block font-semibold"
                        >
                          {r.name}
                          {r.isTestAccount ? (
                            <span className="ml-2 align-middle">
                              <Pill tone="info">Testi</Pill>
                            </span>
                          ) : null}
                        </Link>
                        {r.city ? (
                          <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                            {r.city}
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <span className="block text-[13px]">{r.ownerName ?? "—"}</span>
                        <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                          {r.ownerEmail ?? "ei omistajaa"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Pill tone={tone === "muted" ? "info" : tone} dot>
                          {STATUS_LABELS[r.status]}
                        </Pill>
                        {r.status === "trial" && r.trialEndsOn ? (
                          <span
                            className="rf-tabular mt-0.5 block text-[11.5px]"
                            style={{ color: "var(--rf-text-3)" }}
                          >
                            päättyy {r.trialEndsOn}
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-[13px]">{PLAN_LABELS[r.plan]}</td>

                      <td className="rf-tabular px-4 py-3 text-right">{r.userCount}</td>

                      <td className="px-4 py-3">
                        <span
                          className="text-[12.5px]"
                          style={{
                            color:
                              health.level === "risk"
                                ? "var(--rf-red-text)"
                                : health.level === "attention"
                                  ? "var(--rf-amber-text)"
                                  : "var(--rf-text-2)",
                          }}
                        >
                          {health.reason}
                        </span>
                      </td>

                      <td className="rf-tabular px-5 py-3 text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
                        {new Date(r.createdAt).toLocaleDateString("fi-FI")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
