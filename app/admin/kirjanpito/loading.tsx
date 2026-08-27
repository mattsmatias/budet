import { CardsAndListSkeleton } from "@/components/restoflow/skeletons";

/**
 * Latausnäkymä.
 *
 * Kirjanpito alkaa neljällä avainluvulla ja jatkuu listalla, kuten
 * Kulut ja Palkat.
 */
export default function Loading() {
  return <CardsAndListSkeleton cards={4} />;
}
