"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import { IG_CAPTION_MAX } from "@/lib/restoflow/meta-post";
import { publishLunch, type PublishState } from "./publish-actions";

const initial: PublishState = {};

/**
 * Lounaslistan julkaisu someen.
 *
 * ---------------------------------------------------------------------
 * TEKSTI ON MUOKATTAVISSA, LOUNASLISTA EI MUUTU
 * ---------------------------------------------------------------------
 *
 * Kentässä on valmis teksti listasta. Ravintoloitsija voi kirjoittaa
 * sen päälle mitä haluaa, ja julkaistaan se mitä kentässä lukee.
 * Lounaslistaan se ei kirjoita mitään: julkaisu on kopio, ei
 * toinen näkymä samaan tietoon.
 *
 * ---------------------------------------------------------------------
 * KAKSOISJULKAISU KYSYY
 * ---------------------------------------------------------------------
 *
 * Jos sama viikko on jo julkaistu, painike vaihtuu varmistukseksi.
 * Sivun lataaminen uudelleen ja toinen painallus on tavallisin tapa
 * lähettää sama lista seuraajille kahdesti.
 */
export function PublishPanel({
  t,
  menuId,
  weekStart,
  defaultMessage,
  facebookReady,
  instagramReady,
  connectionName,
  already,
}: {
  t: AdminText;
  menuId: string;
  weekStart: string;
  defaultMessage: string;
  facebookReady: boolean;
  instagramReady: boolean;
  connectionName: string | null;
  already: boolean;
}) {
  const [state, action] = useActionState(publishLunch, initial);

  const [message, setMessage] = useState(defaultMessage);
  const [facebook, setFacebook] = useState(facebookReady);
  const [instagram, setInstagram] = useState(instagramReady);
  const [vahvistettu, setVahvistettu] = useState(false);
  const [nakyy, setNakyy] = useState<"facebook" | "instagram" | null>(null);

  const yli = message.length - IG_CAPTION_MAX;

  /* Julkaisun jälkeen näytetään tulos eikä lomaketta uudelleen. */
  if (state.facebook || state.instagram) {
    return (
      <div role="status" className="space-y-2">
        {state.facebook && state.facebook !== "skipped" ? (
          <Tulos
            nimi={t.some.facebook}
            ok={state.facebook === "ok"}
            virhe={state.facebookError}
            t={t}
          />
        ) : null}

        {state.instagram && state.instagram !== "skipped" ? (
          <Tulos
            nimi={t.some.instagram}
            ok={state.instagram === "ok"}
            virhe={state.instagramError}
            t={t}
          />
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="facebook" value={facebook ? "1" : "0"} />
      <input type="hidden" name="instagram" value={instagram ? "1" : "0"} />

      {/* --- Kanavat --- */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Kanava
          label={t.some.facebook}
          checked={facebook}
          disabled={!facebookReady}
          onChange={setFacebook}
        />
        <Kanava
          label={t.some.instagram}
          checked={instagram}
          disabled={!instagramReady}
          onChange={setInstagram}
        />

        {connectionName ? (
          <span
            className="text-[12.5px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {connectionName}
          </span>
        ) : null}
      </div>

      {/* --- Teksti --- */}
      <label className="block">
        <span className="block text-[12.5px] font-semibold">
          {t.some.messageLabel}
        </span>
        <span
          className="mt-0.5 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.some.messageHint}
        </span>

        <textarea
          name="message"
          rows={10}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="mt-2 w-full px-3.5 py-2.5 text-[14px] leading-relaxed outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
      </label>

      {instagram ? (
        <p
          className="text-[12px]"
          style={{
            color: yli > 0 ? "var(--rf-red-text)" : "var(--rf-text-3)",
          }}
        >
          {yli > 0
            ? fill(t.some.charsOver, { maara: String(yli) })
            : fill(t.some.charsLeft, { maara: String(-yli) })}
        </p>
      ) : null}

      {/* --- Esikatselu --- */}
      <div className="flex flex-wrap gap-2">
        {(["facebook", "instagram"] as const).map((kanava) => (
          <Button
            key={kanava}
            type="button"
            tone="ghost"
            size="sm"
            onClick={() => setNakyy(nakyy === kanava ? null : kanava)}
          >
            {kanava === "facebook"
              ? t.some.previewFacebook
              : t.some.previewInstagram}
          </Button>
        ))}
      </div>

      {nakyy ? (
        <div>
          {/*
            Kuva haetaan samasta koodista jolla se julkaistaan.
            Erillinen esikatselupiirto eroaisi juuri siinä mitä ei
            katsota. next/image ei sovi: tämä on kertakäyttöinen
            eikä optimoitava.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/meta/esikatselu?viikko=${weekStart}&kanava=${nakyy}`}
            alt={
              nakyy === "facebook"
                ? t.some.previewFacebook
                : t.some.previewInstagram
            }
            className="max-w-full"
            style={{
              width: nakyy === "instagram" ? 270 : 400,
              border: "1px solid var(--rf-line)",
              borderRadius: "var(--rf-r-control)",
            }}
          />
        </div>
      ) : null}

      {/* --- Julkaisu --- */}
      {already && !vahvistettu ? (
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {t.some.alreadyTitle}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              tone="ghost"
              onClick={() => setVahvistettu(true)}
            >
              {t.some.publishAgain}
            </Button>
          </div>
        </div>
      ) : (
        <PublishButton t={t} disabled={!facebook && !instagram} />
      )}

      {state.error ? (
        <p
          role="alert"
          className="text-[13px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Kanava({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-2 text-[13.5px] font-medium"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-[17px] w-[17px]"
      />
      {label}
    </label>
  );
}

function PublishButton({ t, disabled }: { t: AdminText; disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      tone="primary"
      disabled={pending || disabled}
      icon={<RfIcon name="share" size={16} />}
    >
      {pending ? t.some.publishing : t.some.publishNow}
    </Button>
  );
}

function Tulos({
  nimi,
  ok,
  virhe,
  t,
}: {
  nimi: string;
  ok: boolean;
  virhe?: string;
  t: AdminText;
}) {
  return (
    <div>
      <p
        className="text-[13.5px] font-semibold"
        style={{ color: ok ? "var(--rf-green-text)" : "var(--rf-red-text)" }}
      >
        {ok ? "✓" : "✕"} {nimi}: {ok ? t.some.statusOk : t.some.statusFailed}
      </p>

      {!ok && virhe ? (
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
          {virhe}
        </p>
      ) : null}
    </div>
  );
}
