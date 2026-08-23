import Link from "next/link";
import { ISO_DATE } from "@/lib/restoflow/dates";
import QRCode from "qrcode";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  fetchAllergenTypes,
  fetchDietTypes,
  fetchLunchHistory,
  fetchLunchWeek,
} from "@/lib/restoflow/queries";
import {
  DEFAULT_PRICE_NAME,
  LUNCH_STATUS_LABELS,
  formatDayShort,
  formatWeekRange,
  hasContent,
  hasUnpublishedChanges,
  includedSentence,
  isWeekend,
  isoWeekNumber,
  nextWeek,
  previousWeek,
  weekStartOf,
  weekdayName,
  type DietType,
  type LunchDay,
  type LunchWeek,
} from "@/lib/restoflow/lunch";
import { can } from "@/lib/restoflow/permissions";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { Button, Card, CardHeader, EmptyState, Pill } from "@/components/restoflow/ui";
import { openLunchWeek } from "./actions";
import {
  DeleteLunchItem,
  LunchIncludes,
  LunchItemDialog,
  LunchPriceField,
  MoveLunchItem,
} from "./editor";
import { LunchThemePicker } from "./theme-picker";
import { LunchChannels } from "./channels";
import { loadPublicWeek, weekAsText } from "@/lib/restoflow/public-lunch";
import {
  CopyDay,
  CopyPreviousWeek,
  CopyPublicLink,
  PublishWeek,
  WeekStatusButton,
} from "./week-actions";

export const metadata = { title: "Lounas" };

/**
 * Lounaslistan hallinta.
 *
 * Yksi viikko kerrallaan. Koko kuukauden näyttäminen tekisi sivusta
 * selailtavan mutta ei muokattavan — lounaslista tehdään viikko
 * kerrallaan, ja se on myös se yksikkö joka julkaistaan.
 */
