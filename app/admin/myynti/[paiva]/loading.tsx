import { StackSkeleton } from "@/components/restoflow/skeletons";

/**
 * Latausnäkymä.
 *
 * Sivun oma luuranko: yhteinen hallinnan luuranko on yleiskatsauksen
 * muotoinen, ja sisältö hyppäsi paikalleen joka latauksella.
 */
export default function Loading() {
  return <StackSkeleton />;
}
