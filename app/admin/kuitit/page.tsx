import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText, type AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  filterReceipts,
  formatMonth,
  needsReview,
  receiptsInMonth,
  searchReceipts,
  sortByDateDesc,
  type ReceiptFilter,
} from "@/lib/restoflow/expenses";
import { monthFromParams } from "@/lib/restoflow/dates";
import { duplicateIds, findDuplicates } from "@/lib/restoflow/duplicates";
import { can } from "@/lib/restoflow/permissions";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { ProductIcon, RfIcon } from "@/components/restoflow/icons";
import { MerchantBadge } from "@/components/restoflow/merchant-badge";
import { normalizeMerchantName } from "@/lib/restoflow/merchants";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";
import { DeleteReceipt, ReviewPanel } from "./review";
import { ReceiptSearch } from "./search";

export const metadata = { title: "Kuitit" };

/*
 * Suodattimet ovat tehdas, ei vakio.
 *
 * Avain on datan asia ja pysyy; otsikko on käännettävää tekstiä eikä
 * sitä voi lukita moduulin latausaikaan, jolloin kieltä ei vielä
 * tiedetä.
 */
const suodattimet = (t: AdminText): { key: ReceiptFilter; label: string }[] => [
  { key: "all", label: t.kuitit.all },
  { key: "needs_review", label: t.luokat.needsReview },
  { key: "food", label: t.luokat.food },
  { key: "alcohol", label: t.luokat.alcohol },
  { key: "soft_drinks", label: t.luokat.softDrinks },
  { key: "kitchen_supplies", label: t.luokat.kitchenSupplies },
  { key: "packaging", label: t.luokat.packaging },
  { key: "cleaning", label: t.luokat.cleaning },
  { key: "transport", label: t.luokat.transport },
  { key: "other", label: t.luokat.other },
];

