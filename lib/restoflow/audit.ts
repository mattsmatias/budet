/**
 * Toimintaloki.
 *
 * LOKI ON TODISTE, EI NÄKYMÄ.
 *
 * Rivit syntyvät kannan liipaisimista eivätkä sovelluskoodista.
 * Sovelluksen kautta kirjattu loki jäisi kirjaamatta joka kerta kun
 * joku kutsuu rajapintaa suoraan tai kun uusi kirjoituspolku
 * unohdetaan — ja juuri silloin lokia tarvittaisiin.
 *
 * Tekijä luetaan istunnosta kannassa, ei parametrista. Loki jonka
 * tekijän voi valita itse ei todista mitään.
 */

export type AuditAction =
  "created" | "updated" | "deleted" | "published" | "cancelled" | "completed";

export type AuditEntity =
  | "member"
  | "shift"
  | "receipt"
  | "task"
  | "budget"
  | "sales_group"
  | "time_correction";

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  summary: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  critical: boolean;
  createdAt: string;
}

export const ACTION_LABELS: Record<string, string> = {
  created: "Lisäsi",
  updated: "Muutti",
  deleted: "Poisti",
  published: "Julkaisi",
  cancelled: "Perui",
  completed: "Merkitsi tehdyksi",
};

export const ENTITY_LABELS: Record<string, string> = {
  member: "Työntekijät",
  shift: "Työvuorot",
  receipt: "Kuitit",
  task: "Tehtävät",
  budget: "Budjetit",
  sales_group: "Verotus",
  time_correction: "Työajanseuranta",
};

/**
 * Toiminnon sävy.
 *
 * Väri kertoo mitä tapahtui, ei kuinka vakavaa se oli: vakavuus on
 * oma merkintänsä. Kolme sävyä riittää — lisääminen, muuttaminen ja
 * poistaminen ovat ne joita listasta etsitään.
 */
export function actionTone(action: string): "ok" | "info" | "risk" {
  if (
    action === "created" ||
    action === "completed" ||
    action === "published"
  ) {
    return "ok";
  }
  if (action === "deleted" || action === "cancelled") return "risk";
  return "info";
}

export interface AuditFilter {
  entityType?: string;
  action?: string;
  actorId?: string;
  /** Vapaa haku: tekijä, kohde tai kuvaus. */
  search?: string;
  /** Aikaikkuna päivinä taaksepäin. */
  days?: number;
}

/**
 * Yhteenveto siitä mitä tänään on tapahtunut.
 *
 * Omistaja avaa lokin kysyäkseen "mitä täällä on tapahtunut", ei
 * lukeakseen sataa riviä. Luvut vastaavat siihen ennen kuin listaa
 * tarvitsee selata.
 */
export interface AuditSummary {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  other: number;
  latestCritical: AuditEvent | null;
}

export function summarise(events: AuditEvent[]): AuditSummary {
  const summary: AuditSummary = {
    total: events.length,
    created: 0,
    updated: 0,
    deleted: 0,
    other: 0,
    latestCritical: null,
  };

  for (const event of events) {
    if (event.action === "created") summary.created += 1;
    else if (event.action === "updated") summary.updated += 1;
    else if (event.action === "deleted") summary.deleted += 1;
    else summary.other += 1;

    if (event.critical && summary.latestCritical === null) {
      summary.latestCritical = event;
    }
  }

  return summary;
}

/**
 * Muuttuneet kentät luettavaksi listaksi.
 *
 * Ennen ja jälkeen samasta avaimesta rinnakkain. Avain joka on vain
 * toisessa näkyy silti: lisätty tai poistettu arvo on yhtä lailla
 * muutos.
 */
export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

const FIELD_LABELS: Record<string, string> = {
  hourly_rate_cents: "Tuntipalkka",
  monthly_salary_cents: "Kuukausipalkka",
  role: "Rooli",
  position: "Tehtävä",
  active: "Käytössä",
  vat_rate: "ALV-kanta",
  name: "Nimi",
  amount_cents: "Summa",
  total_cents: "Summa",
  vat_cents: "ALV",
  category: "Kategoria",
  date: "Päivä",
  start: "Alkaa",
  end: "Päättyy",
  break_minutes: "Tauko",
  due_on: "Eräpäivä",
  priority: "Prioriteetti",
  assigned_to: "Vastuuhenkilö",
  user_id: "Tekijä",
  in: "Sisään",
  out: "Ulos",
  reason: "Syy",
};

export function fieldChanges(event: AuditEvent): FieldChange[] {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return keys.map((key) => ({
    field: FIELD_LABELS[key] ?? key,
    before: renderValue(key, before[key]),
    after: renderValue(key, after[key]),
  }));
}

/**
 * Arvo luettavaksi tekstiksi.
 *
 * Senttikentät euroina ja kannat prosentteina: loki luetaan samoilla
 * yksiköillä kuin näkymät, muuten lukija joutuu muuntamaan päässään
 * juuri siinä kohtaa jossa hän tarkistaa onko luku oikein.
 */
function renderValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (typeof value === "number" && key.endsWith("_cents")) {
    return `${(value / 100).toFixed(2).replace(".", ",")} €`;
  }

  if (key === "vat_rate") {
    const rate = Number(value);
    return Number.isFinite(rate)
      ? `${(rate * 100).toFixed(1).replace(".", ",")} %`
      : String(value);
  }

  if (typeof value === "boolean") return value ? "kyllä" : "ei";

  return String(value);
}
