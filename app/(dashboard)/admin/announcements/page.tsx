import { requireAdmin } from "@/lib/auth/guards";
import { metroLabel } from "@/lib/metros-label";
import AnnouncementsAdmin, {
  type AdminAnnouncement,
  type LabOption,
} from "./announcements-admin";

/* Org announcements admin — compose org news for the member dashboard rail.
   Global posts (no lab) reach everyone; a lab-scoped post reaches only members
   of that lab. Drafts stay private until published. */

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: announcements }, { data: labs }] = await Promise.all([
    serviceClient
      .from("announcements")
      .select("id, title, body, lab_id, status, pinned, published_at, created_at")
      .order("created_at", { ascending: false }),
    serviceClient
      .from("metros")
      .select("id, name, st, status")
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  const rows = (announcements as AdminAnnouncement[]) ?? [];
  const labOptions: LabOption[] = (labs ?? []).map((l) => ({
    id: l.id,
    label: metroLabel(l.name, l.st),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-meta">
          Org news for the member dashboard. A global post reaches everyone; a
          lab-scoped post reaches only that lab. Pin a post to float it to the
          top.
        </p>
      </div>

      <AnnouncementsAdmin initial={rows} labs={labOptions} />
    </div>
  );
}
