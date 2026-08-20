import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Luo organisaatio" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (await getActiveOrg()) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Luo organisaatio</h1>
      <p className="mt-2 text-sm text-muted">
        Tervetuloa{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}. Neljä
        kysymystä, sitten pääset lähettämään ensimmäisen kuitin.
      </p>
      <OnboardingForm />
    </div>
  );
}
