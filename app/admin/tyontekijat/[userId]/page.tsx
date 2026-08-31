import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { labels, formatDayIn } from "@/lib/i18n/labels";
import { fill } from "@/lib/i18n/auth-text";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { formatMoney } from "@/lib/money";
import {
  loadAccrual,
  loadBenefitDefaults,
  loadBenefits,
  loadIncomeLimit,
  loadPayrollProfiles,
  loadRulesSource,
  loadTaxCards,
  loadTaxRules,
} from "@/lib/restoflow/payroll-tax-queries";
import { pickTaxCard } from "@/lib/restoflow/payroll-tax";
import { Avatar, Card, CardHeader, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import {
  benefitName,
  BenefitForm,
  DeleteBenefit,
  DeleteTaxCard,
  EmploymentForm,
  LimitBar,
  TaxCardForm,
} from "./forms";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.verotus.section };
}

/**
 * Työntekijän palkka- ja verotusprofiili.
 *
 * Sivu vastaa neljään kysymykseen siinä järjestyksessä kuin niitä
 * kysytään: kuka tämä on, millä perusteella hänen palkastaan
 * pidätetään, mitä hänelle on tänä vuonna maksettu, ja mitä hän
 * maksaa työnantajalle.
 *
 * ---------------------------------------------------------------------
 * KAIKKI LUVUT TULEVAT KANNASTA
 * ---------------------------------------------------------------------
 *
 * Kertymä ja tulorajan käyttö lasketaan kannan funktioissa
 * hyväksytyistä ja maksetuista laskelmista. Tällä sivulla ei lasketa
 * yhtään summaa: selaimessa laskettu kertymä olisi oikea vain niin
 * kauan kuin sivulla on kaikki laskelmat, eikä se ole koskaan totta.
 */
