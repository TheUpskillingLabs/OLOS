import Link from "next/link";

/**
 * The left-rail identity card — a compact profile summary (avatar, name,
 * headline, lab) with links to the public profile and the edit page. The heavy
 * MemberProfileView (max-w-3xl, owner PII sections) is the wrong fit for a 2/7
 * column, so this is a purpose-built mini card on the same tokens.
 */
export default function ProfileMiniCard({
  displayName,
  headline,
  metroName,
  avatarUrl,
  initials,
  handle,
  followingCount = null,
}: {
  displayName: string;
  headline: string | null;
  metroName: string | null;
  avatarUrl: string | null;
  initials: string;
  handle: string | null;
  /** People + pages followed — links to /network when provided. */
  followingCount?: number | null;
}) {
  return (
    <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex flex-col items-center text-center">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-16 w-16 rounded-full object-cover ring-1 ring-ink/10"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-deep text-lg font-bold text-white">
            {initials}
          </div>
        )}
        <h2 className="mt-3 t-h4 text-ink">{displayName}</h2>
        {headline && <p className="mt-1 text-sm text-teal-deep">{headline}</p>}
        {metroName && <p className="mt-1 text-xs text-meta">{metroName}</p>}
        {followingCount != null && (
          <Link
            href="/network"
            className="mt-2 text-xs font-semibold text-teal-deep transition-colors duration-150 hover:text-ink"
          >
            Following · {followingCount}
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {handle && (
          <Link
            href={`/u/${handle}`}
            className="btn btn-ghost w-full justify-center px-4 py-2 text-sm"
          >
            View profile
          </Link>
        )}
        <Link
          href="/profile/edit"
          className="btn btn-ghost w-full justify-center px-4 py-2 text-sm"
        >
          Edit profile
        </Link>
      </div>
    </section>
  );
}
