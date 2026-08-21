import { redirect } from "next/navigation";
import { getActiveRestaurant, requireUser } from "@/lib/restoflow/session";
import { SetupForm } from "./form";

export const metadata = { title: "Perusta ravintola" };

export default async function SetupPage() {
  const user = await requireUser("/aloitus");
  if (await getActiveRestaurant()) redirect("/admin");

  const firstName = user.fullName?.split(" ")[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5 py-16">
      <div className="rf-enter">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Perusta ravintola
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Tervetuloa{firstName ? `, ${firstName}` : ""}. Kaksi kenttää, sitten
          pääset lisäämään kuitteja ja kirjaamaan työaikaa.
        </p>

        <SetupForm />

        <p className="mt-6 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Sinusta tulee ravintolan omistaja. Voit kutsua managereita,
          työntekijöitä ja kirjanpitäjän myöhemmin.
        </p>
      </div>
    </div>
  );
}
