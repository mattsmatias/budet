import { employeeContext } from "@/lib/restoflow/page-context";
import { fetchColleagues } from "@/lib/restoflow/queries";
import { birthdaysToday, formatBirthday } from "@/lib/restoflow/workplace";
import { POSITION_LABELS } from "@/lib/restoflow/types";
import { Avatar } from "@/components/restoflow/ui";
import { Empty, PageHeader, SectionTitle, Surface } from "../ui";

export const metadata = { title: "Työyhteisö" };

/**
 * Työyhteisö.
 *
 * Nimi, tehtävä ja syntymäpäivä. Ei palkkoja, ei yhteystietoja, ei
 * profiileja joita voisi selata — ne tekisivät tästä toisen sovelluksen.
 *
 * Tehtävä eikä käyttöoikeusrooli: työkaverille "Tarjoilija" kertoo
 * jotain, "employee" ei kerro mitään. Ne ovat tietomallissa eri
 * kenttiä, ja tässä näytetään se joka koskee työtä.
 */
export default async function WorkplacePage() {
  const { restaurant, now } = await employeeContext("/app/tyoyhteiso");

  const colleagues = await fetchColleagues(restaurant.id);
  const birthdays = birthdaysToday(colleagues, now, restaurant.timezone);
  const birthdayIds = new Set(birthdays.map((c) => c.id));

  return (
    <div className="rf-enter space-y-6">
      <PageHeader
        title="Työyhteisö"
        subtitle={`${colleagues.length} ${colleagues.length === 1 ? "työkaveri" : "työkaveria"}`}
      />

      {colleagues.length === 0 ? (
        <Empty
          title="Ei työkavereita"
          description="Ravintolaan ei ole vielä lisätty muita työntekijöitä."
        />
      ) : (
        <section className="space-y-2">
          <SectionTitle>Työkaverit</SectionTitle>

          <Surface padded={false}>
            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {colleagues.map((person) => (
                <li key={person.id} className="flex items-center gap-3.5 px-4 py-3">
                  <Avatar initials={person.initials} size={40} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {person.name}
                      {birthdayIds.has(person.id) ? (
                        <span className="ml-2" aria-label="syntymäpäivä tänään">
                          🎂
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                      {person.position ? POSITION_LABELS[person.position] : "Työntekijä"}
                    </p>
                  </div>

                  {/*
                    Syntymäpäivä näkyy vain jos se on merkitty. Tyhjä
                    kohta jokaisella rivillä kertoisi kuka ei ole sitä
                    kertonut, ja se on oma tietonsa.
                  */}
                  {person.birthDay && person.birthMonth ? (
                    <p
                      className="shrink-0 text-[13px] whitespace-nowrap"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatBirthday(person.birthDay, person.birthMonth)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Surface>

          <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Syntymäpäivän voi lisätä tai poistaa omista asetuksista. Vuotta ei
            kysytä eikä tallenneta.
          </p>
        </section>
      )}
    </div>
  );
}
