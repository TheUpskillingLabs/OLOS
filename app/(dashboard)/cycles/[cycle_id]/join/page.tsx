import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import CycleInterestForm from "./cycle-interest-form";

export default async function JoinCyclePage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  if (isNaN(cycleId)) redirect("/cycles");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  // Check participant exists
  const { data: participant } = await serviceClient
    .from("participants")
    .select("id, state, neighborhood, dcpl_card, work_situation, main_focus, ai_tool_familiarity, gender, sector, current_title, linkedin, participation_commitment, primary_expertise, volunteer_interest, text_updates, photo_video_consent, source")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  // Check cycle is active
  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle || cycle.status !== "active") redirect("/cycles");

  // Get existing options for pre-fill
  const { data: existingOptions } = await serviceClient
    .from("participant_options")
    .select("option_id, option_lists!inner(list_name)")
    .eq("participant_id", participant.id);

  const selectedOptions: Record<string, number[]> = {};
  if (existingOptions) {
    for (const opt of existingOptions as unknown as { option_id: number; option_lists: { list_name: string } }[]) {
      const listName = opt.option_lists.list_name;
      if (!selectedOptions[listName]) selectedOptions[listName] = [];
      selectedOptions[listName].push(opt.option_id);
    }
  }

  // Check existing enrollment
  const { data: enrollment } = await serviceClient
    .from("cycle_enrollments")
    .select("id, status")
    .eq("participant_id", participant.id)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
          Join cycle
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {cycle.name}
        </h1>
        <p className="mt-2 text-sm text-cloud/60">
          Tell us about yourself so we can match you with the right pods and
          collaborators.
        </p>
        {enrollment && (
          <div className="mt-4 rounded-md border border-teal/20 bg-teal/[0.04] p-3 text-sm text-aqua">
            You've already submitted interest for this cycle. You can update
            your responses below.
          </div>
        )}
      </div>
      <CycleInterestForm
        cycleId={cycleId}
        defaults={participant}
        selectedOptions={selectedOptions}
      />
    </div>
  );
}
