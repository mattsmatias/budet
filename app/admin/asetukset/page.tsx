import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { previousMonth } from "@/lib/restoflow/expenses";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { extractorName, isRealExtractor } from "@/lib/restoflow/receipt-ai";
import { Card, Pill, ScopeNotice } from "@/components/restoflow/ui";
import { MonthClosing, SettingsForm } from "./settings-form";
import { CategoryManager } from "./categories";

export const metadata = { title: "Asetukset" };

export default async function SettingsPage() {
  const { restaurant, role, users, receipts, closedMonths, categories, month } =
    await adminContext("/admin/asetukset");

  const canEdit = can(role, "settings.edit");

  // Kaksitoista edellistä kuukautta. Kuluva ei ole mukana: siihen tulee
  // vielä kuitteja, eikä sitä voi sulkea.
  const selectableMonths: string[] = [];
  let cursor = previousMonth(month);
  for (let i = 0; i < 12; i++) {
    selectableMonths.push(cursor);
    cursor = previousMonth(cursor);
  }

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
          Asetukset
        </h1>
        <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {restaurant.name}
        </p>
      </div>

      {canEdit ? null : (
        <ScopeNotice>
          Näet asetukset mutta et voi muuttaa niitä. Muutokset ovat omistajan
          oikeus.
        </ScopeNotice>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-[16px] font-semibold">Ravintola</h2>

          {canEdit ? (
            <SettingsForm name={restaurant.name} timezone={restaurant.timezone} />
          ) : (
            <dl className="mt-3">
              <Row label="Nimi" value={restaurant.name} />
              <Row label="Aikavyöhyke" value={restaurant.timezone} />
              <Row label="Valuutta" value={restaurant.currency} />
              <Row label="Käyttäjiä" value={String(users.length)} last />
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Kirjanpitokuukaudet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Suljettu kuukausi on kirjanpitoon lähetetty kuukausi. Sen jälkeen
            tehty muutos ei enää täsmää siihen mitä kirjanpitäjälle on annettu.
          </p>

          {canEdit ? (
            <MonthClosing
              closedMonths={closedMonths}
              selectableMonths={selectableMonths}
            />
          ) : (
            <p className="mt-4 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {closedMonths.length === 0
                ? "Yhtään kuukautta ei ole suljettu."
                : `Suljettu: ${closedMonths.join(", ")}`}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Yhteenveto</h2>
          <dl className="mt-3">
            <Row label="Kuitteja yhteensä" value={String(receipts.length)} />
            <Row label="Käyttäjiä" value={String(users.length)} />
            <Row label="Valuutta" value={restaurant.currency} />
            <Row label="Suljettuja kuukausia" value={String(closedMonths.length)} last />
          </dl>
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Kulukategoriat</h2>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Kategoriat joihin kuitit luokitellaan.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {Object.values(CATEGORY_LABELS).map((label) => (
              <li key={label}>
                <Pill>{label}</Pill>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--rf-line)" }}>
            <h3 className="text-[14px] font-semibold">Omat kategoriat</h3>
            {canEdit ? (
              <CategoryManager categories={categories} />
            ) : (
              <p className="mt-2 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                {categories.length === 0
                  ? "Omia kategorioita ei ole määritetty."
                  : categories.map((c) => c.name).join(", ")}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Kuittien poiminta</h2>
          <dl className="mt-3">
            <Row label="Poimija" value={extractorName()} />
            <Row label="Tuetut muodot" value="JPG, PNG, HEIC, PDF" />
            <Row
              label="Epävarma tieto"
              value="Merkitään, ei tallenneta faktana"
              last
            />
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            {isRealExtractor()
              ? "Poiminta lukee kuitin kuvasta. Jokainen kenttä on silti tarkistettavissa ennen tallennusta — kone ehdottaa, ihminen vahvistaa."
              : "Poiminta on paikallinen jäljitelmä: tiedostonimi ratkaisee tuloksen, ei kuitin sisältö. Oikea palvelu kytketään ympäristömuuttujilla ilman koodimuutosta."}
          </p>
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Mitä Budet ei tee</h2>
          <ul
            className="mt-3 space-y-1.5 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            <li>Ei lue kassajärjestelmää eikä myyntiä</li>
            <li>Ei yhteyttä pankkitiliin</li>
            <li>Ei varastonhallintaa eikä tilauksia</li>
            <li>Ei asiakasvarauksia, kanta-asiakkuuksia eikä CRM:ää</li>
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Rajaus on tarkoituksellinen. Yleiskatsauksen luvut tarkoittavat aina
            järjestelmään kirjattuja kuluja, eivät ravintolan taloudellista
            tulosta.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2.5 ${last ? "" : "border-b"}`}
      style={{ borderColor: "var(--rf-line)" }}
    >
      <dt className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </dt>
      <dd className="text-right text-[14px] font-medium">{value}</dd>
    </div>
  );
}
