"use client";

import { useActionState, useId, useState } from "react";
import { usePathname } from "next/navigation";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { sendFeedback } from "./actions";
import { CONTROL, CONTROL_STYLE, Field } from "../asetukset/form-parts";
import type { FeedbackKind } from "@/lib/restoflow/feedback";

const initial: AdminState = {};

/**
 * Ilmoituslomake.
 *
 * LAJI ENSIN, KOSKA SE MUUTTAA KYSYMYKSEN.
 *
 * Bugista kysytään mitä teit, mitä odotit ja mitä tapahtui; ehdotuksesta
 * ei kysytä mitään sellaista. Sama vihjeteksti molemmille olisi ollut
 * väärä toiselle, ja väärä ohje tuottaa vastauksen jota ei voi käyttää.
 *
 * Laji on kolme painiketta eikä pudotusvalikko: vaihtoehtoja on kolme,
 * ne mahtuvat riville, ja valinta on se joka ohjaa loput lomakkeesta.
 */
export function FeedbackForm({ t }: { t: AdminText }) {
  const [state, action, pending] = useActionState(sendFeedback, initial);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const pathname = usePathname();
  const nimi = useId();

  const lajit: { arvo: FeedbackKind; otsikko: string; vihje: string }[] = [
    { arvo: "bug", otsikko: t.palaute.kindBug, vihje: t.palaute.kindBugHint },
    { arvo: "idea", otsikko: t.palaute.kindIdea, vihje: t.palaute.kindIdeaHint },
    {
      arvo: "contact",
      otsikko: t.palaute.kindContact,
      vihje: t.palaute.kindContactHint,
    },
  ];

  const valittu = lajit.find((l) => l.arvo === kind) ?? lajit[0];

  return (
    <form action={action} className="space-y-4">
      {/*
        Mistä näkymästä ilmoitus lähti.

        Tämä on ero "jokin ei toimi" -viestin ja korjattavan vian
        välillä. Piilokenttä, koska kysyminen olisi työtä jonka selain
        osaa tehdä itse — palvelin tarkistaa arvon silti.
      */}
      <input type="hidden" name="path" value={pathname} />

      <fieldset>
        <legend className="text-[13px] font-semibold">{t.palaute.kind}</legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {lajit.map((laji) => {
            const on = laji.arvo === kind;
            return (
              <label
                key={laji.arvo}
                className="rf-press rf-touch cursor-pointer px-3.5 text-[13px] font-semibold"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 980,
                  background: on ? "var(--rf-accent)" : "var(--rf-inset)",
                  color: on ? "var(--rf-on-accent)" : "var(--rf-text)",
                }}
              >
                <input
                  type="radio"
                  name="kind"
                  value={laji.arvo}
                  checked={on}
                  onChange={() => setKind(laji.arvo)}
                  className="sr-only"
                />
                {laji.otsikko}
              </label>
            );
          })}
        </div>

        <p
          className="mt-2 text-[12.5px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {valittu.vihje}
        </p>
      </fieldset>

      <Field
        label={t.palaute.titleField}
        hint={t.palaute.titleHint}
        htmlFor={`${nimi}-title`}
      >
        <input
          id={`${nimi}-title`}
          name="title"
          required
          minLength={3}
          maxLength={120}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field
        label={t.palaute.bodyField}
        hint={kind === "bug" ? t.palaute.bodyHintBug : t.palaute.bodyHint}
        htmlFor={`${nimi}-body`}
      >
        <textarea
          id={`${nimi}-body`}
          name="body"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className={CONTROL}
          style={{ ...CONTROL_STYLE, height: "auto", paddingTop: 10 }}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rf-press rf-touch px-5 text-[13px] font-bold disabled:opacity-60"
          style={{
            borderRadius: 980,
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
          }}
        >
          {t.palaute.send}
        </button>

        {state.error ? (
          <span className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
            {state.error}
          </span>
        ) : null}

        {state.notice ? (
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: "var(--rf-green-text)" }}
          >
            {state.notice}
          </span>
        ) : null}
      </div>
    </form>
  );
}
