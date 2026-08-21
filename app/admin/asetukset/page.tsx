import { adminContext } from "@/lib/restoflow/page-context";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { Card, DemoNotice, Pill } from "@/components/restoflow/ui";

export const metadata = { title: "Asetukset" };

export default async function SettingsPage() {
  const {
    users,
  } = await adminContext("/admin/asetukset");

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Asetukset</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Ravintola Linnea
        </p>
      </div>

      <DemoNotice>
        Asetusten muuttaminen vaatii kirjautumisen ja tietokantayhteyden, joita
        ei ole vielä kytketty. Alla näkyy nykyinen kokoonpano, ei muokattavia
        kenttiä — tyhjä lomake joka ei tallenna olisi harhaanjohtava.
      </DemoNotice>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-[16px] font-semibold">Ravintola</h2>
          <dl className="mt-3">
            <Row label="Nimi" value="Ravintola Linnea" />
            <Row label="Käyttäjiä" value={String(users.length)} />
            <Row label="Valuutta" value="EUR" />
            <Row label="Aikavyöhyke" value="Europe/Helsinki" last />
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
          <p className="mt-4 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Omien kategorioiden lisääminen ei ole vielä käytössä.
          </p>
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Kuittien poiminta</h2>
          <dl className="mt-3">
            <Row label="Poimija" value="Paikallinen demo (mock)" />
            <Row label="Tuetut muodot" value="JPG, PNG, HEIC, PDF" />
            <Row label="Epävarma tieto" value="Merkitään, ei tallenneta faktana" last />
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Poiminta on erotettu rajapinnan taakse, joten oikea palvelu
            voidaan kytkeä vaihtamatta käyttöliittymää.
          </p>
        </Card>

        <Card>
          <h2 className="text-[16px] font-semibold">Mitä RestoFlow ei tee</h2>
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
            Rajaus on tarkoituksellinen. Dashboardin luvut tarkoittavat aina
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
