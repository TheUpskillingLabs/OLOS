import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { OWNER_CONSOLE_ENABLED } from "@/lib/owner/flag";
import { OWNER_ENTITY_KEYS, OWNER_REGISTRY, supportedActions } from "@/lib/owner/registry";

/**
 * The generalized owner console index — one card per owner-actionable entity, with a
 * live row count and its available verbs. Flag-gated (OWNER_CONSOLE_ENABLED) and
 * owner-gated (requireOwner). The per-entity list pages carry the actions.
 *
 * This is the "one place to manage every entity type" surface. The per-page Danger
 * Zones (cycle/pod/project/participant) remain the convenient in-context path; this
 * console is the unified fallback and the only surface for content + metros.
 */
export default async function OwnerConsolePage() {
  if (!OWNER_CONSOLE_ENABLED) notFound();
  const { serviceClient } = await requireOwner();

  const cards = await Promise.all(
    OWNER_ENTITY_KEYS.map(async (key) => {
      const d = OWNER_REGISTRY[key]!;
      const { count } = await serviceClient
        .from(d.table)
        .select("*", { count: "exact", head: true });
      return { key, label: d.label, count: count ?? 0, actions: supportedActions(d) };
    })
  );

  return (
    <div>
      <h1 className="t-h1 text-ink">Owner console</h1>
      <p className="mt-1 text-sm text-meta">
        Archive, reset, or permanently delete any entity. Every action is owner-only and
        written to the owner-actions audit log.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={`/admin/owner/${c.key}`}
            className="rounded-card border border-ink/10 bg-white p-4 transition-colors duration-150 hover:border-teal/40"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="t-h4 text-ink">{c.label}</span>
              <span className="text-sm text-meta tabular-nums">{c.count}</span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-meta">
              {c.actions.join(" · ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
