/**
 * Kertoo käyttäjälle mitä dataa hän katsoo ja miksi.
 *
 * Demo-aineistoa ei saa esittää oikeana (§47, §74), eikä puuttuvaa
 * tietokantaa saa piilottaa tyhjänä listana. Kirjautuneelle käyttäjälle
 * ei koskaan näytetä demolukuja.
 */

import Link from "next/link";
import { Notice } from "@/components/ui";
import type { AppMode } from "@/lib/auth";
import type { DataResult } from "@/lib/data/documents";

export function ModeNotice({ mode }: { mode: AppMode }) {
  if (mode.kind === "live") return null;

  if (mode.kind === "setup-required") {
    return (
      <Notice tone="warn" title="Tietokannan rakenteet puuttuvat">
        <p>
          Olet kirjautunut, mutta tauluja ei ole vielä luotu. Aja migraatiot
          ennen kuin jatkat — organisaatiota ei voi luoda eikä dokumentteja
          lähettää ennen sitä.
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>
            Avaa <code>supabase/migrations/ALL_IN_ONE.sql</code> ja kopioi koko
            sisältö.
          </li>
          <li>Liitä se Supabasen SQL Editoriin ja paina Run.</li>
          <li>Lataa tämä sivu uudelleen.</li>
        </ol>
      </Notice>
    );
  }

  if (mode.kind === "no-org") {
    return (
      <Notice tone="warn" title="Sinulla ei ole vielä organisaatiota">
        <Link href="/onboarding" className="underline underline-offset-4">
          Luo organisaatio
        </Link>{" "}
        päästäksesi lähettämään dokumentteja.
      </Notice>
    );
  }

  if (mode.reason === "not_configured") {
    return (
      <Notice tone="warn" title="Tietokantayhteyttä ei ole määritetty">
        Ympäristömuuttujat <code>NEXT_PUBLIC_SUPABASE_URL</code> ja{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> puuttuvat. Alla näkyvä
        aineisto on demoa.
      </Notice>
    );
  }

  return (
    <Notice tone="info" title="Katselet demo-aineistoa">
      Luvut on laskettu oikealla sääntömoottorilla demo-tasoisilla säännöillä.
      Ne havainnollistavat toimintaa eivätkä ole oikeudellinen kannanotto.{" "}
      <Link href="/login" className="underline underline-offset-4">
        Kirjaudu
      </Link>{" "}
      nähdäksesi oman aineistosi.
    </Notice>
  );
}

/** Näytetään kun kysely epäonnistui — syy kerrotaan, ei piiloteta. */
export function DataProblem({ result }: { result: DataResult<unknown> }) {
  if (result.ok) return null;

  return (
    <Notice
      tone={result.problem === "schema_missing" ? "warn" : "risk"}
      title={
        result.problem === "schema_missing"
          ? "Tietokannan rakenteet puuttuvat"
          : "Tietoja ei voitu hakea"
      }
    >
      {result.message}
    </Notice>
  );
}
