import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/app/components/ui";
import FollowButton from "@/app/components/follow-button";
import {
  getFollowedParticipantIds,
  getFollowedPages,
} from "@/lib/follows/data";
import {
  pageNames,
  pageTypeLabel,
  type PageType,
} from "@/lib/pages/authz";

/**
 * /network — everything you follow, in one place. Two lists: people and pages,
 * each row with a Follow toggle so you can unfollow in place (the one spot to
 * mute an auto-followed pod/project without hunting for its page). Linked from
 * the dashboard profile card's "Following · N".
 */

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: me } = await service
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me) redirect("/register");

  const [followedIds, followedPages] = await Promise.all([
    getFollowedParticipantIds(service, me.id),
    getFollowedPages(service, me.id),
  ]);

  // People rows (display allowlist only).
  const people =
    followedIds.length > 0
      ? ((
          await service
            .from("participants")
            .select(
              "id, handle, preferred_name, first_name, last_name, headline, profile_image_url"
            )
            .in("id", followedIds)
        ).data ?? [])
      : [];
  people.sort((a, b) =>
    (a.preferred_name || a.first_name || "").localeCompare(
      b.preferred_name || b.first_name || ""
    )
  );

  // Page rows — resolve names/links per type.
  const byType = new Map<PageType, number[]>();
  for (const p of followedPages) {
    byType.set(p.type, [...(byType.get(p.type) ?? []), p.id]);
  }
  const pageRows: { type: PageType; id: number; name: string; href: string }[] =
    [];
  for (const [type, ids] of byType) {
    const named = await pageNames(service, type, ids);
    for (const [id, meta] of named) {
      pageRows.push({ type, id, name: meta.name, href: meta.href });
    }
  }
  pageRows.sort(
    (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
  );

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="t-h1 text-ink">Your network</h1>
        <p className="mt-1 t-small">
          Everyone and everything you follow. Their updates make up your feed.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="section-head mb-3">
          People · {people.length}
        </h2>
        {people.length === 0 ? (
          <EmptyState
            title="You're not following anyone yet"
            description="Follow members to see their updates in your feed."
            action={
              <Link href="/directory" className="btn btn-teal px-4 py-2 text-sm">
                Find people to follow
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {people.map((p) => {
              const name =
                p.preferred_name ||
                [p.first_name, p.last_name].filter(Boolean).join(" ") ||
                "A member";
              const initials =
                `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() ||
                "•";
              const href = p.handle ? `/u/${p.handle}` : null;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-card border border-ink/10 bg-white p-4 shadow-card"
                >
                  {p.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.profile_image_url}
                      alt={name}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-deep text-sm font-bold text-white">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        className="block truncate text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold text-ink">
                        {name}
                      </span>
                    )}
                    {p.headline && (
                      <p className="truncate text-xs text-meta">{p.headline}</p>
                    )}
                  </div>
                  <FollowButton
                    type="user"
                    id={p.id}
                    initialFollowing
                    size="sm"
                    refreshOnChange
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-head mb-3">
          Pages · {pageRows.length}
        </h2>
        {pageRows.length === 0 ? (
          <EmptyState
            title="No pages yet"
            description="Follow a lab, sector, workstream, pod, or project to get its updates in your feed."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {pageRows.map((row) => (
              <li
                key={`${row.type}:${row.id}`}
                className="flex items-center gap-3 rounded-card border border-ink/10 bg-white p-4 shadow-card"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">
                  {row.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={row.href}
                    className="block truncate text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
                  >
                    {row.name}
                  </Link>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-meta">
                    {pageTypeLabel(row.type)}
                  </p>
                </div>
                <FollowButton
                  type={row.type}
                  id={row.id}
                  initialFollowing
                  size="sm"
                  refreshOnChange
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
