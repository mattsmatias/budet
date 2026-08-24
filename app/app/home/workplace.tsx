import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar } from "@/components/restoflow/ui";
import type { Colleague } from "@/lib/restoflow/queries";
import { birthdaySentence } from "@/lib/restoflow/workplace";

/**
 * Työyhteisö etusivulla.
 *
 * Kaksi osaa, joista toinen ilmestyy vain kun sillä on sisältöä.
 *
 * Syntymäpäiväkortti näkyy vain syntymäpäivänä. Tyhjä kortti tekstillä
 * "ei syntymäpäiviä tänään" olisi ruudulla joka päivä kertomassa ettei
 * mitään ole tapahtunut.
 *
 * Työkaveririvi on aina, koska se on siirtymä eikä uutinen.
 */
export function Workplace({
  colleagues,
  birthdays,
}: {
  colleagues: Colleague[];
  birthdays: Colleague[];
}) {
  return (
    <div className="space-y-3">
      {birthdays.length > 0 ? (
        <div
          className="flex items-center gap-3.5 px-4 py-3.5"
          style={{
            background: "var(--rf-amber-bg)",
            border: "1px solid var(--rf-line)",
            borderRadius: 14,
          }}
        >
          <span aria-hidden="true" className="text-[24px] leading-none">
            🎂
          </span>
          <p className="text-[14px] leading-snug font-medium">
            {birthdaySentence(birthdays.map((b) => b.name))}
          </p>
        </div>
      ) : null}

      <Link href="/app/tyoyhteiso" className="rf-press block">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: 14,
          }}
        >
          {/*
            Kolme ensimmäistä kasvoa riittää vihjeeksi siitä mitä linkin
            takana on. Koko henkilöstö tässä olisi lista listan edessä.
          */}
          <span className="flex shrink-0 -space-x-2">
            {colleagues.slice(0, 3).map((person) => (
              <span
                key={person.id}
                className="inline-flex"
                style={{ border: "2px solid var(--rf-card)", borderRadius: "50%" }}
              >
                <Avatar initials={person.initials} size={28} />
              </span>
            ))}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">Työyhteisö</span>
            <span className="block text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {colleagues.length}{" "}
              {colleagues.length === 1 ? "työkaveri" : "työkaveria"}
            </span>
          </span>

          <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
            <RfIcon name="chevron" size={16} />
          </span>
        </div>
      </Link>
    </div>
  );
}
