import { requireAdmin } from "@/lib/auth/guards";
import WeeklyMessagesForm from "./weekly-messages-form";

/* Admin surface for the program-global weekly "What's next" messages
   (weekly_messages, 00088): one message per wk0→wk12 marker, shared by every
   open cycle. A participant sees the current week's message right after
   saving that week's Learning Log, and it stays on their dashboard for the
   rest of the week. */

export const dynamic = "force-dynamic";

export default async function AdminWeeklyMessagesPage() {
  const { serviceClient } = await requireAdmin();

  const { data: messages } = await serviceClient
    .from("weekly_messages")
    .select("week, message")
    .order("week", { ascending: true });

  return (
    <div>
      <h1 className="t-h2 text-ink">Weekly &ldquo;What&apos;s next&rdquo; messages</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-meta">
        One message per cycle week, shared by every open cycle. Participants
        see the current week&apos;s message after they save that week&apos;s
        Learning Log; a blank box means no message that week.
      </p>
      <div className="max-w-2xl">
        <WeeklyMessagesForm messages={messages ?? []} />
      </div>
    </div>
  );
}
