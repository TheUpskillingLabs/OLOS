import Link from "next/link";

/**
 * The left-rail identity card — a compact profile summary (avatar, name,
 * headline, lab). The whole card is a single link to your profile (/profile,
 * the owner view, where editing is started); the "Following" count is a
 * separate footer link. The heavy MemberProfileView (max-w-3xl, owner PII
 * sections) is the wrong fit for a 2/7 column, so this is a purpose-built mini
 * card on the same tokens.
 */
export default function ProfileMiniCard({
  displayName,
  headline,
  metroName,
  avatarUrl,
  initials,
  followingCount = null,
}: {
  displayName: string;
  headline: string | null;
  metroName: string | null;
  avatarUrl: string | null;
  initials: string;
  /** People + pages followed — links to /network when provided. */
  followingCount?: number | null;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
      <Link
        href="/profile"
        aria-label="View your profile"
        className="flex flex-col items-center p-5 text-center transition-colors duration-150 hover:bg-ink/[0.03]"
      >
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
      </Link>

      {followingCount != null && (
        <Link
          href="/network"
          className="block border-t border-ink/10 px-5 py-3 text-center text-xs font-semibold text-teal-deep transition-colors duration-150 hover:bg-ink/[0.03] hover:text-ink"
        >
          Following · {followingCount}
        </Link>
      )}
    </section>
  );
}
