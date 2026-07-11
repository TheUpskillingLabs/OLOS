import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getPeopleYouMayKnow,
  type Suggestion,
} from "@/lib/follows/suggestions";
import FollowButton from "@/app/components/follow-button";

/**
 * "People you may know" — a follow-suggestion widget seeded from the viewer's
 * podmates / labmates / cyclemates. Rendered on the dashboard (rail) and the
 * directory (grid). Each Follow refreshes the server tree, so the person drops
 * out of the suggestions and their updates flow into the feed. Renders nothing
 * when there's no one to suggest.
 */

function Avatar({
  avatarUrl,
  initials,
  name,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-deep text-sm font-bold text-white">
      {initials}
    </div>
  );
}

function SuggestionRow({ p }: { p: Suggestion }) {
  const nameEl = p.handle ? (
    <Link
      href={`/u/${p.handle}`}
      className="block truncate text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
    >
      {p.name}
    </Link>
  ) : (
    <span className="block truncate text-sm font-semibold text-ink">
      {p.name}
    </span>
  );
  return (
    <div className="flex items-center gap-3">
      {p.handle ? (
        <Link href={`/u/${p.handle}`} className="shrink-0">
          <Avatar avatarUrl={p.avatarUrl} initials={p.initials} name={p.name} />
        </Link>
      ) : (
        <Avatar avatarUrl={p.avatarUrl} initials={p.initials} name={p.name} />
      )}
      <div className="min-w-0 flex-1">
        {nameEl}
        <p className="truncate text-xs text-meta">{p.headline || p.reason}</p>
      </div>
      <FollowButton
        type="user"
        id={p.id}
        initialFollowing={false}
        size="sm"
        refreshOnChange
      />
    </div>
  );
}

export default async function PeopleYouMayKnow({
  viewerId,
  metroId = null,
  limit = 6,
  variant = "rail",
  heading = "People you may know",
}: {
  viewerId: number;
  metroId?: number | null;
  limit?: number;
  variant?: "rail" | "grid";
  heading?: string;
}) {
  const service = createServiceClient();
  const people = await getPeopleYouMayKnow(service, viewerId, {
    metroId,
    limit,
  });
  if (people.length === 0) return null;

  if (variant === "grid") {
    return (
      <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="t-h4 mb-4 text-ink">{heading}</h2>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <SuggestionRow key={p.id} p={p} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="lbl mb-4">{heading}</h2>
      <ul className="flex flex-col gap-4">
        {people.map((p) => (
          <li key={p.id}>
            <SuggestionRow p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
