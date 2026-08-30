"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";
import { disconnect, selectPage, type MetaState } from "./actions";

const initial: MetaState = {};

function Notice({ state }: { state: MetaState }) {
  if (!state.error && !state.notice) return null;

  return (
    <p
      role={state.error ? "alert" : "status"}
      className="mt-3 text-[13px]"
      style={{
        color: state.error ? "var(--rf-red-text)" : "var(--rf-green-text)",
      }}
    >
      {state.error ?? state.notice}
    </p>
  );
}

/**
 * Sivun valinta.
 *
 * Lomakkeesta lähtee vain sivun tunniste. Nimi ja tokeni haetaan
 * palvelimella Metalta uudelleen, joten selaimesta ei voi väittää
 * sivua joksikin muuksi.
 */
export function PageChooser({
  t,
  pages,
}: {
  t: AdminText;
  pages: { id: string; name: string; hasInstagram: boolean }[];
}) {
  const [state, action] = useActionState(selectPage, initial);

  return (
    <div>
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.some.choosePageHint}
      </p>

      <ul className="mt-3 space-y-2">
        {pages.map((page) => (
          <li key={page.id}>
            <form
              action={action}
              className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <input type="hidden" name="pageId" value={page.id} />

              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">
                  {page.name}
                </span>
                <span
                  className="mt-0.5 block text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {page.hasInstagram
                    ? t.some.withInstagram
                    : t.some.withoutInstagram}
                </span>
              </span>

              <ChooseButton label={t.some.select} />
            </form>
          </li>
        ))}
      </ul>

      <Notice state={state} />
    </div>
  );
}

function ChooseButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" tone="primary" disabled={pending}>
      {label}
    </Button>
  );
}

/**
 * Yhteyden katkaisu.
 *
 * Kysyy varmistuksen, ja kertoo saman lauseen jälkeenpäin: Kate
 * lakkaa julkaisemasta, mutta sovelluksen oikeudet Facebookissa
 * poistetaan Facebookin omista asetuksista. Väärä lupaus olisi antaa
 * ymmärtää että tämä painike peruu nekin.
 */
export function DisconnectButton({ t }: { t: AdminText }) {
  const [state, action] = useActionState(
    /* Toiminto ei tarvitse lomakkeen kenttiä: se koskee koko yhteyttä. */
    async () => disconnect(),
    initial,
  );
  const [asking, setAsking] = useState(false);

  if (state.notice) {
    return (
      <div role="status">
        <p className="text-[13px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-2)" }}>
          {t.some.disconnectHint}
        </p>
      </div>
    );
  }

  if (!asking) {
    return (
      <div>
        <Button type="button" tone="ghost" onClick={() => setAsking(true)}>
          {t.some.disconnectBtn}
        </Button>
        <Notice state={state} />
      </div>
    );
  }

  return (
    <form action={action}>
      <p className="mb-2 text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
        {t.some.disconnectHint}
      </p>

      <div className="flex flex-wrap gap-2">
        <ConfirmButton label={t.some.confirmDisconnect} />
        <Button type="button" tone="ghost" onClick={() => setAsking(false)}>
          {t.some.cancel}
        </Button>
      </div>

      <Notice state={state} />
    </form>
  );
}

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="danger" disabled={pending}>
      {label}
    </Button>
  );
}

/** Yhdistämispainike. Linkki eikä lomake: se on selaimen siirtymä. */
export function ConnectLink({
  t,
  again,
}: {
  t: AdminText;
  again?: boolean;
}) {
  return (
    <a
      href="/api/meta/yhdista"
      className="rf-press inline-flex items-center gap-2 px-4 text-[14px] font-semibold"
      style={{
        minHeight: 44,
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="share" size={16} />
      {again ? t.some.reconnect : t.some.connect}
    </a>
  );
}
