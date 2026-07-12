import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { OWNER_CONSOLE_ENABLED } from "@/lib/owner/flag";
import { getLifecycleDescriptor, supportedActions } from "@/lib/owner/registry";
import OwnerEntityActions from "@/app/components/owner-entity-actions";

/**
 * Owner console — per-entity list. Shows the newest rows of one allowlisted entity
 * with inline owner actions (archive / reset / delete, per the descriptor). Reads
 * with the service client behind requireOwner (the gate is the only protection over
 * those reads), and is flag-gated like the index.
 *
 * `participants` has no status column; every other owner entity does, so it gets a
 * Status column. The select list is built from the (allowlisted) descriptor, so the
 * typed query builder can't infer it — the rows are cast to generic records.
 */
export default async function OwnerEntityListPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  if (!OWNER_CONSOLE_ENABLED) notFound();
  const { entity } = await params;
  const descriptor = getLifecycleDescriptor(entity);
  if (!descriptor) notFound();

  const { serviceClient } = await requireOwner();

  const hasStatus = entity !== "participants";
  const selectList = [descriptor.idColumn, descriptor.labelField, ...(hasStatus ? ["status"] : [])].join(", ");
  const { data: rows } = (await serviceClient
    .from(descriptor.table)
    .select(selectList)
    .order(descriptor.idColumn, { ascending: false })
    .limit(100)) as unknown as { data: Record<string, unknown>[] | null };

  const actions = supportedActions(descriptor);
  const list = rows ?? [];

  return (
    <div>
      <Link
        href="/admin/owner"
        className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Owner console
      </Link>
      <h1 className="mt-2 t-h1 text-ink">{descriptor.label}</h1>
      <p className="mt-1 text-sm text-meta">
        Owner lifecycle actions — {actions.join(" · ")}. Showing the newest {list.length} of up to 100 rows.
      </p>

      <div className="mt-6 overflow-x-auto rounded-card border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-meta">
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              {hasStatus && <th className="px-4 py-2.5 font-medium">Status</th>}
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const id = Number(r[descriptor.idColumn]);
              const name = (r[descriptor.labelField] as string | null) || `${descriptor.label} ${id}`;
              return (
                <tr key={id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-2.5 text-meta tabular-nums">{id}</td>
                  <td className="px-4 py-2.5 text-ink">{name}</td>
                  {hasStatus && (
                    <td className="px-4 py-2.5 text-meta">{(r.status as string | null) ?? "—"}</td>
                  )}
                  <td className="px-4 py-2.5">
                    <OwnerEntityActions
                      entity={entity}
                      id={id}
                      name={name}
                      label={descriptor.label}
                      actions={actions}
                    />
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={hasStatus ? 4 : 3} className="px-4 py-6 text-center text-meta">
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
