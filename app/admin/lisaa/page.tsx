import Link from "next/link";
import { labels } from "@/lib/i18n/labels";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { requireContext } from "@/lib/restoflow/session";
import { landingFor, moreNavFor } from "@/lib/restoflow/permissions";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar, Card, SectionLabel } from "@/components/restoflow/ui";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";

export const metadata = { title: "Lisää" };

/**
 * Ylivuotonäkymä puhelimen alapalkille.
 *
 * Alapalkkiin mahtuu neljä kohtaa ennen kuin kosketuskohteista tulee liian
 * kapeita. Loput ovat täällä, samasta oikeuslistasta johdettuina.
 */
export default async function AdminMorePage() {
  const { user, restaurant, role } = await requireContext("/admin/lisaa");
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);

  const items = moreNavFor(role);

  // Ilman yhtäkään hallintanäkymää tämä sivu on tyhjä kuori.
  if (items.length === 0) redirect(landingFor(role));
  const overflow = items;
  const name = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-1"></header>

      <Card>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name)} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{name}</p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {nimet.roles[role]}
            </p>
            <p
              className="truncate text-[13px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {restaurant.name}
            </p>
          </div>
        </div>
      </Card>

      {overflow.length > 0 ? (
        <section>
          <SectionLabel>Näkymät</SectionLabel>
          <Card padded={false}>
            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {overflow.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <span style={{ color: "var(--rf-text-2)" }}>
                      <RfIcon name={item.icon} size={20} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">
                      {t.nav[item.key]}
                    </span>
                    <span style={{ color: "var(--rf-text-3)" }}>
                      <RfIcon name="chevron" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/*
        Työntekijänäkymä oli tässä listan toisena.

        Se vei hallinnasta ulos toiseen sovellukseen saman tunnuksen
        alla, eikä listasta käynyt ilmi että paluu on eri paikassa.
        Ravintoloitsijan työpöytä ja työntekijän näkymä ovat eri
        työkaluja.
      */}
      <section>
        <SectionLabel>Muuta</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <li>
              <Link
                href="/admin/ilmoitukset"
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <span style={{ color: "var(--rf-text-2)" }}>
                  <RfIcon name="bell" size={20} />
                </span>
                <span className="flex-1 text-[15px] font-medium">Huomiot</span>
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
          Kirjaudu ulos
        </button>
      </form>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
