import Link from "next/link";
import { fetchUsers } from "@/lib/kehittaja/queries";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Käyttäjät" };

const ROOLIT: Record<string, string> = {
  owner: "Omistaja",
  manager: "Esihenkilö",
  employee: "Työntekijä",
  accountant: "Kirjanpitäjä",
};

const SUODATTIMET = [
  { key: "kaikki", label: "Kaikki" },
  { key: "owner", label: "Omistajat" },
  { key: "manager", label: "Esihenkilöt" },
  { key: "employee", label: "Työntekijät" },
  { key: "accountant", label: "Kirjanpitäjät" },
  { key: "ei-kaytossa", label: "Ei käytössä" },
] as const;

/**
 * Kaikki Katen käyttäjät.
 *
 * RIVI ON JÄSENYYS, EI IHMINEN.
 *
 * Sama ihminen voi kuulua kahteen ravintolaan eri roolissa, ja
 * rooli sekä käytössäolo ovat jäsenyyden ominaisuuksia. Jos rivi
 * olisi ihminen, kahden ravintolan omistaja näkyisi kerran ja
 * toinen rooli katoaisi.
 *
 * Hallinta tehdään ravintolan sivulla. Tämä lista vastaa
 * kysymykseen "kuka tämä on ja mihin hän kuuluu" — se on tuen
 * ensimmäinen kysymys.
 */
export default async function DevUsersPage({
  searchParams,
}: PageProps<"/kehittaja/kayttajat">) {
  const params = await searchParams;
  const all = await fetchUsers();

  const suodatin = typeof params.rooli === "string" ? params.rooli : "kaikki";
  const haku = typeof params.haku === "string" ? params.haku.trim().toLowerCase() : "";

  const rows = all.filter((u) => {
    if (suodatin === "ei-kaytossa") {
      if (u.active) return false;
    } else if (suodatin !== "kaikki" && u.role !== suodatin) {
      return false;
    }

    if (haku === "") return true;
    return (
      (u.name ?? "").toLowerCase().includes(haku) ||
      (u.email ?? "").toLowerCase().includes(haku) ||
      u.restaurantName.toLowerCase().includes(haku)
    );
  });

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Käyttäjät</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {rows.length === all.length
            ? `${all.length} jäsenyyttä`
            : `${rows.length} / ${all.length} jäsenyyttä`}
          . Yksi ihminen voi kuulua useaan ravintolaan.
        </p>
      </header>

      <form method="get" className="flex flex-wrap gap-2">
        {suodatin !== "kaikki" ? <input type="hidden" name="rooli" value={suodatin} /> : null}

        <input
          name="haku"
          defaultValue={typeof params.haku === "string" ? params.haku : ""}
          placeholder="Hae nimellä, sähköpostilla tai ravintolalla…"
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
          const active = suodatin === s.key;
          const query = new URLSearchParams();
          if (s.key !== "kaikki") query.set("rooli", s.key);
          if (haku !== "") query.set("haku", haku);
          const qs = query.toString();

          return (
            <Link
              key={s.key}
              href={qs === "" ? "/kehittaja/kayttajat" : `/kehittaja/kayttajat?${qs}`}
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
          <EmptyState title="Ei osumia" description="Yksikään käyttäjä ei vastaa hakua." />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="rf-table w-full" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Nimi</th>
                  <th className="px-4 py-3 text-left">Sähköposti</th>
                  <th className="px-4 py-3 text-left">Ravintola</th>
                  <th className="px-4 py-3 text-left">Rooli</th>
                  <th className="px-4 py-3 text-left">Tila</th>
                  <th className="px-5 py-3 text-left">Viimeisin kirjautuminen</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((u) => (
                  <tr key={u.membershipId}>
                    <td className="px-5 py-3 font-semibold">
                      {u.name ?? "Nimetön"}
                      {u.isSuperAdmin ? (
                        <span className="ml-2 align-middle">
                          <Pill tone="risk">Super admin</Pill>
                        </span>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                      {u.email ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/kehittaja/ravintolat/${u.restaurantId}`}
                        className="rf-press text-[13px] font-medium"
                      >
                        {u.restaurantName}
                      </Link>
                      {u.isTestAccount ? (
                        <span className="ml-1.5 align-middle">
                          <Pill tone="info">Testi</Pill>
                        </span>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-[13px]">{ROOLIT[u.role] ?? u.role}</td>

                    <td className="px-4 py-3">
                      <Pill tone={u.active ? "ok" : "warn"} dot>
                        {u.active ? "Käytössä" : "Ei käytössä"}
                      </Pill>
                    </td>

                    <td
                      className="rf-tabular px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {u.lastSignInAt
                        ? new Date(u.lastSignInAt).toLocaleDateString("fi-FI")
                        : "ei koskaan"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
