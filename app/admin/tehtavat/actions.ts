"use server";

/**
 * Tehtävien kirjoitustoiminnot.
 *
 * TILAA EI TALLENNETA, VAIN TEOT.
 *
 * "Tehty" ja "peruttu" ovat ihmisen tekoja ja ne tallennetaan
 * aikaleimoina. Myöhässä oleminen ei ole teko vaan ajan kulumista,
 * eikä sitä siksi kirjoiteta mihinkään — se lasketaan joka kerta
 * uudelleen.
 *
 * Merkintä tehdyksi kulkee kannan funktion kautta eikä suorana
 * päivityksenä: vastuuhenkilö saa kuitata oman tehtävänsä, muttei
 * siirtää eräpäivää tai vaihtaa vastuuhenkilöä.
 */

import { revalidatePath } from "next/cache";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import type { AdminState } from "../actions";

const PATH = "/admin/tehtavat";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^\d{2}:\d{2}$/;

const PRIORITIES = new Set(["normal", "important", "critical"]);
const VISIBILITIES = new Set([
  "owner_only",
  "managers",
  "assigned_user",
  "all_staff",
]);
const RECURRENCES = new Set(["none", "daily", "weekly", "monthly", "yearly"]);

/**
 * Muistutuspäivät lomakkeelta.
 *
 * Kaksinkertaiset ja mahdottomat arvot pois: sama päivä kahdesti
 * tuottaisi saman muistutuksen kahdesti, ja vuoden takainen muistutus
 * ei ole muistutus vaan kohinaa.
 */
function parseReminderDays(values: FormDataEntryValue[]): number[] {
  const days = values
    .map((value) => Number(String(value)))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 30);

  return [...new Set(days)].sort((a, b) => b - a);
}

export async function saveTask(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "tasks.manage")) return { error: "Ei oikeutta hallita tehtäviä." };

  const title = String(formData.get("title") ?? "").trim();
  if (title === "") return { error: "Anna tehtävälle nimi." };
  if (title.length > 200) return { error: "Nimi on liian pitkä." };

  const dueOn = String(formData.get("dueOn") ?? "");
  if (!ISO_DATE.test(dueOn)) return { error: "Tarkista eräpäivä." };

  const dueTimeRaw = String(formData.get("dueTime") ?? "").trim();
  if (dueTimeRaw !== "" && !TIME.test(dueTimeRaw)) {
    return { error: "Tarkista kellonaika." };
  }

  const priority = String(formData.get("priority") ?? "normal");
  const visibility = String(formData.get("visibility") ?? "managers");
  const recurrence = String(formData.get("recurrence") ?? "none");

  if (!PRIORITIES.has(priority)) return { error: "Tuntematon prioriteetti." };
  if (!VISIBILITIES.has(visibility)) return { error: "Tuntematon näkyvyys." };
  if (!RECURRENCES.has(recurrence)) return { error: "Tuntematon toistuvuus." };

  const assignedRaw = String(formData.get("assignedTo") ?? "").trim();
  const assignedTo = assignedRaw === "" ? null : assignedRaw;
  if (assignedTo !== null && !UUID.test(assignedTo)) {
    return { error: "Tarkista vastuuhenkilö." };
  }

  /*
   * Vastuuhenkilö on oltava ravintolan jäsen.
   *
   * Kanta hyväksyisi minkä tahansa profiilin, koska vierasavain
   * osoittaa profiles-tauluun. Toisen ravintolan työntekijälle
   * osoitettu tehtävä ei näkyisi kenellekään.
   */
  const supabase = await createClient();

  if (assignedTo !== null) {
    const { data: member } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", assignedTo)
      .maybeSingle();

    if (!member) return { error: "Vastuuhenkilö ei ole tämän ravintolan jäsen." };
  }

  const payload = {
    restaurant_id: restaurant.id,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    due_on: dueOn,
    due_time: dueTimeRaw === "" ? null : dueTimeRaw,
    priority,
    visibility,
    assigned_to: assignedTo,
    recurrence,
    remind_days_before: parseReminderDays(formData.getAll("remindDays")),
    remind_on_due: formData.get("remindOnDue") !== null,
    remind_when_overdue: formData.get("remindOverdue") !== null,
  };

  const id = String(formData.get("id") ?? "").trim();

  if (id !== "") {
    if (!UUID.test(id)) return { error: "Tuntematon tehtävä." };

    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (error) return { error: `Tallennus epäonnistui: ${error.message}` };

    revalidatePath("/admin", "layout");
    return { notice: "Tehtävä päivitetty." };
  }

  const { error } = await supabase
    .from("tasks")
    .insert({ ...payload, created_by: user.id });

  if (error) return { error: `Tallennus epäonnistui: ${error.message}` };

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  return { notice: "Tehtävä luotu." };
}

/**
 * Merkitse tehdyksi.
 *
 * Toistuva tehtävä synnyttää seuraavan esiintymän kannassa samassa
 * kutsussa. Jokainen esiintymä on oma rivinsä omalla tilallaan:
 * elokuun vuokra voi olla maksettu ja syyskuun myöhässä.
 */
export async function completeTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  await requireContext(PATH);

  const supabase = await createClient();
  await supabase.rpc("complete_task", { p_task: id });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

export async function cancelTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const { role } = await requireContext(PATH);
  if (!can(role, "tasks.manage")) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_task", { p_task: id });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

export async function reopenTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const { role } = await requireContext(PATH);
  if (!can(role, "tasks.manage")) return;

  const supabase = await createClient();
  await supabase.rpc("reopen_task", { p_task: id });

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

/**
 * Määräajan siirto.
 *
 * Oma toimintonsa eikä osa muokkausta: siirto on se mitä kiireessä
 * tehdään, ja siitä jää lokiin oma merkintänsä vanhoine ja uusine
 * päivineen. Muokkauslomakkeen kautta sama muutos hukkuisi muiden
 * kenttien sekaan.
 */
export async function postponeTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const dueOn = String(formData.get("dueOn") ?? "");

  if (!UUID.test(id) || !ISO_DATE.test(dueOn)) return;

  const { role } = await requireContext(PATH);
  if (!can(role, "tasks.manage")) return;

  const supabase = await createClient();
  await supabase.from("tasks").update({ due_on: dueOn }).eq("id", id);

  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
}

export async function deleteTask(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const { role } = await requireContext(PATH);
  if (!can(role, "tasks.manage")) return;

  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", id);

  revalidatePath("/admin", "layout");
}
