/**
 * CSV-vienti (§20, §51).
 *
 * Vie VAIN ne dokumentit joilla ei ole estettä. Estetty dokumentti ei
 * päädy tiedostoon hiljaisesti — se jää vientinäkymään syineen.
 */

import { NextResponse } from "next/server";
import { getActiveOrg, getSessionUser } from "@/lib/auth";
import { listDocuments } from "@/lib/data/documents";
import { EXPORT_CANDIDATE_STATUSES, toExportable } from "@/lib/data/export-adapter";
import { planExport, toCsv } from "@/lib/services/export";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Kirjautuminen vaaditaan." }, { status: 401 });
  }

  const org = await getActiveOrg();
  if (!org) {
    return NextResponse.json({ error: "Organisaatiota ei ole valittu." }, { status: 400 });
  }

  const result = await listDocuments(org.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 503 });
  }

  const candidates = result.data.filter((d) =>
    EXPORT_CANDIDATE_STATUSES.includes(d.status),
  );

  // Suunnitelma per dokumentti, jotta estetyt voidaan rajata pois yksitellen
  // sen sijaan että yksi este kaataisi koko viennin.
  const exportable = candidates
    .map(toExportable)
    .filter((doc) => planExport([doc]).blocks.length === 0);

  if (exportable.length === 0) {
    return NextResponse.json(
      { error: "Yhtään dokumenttia ei ole valmiina vietäväksi." },
      { status: 409 },
    );
  }

  const plan = planExport(exportable);
  const csv = toCsv(plan.rows);
  const stamp = new Date().toISOString().slice(0, 10);

  // Vienti on kirjanpidollinen tapahtuma, joten se kirjataan.
  const supabase = await createClient();
  await supabase.rpc("log_audit_event", {
    p_org_id: org.id,
    p_action: "export.created",
    p_entity_type: "export",
    p_metadata: {
      format: "csv",
      document_count: exportable.length,
      row_count: plan.rows.length,
    },
  });

  // BOM, jotta suomalainen Excel tunnistaa UTF-8:n oikein.
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="verra-vienti-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
