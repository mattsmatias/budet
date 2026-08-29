import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRestaurant } from "@/lib/kehittaja/queries";
import {
  PLAN_LABELS,
  STATUS_LABELS,
  healthOf,
  statusTone,
} from "@/lib/kehittaja/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, MetricCard, Pill } from "@/components/restoflow/ui";
import {
  DangerZone,
  DetailsForm,
  FlagRow,
  InviteForm,
  PlanForm,
  StatusForm,
  UserControls,
  UserRow,
} from "./forms";

export async function generateMetadata({
  params,
}: PageProps<"/kehittaja/ravintolat/[id]">) {
  const { id } = await params;
  const detail = await fetchRestaurant(id);
  return { title: detail?.restaurant.name ?? "Ravintola" };
}

const VALILEHDET = [
  { key: "yleiskatsaus", label: "Yleiskatsaus" },
  { key: "tiedot", label: "Tiedot" },
  { key: "kayttajat", label: "Käyttäjät" },
  { key: "kaytto", label: "Käyttö" },
  { key: "liput", label: "Feature flagit" },
  { key: "hallinta", label: "Hallinta" },
] as const;

/**
 * Yhden ravintolan sivu.
 *
 * VÄLILEHTI ON OSOITTEESSA.
 *
 * Tuki lähettää linkin suoraan siihen välilehteen josta on kyse, ja
 * paluunappi vie edelliselle välilehdelle eikä ulos sivulta. Sama
 * syy kuin listan suodattimissa.
 *
 * Hallinta on viimeisenä eikä ensimmäisenä. Se sisältää keskeytyksen
 * ja poiston, eikä niitä pidä kohdata ennen kuin tietää mitä on
 * katsomassa.
 */
