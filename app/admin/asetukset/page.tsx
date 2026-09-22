import { withBusiness } from "@/lib/restoflow/business";
import { categoryOptions } from "@/lib/restoflow/business";
import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { formatDayIn, labels } from "@/lib/i18n/labels";
import { fill } from "@/lib/i18n/auth-text";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { previousMonth } from "@/lib/restoflow/expenses";
import { Pill, ScopeNotice } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { MonthClosing } from "./settings-form";
import { CategoryManager } from "./categories";
import { RestaurantForm } from "./forms";
import { LogoForm } from "./logo-form";
import { PayrollForm } from "./payroll-form";
import { EmployeeList } from "./employees";
import { NameForm, PasswordForm } from "./profile-forms";
import { SalesGroups, PosMappings } from "./vat-settings";
import {
  fetchInvitations,
  fetchPosMappings,
  fetchEmployees,
  fetchPayrollSettings,
  fetchRestaurantLogoUrl,
  fetchSalesGroups,
} from "@/lib/restoflow/queries";
import { revokeInvitation } from "../actions";
import { InviteForm, MemberForm } from "./users";
import { SectionNav } from "./section-nav";
import { sectionFor } from "./sections";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.asetus.settingsTitle };
}

/**
 * Asetukset osastoittain.
 *
 * Kaikki asetukset yhtenä ruudukkona oli kuusi korttia joista kolme oli
 * pelkkää tekstiä. Osasto kerrallaan tarkoittaa että näkyvissä on se
 * mitä ollaan muuttamassa; valinta on osoitteessa, joten osion voi
 * linkittää ja selaimen paluunappi vie edelliseen osioon eikä ulos
 * sivulta.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const nimetKaikki = labels(locale);
  const params = await searchParams;
  const { restaurant, role, user, users, closedMonths, categories, month } =
    await adminContext("/admin/asetukset");
  const nimet = withBusiness(nimetKaikki, restaurant.businessType);

  const canEdit = can(role, "settings.edit");
  const section = sectionFor(params.osio, t);

  /*
   * Verotuksen aineisto haetaan vain kun sitä katsotaan.
   *
   * Kaksi kyselyä jokaisella asetussivun latauksella olisi kaksi
   * kyselyä joita viisi osastoa kuudesta ei käytä.
   */
  const vat =
    section.id === "verotus" && canEdit
      ? {
          groups: await fetchSalesGroups(restaurant.id),
          mappings: await fetchPosMappings(restaurant.id),
        }
      : null;

  /* Kuvan osoite vain Yritys-osastolle, samasta syystä. */
  const logoUrl =
    section.id === "ravintola" && canEdit
      ? await fetchRestaurantLogoUrl(restaurant.id)
      : null;

  /* Palkkakulut vain omalle osastolleen, samasta syystä. */
  const payroll =
    section.id === "palkat" && canEdit
      ? await fetchPayrollSettings(restaurant.id)
      : null;

  /*
   * Työntekijät samaan osastoon kuin käyttäjät.
   *
   * Työntekijä on käyttäjä: hänellä on tunnus, jolla hän leimaa.
   * Kahdessa paikassa ylläpidettynä sama ihminen sai kaksi eri
   * sähköpostia, eikä leimaus löytänyt häntä.
   */
  const employees =
    section.id === "kayttajat" && canEdit
      ? await fetchEmployees(restaurant.id)
      : [];

  /* Avoimet kutsut vain Käyttäjät-osastolle, samasta syystä. */
  const invitations =
    section.id === "kayttajat" && canEdit
      ? await fetchInvitations(restaurant.id)
      : [];

  /*
   * Osasto jota ei saa nähdä putoaa omaan tunnukseen.
   *
   * Valikko piilottaa omistajan osastot muilta, mutta osoitteen voi
   * kirjoittaa itse — ja tyhjä osio olisi hämmentävämpi kuin se että
   * näkyy jotain mitä oikeasti saa muuttaa.
   */
  const shown =
    section.ownerOnly && !canEdit ? sectionFor("profiili", t) : section;

  return (
    <div className="rf-enter space-y-4">
      {canEdit ? null : <ScopeNotice>{t.asetus.readOnlyNotice}</ScopeNotice>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,244px)_minmax(0,1fr)] lg:gap-6">
        <SectionNav t={t} current={shown.id} canEdit={canEdit} />

        <div className="min-w-0">
          <Panel title={shown.label} summary={shown.summary}>
            {shown.id === "ravintola" ? (
              <>
                <RestaurantForm
                  t={t}
                  name={restaurant.name}
                  timezone={restaurant.timezone}
                />

                <Divider />

                <LogoForm t={t} name={restaurant.name} logoUrl={logoUrl} />

                <Divider />

                {/*
                  Tiedot joita ei voi muuttaa mutta jotka kysytään
                  yleensä juuri asetuksista. Ne eivät ole lomakkeessa,
                  koska harmaana näkyvä kenttä lupaa muutosta jota ei
                  tule.
                */}
                <Facts
                  rows={[
                    { label: t.asetus.currency, value: restaurant.currency },
                    { label: t.asetus.usersWord, value: String(users.length) },
                  ]}
                  note={t.asetus.fixedSettingsHint}
                />
              </>
            ) : null}

            {shown.id === "palkat" && payroll ? (
              <PayrollForm t={t} settings={payroll} />
            ) : null}

            {shown.id === "profiili" ? (
              <>
                <NameForm t={t} fullName={user.fullName ?? ""} />

                <Divider />

                <h3 className="text-[13.5px] font-bold">{t.asetus.password}</h3>
                <div className="mt-3">
                  <PasswordForm t={t} />
                </div>

                <Divider />

                <Facts
                  rows={[
                    { label: t.asetus.email, value: user.email ?? "—" },
                    { label: t.asetus.role, value: nimet.roles[role] },
                  ]}
                  note={t.asetus.emailFixed}
                />
              </>
            ) : null}

            {shown.id === "kayttajat" ? (
              <div className="space-y-4">
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {t.asetus.roleHint}
                </p>

                <InviteForm t={t} nimet={nimet} />

                {/*
                  Työntekijät käyttäjien kanssa.

                  Tuntipalkka ja tehtävä muuttuvat täällä, koska ne ovat
                  saman ihmisen tietoja kuin tunnus ja rooli. Tunnit ja
                  työn kustannus ovat Palkat-sivulla — siellä katsotaan
                  rahaa, täällä ylläpidetään ihmisiä.
                */}
                <div>
                  <h3 className="text-[13.5px] font-bold">
                    {t.tyo.listTitle}
                  </h3>
                  <div className="mt-3">
                    <EmployeeList t={t} rows={employees} />
                  </div>
                </div>

                {invitations.length > 0 ? (
                  <div>
                    <h3 className="text-[13.5px] font-bold">
                      {t.henkilosto2.openInvites}
                    </h3>
                    <p
                      className="mt-1 text-[12.5px] leading-relaxed"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {t.henkilosto.codeOnce}
                    </p>
                    <ul
                      className="mt-2 divide-y"
                      style={{ borderColor: "var(--rf-line)" }}
                    >
                      {invitations.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium">
                              {inv.label ?? nimet.roles[inv.role]}
                            </p>
                            <p
                              className="rf-tabular text-[12px]"
                              style={{ color: "var(--rf-text-3)" }}
                            >
                              ···{inv.codeHint} · {nimet.roles[inv.role]} ·{" "}
                              {fill(t.tiimi.validUntil, {
                                paiva: formatDayIn(
                                  inv.expiresAt.slice(0, 10),
                                  locale,
                                ),
                              })}
                            </p>
                          </div>
                          <form action={revokeInvitation}>
                            <input
                              type="hidden"
                              name="invitationId"
                              value={inv.id}
                            />
                            <button
                              type="submit"
                              className="rf-press px-3 py-1.5 text-[13px] font-medium"
                              style={{
                                background: "var(--rf-red-bg)",
                                color: "var(--rf-red-text)",
                                borderRadius: "var(--rf-r-control)",
                              }}
                            >
                              {t.henkilosto.revoke}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <h3 className="text-[13.5px] font-bold">
                    {t.asetus.membersTitle}
                  </h3>
                  <ul
                    className="mt-2 divide-y"
                    style={{ borderColor: "var(--rf-line)" }}
                  >
                    {users.map((member) => (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium">
                            {member.name}
                            {member.id === user.id
                              ? ` (${t.asetus.you})`
                              : ""}
                          </p>
                          <p
                            className="text-[12px]"
                            style={{ color: "var(--rf-text-3)" }}
                          >
                            {nimet.roles[member.role]}
                          </p>
                        </div>
                        <MemberForm
                          t={t}
                          nimet={nimet}
                          userId={member.id}
                          role={member.role}
                          self={member.id === user.id}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {shown.id === "verotus" && vat ? (
              <>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {t.asetus.groupsMatchRegister}
                </p>

                <div className="mt-4">
                  <SalesGroups
                    t={t}
                    groups={vat.groups}
                    mappings={vat.mappings}
                  />
                </div>

                <Divider />

                <h3 className="text-[13.5px] font-bold">
                  {t.asetus.registerGroups}
                </h3>
                <p
                  className="mt-1 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.asetus.registerGroupsHint}
                </p>

                <div className="mt-3">
                  <PosMappings
                    t={t}
                    mappings={vat.mappings}
                    groups={vat.groups}
                  />
                </div>
              </>
            ) : null}

            {shown.id === "kirjanpito" ? (
              <>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {t.asetus.closedMonthHint}
                </p>

                <MonthClosing
                  t={t}
                  locale={locale}
                  closedMonths={closedMonths}
                  selectableMonths={closableMonths(month)}
                />
              </>
            ) : null}

            {shown.id === "kategoriat" ? (
              <>
                <h3 className="text-[13.5px] font-bold">
                  {t.asetus.standardCategories}
                </h3>
                <p
                  className="mt-1 text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.asetus.alwaysAvailable}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {categoryOptions(nimet).map(([, label]) => (
                    <li key={label}>
                      <Pill>{label}</Pill>
                    </li>
                  ))}
                </ul>

                <Divider />

                <h3 className="text-[13.5px] font-bold">
                  {t.asetus.ownCategories}
                </h3>
                <p
                  className="mt-1 text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.asetus.addOwnCategory}
                </p>
                <CategoryManager t={t} categories={categories} nimet={nimet} />
              </>
            ) : null}

            {shown.id === "loki" ? (
              <div className="space-y-3">
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  {t.asetus.logHint}
                </p>

                <Link
                  href="/admin/loki"
                  className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
                  style={{
                    background: "var(--rf-inset)",
                    color: "var(--rf-text)",
                    border: "1px solid var(--rf-line-strong)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                >
                  <RfIcon name="clock" size={15} />
                  {t.asetus.openLog}
                </Link>

                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.asetus.logImmutable}
                </p>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Kaksitoista edellistä kuukautta.
 *
 * Kuluva ei ole mukana: siihen tulee vielä kuitteja, eikä sitä voi
 * sulkea.
 */
function closableMonths(month: string): string[] {
  const months: string[] = [];
  let cursor = previousMonth(month);

  for (let i = 0; i < 12; i += 1) {
    months.push(cursor);
    cursor = previousMonth(cursor);
  }

  return months;
}

function Panel({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="px-[18px] pb-5 pt-[15px]"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      <h2 className="text-[15px] font-bold tracking-[-0.0075em]">{title}</h2>
      <p
        className="mt-[3px] text-[12.5px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        {summary}
      </p>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function Divider() {
  return (
    <hr
      className="my-5 border-0"
      style={{ borderTop: "1px solid var(--rf-line)" }}
    />
  );
}

/**
 * Tiedot joita ei muuteta.
 *
 * Erillään lomakkeista, koska harmaana näkyvä kenttä lupaa muutosta
 * jota ei tule. Tässä ne ovat luettavaa tietoa siinä muodossa jossa ne
 * luetaan.
 */
function Facts({
  rows,
  note,
}: {
  rows: { label: string; value: string; href?: string }[];
  note?: string;
}) {
  return (
    <>
      <dl className="mt-2.5">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 py-2.5"
            style={{
              borderTop: index === 0 ? "none" : "1px solid var(--rf-line)",
            }}
          >
            <dt className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {row.label}
            </dt>
            <dd className="min-w-0 text-end text-[13px] font-semibold">
              {row.href ? (
                <Link
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                  style={{ color: "var(--rf-accent)" }}
                >
                  <span className="truncate">{row.value}</span>
                  <RfIcon name="chevron" size={13} />
                </Link>
              ) : (
                <span className="truncate">{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {note ? (
        <p
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {note}
        </p>
      ) : null}
    </>
  );
}
