import { CalendarSkeleton } from "@/components/restoflow/skeletons";

/**
 * Latausnäkymä.
 *
 * Kalenteri on iso ruudukko: listan muotoinen luuranko lupaisi väärän
 * sivun ja sisältö hyppäisi paikalleen.
 */
export default function Loading() {
  return <CalendarSkeleton />;
}
