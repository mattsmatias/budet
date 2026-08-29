"use client";

import { useActionState, useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";
import { formatRate } from "@/lib/money";
import type { PosMapping, SalesGroup } from "@/lib/restoflow/sales-vat";
import {
  deletePosMapping,
  deleteSalesGroup,
  savePosMapping,
  saveSalesGroup,
  seedDefaultPosMappings,
  seedDefaultSalesGroups,
  setDefaultSalesGroup,
  type VatState,
} from "./vat-actions";
import { CONTROL, CONTROL_STYLE, Feedback, Submit } from "./form-parts";

const initial: VatState = {};

/**
 * Myyntiryhmät ja niiden verokannat.
 *
 * EI YHTÄ "RAVINTOLAN ALV %" -KENTTÄÄ.
 *
 * Ravintolassa on samana päivänä kaksi tai kolme kantaa. Yksi kenttä
 * pakottaisi keskiarvoon, joka ei ole mikään verokanta — ja juuri
 * siihen lukuun täsmäytys kaatuisi.
 *
 * Prosentit eivät ole kovakoodattuja missään. Kanta on ravintolan oma
 * asetus, koska verokannat muuttuvat lainsäädännöllä ja Kate toimii
 * myös muissa maissa.
 */
export function SalesGroups({
  groups,
  mappings,
}: {
  groups: SalesGroup[];
  /* Kohdistukset tarvitaan poiston varoitukseen, ei näyttämiseen. */
  mappings: PosMapping[];
}) {
  const [state, action] = useActionState(saveSalesGroup, initial);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      {groups.length === 0 ? (
        /*
          Tyhjä näkymä on este jota kukaan ei ohita illan päätteeksi.
          Pohja vie sen pois yhdellä painalluksella; ryhmiä voi
          muokata ja poistaa vapaasti jälkeenpäin.
        */
        <div
          className="px-3.5 py-3.5"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            Yhtään myyntiryhmää ei ole vielä määritetty. Suomessa ravintolan
            kannat ovat samat joka ravintolalle, joten voit aloittaa
            vakiopohjasta ja muokata sitä.
          </p>

          <form action={seedDefaultSalesGroups} className="mt-3">
            <button
              type="submit"
              className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
              style={{
                background: "var(--rf-accent)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <RfIcon name="plus" size={15} />
              Lisää Suomen vakioryhmät
            </button>
          </form>

          <p
            className="mt-2.5 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            Ravintolamyynti 13,5 %, Alkoholimyynti 25,5 %, Muut myynnit 25,5 %.
            Tarkista että kannat vastaavat nykyistä lainsäädäntöä — Kate ei
            seuraa verokantojen muutoksia puolestasi.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {groups.map((group) =>
            editing === group.id ? (
              <li key={group.id}>
                <GroupForm
                  group={group}
                  mappedNames={mappings
                    .filter((m) => m.salesGroupId === group.id)
                    .map((m) => m.posName)}
                  action={action}
                  state={state}
                  onClose={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={group.id}>
                <GroupRow group={group} onEdit={() => setEditing(group.id)} />
              </li>
            ),
          )}
        </ul>
      )}

      <div className="mt-4">
        {editing === "new" ? (
          <GroupForm
            action={action}
            state={state}
            onClose={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="plus" size={15} />
            Lisää myyntiryhmä
          </button>
        )}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  onEdit,
}: {
  group: SalesGroup;
  onEdit: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-3.5 py-2.5"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
        opacity: group.active ? 1 : 0.6,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold">
            {group.name}
          </span>

          {group.isDefault ? (
            <span
              className="shrink-0 px-1.5 py-px text-[10.5px] font-bold"
              style={{
                background: "var(--rf-accent-bg)",
                color: "var(--rf-accent-strong)",
                borderRadius: 999,
              }}
            >
              Oletus
            </span>
          ) : null}

          {group.active ? null : (
            <span
              className="shrink-0 text-[11.5px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              Ei käytössä
            </span>
          )}
        </span>
      </span>

      <span className="rf-tabular shrink-0 text-[13.5px] font-bold">
        {formatRate(group.vatRate)}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {group.isDefault ? null : (
          <form action={setDefaultSalesGroup}>
            <input type="hidden" name="id" value={group.id} />
            <button
              type="submit"
              className="rf-press px-2.5 py-1 text-[12px] font-semibold"
              style={{ color: "var(--rf-text-2)" }}
            >
              Aseta oletukseksi
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onEdit}
          className="rf-press px-2.5 py-1 text-[12px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          Muokkaa
        </button>
      </span>
    </div>
  );
}

/**
 * Ryhmän lomake.
 *
 * Poisto on lomakkeen sisällä eikä rivillä: se on harvinaisin toiminto
 * ja vaarallisin, joten se on askeleen päässä. Käytössä oleva ryhmä ei
 * poistu lainkaan — kanta estää sen viite-eheydellä, koska poistettu
 * ryhmä veisi mukanaan päivän myynnin.
 */
function GroupForm({
  group,
  mappedNames = [],
  action,
  state,
  onClose,
}: {
  group?: SalesGroup;
  mappedNames?: string[];
  action: (formData: FormData) => void;
  state: VatState;
  onClose: () => void;
}) {
  return (
    <div
      className="px-3.5 py-3"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <form action={action} className="space-y-3">
        {group ? <input type="hidden" name="id" value={group.id} /> : null}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className="block">
            <span className="block text-[12.5px] font-semibold">
              Myyntiryhmä
            </span>
            <input
              name="name"
              defaultValue={group?.name ?? ""}
              required
              maxLength={60}
              placeholder="Ravintolamyynti"
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            />
          </label>

          <label className="block">
            <span className="block text-[12.5px] font-semibold">ALV %</span>
            <input
              name="rate"
              defaultValue={
                group
                  ? String(Math.round(group.vatRate * 1e5) / 1e3).replace(
                      ".",
                      ",",
                    )
                  : ""
              }
              required
              inputMode="decimal"
              placeholder="13,5"
              className={`${CONTROL} rf-tabular mt-1.5`}
              style={CONTROL_STYLE}
            />
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            name="active"
            defaultChecked={group?.active ?? true}
            className="size-[18px] cursor-pointer"
            style={{ accentColor: "var(--rf-accent)" }}
          />
          <span className="text-[12.5px]">
            Käytössä
            <span className="ml-1.5" style={{ color: "var(--rf-text-3)" }}>
              — pois käytöstä otettu ryhmä säilyy vanhoilla riveillä
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="Tallenna" />

          <button
            type="button"
            onClick={onClose}
            className="rf-press px-2.5 py-2 text-[12.5px] font-semibold"
            style={{ color: "var(--rf-text-2)" }}
          >
            Peruuta
          </button>

          <Feedback state={state} />
        </div>
      </form>

      {group ? (
        <div
          className="mt-3 border-t pt-3"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <DeleteGroup
            id={group.id}
            name={group.name}
            mappedNames={mappedNames}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Ryhmän poisto.
 *
 * POISTO VIE MUKANAAN KOHDISTUKSET.
 *
 * Kassaryhmien kohdistukset viittaavat ryhmään, ja kanta poistaa ne
 * mukana. Se on oikein — kohdistus poistettuun ryhmään ei tarkoita
 * mitään — mutta se on kerrottava etukäteen. Ilman varoitusta
 * ravintola menettää asetuksensa nimeämättä, ja huomaa sen vasta kun
 * seuraava päiväraportti kohdistuu väärin.
 */
function DeleteGroup({
  id,
  name,
  mappedNames,
}: {
  id: string;
  name: string;
  mappedNames: string[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(deleteSalesGroup, initial);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rf-press text-[12px] font-semibold"
        style={{ color: "var(--rf-text-3)" }}
      >
        Poista ryhmä
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        Poistetaanko {name}? Onnistuu vain jos ryhmää ei ole käytetty
        yhdelläkään myyntipäivällä.
        {mappedNames.length > 0 ? (
          <>
            {" "}
            <strong
              className="font-bold"
              style={{ color: "var(--rf-amber-text)" }}
            >
              Mukana poistuu{" "}
              {mappedNames.length === 1 ? "kohdistus" : "kohdistukset"}{" "}
              {mappedNames.join(", ")}.
            </strong>
          </>
        ) : null}
      </p>

      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="rf-press px-2.5 py-1 text-[12px] font-bold"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: 8,
          }}
        >
          Poista
        </button>
      </form>

      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rf-press text-[12px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>

      <Feedback state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Kassajärjestelmän ryhmien kohdistus.
 *
 * Kassa tuntee omat nimensä — "Ruoka", "Viini", "Olut", "Take away" —
 * ja Kate tuntee myyntiryhmät. Kohdistus on ravintolakohtainen, koska
 * kaksi ravintolaa nimeää samat asiat eri tavoin.
 *
 * Ilman kohdistusta raportin ryhmä päätyy oletusryhmään. Myynti ei siis
 * katoa kohdistamattomuuden takia — mutta verokanta voi olla väärä, ja
 * juuri sen täsmäytys näyttää.
 */
export function PosMappings({
  mappings,
  groups,
}: {
  mappings: PosMapping[];
  groups: SalesGroup[];
}) {
  const [state, action] = useActionState(savePosMapping, initial);
  const active = groups.filter((g) => g.active);
  const byId = new Map(groups.map((g) => [g.id, g]));

  if (groups.length === 0) {
    return (
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        Lisää ensin myyntiryhmät. Kohdistus kertoo mihin niistä kassan oma
        ryhmänimi kuuluu.
      </p>
    );
  }

  return (
    <div>
      {mappings.length > 0 ? (
        <ul className="space-y-1.5">
          {mappings.map((mapping) => {
            const group = byId.get(mapping.salesGroupId);

            return (
              <li
                key={mapping.id}
                className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                  {mapping.posName}
                </span>

                <span
                  className="shrink-0"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  <RfIcon name="chevron" size={14} />
                </span>

                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {group?.name ?? "Poistettu ryhmä"}
                </span>

                <span className="rf-tabular shrink-0 text-[13px] font-bold">
                  {group ? formatRate(group.vatRate) : "—"}
                </span>

                <form action={deletePosMapping} className="shrink-0">
                  <input type="hidden" name="id" value={mapping.id} />
                  <button
                    type="submit"
                    aria-label={`Poista kohdistus ${mapping.posName}`}
                    className="rf-press flex h-7 w-7 items-center justify-center"
                    style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
                  >
                    <RfIcon name="trash" size={14} />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Kohdistuksia ei ole. Kohdistamaton ryhmä päätyy oletusryhmään, joten
          myynti ei katoa — mutta verokanta voi olla väärä.
        </p>
      )}

      <form action={action} className="mt-3.5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[12.5px] font-semibold">
              Nimi kassan raportissa
            </span>
            <input
              name="posName"
              required
              maxLength={80}
              placeholder="Ruoka"
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            />
          </label>

          <label className="block">
            <span className="block text-[12.5px] font-semibold">
              Katen myyntiryhmä
            </span>
            <select
              name="salesGroupId"
              required
              defaultValue={active[0]?.id ?? ""}
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            >
              {active.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {formatRate(group.vatRate)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="Lisää kohdistus" />
          <Feedback state={state} />
        </div>
      </form>

      {/*
        Yleiset nimet yhdellä painalluksella.

        Kohdistuksia on helposti kymmeniä, ja niiden naputtelu yksitellen
        on juuri sitä työtä joka jää tekemättä. Lista ei kirjoita päälle:
        omat kohdistukset säilyvät sellaisinaan.

        Painike on lomakkeen jälkeen eikä ennen sitä — käsin lisääminen
        on se mitä täällä useimmiten tehdään, ja pohja tarvitaan kerran.
      */}
      <form action={seedDefaultPosMappings} className="mt-4">
        <button
          type="submit"
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={15} />
          Lisää yleiset kassaryhmänimet
        </button>

        <p
          className="mt-2 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          RUOKA, LOUNAS, VEDET ja muut tavalliset nimet ravintolamyyntiin; OLUT,
          VIINI, ALKO ja vastaavat alkoholimyyntiin. Omat kohdistuksesi säilyvät
          ennallaan. Monitulkintaisia nimiä kuten JUOMAT tai TAKE AWAY ei
          kohdisteta puolestasi — niistä Kate varoittaa raporttia luettaessa.
        </p>
      </form>
    </div>
  );
}
