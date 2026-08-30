import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { labels } from "@/lib/i18n/labels";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { previousMonth } from "@/lib/restoflow/expenses";
import { Pill, ScopeNotice } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { MonthClosing } from "./settings-form";
import { CategoryManager } from "./categories";
import { RestaurantForm, ShiftRulesForm } from "./forms";
import { NameForm, PasswordForm } from "./profile-forms";
import { SalesGroups, PosMappings } from "./vat-settings";
import { fetchPosMappings, fetchSalesGroups } from "@/lib/restoflow/queries";
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
  const nimet = labels(locale);
  const params = await searchParams;
  const { restaurant, role, user, users, closedMonths, categories, month } =
    await adminContext("/admin/asetukset");

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

                {/*
                  Kolme tietoa joita ei voi muuttaa mutta jotka kysytään
                  yleensä juuri asetuksista. Ne eivät ole lomakkeessa,
                  koska harmaana näkyvä kenttä lupaa muutosta jota ei
                  tule.
                */}
                <Facts
                  rows={[
                    { label: t.asetus.currency, value: restaurant.currency },
                    {
                      label: t.asetus.lunchPageAddress,
                      value: `/lounas/${restaurant.slug}`,
                      href: `/lounas/${restaurant.slug}`,
                    },
                    { label: t.asetus.usersWord, value: String(users.length) },
                  ]}
                  note={t.asetus.fixedSettingsHint}
                />
              </>
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

            {shown.id === "vuorot" ? (
              <ShiftRulesForm
                t={t}
                clockInEarlyMinutes={restaurant.clockInEarlyMinutes}
                openShiftClaiming={restaurant.openShiftClaiming}
              />
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
                  {Object.values(nimet.categories).map((label) => (
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
            <dd className="min-w-0 text-right text-[13px] font-semibold">
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
