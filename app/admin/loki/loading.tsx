import { ListSkeleton } from "@/components/restoflow/skeletons";

/**
 * Latausnäkymä.
 *
 * Sivun oma luuranko: yhteinen hallinnan luuranko oli yleiskatsauksen
 * muotoinen, ja sisältö hyppäsi paikalleen joka latauksella.
 */
export default function Loading() {
  return <ListSkeleton cards={4} />;
}
