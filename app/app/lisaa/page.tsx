import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { employeeContext } from "@/lib/restoflow/page-context";
import { workedBetween } from "@/lib/restoflow/timeclock";
import { formatDuration, staffCostCents } from "@/lib/restoflow/timeclock";
import { can } from "@/lib/restoflow/permissions";
import { POSITION_LABELS, ROLE_LABELS } from "@/lib/restoflow/types";
import { weekStart } from "@/lib/restoflow/clock-context";
import { formatMoney } from "@/lib/money";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import { Avatar, Card, SectionLabel } from "@/components/restoflow/ui";

export const metadata = { title: "Lisää" };

export default async function MorePage() {
  const { user, restaurant, role, clockEvents, today, now } =
    await employeeContext("/app/lisaa");

  const week = workedBetween(clockEvents, weekStart(today), today, now);
  const rate = restaurant.hourlyRateCents ?? 0;
  const earned = staffCostCents(week.workedMs, rate);

  const name = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Lisää</h1>
      </header>

      <Card>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name)} size={52} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]}
              {restaurant.position ? ` · ${POSITION_LABELS[restaurant.position]}` : ""}
            </p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {restaurant.name}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Tunnit tällä viikolla" value={formatDuration(week.workedMs)} />
          <Stat
            label={rate > 0 ? "Tuntien perusteella" : "Tuntipalkkaa ei asetettu"}
            value={rate > 0 ? formatMoney(earned) : "—"}
          />
        </div>

        {rate > 0 ? (
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Laskennallinen summa tunneista ja tuntipalkasta. Ei palkkalaskelma
            eikä sisällä lisiä tai vähennyksiä.
          </p>
        ) : null}
      </Card>

      <section>
        <SectionLabel>Toiminnot</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <Row href="/app/ilmoitukset" icon="bell" label="Ilmoitukset" />
            <Row href="/app/vuorot" icon="calendar" label="Työvuoroni" />
            <Row href="/app/tyoaika" icon="clock" label="Työaikani" />
            <Row href="/app/asetukset" icon="settings" label="Asetukset" />
            {can(role, "expenses.view") ? (
              <Row href="/admin" icon="overview" label="Hallintanäkymä" />
            ) : null}
          </ul>
        </Card>
      </section>



      <form action={signOut} className="pt-2">
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
          Kirjaudu ulos
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-3.5 py-3"
      style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
    >
      <p className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </p>
      <p className="rf-tabular mt-1 text-[19px] font-semibold" suppressHydrationWarning>
        {value}
      </p>
    </div>
  );
}

function Row({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-3.5">
        <span style={{ color: "var(--rf-text-2)" }}>
          <RfIcon name={icon} size={20} />
        </span>
        <span className="flex-1 text-[15px] font-medium">{label}</span>
        <span style={{ color: "var(--rf-text-3)" }}>
          <RfIcon name="chevron" size={16} />
        </span>
      </Link>
    </li>
  );
}


function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
