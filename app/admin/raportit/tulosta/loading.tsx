import { StackSkeleton } from "@/components/restoflow/skeletons";

/**
 * Latausnäkymä tulostettavalle raportille.
 *
 * Sivu on kapea pystysuora asiakirja, ei yleiskatsauksen korttiruudukko.
 * Ilman omaa luurankoa tulostusnäkymä avautui neljän avainluvun
 * muotoisena ja vaihtui sitten asiakirjaksi.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <StackSkeleton cards={4} />
    </div>
  );
}
