import Link from "next/link";
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

export const metadata = { title: "Asetukset" };

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
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const params = await searchParams;
  const { restaurant, role, user, users, closedMonths, categories, month } =
    await adminContext("/admin/asetukset");

  const canEdit = can(role, "settings.edit");
  const section = sectionFor(params.osio);

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
    section.ownerOnly && !canEdit ? sectionFor("profiili") : section;

  return (
    <div className="rf-enter space-y-4">
      {canEdit ? null : (
        <ScopeNotice>
          Näet asetukset mutta et voi muuttaa ravintolan asetuksia — ne ovat
          omistajan oikeus. Oman tunnuksesi asetukset voit muuttaa.
        </ScopeNotice>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,244px)_minmax(0,1fr)] lg:gap-6">
        <SectionNav current={shown.id} canEdit={canEdit} />

        <div className="min-w-0">
          <Panel title={shown.label} summary={shown.summary}>
            {shown.id === "ravintola" ? (
              <>
                <RestaurantForm
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
                    { label: "Valuutta", value: restaurant.currency },
                    {
                      label: "Lounaslistan osoite",
                      value: `/lounas/${restaurant.slug}`,
                      href: `/lounas/${restaurant.slug}`,
                    },
                    { label: "Käyttäjiä", value: String(users.length) },
                  ]}
                  note="Valuutta on kiinteä ja lounaslistan osoite muodostuu ravintolan nimestä. Käyttäjät lisätään Työntekijät-sivulta."
                />
              </>
            ) : null}

            {shown.id === "profiili" ? (
              <>
                <NameForm fullName={user.fullName ?? ""} />

                <Divider />

                <h3 className="text-[13.5px] font-bold">Salasana</h3>
                <div className="mt-3">
                  <PasswordForm />
                </div>

                <Divider />

                <Facts
                  rows={[
                    { label: "Sähköposti", value: user.email ?? "—" },
                    { label: "Rooli", value: nimet.roles[role] },
                  ]}
                  note="Sähköposti on kirjautumistunnuksesi eikä sitä voi vaihtaa täältä. Roolin asettaa ravintolan omistaja."
                />
              </>
            ) : null}

            {shown.id === "vuorot" ? (
              <ShiftRulesForm
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
                  Myyntiryhmät ovat samat kuin kassajärjestelmäsi
                  päiväraportissa. Kun ne täsmäävät, päivän myynti voidaan
                  verrata raporttiin ryhmä ja verokanta kerrallaan — eikä vain
                  loppusummana.
                </p>

                <div className="mt-4">
                  <SalesGroups groups={vat.groups} mappings={vat.mappings} />
                </div>

                <Divider />

                <h3 className="text-[13.5px] font-bold">
                  Kassajärjestelmän ryhmät
                </h3>
                <p
                  className="mt-1 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  Kassa tuntee omat nimensä. Kerro mihin myyntiryhmään kukin
                  niistä kuuluu, niin poiminta osaa kohdistaa raportin rivit
                  oikeille verokannoille.
                </p>

                <div className="mt-3">
                  <PosMappings mappings={vat.mappings} groups={vat.groups} />
                </div>
              </>
            ) : null}

            {shown.id === "kirjanpito" ? (
              <>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  Suljettu kuukausi on kirjanpitoon lähetetty kuukausi. Sen
                  jälkeen tehty muutos ei enää täsmää siihen mitä
                  kirjanpitäjälle on annettu, joten suljetun kuukauden kuitteja
                  ei voi lisätä, muuttaa eikä poistaa.
                </p>

                <MonthClosing
                  locale={locale}
                  closedMonths={closedMonths}
                  selectableMonths={closableMonths(month)}
                />
              </>
            ) : null}

            {shown.id === "kategoriat" ? (
              <>
                <h3 className="text-[13.5px] font-bold">Vakiokategoriat</h3>
                <p
                  className="mt-1 text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  Aina käytettävissä eikä poistettavissa.
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {Object.values(nimet.categories).map((label) => (
                    <li key={label}>
                      <Pill>{label}</Pill>
                    </li>
                  ))}
                </ul>

                <Divider />

                <h3 className="text-[13.5px] font-bold">Omat kategoriat</h3>
                <p
                  className="mt-1 text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  Lisää oma kategoria jos vakiot eivät riitä.
                </p>
                <CategoryManager categories={categories} nimet={nimet} />
              </>
            ) : null}

            {shown.id === "loki" ? (
              <div className="space-y-3">
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  Toimintaloki kertoo kuka teki muutoksen, mihin se kohdistui ja
                  mikä arvo oli ennen. Palkkamuutokset, työaikakorjaukset,
                  verokannat ja käyttöoikeudet kirjataan aina.
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
                  Avaa toimintaloki
                </Link>

                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  Lokia ei voi muokata eikä poistaa. Merkinnät syntyvät
                  tietokannassa, joten ne kirjautuvat myös silloin kun muutos
                  tehdään käyttöliittymän ohi.
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
