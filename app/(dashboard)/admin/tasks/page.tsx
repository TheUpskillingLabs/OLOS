import { requireAdmin } from "@/lib/auth/guards";
import { memberTaskPreview } from "@/lib/tasks/preview";
import { fmtLabDateTime } from "@/lib/cycles/lab-time";
import { StatusBadge } from "@/app/components/ui";
import CustomTasksManager, {
  type CustomTaskRow,
  type CycleOption,
} from "./custom-tasks-manager";

/* /admin/tasks — the front end for the central task system:
   1. Author member tasks (custom_tasks, 00093) that appear in every
      member's Up-next queue — program-global or scoped to one cycle.
   2. Preview any member's live queue (?preview=email) — the same
      assembleTasks output their dashboard renders, for support/debug. */

export const dynamic = "force-dynamic";

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { serviceClient } = await requireAdmin();
  const { preview } = await searchParams;

  const [{ data: tasks }, { data: cycles }] = await Promise.all([
    serviceClient
      .from("custom_tasks")
      .select(
        "id, title, detail, href, cta, cycle_id, starts_at, ends_at, pinned, dismissible, archived_at"
      )
      .order("created_at", { ascending: false }),
    serviceClient
      .from("cycles")
      .select("id, name, status")
      .in("status", ["active", "upcoming"])
      .eq("mode", "open")
      .order("start_date", { ascending: false }),
  ]);

  const previewResult = preview ? await memberTaskPreview(preview) : null;

  return (
    <div>
      <h1 className="t-h2 text-ink">Member tasks</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-meta">
        Tasks you author here land in members&apos; &ldquo;Up next&rdquo;
        queue alongside the derived ones (cycle windows, the weekly log, the
        field survey). Retire with Archive — re-announcing something is a new
        task, so earlier dismissals don&apos;t hide it.
      </p>

      <div className="max-w-3xl">
        <CustomTasksManager
          tasks={(tasks ?? []) as CustomTaskRow[]}
          cycles={(cycles ?? []) as CycleOption[]}
          nowMs={new Date().getTime()}
        />
      </div>

      {/* ── Queue preview ─────────────────────────────────────────── */}
      <section className="mt-12 max-w-3xl">
        <h2 className="t-h4 text-ink">Preview a member&apos;s queue</h2>
        <p className="mt-1 mb-4 text-sm text-meta">
          Exactly what the member sees on their dashboard right now — after
          audience filters, done-ness, and their own dismissals.
        </p>
        <form method="GET" className="flex items-center gap-3">
          <input
            type="text"
            name="preview"
            defaultValue={preview ?? ""}
            placeholder="Email or name"
            className="block w-72 rounded-card border border-ink/10 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
          />
          <button type="submit" className="btn btn-teal px-4 py-2.5 text-sm">
            Preview
          </button>
        </form>

        {preview && !previewResult && (
          <p className="mt-4 text-sm text-red">
            No member matched &ldquo;{preview}&rdquo;.
          </p>
        )}

        {previewResult && (
          <div className="mt-5 rounded-card border border-ink/10 bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-semibold tracking-tight text-ink">
                {previewResult.participant.displayName}
              </span>
              <span className="text-sm text-meta">
                {previewResult.participant.email}
              </span>
              <StatusBadge variant="draft">
                state: {previewResult.state}
              </StatusBadge>
            </div>

            <h3 className="lbl mb-2">Up next ({previewResult.tasks.queue.length})</h3>
            {previewResult.tasks.queue.length === 0 ? (
              <p className="mb-4 text-sm text-meta">Queue is empty.</p>
            ) : (
              <ol className="mb-4 divide-y divide-ink/10">
                {previewResult.tasks.queue.map((t) => (
                  <li key={t.instanceKey} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {t.title}
                      </span>
                      <span className="block text-xs text-meta">
                        {t.kind} · priority {t.priority}
                        {t.deadline ? ` · ${fmtLabDateTime(t.deadline)}` : ""}
                        {" · "}
                        <span className="break-all">{t.href}</span>
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 gap-1.5">
                      {t.blocking && <StatusBadge variant="inactive">blocking</StatusBadge>}
                      {t.dismissible && <StatusBadge variant="draft">dismissible</StatusBadge>}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <h3 className="lbl mb-2">
              Get set up ({previewResult.tasks.checklist.filter((t) => t.done).length}/
              {previewResult.tasks.checklist.length} done)
            </h3>
            {previewResult.tasks.checklist.length === 0 ? (
              <p className="text-sm text-meta">Checklist hidden.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {previewResult.tasks.checklist.map((t) => (
                  <li key={t.instanceKey} className="flex items-center gap-2 py-2 text-sm">
                    <span aria-hidden>{t.done ? "✅" : "⬜"}</span>
                    <span className={t.done ? "text-meta line-through" : "text-charcoal"}>
                      {t.title}
                    </span>
                    {t.advisory && <StatusBadge variant="draft">advisory</StatusBadge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
