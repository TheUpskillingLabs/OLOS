/**
 * The single avatar-precedence rule, used everywhere a member's photo renders
 * (own profile, nav, directory, /u/[handle]): the uploaded photo wins, then the
 * Google OAuth photo (only available for the signed-in viewer's own session),
 * then null (callers render initials).
 *
 * Directory + /u/[handle] view OTHER members, so they pass no `user` and get
 * `profile_image_url` only — the auth callback backfills the Google photo into
 * `profile_image_url` on first sign-in so those members aren't faceless to peers.
 */

interface AvatarParticipant {
  profile_image_url?: string | null;
}

interface AvatarUser {
  user_metadata?: {
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
}

export function resolveAvatarUrl(
  participant: AvatarParticipant,
  user?: AvatarUser | null
): string | null {
  if (participant.profile_image_url) return participant.profile_image_url;
  const google =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
  return google || null;
}
