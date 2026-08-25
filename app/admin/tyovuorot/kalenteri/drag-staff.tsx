"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createShiftByDrop } from "../planning-actions";
import { POSITION_LABELS, type User } from "@/lib/restoflow/types";
import { Avatar } from "@/components/restoflow/ui";

/**
 * Työntekijän raahaus päivälle.
 *
 * DESKTOPIN TYÖKALU, EI AINOA TIE.
 *
 * Raahaus on hiiren ele. Kosketusnäytöllä sitä ei ole, ja siksi sama
 * vuoro syntyy myös päivää klikkaamalla — raahaus nopeuttaa
 * suunnittelua koneella muttei ole edellytys sille.
 *
 * KUUNTELIJAT OVAT DOKUMENTISSA, EIVÄT RUUDUISSA.
 *
 * Kalenteri piirretään palvelimella. Jos jokainen ruutu olisi oma
 * asiakaskomponenttinsa vain pudotusta varten, koko ruudukko
 * lähetettäisiin selaimeen turhaan. Tämä yksi komponentti kiinnittää
 * kuuntelijat data-day-määritteellä merkittyihin ruutuihin.
 *
 * AJAT PÄÄTELLÄÄN, EI KYSYTÄ.
 *
 * Pudotus antaa vain kenet ja minne. Kellonajat tulevat palvelimella
 * työntekijän viimeisimmästä vuorosta; ravintolassa sama ihminen tekee
 * lähes aina samaa vuoroa. Vuoro syntyy luonnoksena, joten väärä
 * arvaus ei mene kenellekään.
 */
export function DragStaff({ users }: { users: User[] }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const overRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function clearHighlight() {
      if (overRef.current) {
        overRef.current.style.removeProperty("outline");
        overRef.current = null;
      }
    }

    function dayUnder(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-day]");
    }

    function onDragOver(event: DragEvent) {
      const cell = dayUnder(event.target);
      if (!cell) return;

      // preventDefault on se mikä tekee alueesta pudotettavan.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";

      if (overRef.current !== cell) {
        clearHighlight();
        overRef.current = cell;
        cell.style.outline = "2px solid var(--rf-accent)";
      }
    }

    function onDrop(event: DragEvent) {
      const cell = dayUnder(event.target);
      const date = cell?.dataset.day;
      const userId = event.dataTransfer?.getData("text/budet-user");

      clearHighlight();
      setDragging(null);

      if (!date || !userId) return;

      event.preventDefault();

      const data = new FormData();
      data.set("userId", userId);
      data.set("date", date);

      startTransition(() => {
        void createShiftByDrop(data);
      });
    }

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragend", clearHighlight);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", clearHighlight);
      clearHighlight();
    };
  }, []);

  const staff = users.filter((user) => user.position !== null && user.active);
  if (staff.length === 0) return null;

  return (
    <div
      /*
       * Piilossa puhelimessa.
       *
       * Raahaus ei toimi kosketuksella, ja rivi työntekijöitä joita ei
       * voi raahata olisi pelkkä lupaus jota ei voi lunastaa.
       */
      className="hidden md:block"
    >
      <p className="mb-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Raahaa työntekijä päivälle, niin vuoro syntyy luonnoksena hänen
        viimeisimmän vuoronsa kellonajoilla.
        {pending ? " Luodaan…" : ""}
      </p>

      <ul className="flex flex-wrap gap-2">
        {staff.map((user) => (
          <li key={user.id}>
            <div
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/budet-user", user.id);
                event.dataTransfer.effectAllowed = "copy";
                setDragging(user.id);
              }}
              onDragEnd={() => setDragging(null)}
              className="rf-press flex cursor-grab items-center gap-2 px-2.5 py-1.5 active:cursor-grabbing"
              style={{
                background: "var(--rf-inset)",
                border: "1px solid var(--rf-line-strong)",
                borderRadius: "var(--rf-r-control)",
                opacity: dragging === user.id ? 0.5 : 1,
              }}
              title={`Raahaa ${user.name} päivälle`}
            >
              <Avatar initials={user.initials} size={22} />
              <span className="text-[12.5px] font-semibold">{user.name}</span>
              {user.position ? (
                <span className="text-[11px]" style={{ color: "var(--rf-text-3)" }}>
                  {POSITION_LABELS[user.position]}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
