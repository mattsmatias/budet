import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";
import { RfIcon } from "@/components/restoflow/icons";
import { settingsSections } from "./sections";

/**
 * Osastovalikko.
 *
 * Työpöydällä pystylista sisällön vasemmalla puolella, puhelimessa
 * vaakarivi sen yläpuolella. Sama lista molemmissa: kapealla ruudulla
 * pystylista veisi puolet leveydestä, ja vaakarivi työpöydällä
 * jättäisi oikean reunan tyhjäksi.
 *
 * Linkkejä eikä painikkeita, koska valinta on osoitteessa.
 */
export function SectionNav({
  t,
  current,
  canEdit,
}: {
  t: AdminText;
  current: string;
  canEdit: boolean;
}) {
  const sections = settingsSections(t).filter((s) => canEdit || !s.ownerOnly);

  return (
    /*
     * min-w-0 ei ole koriste.
     *
     * Ruudukon lapsi on oletuksena min-width:auto, joten vaakariviin
     * vierivä pillerilista levitti koko sivun 805 pikselin levyiseksi
     * puhelimessa. Vieritys kuuluu listaan, ei sivuun.
     */
    <nav
      aria-label={t.asetus.settingsSections}
      className="min-w-0 lg:sticky lg:top-[76px]"
    >
      {/* Puhelin: vaakarivi joka vierii. */}
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <Link
              href={`/admin/asetukset?osio=${section.id}`}
              aria-current={section.id === current ? "page" : undefined}
              className="rf-press flex items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[13px] font-bold"
              style={{
                background:
                  section.id === current
                    ? "var(--rf-accent-bg)"
                    : "var(--rf-card)",
                color:
                  section.id === current
                    ? "var(--rf-accent-strong)"
                    : "var(--rf-text-2)",
                border: "1px solid var(--rf-line)",
                borderRadius: 999,
              }}
            >
              <RfIcon name={section.icon} size={15} strokeWidth={1.8} />
              {section.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Työpöytä: pystylista, jossa jokaisella rivillä myös kuvaus. */}
      <ul className="hidden lg:block">
        {sections.map((section) => {
          const active = section.id === current;

          return (
            <li key={section.id} className="mb-1 last:mb-0">
              <Link
                href={`/admin/asetukset?osio=${section.id}`}
                aria-current={active ? "page" : undefined}
                className="rf-press flex items-start gap-[11px] px-3 py-2.5"
                style={{
                  background: active ? "var(--rf-card)" : "transparent",
                  border: `1px solid ${active ? "var(--rf-line)" : "transparent"}`,
                  borderRadius: "var(--rf-r-control)",
                  boxShadow: active ? "var(--rf-shadow-sm)" : "none",
                }}
              >
                <span
                  aria-hidden="true"
                  className="mt-px shrink-0"
                  style={{
                    color: active ? "var(--rf-accent)" : "var(--rf-text-3)",
                  }}
                >
                  <RfIcon name={section.icon} size={17} strokeWidth={1.8} />
                </span>

                <span className="min-w-0">
                  <span
                    className="block text-[13.5px]"
                    style={{
                      color: active ? "var(--rf-text)" : "var(--rf-text-2)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {section.label}
                  </span>
                  <span
                    className="mt-0.5 block text-[11.5px] leading-snug"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {section.summary}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
