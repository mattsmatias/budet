import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { employeeContext } from "@/lib/restoflow/page-context";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar, Card, SectionLabel } from "@/components/restoflow/ui";
import { BirthdayForm, PasswordForm, ProfileForm } from "./forms";
import { fetchColleagues } from "@/lib/restoflow/queries";

import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";

export async function generateMetadata() {
  const t = workerText(await resolveLocale());
  return { title: t.asetukset.title };
}

export default async function EmployeeSettingsPage() {
  const { user, restaurant, role } = await employeeContext("/app/asetukset");

  const name = user.fullName ?? "";
  const rate = restaurant.hourlyRateCents;

  // Oma syntymäpäivä luetaan samasta listasta kuin työyhteisösivu, jotta
  // näytetty arvo on varmasti sama.
  const me = (await fetchColleagues(restaurant.id)).find((c) => c.id === user.id);
  const t = workerText(await resolveLocale());

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">{t.asetukset.title}</h1>
      </header>

      <Card>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name || user.email || "?")} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">
              {name || user.email}
            </p>
            <p className="truncate text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {t.roolit[role]}
              {restaurant.position ? ` · ${t.asemat[restaurant.position]}` : ""}
            </p>
            <p className="truncate text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {restaurant.name}
            </p>
          </div>
        </div>
      </Card>

      <section>
        <SectionLabel>{t.asetukset.ownInfo}</SectionLabel>
        <Card>
          <ProfileForm fullName={name} t={t} />

          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--rf-line)" }}>
            <Row label={t.asetukset.email} value={user.email ?? "—"} />
            <Row
              label={t.asetukset.hourlyRate}
              value={
                rate === null || rate === undefined
                  ? t.yleinen.notSet
                  : formatMoney(rate)
              }
              last
            />
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
              {t.lisatiedot.settingsNote}
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionLabel>{t.asetukset.community}</SectionLabel>
        <Card>
          <BirthdayForm
            birthDay={me?.birthDay ?? null}
            birthMonth={me?.birthMonth ?? null}
            t={t}
          />
        </Card>
      </section>

      <section>
        <SectionLabel>{t.asetukset.password}</SectionLabel>
        <Card>
          <PasswordForm t={t} />
        </Card>
      </section>

      <section>
        <SectionLabel>{t.asetukset.other}</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <li>
              <Link href="/app/ilmoitukset" className="flex items-center gap-3 px-5 py-3.5">
                <span style={{ color: "var(--rf-text-2)" }}>
                  <RfIcon name="bell" size={20} />
                </span>
                <span className="flex-1 text-[15px] font-medium">{t.asetukset.notifications}</span>
                <span style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon name="chevron" size={16} />
                </span>
              </Link>
            </li>
          </ul>
        </Card>
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="rf-press flex w-full items-center justify-center gap-2 py-3 text-[14px] font-medium"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-sm)",
          }}
        >
          <RfIcon name="logout" size={17} />
          {t.lisaa.signOut}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 ${last ? "" : "border-b"}`}
      style={{ borderColor: "var(--rf-line)" }}
    >
      <span className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </span>
      <span className="truncate text-right text-[14px] font-medium">{value}</span>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
