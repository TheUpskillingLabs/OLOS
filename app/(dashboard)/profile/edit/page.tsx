import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasPlaceholderName } from "@/lib/participants/placeholder";
import ProfileEditForm from "./profile-edit-form";

// Allow only same-origin relative paths in the `next` query param so the
// redirect cannot be hijacked to push users at an arbitrary external URL.
function safeNextPath(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProfileEditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requiredParam = Array.isArray(params.required)
    ? params.required[0]
    : params.required;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;

  // Mode B fires when the layout redirect sends a placeholder-name
  // participant here with ?required=true. Mode A is the voluntary path
  // (clicking "Edit profile" from /profile or nav).
  const required = requiredParam === "true";
  const nextPath = safeNextPath(nextParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Service client so we can read fields the cookie-bound client's RLS
  // would scope away. We're only displaying the participant's own row
  // (auth_user_id match below) so there's no cross-account exposure.
  const serviceClient = createServiceClient();
  const { data: participant } = await serviceClient
    .from("participants")
    .select("id, email, first_name, last_name, preferred_name, headline, bio, handle")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  const placeholder = hasPlaceholderName(
    participant.first_name,
    participant.last_name
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        <header className="border-b border-ink/10 pb-4">
          <h1 className="t-h2 text-ink">
            {required
              ? "Complete your profile to continue"
              : "Edit profile"}
          </h1>
          {required && placeholder && (
            <p className="mt-2 text-sm text-charcoal">
              We don&apos;t have your name on file yet. Please enter your
              first and last name below — you&apos;ll be returned to where
              you were headed once we save it.
            </p>
          )}
          {required && !placeholder && (
            <p className="mt-2 text-sm text-charcoal">
              Please review and confirm your profile to continue.
            </p>
          )}
          {!required && (
            <p className="mt-2 text-sm text-slate">
              Update your name, how you&apos;d like to be addressed, and your
              directory profile.
            </p>
          )}
        </header>

        <ProfileEditForm
          participantId={participant.id}
          initial={{
            first_name: participant.first_name ?? "",
            last_name: participant.last_name ?? "",
            preferred_name: participant.preferred_name ?? "",
            headline: participant.headline ?? "",
            bio: participant.bio ?? "",
            handle: participant.handle ?? "",
          }}
          required={required}
          nextPath={nextPath}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
