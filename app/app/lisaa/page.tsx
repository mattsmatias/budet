import { signOut } from "@/app/(auth)/actions";
import { employeeContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { POSITION_LABELS, ROLE_LABELS } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar } from "@/components/restoflow/ui";
import { List, PageHeader, Row, SectionTitle, Surface } from "../ui";

export const metadata = { title: "Lisää" };

/**
 * Lisää.
 *
 * Asetussivu, ei kojelauta. Tänne kertyi aiemmin viikon tunnit ja
 * laskennallinen ansio, jotka ovat jo Koti- ja Työaika-sivuilla —
 * kolmas paikka samalle luvulle tarkoittaa kolmea paikkaa jotka voivat
 * näyttää eri asiaa.
 *
 * Rivit eivät ole toimintoja vaan siirtymiä. Siksi niissä ei ole
 * painikkeen ulkoasua: nuoli riittää kertomaan mihin suuntaan ollaan
 * menossa.
 */
export default async function MorePage() {
  const { user, restaurant, role } = await employeeContext("/app/lisaa");

  const name = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title="Lisää" />

      <Surface>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name)} size={46} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]}
              {restaurant.position ? ` · ${POSITION_LABELS[restaurant.position]}` : ""}
            </p>
            <p className="truncate text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {restaurant.name}
            </p>
          </div>
        </div>
      </Surface>

      <section className="space-y-2">
        <SectionTitle>Tili</SectionTitle>
        <List>
          <Row href="/app/palkka" icon="payroll" title="Palkkani" />
          <Row href="/app/ilmoitukset" icon="bell" title="Ilmoitukset" />
          <Row href="/app/asetukset" icon="settings" title="Asetukset" />
        </List>
      </section>

      {/*
        Hallintanäkymä näkyy vain sille jolla on oikeus sinne.
        Työntekijälle linkki olisi ovi joka ei aukea.
      */}
      {can(role, "expenses.view") ? (
        <section className="space-y-2">
          <SectionTitle>Sovellus</SectionTitle>
          <List>
            <Row href="/admin" icon="overview" title="Hallintanäkymä" />
          </List>
        </section>
      ) : null}

      <form action={signOut}>
        <button
          type="submit"
          className="rf-press flex w-full items-center justify-center gap-2 text-[15px] font-medium"
          style={{
            minHeight: 50,
            background: "var(--rf-card)",
            color: "var(--rf-red-text)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--bd-app-r)",
          }}
        >
          <RfIcon name="logout" size={17} />
          Kirjaudu ulos
        </button>
      </form>

      <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Budet · työntekijänäkymä
      </p>
    </div>
  );
}

/** Nimikirjaimet, sama muoto kuin muualla. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
