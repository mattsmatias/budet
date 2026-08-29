import { signOut } from "@/app/(auth)/actions";
import { labels } from "@/lib/i18n/labels";
import { employeeContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar } from "@/components/restoflow/ui";
import { List, PageHeader, Row, SectionTitle, Surface } from "../ui";

import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";

export async function generateMetadata() {
  const t = workerText(await resolveLocale());
  return { title: t.lisaa.title };
}

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
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const { user, restaurant, role } = await employeeContext("/app/lisaa");

  const t = workerText(await resolveLocale());
  const name = user.fullName ?? user.email ?? t.yleinen.user;

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title={t.lisaa.title} />

      <Surface>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name)} size={46} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {nimet.roles[role]}
              {restaurant.position
                ? ` · ${nimet.positions[restaurant.position]}`
                : ""}
            </p>
            <p
              className="truncate text-[13px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {restaurant.name}
            </p>
          </div>
        </div>
      </Surface>

      <section className="space-y-2">
        <SectionTitle>{t.lisaa.account}</SectionTitle>
        <List>
          <Row
            href="/app/palkka"
            icon="payroll"
            title={t.lisatiedot.payTitle}
          />
          <Row
            href="/app/ilmoitukset"
            icon="bell"
            title={t.ilmoitukset.title}
          />
          <Row
            href="/app/asetukset"
            icon="settings"
            title={t.asetukset.title}
          />
        </List>
      </section>

      {/*
        Hallintanäkymä näkyy vain sille jolla on oikeus sinne.
        Työntekijälle linkki olisi ovi joka ei aukea.
      */}
      {can(role, "expenses.view") ? (
        <section className="space-y-2">
          <SectionTitle>{t.lisaa.app}</SectionTitle>
          <List>
            <Row href="/admin" icon="overview" title={t.lisaa.adminView} />
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
          {t.lisaa.signOut}
        </button>
      </form>

      <p
        className="px-1 text-center text-[12px]"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.lisaa.footer}
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
