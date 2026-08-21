import { BottomNav } from "./nav";

/**
 * Työntekijän mobiilikuori.
 *
 * Leveys on rajattu puhelimen mittoihin myös työpöydällä: näkymä on
 * suunniteltu peukalolle, ja venytettynä se näyttäisi keskeneräiseltä
 * työpöytäsovellukselta.
 */
export default function MobileAppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-screen justify-center">
      <div
        className="flex min-h-screen w-full max-w-md flex-col"
        style={{ background: "var(--rf-bg)" }}
      >
        <main className="flex-1 px-4 pb-6 pt-3">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
