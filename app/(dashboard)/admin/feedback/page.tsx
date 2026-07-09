import { requireAdmin } from "@/lib/auth/guards";
import FeedbackAdmin, {
  type AdminFeedback,
  type FeedbackAttachmentView,
} from "./feedback-admin";

/* Admin feedback triage — the review side of the in-app feedback widget
   (app/components/feedback/). Lists every submission newest-first, shows the
   author, the page it came from, and any screenshots (served from the private
   feedback-attachments bucket via short-lived signed URLs), and lets an admin
   move a row through open → in_review → resolved → closed. */

export const dynamic = "force-dynamic";

const BUCKET = "feedback-attachments";
// Signed-URL lifetime. The page is force-dynamic, so a fresh URL is minted on
// every load; an hour is comfortably longer than any single review session.
const SIGNED_URL_TTL = 60 * 60;

export default async function AdminFeedbackPage() {
  const { serviceClient } = await requireAdmin();

  const { data: feedbackRows } = await serviceClient
    .from("feedback")
    .select("id, participant_id, category, description, page_url, status, created_at")
    .order("created_at", { ascending: false });

  const rows = feedbackRows ?? [];
  const feedbackIds = rows.map((r) => r.id);
  const participantIds = [
    ...new Set(rows.map((r) => r.participant_id).filter((id): id is number => id != null)),
  ];

  // Attachments for these submissions + the authors, in parallel.
  const [{ data: attachmentRows }, { data: participants }] = await Promise.all([
    feedbackIds.length
      ? serviceClient
          .from("feedback_attachments")
          .select("id, feedback_id, storage_path, mime_type")
          .in("feedback_id", feedbackIds)
      : Promise.resolve({ data: [] as FeedbackAttachmentRow[] }),
    participantIds.length
      ? serviceClient
          .from("participants")
          .select("id, first_name, last_name, preferred_name, email")
          .in("id", participantIds)
      : Promise.resolve({ data: [] as ParticipantRow[] }),
  ]);

  const attachments = (attachmentRows as FeedbackAttachmentRow[] | null) ?? [];

  // Mint a signed URL per stored object (private bucket). Batch in one call.
  const signedByPath = new Map<string, string>();
  if (attachments.length) {
    const paths = attachments.map((a) => a.storage_path);
    const { data: signed } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
    }
  }

  const authorById = new Map<number, string>();
  for (const p of (participants as ParticipantRow[] | null) ?? []) {
    const name =
      p.preferred_name?.trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    authorById.set(p.id, name ? `${name} · ${p.email}` : p.email);
  }

  const attachmentsByFeedback = new Map<number, FeedbackAttachmentView[]>();
  for (const a of attachments) {
    const view: FeedbackAttachmentView = {
      id: a.id,
      mimeType: a.mime_type,
      url: signedByPath.get(a.storage_path) ?? null,
    };
    const list = attachmentsByFeedback.get(a.feedback_id) ?? [];
    list.push(view);
    attachmentsByFeedback.set(a.feedback_id, list);
  }

  const initial: AdminFeedback[] = rows.map((r) => ({
    id: r.id,
    category: r.category as AdminFeedback["category"],
    description: r.description,
    page_url: r.page_url,
    status: r.status as AdminFeedback["status"],
    created_at: r.created_at,
    author: r.participant_id != null ? (authorById.get(r.participant_id) ?? null) : null,
    attachments: attachmentsByFeedback.get(r.id) ?? [],
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Feedback</h1>
        <p className="mt-1 text-sm text-meta">
          Bug reports and suggestions sent from the in-app widget. Open a
          screenshot to see what the reporter saw, then move each item through
          triage as you work it.
        </p>
      </div>

      <FeedbackAdmin initial={initial} />
    </div>
  );
}

type FeedbackAttachmentRow = {
  id: number;
  feedback_id: number;
  storage_path: string;
  mime_type: string | null;
};

type ParticipantRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string;
};