export default async function AdminReceiptsPage({
  searchParams,
}: PageProps<"/admin/kuitit">) {
  const params = await searchParams;
  const { receipts, users, role, suppliers, merchants, merchantCategories, month: nykyinen } =
    await adminContext("/admin/kuitit");
  const t = adminText(await resolveLocale());

  const month = monthFromParams(params, nykyinen);

  /*
   * Kaupan tiedot kuitille.
   *
   * Kuitti osoittaa toimipisteeseen ja toimipiste brändiin, joten haku
   * on kaksivaiheinen. Se tehdään kerran tässä eikä joka kortissa:
   * kymmenen kuittia tekisi kaksikymmentä hakua listan piirtämisen
   * aikana.
   */
  const merchantById = new Map(merchants.map((m) => [m.id, m]));
  const merchantBySupplier = new Map(
    suppliers
      .filter((supplier) => supplier.merchantId !== null)
      .map((supplier) => [supplier.id, merchantById.get(supplier.merchantId!)]),
  );
  const categoryLabels = new Map(
    merchantCategories.map((c) => [c.id, c.label]),
  );

  const merchantOf = (receipt: (typeof receipts)[number]) =>
    merchantBySupplier.get(receipt.supplierId ?? "") ?? null;

  const query = typeof params.haku === "string" ? params.haku : "";
  const filter = (typeof params.suodatin === "string" ? params.suodatin : "all") as ReceiptFilter;
  const highlight = typeof params.korosta === "string" ? params.korosta : null;

  /*
   * Haku osuu myös brändiin.
   *
   * Kuitissa lukee "K-MARKET MALMI 4045" mutta käyttäjä kirjoittaa
   * "K-Market". searchReceipts ei voi tietää siitä mitään — se ei näe
   * brändiluetteloa — joten osumat yhdistetään tässä.
   */
  const q = query.trim().toLowerCase();

  const searched =
    q === ""
      ? receipts
      : (() => {
          const hits = new Map(
            searchReceipts(receipts, query).map((r) => [r.id, r]),
          );
          const normalized = normalizeMerchantName(query);

          for (const receipt of receipts) {
            const merchant = merchantOf(receipt);
            if (!merchant) continue;

            const nameHit = merchant.name.toLowerCase().includes(q);
            const aliasHit =
              normalized !== "" &&
              merchant.aliases.some((alias) => alias.includes(normalized));

            if (nameHit || aliasHit) hits.set(receipt.id, receipt);
          }

          return [...hits.values()];
        })();

  /*
   * Kuukausi rajaa listan.
   *
   * Kuittilista oli koko historia yhtenä pinona. Se on oikea vastaus
   * silloin kun etsitään yhtä kuittia, mutta väärä silloin kun
   * kysytään "mitä elokuussa ostettiin" — ja jälkimmäistä kysytään
   * useammin. Muut talouden sivut on rajattu kuukauteen jo ennestään.
   */
  const monthly = receiptsInMonth(searched, month);
  const visible = sortByDateDesc(filterReceipts(monthly, filter));

  /*
   * HAKU EI SAA HÄVITÄ RAJAUKSEEN.
   *
   * Vanhaa kuittia etsivä kirjoittaa nimen eikä muista kuukautta. Jos
   * lista vain tyhjenisi, hän päättelisi ettei kuittia ole — vaikka se
   * on kahden klikkauksen päässä. Osumat muualta lasketaan siksi
   * erikseen ja kerrotaan ääneen.
   */
  const elsewhere = q === "" ? 0 : searched.length - monthly.length;

  const total = visible.reduce((s, r) => s + r.totalCents, 0);
  const reviewCount = needsReview(receiptsInMonth(receipts, month)).length;
  const duplicates = duplicateIds(receipts);
  const duplicateGroups = findDuplicates(receipts);
  const canReview = can(role, "receipts.edit");

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {formatMonth(month)} · {visible.length} kuittia ·{" "}
            {formatMoney(total)}
            {reviewCount > 0 && filter === "all" ? ` · ${reviewCount} tarkistettavaa` : ""}
          </p>

          {elsewhere > 0 ? (
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
              {elsewhere} {elsewhere === 1 ? "osuma" : "osumaa"} muilta
              kuukausilta — vaihda kuukautta nähdäksesi ne.
            </p>
          ) : null}
        </div>

        {/*
          Vain haku.

          Tässä oli myös "Uusi kuitti", ja yläpalkissa on "Lisää kuitti"
          joka vie samaan osoitteeseen. Kaksi eri nimistä painiketta
          samalle toiminnolle vierekkäin saa etsimään eroa jota ei ole.
          Yläpalkin painike jää, koska se on jokaisella sivulla — tämä
          oli vain kuittisivulla.
        */}
        <div className="w-full md:w-auto">
          <ReceiptSearch initial={query} />
        </div>
      </div>

      {duplicateGroups.length > 0 && canReview ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-red)" }}>
              <RfIcon name="alert" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {duplicateGroups.length === 1
                  ? "Mahdollinen kaksoiskappale"
                  : `${duplicateGroups.length} mahdollista kaksoiskappaletta`}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>{t.kuitit.duplicateHint}</p>

              <ul className="mt-3 space-y-3">
                {duplicateGroups.map((group) => (
                  <li key={group.receipts[0].id}>
                    <p className="text-[14px] font-medium">
                      {group.supplierName} · {formatMoney(group.totalCents)}
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {group.reason}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {group.receipts.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="rf-tabular text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                            {formatDate(r.date)} · lisännyt{" "}
                            {users.find((u) => u.id === r.addedByUserId)?.name ?? "—"}
                          </span>
                          <DeleteReceipt receiptId={r.id} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <nav aria-label={t.sanat.filters} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-2 pb-1 md:flex-wrap">
          {suodattimet(t).map((f) => {
            const active = filter === f.key;
            const search = new URLSearchParams();
            if (f.key !== "all") search.set("suodatin", f.key);
            if (query) search.set("haku", query);
            const qs = search.toString();

            return (
              <li key={f.key}>
                <Link
                  href={qs ? `/admin/kuitit?${qs}` : "/admin/kuitit"}
                  aria-current={active ? "page" : undefined}
                  className="rf-press inline-block whitespace-nowrap px-3.5 py-1.5 text-[13px] font-medium"
                  style={{
                    background: active ? "var(--rf-accent)" : "var(--rf-card)",
                    color: active ? "#fff" : "var(--rf-text-2)",
                    borderRadius: "var(--rf-r-pill)",
                    boxShadow: active ? "none" : "var(--rf-shadow-sm)",
                  }}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        Tyhjä tila ei saa olla eri mieltä kuin ylärivi.

        "Kokeile toista hakusanaa" oli väärä neuvo silloin kun osumia on
        toisessa kuukaudessa: hakusana oli oikea, kuukausi väärä. Väärä
        neuvo lopettaa etsimisen — ja kuitti oli kahden klikkauksen
        päässä.
      */}
      {visible.length === 0 ? (
        <EmptyState
          /*
           * Kuukauden nimi ei taivu tässä.
           *
           * "Ei osumia heinäkuu 2026" on väärin ja "heinäkuussa"
           * vaatisi taivutustaulukon jota ei kannata kirjoittaa yhtä
           * otsikkoa varten. Kuukausi lukee joka tapauksessa
           * yläpalkissa ja sivun ylärivillä.
           */
          title={
            elsewhere > 0
              ? t.kuitit.noHitsThisMonth
              : query
                ? t.kuitit.noHits
                : t.kuitit.noneThisMonth
          }
          description={
            elsewhere > 0
              ? fill(t.kuitit.foundElsewhere, {
              maara: String(elsewhere),
              yksikko: elsewhere === 1 ? t.kuitit.receiptOne : t.kuitit.receiptMany,
            })
              : query
                ? "Kokeile toista hakusanaa."
                : t.kuitit.addFromButton
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((receipt) => {
            const isDuplicate = duplicates.has(receipt.id);
            const isHighlighted = receipt.id === highlight;

            return (
              <li key={receipt.id}>
                <Card
                  className={isHighlighted ? "ring-2" : ""}
                  {...(isHighlighted
                    ? { style: { boxShadow: "0 0 0 2px var(--rf-blue)" } }
                    : {})}
                >
                  <div className="flex items-start gap-3">
                    <MerchantBadge
                      merchant={merchantOf(receipt) ?? null}
                      fallbackName={receipt.supplierName}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/admin/kuitit/${receipt.id}`}
                          className="rf-hit text-[15px] font-semibold underline-offset-4 hover:underline"
                        >
                          {/* Brändinimi kun se tunnetaan, muuten kuitin
                              oma teksti. "K-Market" on luettavampi kuin
                              "K-MARKET MALMI 4045". */}
                          {merchantOf(receipt)?.name ?? receipt.supplierName}
                        </Link>
                        <p className="rf-tabular text-[17px] font-semibold">
                          {formatMoney(receipt.totalCents)}
                        </p>
                      </div>

                      <p
                        className="rf-tabular mt-0.5 text-[13px]"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatDate(receipt.date)} · {CATEGORY_LABELS[receipt.category]} ·{" "}
                        {PAYMENT_LABELS[receipt.paymentMethod]}
                      </p>

                      {merchantOf(receipt) ? (
                        <p className="text-[12px]">
                          <span
                            style={{ color: merchantOf(receipt)!.brandColor }}
                          >
                            {categoryLabels.get(merchantOf(receipt)!.category) ??
                              merchantOf(receipt)!.category}
                          </span>
                          <span style={{ color: "var(--rf-text-3)" }}>
                            {" · "}
                            {receipt.supplierName}
                          </span>
                        </p>
                      ) : null}

                      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        ALV{" "}
                        {receipt.vatCents === null ? "puuttuu" : formatMoney(receipt.vatCents)}
                        {receipt.items.length > 0 ? ` · ${fill(t.kuitit.rows, { maara: String(receipt.items.length) })}` : ""} ·
                        lisännyt{" "}
                        {users.find((u) => u.id === receipt.addedByUserId)?.name ?? "—"}
                      </p>

                      {receipt.status === "needs_review" || isDuplicate ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {isDuplicate ? (
                            <Pill tone="risk" dot>
                              mahdollinen kaksoiskappale
                            </Pill>
                          ) : null}
                          {receipt.reviewReasons.map((r) => (
                            <Pill key={r} tone="warn" dot>
                              {REVIEW_REASON_LABELS[r]}
                            </Pill>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Pill tone="ok" dot>
                            tarkistettu
                          </Pill>
                        </div>
                      )}
                    </div>
                  </div>

                  {receipt.items.length > 0 ? (
                    <details
                      className="mt-3 border-t pt-3"
                      style={{ borderColor: "var(--rf-line)" }}
                    >
                      {/* rf-hit: 20 px rivi, 40 px kosketusalue. Pehmuste
                          olisi työntänyt sen yläreunan viivan yli. */}
                      <summary className="rf-press rf-hit flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
                        <span
                          className="rf-summary-chevron"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          <RfIcon name="chevron" size={14} />
                        </span>
                        <span style={{ color: "var(--rf-blue)" }}>
                          {receipt.items.length === 1
                            ? t.kuitit.showOneRow
                            : fill(t.kuitit.showRows, { maara: String(receipt.items.length) })}
                        </span>
                      </summary>

                      <ul className="mt-3 space-y-1.5">
                        {receipt.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0" style={{ color: "var(--rf-text-3)" }}>
                                <ProductIcon
                                  description={item.description}
                                  category={item.category}
                                  size={15}
                                />
                              </span>
                              <span className="truncate">{item.description}</span>
                            </span>
                            <span className="rf-tabular shrink-0" style={{ color: "var(--rf-text-2)" }}>
                              {formatMoney(item.totalCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
                    <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {receipt.hasImage ? (
                        <>
                          <RfIcon name="image" size={14} />{t.sanat.imageAttached}</>
                      ) : (
                        t.kuitit.noImage
                      )}
                    </span>
                    <Link
                      href={`/admin/kuitit/${receipt.id}`}
                      className="rf-press -my-3 flex items-center gap-1 py-3 text-[13px] font-medium"
                      style={{ color: "var(--rf-blue)" }}
                    >{t.sanat.open}<RfIcon name="chevron" size={14} />
                    </Link>
                  </div>

                  {canReview && receipt.status === "needs_review" ? (
                    <ReviewPanel receipt={receipt} />
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
