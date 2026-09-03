import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminContext } from "@/lib/restoflow/page-context";
import { Card, CardHeader } from "@/components/restoflow/ui";
import { ReservationTabs } from "../tabs";
import { Importer } from "./importer";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.varausTuonti.title };
}

/**
 * Tuonti toisesta varausjärjestelmästä.
 *
 * Ravintola joka vaihtaa järjestelmää ei aloita tyhjästä salista: sillä
 * on pöydät, paikkaluvut ja kalenterillinen varauksia. Ilman tuontia
 * käyttöönottopäivä olisi se päivä jona kaikki varaukset näpytellään
 * käsin uudelleen — ja juuri sinä päivänä ne unohtuvat.
 *
 * Sivu on asetusten alla eikä omana välilehtenään: se tehdään kerran.
 */
export default async function ImportPage() {
  const t = adminText(await resolveLocale());
  await adminContext("/admin/varaukset/tuonti");

  return (
    <div className="rf-enter space-y-5">
      <ReservationTabs t={t} current="asetukset" />

      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {t.varausTuonti.title}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausTuonti.intro}
        </p>
      </header>

      <Card>
        <Importer t={t} />
      </Card>

      <Card>
        <CardHeader
          title={t.varausTuonti.helpTitle}
          subtitle={t.varausTuonti.helpHint}
        />
        <ul className="space-y-1.5 text-[13px]">
          {t.varausTuonti.helpItems.map((item) => (
            <li key={item} style={{ color: "var(--rf-text-2)" }}>
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-4">
          <Link
            href="/admin/varaukset/asetukset"
            className="text-[13px] font-semibold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.varausTuonti.backToSettings}
          </Link>
        </p>
      </Card>
    </div>
  );
}
