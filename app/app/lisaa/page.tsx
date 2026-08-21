import Link from "next/link";
import { CURRENT_USER_ID, MONTHLY_HOURS, userById } from "@/lib/restoflow/data";
import { POSITION_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import {
  Avatar,
  Card,
  Icon,
  ICONS,
  Pill,
  SectionLabel,
} from "@/components/restoflow/ui";

export const metadata = { title: "Lisää" };

export default function MorePage() {
  const employee = userById(CURRENT_USER_ID)!;
  const hours = MONTHLY_HOURS[employee.id] ?? 0;
  const earned = staffCostCents(hours * 3600000, employee.hourlyRateCents ?? 0);

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Lisää</h1>
      </header>

      {/* Profiili */}
      <Card>
        <div className="flex items-center gap-3.5">
          <Avatar initials={employee.initials} size={52} />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold">{employee.name}</p>
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              {employee.position ? POSITION_LABELS[employee.position] : "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div
            className="px-3.5 py-3"
            style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              Tunnit tässä kuussa
            </p>
            <p className="rf-tabular mt-1 text-[19px] font-semibold">{hours} h</p>
          </div>
          <div
            className="px-3.5 py-3"
            style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              Tuntien perusteella
            </p>
            <p className="rf-tabular mt-1 text-[19px] font-semibold">
              {formatMoney(earned)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Laskennallinen summa tunneista ja tuntipalkasta. Ei palkkalaskelma
          eikä sisällä lisiä tai vähennyksiä.
        </p>
      </Card>

      {/* Toiminnot */}
      <section>
        <SectionLabel>Toiminnot</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <Row href="/app/kuitit/uusi" icon={ICONS.camera} label="Lisää kuitti" />
            <Row href="/app/vuorot" icon={ICONS.calendar} label="Työvuoroni" />
            <Row href="/app/tyoaika" icon={ICONS.clock} label="Työaikani" />
          </ul>
        </Card>
      </section>

      {/* Ei vielä */}
      <section>
        <SectionLabel>Ei vielä käytössä</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <Disabled icon={ICONS.bell} label="Ilmoitukset" />
            <Disabled icon={ICONS.settings} label="Asetukset" />
            <Disabled icon={ICONS.logout} label="Kirjaudu ulos" />
          </ul>
        </Card>
        <p className="px-1 pt-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Nämä vaativat kirjautumisen ja tietokantayhteyden, joita ei ole vielä
          kytketty. Ne näkyvät tässä harmaina, koska painike joka ei tee mitään
          on huonompi kuin painike joka kertoo olevansa kesken.
        </p>
      </section>

      <div className="pt-2">
        <Link
          href="/admin"
          className="rf-press flex items-center justify-center gap-2 py-3 text-[14px] font-medium"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-blue)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-sm)",
          }}
        >
          <Icon path={ICONS.chart} size={18} />
          Avaa managerin näkymä
        </Link>
      </div>
    </div>
  );
}

function Row({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-3.5">
        <span style={{ color: "var(--rf-text-2)" }}>
          <Icon path={icon} size={20} />
        </span>
        <span className="flex-1 text-[15px] font-medium">{label}</span>
        <span style={{ color: "var(--rf-text-3)" }}>
          <Icon path={ICONS.chevron} size={16} />
        </span>
      </Link>
    </li>
  );
}

function Disabled({ icon, label }: { icon: string; label: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5 opacity-45">
      <span style={{ color: "var(--rf-text-2)" }}>
        <Icon path={icon} size={20} />
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      <Pill>ei vielä</Pill>
    </li>
  );
}