export default async function EmployeePayrollPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);
  const { userId } = await params;

  const { restaurant, role, users, today } =
    await adminContext("/admin/tyontekijat");

  /*
   * Palkka- ja verotiedot ovat esihenkilön näkymä.
   *
   * Työntekijän oma näkymä on eri sivu eri sisällöllä; tämä on se
   * jossa tietoja muutetaan. Kirjanpitäjä ei kuulu tänne lainkaan:
   * hän tarvitsee palkkasummat kirjanpitoon, ei yksittäisen ihmisen
   * veroprosenttia.
   */
  if (!can(role, "payroll.view") || !can(role, "staff.view")) notFound();

  const user = users.find((u) => u.id === userId);
  if (!user) notFound();

  const canManage = can(role, "payroll.manage");
  const vuosi = Number(today.slice(0, 4));

  const [cards, benefits, defaults, profiles, accrual, limit, rules, source] =
    await Promise.all([
      loadTaxCards(restaurant.id, userId),
      loadBenefits(restaurant.id, userId),
      loadBenefitDefaults(vuosi),
      loadPayrollProfiles(restaurant.id),
      loadAccrual(restaurant.id, userId, vuosi),
      loadIncomeLimit(restaurant.id, userId, today),
      loadTaxRules(vuosi),
      loadRulesSource(vuosi),
    ]);

  const profile = profiles.find((row) => row.userId === userId);

  /*
   * Voimassa oleva kortti tälle päivälle.
   *
   * Päivä eikä maksupäivä: tämä on tilannekuva tästä hetkestä, ei
   * laskelma. Laskennassa kortti valitaan aina maksupäivällä, ja se
   * tapahtuu palvelimella palkkaa hyväksyttäessä.
   */
  const voimassa = pickTaxCard(cards, today);

  return (
    <div className="rf-enter space-y-5">
      <Link
        href="/admin/tyontekijat"
        className="rf-press inline-flex items-center gap-1 text-[13px] font-semibold"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
          <RfIcon name="chevron" size={14} />
        </span>
        {t.henkilosto.title}
      </Link>

      {/* --- Perustiedot --------------------------------------------------- */}

      <Card>
        <div className="flex items-start gap-3">
          <Avatar initials={user.initials} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold">{user.name}</p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {nimet.roles[user.role]}
              {user.position ? ` · ${nimet.positions[user.position]}` : ""}
            </p>
          </div>

          {profile ? (
            <Pill tone="neutral">
              {profile.payType === "monthly"
                ? `${t.verotus.payTypeMonthly} · ${formatMoney(profile.monthlySalaryCents ?? 0)}`
                : `${t.verotus.payTypeHourly} · ${formatMoney(profile.hourlyRateCents ?? 0)}/h`}
            </Pill>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-[13px] font-semibold">{t.verotus.employment}</p>
          {canManage ? (
            <EmploymentForm
              t={t}
              userId={userId}
              startsOn={profile?.employmentStartsOn ?? null}
              endsOn={profile?.employmentEndsOn ?? null}
              birthDate={profile?.birthDate ?? null}
            />
          ) : (
            <dl className="grid gap-2 sm:grid-cols-3">
              <Rivi
                label={t.verotus.startsOn}
                value={paiva(profile?.employmentStartsOn ?? null, locale)}
              />
              <Rivi
                label={t.verotus.endsOn}
                value={paiva(profile?.employmentEndsOn ?? null, locale)}
              />
              <Rivi
                label={t.verotus.birthDate}
                value={paiva(profile?.birthDate ?? null, locale)}
              />
            </dl>
          )}
        </div>
      </Card>

      {/* --- Verotus ------------------------------------------------------- */}

      <Card>
        <CardHeader title={t.verotus.taxCards} />

        {/*
          Puuttuva verokortti sanotaan heti ja isolla.

          Se on ainoa tilanne jossa palkka lasketaan lain määräämällä
          prosentilla eikä työntekijän omalla, ja se on korjattavissa
          yhdellä paperilla. Hiljainen puuttuminen huomattaisiin
          palkkapäivänä.
        */}
        {!voimassa ? (
          <div
            className="mt-3 px-3 py-2.5"
            style={{
              background: "var(--rf-amber-bg)",
              borderRadius: "var(--rf-r-card)",
            }}
          >
            <p
              className="text-[13.5px] font-semibold"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {t.verotus.missingCardTitle}
            </p>
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {fill(t.verotus.missingCardBody, {
                prosentti: String(rules?.noTaxCardRate ?? 60),
              })}
            </p>
          </div>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Rivi
              label={t.verotus.basePercent}
              value={`${voimassa.basePercent} %`}
            />
            <Rivi
              label={t.verotus.additionalPercent}
              value={`${voimassa.additionalPercent} %`}
            />
            <Rivi
              label={t.verotus.incomeLimit}
              value={formatMoney(voimassa.incomeLimitCents)}
            />
            <Rivi
              label={t.verotus.validTo}
              value={paiva(voimassa.validTo, locale)}
            />
          </dl>
        )}

        {limit ? (
          <div className="mt-3">
            <LimitBar
              t={t}
              limitCents={limit.limitCents}
              usedCents={limit.usedCents}
              remainingCents={limit.remainingCents}
            />
          </div>
        ) : null}

        {/* Koko historia: vanha kortti on kevään palkkojen peruste. */}
        {cards.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex flex-wrap items-center gap-2 py-1.5 text-[13px]"
                style={{ borderTop: "1px solid var(--rf-line)" }}
              >
                <span className="font-semibold">
                  {`${paiva(card.validFrom, locale)} – ${paiva(card.validTo, locale)}`}
                </span>
                <span style={{ color: "var(--rf-text-2)" }}>
                  {`${card.basePercent} % / ${card.additionalPercent} % · ${formatMoney(card.incomeLimitCents)}`}
                </span>

                {card.fileId ? (
                  <a
                    href={`/api/tiedostot/${card.fileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rf-press font-semibold"
                    style={{ color: "var(--rf-accent)" }}
                  >
                    {t.verotus.document}
                  </a>
                ) : null}

                {voimassa?.id === card.id ? (
                  <Pill tone="ok">{t.verotus.inUse}</Pill>
                ) : null}

                {canManage ? (
                  <span className="ml-auto">
                    <DeleteTaxCard t={t} id={card.id} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            {t.verotus.noTaxCards}
          </p>
        )}

        {canManage ? (
          <div className="mt-2">
            <TaxCardForm
              t={t}
              userId={userId}
              card={null}
              hasCards={cards.length > 0}
            />
          </div>
        ) : null}
      </Card>

      {/* --- Luontoisedut -------------------------------------------------- */}

      <Card>
        <CardHeader title={t.verotus.benefits} />

        {benefits.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {benefits.map((benefit) => (
              <li
                key={benefit.id}
                className="flex flex-wrap items-center gap-2 py-1.5 text-[13px]"
                style={{ borderTop: "1px solid var(--rf-line)" }}
              >
                <span className="font-semibold">
                  {benefitName(t, benefit.kind, benefit.label)}
                </span>
                <span style={{ color: "var(--rf-text-2)" }}>
                  {`${formatMoney(benefit.monthlyValueCents)}/kk · ${paiva(benefit.validFrom, locale)} – ${paiva(benefit.validTo, locale)}`}
                </span>

                {canManage ? (
                  <span className="ml-auto">
                    <DeleteBenefit t={t} id={benefit.id} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            {t.verotus.noBenefits}
          </p>
        )}

        {canManage ? (
          <div className="mt-2">
            <BenefitForm
              t={t}
              userId={userId}
              defaults={defaults}
              hasBenefits={benefits.length > 0}
            />
          </div>
        ) : null}
      </Card>

      {/* --- Palkkakertymä ------------------------------------------------- */}

      <Card>
        <CardHeader title={`${t.verotus.accrual} ${vuosi}`} />

        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Rivi
            label={t.verotus.grossPay}
            value={formatMoney(accrual.grossCents)}
          />
          <Rivi
            label={t.verotus.benefits}
            value={formatMoney(accrual.benefitsCents)}
          />
          <Rivi
            label={t.verotus.taxablePay}
            value={formatMoney(accrual.taxableCents)}
          />
          <Rivi
            label={t.verotus.withholding}
            value={formatMoney(accrual.withholdingCents)}
          />
          <Rivi
            label={t.verotus.employeePension}
            value={formatMoney(accrual.employeePensionCents)}
          />
          <Rivi
            label={t.verotus.employeeUnemployment}
            value={formatMoney(accrual.employeeUnemploymentCents)}
          />
          <Rivi
            label={t.verotus.netPay}
            value={formatMoney(accrual.netCents)}
            strong
          />
          <Rivi
            label={t.verotus.employerTotal}
            value={formatMoney(accrual.employerCostCents)}
            strong
          />
        </dl>

        {/*
          Kertymä syntyy hyväksytyistä ja maksetuista laskelmista.

          Luonnos ei kerrytä mitään, eikä peruttu. Ilman tätä lausetta
          tyhjä kertymä näyttäisi virheeltä silloin kun kaikki
          laskelmat ovat vielä luonnoksia.
        */}
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {fill(t.verotus.fromSlips, {
            maara: String(accrual.payslipCount),
          })}
        </p>
      </Card>

      {/* --- Perusteet ----------------------------------------------------- */}

      {/*
        Mistä prosentit tulevat.

        Kun joku kysyy kahden vuoden päästä mistä 1,91 % tuli, vastaus
        on sivulla eikä kenenkään muistissa. Osoitteet ovat kannassa
        sääntörivillä, joten ne eivät ajaudu erilleen käytetyistä
        luvuista.
      */}
      {source ? (
        <Card>
          <CardHeader title={`${t.verotus.sourceNote} ${source.taxYear}`} />
          <p
            className="mt-2 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {source.sourceNote}
          </p>
          <ul className="mt-2 space-y-0.5">
            {source.sourceUrl
              .split("\n")
              .filter(Boolean)
              .map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rf-press break-all text-[12.5px]"
                    style={{ color: "var(--rf-accent)" }}
                  >
                    {url}
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Rivi({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {label}
      </dt>
      <dd
        className={strong ? "text-[15px] font-semibold" : "text-[14px]"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Päivä käyttäjän kielellä, tyhjä viivana. */
function paiva(
  iso: string | null,
  locale: Parameters<typeof formatDayIn>[1],
): string {
  return iso ? formatDayIn(iso, locale) : "—";
}