export default async function DevRestaurantPage({
  params,
  searchParams,
}: PageProps<"/kehittaja/ravintolat/[id]">) {
  const { id } = await params;
  const query = await searchParams;

  const detail = await fetchRestaurant(id);
  if (!detail) notFound();

  const { restaurant: r, users, invitations, usage, flags } = detail;

  const valittu =
    typeof query.valilehti === "string" &&
    VALILEHDET.some((v) => v.key === query.valilehti)
      ? query.valilehti
      : "yleiskatsaus";

  const health = healthOf(usage.lastSignInAt, r.status, new Date());
  const tone = statusTone(r.status);
  const owner = users.find((u) => u.role === "owner" && u.active) ?? null;

  return (
    <div className="rf-stagger space-y-5">
      <header>
        <Link
          href="/kehittaja/ravintolat"
          className="rf-press -ml-1.5 inline-flex items-center gap-1.5 p-1.5 text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={16} />
          Ravintolat
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">{r.name}</h1>

          <Pill tone={tone === "muted" ? "info" : tone} dot>
            {STATUS_LABELS[r.status]}
          </Pill>

          {r.isTestAccount ? <Pill tone="info">Testiravintola</Pill> : null}
        </div>

        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {[
            r.businessId ? `Y-tunnus ${r.businessId}` : null,
            PLAN_LABELS[r.plan],
            `Luotu ${new Date(r.createdAt).toLocaleDateString("fi-FI")}`,
            r.status === "trial" && r.trialEndsOn
              ? `Kokeilu päättyy ${r.trialEndsOn}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {r.statusNote ? (
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            Tilan syy: {r.statusNote}
          </p>
        ) : null}
      </header>

      <nav aria-label="Välilehdet" className="flex flex-wrap gap-1.5">
        {VALILEHDET.map((v) => {
          const active = valittu === v.key;
          return (
            <Link
              key={v.key}
              href={
                v.key === "yleiskatsaus"
                  ? `/kehittaja/ravintolat/${id}`
                  : `/kehittaja/ravintolat/${id}?valilehti=${v.key}`
              }
              aria-current={active ? "page" : undefined}
              className="rf-press px-3 py-1.5 text-[12.5px]"
              style={{
                background: active
                  ? "var(--rf-accent-soft)"
                  : "var(--rf-inset)",
                color: active ? "var(--rf-accent)" : "var(--rf-text-2)",
                fontWeight: active ? 700 : 500,
                borderRadius: 980,
              }}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      {valittu === "yleiskatsaus" ? (
        <div className="space-y-4">
          <section className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Asiakkuuden tila"
              value={STATUS_LABELS[r.status]}
              icon={
                <RfIcon
                  name={health.level === "healthy" ? "check" : "alert"}
                  size={17}
                />
              }
              tone={
                health.level === "risk"
                  ? "bad"
                  : health.level === "attention"
                    ? "warn"
                    : "neutral"
              }
              tileTone={
                health.level === "risk"
                  ? "bad"
                  : health.level === "attention"
                    ? "warn"
                    : "green"
              }
              hint={health.reason}
            />

            <MetricCard
              label="Käyttäjiä"
              value={usage.activeUsers}
              icon={<RfIcon name="staff" size={17} />}
              tileTone="blue"
              hint={`${users.length} yhteensä · ${invitations.length} kutsua avoinna`}
            />

            <MetricCard
              label="Kuitteja"
              value={usage.receipts}
              icon={<RfIcon name="receipt" size={17} />}
              tileTone="brand"
              hint="Kaikkiaan kirjattuja"
            />

            <MetricCard
              label="Paketti"
              value={PLAN_LABELS[r.plan]}
              icon={<RfIcon name="budget" size={17} />}
              tileTone="violet"
              hint={
                r.status === "trial" && r.trialEndsOn
                  ? `Kokeilu ${r.trialEndsOn} asti`
                  : "Voimassa"
              }
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Omistaja"
                subtitle="Kuka vastaa tästä ravintolasta"
              />

              {owner ? (
                <div className="mt-2">
                  <p className="text-[15px] font-semibold">
                    {owner.name ?? "Nimetön"}
                  </p>
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {owner.email ?? "—"}
                  </p>
                  <p className="mt-1.5">
                    <Pill tone="ok" dot>
                      {owner.lastSignInAt
                        ? `Kirjautui ${new Date(owner.lastSignInAt).toLocaleDateString("fi-FI")}`
                        : "Ei vielä kirjautunut"}
                    </Pill>
                  </p>
                </div>
              ) : (
                <p
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--rf-amber-text)" }}
                >
                  Ravintolalla ei ole aktiivista omistajaa. Luo kutsu
                  Käyttäjät-välilehdeltä.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Yhteystiedot" subtitle="Tukea varten" />

              <dl className="mt-2 space-y-1.5 text-[13px]">
                <Rivi label="Virallinen nimi" value={r.legalName} />
                <Rivi label="Y-tunnus" value={r.businessId} />
                <Rivi
                  label="Osoite"
                  value={
                    [
                      r.address,
                      [r.postalCode, r.city].filter(Boolean).join(" "),
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
                <Rivi label="Puhelin" value={r.phone} />
                <Rivi label="Sähköposti" value={r.email} />
                <Rivi label="Verkkosivu" value={r.website} />
                <Rivi label="Aikavyöhyke" value={r.timezone} />
                <Rivi label="Julkinen osoite" value={`/lounas/${r.slug}`} />
              </dl>
            </Card>
          </div>
        </div>
      ) : null}

      {valittu === "tiedot" ? <DetailsForm r={r} /> : null}

      {valittu === "kayttajat" ? (
        <div className="space-y-4">
          <Card padded={false}>
            <div className="px-5 pt-4">
              <CardHeader
                title="Käyttäjät"
                subtitle={`${users.length} ${users.length === 1 ? "käyttäjä" : "käyttäjää"}`}
              />
            </div>

            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {users.map((u) => (
                <li key={u.membershipId}>
                  <UserRow user={u} />
                  <UserControls
                    membershipId={u.membershipId}
                    name={u.name ?? "Nimetön"}
                    role={u.role}
                    active={u.active}
                    restaurantName={r.name}
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-4">
              <CardHeader
                title="Avoimet kutsut"
                subtitle={
                  invitations.length === 0
                    ? "Ei lunastamattomia kutsuja"
                    : `${invitations.length} lunastamatonta`
                }
              />
            </div>

            {invitations.length > 0 ? (
              <ul
                className="divide-y"
                style={{ borderColor: "var(--rf-line)" }}
              >
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="min-w-0 flex-1 text-[13px]">
                      {inv.label ?? "Nimetön kutsu"}
                      <span
                        className="ml-2"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        loppuu …{inv.hint}
                      </span>
                    </span>
                    <Pill tone="info">{inv.role}</Pill>
                  </li>
                ))}
              </ul>
            ) : null}

            <InviteForm id={id} />
          </Card>
        </div>
      ) : null}

      {valittu === "kaytto" ? (
        <div className="space-y-4">
          <section className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Kuitteja"
              value={usage.receipts}
              icon={<RfIcon name="receipt" size={17} />}
              tileTone="brand"
              hint="Kaikkiaan"
            />
            <MetricCard
              label="Työvuoroja"
              value={usage.shifts}
              icon={<RfIcon name="calendar" size={17} />}
              tileTone="blue"
              hint="Tässä kuussa"
            />
            <MetricCard
              label="Tehtäviä"
              value={usage.tasks}
              icon={<RfIcon name="check" size={17} />}
              tileTone="green"
              hint="Kaikkiaan"
            />
            <MetricCard
              label="Myyntipäiviä"
              value={usage.salesDays}
              icon={<RfIcon name="sales" size={17} />}
              tileTone="violet"
              hint="Kirjattuja päiviä"
            />
            <MetricCard
              label="Lounaslistoja"
              value={usage.lunchMenus}
              icon={<RfIcon name="lunch" size={17} />}
              tileTone="warn"
              hint="Julkaistuja ja luonnoksia"
            />
            <MetricCard
              label="Matti-keskusteluja"
              value={usage.aiChats}
              icon={<RfIcon name="sparkle" size={17} />}
              tileTone="accent"
              hint="AI-työkaverin käyttö"
            />
          </section>

          {/*
            Käyttöluvut vastaavat kysymykseen käyttääkö asiakas Katea.
            Nolla joka sarakkeessa on eri asia kuin nolla yhdessä:
            edellinen tarkoittaa ettei sovellusta ole otettu käyttöön.
          */}
          <Card>
            <CardHeader
              title="Viimeisin kirjautuminen"
              subtitle="Kuka tahansa aktiivinen käyttäjä"
            />
            <p className="mt-2 text-[15px] font-semibold">
              {usage.lastSignInAt
                ? new Date(usage.lastSignInAt).toLocaleString("fi-FI", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Ei yhtään kirjautumista"}
            </p>
            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {health.reason}
            </p>
          </Card>
        </div>
      ) : null}

      {valittu === "liput" ? (
        <Card padded={false}>
          <div className="px-5 pt-4">
            <CardHeader
              title="Feature flagit"
              subtitle="Poikkeus voittaa globaalin oletuksen. Oletukseen palautus poistaa poikkeuksen."
            />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {flags.map((flag) => (
              <FlagRow key={flag.key} id={id} flag={flag} />
            ))}
          </ul>
        </Card>
      ) : null}

      {valittu === "hallinta" ? (
        <div className="space-y-4">
          <StatusForm
            id={id}
            current={r.status}
            trialEndsOn={r.trialEndsOn}
            note={r.statusNote}
          />
          <PlanForm id={id} current={r.plan} />
          <DangerZone
            id={id}
            name={r.name}
            counts={{
              users: users.length,
              receipts: usage.receipts,
              shifts: usage.shifts,
              tasks: usage.tasks,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Rivi({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt style={{ color: "var(--rf-text-2)" }}>{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}