export default async function LunchPage({
  searchParams,
}: PageProps<"/admin/lounas">) {
  const params = await searchParams;
  const { restaurant, role, today } = await adminContext("/admin/lounas");

  const requested = typeof params.viikko === "string" ? params.viikko : today;
  const weekStart = weekStartOf(
    ISO_DATE.test(requested) ? requested : today,
  );

  const [week, previous, diets, allergens, history] = await Promise.all([
    fetchLunchWeek(restaurant.id, weekStart),
    fetchLunchWeek(restaurant.id, previousWeek(weekStart)),
    fetchDietTypes(),
    fetchAllergenTypes(),
    fetchLunchHistory(restaurant.id),
  ]);

  const canManage = can(role, "lunch.manage");
  const thisWeek = weekStartOf(today);

  const publicUrl = `${await siteOrigin()}/lounas/${restaurant.slug}`;
  const qrSvg = await QRCode.toString(publicUrl, {
    type: "svg",
    margin: 1,
    width: 180,
    color: { dark: "#111318", light: "#ffffff" },
  });

  /*
   * Julkaisuteksti muodostetaan samasta datasta kuin sivu.
   *
   * Palvelimella eikä selaimessa: teksti sisältää hinnat, ja ne
   * muotoillaan samalla funktiolla kuin muuallakin. Selaimessa
   * rakennettuna se olisi toinen paikka jossa euro voi näyttää
   * erilaiselta.
   */
  const publicWeek = await loadPublicWeek(restaurant.slug, weekStart);
  const shareText = publicWeek ? weekAsText(publicWeek, publicUrl) : "";

  const dirty = week ? hasUnpublishedChanges(week) : false;
  const publishable = week !== null && hasContent(week);

  return (
    <div className="rf-enter space-y-5">
      {/* --- Otsikko ja viikon vaihto --- */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
            Lounas
          </h1>
          <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            Viikko {isoWeekNumber(weekStart)} · {formatWeekRange(weekStart)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <WeekNav weekStart={weekStart} thisWeek={thisWeek} />

          <Link
            href={`/lounas/${restaurant.slug}?viikko=${weekStart}&esikatselu=1`}
            target="_blank"
            rel="noreferrer"
            className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
            style={{
              background: "var(--rf-card)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="search" size={16} />
            Esikatsele
          </Link>

          {canManage ? (
            <PublishWeek
              menuId={week?.id ?? null}
              weekLabel={formatWeekRange(weekStart)}
              disabled={!publishable}
              label={dirty ? "Julkaise muutokset" : "Julkaise"}
            />
          ) : null}
        </div>
      </header>

      {/* --- Hinta ja tila --- */}
      {week ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className="text-[11px] font-medium uppercase"
                style={{ color: "var(--rf-text-3)", letterSpacing: "0.05em" }}
              >
                {DEFAULT_PRICE_NAME} · koko viikko
              </p>

              {canManage ? (
                <LunchPriceField
                  menuId={week.id}
                  name={DEFAULT_PRICE_NAME}
                  cents={
                    week.prices.find((p) => p.name === DEFAULT_PRICE_NAME)?.cents ??
                    null
                  }
                />
              ) : (
                <p className="rf-tabular text-[24px] font-semibold">
                  {week.prices.length > 0
                    ? formatMoney(week.prices[0].cents)
                    : "—"}
                </p>
              )}
            </div>

            {canManage ? (
              <LunchIncludes
                menuId={week.id}
                dessert={week.includesDessert}
                coffee={week.includesCoffee}
              />
            ) : includedSentence(week) ? (
              <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                {includedSentence(week)}
              </p>
            ) : null}

            {week.prices.filter((p) => p.name !== DEFAULT_PRICE_NAME).length > 0 ? (
              <dl className="flex flex-wrap gap-x-5 gap-y-1">
                {week.prices
                  .filter((p) => p.name !== DEFAULT_PRICE_NAME)
                  .map((price) => (
                    <div key={price.id}>
                      <dt className="text-[11px]" style={{ color: "var(--rf-text-3)" }}>
                        {price.name}
                      </dt>
                      <dd className="rf-tabular text-[15px] font-medium">
                        {formatMoney(price.cents)}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : null}
          </div>
        </Card>
      ) : null}

      {week ? (
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={week.status === "published" ? "ok" : "neutral"} dot>
            {LUNCH_STATUS_LABELS[week.status]}
          </Pill>

          {week.publishedAt ? (
            <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              Viimeksi julkaistu {formatTimestamp(week.publishedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/*
       * Julkaistun listan muokkaus ei muuta sitä mitä asiakas näkee.
       * Ilman tätä muistutusta ravintoloitsija luulisi muutoksen olevan
       * jo ovessa.
       */}
      {dirty ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p className="text-[13px] leading-relaxed">
            Julkaistuun lounaslistaan on tehty muutoksia. Asiakkaat näkevät
            yhä edellisen version.
          </p>
        </div>
      ) : null}

      {/* --- Viikon sisältö --- */}
      {week === null ? (
        <EmptyWeek
          weekStart={weekStart}
          previousWeekStart={previousWeek(weekStart)}
          hasPrevious={previous !== null && hasContent(previous)}
          canManage={canManage}
        />
      ) : (
        <>
          <WeekDays
            week={week}
            diets={diets}
            allergens={allergens}
            canManage={canManage}
          />

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {previous !== null && hasContent(previous) ? (
                <CopyPreviousWeek
                  fromWeek={previous.weekStart}
                  toWeek={weekStart}
                  fromLabel={formatWeekRange(previous.weekStart)}
                  toLabel={formatWeekRange(weekStart)}
                />
              ) : null}

              {week.status !== "archived" ? (
                <WeekStatusButton menuId={week.id} status="archived" />
              ) : (
                <WeekStatusButton menuId={week.id} status="draft" />
              )}
            </div>
          ) : null}
        </>
      )}

      {/* --- Jakaminen --- */}
      <Card>
        <CardHeader
          title="Julkinen lounassivu"
          subtitle="Asiakas näkee vain julkaistun viikon"
        />

        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="space-y-3">
            <CopyPublicLink url={publicUrl} />

            <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
              Sivu aukeaa ilman kirjautumista ja näyttää kuluvan viikon
              lounaslistan. Luonnokset eivät näy siellä lainkaan.
            </p>

            <Link
              href={`/lounas/${restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
              style={{ color: "var(--rf-accent)" }}
            >
              Avaa sivu
              <RfIcon name="chevron" size={13} />
            </Link>

            {/* Teema on ravintolan valinta, ei viikon — siksi se on
                jakamisen yhteydessä eikä viikkokohtaisten asetusten
                seassa. */}
            {canManage ? (
              <div className="pt-2">
                <LunchThemePicker current={restaurant.lunchTheme} />
              </div>
            ) : null}

            {/*
              Lista ei ole valmis kun se on tallennettu. Se on valmis kun
              se on siellä missä asiakas sen näkee.
            */}
            {canManage ? (
              <div className="pt-2">
                <LunchChannels
                  publicUrl={publicUrl}
                  previewUrl={`${publicUrl}?viikko=${weekStart}&esikatselu=1`}
                  embedUrl={`${publicUrl}/upota`}
                  displayUrl={`${publicUrl}/naytto`}
                  shareText={shareText}
                />
              </div>
            ) : null}
          </div>

          <div className="justify-self-start sm:justify-self-end">
            {/*
             * QR piirretään palvelimella SVG:nä. Kuvatiedostona se
             * sumenisi tulostettaessa, ja pöytäteline on juuri se
             * paikka johon tämä päätyy.
             */}
            <div
              className="inline-block p-2"
              style={{
                background: "#ffffff",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-control)",
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            <p className="mt-2 max-w-[180px] text-[11px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
              Tallenna kuva hiiren oikealla ja tulosta pöytään tai oveen.
            </p>
          </div>
        </div>
      </Card>

      {/* --- Historia --- */}
      {history.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Lounashistoria" subtitle="Aiemmat viikot" />
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {history.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/admin/lounas?viikko=${entry.weekStart}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      Viikko {isoWeekNumber(entry.weekStart)}
                    </p>
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {formatWeekRange(entry.weekStart)} · {entry.itemCount} ruokaa
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={entry.status === "published" ? "ok" : "neutral"}>
                      {LUNCH_STATUS_LABELS[entry.status]}
                    </Pill>
                    <span style={{ color: "var(--rf-text-3)" }}>
                      <RfIcon name="chevron" size={15} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function WeekNav({ weekStart, thisWeek }: { weekStart: string; thisWeek: string }) {
  return (
    <nav aria-label="Viikon valinta" className="flex items-center gap-1">
      <WeekLink week={previousWeek(weekStart)} label="Edellinen viikko" back />

      <Link
        href="/admin/lounas"
        aria-current={weekStart === thisWeek ? "page" : undefined}
        className="rf-press px-3 py-2.5 text-[13px] font-medium"
        style={{
          background: weekStart === thisWeek ? "var(--rf-accent-bg)" : "var(--rf-card)",
          color: weekStart === thisWeek ? "var(--rf-accent-strong)" : "var(--rf-text)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Tämä viikko
      </Link>

      <WeekLink week={nextWeek(weekStart)} label="Seuraava viikko" />
    </nav>
  );
}

function WeekLink({
  week,
  label,
  back,
}: {
  week: string;
  label: string;
  back?: boolean;
}) {
  return (
    <Link
      href={`/admin/lounas?viikko=${week}`}
      aria-label={label}
      className="rf-press flex h-10 w-10 items-center justify-center"
      style={{
        background: "var(--rf-card)",
        color: "var(--rf-text-2)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span aria-hidden="true" style={{ transform: back ? "rotate(180deg)" : undefined }}>
        <RfIcon name="chevron" size={16} />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------

function EmptyWeek({
  weekStart,
  previousWeekStart,
  hasPrevious,
  canManage,
}: {
  weekStart: string;
  previousWeekStart: string;
  hasPrevious: boolean;
  canManage: boolean;
}) {
  if (!canManage) {
    return (
      <EmptyState
        title="Ei lounaslistaa"
        description="Tälle viikolle ei ole vielä tehty lounaslistaa."
      />
    );
  }

  return (
    <Card>
      <p className="text-[15px] font-semibold">
        Tällä viikolla ei ole vielä lounaslistaa
      </p>
      <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        Aloita tyhjästä tai kopioi viime viikon lista pohjaksi. Kopio on aina
        luonnos, joten se ei julkaise mitään itsestään.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={openLunchWeek}>
          <input type="hidden" name="weekStart" value={weekStart} />
          <Button type="submit" tone="primary" icon={<RfIcon name="plus" size={16} />}>
            Aloita viikko
          </Button>
        </form>

        {hasPrevious ? (
          <CopyPreviousWeek
            fromWeek={previousWeekStart}
            toWeek={weekStart}
            fromLabel={formatWeekRange(previousWeekStart)}
            toLabel={formatWeekRange(weekStart)}
          />
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function WeekDays({
  week,
  diets,
  allergens,
  canManage,
}: {
  week: LunchWeek;
  diets: DietType[];
  allergens: { id: string; label: string }[];
  canManage: boolean;
}) {
  const weekdays = week.days.filter((day) => !isWeekend(day.date));
  const weekend = week.days.filter((day) => isWeekend(day.date));
  const weekendHasContent = weekend.some((day) => day.items.length > 0);

  return (
    <>
      {/*
       * Viisi päivää rinnakkain vasta kun tilaa on aidosti. Kapealla
       * ruudulla ne pinotaan; kutistettu viiden sarakkeen taulukko olisi
       * puhelimessa lukukelvoton.
       */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weekdays.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            week={week}
            diets={diets}
            allergens={allergens}
            canManage={canManage}
          />
        ))}
      </div>

      {/*
       * Viikonloppu on auki vain jos siellä on jotain. Moni ravintola ei
       * tarjoa lounasta viikonloppuisin, eikä kahden tyhjän kortin
       * tuijottaminen joka viikko auta ketään.
       */}
      <details open={weekendHasContent}>
        <summary
          className="cursor-pointer px-1 py-2 text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          Viikonloppu
        </summary>

        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weekend.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              week={week}
              diets={diets}
              allergens={allergens}
              canManage={canManage}
            />
          ))}
        </div>
      </details>
    </>
  );
}

function DayCard({
  day,
  week,
  diets,
  allergens,
  canManage,
}: {
  day: LunchDay;
  week: LunchWeek;
  diets: DietType[];
  allergens: { id: string; label: string }[];
  canManage: boolean;
}) {
  const dayLabel = `${weekdayName(day.date)} ${formatDayShort(day.date)}`;
  const dietLabels = new Map(diets.map((d) => [d.id, d]));

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase" style={{ letterSpacing: "0.04em" }}>
          {weekdayName(day.date)}
        </h2>
        <span className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {formatDayShort(day.date)}
        </span>
      </div>

      {/* Ruoat. Hinta on viikossa, ei päivässä. */}
      <ul className="mt-3 space-y-2.5">
        {day.items.map((item, index) => (
          <li
            key={item.id}
            className="border-b pb-2 last:border-0 last:pb-0"
            style={{ borderColor: "var(--rf-line)" }}
          >
            {/*
             * Nimi saa koko leveyden. Painikkeet olivat aiemmin rivin
             * molemmilla laidoilla ja veivät 88 pikseliä kapeasta
             * kortista, jolloin pitkä sana leikkautui kesken.
             *
             * break-words: yhdyssana on suomessa tavallinen eikä
             * "Kasvispyörykät" katkea välilyönnistä.
             */}
            <p className="text-[14px] font-medium leading-snug break-words">
              {item.name}
            </p>

            {item.description ? (
              <p
                className="mt-0.5 text-[12px] leading-relaxed break-words"
                style={{ color: "var(--rf-text-2)" }}
              >
                {item.description}
              </p>
            ) : null}

            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {item.diets.map((id) => (
                <span
                  key={id}
                  className="px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "var(--rf-inset)",
                    color: "var(--rf-text-2)",
                    borderRadius: 5,
                  }}
                >
                  {dietLabels.get(id)?.label ?? id}
                </span>
              ))}

              {canManage ? (
                <span className="ml-auto flex items-center gap-0.5">
                  {/* Järjestysnuolet vain kun järjestettävää on. */}
                  {day.items.length > 1 ? (
                    <MoveLunchItem
                      item={item}
                      first={index === 0}
                      last={index === day.items.length - 1}
                    />
                  ) : null}

                  <LunchItemDialog
                    dayId={day.id}
                    dayLabel={dayLabel}
                    item={item}
                    diets={diets}
                    allergens={allergens}
                    trigger="edit"
                  />
                  <DeleteLunchItem item={item} />
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {day.items.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Ei ruokia.
        </p>
      ) : null}

      {canManage ? (
        <div className="mt-3 space-y-2">
          <LunchItemDialog
            dayId={day.id}
            dayLabel={dayLabel}
            diets={diets}
            allergens={allergens}
            trigger="add"
          />

          {day.items.length > 0 ? (
            <CopyDay
              dayId={day.id}
              dayLabel={weekdayName(day.date)}
              targets={week.days
                .filter((other) => other.id !== day.id)
                .map((other) => ({
                  id: other.id,
                  label: `${weekdayName(other.date)} ${formatDayShort(other.date)}`,
                }))}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * Sovelluksen julkinen osoite.
 *
 * Ympäristömuuttuja jos se on asetettu; muuten pyynnön otsikoista.
 * Kovakoodattu osoite olisi väärä heti kun sovellus siirtyy omalle
 * verkkotunnukselle, ja juuri tämä osoite päätyy QR-koodiin oveen.
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const { headers } = await import("next/headers");
  const list = await headers();

  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ` +
    `klo ${pad(date.getHours())}.${pad(date.getMinutes())}`
  );
}
