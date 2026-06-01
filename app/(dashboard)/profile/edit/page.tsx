import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import ProfileEditForm from "./profile-edit-form";

const PLACEHOLDER = /^unknown$/i;

function hasPlaceholderName(first: string | null, last: string | null): boolean {
  return (
    PLACEHOLDER.test((first ?? "").trim()) ||
    PLACEHOLDER.test((last ?? "").trim())
  );
}

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
    .select("id, email, first_name, last_name, preferred_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  const placeholder = hasPlaceholderName(
    participant.first_name,
    participant.last_name
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-whisper bg-white/[0.02] p-6 sm:p-8">
        <header className="border-b border-whisper pb-4">
          <h1 className="text-xl font-semibold text-white">
            {required
              ? "Complete your profile to continue"
              : "Edit profile"}
          </h1>
          {required && placeholder && (
            <p className="mt-2 text-sm text-cloud/80">
              We don&apos;t have your name on file yet. Please enter your
              first and last name below — you&apos;ll be returned to where
              you were headed once we save it.
            </p>
          )}
          {required && !placeholder && (
            <p className="mt-2 text-sm text-cloud/80">
              Please review and confirm your profile to continue.
            </p>
          )}
          {!required && (
            <p className="mt-2 text-sm text-cloud/70">
              Update your name and how you&apos;d like to be addressed.
            </p>
          )}
        </header>

        <ProfileEditForm
          participantId={participant.id}
          initial={{
            first_name: participant.first_name ?? "",
            last_name: participant.last_name ?? "",
            preferred_name: participant.preferred_name ?? "",
          }}
          required={required}
          nextPath={nextPath}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
