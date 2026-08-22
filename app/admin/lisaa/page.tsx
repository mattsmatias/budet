import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { requireContext } from "@/lib/restoflow/session";
import { adminNavFor, landingFor } from "@/lib/restoflow/permissions";
import { ROLE_LABELS } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar, Card, SectionLabel } from "@/components/restoflow/ui";

export const metadata = { title: "Lisää" };

/**
 * Ylivuotonäkymä puhelimen alapalkille.
 *
 * Alapalkkiin mahtuu neljä kohtaa ennen kuin kosketuskohteista tulee liian
 * kapeita. Loput ovat täällä, samasta oikeuslistasta johdettuina.
 */
export default async function AdminMorePage() {
  const { user, restaurant, role } = await requireContext("/admin/lisaa");

  const items = adminNavFor(role);

  // Ilman yhtäkään hallintanäkymää tämä sivu on tyhjä kuori.
  if (items.length === 0) redirect(landingFor(role));
  const overflow = items.slice(4);
  const name = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Lisää</h1>
      </header>

      <Card>
        <div className="flex items-center gap-3.5">
          <Avatar initials={initialsOf(name)} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{name}</p>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]}
            </p>
            <p className="truncate text-[13px]" style={{ color: "var(--rf-text-3)" }}>
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
                  <Link href={item.href} className="flex items-center gap-3 px-5 py-3.5">
                    <span style={{ color: "var(--rf-text-2)" }}>
                      <RfIcon name={item.icon} size={20} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{item.label}</span>
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

      <section>
        <SectionLabel>Muuta</SectionLabel>
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            <li>
              <Link href="/app" className="flex items-center gap-3 px-5 py-3.5">
                <span style={{ color: "var(--rf-text-2)" }}>
                  <RfIcon name="clock" size={20} />
                </span>
                <span className="flex-1 text-[15px] font-medium">Työntekijänäkymä</span>
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
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
